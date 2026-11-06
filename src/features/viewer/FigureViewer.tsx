import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import X from "lucide-react-native/icons/x";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, motion, radii, spacing } from "@/shared/theme";
import { IconButton } from "@/shared/ui/IconButton";
import { useSheetPresence } from "@/shared/ui/useSheetPresence";
import type { PaperAsset } from "./paperDocument";
import { FigureContent } from "./ReaderBlock";

const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const SCREEN_MARGIN = 12;
const MAX_HEIGHT_RATIO = 0.8;

/** Full-screen figure inspection: pinch, drag, and double-tap to zoom. */
export function FigureViewer({
  asset,
  onClose,
}: {
  asset: PaperAsset | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const { mounted, progress } = useSheetPresence(asset !== null);
  // Keep showing the figure while the viewer fades out after `asset` clears.
  const [displayed, setDisplayed] = useState(asset);
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  useEffect(() => {
    if (!asset) return;
    setDisplayed(asset);
    scale.value = 1;
    startScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
  }, [asset, scale, startScale, translateX, translateY]);

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = Math.min(
        MAX_SCALE,
        Math.max(1, startScale.value * event.scale),
      );
    })
    .onEnd(() => {
      if (scale.value <= 1.02) {
        translateX.value = withTiming(0, { duration: motion.fastMs });
        translateY.value = withTiming(0, { duration: motion.fastMs });
      }
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (scale.value <= 1) return;
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const zoomedIn = scale.value > 1.02;
      scale.value = withTiming(zoomedIn ? 1 : DOUBLE_TAP_SCALE, {
        duration: motion.baseMs,
      });
      if (zoomedIn) {
        translateX.value = withTiming(0, { duration: motion.baseMs });
        translateY.value = withTiming(0, { duration: motion.baseMs });
      }
    });

  const fadeStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const figureStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  if (!mounted || !displayed) return null;

  // Fit by whichever side runs out first, so tall figures stay on screen.
  const aspectRatio = displayed.aspectRatio ?? 4 / 3;
  const frameWidth = Math.min(
    window.width - SCREEN_MARGIN * 2,
    window.height * MAX_HEIGHT_RATIO * aspectRatio,
  );

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.backdrop, fadeStyle]}>
          <Pressable
            accessibilityLabel={t("common.close")}
            onPress={onClose}
            style={StyleSheet.absoluteFill}
          />
          <GestureDetector
            gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}
          >
            <Animated.View style={[styles.stage, figureStyle]}>
              <View
                style={[
                  styles.frame,
                  { width: frameWidth, height: frameWidth / aspectRatio },
                ]}
              >
                <FigureContent asset={displayed} fill />
              </View>
            </Animated.View>
          </GestureDetector>
          <IconButton
            icon={X}
            iconSize={18}
            label={t("common.close")}
            onPress={onClose}
            style={[styles.close, { top: Math.max(insets.top, 8) + 6 }]}
          />
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.94)",
  },
  stage: {
    alignSelf: "center",
  },
  frame: {
    overflow: "hidden",
    borderRadius: radii.medium,
    backgroundColor: colors.paper,
  },
  close: { position: "absolute", right: spacing.gutter - 4 },
});
