import { useCallback, useEffect } from "react";
import {
  BackHandler,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/shared/theme";
import { EDGE_GESTURE_WIDTH, shouldCompleteSwipe } from "./navigationMotion";

type Props = {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  onBackComplete: () => void;
};

const PAGE_SPRING = {
  damping: 24,
  stiffness: 260,
  mass: 0.8,
  overshootClamping: true,
};

export function SectionFrame({
  visible,
  title,
  children,
  onBackComplete,
}: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const translateX = useSharedValue(width);
  const closing = useSharedValue(false);

  useEffect(() => {
    cancelAnimation(translateX);
    closing.value = false;
    if (!visible) {
      translateX.value = width;
      return;
    }
    translateX.value = reduceMotion
      ? 0
      : withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [closing, reduceMotion, translateX, visible, width]);

  const finishBack = useCallback(() => {
    onBackComplete();
  }, [onBackComplete]);

  const requestBack = useCallback(() => {
    if (!visible || closing.value) return;
    closing.value = true;
    cancelAnimation(translateX);
    if (reduceMotion) {
      translateX.value = width;
      finishBack();
      return;
    }
    translateX.value = withTiming(
      width,
      { duration: 180, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishBack)();
      },
    );
  }, [closing, finishBack, reduceMotion, translateX, visible, width]);

  useEffect(() => {
    if (!visible) return;
    // The section owns back handling while it covers the drawer. Only after
    // its exit animation completes may the drawer handle the next back press.
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        requestBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [requestBack, visible]);

  const edgePan = Gesture.Pan()
    .enabled(visible)
    .hitSlop({ left: 0, width: EDGE_GESTURE_WIDTH })
    .activeOffsetX(8)
    .failOffsetY([-12, 12])
    .onStart(() => {
      cancelAnimation(translateX);
      closing.value = false;
    })
    .onUpdate((event) => {
      translateX.value = Math.min(width, Math.max(0, event.translationX));
    })
    .onEnd((event) => {
      if (shouldCompleteSwipe(translateX.value, width, event.velocityX, 0.25)) {
        closing.value = true;
        if (reduceMotion) {
          translateX.value = width;
          runOnJS(finishBack)();
        } else {
          translateX.value = withTiming(
            width,
            { duration: 160, easing: Easing.out(Easing.cubic) },
            (finished) => {
              if (finished) runOnJS(finishBack)();
            },
          );
        }
      } else {
        translateX.value = reduceMotion ? 0 : withSpring(0, PAGE_SPRING);
      }
    })
    .onFinalize((_event, succeeded) => {
      // A system cancellation must not leave the page between two sections.
      if (!succeeded && !closing.value) {
        translateX.value = reduceMotion ? 0 : withSpring(0, PAGE_SPRING);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (!visible) return null;

  return (
    <GestureDetector gesture={edgePan}>
      <Animated.View
        accessibilityViewIsModal
        onAccessibilityEscape={requestBack}
        style={[styles.overlay, animatedStyle]}
      >
        <View
          style={[
            styles.root,
            { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
          </View>
          <View style={styles.content}>{children}</View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 30,
    elevation: 30,
    backgroundColor: colors.background,
  },
  root: { flex: 1 },
  header: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  title: { color: colors.text, fontSize: 22, fontWeight: "700" },
  content: { flex: 1 },
});
