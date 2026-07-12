import { useCallback, useEffect, useMemo, useState } from "react";
import type { Paper } from "../types/paper";
import { downloadPaperPdf } from "../lib/downloads";
import {
  loadDownloads,
  loadHistory,
  loadSaved,
  persistDownloads,
  persistHistory,
  persistSaved,
  removeSaved,
  upsertDownload,
  upsertHistory,
  upsertSaved,
  type DownloadEntry,
  type HistoryEntry,
  type SavedEntry,
} from "../lib/library";

export function useLibrary() {
  const [saved, setSaved] = useState<SavedEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [downloads, setDownloads] = useState<DownloadEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [s, h, d] = await Promise.all([
        loadSaved(),
        loadHistory(),
        loadDownloads(),
      ]);
      if (cancelled) return;
      setSaved(s);
      setHistory(h);
      setDownloads(d);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const savedIds = useMemo(
    () => new Set(saved.map((p) => p.arxivId)),
    [saved],
  );
  const downloadedIds = useMemo(
    () => new Set(downloads.map((p) => p.arxivId)),
    [downloads],
  );

  const isSaved = useCallback(
    (arxivId: string) => savedIds.has(arxivId),
    [savedIds],
  );

  const isDownloaded = useCallback(
    (arxivId: string) => downloadedIds.has(arxivId),
    [downloadedIds],
  );

  const toggleSave = useCallback(async (paper: Paper) => {
    setSaved((prev) => {
      const exists = prev.some((p) => p.arxivId === paper.arxivId);
      const next = exists
        ? removeSaved(prev, paper.arxivId)
        : upsertSaved(prev, paper);
      void persistSaved(next);
      return next;
    });
  }, []);

  const unsave = useCallback(async (arxivId: string) => {
    setSaved((prev) => {
      const next = removeSaved(prev, arxivId);
      void persistSaved(next);
      return next;
    });
  }, []);

  const recordHistory = useCallback(async (paper: Paper) => {
    setHistory((prev) => {
      const next = upsertHistory(prev, paper);
      void persistHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(async () => {
    setHistory([]);
    await persistHistory([]);
  }, []);

  const download = useCallback(async (paper: Paper) => {
    setDownloadingId(paper.arxivId);
    try {
      const { entry } = await downloadPaperPdf(paper);
      setDownloads((prev) => {
        const next = upsertDownload(prev, entry);
        void persistDownloads(next);
        return next;
      });
      return entry;
    } finally {
      setDownloadingId(null);
    }
  }, []);

  return {
    ready,
    saved,
    history,
    downloads,
    downloadingId,
    isSaved,
    isDownloaded,
    toggleSave,
    unsave,
    recordHistory,
    clearHistory,
    download,
  };
}
