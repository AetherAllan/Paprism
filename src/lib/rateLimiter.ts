/**
 * Serializes async work with a minimum gap between starts.
 * arXiv ToU: ≤ 1 request every 3 seconds, single connection.
 */
export class RateLimiter {
  private chain: Promise<void> = Promise.resolve();
  private lastStart = 0;

  constructor(private readonly minIntervalMs: number) {}

  schedule<T>(fn: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const wait = Math.max(
        0,
        this.minIntervalMs - (Date.now() - this.lastStart),
      );
      if (wait > 0) {
        await sleep(wait);
      }
      this.lastStart = Date.now();
      return fn();
    };

    const result = this.chain.then(run, run);
    // Keep the queue moving even if one call fails.
    this.chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
