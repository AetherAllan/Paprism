export type PageDirection = -1 | 1;

export const PAGE_SWIPE_DISTANCE = 48;

type PageGesture = {
  dx: number;
  dy: number;
  startedAtTop: boolean;
  startedAtBottom: boolean;
};

export function pageDirectionForGesture({
  dx,
  dy,
  startedAtTop,
  startedAtBottom,
}: PageGesture): PageDirection | 0 {
  if (Math.abs(dy) < PAGE_SWIPE_DISTANCE || Math.abs(dy) <= Math.abs(dx)) {
    return 0;
  }

  if (dy < 0 && startedAtBottom) return 1;
  if (dy > 0 && startedAtTop) return -1;
  return 0;
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
  const index = Math.min(lastIndex, Math.max(0, Math.round(offset / pageHeight)));
  return { index, offset: index * pageHeight };
}
