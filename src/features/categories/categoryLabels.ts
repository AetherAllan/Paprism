import i18n from "@/i18n";
import {
  DEFAULT_CATEGORY,
  FEED_CATEGORIES,
  normalizeCategories,
} from "@/lib/categories";

export function categoryLabel(id: string): string {
  const fallback = FEED_CATEGORIES.find((c) => c.id === id)?.label ?? id;
  return i18n.t(`cat.${id}`, { defaultValue: fallback });
}

export function categoryGroupLabel(group: string): string {
  return i18n.t(`group.${group}`, { defaultValue: group });
}

/** Header / summary: full name, or first + count when multi. */
export function categoriesSummary(ids: string[]): string {
  const cleaned = normalizeCategories(ids);
  if (cleaned.length === 0) return categoryLabel(DEFAULT_CATEGORY);
  if (cleaned.length === 1) return categoryLabel(cleaned[0]!);
  return `${categoryLabel(cleaned[0]!)} +${cleaned.length - 1}`;
}
