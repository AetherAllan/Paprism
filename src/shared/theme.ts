import { StyleSheet, type TextStyle } from "react-native";

/**
 * Paprism's visual system. The palette is sampled from the brand concept:
 * a near-black canvas, top-lit graphite surfaces, white as the only "primary"
 * fill, and one cyan signal colour reserved for state and position.
 */
export const colors = {
  background: "#08090A",
  surface: "#101113",
  surfaceRaised: "#1A1B1D",
  surfacePressed: "#26282A",
  border: "rgba(255,255,255,0.07)",
  borderStrong: "rgba(255,255,255,0.13)",
  // Brighter upper edge: makes a flat surface read as lit from above.
  highlight: "rgba(255,255,255,0.17)",
  text: "#F4F5F6",
  textSecondary: "#C8CBCF",
  muted: "#9CA0A6",
  dim: "#7A7E85",
  accent: "#0CE4FE",
  accentSoft: "rgba(12,228,254,0.11)",
  accentBorder: "rgba(12,228,254,0.34)",
  accentSelection: "rgba(12,228,254,0.26)",
  translated: "#CDECF1",
  inverse: "#0A0B0C",
  danger: "#FF7A7A",
  dangerSoft: "rgba(255,122,122,0.11)",
  dangerBorder: "rgba(255,122,122,0.32)",
  success: "#3DDC97",
  scrim: "rgba(0,0,0,0.66)",
  // arXiv figures often have transparent backgrounds and black labels.
  paper: "#F4F4F5",
} as const;

export const radii = {
  small: 10,
  medium: 14,
  large: 18,
  xlarge: 26,
  pill: 999,
} as const;

export const spacing = {
  gutter: 20,
  // Space reserved on the right of feed text for the position rail.
  railGutter: 34,
} as const;

/**
 * Large type stays at regular or medium weight with slightly tight tracking.
 * Hierarchy comes from size and colour rather than from heavy weights.
 */
export const typography = {
  display: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: "500",
    letterSpacing: -0.4,
  },
  headline: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "500",
    letterSpacing: -0.25,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "500",
    letterSpacing: -0.1,
  },
  reading: { fontSize: 16, lineHeight: 25 },
  body: { fontSize: 14, lineHeight: 21 },
  label: { fontSize: 14, lineHeight: 19, fontWeight: "500" },
  caption: { fontSize: 12, lineHeight: 17 },
  micro: { fontSize: 11, lineHeight: 15, fontWeight: "500" },
  numeric: { fontVariant: ["tabular-nums"] },
} as const satisfies Record<string, TextStyle>;

export const motion = {
  pressInMs: 90,
  fastMs: 180,
  baseMs: 260,
  pageMaxMs: 340,
  pageMinMs: 150,
  spring: {
    damping: 24,
    stiffness: 260,
    mass: 0.8,
    overshootClamping: true,
  },
} as const;

const hairline = StyleSheet.hairlineWidth;

/** Shared top-lit surface recipes, so every card catches light the same way. */
export const surfaces = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.large,
    borderWidth: hairline,
    borderColor: colors.border,
    borderTopColor: colors.borderStrong,
  },
  control: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.medium,
    borderWidth: hairline,
    borderColor: colors.border,
    borderTopColor: colors.highlight,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xlarge,
    borderTopRightRadius: radii.xlarge,
    borderWidth: hairline,
    borderColor: colors.border,
    borderTopColor: colors.highlight,
  },
});
