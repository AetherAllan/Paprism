import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProviderProfile } from "@/features/settings/providerCore";
import type { Paper } from "@/types/paper";
import {
  loadTranslationCache,
  saveTranslationCache,
  type TranslationCache,
} from "./translationCache";
import {
  blockCacheKey,
  translationCacheId,
  type TranslationBlock,
} from "./translationCore";
import {
  restoreProtectedTokens,
  translatableBlocks,
  type PaperBlock,
  type PaperDocument,
} from "./paperDocument";
import { isRetryableTranslationError, translateBlocks } from "./translator";

// ponytail: model the title as one synthetic block so it reuses the existing
// cache, progress, cancellation, and retry path instead of owning parallel state.
export const PAPER_TITLE_TRANSLATION_ID = "__paper_title__";
const RETRY_DELAYS_MS = [3000, 6000, 12_000, 30_000] as const;

type Progress = { completed: number; pending: number; failed: number };

type Options = {
  active: boolean;
  paper: Paper | null;
  document: PaperDocument | null;
  providerProfile: ProviderProfile | null;
  targetLang: string;
  getProviderApiKey: (profileId: string) => Promise<string | null>;
};

function translationBlock(
  paper: Paper,
  block: PaperBlock,
): TranslationBlock | null {
  if (!block.translationSource) return null;
  return {
    id: block.id,
    text: block.translationSource,
    context: {
      paperTitle: paper.title,
      sectionTitle: block.sectionTitle,
      previousText: block.contextBefore,
    },
  };
}

async function waitForRetry(ms: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timeout = setTimeout(finish, ms);
    if (signal.aborted) finish();
    else signal.addEventListener("abort", finish, { once: true });
  });
}

export function useDocumentTranslation({
  active,
  paper,
  document,
  providerProfile,
  targetLang,
  getProviderApiKey,
}: Options) {
  const controller = useRef<AbortController | null>(null);
  const pending = useRef(new Map<string, TranslationBlock>());
  const inFlight = useRef(new Set<string>());
  const failed = useRef(new Map<string, TranslationBlock>());
  const completed = useRef(new Set<string>());
  const cache = useRef<TranslationCache>({});
  const cacheReady = useRef<Promise<void>>(Promise.resolve());
  const processingSession = useRef<string | null>(null);
  const activeRef = useRef(active);
  const sessionRef = useRef("");
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<Progress>({
    completed: 0,
    pending: 0,
    failed: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const blocksById = useMemo(
    () => new Map(document?.blocks.map((block) => [block.id, block]) ?? []),
    [document],
  );
  const total = useMemo(
    () => (document ? translatableBlocks(document).length + 1 : 0),
    [document],
  );
  const cacheId = useMemo(
    () =>
      paper && document && providerProfile
        ? translationCacheId(
            paper,
            providerProfile,
            targetLang,
            document.sourceHash,
          )
        : null,
    [document, paper, providerProfile, targetLang],
  );
  const session = `${cacheId ?? "none"}:${document?.sourceHash ?? "none"}`;

  const refreshProgress = useCallback(() => {
    // A request remains pending from the user's perspective until its result is
    // committed. Use a union because transient failures briefly requeue the
    // same IDs before the request's finally block releases them.
    const waiting = new Set([...pending.current.keys(), ...inFlight.current]);
    setProgress({
      completed: completed.current.size,
      pending: waiting.size,
      failed: failed.current.size,
    });
  }, []);

  useEffect(() => {
    sessionRef.current = session;
    controller.current?.abort();
    pending.current.clear();
    inFlight.current.clear();
    failed.current.clear();
    completed.current.clear();
    cache.current = {};
    processingSession.current = null;
    setTranslations({});
    setError(null);
    refreshProgress();
    cacheReady.current = cacheId
      ? loadTranslationCache(cacheId).then((loaded) => {
          if (sessionRef.current === session) cache.current = loaded;
        })
      : Promise.resolve();
    return () => controller.current?.abort();
  }, [cacheId, refreshProgress, session]);

  useEffect(() => {
    activeRef.current = active;
    if (!active) {
      controller.current?.abort();
      pending.current.clear();
      refreshProgress();
    }
  }, [active, refreshProgress]);

  const drainQueue = useCallback(
    async function runQueue() {
      if (
        processingSession.current === sessionRef.current ||
        !activeRef.current ||
        !paper ||
        !providerProfile ||
        !cacheId
      ) {
        return;
      }
      const expectedSession = sessionRef.current;
      processingSession.current = expectedSession;
      let retryCount = 0;
      try {
        const apiKey =
          providerProfile.kind === "google"
            ? null
            : await getProviderApiKey(providerProfile.id);
        if (providerProfile.kind !== "google" && !apiKey) {
          throw new Error("The selected provider has no API key");
        }
        while (pending.current.size > 0 && activeRef.current) {
          const title = pending.current.get(PAPER_TITLE_TRANSLATION_ID);
          // The title is a tiny, immediately visible request. Finish it first so
          // the reader shows useful progress before larger paragraph batches.
          const batch = title
            ? [title]
            : [...pending.current.values()].slice(0, 6);
          for (const block of batch) {
            pending.current.delete(block.id);
            inFlight.current.add(block.id);
          }
          refreshProgress();
          const currentController = new AbortController();
          controller.current = currentController;
          try {
            const results = await translateBlocks(
              providerProfile,
              apiKey,
              targetLang,
              batch,
              currentController.signal,
            );
            if (
              sessionRef.current !== expectedSession ||
              currentController.signal.aborted
            ) {
              return;
            }
            const restored: Record<string, string> = {};
            const requests = new Map(batch.map((block) => [block.id, block]));
            for (const result of results) {
              const sourceBlock = blocksById.get(result.id);
              const requestBlock = requests.get(result.id);
              if (!requestBlock) {
                throw new Error(
                  "Translation result does not match the active document",
                );
              }
              if (result.id === PAPER_TITLE_TRANSLATION_ID) {
                restored[result.id] = result.text.trim();
              } else {
                if (!sourceBlock) {
                  throw new Error(
                    "Translation result does not match the active document",
                  );
                }
                restored[result.id] = restoreProtectedTokens(
                  result.text,
                  sourceBlock.protectedTokens,
                );
              }
            }
            // Do not expose or cache a partial batch. A later damaged marker must
            // not leave earlier paragraphs looking successfully translated.
            for (const [id, markdown] of Object.entries(restored)) {
              const requestBlock = requests.get(id)!;
              completed.current.add(id);
              failed.current.delete(id);
              cache.current[blockCacheKey(requestBlock)] = markdown;
            }
            setTranslations((current) => ({ ...current, ...restored }));
            void saveTranslationCache(cacheId, cache.current).catch(
              () => undefined,
            );
            setError(null);
            retryCount = 0;
          } catch (translationError) {
            if (currentController.signal.aborted) return;
            if (isRetryableTranslationError(translationError)) {
              // Keep the visible batch first. As long as translation mode stays
              // active, transient provider failures retry with a capped backoff.
              pending.current = new Map([
                ...batch.map((block) => [block.id, block] as const),
                ...pending.current,
              ]);
              refreshProgress();
              const delay =
                RETRY_DELAYS_MS[
                  Math.min(retryCount, RETRY_DELAYS_MS.length - 1)
                ];
              retryCount += 1;
              await waitForRetry(delay, currentController.signal);
              if (currentController.signal.aborted || !activeRef.current)
                return;
              continue;
            }
            for (const block of batch) failed.current.set(block.id, block);
            for (const block of pending.current.values()) {
              failed.current.set(block.id, block);
            }
            pending.current.clear();
            setError(
              translationError instanceof Error
                ? translationError.message
                : "Unknown translation error",
            );
            refreshProgress();
            break;
          } finally {
            // A replaced session may already be translating blocks with the same
            // arXiv-generated IDs. The old request must not release their state.
            if (sessionRef.current === expectedSession) {
              for (const block of batch) inFlight.current.delete(block.id);
            }
          }
          refreshProgress();
        }
      } catch (translationError) {
        if (sessionRef.current !== expectedSession || !activeRef.current)
          return;
        // Credential access happens before a request controller exists. Treat a
        // failure here as retryable by the user, but do not leave pending work in
        // place or finally would immediately start the same failing loop again.
        for (const block of pending.current.values()) {
          failed.current.set(block.id, block);
        }
        pending.current.clear();
        setError(
          translationError instanceof Error
            ? translationError.message
            : "Unknown translation error",
        );
      } finally {
        // Session replacement deliberately permits the new queue to start before
        // the aborted promise settles. Only the current owner may clear shared
        // controller/processing state or schedule more work.
        if (processingSession.current === expectedSession) {
          processingSession.current = null;
          controller.current = null;
          refreshProgress();
          if (
            activeRef.current &&
            pending.current.size > 0 &&
            sessionRef.current === expectedSession
          ) {
            void runQueue();
          }
        }
      }
    },
    [
      blocksById,
      cacheId,
      getProviderApiKey,
      paper,
      providerProfile,
      refreshProgress,
      targetLang,
    ],
  );

  const enqueue = useCallback(
    async (ids: string[]) => {
      if (!activeRef.current || !paper) return;
      const expectedSession = sessionRef.current;
      await cacheReady.current;
      if (sessionRef.current !== expectedSession || !activeRef.current) return;
      const cached: Record<string, string> = {};
      for (const id of ids) {
        const sourceBlock = blocksById.get(id);
        const block =
          id === PAPER_TITLE_TRANSLATION_ID
            ? {
                id,
                text: paper.title,
                context: { paperTitle: paper.title },
              }
            : sourceBlock
              ? translationBlock(paper, sourceBlock)
              : null;
        if (
          !block ||
          completed.current.has(id) ||
          inFlight.current.has(id) ||
          failed.current.has(id) ||
          pending.current.has(id)
        ) {
          continue;
        }
        const cachedMarkdown = cache.current[blockCacheKey(block)];
        if (cachedMarkdown) {
          completed.current.add(id);
          cached[id] = cachedMarkdown;
        } else {
          pending.current.set(id, block);
        }
      }
      if (Object.keys(cached).length > 0) {
        setTranslations((current) => ({ ...current, ...cached }));
      }
      refreshProgress();
      void drainQueue();
    },
    [blocksById, drainQueue, paper, refreshProgress],
  );

  const retryFailed = useCallback(() => {
    for (const block of failed.current.values())
      pending.current.set(block.id, block);
    failed.current.clear();
    setError(null);
    refreshProgress();
    void drainQueue();
  }, [drainQueue, refreshProgress]);

  const cancel = useCallback(() => {
    controller.current?.abort();
    pending.current.clear();
    refreshProgress();
  }, [refreshProgress]);

  return {
    translations,
    progress,
    total,
    error,
    enqueue,
    retryFailed,
    cancel,
  };
}
