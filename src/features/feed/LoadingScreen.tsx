import { useEffect } from "react";
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";
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
  type AnimatedStyle,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii } from "@/shared/theme";

const SHIMMER_WIDTH = 112;
const SHIMMER_DURATION_MS = 1_650;

type SkeletonBlockProps = {
  width?: DimensionValue;
  height: number;
  shimmerStyle: AnimatedStyle<ViewStyle>;
  style?: StyleProp<ViewStyle>;
};

function SkeletonBlock({
  width,
  height,
  shimmerStyle,
  style,
}: SkeletonBlockProps) {
  return (
    <View
      accessible={false}
      style={[
        styles.block,
        { height },
        width !== undefined && { width },
        style,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.shimmer, shimmerStyle]}
      >
        <Svg width={SHIMMER_WIDTH} height="100%">
          <Defs>
            <LinearGradient id="feed-shimmer" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#ffffff" stopOpacity="0" />
              <Stop offset="0.5" stopColor="#ffffff" stopOpacity="0.085" />
              <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width={SHIMMER_WIDTH}
            height="100%"
            fill="url(#feed-shimmer)"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

export function LoadingScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 0;
      return;
    }
    progress.value = withRepeat(
      withTiming(1, {
        duration: SHIMMER_DURATION_MS,
        // A linear sweep reads as continuous loading. Starting the highlight
        // half-visible avoids a dead pause before it first enters the screen.
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0 : 1,
    transform: [
      {
        translateX: interpolate(
          progress.value,
          [0, 1],
          [-SHIMMER_WIDTH / 2, width],
        ),
      },
    ],
  }));

  return (
    <View
      accessibilityLabel={t("common.loadingPapers")}
      accessibilityRole="progressbar"
      style={[styles.root, { paddingBottom: insets.bottom + 16 }]}
    >
      <View style={styles.body} importantForAccessibility="no-hide-descendants">
        <SkeletonBlock
          width="31%"
          height={12}
          shimmerStyle={shimmerStyle}
          style={styles.date}
        />
        <SkeletonBlock
          width="48%"
          height={12}
          shimmerStyle={shimmerStyle}
          style={styles.categories}
        />

        <View style={styles.titleGroup}>
          <SkeletonBlock width="96%" height={23} shimmerStyle={shimmerStyle} />
          <SkeletonBlock width="88%" height={23} shimmerStyle={shimmerStyle} />
          <SkeletonBlock width="64%" height={23} shimmerStyle={shimmerStyle} />
        </View>

        <View style={styles.authorGroup}>
          <SkeletonBlock width="81%" height={14} shimmerStyle={shimmerStyle} />
          <SkeletonBlock width="56%" height={14} shimmerStyle={shimmerStyle} />
        </View>
        <SkeletonBlock
          width="27%"
          height={11}
          shimmerStyle={shimmerStyle}
          style={styles.identifier}
        />

        <SkeletonBlock
          width="15%"
          height={11}
          shimmerStyle={shimmerStyle}
          style={styles.sectionLabel}
        />
        <View style={styles.abstractGroup}>
          {[96, 92, 98, 86, 94, 78, 90].map((lineWidth, index) => (
            <SkeletonBlock
              key={`${lineWidth}-${index}`}
              width={`${lineWidth}%`}
              height={15}
              shimmerStyle={shimmerStyle}
            />
          ))}
        </View>
      </View>

      <View
        style={styles.actions}
        importantForAccessibility="no-hide-descendants"
      >
        <SkeletonBlock
          height={48}
          shimmerStyle={shimmerStyle}
          style={styles.action}
        />
        <SkeletonBlock
          height={48}
          shimmerStyle={shimmerStyle}
          style={[styles.action, styles.primaryAction]}
        />
        <SkeletonBlock
          height={48}
          shimmerStyle={shimmerStyle}
          style={styles.action}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.background,
  },
  body: {
    flex: 1,
    overflow: "hidden",
  },
  block: {
    overflow: "hidden",
    borderRadius: radii.small,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.035)",
  },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: SHIMMER_WIDTH,
  },
  date: { marginBottom: 12 },
  categories: { marginBottom: 18 },
  titleGroup: { gap: 10, marginBottom: 18 },
  authorGroup: { gap: 8, marginBottom: 10 },
  identifier: { marginBottom: 25 },
  sectionLabel: { marginBottom: 12 },
  abstractGroup: { gap: 10 },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  action: {
    flex: 1,
    width: "auto",
    borderRadius: radii.medium,
  },
  primaryAction: {
    flex: 1.2,
    backgroundColor: colors.surfacePressed,
  },
});
