import { memo, useCallback } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { EnrichedMarkdownText } from "react-native-enriched-markdown";
import { SvgUri } from "react-native-svg";
import { colors, radii, typography } from "@/shared/theme";
import { PressableScale } from "@/shared/ui/PressableScale";
import type { AskSelection } from "@/features/ask/askTypes";
import type { PaperAsset, PaperBlock } from "./paperDocument";
import {
  DUAL_TRANSLATION_STYLE,
  MARKDOWN_STYLE,
  TRANSLATION_STYLE,
} from "./readerMarkdown";

export type ReaderMode = "source" | "dual" | "translation";

const ignoreImageError = () => undefined;

/**
 * Memoized so translation commits, scrolling, and the Ask sheet only re-render
 * the block whose own content changed. Native Markdown layout is expensive.
 */
export const ReaderBlock = memo(function ReaderBlock({
  block,
  mode,
  translation,
  onLinkPress,
  askEnabled,
  arxivId,
  onAsk,
  onOpenFigure,
}: {
  block: PaperBlock;
  mode: ReaderMode;
  translation?: string;
  onLinkPress: (event: { url: string }) => void;
  askEnabled: boolean;
  arxivId: string;
  onAsk: (selection: AskSelection) => void;
  onOpenFigure: (asset: PaperAsset) => void;
}) {
  const showSource =
    mode !== "translation" || !block.translationSource || !translation;
  const showTranslation = mode !== "source" && !!translation;

  const askSource = useCallback(
    (text: string) =>
      onAsk({
        arxivId,
        blockId: block.id,
        text,
        sourceText: block.plainText,
        sectionTitle: block.sectionTitle,
        language: "source",
      }),
    [arxivId, block, onAsk],
  );
  const askTranslation = useCallback(
    (text: string) =>
      onAsk({
        arxivId,
        blockId: block.id,
        text,
        sourceText: block.plainText,
        sectionTitle: block.sectionTitle,
        language: "translation",
      }),
    [arxivId, block, onAsk],
  );

  return (
    <View style={styles.block}>
      {block.assets?.map((asset, index) => (
        <PaperFigure
          key={`${asset.uri}-${index}`}
          asset={asset}
          onOpen={onOpenFigure}
        />
      ))}
      {showSource && block.markdown ? (
        <PaperMarkdown
          markdown={block.markdown}
          onLinkPress={onLinkPress}
          askEnabled={askEnabled}
          onAsk={askSource}
        />
      ) : null}
      {showTranslation ? (
        <View
          style={mode === "dual" ? styles.translation : styles.translationOnly}
        >
          <PaperMarkdown
            markdown={translation}
            onLinkPress={onLinkPress}
            translated
            compactHeading={mode === "dual"}
            askEnabled={askEnabled}
            onAsk={askTranslation}
          />
        </View>
      ) : null}
    </View>
  );
});

function PaperMarkdown({
  markdown,
  translated = false,
  compactHeading = false,
  onLinkPress,
  askEnabled = false,
  onAsk,
}: {
  markdown: string;
  translated?: boolean;
  compactHeading?: boolean;
  onLinkPress: (event: { url: string }) => void;
  askEnabled?: boolean;
  onAsk?: (text: string) => void;
}) {
  return (
    <EnrichedMarkdownText
      markdown={markdown}
      markdownStyle={
        translated
          ? compactHeading
            ? DUAL_TRANSLATION_STYLE
            : TRANSLATION_STYLE
          : MARKDOWN_STYLE
      }
      onLinkPress={onLinkPress}
      selectable
      flavor="github"
      md4cFlags={{ latexMath: true, superscript: true, subscript: true }}
      textBreakStrategy="highQuality"
      maxFontSizeMultiplier={1.8}
      selectionColor={colors.accentSelection}
      selectionHandleColor={colors.accent}
      contextMenuItems={
        askEnabled && onAsk
          ? [
              {
                text: "Ask",
                icon: "auto_awesome",
                onPress: ({ text }) => onAsk(text),
              },
            ]
          : undefined
      }
    />
  );
}

export function FigureContent({
  asset,
  fill = false,
}: {
  asset: PaperAsset;
  /** Fill the parent rather than sizing from the figure's aspect ratio. */
  fill?: boolean;
}) {
  const aspectRatio = asset.aspectRatio ?? 4 / 3;
  const sizing = fill ? styles.figureFill : { aspectRatio };
  if (/\.svg(?:$|[?#])/i.test(asset.uri)) {
    return (
      <View style={[styles.figureCanvas, sizing]}>
        <SvgUri
          uri={asset.uri}
          width="100%"
          height="100%"
          onError={ignoreImageError}
          fallback={<Text style={styles.figureFallback}>{asset.alt}</Text>}
        />
      </View>
    );
  }
  return (
    <Image
      source={{ uri: asset.uri }}
      accessibilityLabel={asset.alt}
      resizeMode="contain"
      style={[styles.figureCanvas, sizing]}
    />
  );
}

function PaperFigure({
  asset,
  onOpen,
}: {
  asset: PaperAsset;
  onOpen: (asset: PaperAsset) => void;
}) {
  return (
    <PressableScale
      accessibilityRole="imagebutton"
      accessibilityLabel={asset.alt}
      onPress={() => onOpen(asset)}
      scaleTo={0.99}
      style={styles.figure}
    >
      <FigureContent asset={asset} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: 6 },
  translation: {
    borderLeftWidth: 2,
    borderLeftColor: colors.accentBorder,
    paddingLeft: 12,
    marginTop: 5,
    marginBottom: 8,
  },
  translationOnly: { marginBottom: 8 },
  figure: {
    marginVertical: 8,
    overflow: "hidden",
    borderRadius: radii.medium,
  },
  // arXiv figures often use transparent backgrounds with black labels. Keep a
  // paper-coloured canvas so their original pixels stay readable.
  figureCanvas: {
    width: "100%",
    backgroundColor: colors.paper,
    borderRadius: radii.medium,
  },
  figureFill: { flex: 1 },
  figureFallback: { ...typography.caption, color: colors.inverse, padding: 12 },
});
