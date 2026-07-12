import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Paper } from "@/types/paper";
import { deletePdfFiles, downloadPaperPdf, openPdf } from "./downloads";
import { deleteOfflineHtmlPackage, downloadOfflineHtml } from "./offlineHtml";
import {
  loadHistory,
  loadOfflineHtml,
  loadPdfDownloads,
  loadSaved,
  persistHistory,
  persistOfflineHtml,
  persistPdfDownloads,
  persistSaved,
  removeSaved,
  summarizeDownloads,
  upsertByArxivId,
  upsertHistory,
  upsertSaved,
  type OfflineHtmlEntry,
  type PdfDownloadEntry,
  type HistoryEntry,
  type SavedEntry,
} from "./library";

export function useLibrary() {
  const [saved, setSaved] = useState<SavedEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [offlineHtml, setOfflineHtml] = useState<OfflineHtmlEntry[]>([]);
  const [pdfDownloads, setPdfDownloads] = useState<PdfDownloadEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingKind, setDownloadingKind] = useState<"html" | "pdf" | null>(null);
  const htmlDownloadController = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [savedRows, historyRows, htmlRows, pdfRows] = await Promise.all([
        loadSaved(),
        loadHistory(),
        loadOfflineHtml(),
        loadPdfDownloads(),
      ]);
      if (cancelled) return;
      setSaved(savedRows);
      setHistory(historyRows);
      setOfflineHtml(htmlRows);
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
  const htmlById = useMemo(
    () => new Map(offlineHtml.map((entry) => [entry.arxivId, entry])),
    [offlineHtml],
  );
  const pdfById = useMemo(
    () => new Map(pdfDownloads.map((entry) => [entry.arxivId, entry])),
    [pdfDownloads],
  );
  const downloads = useMemo(
    () => summarizeDownloads(offlineHtml, pdfDownloads),
    [offlineHtml, pdfDownloads],
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

  const downloadHtml = useCallback(async (paper: Paper) => {
    const controller = new AbortController();
    htmlDownloadController.current = controller;
    setDownloadingId(paper.arxivId);
    setDownloadingKind("html");
    try {
      const entry = await downloadOfflineHtml(paper, controller.signal);
      setOfflineHtml((previous) => {
        const next = upsertByArxivId(previous, entry);
        void persistOfflineHtml(next);
        return next;
      });
      return entry;
    } finally {
      htmlDownloadController.current = null;
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

  const deleteHtml = useCallback(async (arxivId: string) => {
    const entry = htmlById.get(arxivId);
    if (!entry) return;
    await deleteOfflineHtmlPackage(entry);
    setOfflineHtml((previous) => {
      const next = previous.filter((item) => item.arxivId !== arxivId);
      void persistOfflineHtml(next);
      return next;
    });
  }, [htmlById]);

  const deleteDownloads = useCallback(async (arxivId: string) => {
    const htmlEntry = htmlById.get(arxivId);
    const pdfEntry = pdfById.get(arxivId);
    if (htmlEntry) await deleteOfflineHtmlPackage(htmlEntry);
    if (pdfEntry) await deletePdfFiles(pdfEntry);
    setOfflineHtml((previous) => {
      const next = previous.filter((item) => item.arxivId !== arxivId);
      void persistOfflineHtml(next);
      return next;
    });
    setPdfDownloads((previous) => {
      const next = previous.filter((item) => item.arxivId !== arxivId);
      void persistPdfDownloads(next);
      return next;
    });
  }, [htmlById, pdfById]);

  return {
    ready,
    saved,
    history,
    downloads,
    offlineHtml,
    pdfDownloads,
    downloadingId,
    canCancelDownload: downloadingKind === "html",
    isSaved: (arxivId: string) => savedIds.has(arxivId),
    hasOfflineHtml: (arxivId: string) => htmlById.has(arxivId),
    hasPdf: (arxivId: string) => pdfById.has(arxivId),
    getOfflineHtml: (arxivId: string) => htmlById.get(arxivId),
    getPdf: (arxivId: string) => pdfById.get(arxivId),
    toggleSave,
    unsave,
    recordHistory,
    clearHistory,
    downloadHtml,
    downloadPdf,
    openPdf,
    deleteHtml,
    deleteDownloads,
    cancelDownload: () => htmlDownloadController.current?.abort(),
  };
}
