import type { ReactNode } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { LucideIcon } from "lucide-react-native";
import { colors, radii, surfaces, typography } from "@/shared/theme";

export function EmptyState({
  icon: Icon,
  title,
  body,
  tone = "default",
  children,
  style,
}: {
  icon?: LucideIcon;
  title?: string;
  body?: string;
  tone?: "default" | "danger";
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.root, style]}>
      {Icon ? (
        <View style={[surfaces.control, styles.tile]}>
          <Icon
            color={tone === "danger" ? colors.danger : colors.muted}
            size={24}
            strokeWidth={1.5}
          />
        </View>
      ) : null}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {body ? (
        <Text selectable style={styles.body}>
          {body}
        </Text>
      ) : null}
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  tile: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.large,
    marginBottom: 18,
  },
  title: {
    ...typography.title,
    fontSize: 17,
    color: colors.text,
    textAlign: "center",
  },
  body: {
    ...typography.body,
    color: colors.muted,
    textAlign: "center",
    marginTop: 7,
    maxWidth: 320,
  },
  actions: {
    gap: 9,
    marginTop: 24,
    maxWidth: 320,
    width: "100%",
  },
});
