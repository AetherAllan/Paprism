export type ProviderKind = "openrouter" | "openai-compatible";

export type ProviderProfile = {
  id: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  model: string;
};

export type ModelOption = {
  id: string;
  name: string;
  provider?: string;
  free: boolean;
};

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function validateProfile(profile: ProviderProfile): string | null {
  if (!profile.name.trim()) return "Profile name is required";
  if (!profile.model.trim()) return "Model is required";
  const baseUrl = normalizeBaseUrl(profile.baseUrl);
  try {
    if (new URL(baseUrl).protocol !== "https:") return "Endpoint must use HTTPS";
  } catch {
    return "Endpoint must be a valid HTTPS URL";
  }
  if (profile.kind === "openrouter" && baseUrl !== OPENROUTER_BASE_URL) {
    return "OpenRouter endpoint cannot be changed";
  }
  return null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function normalizeModels(payload: unknown, kind: ProviderKind): ModelOption[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  const result: ModelOption[] = [];
  for (const raw of data) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const id = text(row.id);
    if (!id) continue;
    const pricing = row.pricing as Record<string, unknown> | undefined;
    const zeroPrice = ["prompt", "completion", "request"].every(
      (key) => pricing?.[key] === undefined || Number(pricing[key]) === 0,
    );
    result.push({
      id,
      name: text(row.name) ?? id,
      provider: id.includes("/") ? id.split("/")[0] : undefined,
      free: kind === "openrouter" && (id.endsWith(":free") || zeroPrice),
    });
  }
  return result.sort((a, b) => Number(b.free) - Number(a.free));
}

export function searchModels(models: ModelOption[], query: string): ModelOption[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return models;
  return models.filter((model) =>
    [model.id, model.name, model.provider]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(needle)),
  );
}

export function modelCatalogUrl(profile: ProviderProfile): string {
  const base = normalizeBaseUrl(profile.baseUrl);
  return profile.kind === "openrouter"
    ? `${base}/models?sort=most-popular`
    : `${base}/models`;
}

export function chatCompletionsUrl(profile: ProviderProfile): string {
  return `${normalizeBaseUrl(profile.baseUrl)}/chat/completions`;
}
