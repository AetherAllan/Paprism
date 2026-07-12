import { useTranslation } from "react-i18next";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <View style={styles.root}>
      <ActivityIndicator color="#a1a1aa" size="large" />
      <Text style={styles.hint}>{t("common.loadingPapers")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#111113",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  hint: {
    color: "#a1a1aa",
    fontSize: 15,
  },
});
