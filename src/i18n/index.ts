import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import zh from "./locales/zh.json";

export const APP_LOCALES = ["en", "zh"] as const;
export type AppLocale = (typeof APP_LOCALES)[number];
export type UiLangPref = "system" | AppLocale;

export function deviceUiLang(): AppLocale {
  const code = Localization.getLocales()[0]?.languageCode?.toLowerCase() ?? "en";
  return code.startsWith("zh") ? "zh" : "en";
}

export function resolveUiLang(pref: UiLangPref): AppLocale {
  return pref === "system" ? deviceUiLang() : pref;
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: deviceUiLang(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
});

export default i18n;
