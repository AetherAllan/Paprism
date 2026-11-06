import AsyncStorage from "@react-native-async-storage/async-storage";
import { enqueueStorageWrite } from "@/lib/storageQueue";
import type { Paper } from "@/types/paper";

const KEYS = {
  saved: "paprism.saved",
  history: "paprism.history",
  pdfDownloads: "paprism.pdfDownloads",
  legacyDownloads: "paprism.downloads",
  // Keep the shipped key so upgrades retain existing version-1 HTML packages.
  offlinePapers: "paprism.offlineHtml",
  downloadsDirUri: "paprism.downloadsDirUri",
} as const;

export const HISTORY_CAP = 200;

export type SavedEntry = Paper & { savedAt: number };
export type HistoryEntry = Paper & { viewedAt: number };
export type PdfDownloadEntry = Paper & {
  localUri: string;
  /** SAF URI when copied to a user-picked public folder. */
  exportUri?: string;
  exported: boolean;
  downloadedAt: number;
};
export type OfflinePaperEntry = Paper & {
  entryUri: string;
  packageDir: string;
  sourceHash: string;
  byteSize: number;
  formatVersion: number;
  downloadedAt: number;
};
export type DownloadSummary = Paper & {
  offline?: OfflinePaperEntry;
  pdf?: PdfDownloadEntry;
};

export type LoadedLibraryState = {
  saved: SavedEntry[];
  history: HistoryEntry[];
  offlinePapers: OfflinePaperEntry[];
  pdfDownloads: PdfDownloadEntry[];
  recovered: boolean;
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await enqueueStorageWrite(() =>
    AsyncStorage.setItem(key, JSON.stringify(value)),
  );
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          item !== null && typeof item === "object",
      )
    : [];
}

/** Older rows are tolerated so app upgrades never discard a user's library. */
function coercePaper(raw: Record<string, unknown>): Paper | null {
  const arxivId = typeof raw.arxivId === "string" ? raw.arxivId : null;
  if (!arxivId) return null;
  return {
    arxivId,
    title: typeof raw.title === "string" ? raw.title : arxivId,
    abstract: typeof raw.abstract === "string" ? raw.abstract : "",
    authors: Array.isArray(raw.authors)
      ? raw.authors.filter((item): item is string => typeof item === "string")
      : [],
    categories: Array.isArray(raw.categories)
      ? raw.categories.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    published: typeof raw.published === "string" ? raw.published : "",
    updated: typeof raw.updated === "string" ? raw.updated : "",
    pdfUrl:
      typeof raw.pdfUrl === "string"
        ? raw.pdfUrl
        : `https://export.arxiv.org/pdf/${arxivId}`,
  };
}

/** A timestamp defaulting to 0 sorts damaged rows last instead of crashing. */
function coerceTimed<K extends "savedAt" | "viewedAt">(
  value: unknown,
  key: K,
): (Paper & Record<K, number>)[] {
  return records(value).flatMap((raw) => {
    const paper = coercePaper(raw);
    if (!paper) return [];
    const time = raw[key];
    return [
      { ...paper, [key]: typeof time === "number" ? time : 0 } as Paper &
        Record<K, number>,
    ];
  });
}

export async function loadSaved(): Promise<SavedEntry[]> {
  return coerceTimed(await readJson<unknown>(KEYS.saved, []), "savedAt");
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  return coerceTimed(await readJson<unknown>(KEYS.history, []), "viewedAt");
}

function coercePdf(raw: Record<string, unknown>): PdfDownloadEntry | null {
  const paper = coercePaper(raw);
  if (!paper || typeof raw.localUri !== "string") return null;
  const exportUri =
    typeof raw.exportUri === "string" ? raw.exportUri : undefined;
  return {
    ...paper,
    localUri: raw.localUri,
    exportUri,
    exported: typeof raw.exported === "boolean" ? raw.exported : !!exportUri,
    downloadedAt:
      typeof raw.downloadedAt === "number" ? raw.downloadedAt : Date.now(),
  };
}

export async function loadPdfDownloads(): Promise<PdfDownloadEntry[]> {
  const current = await AsyncStorage.getItem(KEYS.pdfDownloads);
  const legacy =
    current === null ? await AsyncStorage.getItem(KEYS.legacyDownloads) : null;
  const parsed = JSON.parse(current ?? legacy ?? "[]") as unknown;
  const entries = records(parsed)
    .map(coercePdf)
    .filter((item) => item !== null);
  if (current === null && legacy !== null) {
    await enqueueStorageWrite(async () => {
      await AsyncStorage.setItem(KEYS.pdfDownloads, JSON.stringify(entries));
      await AsyncStorage.removeItem(KEYS.legacyDownloads);
    });
  }
  return entries;
}

function coerceOfflinePaper(
  raw: Record<string, unknown>,
): OfflinePaperEntry | null {
  const paper = coercePaper(raw);
  if (
    !paper ||
    typeof raw.entryUri !== "string" ||
    typeof raw.packageDir !== "string" ||
    typeof raw.sourceHash !== "string"
  ) {
    return null;
  }
  return {
    ...paper,
    entryUri: raw.entryUri,
    packageDir: raw.packageDir,
    sourceHash: raw.sourceHash,
    byteSize: typeof raw.byteSize === "number" ? raw.byteSize : 0,
    formatVersion:
      typeof raw.formatVersion === "number" ? raw.formatVersion : 1,
    downloadedAt:
      typeof raw.downloadedAt === "number" ? raw.downloadedAt : Date.now(),
  };
}

export async function loadOfflinePapers(): Promise<OfflinePaperEntry[]> {
  return records(await readJson<unknown>(KEYS.offlinePapers, []))
    .map(coerceOfflinePaper)
    .filter((item) => item !== null);
}

export async function loadLibraryState(): Promise<LoadedLibraryState> {
  const results = await Promise.allSettled([
    loadSaved(),
    loadHistory(),
    loadOfflinePapers(),
    loadPdfDownloads(),
  ] as const);
  const [saved, history, offlinePapers, pdfDownloads] = results;
  return {
    saved: saved.status === "fulfilled" ? saved.value : [],
    history: history.status === "fulfilled" ? history.value : [],
    offlinePapers:
      offlinePapers.status === "fulfilled" ? offlinePapers.value : [],
    pdfDownloads: pdfDownloads.status === "fulfilled" ? pdfDownloads.value : [],
    recovered: results.some((result) => result.status === "rejected"),
  };
}

export async function persistSaved(list: SavedEntry[]): Promise<void> {
  await writeJson(KEYS.saved, list);
}

export async function persistHistory(list: HistoryEntry[]): Promise<void> {
  await writeJson(KEYS.history, list);
}

export async function persistPdfDownloads(
  list: PdfDownloadEntry[],
): Promise<void> {
  await writeJson(KEYS.pdfDownloads, list);
}

export async function persistOfflinePapers(
  list: OfflinePaperEntry[],
): Promise<void> {
  await writeJson(KEYS.offlinePapers, list);
}

export function upsertSaved(list: SavedEntry[], paper: Paper): SavedEntry[] {
  return [
    { ...paper, savedAt: Date.now() },
    ...list.filter((item) => item.arxivId !== paper.arxivId),
  ];
}

export function removeSaved(list: SavedEntry[], arxivId: string): SavedEntry[] {
  return list.filter((item) => item.arxivId !== arxivId);
}

export function upsertHistory(
  list: HistoryEntry[],
  paper: Paper,
): HistoryEntry[] {
  return [
    { ...paper, viewedAt: Date.now() },
    ...list.filter((item) => item.arxivId !== paper.arxivId),
  ].slice(0, HISTORY_CAP);
}

export function upsertByArxivId<T extends { arxivId: string }>(
  list: T[],
  entry: T,
): T[] {
  return [entry, ...list.filter((item) => item.arxivId !== entry.arxivId)];
}

export function summarizeDownloads(
  offline: OfflinePaperEntry[],
  pdf: PdfDownloadEntry[],
): DownloadSummary[] {
  const summaries = new Map<string, DownloadSummary>();
  for (const entry of [...offline, ...pdf]) {
    const current = summaries.get(entry.arxivId) ?? entry;
    summaries.set(entry.arxivId, {
      ...current,
      ...(entry as Paper),
      ...("entryUri" in entry ? { offline: entry } : {}),
      ...("localUri" in entry ? { pdf: entry } : {}),
    });
  }
  return [...summaries.values()].sort(
    (a, b) =>
      Math.max(b.offline?.downloadedAt ?? 0, b.pdf?.downloadedAt ?? 0) -
      Math.max(a.offline?.downloadedAt ?? 0, a.pdf?.downloadedAt ?? 0),
  );
}

export async function getDownloadsDirUri(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.downloadsDirUri);
}

export async function setDownloadsDirUri(uri: string): Promise<void> {
  await enqueueStorageWrite(() =>
    AsyncStorage.setItem(KEYS.downloadsDirUri, uri),
  );
}
