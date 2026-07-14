import { describe, expect, test } from "bun:test";
import { ARXIV_PAGE_SIZE } from "@/lib/arxiv";
import {
  nearestPage,
  pageDirectionForGesture,
  shouldPrefetch,
} from "./feedPaging";

describe("feed paging", () => {
  test("loads 20 papers and only prefetches within the final four", () => {
    expect(ARXIV_PAGE_SIZE).toBe(20);
    expect(shouldPrefetch(14, 20)).toBe(false);
    expect(shouldPrefetch(15, 20)).toBe(true);
    expect(shouldPrefetch(0, 0)).toBe(false);
  });

  test("does not page when the gesture started inside the abstract", () => {
    expect(
      pageDirectionForGesture({
        dx: 0,
        dy: -300,
        startedAtTop: false,
        startedAtBottom: false,
      }),
    ).toBe(0);
  });

  test("pages only in the direction allowed by the starting boundary", () => {
    expect(
      pageDirectionForGesture({
        dx: 3,
        dy: -80,
        startedAtTop: false,
        startedAtBottom: true,
      }),
    ).toBe(1);
    expect(
      pageDirectionForGesture({
        dx: 3,
        dy: 80,
        startedAtTop: true,
        startedAtBottom: false,
      }),
    ).toBe(-1);
  });

  test("ignores short and horizontal gestures", () => {
    expect(
      pageDirectionForGesture({
        dx: 0,
        dy: -47,
        startedAtTop: false,
        startedAtBottom: true,
      }),
    ).toBe(0);
    expect(
      pageDirectionForGesture({
        dx: 90,
        dy: -80,
        startedAtTop: false,
        startedAtBottom: true,
      }),
    ).toBe(0);
  });

  test("allows either direction when the abstract cannot scroll", () => {
    expect(
      pageDirectionForGesture({
        dx: 0,
        dy: -60,
        startedAtTop: true,
        startedAtBottom: true,
      }),
    ).toBe(1);
    expect(
      pageDirectionForGesture({
        dx: 0,
        dy: 60,
        startedAtTop: true,
        startedAtBottom: true,
      }),
    ).toBe(-1);
  });

  test("normalizes offsets to the nearest valid page", () => {
    expect(nearestPage(149, 100, 5)).toEqual({ index: 1, offset: 100 });
    expect(nearestPage(151, 100, 5)).toEqual({ index: 2, offset: 200 });
    expect(nearestPage(-80, 100, 5)).toEqual({ index: 0, offset: 0 });
    expect(nearestPage(900, 100, 5)).toEqual({ index: 4, offset: 400 });
    expect(nearestPage(100, 0, 5)).toEqual({ index: 0, offset: 0 });
    expect(nearestPage(100, 100, 0)).toEqual({ index: 0, offset: 0 });
  });
});
