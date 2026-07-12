import AsyncStorage from "@react-native-async-storage/async-storage";
import type { UiLangPref } from "../i18n";
import {
  DEFAULT_CATEGORIES,
  normalizeCategories,
} from "./categories";

const KEYS = {
  categories: "arxivtok.lastCategories",
  /** Legacy single-category key — migrated on load. */
  category: "arxivtok.lastCategory",
  translateLang: "arxivtok.translateLang",
  uiLang: "arxivtok.uiLang",
} as const;

/** `"system"` = follow device locale; otherwise a Google Translate `tl` code. */
export type TranslateLangPref = "system" | string;

export type AppPrefs = {
  categories: string[];
  translateLang: TranslateLangPref;
  uiLang: UiLangPref;
};

export const DEFAULT_PREFS: AppPrefs = {
  categories: [...DEFAULT_CATEGORIES],
  translateLang: "system",
  uiLang: "system",
};

function parseUiLang(raw: string | null): UiLangPref {
  if (raw === "en" || raw === "zh" || raw === "system") return raw;
  return "system";
}

async function loadCategories(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(KEYS.categories);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
        return normalizeCategories(parsed);
      }
    } catch {
      // fall through
    }
  }

  const legacy = await AsyncStorage.getItem(KEYS.category);
  if (legacy) {
    const cats = normalizeCategories([legacy]);
    await AsyncStorage.setItem(KEYS.categories, JSON.stringify(cats));
    await AsyncStorage.removeItem(KEYS.category);
    return cats;
  }

  return [...DEFAULT_CATEGORIES];
}

export async function loadPrefs(): Promise<AppPrefs> {
  const [categories, translateLang, uiLang] = await Promise.all([
    loadCategories(),
    AsyncStorage.getItem(KEYS.translateLang),
    AsyncStorage.getItem(KEYS.uiLang),
  ]);

  return {
    categories,
    translateLang:
      translateLang && translateLang.length > 0 ? translateLang : "system",
    uiLang: parseUiLang(uiLang),
  };
}

export async function saveCategories(ids: string[]): Promise<void> {
  const cats = normalizeCategories(ids);
  await AsyncStorage.setItem(KEYS.categories, JSON.stringify(cats));
}

export async function saveTranslateLang(lang: TranslateLangPref): Promise<void> {
  await AsyncStorage.setItem(KEYS.translateLang, lang);
}

export async function saveUiLang(lang: UiLangPref): Promise<void> {
  await AsyncStorage.setItem(KEYS.uiLang, lang);
}

export async function resetPrefs(): Promise<AppPrefs> {
  await AsyncStorage.multiRemove([
    KEYS.categories,
    KEYS.category,
    KEYS.translateLang,
    KEYS.uiLang,
  ]);
  return {
    categories: [...DEFAULT_CATEGORIES],
    translateLang: "system",
    uiLang: "system",
  };
}

/** Map device locale → Google Translate `tl` code. */
export function deviceTranslateLang(): string {
  const locale =
    Intl.DateTimeFormat().resolvedOptions().locale?.replace(/_/g, "-") || "en";
  const lower = locale.toLowerCase();

  if (lower.startsWith("zh")) {
    return /hant|tw|hk|mo/.test(lower) ? "zh-TW" : "zh-CN";
  }
  if (lower.startsWith("pt")) {
    return /br/.test(lower) ? "pt" : "pt-PT";
  }
  return lower.split("-")[0] || "en";
}

export function resolveTranslateLang(pref: TranslateLangPref): string {
  return pref === "system" ? deviceTranslateLang() : pref;
}
