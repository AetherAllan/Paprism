import {
  deleteAsync,
  documentDirectory,
  EncodingType,
  getInfoAsync,
  makeDirectoryAsync,
  moveAsync,
  writeAsStringAsync,
} from "expo-file-system/legacy";
import { fetchPaperHtml } from "@/features/viewer/paperSource";
import { parseArxivHtml } from "@/features/viewer/arxivHtmlParser";
import type { PaperDocument } from "@/features/viewer/paperDocument";
import type { Paper } from "@/types/paper";
import type { OfflinePaperEntry } from "./library";

const FORMAT_VERSION = 2;
const MAX_PACKAGE_BYTES = 50 * 1024 * 1024;
const MAX_RESOURCE_BYTES = 15 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 20_000;
const USER_AGENT = "ArxivTok/1.0 (Android; educational; contact: local-dev)";

type Resource = { bytes: Uint8Array; contentType: string };

function requireDocumentDirectory(): string {
  if (!documentDirectory) throw new Error("Document directory unavailable");
  return documentDirectory;
}

function safeName(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, "_");
}

function extension(url: string, contentType: string): string {
  const fromPath = new URL(url).pathname.match(/(\.[a-z0-9]{1,8})$/i)?.[1];
  if (fromPath) return fromPath;
  if (contentType.includes("image/png")) return ".png";
  if (contentType.includes("image/jpeg")) return ".jpg";
  if (contentType.includes("image/svg")) return ".svg";
  if (contentType.includes("image/webp")) return ".webp";
  return ".bin";
}

async function fetchResource(
  url: string,
  outerSignal?: AbortSignal,
): Promise<Resource> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  outerSignal?.addEventListener("abort", abort, { once: true });
  if (outerSignal?.aborted) controller.abort();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_RESOURCE_BYTES)
      throw new Error("Offline image exceeds 15 MB");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_RESOURCE_BYTES)
      throw new Error("Offline image exceeds 15 MB");
    return {
      bytes,
      contentType:
        response.headers.get("content-type") ?? "application/octet-stream",
    };
  } catch (error) {
    // Cancellation is silent, but an internal download deadline must reach the
    // user as an actionable error instead of looking like they tapped cancel.
    if (timedOut && !outerSignal?.aborted) {
      throw new Error("Offline image request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    outerSignal?.removeEventListener("abort", abort);
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

async function writeBytes(uri: string, bytes: Uint8Array): Promise<void> {
  await writeAsStringAsync(uri, bytesToBase64(bytes), {
    encoding: EncodingType.Base64,
  });
}

function localizeAssets(
  document: PaperDocument,
  paths: Map<string, string>,
  packageDir: string,
): PaperDocument {
  return {
    ...document,
    blocks: document.blocks.map((block) => ({
      ...block,
      assets: block.assets?.map((asset) => ({
        ...asset,
        uri: paths.has(asset.uri)
          ? `${packageDir}${paths.get(asset.uri)}`
          : asset.uri,
      })),
    })),
  };
}

/**
 * Save the parsed document model and only the images it references. CSS,
 * scripts and fonts belonged to the old WebView package and are intentionally
 * excluded; the native reader owns layout and never executes remote content.
 */
export async function downloadOfflinePaper(
  paper: Paper,
  signal?: AbortSignal,
): Promise<OfflinePaperEntry> {
  // Keep the legacy directory name so upgrades replace, rather than orphan,
  // packages downloaded by the former HTML reader.
  const root = `${requireDocumentDirectory()}OfflineHtml/`;
  const name = safeName(paper.arxivId);
  const finalDir = `${root}${name}/`;
  const backupDir = `${root}.${name}.backup/`;
  const tempDir = `${root}.${name}-${Date.now()}.tmp/`;
  const assetsDir = `${tempDir}assets/`;
  const [existingPackage, interruptedBackup] = await Promise.all([
    getInfoAsync(finalDir),
    getInfoAsync(backupDir),
  ]);
  if (interruptedBackup.exists) {
    if (existingPackage.exists) {
      await deleteAsync(backupDir, { idempotent: true });
    } else {
      // Recover the last complete package if the process stopped between the
      // two replacement renames during a previous refresh.
      await moveAsync({ from: backupDir, to: finalDir });
    }
  }
  await makeDirectoryAsync(assetsDir, { intermediates: true });

  try {
    const source = await fetchPaperHtml(paper, signal);
    const document = parseArxivHtml(
      source.html,
      paper.arxivId,
      source.sourceUrl,
    );
    let totalBytes = 0;
    const urls = [
      ...new Set(
        document.blocks.flatMap(
          (block) => block.assets?.map((asset) => asset.uri) ?? [],
        ),
      ),
    ];
    const paths = new Map<string, string>();

    // Keep requests sequential. One offline action must not turn into an
    // aggressive image crawl, and cancellation stays deterministic.
    for (const [index, url] of urls.entries()) {
      const resource = await fetchResource(url, signal);
      totalBytes += resource.bytes.byteLength;
      if (totalBytes > MAX_PACKAGE_BYTES) {
        throw new Error("Offline package exceeds 50 MB");
      }
      const relativePath = `assets/${index}${extension(url, resource.contentType)}`;
      paths.set(url, relativePath);
      await writeBytes(`${tempDir}${relativePath}`, resource.bytes);
    }

    const localDocument = localizeAssets(document, paths, finalDir);
    const serializedDocument = JSON.stringify(localDocument);
    totalBytes += new TextEncoder().encode(serializedDocument).byteLength;
    if (totalBytes > MAX_PACKAGE_BYTES) {
      throw new Error("Offline package exceeds 50 MB");
    }
    await writeAsStringAsync(`${tempDir}document.json`, serializedDocument);
    const existing = await getInfoAsync(finalDir);
    if (existing.exists) {
      // Keep the last complete package until the replacement rename succeeds.
      // A failed refresh must not destroy a user's working offline copy.
      await deleteAsync(backupDir, { idempotent: true });
      await moveAsync({ from: finalDir, to: backupDir });
      try {
        await moveAsync({ from: tempDir, to: finalDir });
      } catch (error) {
        await moveAsync({ from: backupDir, to: finalDir });
        throw error;
      }
      await deleteAsync(backupDir, { idempotent: true }).catch(() => undefined);
    } else {
      await moveAsync({ from: tempDir, to: finalDir });
    }

    return {
      ...paper,
      entryUri: `${finalDir}document.json`,
      packageDir: finalDir,
      sourceHash: document.sourceHash,
      byteSize: totalBytes,
      formatVersion: FORMAT_VERSION,
      downloadedAt: Date.now(),
    };
  } catch (error) {
    await deleteAsync(tempDir, { idempotent: true }).catch(() => undefined);
    throw error;
  }
}

export async function deleteOfflinePaperPackage(
  entry: OfflinePaperEntry,
): Promise<void> {
  await deleteAsync(entry.packageDir, { idempotent: true });
}
