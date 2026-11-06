import { memo, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import ChevronDown from "lucide-react-native/icons/chevron-down";
import ChevronUp from "lucide-react-native/icons/chevron-up";
import { useTranslation } from "react-i18next";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors, motion } from "@/shared/theme";
import { IconButton } from "@/shared/ui/IconButton";
import type { FeedPager } from "./feedPager";
import type { PageDirection } from "./feedPaging";

const TRACK_HEIGHT = 112;
const THUMB_HEIGHT = 30;

/**
 * The brand's position rail. It shows where you are in the loaded feed, and
 * its chevrons give paging a non-gesture path for accessibility tools.
 */
export const FeedRail = memo(function FeedRail({
  pager,
  count,
  atStart,
  atEnd,
  onPage,
  bottomInset,
}: {
  pager: FeedPager;
  count: number;
  atStart: boolean;
  atEnd: boolean;
  onPage: (direction: PageDirection) => void;
  bottomInset: number;
}) {
  const { t } = useTranslation();
  // Appending a page shortens the thumb's relative position. Animate the total
  // so the thumb glides back rather than jumping when a page loads.
  const railCount = useSharedValue(count);

  useEffect(() => {
    railCount.value = withTiming(count, { duration: motion.baseMs });
  }, [count, railCount]);

  const thumbStyle = useAnimatedStyle(() => {
    const pageHeight = pager.height.value;
    const span = pageHeight * Math.max(1, railCount.value - 1);
    const progress =
      span > 0 ? Math.min(1, Math.max(0, pager.offset.value / span)) : 0;
    return {
      transform: [{ translateY: progress * (TRACK_HEIGHT - THUMB_HEIGHT) }],
    };
  });

  return (
    <View
      pointerEvents="box-none"
      style={[styles.root, { bottom: bottomInset }]}
    >
      <IconButton
        plain
        icon={ChevronUp}
        iconSize={17}
        size={30}
        color={colors.muted}
        disabled={atStart}
        label={t("feed.previous")}
        onPress={() => onPage(-1)}
      />
      <View pointerEvents="none" style={styles.track}>
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </View>
      <IconButton
        plain
        icon={ChevronDown}
        iconSize={17}
        size={30}
        color={colors.muted}
        disabled={atEnd}
        label={t("feed.next")}
        onPress={() => onPage(1)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    right: 3,
    width: 30,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  track: {
    width: 6,
    height: TRACK_HEIGHT,
    alignItems: "center",
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  thumb: {
    width: 4,
    height: THUMB_HEIGHT,
    borderRadius: 2,
    backgroundColor: colors.accent,
    boxShadow: `0 0 10px ${colors.accent}`,
  },
});
