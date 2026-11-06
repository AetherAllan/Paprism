import { describe, expect, test } from "bun:test";
import { createInstance } from "i18next";
import en from "./locales/en.json";
import zh from "./locales/zh.json";

type Section = Record<string, unknown>;

/** Plural forms differ per language: English has _one, Chinese only the base key. */
function baseKeys(section: Section): Set<string> {
  return new Set(
    Object.keys(section).map((key) => key.replace(/_(one|other)$/, "")),
  );
}

describe("locales", () => {
  test("every UI string exists in both languages", () => {
    const sections = new Set([...Object.keys(en), ...Object.keys(zh)]);
    for (const name of sections) {
      // Category names fall back to their English arXiv label by design.
      if (name === "cat" || name === "group") continue;
      const english = baseKeys((en as Record<string, Section>)[name] ?? {});
      const chinese = baseKeys((zh as Record<string, Section>)[name] ?? {});
      expect([...english].filter((key) => !chinese.has(key))).toEqual([]);
      expect([...chinese].filter((key) => !english.has(key))).toEqual([]);
    }
  });

  test("counts use the right plural form in each language", async () => {
    const i18n = createInstance();
    await i18n.init({
      resources: { en: { translation: en }, zh: { translation: zh } },
      lng: "en",
      fallbackLng: "en",
      interpolation: { escapeValue: false },
      compatibilityJSON: "v4",
    });

    expect(i18n.t("library.count", { count: 1 })).toBe("1 paper");
    expect(i18n.t("library.count", { count: 23 })).toBe("23 papers");
    expect(i18n.t("search.end", { count: 1 })).toBe("Showing 1 result");
    expect(i18n.t("provider.modelsFound", { count: 2 })).toBe(
      "Found 2 models.",
    );

    await i18n.changeLanguage("zh");
    expect(i18n.t("library.count", { count: 1 })).toBe("1 篇");
    expect(i18n.t("search.end", { count: 3 })).toBe("已显示 3 篇结果");
    expect(i18n.t("provider.modelsFound", { count: 3 })).toBe(
      "找到 3 个模型。",
    );
  });
});
