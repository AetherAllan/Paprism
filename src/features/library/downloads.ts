import { Platform } from "react-native";
import {
  documentDirectory,
  downloadAsync,
  EncodingType,
  getInfoAsync,
  makeDirectoryAsync,
  readAsStringAsync,
  StorageAccessFramework,
  writeAsStringAsync,
} from "expo-file-system/legacy";
import { scheduleArxiv } from "@/lib/arxiv";
import type { Paper } from "@/types/paper";
import {
  getDownloadsDirUri,
  setDownloadsDirUri,
  type DownloadEntry,
} from "./library";

function appDownloadsDir(): string {
  if (!documentDirectory) {
    throw new Error("Document directory unavailable");
  }
  return `${documentDirectory}Downloads/`;
}

function localPdfPath(arxivId: string): string {
  const safe = arxivId.replace(/[/\\?%*:|"<>]/g, "_");
  return `${appDownloadsDir()}${safe}.pdf`;
}

async function ensureAppDownloadsDir(): Promise<void> {
  const dir = appDownloadsDir();
  const info = await getInfoAsync(dir);
  if (!info.exists) {
    await makeDirectoryAsync(dir, { intermediates: true });
  }
}

async function ensureSafDir(): Promise<string | null> {
  if (Platform.OS !== "android") return null;

  const cached = await getDownloadsDirUri();
  if (cached) return cached;

  // Hint toward Download/ in the picker when possible
  const initial = StorageAccessFramework.getUriForDirectoryInRoot("Download");
  const perm = await StorageAccessFramework.requestDirectoryPermissionsAsync(
    initial,
  );
  if (!perm.granted || !perm.directoryUri) return null;
  await setDownloadsDirUri(perm.directoryUri);
  return perm.directoryUri;
}

async function copyToSaf(
  localUri: string,
  dirUri: string,
  arxivId: string,
): Promise<string> {
  const baseName = arxivId.replace(/[/\\?%*:|"<>]/g, "_");
  const dest = await StorageAccessFramework.createFileAsync(
    dirUri,
    baseName,
    "application/pdf",
  );
  const b64 = await readAsStringAsync(localUri, {
    encoding: EncodingType.Base64,
  });
  await writeAsStringAsync(dest, b64, { encoding: EncodingType.Base64 });
  return dest;
}

export type DownloadResult = {
  entry: DownloadEntry;
  /** true if written into user-picked public folder (SAF) */
  exported: boolean;
};

/**
 * Download PDF via arXiv rate limiter.
 * Always keeps a copy under app Documents/Downloads/.
 * On Android, also tries SAF → user Download folder (once-granted).
 */
export async function downloadPaperPdf(paper: Paper): Promise<DownloadResult> {
  await ensureAppDownloadsDir();
  const localUri = localPdfPath(paper.arxivId);

  const existing = await getInfoAsync(localUri);
  if (!existing.exists) {
    await scheduleArxiv(async () => {
      const res = await downloadAsync(paper.pdfUrl, localUri, {
        headers: {
          "User-Agent": "ArxivTok/1.0 (Android; educational; contact: local-dev)",
        },
      });
      if (res.status !== 200) {
        throw new Error(`Download failed (${res.status})`);
      }
    });
  }

  let exportUri: string | undefined;
  let exported = false;

  if (Platform.OS === "android") {
    try {
      const dirUri = await ensureSafDir();
      if (dirUri) {
        exportUri = await copyToSaf(localUri, dirUri, paper.arxivId);
        exported = true;
      }
    } catch {
      // keep app-local copy; user can share later
    }
  }

  const entry: DownloadEntry = {
    ...paper,
    localUri,
    exportUri,
    downloadedAt: Date.now(),
  };

  return { entry, exported };
}
