import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { colors, surfaces, typography } from "@/shared/theme";
import { IconButton } from "@/shared/ui/IconButton";
import { PressableScale } from "@/shared/ui/PressableScale";

type Props<T> = {
  item: T;
  title: string;
  subtitle: string;
  meta: string;
  onPress: (item: T) => void;
  actionLabel?: string;
  actionIcon?: LucideIcon;
  actionColor?: string;
  onAction?: (item: T) => void;
};

function LibraryRowInner<T>({
  item,
  title,
  subtitle,
  meta,
  onPress,
  actionLabel,
  actionIcon,
  actionColor,
  onAction,
}: Props<T>) {
  return (
    <PressableScale
      accessibilityLabel={title}
      onPress={() => onPress(item)}
      scaleTo={0.985}
      style={[surfaces.card, styles.row]}
    >
      <View style={styles.main}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      {actionLabel && actionIcon && onAction ? (
        <IconButton
          icon={actionIcon}
          iconSize={17}
          label={actionLabel}
          color={actionColor ?? colors.muted}
          size={40}
          onPress={() => onAction(item)}
        />
      ) : null}
    </PressableScale>
  );
}

export const LibraryRow = memo(LibraryRowInner) as typeof LibraryRowInner;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 86,
    paddingVertical: 14,
    paddingHorizontal: 15,
  },
  main: { flex: 1, gap: 3 },
  title: { ...typography.title, fontSize: 15, color: colors.text },
  subtitle: { ...typography.caption, fontSize: 13, color: colors.muted },
  meta: {
    ...typography.caption,
    ...typography.numeric,
    color: colors.dim,
    marginTop: 2,
  },
});
