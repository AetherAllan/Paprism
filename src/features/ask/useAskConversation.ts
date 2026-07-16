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
  const [chatOffset, setChatOffset] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const sessionId = useRef(0);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    const id = ++sessionId.current;
    controller.current?.abort();
    setMessages([]);
    setSources([]);
    setSelection(null);
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
        setDraft(thread?.draft ?? "");
        setSelection(thread?.selection ?? null);
        setChatOffset(thread?.chatOffset ?? 0);
        setMessages(nextMessages);
        setSources(nextSources);
      })
      .catch(() => undefined);
    return () => {
      controller.current?.abort();
      controller.current = null;
    };
  }, [paper]);

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
        }
        setDraft("");
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
            if (sessionId.current !== currentSession) return;
            setActivity("answering");
            setMessages((previous) =>
              previous.map((message) =>
                message.id === assistant.id
                  ? { ...message, content: text, status: "streaming" }
                  : message,
              ),
            );
            const now = Date.now();
            if (now - lastCheckpoint >= 1000) {
              lastCheckpoint = now;
              checkpoint = checkpoint
                .then(() => updateAskMessage(assistant.id, text, "streaming"))
                .catch(() => undefined);
            }
          },
        );
        if (sessionId.current !== currentSession) {
          await updateAskMessage(assistant.id, "", "interrupted");
          return;
        }
        await checkpoint;
        await updateAskMessage(assistant.id, result.text, "complete");
        const newSources: AskSource[] = [];
        if (selection) {
          const source = {
            messageId: assistant.id,
            kind: "selection" as const,
            title: selection.sectionTitle ?? "Selected passage",
            quote: selection.text,
            blockId: selection.blockId,
          };
          await insertAskSource(source);
          newSources.push({ ...source, id: Date.now() - 1 });
        }
        for (const chunk of evidence) {
          const source = {
            messageId: assistant.id,
            kind: "paper" as const,
            title: chunk.sectionTitle ?? paper.title,
            quote: chunk.text,
            blockId: chunk.blockId,
          };
          await insertAskSource(source);
          newSources.push({ ...source, id: Date.now() + newSources.length });
        }
        for (const citation of result.annotations) {
          const source = {
            messageId: assistant.id,
            kind: "web" as const,
            title: citation.title,
            url: citation.url,
          };
          await insertAskSource(source);
          newSources.push({ ...source, id: Date.now() + newSources.length });
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
        if (!messagesInserted) throw error;
        await checkpoint;
        const interrupted = abort.signal.aborted;
        await updateAskMessage(
          assistant.id,
          interrupted
            ? ""
            : error instanceof Error
              ? error.message
              : "Ask failed",
          interrupted ? "interrupted" : "error",
        );
        if (sessionId.current === currentSession) {
          setMessages((previous) =>
            previous.map((message) =>
              message.id === assistant.id
                ? {
                    ...message,
                    content: interrupted
                      ? ""
                      : error instanceof Error
                        ? error.message
                        : "Ask failed",
                    status: interrupted ? "interrupted" : "error",
                  }
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

  const persistUi = useCallback(
    async (nextDraft = draft, nextOffset = chatOffset) => {
      if (!paper) return;
      await saveAskThreadUi(paper.arxivId, nextDraft, nextOffset, selection);
    },
    [chatOffset, draft, paper, selection],
  );

  useEffect(() => {
    if (!paper) return;
    // Drafts and the active quote should survive process death, but writing on
    // every keystroke would turn SQLite into a token-by-token event log.
    const timeout = setTimeout(() => {
      void saveAskThreadUi(paper.arxivId, draft, chatOffset, selection).catch(
        () => undefined,
      );
    }, 500);
    return () => clearTimeout(timeout);
  }, [chatOffset, draft, paper, selection]);

  const clear = useCallback(async () => {
    if (!paper) return;
    controller.current?.abort();
    sessionId.current += 1;
    busyRef.current = false;
    await clearPaperAskData(paper.arxivId);
    await ensureAskThread(paper);
    setMessages([]);
    setSources([]);
    setDraft("");
    setSelection(null);
    setBusy(false);
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
      sources,
    ],
  );
}
