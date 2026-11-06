import { StyleSheet } from "react-native";
import type { MarkdownStyle } from "react-native-enriched-markdown";
import { colors, radii } from "@/shared/theme";

const accent = colors.accent;
const translated = colors.translated;

export const MARKDOWN_STYLE: MarkdownStyle = {
  paragraph: {
    color: colors.textSecondary,
    fontSize: 17,
    lineHeight: 27,
    marginBottom: 8,
  },
  h1: {
    color: colors.text,
    fontSize: 27,
    fontWeight: "500",
    lineHeight: 34,
    marginTop: 24,
    marginBottom: 10,
  },
  h2: {
    color: colors.text,
    fontSize: 23,
    fontWeight: "500",
    lineHeight: 30,
    marginTop: 22,
    marginBottom: 9,
  },
  h3: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "500",
    lineHeight: 27,
    marginTop: 18,
    marginBottom: 8,
  },
  h4: {
    color: colors.textSecondary,
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 25,
    marginTop: 16,
    marginBottom: 7,
  },
  h5: {
    color: colors.muted,
    fontSize: 17,
    fontWeight: "500",
    lineHeight: 24,
    marginTop: 14,
    marginBottom: 7,
  },
  h6: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 23,
    marginTop: 14,
    marginBottom: 7,
  },
  link: { color: accent, underline: false },
  blockquote: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 25,
    borderColor: colors.borderStrong,
    borderWidth: 2,
    gapWidth: 12,
    backgroundColor: colors.surface,
    marginBottom: 10,
  },
  list: {
    color: colors.textSecondary,
    fontSize: 17,
    lineHeight: 27,
    bulletColor: colors.muted,
    markerColor: colors.muted,
    gapWidth: 8,
    marginLeft: 8,
    marginBottom: 10,
  },
  table: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    headerBackgroundColor: colors.surfacePressed,
    headerTextColor: colors.text,
    rowEvenBackgroundColor: colors.surface,
    rowOddBackgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.small,
    cellPaddingHorizontal: 9,
    cellPaddingVertical: 8,
    marginBottom: 12,
  },
  code: {
    color: colors.textSecondary,
    backgroundColor: colors.surfacePressed,
    fontSize: 14,
  },
  codeBlock: {
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.small,
    padding: 12,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  math: {
    color: colors.text,
    fontSize: 20,
    backgroundColor: colors.surface,
    padding: 8,
    marginTop: 8,
    marginBottom: 12,
    textAlign: "center",
  },
  inlineMath: { color: colors.text },
  image: { borderRadius: radii.small, marginTop: 8, marginBottom: 10 },
};

export const TRANSLATION_STYLE: MarkdownStyle = {
  ...MARKDOWN_STYLE,
  paragraph: { ...MARKDOWN_STYLE.paragraph, color: translated },
  h1: { ...MARKDOWN_STYLE.h1, color: colors.text },
  h2: { ...MARKDOWN_STYLE.h2, color: colors.text },
  h3: { ...MARKDOWN_STYLE.h3, color: translated },
  h4: { ...MARKDOWN_STYLE.h4, color: translated },
  h5: { ...MARKDOWN_STYLE.h5, color: translated },
  h6: { ...MARKDOWN_STYLE.h6, color: translated },
  list: { ...MARKDOWN_STYLE.list, color: translated },
  table: { ...MARKDOWN_STYLE.table, color: translated },
};

export const DUAL_TRANSLATION_STYLE: MarkdownStyle = {
  ...TRANSLATION_STYLE,
  // In dual mode the translated heading immediately follows the same source
  // heading. Preserve its typography without stacking two section top margins.
  h1: { ...TRANSLATION_STYLE.h1, marginTop: 0 },
  h2: { ...TRANSLATION_STYLE.h2, marginTop: 0 },
  h3: { ...TRANSLATION_STYLE.h3, marginTop: 0 },
  h4: { ...TRANSLATION_STYLE.h4, marginTop: 0 },
  h5: { ...TRANSLATION_STYLE.h5, marginTop: 0 },
  h6: { ...TRANSLATION_STYLE.h6, marginTop: 0 },
};
