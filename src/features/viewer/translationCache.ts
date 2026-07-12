import {
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from "expo-file-system/legacy";
import { enqueueStorageWrite } from "@/lib/storageQueue";

export type TranslationCache = Record<string, string>;

function cacheUri(cacheId: string): string | null {
  return documentDirectory
    ? `${documentDirectory}TranslationCache/${cacheId}.json`
    : null;
}

export async function loadTranslationCache(
  cacheId: string,
): Promise<TranslationCache> {
  const uri = cacheUri(cacheId);
  if (!uri || !(await getInfoAsync(uri)).exists) return {};
  try {
    const parsed = JSON.parse(await readAsStringAsync(uri)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

export async function saveTranslationCache(
  cacheId: string,
  cache: TranslationCache,
): Promise<void> {
  const uri = cacheUri(cacheId);
  if (!uri || !documentDirectory) return;
  await enqueueStorageWrite(async () => {
    await makeDirectoryAsync(`${documentDirectory}TranslationCache/`, {
      intermediates: true,
    });
    await writeAsStringAsync(uri, JSON.stringify(cache));
  });
}
