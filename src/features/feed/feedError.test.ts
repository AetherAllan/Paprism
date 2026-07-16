import { describe, expect, test } from "bun:test";
import { isOfflineFeedError } from "./feedError";

describe("isOfflineFeedError", () => {
  test("recognizes the Android DNS failure without hiding server errors", () => {
    expect(
      isOfflineFeedError(
        new Error(
          'fetch failed: java.net.UnknownHostException: Unable to resolve host "export.arxiv.org": No address associated with hostname',
        ),
      ),
    ).toBe(true);
    expect(isOfflineFeedError(new Error("arXiv request failed (503)"))).toBe(
      false,
    );
  });
});
