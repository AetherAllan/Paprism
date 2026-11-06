import { memo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { colors } from "@/shared/theme";

/**
 * Content dissolving under a bar. A static gradient gives the soft edge of a
 * frosted header without the per-frame cost of a live blur on scrolling text.
 */
export const GradientFade = memo(function GradientFade({
  height,
  direction = "down",
  color = colors.background,
  style,
}: {
  height: number;
  /** "down": solid at the top, clear at the bottom. "up": the reverse. */
  direction?: "down" | "up";
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const stops =
    direction === "down"
      ? ([
          [0, 0.96],
          [0.55, 0.5],
          [1, 0],
        ] as const)
      : ([
          [0, 0],
          [0.45, 0.5],
          [1, 0.96],
        ] as const);
  return (
    <View pointerEvents="none" style={[{ height }, style]}>
      <Svg width="100%" height={height}>
        <Defs>
          <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            {stops.map(([offset, opacity]) => (
              <Stop
                key={offset}
                offset={offset}
                stopColor={color}
                stopOpacity={opacity}
              />
            ))}
          </LinearGradient>
        </Defs>
        <Rect width="100%" height={height} fill="url(#fade)" />
      </Svg>
    </View>
  );
});
