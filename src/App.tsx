import { useCallback, useState } from "react";
import { Alert, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CategoryPicker } from "@/features/categories/CategoryPicker";
import { LoadingScreen } from "@/features/feed/LoadingScreen";
import { PaperFeed } from "@/features/feed/PaperFeed";
import { usePaperFeed } from "@/features/feed/usePaperFeed";
import { LibraryScreen } from "@/features/library/LibraryScreen";
import { useLibrary } from "@/features/library/useLibrary";
import { SettingsScreen } from "@/features/settings/SettingsScreen";
import { PaperViewer } from "@/features/viewer/PaperViewer";
import { useAppPrefs } from "@/shared/useAppPrefs";
import type { Paper } from "@/types/paper";

export default function App() {
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
          paginationStatus={feed.paginationStatus}
          paginationError={feed.paginationError}
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#111113",
  },
});
