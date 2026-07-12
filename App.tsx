import { useCallback, useState } from "react";
import { Alert, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { I18nextProvider, useTranslation } from "react-i18next";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CategoryPicker } from "@/features/categories";
import { LoadingScreen, PaperFeed, usePaperFeed } from "@/features/feed";
import { LibraryScreen, useLibrary } from "@/features/library";
import { SettingsScreen } from "@/features/settings";
import { PaperViewer } from "@/features/viewer";
import i18n from "@/i18n";
import { useAppPrefs } from "@/shared/hooks/useAppPrefs";
import type { Paper } from "@/types/paper";

function AppInner() {
  const { t } = useTranslation();
  const {
    ready: prefsReady,
    prefs,
    setCategories,
    setTranslateLang,
    setUiLang,
    reset,
  } = useAppPrefs();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewerPaper, setViewerPaper] = useState<Paper | null>(null);

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
  } = useLibrary();
  const feed = usePaperFeed(prefs.categories);

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

  if (!prefsReady || !libraryReady) {
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
          onSelect={setCategories}
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
          onUiLangChange={setUiLang}
          onTranslateLangChange={setTranslateLang}
          onReset={reset}
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
