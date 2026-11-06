import { afterEach, describe, expect, test } from "bun:test";
import type { ProviderProfile } from "@/features/settings/providerCore";
import {
  buildChatRequestBody,
  requestChat,
  shouldRetryWithoutStreaming,
  waitForProvider,
} from "./askClient";

const openRouter: ProviderProfile = {
  id: "or",
  name: "OpenRouter",
  kind: "openrouter",
  baseUrl: "https://openrouter.ai/api/v1",
  model: "openai/gpt-5-mini",
};

describe("Ask streaming cancellation", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("aborting after headers cancels the body and stops reading", async () => {
    let cancelled = false;
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"choices":[{"delta":{"content":"partial"}}]}\n',
          ),
        );
      },
      cancel() {
        cancelled = true;
      },
    });
    globalThis.fetch = (async () =>
      new Response(body)) as unknown as typeof fetch;

    const abort = new AbortController();
    const received: string[] = [];
    const request = requestChat(
      openRouter,
      "key",
      "context",
      false,
      abort.signal,
      (text) => {
        received.push(text);
        abort.abort();
      },
    );

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    expect(received).toEqual(["partial"]);
    expect(cancelled).toBe(true);
  });
});

describe("Ask chat request", () => {
  test("enables the capped server web-search tool only for OpenRouter", () => {
    const enabled = buildChatRequestBody(
      openRouter,
      "question",
      true,
      false,
    ) as {
      tools?: unknown[];
    };
    expect(enabled.tools).toEqual([
      {
        type: "openrouter:web_search",
        parameters: { max_results: 3, max_total_results: 9 },
      },
    ]);

    const compatible = buildChatRequestBody(
      { ...openRouter, kind: "openai-compatible" },
      "question",
      true,
      false,
    ) as { tools?: unknown[] };
    expect(compatible.tools).toBeUndefined();
  });

  test("requests streaming without provider-specific usage metadata", () => {
    expect(buildChatRequestBody(openRouter, "q", true, true)).toHaveProperty(
      "stream",
      true,
    );
    expect(
      buildChatRequestBody(openRouter, "q", true, true),
    ).not.toHaveProperty("stream_options");
    expect(
      buildChatRequestBody(openRouter, "q", false, false),
    ).not.toHaveProperty("tools");
  });

  test("retries only when the endpoint explicitly rejects streaming", () => {
    expect(
      shouldRetryWithoutStreaming(400, "stream_options is not supported"),
    ).toBe(true);
    expect(shouldRetryWithoutStreaming(401, "invalid API key")).toBe(false);
    expect(shouldRetryWithoutStreaming(429, "rate limited")).toBe(false);
    expect(shouldRetryWithoutStreaming(400, "model is invalid")).toBe(false);
  });

  test("stops waiting for a provider that never produces a response", async () => {
    let timedOut = false;
    const never = new Promise<string>(() => undefined);
    await expect(
      waitForProvider(never, 5, "provider stalled", () => {
        timedOut = true;
      }),
    ).rejects.toThrow("provider stalled");
    expect(timedOut).toBe(true);
  });
});
