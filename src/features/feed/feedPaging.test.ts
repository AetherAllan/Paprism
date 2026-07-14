import { describe, expect, test } from "bun:test";
import { nearestPage, pageDirectionForGesture } from "./feedPaging";

describe("feed paging", () => {
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
