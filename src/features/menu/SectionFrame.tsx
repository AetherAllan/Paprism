import { useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  BackHandler,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";
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
import { colors, motion, spacing, typography } from "@/shared/theme";
import { IconButton } from "@/shared/ui/IconButton";
import { EDGE_GESTURE_WIDTH, shouldCompleteSwipe } from "./navigationMotion";

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  children: ReactNode;
  onBackComplete: () => void;
};

export function SectionFrame({
  visible,
  title,
  subtitle,
  headerRight,
  children,
  onBackComplete,
}: Props) {
  const { t } = useTranslation();
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
      : withTiming(0, {
          duration: motion.baseMs,
          easing: Easing.out(Easing.cubic),
        });
  }, [closing, reduceMotion, translateX, visible, width]);

  const onBackCompleteRef = useRef(onBackComplete);
  onBackCompleteRef.current = onBackComplete;

  const requestBack = useCallback(() => {
    if (!visible || closing.value) return;
    closing.value = true;
    cancelAnimation(translateX);
    if (reduceMotion) {
      translateX.value = width;
      onBackCompleteRef.current();
      return;
    }
    // New function per exit. This frame unmounts its gesture while hidden, so
    // a stable callback would lose its Worklets remote-function entry and abort
    // on the next exit. See the note in useSheetPresence.
    const finish = () => onBackCompleteRef.current();
    translateX.value = withTiming(
      width,
      { duration: motion.fastMs, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finish)();
      },
    );
  }, [closing, reduceMotion, translateX, visible, width]);

  const finishBack = () => onBackCompleteRef.current();

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
        translateX.value = reduceMotion ? 0 : withSpring(0, motion.spring);
      }
    })
    .onFinalize((_event, succeeded) => {
      // A system cancellation must not leave the page between two sections.
      if (!succeeded && !closing.value) {
        translateX.value = reduceMotion ? 0 : withSpring(0, motion.spring);
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
          style={[styles.root, { paddingTop: Math.max(insets.top, 8) + 2 }]}
        >
          <View style={styles.header}>
            <IconButton
              icon={ArrowLeft}
              label={t("common.back")}
              onPress={requestBack}
            />
            <View style={styles.titleBox}>
              <Text
                accessibilityRole="header"
                numberOfLines={1}
                style={styles.title}
              >
                {title}
              </Text>
              {subtitle ? (
                <Text numberOfLines={1} style={styles.subtitle}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {headerRight}
          </View>
          <View style={[styles.content, { paddingBottom: insets.bottom }]}>
            {children}
          </View>
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
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: spacing.gutter - 4,
    paddingBottom: 10,
  },
  titleBox: { flex: 1, gap: 1 },
  title: { ...typography.headline, color: colors.text },
  subtitle: { ...typography.caption, ...typography.numeric, color: colors.dim },
  content: { flex: 1 },
});
