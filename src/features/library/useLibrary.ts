import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Paper } from "@/types/paper";
import { deletePdfFiles, downloadPaperPdf, openPdf } from "./downloads";
import {
  deleteOfflinePaperPackage,
  downloadOfflinePaper,
} from "./offlinePaper";
import {
  loadHistory,
  loadOfflinePapers,
  loadPdfDownloads,
  loadSaved,
  persistHistory,
  persistOfflinePapers,
  persistPdfDownloads,
  persistSaved,
  removeSaved,
  summarizeDownloads,
  upsertByArxivId,
  upsertHistory,
  upsertSaved,
  type OfflinePaperEntry,
  type PdfDownloadEntry,
  type HistoryEntry,
  type SavedEntry,
} from "./library";

export function useLibrary() {
  const [saved, setSaved] = useState<SavedEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [offlinePapers, setOfflinePapers] = useState<OfflinePaperEntry[]>([]);
  const [pdfDownloads, setPdfDownloads] = useState<PdfDownloadEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingKind, setDownloadingKind] = useState<
    "reader" | "pdf" | null
  >(null);
  const offlineDownloadController = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [savedRows, historyRows, htmlRows, pdfRows] = await Promise.all([
        loadSaved(),
        loadHistory(),
        loadOfflinePapers(),
        loadPdfDownloads(),
      ]);
      if (cancelled) return;
      setSaved(savedRows);
      setHistory(historyRows);
      setOfflinePapers(htmlRows);
      setPdfDownloads(pdfRows);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const savedIds = useMemo(
    () => new Set(saved.map((paper) => paper.arxivId)),
    [saved],
  );
  const offlineById = useMemo(
    () => new Map(offlinePapers.map((entry) => [entry.arxivId, entry])),
    [offlinePapers],
  );
  const pdfById = useMemo(
    () => new Map(pdfDownloads.map((entry) => [entry.arxivId, entry])),
    [pdfDownloads],
  );
  const downloads = useMemo(
    () => summarizeDownloads(offlinePapers, pdfDownloads),
    [offlinePapers, pdfDownloads],
  );

  const toggleSave = useCallback(async (paper: Paper) => {
    setSaved((previous) => {
      const next = previous.some((item) => item.arxivId === paper.arxivId)
        ? removeSaved(previous, paper.arxivId)
        : upsertSaved(previous, paper);
      void persistSaved(next);
      return next;
    });
  }, []);

  const unsave = useCallback(async (arxivId: string) => {
    setSaved((previous) => {
      const next = removeSaved(previous, arxivId);
      void persistSaved(next);
      return next;
    });
  }, []);

  const recordHistory = useCallback(async (paper: Paper) => {
    setHistory((previous) => {
      const next = upsertHistory(previous, paper);
      void persistHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(async () => {
    setHistory([]);
    await persistHistory([]);
  }, []);

  const downloadOffline = useCallback(async (paper: Paper) => {
    const controller = new AbortController();
    offlineDownloadController.current = controller;
    setDownloadingId(paper.arxivId);
    setDownloadingKind("reader");
    try {
      const entry = await downloadOfflinePaper(paper, controller.signal);
      setOfflinePapers((previous) => {
        const next = upsertByArxivId(previous, entry);
        void persistOfflinePapers(next);
        return next;
      });
      return entry;
    } finally {
      offlineDownloadController.current = null;
      setDownloadingId(null);
      setDownloadingKind(null);
    }
  }, []);

  const downloadPdf = useCallback(async (paper: Paper) => {
    setDownloadingId(paper.arxivId);
    setDownloadingKind("pdf");
    try {
      const entry = await downloadPaperPdf(paper);
      setPdfDownloads((previous) => {
        const next = upsertByArxivId(previous, entry);
        void persistPdfDownloads(next);
        return next;
      });
      return entry;
    } finally {
      setDownloadingId(null);
      setDownloadingKind(null);
    }
  }, []);

  const deleteOffline = useCallback(
    async (arxivId: string) => {
      const entry = offlineById.get(arxivId);
      if (!entry) return;
      await deleteOfflinePaperPackage(entry);
      setOfflinePapers((previous) => {
        const next = previous.filter((item) => item.arxivId !== arxivId);
        void persistOfflinePapers(next);
        return next;
      });
    },
    [offlineById],
  );

  const deleteDownloads = useCallback(
    async (arxivId: string) => {
      const offlineEntry = offlineById.get(arxivId);
      const pdfEntry = pdfById.get(arxivId);
      if (offlineEntry) await deleteOfflinePaperPackage(offlineEntry);
      if (pdfEntry) await deletePdfFiles(pdfEntry);
      setOfflinePapers((previous) => {
        const next = previous.filter((item) => item.arxivId !== arxivId);
        void persistOfflinePapers(next);
        return next;
      });
      setPdfDownloads((previous) => {
        const next = previous.filter((item) => item.arxivId !== arxivId);
        void persistPdfDownloads(next);
        return next;
      });
    },
    [offlineById, pdfById],
  );

  return {
    ready,
    saved,
    history,
    downloads,
    offlinePapers,
    pdfDownloads,
    downloadingId,
    canCancelDownload: downloadingKind === "reader",
    isSaved: (arxivId: string) => savedIds.has(arxivId),
    hasOfflinePaper: (arxivId: string) => offlineById.has(arxivId),
    hasPdf: (arxivId: string) => pdfById.has(arxivId),
    getOfflinePaper: (arxivId: string) => offlineById.get(arxivId),
    getPdf: (arxivId: string) => pdfById.get(arxivId),
    toggleSave,
    unsave,
    recordHistory,
    clearHistory,
    downloadOffline,
    downloadPdf,
    openPdf,
    deleteOffline,
    deleteDownloads,
    cancelDownload: () => offlineDownloadController.current?.abort(),
  };
}
