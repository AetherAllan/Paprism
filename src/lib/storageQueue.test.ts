import { describe, expect, test } from "bun:test";
import { enqueueStorageWrite } from "./storageQueue";

describe("enqueueStorageWrite", () => {
  test("finishes writes in the order they were queued", async () => {
    const events: string[] = [];
    let releaseFirst!: () => void;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = enqueueStorageWrite(async () => {
      events.push("first:start");
      await firstBlocked;
      events.push("first:end");
    });
    const second = enqueueStorageWrite(async () => {
      events.push("second");
    });

    await Promise.resolve();
    expect(events).toEqual(["first:start"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(events).toEqual(["first:start", "first:end", "second"]);
  });

  test("continues after a failed write", async () => {
    await expect(
      enqueueStorageWrite(async () => {
        throw new Error("expected");
      }),
    ).rejects.toThrow("expected");

    let completed = false;
    await enqueueStorageWrite(async () => {
      completed = true;
    });
    expect(completed).toBe(true);
  });
});
