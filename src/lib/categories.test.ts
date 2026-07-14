import { describe, expect, test } from "bun:test";
import {
  categoriesToSearchQuery,
  normalizeCategories,
  toggleCategorySelection,
} from "./categories";

describe("arXiv category queries", () => {
  test("uses the title wildcard for the all-papers feed", () => {
    expect(categoriesToSearchQuery(["all"])).toBe("ti:*");
    expect(categoriesToSearchQuery(["all"])).not.toContain("all:*");
  });

  test("keeps multi-select drafts valid", () => {
    expect(normalizeCategories(["cs.AI", "cs.AI", "unknown"])).toEqual([
      "cs.AI",
    ]);
    expect(toggleCategorySelection(["cs.AI"], "all")).toEqual(["all"]);
    expect(toggleCategorySelection(["all"], "all")).toEqual(["cs.LG"]);
    expect(toggleCategorySelection(["cs.AI"], "cs.AI")).toEqual(["cs.LG"]);
  });
});
