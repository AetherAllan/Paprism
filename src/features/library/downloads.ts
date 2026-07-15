import { Platform } from "react-native";
import {
  documentDirectory,
  deleteAsync,
  downloadAsync,
  EncodingType,
  getInfoAsync,
  getContentUriAsync,
  makeDirectoryAsync,
  readAsStringAsync,
  StorageAccessFramework,
  writeAsStringAsync,
} from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import { scheduleArxiv } from "@/lib/arxiv";
import type { Paper } from "@/types/paper";
import {
  getDownloadsDirUri,
  setDownloadsDirUri,
  type PdfDownloadEntry,
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
  const perm =
    await StorageAccessFramework.requestDirectoryPermissionsAsync(initial);
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

/**
 * Download PDF via arXiv rate limiter.
 * Always keeps a copy under app Documents/Downloads/.
 * On Android, also tries SAF → user Download folder (once-granted).
 */
export async function downloadPaperPdf(
  paper: Paper,
): Promise<PdfDownloadEntry> {
  await ensureAppDownloadsDir();
  const localUri = localPdfPath(paper.arxivId);

  const existing = await getInfoAsync(localUri);
  if (!existing.exists) {
    await scheduleArxiv(async () => {
      const res = await downloadAsync(paper.pdfUrl, localUri, {
        headers: {
          "User-Agent":
            "Paprism/1.0 (Android; educational; contact: local-dev)",
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

  return {
    ...paper,
    localUri,
    exportUri,
    exported,
    downloadedAt: Date.now(),
  };
}

export async function openPdf(entry: PdfDownloadEntry): Promise<void> {
  if (Platform.OS !== "android") {
    throw new Error(
      "Opening downloaded PDFs is currently supported on Android only",
    );
  }
  const uri = entry.exportUri ?? (await getContentUriAsync(entry.localUri));
  // Grant the chosen PDF app temporary read access to our app-private file.
  await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
    data: uri,
    type: "application/pdf",
    flags: 1,
  });
}

export async function deletePdfFiles(entry: PdfDownloadEntry): Promise<void> {
  await deleteAsync(entry.localUri, { idempotent: true });
  if (entry.exportUri) {
    // SAF providers may revoke delete permission later. The app-owned copy and
    // metadata must still be removed even if the public export remains.
    await deleteAsync(entry.exportUri, { idempotent: true }).catch(
      () => undefined,
    );
  }
}
