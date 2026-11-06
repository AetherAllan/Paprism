import { useEffect, useState } from "react";
import {
  Easing,
  runOnJS,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { motion } from "@/shared/theme";

/**
 * Keeps a sheet mounted through its exit animation. `progress` runs from 0
 * (hidden) to 1 (presented), so the backdrop can fade while the sheet slides.
 */
export function useSheetPresence(visible: boolean) {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = reduceMotion
        ? 1
        : withTiming(1, {
            duration: motion.baseMs,
            easing: Easing.out(Easing.cubic),
          });
      return;
    }
    // Already hidden, as on first mount: there is nothing to animate out.
    if (reduceMotion || progress.value === 0) {
      progress.value = 0;
      setMounted(false);
      return;
    }
    // A new function per exit, not `setMounted` itself. Worklets 0.10 aborted the
    // app when a long-lived function was handed to runOnJS again after its
    // UI-thread holders were collected. 0.13 reworked this, but a fresh function
    // costs nothing and keeps the exit path independent of that cache.
    const unmount = () => setMounted(false);
    progress.value = withTiming(
      0,
      { duration: motion.fastMs, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(unmount)();
      },
    );
  }, [progress, reduceMotion, visible]);

  return { mounted, progress };
}
