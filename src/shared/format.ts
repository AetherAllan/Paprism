/**
 * `toLocale*String` builds a new formatter per call, which is slow on Hermes.
 * Lists format many dates per render, so formatters are cached per locale.
 */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(
  key: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const id = `${key}:${locale}`;
  let cached = formatters.get(id);
  if (!cached) {
    cached = new Intl.DateTimeFormat(locale, options);
    formatters.set(id, cached);
  }
  return cached;
}

export function dateLocale(language: string): string {
  return language.startsWith("zh") ? "zh-CN" : "en";
}

/** Long publication date, or "" when the value is missing or unparseable. */
export function formatPaperDate(value: string, language: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatter("paper", dateLocale(language), {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function formatEntryTime(timestamp: number, language: string): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "";
  return formatter("entry", dateLocale(language), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

/** "A, B, C +4", the compact author line used on cards and rows. */
export function formatAuthors(authors: string[], limit = 3): string {
  if (authors.length <= limit) return authors.join(", ");
  return `${authors.slice(0, limit).join(", ")} +${authors.length - limit}`;
}
