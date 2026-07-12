import { useCallback, useEffect, useState } from "react";
import i18n, { resolveUiLang, type UiLangPref } from "@/i18n";
import {
  DEFAULT_PREFS,
  loadPrefs,
  resetPrefs,
  saveCategories,
  saveTranslateLang,
  saveUiLang,
  type AppPrefs,
  type TranslateLangPref,
} from "@/lib/storage";

export function useAppPrefs() {
  const [ready, setReady] = useState(false);
  const [prefs, setPrefs] = useState<AppPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    let cancelled = false;
    loadPrefs().then(async (loaded) => {
      if (cancelled) return;
      await i18n.changeLanguage(resolveUiLang(loaded.uiLang));
      if (cancelled) return;
      setPrefs(loaded);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setCategories = useCallback((ids: string[]) => {
    setPrefs((p) => ({ ...p, categories: ids }));
    void saveCategories(ids);
  }, []);

  const setTranslateLang = useCallback((lang: TranslateLangPref) => {
    setPrefs((p) => ({ ...p, translateLang: lang }));
    void saveTranslateLang(lang);
  }, []);

  const setUiLang = useCallback(async (lang: UiLangPref) => {
    setPrefs((p) => ({ ...p, uiLang: lang }));
    void saveUiLang(lang);
    await i18n.changeLanguage(resolveUiLang(lang));
  }, []);

  const reset = useCallback(async () => {
    const next = await resetPrefs();
    setPrefs(next);
    await i18n.changeLanguage(resolveUiLang(next.uiLang));
  }, []);

  return {
    ready,
    prefs,
    setCategories,
    setTranslateLang,
    setUiLang,
    reset,
  };
}
