import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import CircleCheck from "lucide-react-native/icons/circle-check";
import CircleX from "lucide-react-native/icons/circle-x";
import Info from "lucide-react-native/icons/info";
import TriangleAlert from "lucide-react-native/icons/triangle-alert";
import { useTranslation } from "react-i18next";
import Animated, {
  FadeIn,
  ZoomIn,
  useReducedMotion,
} from "react-native-reanimated";
import { colors, radii, surfaces, typography } from "./theme";
import { Button, type ButtonVariant } from "./ui/Button";

export type DialogKind = "info" | "success" | "error" | "destructive";
export type DialogActionStyle =
  "default" | "secondary" | "cancel" | "destructive";

export type DialogAction = {
  text: string;
  style?: DialogActionStyle;
  onPress?: () => void | Promise<void>;
};

export type DialogOptions = {
  title: string;
  message?: string;
  kind?: DialogKind;
  actions?: DialogAction[];
};

type DialogContextValue = {
  showDialog: (options: DialogOptions) => void;
  showError: (title: string, error: unknown) => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

const ACTION_VARIANT: Record<DialogActionStyle, ButtonVariant> = {
  default: "primary",
  secondary: "secondary",
  cancel: "secondary",
  destructive: "danger",
};

export function AppDialogProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<DialogOptions | null>(null);
  const dismissDialog = useCallback(() => setDialog(null), []);
  const showDialog = useCallback((options: DialogOptions) => {
    setDialog(options);
  }, []);
  const showError = useCallback(
    (title: string, error: unknown) =>
      setDialog({
        kind: "error",
        title,
        message:
          error instanceof Error ? error.message : t("common.unknownError"),
      }),
    [t],
  );
  const value = useMemo(
    () => ({ showDialog, showError }),
    [showDialog, showError],
  );

  return (
    <DialogContext.Provider value={value}>
      {children}
      <DialogHost dialog={dialog} onDismiss={dismissDialog} />
    </DialogContext.Provider>
  );
}

export function useAppDialog(): DialogContextValue {
  const value = useContext(DialogContext);
  if (!value)
    throw new Error("useAppDialog must be used inside AppDialogProvider");
  return value;
}

function DialogHost({
  dialog,
  onDismiss,
}: {
  dialog: DialogOptions | null;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  if (!dialog) return null;

  const kind = dialog.kind ?? "info";
  const actions = dialog.actions?.length
    ? dialog.actions.slice(0, 3)
    : [{ text: t("common.done") }];
  // Tapping the backdrop must not cancel a destructive prompt by accident, but
  // the system back key always means cancel. Dismissing never runs the action.
  const backdropDismisses = kind !== "destructive";
  const Icon =
    kind === "success"
      ? CircleCheck
      : kind === "error"
        ? CircleX
        : kind === "destructive"
          ? TriangleAlert
          : Info;
  const iconColor =
    kind === "success"
      ? colors.success
      : kind === "error" || kind === "destructive"
        ? colors.danger
        : colors.accent;

  const selectAction = (action: DialogAction) => {
    onDismiss();
    void action.onPress?.();
  };

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onDismiss}
    >
      <Animated.View
        entering={reduceMotion ? undefined : FadeIn.duration(160)}
        style={styles.backdrop}
      >
        <Pressable
          accessibilityLabel={t("common.close")}
          disabled={!backdropDismisses}
          onPress={onDismiss}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          accessibilityViewIsModal
          importantForAccessibility="yes"
          entering={reduceMotion ? undefined : ZoomIn.duration(180)}
          style={[surfaces.card, styles.card]}
        >
          <View style={[surfaces.control, styles.icon]}>
            <Icon color={iconColor} size={22} strokeWidth={1.7} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            {dialog.title}
          </Text>
          {dialog.message ? (
            <Text selectable numberOfLines={8} style={styles.message}>
              {dialog.message}
            </Text>
          ) : null}
          <View
            style={[
              styles.actions,
              actions.length === 2 && styles.actionsHorizontal,
            ]}
          >
            {actions.map((action, index) => (
              <Button
                key={`${action.text}-${index}`}
                label={action.text}
                variant={
                  // In a stack of choices, cancel steps back behind them.
                  action.style === "cancel" && actions.length > 2
                    ? "ghost"
                    : ACTION_VARIANT[action.style ?? "default"]
                }
                onPress={() => selectAction(action)}
                style={actions.length === 2 ? styles.actionHorizontal : null}
              />
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
    backgroundColor: colors.scrim,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    padding: 22,
    borderRadius: radii.xlarge,
    backgroundColor: colors.surface,
    borderTopColor: colors.highlight,
  },
  icon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { ...typography.headline, color: colors.text },
  message: {
    ...typography.body,
    color: colors.muted,
    marginTop: 8,
  },
  actions: { gap: 8, marginTop: 22 },
  actionsHorizontal: { flexDirection: "row" },
  actionHorizontal: { flex: 1 },
});
