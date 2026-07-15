import { useCallback, useEffect } from "react";
import {
  BackHandler,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/shared/theme";
import type { AppSection } from "@/types/navigation";
import { AppMenuContent } from "./AppMenuContent";
import { drawerWidth, shouldCompleteSwipe } from "./navigationMotion";

type Props = {
  visible: boolean;
  interactive: boolean;
  onSelect: (section: AppSection) => void;
  onCloseComplete: () => void;
};

const DRAWER_SPRING = {
  damping: 24,
  stiffness: 260,
  mass: 0.8,
  overshootClamping: true,
};

export function AppMenu({
  visible,
  interactive,
  onSelect,
  onCloseComplete,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = drawerWidth(width);
  const reduceMotion = useReducedMotion();
  const translateX = useSharedValue(panelWidth);
  const closing = useSharedValue(false);

  useEffect(() => {
    if (!visible) {
      cancelAnimation(translateX);
      closing.value = false;
      translateX.value = panelWidth;
      return;
    }
    closing.value = false;
    translateX.value = reduceMotion ? 0 : withSpring(0, DRAWER_SPRING);
  }, [closing, panelWidth, reduceMotion, translateX, visible]);

  const finishClose = useCallback(() => {
    onCloseComplete();
  }, [onCloseComplete]);

  const requestClose = useCallback(() => {
    if (!visible || !interactive || closing.value) return;
    closing.value = true;
    cancelAnimation(translateX);
    if (reduceMotion) {
      translateX.value = panelWidth;
      finishClose();
      return;
    }
    translateX.value = withTiming(
      panelWidth,
      { duration: 180, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishClose)();
      },
    );
  }, [
    closing,
    finishClose,
    interactive,
    panelWidth,
    reduceMotion,
    translateX,
    visible,
  ]);

  useEffect(() => {
    if (!visible || !interactive) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        requestClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [interactive, requestClose, visible]);

  const closePan = Gesture.Pan()
    .enabled(visible && interactive)
    .activeOffsetX(8)
    .failOffsetY([-12, 12])
    .onStart(() => {
      cancelAnimation(translateX);
      closing.value = false;
    })
    .onUpdate((event) => {
      translateX.value = Math.min(panelWidth, Math.max(0, event.translationX));
    })
    .onEnd((event) => {
      if (
        shouldCompleteSwipe(translateX.value, panelWidth, event.velocityX, 0.25)
      ) {
        closing.value = true;
        if (reduceMotion) {
          translateX.value = panelWidth;
          runOnJS(finishClose)();
        } else {
          translateX.value = withTiming(
            panelWidth,
            { duration: 160, easing: Easing.out(Easing.cubic) },
            (finished) => {
              if (finished) runOnJS(finishClose)();
            },
          );
        }
      } else {
        translateX.value = reduceMotion ? 0 : withSpring(0, DRAWER_SPRING);
      }
    })
    .onFinalize((_event, succeeded) => {
      if (!succeeded && !closing.value) {
        translateX.value = reduceMotion ? 0 : withSpring(0, DRAWER_SPRING);
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [panelWidth, 0],
      [0, 0.52],
      Extrapolation.CLAMP,
    ),
  }));
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View pointerEvents="box-none" style={styles.layer}>
      <View
        accessibilityElementsHidden={!visible || !interactive}
        accessibilityViewIsModal={visible && interactive}
        importantForAccessibility={
          visible && interactive ? "yes" : "no-hide-descendants"
        }
        pointerEvents={visible && interactive ? "auto" : "none"}
        style={StyleSheet.absoluteFill}
      >
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            accessibilityLabel={t("common.closeMenu")}
            onPress={requestClose}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <GestureDetector gesture={closePan}>
          <Animated.View
            style={[
              styles.panel,
              {
                width: panelWidth,
                paddingTop: insets.top + 18,
                paddingBottom: insets.bottom + 16,
              },
              panelStyle,
            ]}
          >
            <AppMenuContent onSelect={onSelect} />
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    elevation: 20,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#000000",
  },
  panel: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.borderStrong,
  },
});
