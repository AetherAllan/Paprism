import { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AppSection } from "@/types/navigation";

type Props = {
  visible: boolean;
  onSelect: (section: AppSection) => void;
  onClose: () => void;
};

const ITEMS: { id: AppSection; labelKey: string; separated?: boolean }[] = [
  { id: "search", labelKey: "menu.search" },
  { id: "saved", labelKey: "library.tabSaved" },
  { id: "history", labelKey: "library.tabHistory" },
  { id: "downloads", labelKey: "library.tabDownloads" },
  { id: "translation", labelKey: "menu.translation", separated: true },
  { id: "language", labelKey: "menu.language" },
  { id: "about", labelKey: "settings.about" },
];

export function AppMenu({ visible, onSelect, onClose }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(340, width * 0.84);
  const slide = useRef(new Animated.Value(panelWidth)).current;

  useEffect(() => {
    if (!visible) {
      slide.stopAnimation();
      slide.setValue(panelWidth);
      return;
    }
    const animation = Animated.timing(slide, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [panelWidth, slide, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay} accessibilityViewIsModal>
        <Pressable
          accessibilityLabel={t("common.closeMenu")}
          onPress={onClose}
          style={styles.backdrop}
        />
        <Animated.View
          style={[
            styles.panel,
            {
              width: panelWidth,
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 16,
              transform: [{ translateX: slide }],
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>{t("menu.title")}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>{t("common.done")}</Text>
            </Pressable>
          </View>
          <View style={styles.items}>
            {ITEMS.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => onSelect(item.id)}
                style={[
                  styles.item,
                  item.separated && styles.itemSeparated,
                ]}
              >
                <Text style={styles.itemText}>{t(item.labelKey)}</Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.52)",
  },
  backdrop: { flex: 1 },
  panel: {
    backgroundColor: "#111113",
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: "rgba(255,255,255,0.12)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  title: { color: "#fafafa", fontSize: 20, fontWeight: "700" },
  close: { color: "#a1a1aa", fontSize: 15, fontWeight: "600" },
  items: { paddingHorizontal: 12 },
  item: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  itemSeparated: {
    marginTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  itemText: { color: "#f4f4f5", fontSize: 16, fontWeight: "600" },
  chevron: { color: "#71717a", fontSize: 24 },
});
