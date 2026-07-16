import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { enqueueStorageWrite } from "@/lib/storageQueue";
import {
  normalizeBaseUrl,
  OPENROUTER_BASE_URL,
  sortModelsFreeFirst,
  type ModelOption,
} from "@/features/settings/providerCore";
import type { EmbeddingProfile } from "./askTypes";

const PROFILE_KEY = "paprism.embeddingProfile";
const SECRET_KEY = "paprism.embeddingProvider.apiKey";

export function validateEmbeddingProfile(
  profile: EmbeddingProfile,
): string | null {
  if (!profile.name.trim()) return "Profile name is required";
  if (!profile.model.trim()) return "Model is required";
  const baseUrl = normalizeBaseUrl(profile.baseUrl);
  try {
    if (new URL(baseUrl).protocol !== "https:")
      return "Endpoint must use HTTPS";
  } catch {
    return "Endpoint must be a valid HTTPS URL";
  }
  if (profile.kind === "openrouter" && baseUrl !== OPENROUTER_BASE_URL) {
    return "OpenRouter endpoint cannot be changed";
  }
  return null;
}

function validStoredProfile(value: unknown): EmbeddingProfile | null {
  if (!value || typeof value !== "object") return null;
  const profile = value as EmbeddingProfile;
  return (profile.kind === "openrouter" ||
    profile.kind === "openai-compatible") &&
    typeof profile.id === "string" &&
    typeof profile.name === "string" &&
    typeof profile.baseUrl === "string" &&
    typeof profile.model === "string" &&
    validateEmbeddingProfile(profile) === null
    ? profile
    : null;
}

export async function loadEmbeddingProfile(): Promise<EmbeddingProfile | null> {
  try {
    return validStoredProfile(
      JSON.parse(
        (await AsyncStorage.getItem(PROFILE_KEY)) ?? "null",
      ) as unknown,
    );
  } catch {
    return null;
  }
}

export async function saveEmbeddingProfile(
  profile: EmbeddingProfile,
  apiKey?: string,
): Promise<void> {
  const error = validateEmbeddingProfile(profile);
  if (error) throw new Error(error);
  if (apiKey?.trim()) await SecureStore.setItemAsync(SECRET_KEY, apiKey.trim());
  if (!(await SecureStore.getItemAsync(SECRET_KEY))) {
    throw new Error("API key is required");
  }
  await enqueueStorageWrite(() =>
    AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile)),
  );
}

export function getEmbeddingApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(SECRET_KEY);
}

export async function clearEmbeddingProfile(): Promise<void> {
  await SecureStore.deleteItemAsync(SECRET_KEY);
  await enqueueStorageWrite(() => AsyncStorage.removeItem(PROFILE_KEY));
}

export async function fetchEmbeddingModels(
  profile: EmbeddingProfile,
  apiKey: string,
): Promise<ModelOption[]> {
  if (profile.kind !== "openrouter") return [];
  const response = await fetch(`${OPENROUTER_BASE_URL}/embeddings/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) throw new Error(`Embedding models HTTP ${response.status}`);
  const payload = (await response.json()) as { data?: unknown[] };
  return sortModelsFreeFirst(
    (payload.data ?? [])
      .filter(
        (row): row is Record<string, unknown> =>
          !!row && typeof row === "object",
      )
      .map((row) => {
        const id = typeof row.id === "string" ? row.id : "";
        const name = typeof row.name === "string" ? row.name : id;
        const pricing = row.pricing as Record<string, unknown> | undefined;
        return {
          id,
          name,
          provider: id.split("/")[0],
          free: Number(pricing?.prompt ?? 1) === 0,
        };
      })
      .filter((model) => model.id.length > 0),
  );
}
