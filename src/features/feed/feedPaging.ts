export type PageDirection = -1 | 1;

/** Fetch late enough to avoid hoarding papers, but before the user hits the edge. */
export function shouldPrefetch(index: number, paperCount: number): boolean {
  return paperCount > 0 && paperCount - 1 - index <= 4;
}

export const PAGE_SWIPE_DISTANCE = 48;
const PAGE_FLICK_VELOCITY = 650;
const PAGE_FLICK_MIN_DISTANCE = 14;
const EDGE_RESISTANCE = 0.22;

type PageGesture = {
  dx: number;
  dy: number;
  startedAtTop: boolean;
  startedAtBottom: boolean;
  /** A short, fast flick commits the page just like a long drag. */
  velocityY?: number;
};

export function pageDirectionForGesture({
  dx,
  dy,
  startedAtTop,
  startedAtBottom,
  velocityY = 0,
}: PageGesture): PageDirection | 0 {
  "worklet";
  const distance = Math.abs(dy);
  if (distance <= Math.abs(dx)) return 0;

  const flicked =
    distance >= PAGE_FLICK_MIN_DISTANCE &&
    Math.abs(velocityY) >= PAGE_FLICK_VELOCITY &&
    velocityY * dy > 0;
  if (distance < PAGE_SWIPE_DISTANCE && !flicked) return 0;

  if (dy < 0 && startedAtBottom) return 1;
  if (dy > 0 && startedAtTop) return -1;
  return 0;
}

/**
 * Feed offset while a finger drags between pages. Travel is limited to one
 * page, and resists past either end of the loaded feed.
 */
export function pageDragOffset({
  startOffset,
  travelY,
  direction,
  pageHeight,
  itemCount,
}: {
  startOffset: number;
  travelY: number;
  direction: PageDirection;
  pageHeight: number;
  itemCount: number;
}): number {
  "worklet";
  const travel = Math.max(0, direction === 1 ? -travelY : travelY);
  const lastOffset = Math.max(0, itemCount - 1) * pageHeight;
  const available = direction === 1 ? lastOffset - startOffset : startOffset;
  if (available <= 0) return startOffset + direction * travel * EDGE_RESISTANCE;
  return startOffset + direction * Math.min(travel, available, pageHeight);
}

export function nearestPage(
  offset: number,
  pageHeight: number,
  itemCount: number,
): { index: number; offset: number } {
  if (
    !Number.isFinite(offset) ||
    !Number.isFinite(pageHeight) ||
    pageHeight <= 0 ||
    itemCount <= 0
  ) {
    return { index: 0, offset: 0 };
  }

  const lastIndex = Math.max(0, Math.floor(itemCount) - 1);
  const index = Math.min(
    lastIndex,
    Math.max(0, Math.round(offset / pageHeight)),
  );
  return { index, offset: index * pageHeight };
}
