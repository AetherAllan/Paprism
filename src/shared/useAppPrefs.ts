import { useCallback, useEffect, useState } from "react";
import i18n, { resolveUiLang, type UiLangPref } from "@/i18n";
import {
  DEFAULT_PREFS,
  loadPrefs,
  resetPrefs,
  saveCategories,
  saveAskEnabled,
  saveTranslateLang,
  saveUiLang,
  type AppPrefs,
  type TranslateLangPref,
} from "@/lib/storage";

export function useAppPrefs() {
  const [ready, setReady] = useState(false);
  const [prefs, setPrefs] = useState<AppPrefs>(DEFAULT_PREFS);
  const [recoveryWarning, setRecoveryWarning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let loaded: AppPrefs = {
        ...DEFAULT_PREFS,
        categories: [...DEFAULT_PREFS.categories],
      };
      let recovered = false;
      try {
        loaded = await loadPrefs();
      } catch {
        recovered = true;
      }
      try {
        await i18n.changeLanguage(resolveUiLang(loaded.uiLang));
      } catch {
        // Keep i18next's already initialized language. A locale backend error
        // must not strand the whole application on its loading screen.
        recovered = true;
      }
      if (cancelled) return;
      setPrefs(loaded);
      setRecoveryWarning(recovered);
      setReady(true);
    })();
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

  const setAskEnabled = useCallback((enabled: boolean) => {
    setPrefs((previous) => ({ ...previous, askEnabled: enabled }));
    void saveAskEnabled(enabled);
  }, []);

  const reset = useCallback(async () => {
    const next = await resetPrefs();
    setPrefs(next);
    await i18n.changeLanguage(resolveUiLang(next.uiLang));
  }, []);
  const clearRecoveryWarning = useCallback(() => setRecoveryWarning(false), []);

  return {
    ready,
    recoveryWarning,
    clearRecoveryWarning,
    prefs,
    setCategories,
    setTranslateLang,
    setUiLang,
    setAskEnabled,
    reset,
  };
}
