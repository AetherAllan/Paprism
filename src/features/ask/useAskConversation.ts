import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProviderProfile } from "@/features/settings/providerCore";
import type { PaperDocument } from "@/features/viewer/paperDocument";
import type { Paper } from "@/types/paper";
import { buildAskContext, buildPaperChunks, createAskId } from "./askCore";
import { requestChat } from "./askClient";
import {
  clearPaperAskData,
  ensureAskThread,
  insertAskMessage,
  insertAskSource,
  loadAskMessages,
  loadAskSources,
  loadAskThread,
  resetAskAssistantMessage,
  saveAskThreadUi,
  updateAskMessage,
} from "./askDatabase";
import { retrievePaperChunks } from "./askRag";
import type {
  AskChunk,
  AskMessage,
  AskSelection,
  AskSource,
  EmbeddingProfile,
} from "./askTypes";

const UI_SAVE_DELAY_MS = 500;
const STREAM_RENDER_INTERVAL_MS = 60;

type Params = {
  paper: Paper | null;
  document: PaperDocument | null;
  chatProfile: ProviderProfile | null;
  getChatApiKey: (profileId: string) => Promise<string | null>;
  embeddingProfile: EmbeddingProfile | null;
  getEmbeddingApiKey: () => Promise<string | null>;
};

export function useAskConversation(params: Params) {
  const {
    paper,
    document,
    chatProfile,
    getChatApiKey,
    embeddingProfile,
    getEmbeddingApiKey,
  } = params;
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [sources, setSources] = useState<AskSource[]>([]);
  const [draft, setDraft] = useState("");
  const [selection, setSelection] = useState<AskSelection | null>(null);
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState<string | null>(null);
  const [semanticUsed, setSemanticUsed] = useState(true);
  // Only the restored position lives in state. The live offset changes on every
  // scroll tick and must not re-render the reader underneath the sheet.
  const [chatOffset, setRestoredOffset] = useState(0);
  const liveOffset = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const sessionId = useRef(0);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  // Updated in an effect, not during render, so cleanups in the commit that
  // closes a paper still see that paper and can flush its latest draft.
  const uiState = useRef({ draft, selection, paper });
  useEffect(() => {
    uiState.current = { draft, selection, paper };
  });
  // The thread UI may be saved only after that paper's thread has loaded.
  // Otherwise the state reset below would overwrite a stored draft with "".
  const loadedThread = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveUi = useCallback(async () => {
    const {
      draft: nextDraft,
      selection: nextSelection,
      paper: current,
    } = uiState.current;
    if (!current || loadedThread.current !== current.arxivId) return;
    await saveAskThreadUi(
      current.arxivId,
      nextDraft,
      liveOffset.current,
      nextSelection,
    );
  }, []);

  const scheduleUiSave = useCallback(() => {
    // Drafts and the active quote should survive process death, but writing on
    // every keystroke would turn SQLite into a token-by-token event log.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void saveUi().catch(() => undefined);
    }, UI_SAVE_DELAY_MS);
  }, [saveUi]);

  const setChatOffset = useCallback(
    (offset: number) => {
      liveOffset.current = offset;
      scheduleUiSave();
    },
    [scheduleUiSave],
  );

  useEffect(() => {
    const id = ++sessionId.current;
    controller.current?.abort();
    loadedThread.current = null;
    liveOffset.current = 0;
    setMessages([]);
    setSources([]);
    setDraft("");
    setSelection(null);
    setRestoredOffset(0);
    setBusy(false);
    setActivity(null);
    if (!paper) return;
    void ensureAskThread(paper)
      .then(async () => {
        const [thread, nextMessages, nextSources] = await Promise.all([
          loadAskThread(paper.arxivId),
          loadAskMessages(paper.arxivId),
          loadAskSources(paper.arxivId),
        ]);
        if (sessionId.current !== id) return;
        loadedThread.current = paper.arxivId;
        liveOffset.current = thread?.chatOffset ?? 0;
        setDraft(thread?.draft ?? "");
        setSelection(thread?.selection ?? null);
        setRestoredOffset(thread?.chatOffset ?? 0);
        setMessages(nextMessages);
        setSources(nextSources);
      })
      .catch(() => undefined);
    return () => {
      // Flush a pending edit against this paper before the identity changes.
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        void saveUi().catch(() => undefined);
      }
      controller.current?.abort();
      controller.current = null;
    };
  }, [paper, saveUi]);

  const visibleChunk = useCallback(
    (blockId?: string | null): AskChunk | null => {
      if (!document || !blockId) return null;
      return (
        buildPaperChunks(document).find((chunk) => chunk.blockId === blockId) ??
        null
      );
    },
    [document],
  );

  const send = useCallback(
    async (
      question: string,
      visibleBlockId?: string | null,
      webSearch = false,
      retryAssistantId?: string,
    ) => {
      const profile = chatProfile;
      const trimmed = question.trim();
      if (!paper || !document || !profile || !trimmed || busyRef.current)
        return;
      busyRef.current = true;
      let apiKey: string | null;
      try {
        apiKey = await getChatApiKey(profile.id);
      } catch (error) {
        busyRef.current = false;
        throw error;
      }
      if (!apiKey) {
        busyRef.current = false;
        throw new Error("Ask Chat Provider API key is missing");
      }
      const currentSession = sessionId.current;
      const abort = new AbortController();
      controller.current = abort;
      const retryIndex = retryAssistantId
        ? messagesRef.current.findIndex(
            (message) =>
              message.id === retryAssistantId && message.role === "assistant",
          )
        : -1;
      const retryUser =
        retryIndex >= 0
          ? [...messagesRef.current.slice(0, retryIndex)]
              .reverse()
              .find((message) => message.role === "user")
          : undefined;
      const retryAssistant =
        retryIndex >= 0 ? messagesRef.current[retryIndex] : undefined;
      const user: AskMessage =
        retryUser ??
        ({
          id: createAskId("user"),
          arxivId: paper.arxivId,
          role: "user",
          content: trimmed,
          status: "complete",
          createdAt: Date.now(),
        } satisfies AskMessage);
      const assistant: AskMessage = retryAssistant
        ? { ...retryAssistant, content: "", status: "pending" }
        : {
            id: createAskId("assistant"),
            arxivId: paper.arxivId,
            role: "assistant",
            content: "",
            status: "pending",
            createdAt: Date.now() + 1,
          };
      const isRetry = Boolean(retryUser && retryAssistant);
      let messagesInserted = false;
      let checkpoint = Promise.resolve();
      let streamedText = "";
      let flushTimer: ReturnType<typeof setTimeout> | null = null;
      const cancelFlush = () => {
        if (flushTimer) clearTimeout(flushTimer);
        flushTimer = null;
      };
      // Providers can emit dozens of chunks per second. Rendering at a steady
      // rate keeps typing and scrolling responsive during long answers.
      const flushStream = () => {
        flushTimer = null;
        if (sessionId.current !== currentSession) return;
        const text = streamedText;
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistant.id
              ? { ...message, content: text, status: "streaming" }
              : message,
          ),
        );
      };
      try {
        if (isRetry) {
          await resetAskAssistantMessage(assistant.id);
        } else {
          await insertAskMessage(user);
          await insertAskMessage(assistant);
        }
        messagesInserted = true;
        setMessages((previous) =>
          isRetry
            ? previous.map((message) =>
                message.id === assistant.id ? assistant : message,
              )
            : [...previous, user, assistant],
        );
        if (isRetry) {
          setSources((previous) =>
            previous.filter((source) => source.messageId !== assistant.id),
          );
        } else {
          // A retry re-sends an old question. It must not clear the question
          // the user is currently typing.
          setDraft("");
        }
        setBusy(true);
        setSemanticUsed(true);
        setActivity("retrieving");
        let retrieved: AskChunk[] = [];
        let usedSemantic = false;
        if (embeddingProfile) {
          const embeddingKey = await getEmbeddingApiKey();
          if (embeddingKey) {
            try {
              retrieved = await retrievePaperChunks({
                document,
                question: trimmed,
                profile: embeddingProfile,
                apiKey: embeddingKey,
                signal: abort.signal,
              });
              usedSemantic = true;
            } catch (error) {
              if (abort.signal.aborted) throw error;
            }
          }
        }
        const chunks = buildPaperChunks(document);
        const selectedIndex = selection
          ? chunks.findIndex((chunk) => chunk.blockId === selection.blockId)
          : -1;
        const adjacent =
          selectedIndex >= 0
            ? chunks.slice(Math.max(0, selectedIndex - 1), selectedIndex + 2)
            : [];
        const evidence = [...adjacent, ...retrieved].filter(
          (chunk, index, all) =>
            all.findIndex((item) => item.id === chunk.id) === index,
        );
        setSemanticUsed(usedSemantic);
        setActivity(webSearch ? "searching" : "connecting");
        const context = buildAskContext({
          paper,
          question: trimmed,
          selection,
          visibleChunk: visibleChunk(visibleBlockId),
          retrieved: evidence,
          recentMessages: messagesRef.current.filter(
            (message) =>
              message.id !== assistant.id &&
              (!isRetry || message.id !== user.id),
          ),
        });
        let lastCheckpoint = 0;
        const result = await requestChat(
          profile,
          apiKey,
          context,
          webSearch && profile.kind === "openrouter",
          abort.signal,
          (text) => {
            streamedText = text;
            if (sessionId.current !== currentSession) return;
            setActivity("answering");
            flushTimer ??= setTimeout(flushStream, STREAM_RENDER_INTERVAL_MS);
            const now = Date.now();
            if (now - lastCheckpoint >= 1000) {
              lastCheckpoint = now;
              checkpoint = checkpoint
                .then(() => updateAskMessage(assistant.id, text, "streaming"))
                .catch(() => undefined);
            }
          },
        );
        cancelFlush();
        if (sessionId.current !== currentSession) {
          await updateAskMessage(assistant.id, "", "interrupted");
          return;
        }
        await checkpoint;
        await updateAskMessage(assistant.id, result.text, "complete");
        const newSources: AskSource[] = [];
        const addSource = async (source: Omit<AskSource, "id">) => {
          const id = await insertAskSource(source);
          newSources.push({ ...source, id });
        };
        if (selection) {
          await addSource({
            messageId: assistant.id,
            kind: "selection",
            title: selection.sectionTitle ?? "Selected passage",
            quote: selection.text,
            blockId: selection.blockId,
          });
        }
        for (const chunk of evidence) {
          await addSource({
            messageId: assistant.id,
            kind: "paper",
            title: chunk.sectionTitle ?? paper.title,
            quote: chunk.text,
            blockId: chunk.blockId,
          });
        }
        for (const citation of result.annotations) {
          await addSource({
            messageId: assistant.id,
            kind: "web",
            title: citation.title,
            url: citation.url,
          });
        }
        setMessages((previous) =>
          previous.map((message) =>
            message.id === assistant.id
              ? { ...message, content: result.text, status: "complete" }
              : message,
          ),
        );
        setSources((previous) => [...previous, ...newSources]);
      } catch (error) {
        cancelFlush();
        if (!messagesInserted) throw error;
        await checkpoint;
        // Keep whatever already arrived: stopping a long answer, or a stream
        // that stalls near its end, should not discard the useful part.
        const partial = streamedText.trim() ? streamedText : "";
        const stopped = abort.signal.aborted || partial.length > 0;
        const content = stopped
          ? partial
          : error instanceof Error
            ? error.message
            : "Ask failed";
        const status = stopped ? "interrupted" : "error";
        await updateAskMessage(assistant.id, content, status);
        if (sessionId.current === currentSession) {
          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistant.id
                ? { ...message, content, status }
                : message,
            ),
          );
        }
      } finally {
        if (controller.current === abort) controller.current = null;
        busyRef.current = false;
        if (sessionId.current === currentSession) {
          setBusy(false);
          setActivity(null);
        }
      }
    },
    [
      chatProfile,
      document,
      embeddingProfile,
      getChatApiKey,
      getEmbeddingApiKey,
      paper,
      selection,
      visibleChunk,
    ],
  );

  const persistUi = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    await saveUi();
  }, [saveUi]);

  useEffect(() => {
    if (!paper) return;
    scheduleUiSave();
  }, [draft, paper, scheduleUiSave, selection]);

  const stop = useCallback(() => {
    controller.current?.abort();
  }, []);

  const clear = useCallback(async () => {
    if (!paper) return;
    controller.current?.abort();
    sessionId.current += 1;
    busyRef.current = false;
    liveOffset.current = 0;
    await clearPaperAskData(paper.arxivId);
    await ensureAskThread(paper);
    setMessages([]);
    setSources([]);
    setDraft("");
    setSelection(null);
    setRestoredOffset(0);
    setBusy(false);
    setActivity(null);
  }, [paper]);

  const retry = useCallback(
    async (
      assistantId: string,
      visibleBlockId?: string | null,
      webSearch = false,
    ) => {
      const index = messages.findIndex((message) => message.id === assistantId);
      const question = [...messages.slice(0, index)]
        .reverse()
        .find((message) => message.role === "user")?.content;
      if (question)
        await send(question, visibleBlockId, webSearch, assistantId);
    },
    [messages, send],
  );

  return useMemo(
    () => ({
      messages,
      sources,
      draft,
      setDraft,
      selection,
      setSelection,
      busy,
      activity,
      semanticUsed,
      chatOffset,
      setChatOffset,
      send,
      retry,
      stop,
      persistUi,
      clear,
    }),
    [
      activity,
      busy,
      chatOffset,
      clear,
      draft,
      messages,
      persistUi,
      retry,
      selection,
      semanticUsed,
      send,
      setChatOffset,
      sources,
      stop,
    ],
  );
}
