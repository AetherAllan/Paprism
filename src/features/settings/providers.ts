import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from "expo-file-system/legacy";
import { enqueueStorageWrite } from "@/lib/storageQueue";
import {
  modelCatalogUrl,
  normalizeModels,
  type ModelOption,
  type ProviderProfile,
} from "./providerCore";

const PROFILES_KEY = "arxivtok.providerProfiles";
const ACTIVE_KEY = "arxivtok.activeProviderProfile";
const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;

export type ProviderState = {
  profiles: ProviderProfile[];
  activeProfileId: string | null;
};

function validProfiles(value: unknown): ProviderProfile[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is ProviderProfile =>
          !!item &&
          typeof item === "object" &&
          typeof item.id === "string" &&
          typeof item.name === "string" &&
          (item.kind === "openrouter" || item.kind === "openai-compatible") &&
          typeof item.baseUrl === "string" &&
          typeof item.model === "string",
      )
    : [];
}

export async function loadProviderState(): Promise<ProviderState> {
  const [rawProfiles, activeProfileId] = await Promise.all([
    AsyncStorage.getItem(PROFILES_KEY),
    AsyncStorage.getItem(ACTIVE_KEY),
  ]);
  let profiles: ProviderProfile[] = [];
  try {
    profiles = validProfiles(JSON.parse(rawProfiles ?? "[]") as unknown);
  } catch {
    // A corrupt profile list should disable translation, not block app startup.
  }
  return {
    profiles,
    activeProfileId: profiles.some((profile) => profile.id === activeProfileId)
      ? activeProfileId
      : profiles[0]?.id ?? null,
  };
}

export async function persistProviderState(state: ProviderState): Promise<void> {
  await enqueueStorageWrite(async () => {
    await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(state.profiles));
    if (state.activeProfileId) {
      await AsyncStorage.setItem(ACTIVE_KEY, state.activeProfileId);
    } else {
      await AsyncStorage.removeItem(ACTIVE_KEY);
    }
  });
}

function secretKey(profileId: string): string {
  return `arxivtok.provider.${profileId}.apiKey`;
}

export async function getProviderApiKey(profileId: string): Promise<string | null> {
  return SecureStore.getItemAsync(secretKey(profileId));
}

export async function setProviderApiKey(
  profileId: string,
  apiKey: string,
): Promise<void> {
  await SecureStore.setItemAsync(secretKey(profileId), apiKey.trim());
}

export async function deleteProviderApiKey(profileId: string): Promise<void> {
  await SecureStore.deleteItemAsync(secretKey(profileId));
}

export function createProfileId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type CatalogCache = {
  endpoint: string;
  fetchedAt: number;
  models: ModelOption[];
};

function catalogUri(profileId: string): string | null {
  return documentDirectory
    ? `${documentDirectory}ModelCatalogs/${profileId}.json`
    : null;
}

async function readCatalogCache(
  profile: ProviderProfile,
): Promise<ModelOption[] | null> {
  const uri = catalogUri(profile.id);
  if (!uri || !(await getInfoAsync(uri)).exists) return null;
  try {
    const cache = JSON.parse(await readAsStringAsync(uri)) as CatalogCache;
    return cache.endpoint === modelCatalogUrl(profile) &&
      Date.now() - cache.fetchedAt < CATALOG_TTL_MS
      ? cache.models
      : null;
  } catch {
    return null;
  }
}

async function writeCatalogCache(
  profile: ProviderProfile,
  models: ModelOption[],
): Promise<void> {
  const uri = catalogUri(profile.id);
  if (!uri || !documentDirectory) return;
  await makeDirectoryAsync(`${documentDirectory}ModelCatalogs/`, {
    intermediates: true,
  });
  await writeAsStringAsync(
    uri,
    JSON.stringify({
      endpoint: modelCatalogUrl(profile),
      fetchedAt: Date.now(),
      models,
    } satisfies CatalogCache),
  );
}

export async function fetchModelCatalog(
  profile: ProviderProfile,
  apiKey: string | null,
  force = false,
): Promise<ModelOption[]> {
  if (!force) {
    const cached = await readCatalogCache(profile);
    if (cached) return cached;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(modelCatalogUrl(profile), {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Model catalog HTTP ${response.status}`);
    const models = normalizeModels(await response.json(), profile.kind);
    if (models.length === 0) throw new Error("Provider returned no models");
    await writeCatalogCache(profile, models);
    return models;
  } finally {
    clearTimeout(timeout);
  }
}
