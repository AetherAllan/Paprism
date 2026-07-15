import { describe, expect, test } from "bun:test";
import {
  DEFAULT_PREFS,
  deviceTranslateLang,
  resolveTranslateLang,
} from "@/lib/storage";
import { filterLanguageOptions, type LanguageOption } from "./languagePicker";

const options: LanguageOption[] = [
  { id: "system", label: "跟随系统", detail: "简体中文" },
  { id: "en", label: "英语", keywords: ["English"] },
  { id: "zh-TW", label: "繁体中文" },
];

describe("language picker", () => {
  test("defaults to the device language without overriding explicit choices", () => {
    expect(DEFAULT_PREFS.uiLang).toBe("system");
    expect(DEFAULT_PREFS.translateLang).toBe("system");
    expect(resolveTranslateLang("system")).toBe(deviceTranslateLang());
    expect(resolveTranslateLang("fr")).toBe("fr");
  });

  test("searches localized names and codes while keeping the system choice", () => {
    expect(
      filterLanguageOptions(options, "english").map((item) => item.id),
    ).toEqual(["system", "en"]);
    expect(
      filterLanguageOptions(options, "zh-tw").map((item) => item.id),
    ).toEqual(["system", "zh-TW"]);
    expect(
      filterLanguageOptions(options, "繁体").map((item) => item.id),
    ).toEqual(["system", "zh-TW"]);
  });
});
