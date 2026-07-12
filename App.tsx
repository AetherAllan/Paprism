import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { I18nextProvider, useTranslation } from "react-i18next";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CategoryPicker } from "./src/components/CategoryPicker";
import { LibraryScreen } from "./src/components/LibraryScreen";
import { LoadingScreen } from "./src/components/LoadingScreen";
import { PaperFeed } from "./src/components/PaperFeed";
import { PaperViewer } from "./src/components/PaperViewer";
import { SettingsScreen } from "./src/components/SettingsScreen";
import { useLibrary } from "./src/hooks/useLibrary";
import { usePaperFeed } from "./src/hooks/usePaperFeed";
import i18n, { resolveUiLang, type UiLangPref } from "./src/i18n";
import {
  DEFAULT_PREFS,
  loadPrefs,
  resetPrefs,
  saveCategories,
  saveTranslateLang,
  saveUiLang,
  type AppPrefs,
  type TranslateLangPref,
} from "./src/lib/storage";
import type { Paper } from "./src/types/paper";

function AppInner() {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const [prefs, setPrefs] = useState<AppPrefs>(DEFAULT_PREFS);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewerPaper, setViewerPaper] = useState<Paper | null>(null);

  const library = useLibrary();
  const {
    ready: libraryReady,
    saved,
    history,
    downloads,
    downloadingId,
    isSaved,
    isDownloaded,
    toggleSave,
    unsave,
    recordHistory,
    clearHistory,
    download,
  } = library;
  const feed = usePaperFeed(prefs.categories);

  useEffect(() => {
    let cancelled = false;
    loadPrefs().then(async (loaded) => {
      if (cancelled) return;
      const lng = resolveUiLang(loaded.uiLang);
      await i18n.changeLanguage(lng);
      if (cancelled) return;
      setPrefs(loaded);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const openPaper = useCallback(
    (paper: Paper) => {
      void recordHistory(paper);
      setViewerPaper(paper);
    },
    [recordHistory],
  );

  const onDownload = useCallback(
    async (paper: Paper) => {
      try {
        await download(paper);
      } catch (e) {
        Alert.alert(
          t("library.downloadFailed"),
          e instanceof Error ? e.message : t("common.unknownError"),
        );
      }
    },
    [download, t],
  );

  const onSelectCategories = useCallback((ids: string[]) => {
    setPrefs((p) => ({ ...p, categories: ids }));
    void saveCategories(ids);
  }, []);

  const onTranslateLangChange = useCallback((lang: TranslateLangPref) => {
    setPrefs((p) => ({ ...p, translateLang: lang }));
    void saveTranslateLang(lang);
  }, []);

  const onUiLangChange = useCallback(async (lang: UiLangPref) => {
    setPrefs((p) => ({ ...p, uiLang: lang }));
    void saveUiLang(lang);
    await i18n.changeLanguage(resolveUiLang(lang));
  }, []);

  const onReset = useCallback(async () => {
    const next = await resetPrefs();
    setPrefs(next);
    await i18n.changeLanguage(resolveUiLang(next.uiLang));
  }, []);

  if (!ready || !libraryReady) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.root}>
          <StatusBar style="light" />
          <LoadingScreen />
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={styles.root}>
        <StatusBar style="light" />
        <PaperFeed
          papers={feed.papers}
          index={feed.index}
          onIndexChange={feed.onIndexChange}
          status={feed.status}
          error={feed.error}
          onRetry={feed.retry}
          categories={prefs.categories}
          onOpenCategories={() => setPickerOpen(true)}
          onOpenLibrary={() => setLibraryOpen(true)}
          onRead={openPaper}
          isSaved={isSaved}
          isDownloaded={isDownloaded}
          downloadingId={downloadingId}
          onToggleSave={toggleSave}
          onDownload={onDownload}
        />
        <CategoryPicker
          visible={pickerOpen}
          selected={prefs.categories}
          onSelect={onSelectCategories}
          onClose={() => setPickerOpen(false)}
        />
        <LibraryScreen
          visible={libraryOpen}
          saved={saved}
          history={history}
          downloads={downloads}
          onUnsave={unsave}
          onClearHistory={clearHistory}
          onOpenPaper={(paper) => {
            setLibraryOpen(false);
            openPaper(paper);
          }}
          onOpenSettings={() => setSettingsOpen(true)}
          onClose={() => setLibraryOpen(false)}
        />
        <SettingsScreen
          visible={settingsOpen}
          uiLang={prefs.uiLang}
          translateLang={prefs.translateLang}
          onUiLangChange={onUiLangChange}
          onTranslateLangChange={onTranslateLangChange}
          onReset={onReset}
          onClose={() => setSettingsOpen(false)}
        />
        <PaperViewer
          paper={viewerPaper}
          translateLangPref={prefs.translateLang}
          onClose={() => setViewerPaper(null)}
        />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <AppInner />
    </I18nextProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#111113",
  },
});
