import {
  Easing,
  runOnJS,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { motion } from "@/shared/theme";

/**
 * UI-thread paging state. `offset` is the single source of truth for scroll
 * position, card depth, and the position rail, so all three stay in step with
 * the finger without crossing the JS bridge on every frame.
 */
export type FeedPager = {
  offset: SharedValue<number>;
  /** Page being settled on; ahead of React state while an animation runs. */
  target: SharedValue<number>;
  count: SharedValue<number>;
  height: SharedValue<number>;
};

const MAX_DURATION = motion.pageMaxMs;
const MIN_DURATION = motion.pageMinMs;

export function movePagerTo(
  pager: FeedPager,
  index: number,
  onSettled: (index: number) => void,
  reduceMotion: boolean,
): void {
  "worklet";
  const pageHeight = pager.height.value;
  if (pageHeight <= 0) return;
  const destination = index * pageHeight;
  pager.target.value = index;

  if (reduceMotion) {
    pager.offset.value = destination;
    runOnJS(onSettled)(index);
    return;
  }

  // A page left over from a partial drag should not take as long as a full one.
  const remaining = Math.abs(destination - pager.offset.value) / pageHeight;
  pager.offset.value = withTiming(
    destination,
    {
      duration: Math.max(
        MIN_DURATION,
        Math.min(MAX_DURATION, remaining * MAX_DURATION),
      ),
      easing: Easing.out(Easing.cubic),
    },
    (finished) => {
      if (finished) runOnJS(onSettled)(index);
    },
  );
}
