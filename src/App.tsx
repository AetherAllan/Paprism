import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
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
import { DownloadBusyError } from "@/features/library/downloadTask";
import { PdfMetadataError, useLibrary } from "@/features/library/useLibrary";
import { AppMenu } from "@/features/menu/AppMenu";
import { SearchScreen } from "@/features/search/SearchScreen";
import {
  SettingsScreen,
  type SettingsSection,
} from "@/features/settings/SettingsScreen";
import { useProviderProfiles } from "@/features/settings/useProviderProfiles";
import { useAppUpdate } from "@/features/settings/useAppUpdate";
import { PaperViewer } from "@/features/viewer/PaperViewer";
import { useEmbeddingProfile } from "@/features/ask/useEmbeddingProfile";
import { useAppPrefs } from "@/shared/useAppPrefs";
import { colors } from "@/shared/theme";
import { AppDialogProvider, useAppDialog } from "@/shared/AppDialog";
import type { AppSection } from "@/types/navigation";
import type { Paper } from "@/types/paper";
import type {
  OfflinePaperEntry,
  PdfDownloadEntry,
} from "@/features/library/library";

type ViewerState = {
  paper: Paper;
  sourceUri?: string;
};

// A card counts as viewed once it has stayed on screen for a moment. Flicking
// through a stack of papers should not rewrite the whole history for each one.
const HISTORY_DWELL_MS = 700;

export default function App() {
  return (
    <AppDialogProvider>
      <AppContent />
    </AppDialogProvider>
  );
}

function AppContent() {
  const { t } = useTranslation();
  const { showDialog, showError: showDialogError } = useAppDialog();
  const appUpdate = useAppUpdate();
  const {
    ready: prefsReady,
    prefs,
    recoveryWarning: prefsRecoveryWarning,
    clearRecoveryWarning: clearPrefsRecoveryWarning,
    setCategories,
    setTranslateLang,
    setUiLang,
    setAskEnabled,
    reset,
  } = useAppPrefs();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<AppSection | null>(null);
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const providerManager = useProviderProfiles();
  const embeddingManager = useEmbeddingProfile();
  const {
    ready: providerReady,
    recoveryWarning: providerRecoveryWarning,
    clearRecoveryWarning: clearProviderRecoveryWarning,
  } = providerManager;

  const {
    ready: libraryReady,
    recoveryWarning: libraryRecoveryWarning,
    clearRecoveryWarning: clearLibraryRecoveryWarning,
    saved,
    history,
    downloads,
    downloadingId,
    canCancelDownload,
    isSaved,
    hasOfflinePaper,
    hasPdf,
    getOfflinePaper,
    getPdf,
    toggleSave,
    unsave,
    recordHistory,
    clearHistory,
    downloadOffline,
    downloadPdf,
    openPdf,
    deleteDownloads,
    cancelDownload,
  } = useLibrary();
  const feed = usePaperFeed(prefs.categories);
  const visibleFeedPaper = feed.papers[feed.index];
  const recoveryAlertShown = useRef(false);

  const showError = useCallback(
    (error: unknown) => {
      if (error instanceof Error && error.name === "AbortError") return;
      if (error instanceof PdfMetadataError) {
        showDialog({
          kind: "error",
          title: t("library.pdfMetadataFailedTitle"),
          message: t("library.pdfMetadataFailedBody"),
        });
        return;
      }
      if (error instanceof DownloadBusyError) {
        showDialog({ title: t("library.downloadBusy") });
        return;
      }
      showDialogError(t("common.operationFailed"), error);
    },
    [showDialog, showDialogError, t],
  );

  useEffect(() => {
    if (!libraryReady || !visibleFeedPaper) return;
    // Record the paper only when the visible card identity changes. Appending
    // a prefetched page must not make the current paper look newly viewed. We
    // also wait for persisted history to load so this write cannot be replaced
    // by useLibrary's initial hydration.
    const timeout = setTimeout(() => {
      void recordHistory(visibleFeedPaper).catch(showError);
    }, HISTORY_DWELL_MS);
    return () => clearTimeout(timeout);
  }, [libraryReady, visibleFeedPaper, recordHistory, showError]);

  const openPaper = useCallback(
    (paper: Paper) => {
      void recordHistory(paper).catch(showError);
      // Keep the originating section mounted under the native viewer. This
      // preserves its list and scroll position without a second navigation
      // state that can drift out of sync.
      setViewer({ paper });
    },
    [recordHistory, showError],
  );

  const openOffline = useCallback(
    (entry: OfflinePaperEntry) => {
      void recordHistory(entry).catch(showError);
      setViewer({ paper: entry, sourceUri: entry.entryUri });
    },
    [recordHistory, showError],
  );

  useEffect(() => {
    if (
      recoveryAlertShown.current ||
      !prefsReady ||
      !libraryReady ||
      !providerReady ||
      (!prefsRecoveryWarning &&
        !libraryRecoveryWarning &&
        !providerRecoveryWarning)
    ) {
      return;
    }
    recoveryAlertShown.current = true;
    showDialog({
      title: t("recovery.title"),
      message: t("recovery.body"),
      actions: [
        {
          text: t("common.done"),
          onPress: () => {
            clearPrefsRecoveryWarning();
            clearLibraryRecoveryWarning();
            clearProviderRecoveryWarning();
          },
        },
      ],
    });
  }, [
    clearLibraryRecoveryWarning,
    clearPrefsRecoveryWarning,
    clearProviderRecoveryWarning,
    libraryReady,
    libraryRecoveryWarning,
    prefsReady,
    prefsRecoveryWarning,
    providerReady,
    providerRecoveryWarning,
    showDialog,
    t,
  ]);

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

  const onDownload = useCallback(
    (paper: Paper) => {
      const offline = getOfflinePaper(paper.arxivId);
      if (offline) {
        openOffline(offline);
        return;
      }
      // A saved PDF is opened rather than fetched again. Downloading it twice
      // would write a duplicate into the user's public downloads folder.
      const pdf = getPdf(paper.arxivId);
      showDialog({
        title: t("library.downloadChoiceTitle"),
        message: paper.title,
        actions: [
          pdf
            ? {
                text: t("library.openPdf"),
                onPress: () => void onOpenPdf(pdf),
              }
            : {
                text: t("library.downloadPdf"),
                onPress: () => void downloadPdf(paper).catch(showError),
              },
          {
            text: t("library.downloadOffline"),
            style: "secondary",
            onPress: () =>
              void downloadOffline(paper).then(openOffline).catch(showError),
          },
          { text: t("common.cancel"), style: "cancel" },
        ],
      });
    },
    [
      downloadOffline,
      downloadPdf,
      getOfflinePaper,
      getPdf,
      onOpenPdf,
      openOffline,
      showDialog,
      showError,
      t,
    ],
  );

  const onToggleSave = useCallback(
    (paper: Paper) => void toggleSave(paper).catch(showError),
    [showError, toggleSave],
  );
  const onUnsave = useCallback(
    (arxivId: string) => void unsave(arxivId).catch(showError),
    [showError, unsave],
  );
  const onClearHistory = useCallback(
    () => void clearHistory().catch(showError),
    [clearHistory, showError],
  );
  const onDeleteDownloads = useCallback(
    (arxivId: string) => void deleteDownloads(arxivId).catch(showError),
    [deleteDownloads, showError],
  );

  const providerResetAll = providerManager.resetAll;
  const embeddingClear = embeddingManager.clear;
  const resetAllSettings = useCallback(async () => {
    await providerResetAll();
    await embeddingClear();
    await reset();
  }, [embeddingClear, providerResetAll, reset]);

  const openMenu = useCallback(() => {
    setActiveSection(null);
    setMenuOpen(true);
  }, []);
  const openCategories = useCallback(() => setPickerOpen(true), []);
  const closeCategories = useCallback(() => setPickerOpen(false), []);
  const openMenuFromFeed = useCallback(() => setMenuOpen(true), []);
  const closeMenuComplete = useCallback(() => setMenuOpen(false), []);
  const openSection = useCallback((section: AppSection) => {
    setMenuOpen(true);
    setActiveSection(section);
  }, []);
  const openDownloads = useCallback(
    () => openSection("downloads"),
    [openSection],
  );
  const closeViewer = useCallback(() => setViewer(null), []);
  const openTranslationSettings = useCallback(() => {
    setViewer(null);
    openSection("translation");
  }, [openSection]);
  const openAskSettings = useCallback(() => {
    setViewer(null);
    openSection("ask");
  }, [openSection]);
  const onOpenPdfEntry = useCallback(
    (entry: PdfDownloadEntry) => void onOpenPdf(entry),
    [onOpenPdf],
  );

  const libraryVisible =
    activeSection === "saved" ||
    activeSection === "history" ||
    activeSection === "downloads";
  const librarySection: LibrarySection = libraryVisible
    ? activeSection
    : "saved";
  const settingsVisible =
    activeSection === "translation" ||
    activeSection === "ask" ||
    activeSection === "language" ||
    activeSection === "about";
  const settingsSection: SettingsSection = settingsVisible
    ? activeSection
    : "about";

  if (
    !prefsReady ||
    !libraryReady ||
    !providerReady ||
    !embeddingManager.ready
  ) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.root}>
          <StatusBar style="light" />
          <LoadingScreen showHeader />
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
          offline={feed.offline}
          paginationStatus={feed.paginationStatus}
          paginationError={feed.paginationError}
          onRetry={feed.retry}
          categories={prefs.categories}
          onOpenCategories={openCategories}
          onOpenMenu={openMenuFromFeed}
          onOpenDownloads={openDownloads}
          updateAvailable={appUpdate.status === "available"}
          onRead={openPaper}
          isSaved={isSaved}
          hasOfflinePaper={hasOfflinePaper}
          hasPdf={hasPdf}
          downloadingId={downloadingId}
          canCancelDownload={canCancelDownload}
          onToggleSave={onToggleSave}
          onDownload={onDownload}
          onCancelDownload={cancelDownload}
        />
        <CategoryPicker
          visible={pickerOpen}
          selected={prefs.categories}
          onSelect={setCategories}
          onClose={closeCategories}
        />
        <LibraryScreen
          visible={libraryVisible}
          section={librarySection}
          saved={saved}
          history={history}
          downloads={downloads}
          onUnsave={onUnsave}
          onClearHistory={onClearHistory}
          onOpenPaper={openPaper}
          onOpenOffline={openOffline}
          onOpenPdf={onOpenPdfEntry}
          onDeleteDownloads={onDeleteDownloads}
          onBack={openMenu}
        />
        <SearchScreen
          visible={activeSection === "search"}
          categories={prefs.categories}
          isSaved={isSaved}
          hasOfflinePaper={hasOfflinePaper}
          hasPdf={hasPdf}
          onRead={openPaper}
          onToggleSave={onToggleSave}
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
          onReset={resetAllSettings}
          onBack={openMenu}
          providerManager={providerManager}
          embeddingManager={embeddingManager}
          askEnabled={prefs.askEnabled}
          onAskEnabledChange={setAskEnabled}
          appUpdate={appUpdate}
        />
        <AppMenu
          visible={menuOpen}
          interactive={
            menuOpen && activeSection === null && viewer === null && !pickerOpen
          }
          onSelect={setActiveSection}
          onCloseComplete={closeMenuComplete}
          updateAvailable={appUpdate.status === "available"}
        />
        <PaperViewer
          paper={viewer?.paper ?? null}
          sourceUri={viewer?.sourceUri}
          translateLangPref={prefs.translateLang}
          providerProfile={providerManager.activeProfile}
          askEnabled={prefs.askEnabled}
          askProviderProfile={providerManager.activeAskProfile}
          embeddingProfile={embeddingManager.profile}
          getEmbeddingApiKey={embeddingManager.getApiKey}
          getProviderApiKey={providerManager.getApiKey}
          onOpenSettings={openTranslationSettings}
          onOpenAskSettings={openAskSettings}
          onClose={closeViewer}
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
