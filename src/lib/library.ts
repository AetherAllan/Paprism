import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Paper } from "../types/paper";

const KEYS = {
  saved: "arxivtok.saved",
  history: "arxivtok.history",
  downloads: "arxivtok.downloads",
  downloadsDirUri: "arxivtok.downloadsDirUri",
} as const;

export const HISTORY_CAP = 200;

export type SavedEntry = Paper & { savedAt: number };
export type HistoryEntry = Paper & { viewedAt: number };
export type DownloadEntry = Paper & {
  localUri: string;
  /** SAF uri if copied to public folder (content://) — do not pass to Sharing */
  exportUri?: string;
  downloadedAt: number;
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function loadSaved(): Promise<SavedEntry[]> {
  return readJson(KEYS.saved, []);
}

export async function loadHistory(): Promise<HistoryEntry[]> {
  return readJson(KEYS.history, []);
}

/** Fill Paper fields for older download rows that only stored title/authors. */
function coerceDownload(raw: Record<string, unknown>): DownloadEntry | null {
  const arxivId = typeof raw.arxivId === "string" ? raw.arxivId : null;
  if (!arxivId) return null;
  const title = typeof raw.title === "string" ? raw.title : arxivId;
  const authors = Array.isArray(raw.authors)
    ? raw.authors.filter((a): a is string => typeof a === "string")
    : [];
  return {
    id: typeof raw.id === "string" ? raw.id : `http://arxiv.org/abs/${arxivId}`,
    arxivId,
    title,
    abstract: typeof raw.abstract === "string" ? raw.abstract : "",
    authors,
    categories: Array.isArray(raw.categories)
      ? raw.categories.filter((c): c is string => typeof c === "string")
      : [],
    published: typeof raw.published === "string" ? raw.published : "",
    updated: typeof raw.updated === "string" ? raw.updated : "",
    absUrl:
      typeof raw.absUrl === "string"
        ? raw.absUrl
        : `https://arxiv.org/abs/${arxivId}`,
    pdfUrl:
      typeof raw.pdfUrl === "string"
        ? raw.pdfUrl
        : `https://arxiv.org/pdf/${arxivId}.pdf`,
    localUri: typeof raw.localUri === "string" ? raw.localUri : "",
    exportUri: typeof raw.exportUri === "string" ? raw.exportUri : undefined,
    downloadedAt:
      typeof raw.downloadedAt === "number" ? raw.downloadedAt : Date.now(),
  };
}

export async function loadDownloads(): Promise<DownloadEntry[]> {
  const raw = await readJson<unknown[]>(KEYS.downloads, []);
  return raw
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map(coerceDownload)
    .filter((x): x is DownloadEntry => x != null);
}

export async function persistSaved(list: SavedEntry[]): Promise<void> {
  await writeJson(KEYS.saved, list);
}

export async function persistHistory(list: HistoryEntry[]): Promise<void> {
  await writeJson(KEYS.history, list);
}

export async function persistDownloads(list: DownloadEntry[]): Promise<void> {
  await writeJson(KEYS.downloads, list);
}

export function upsertSaved(list: SavedEntry[], paper: Paper): SavedEntry[] {
  const without = list.filter((p) => p.arxivId !== paper.arxivId);
  return [{ ...paper, savedAt: Date.now() }, ...without];
}

export function removeSaved(list: SavedEntry[], arxivId: string): SavedEntry[] {
  return list.filter((p) => p.arxivId !== arxivId);
}

export function upsertHistory(list: HistoryEntry[], paper: Paper): HistoryEntry[] {
  const without = list.filter((p) => p.arxivId !== paper.arxivId);
  return [{ ...paper, viewedAt: Date.now() }, ...without].slice(0, HISTORY_CAP);
}

export function upsertDownload(
  list: DownloadEntry[],
  entry: DownloadEntry,
): DownloadEntry[] {
  const without = list.filter((p) => p.arxivId !== entry.arxivId);
  return [entry, ...without];
}

export async function getDownloadsDirUri(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.downloadsDirUri);
}

export async function setDownloadsDirUri(uri: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.downloadsDirUri, uri);
}
