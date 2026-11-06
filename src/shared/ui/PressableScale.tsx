import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { motion } from "@/shared/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed. Large rows should stay closer to 1 than buttons. */
  scaleTo?: number;
};

/**
 * The one press response in the app: a quick compress on touch and a soft
 * release. It runs on the UI thread, so it stays smooth during JS work.
 */
export function PressableScale({
  style,
  scaleTo = 0.97,
  onPressIn,
  onPressOut,
  accessibilityRole = "button",
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const targetScale = reduceMotion ? 1 : scaleTo;
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - 0.14 * pressed.value,
    transform: [{ scale: 1 - (1 - targetScale) * pressed.value }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole={accessibilityRole}
      onPressIn={(event) => {
        pressed.value = withTiming(1, { duration: motion.pressInMs });
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = withSpring(0, motion.spring);
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
      {...rest}
    />
  );
}
