import { describe, expect, test } from "bun:test";
import { categoriesToSearchQuery } from "./categories";

describe("arXiv category queries", () => {
  test("uses the title wildcard for the all-papers feed", () => {
    expect(categoriesToSearchQuery(["all"])).toBe("ti:*");
    expect(categoriesToSearchQuery(["all"])).not.toContain("all:*");
  });
});
