import AsyncStorage from "@react-native-async-storage/async-storage";
import { enqueueStorageWrite } from "@/lib/storageQueue";

const PREFIX = "paprism.feedPosition.";

export function loadFeedPaperId(categoryKey: string): Promise<string | null> {
  return AsyncStorage.getItem(`${PREFIX}${categoryKey || "all"}`);
}

export function saveFeedPaperId(
  categoryKey: string,
  arxivId: string,
): Promise<void> {
  return enqueueStorageWrite(() =>
    AsyncStorage.setItem(`${PREFIX}${categoryKey || "all"}`, arxivId),
  );
}
