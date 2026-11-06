import { useEffect, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
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
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, motion, radii, surfaces, typography } from "@/shared/theme";
import { IconButton } from "./IconButton";
import { useSheetPresence } from "./useSheetPresence";

const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 800;

/**
 * Standard bottom sheet: the backdrop fades while the sheet slides, and the
 * header can be dragged down to dismiss. An RN Modal is a separate Android
 * window, so it needs its own gesture root.
 */
export function BottomSheet({
  visible,
  title,
  onClose,
  maxHeight = "80%",
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  maxHeight?: `${number}%`;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { mounted, progress } = useSheetPresence(visible);
  const drag = useSharedValue(0);

  useEffect(() => {
    // A drag-to-dismiss leaves its offset behind. Start the next open clean.
    if (visible) drag.value = 0;
  }, [drag, visible]);

  // New identity per render: the gesture is released while the sheet is hidden,
  // and `onClose` is usually stable. See the note in useSheetPresence.
  const requestClose = () => onClose();
  const dismissPan = Gesture.Pan()
    .activeOffsetY(6)
    .onUpdate((event) => {
      drag.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (
        event.translationY > DISMISS_DISTANCE ||
        event.velocityY > DISMISS_VELOCITY
      ) {
        runOnJS(requestClose)();
      } else {
        drag.value = withSpring(0, motion.spring);
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: (1 - progress.value) * windowHeight * 0.7 + drag.value },
    ],
  }));

  if (!mounted) return null;

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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.positioner}
        >
          <Animated.View style={[styles.backdrop, backdropStyle]}>
            <Pressable
              accessibilityLabel={t("common.close")}
              onPress={onClose}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View
            accessibilityViewIsModal
            style={[
              surfaces.sheet,
              styles.sheet,
              { maxHeight, paddingBottom: Math.max(insets.bottom, 16) },
              sheetStyle,
            ]}
          >
            <GestureDetector gesture={dismissPan}>
              <View>
                <View style={styles.handle} />
                <View style={styles.header}>
                  <Text accessibilityRole="header" style={styles.title}>
                    {title}
                  </Text>
                  <IconButton
                    icon={X}
                    iconSize={18}
                    label={t("common.close")}
                    onPress={onClose}
                    size={38}
                    color={colors.muted}
                  />
                </View>
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  positioner: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.scrim,
  },
  sheet: { paddingTop: 8, overflow: "hidden" },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    marginBottom: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surfacePressed,
  },
  header: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 6,
  },
  title: { ...typography.headline, color: colors.text, flexShrink: 1 },
});
