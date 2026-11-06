import { useEffect } from "react";
import { StyleSheet, View, type DimensionValue } from "react-native";
import { useTranslation } from "react-i18next";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, spacing } from "@/shared/theme";

const PULSE_DURATION_MS = 1_150;
const ABSTRACT_LINES = [96, 92, 98, 86, 94, 78, 90, 62];

function Line({
  width,
  height = 12,
}: {
  width: DimensionValue;
  height?: number;
}) {
  return <View style={[styles.line, { width, height }]} />;
}

/**
 * The placeholder mirrors the paper card's layout so content appears in place.
 * One shared opacity pulse animates the whole skeleton in a single view.
 */
export function LoadingScreen({
  showHeader = false,
}: {
  /** Include the feed header's outline, for use before the header can render. */
  showHeader?: boolean;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      pulse.value = 0.5;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, {
        duration: PULSE_DURATION_MS,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true,
    );
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.42, 0.95]),
  }));

  return (
    <View
      accessibilityLabel={t("common.loadingPapers")}
      accessibilityRole="progressbar"
      style={styles.root}
    >
      {showHeader ? (
        <View
          style={[styles.header, { paddingTop: Math.max(insets.top, 8) + 2 }]}
        >
          <View style={styles.headerTile} />
          <View style={styles.headerCopy}>
            <Line width="44%" height={14} />
            <Line width="26%" height={10} />
          </View>
          <View style={styles.headerTile} />
        </View>
      ) : null}
      <Animated.View
        importantForAccessibility="no-hide-descendants"
        style={[styles.card, { paddingBottom: insets.bottom + 14 }, pulseStyle]}
      >
        <View style={styles.body}>
          <Line width="30%" height={11} />
          <Line width="42%" height={11} />
          <View style={styles.titleGroup}>
            <Line width="96%" height={24} />
            <Line width="88%" height={24} />
            <Line width="62%" height={24} />
          </View>
          <Line width="46%" height={13} />
          <Line width="24%" height={10} />
          <View style={styles.abstractGroup}>
            <Line width="12%" height={10} />
            {ABSTRACT_LINES.map((lineWidth, index) => (
              <Line key={index} width={`${lineWidth}%`} height={14} />
            ))}
          </View>
        </View>
        <View style={styles.actions}>
          <View style={[styles.action, styles.primaryAction]} />
          <View style={styles.action} />
          <View style={styles.action} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: spacing.gutter - 4,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  headerCopy: { flex: 1, gap: 7 },
  card: {
    flex: 1,
    paddingHorizontal: spacing.gutter,
    paddingTop: 18,
  },
  body: {
    flex: 1,
    gap: 10,
    overflow: "hidden",
    paddingRight: spacing.railGutter - spacing.gutter,
  },
  line: {
    borderRadius: radii.small - 4,
    backgroundColor: colors.surfaceRaised,
  },
  titleGroup: { gap: 9, marginTop: 8, marginBottom: 8 },
  abstractGroup: { gap: 11, marginTop: 16 },
  actions: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 4,
  },
  action: {
    flex: 1,
    height: 50,
    borderRadius: radii.large - 2,
    backgroundColor: colors.surfaceRaised,
  },
  primaryAction: {
    flex: 1.25,
    backgroundColor: colors.surfacePressed,
  },
});
