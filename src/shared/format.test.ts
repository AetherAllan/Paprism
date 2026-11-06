import { describe, expect, test } from "bun:test";
import {
  dateLocale,
  formatAuthors,
  formatEntryTime,
  formatPaperDate,
} from "./format";

describe("format", () => {
  test("hides missing or corrupt dates instead of showing Invalid Date", () => {
    expect(formatPaperDate("", "en")).toBe("");
    expect(formatPaperDate("not a date", "zh")).toBe("");
    expect(formatEntryTime(0, "en")).toBe("");
    expect(formatEntryTime(Number.NaN, "en")).toBe("");
  });

  test("formats publication dates for the active language", () => {
    expect(formatPaperDate("2026-07-06T12:00:00Z", "zh")).toContain("2026");
    expect(formatPaperDate("2026-07-06T12:00:00Z", "en")).toContain("2026");
    expect(dateLocale("zh")).toBe("zh-CN");
    expect(dateLocale("en")).toBe("en");
  });

  test("collapses long author lists", () => {
    expect(formatAuthors([])).toBe("");
    expect(formatAuthors(["A", "B", "C"])).toBe("A, B, C");
    expect(formatAuthors(["A", "B", "C", "D", "E"])).toBe("A, B, C +2");
    expect(formatAuthors(["A", "B", "C"], 2)).toBe("A, B +1");
  });
});
