/**
 * React Native exposes transport failures as platform-specific error strings.
 * Keep those implementation details out of the UI while preserving HTTP and
 * arXiv service errors as ordinary retryable failures.
 */
export function isOfflineFeedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return [
    "unknownhostexception",
    "unable to resolve host",
    "no address associated with hostname",
    "network request failed",
    "failed to fetch",
    "fetch failed",
    "enetunreach",
    "internet connection appears to be offline",
  ].some((fragment) => message.includes(fragment));
}
