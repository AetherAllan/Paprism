import { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { colors, motion, radii, typography } from "@/shared/theme";
import { PressableScale } from "./PressableScale";

export type SegmentedOption<T extends string> = { id: T; label: string };

/** Pill control with a sliding thumb. The active state is never ambiguous. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.id === value),
  );
  const segmentWidth =
    trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / options.length : 0;
  const position = useSharedValue(activeIndex);

  useEffect(() => {
    position.value = reduceMotion
      ? activeIndex
      : withSpring(activeIndex, motion.spring);
  }, [activeIndex, position, reduceMotion]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value * segmentWidth }],
  }));

  return (
    <View
      accessibilityRole="radiogroup"
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      style={[styles.track, style]}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.thumb, { width: segmentWidth }, thumbStyle]}
        />
      ) : null}
      {options.map((option) => {
        const active = option.id === value;
        return (
          <PressableScale
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            key={option.id}
            onPress={() => {
              if (!active) onChange(option.id);
            }}
            scaleTo={0.98}
            style={styles.segment}
          >
            <Text
              numberOfLines={1}
              style={[styles.label, active && styles.labelActive]}
            >
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const TRACK_PADDING = 3;

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    padding: TRACK_PADDING,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderTopColor: colors.borderStrong,
  },
  thumb: {
    position: "absolute",
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
    borderRadius: radii.pill,
    backgroundColor: colors.text,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  label: { ...typography.label, fontSize: 13, color: colors.muted },
  labelActive: { color: colors.inverse, fontWeight: "600" },
});
