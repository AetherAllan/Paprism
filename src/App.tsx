import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CategoryPicker } from "@/features/categories/CategoryPicker";
import { LoadingScreen } from "@/features/feed/LoadingScreen";
import { PaperFeed } from "@/features/feed/PaperFeed";
import { usePaperFeed } from "@/features/feed/usePaperFeed";
import {
  LibraryScreen,
  type LibrarySection,
} from "@/features/library/LibraryScreen";
import { useLibrary } from "@/features/library/useLibrary";
import { AppMenu } from "@/features/menu/AppMenu";
import { SearchScreen } from "@/features/search/SearchScreen";
import {
  SettingsScreen,
  type SettingsSection,
} from "@/features/settings/SettingsScreen";
import { useProviderProfiles } from "@/features/settings/useProviderProfiles";
import { PaperViewer } from "@/features/viewer/PaperViewer";
import { useAppPrefs } from "@/shared/useAppPrefs";
import { colors } from "@/shared/theme";
import type { AppSection } from "@/types/navigation";
import type { Paper } from "@/types/paper";
import type { OfflineHtmlEntry, PdfDownloadEntry } from "@/features/library/library";

type ViewerState = {
  paper: Paper;
  sourceUri?: string;
};

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
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<AppSection | null>(null);
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const providerManager = useProviderProfiles();

  const {
    ready: libraryReady,
    saved,
    history,
    downloads,
    downloadingId,
    canCancelDownload,
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
    cancelDownload,
  } = useLibrary();
  const feed = usePaperFeed(prefs.categories);
  const visibleFeedPaper = feed.papers[feed.index];

  useEffect(() => {
    if (!libraryReady || !visibleFeedPaper) return;
    // Record the paper only when the visible card identity changes. Appending
    // a prefetched page must not make the current paper look newly viewed. We
    // also wait for persisted history to load so this write cannot be replaced
    // by useLibrary's initial hydration.
    void recordHistory(visibleFeedPaper);
  }, [libraryReady, visibleFeedPaper?.arxivId, recordHistory]);

  const openPaper = useCallback(
    (paper: Paper) => {
      void recordHistory(paper);
      // Keep the originating section mounted under the native viewer. This
      // preserves its list and scroll position without a second navigation
      // state that can drift out of sync.
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
      if (error instanceof Error && error.name === "AbortError") return;
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
          onPress: () =>
            void downloadHtml(paper)
              .then(openOffline)
              .catch(showError),
        },
        {
          text: t("library.downloadPdf"),
          onPress: () => void downloadPdf(paper).catch(showError),
        },
      ]);
    },
    [downloadHtml, downloadPdf, getOfflineHtml, openOffline, showError, t],
  );

  const openMenu = useCallback(() => {
    setActiveSection(null);
    setMenuOpen(true);
  }, []);

  const libraryVisible =
    activeSection === "saved" ||
    activeSection === "history" ||
    activeSection === "downloads";
  const librarySection: LibrarySection = libraryVisible
    ? activeSection
    : "saved";
  const settingsVisible =
    activeSection === "translation" ||
    activeSection === "language" ||
    activeSection === "about";
  const settingsSection: SettingsSection = settingsVisible
    ? activeSection
    : "about";

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
          onOpenMenu={() => setMenuOpen(true)}
          onRead={openPaper}
          isSaved={isSaved}
          hasOfflineHtml={hasOfflineHtml}
          hasPdf={hasPdf}
          downloadingId={downloadingId}
          canCancelDownload={canCancelDownload}
          onToggleSave={toggleSave}
          onDownload={onDownload}
          onCancelDownload={cancelDownload}
        />
        <CategoryPicker
          visible={pickerOpen}
          selected={prefs.categories}
          onSelect={setCategories}
          onClose={() => setPickerOpen(false)}
        />
        <LibraryScreen
          visible={libraryVisible}
          section={librarySection}
          saved={saved}
          history={history}
          downloads={downloads}
          onUnsave={unsave}
          onClearHistory={clearHistory}
          onOpenPaper={(paper) => {
            openPaper(paper);
          }}
          onOpenOffline={(entry) => {
            openOffline(entry);
          }}
          onOpenPdf={(entry) => void onOpenPdf(entry)}
          onDeleteDownloads={(arxivId) => void deleteDownloads(arxivId)}
          onBack={openMenu}
        />
        <SearchScreen
          visible={activeSection === "search"}
          categories={prefs.categories}
          isSaved={isSaved}
          hasOfflineHtml={hasOfflineHtml}
          hasPdf={hasPdf}
          onRead={openPaper}
          onToggleSave={toggleSave}
          onDownload={onDownload}
          onBack={openMenu}
        />
        <SettingsScreen
          visible={settingsVisible}
          section={settingsSection}
          uiLang={prefs.uiLang}
          translateLang={prefs.translateLang}
          onUiLangChange={setUiLang}
          onTranslateLangChange={setTranslateLang}
          onReset={reset}
          onBack={openMenu}
          providerManager={providerManager}
        />
        <AppMenu
          visible={menuOpen}
          interactive={
            menuOpen && activeSection === null && viewer === null && !pickerOpen
          }
          onSelect={(section) => {
            setActiveSection(section);
          }}
          onCloseComplete={() => setMenuOpen(false)}
        />
        <PaperViewer
          paper={viewer?.paper ?? null}
          sourceUri={viewer?.sourceUri}
          translateLangPref={prefs.translateLang}
          providerProfile={providerManager.activeProfile}
          getProviderApiKey={providerManager.getApiKey}
          onOpenSettings={() => {
            setViewer(null);
            setMenuOpen(true);
            setActiveSection("translation");
          }}
          onClose={() => {
            setViewer(null);
          }}
        />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
