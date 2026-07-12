let tail: Promise<void> = Promise.resolve();

/**
 * AsyncStorage writes are cheap and infrequent in this app, so one process-wide
 * queue is safer than allowing an older write to finish after a newer one.
 * ponytail: split this by storage key only if write throughput becomes measurable.
 */
export function enqueueStorageWrite(write: () => Promise<void>): Promise<void> {
  const result = tail.then(write, write);
  tail = result.catch(() => undefined);
  return result;
}
