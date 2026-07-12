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
import { useProviderProfiles } from "@/features/settings/useProviderProfiles";
import { PaperViewer } from "@/features/viewer/PaperViewer";
import { useAppPrefs } from "@/shared/useAppPrefs";
import type { Paper } from "@/types/paper";
import type { OfflineHtmlEntry, PdfDownloadEntry } from "@/features/library/library";

type ViewerState = { paper: Paper; sourceUri?: string };

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
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const providerManager = useProviderProfiles();

  const {
    ready: libraryReady,
    saved,
    history,
    downloads,
    downloadingId,
    isSaved,
    hasOfflineHtml,
    hasPdf,
    getOfflineHtml,
    toggleSave,
    unsave,
    recordHistory,
    clearHistory,
    downloadHtml,
    downloadPdf,
    openPdf,
    deleteDownloads,
  } = useLibrary();
  const feed = usePaperFeed(prefs.categories);

  const openPaper = useCallback(
    (paper: Paper) => {
      void recordHistory(paper);
      setViewer({ paper });
    },
    [recordHistory],
  );

  const openOffline = useCallback(
    (entry: OfflineHtmlEntry) => {
      void recordHistory(entry);
      setViewer({ paper: entry, sourceUri: entry.entryUri });
    },
    [recordHistory],
  );

  const showError = useCallback(
    (error: unknown) => {
      Alert.alert(
        t("library.downloadFailed"),
        error instanceof Error ? error.message : t("common.unknownError"),
      );
    },
    [t],
  );

  const onDownload = useCallback(
    (paper: Paper) => {
      const offline = getOfflineHtml(paper.arxivId);
      if (offline) {
        openOffline(offline);
        return;
      }
      Alert.alert(t("library.downloadChoiceTitle"), paper.title, [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("library.downloadHtml"),
          onPress: () => void downloadHtml(paper).then(openOffline).catch(showError),
        },
        {
          text: t("library.downloadPdf"),
          onPress: () => void downloadPdf(paper).catch(showError),
        },
      ]);
    },
    [downloadHtml, downloadPdf, getOfflineHtml, openOffline, showError, t],
  );

  const onOpenPdf = useCallback(
    async (entry: PdfDownloadEntry) => {
      try {
        await openPdf(entry);
      } catch (error) {
        showError(error);
      }
    },
    [openPdf, showError],
  );

  if (!prefsReady || !libraryReady || !providerManager.ready) {
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
          hasOfflineHtml={hasOfflineHtml}
          hasPdf={hasPdf}
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
          onOpenOffline={(entry) => {
            setLibraryOpen(false);
            openOffline(entry);
          }}
          onOpenPdf={(entry) => void onOpenPdf(entry)}
          onDeleteDownloads={(arxivId) => void deleteDownloads(arxivId)}
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
          providerManager={providerManager}
        />
        <PaperViewer
          paper={viewer?.paper ?? null}
          sourceUri={viewer?.sourceUri}
          translateLangPref={prefs.translateLang}
          onClose={() => setViewer(null)}
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
