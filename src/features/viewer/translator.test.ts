import { afterEach, describe, expect, test } from "bun:test";
import {
  GOOGLE_PROFILE,
  OPENROUTER_BASE_URL,
  type ProviderProfile,
} from "@/features/settings/providerCore";
import { isRetryableTranslationError, translateBlocks } from "./translator";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("native reader translation client", () => {
  test("retries only transient provider failures", () => {
    expect(isRetryableTranslationError(new Error("Translation HTTP 429"))).toBe(
      true,
    );
    expect(
      isRetryableTranslationError(
        new Error("Provider returned no text response"),
      ),
    ).toBe(true);
    expect(isRetryableTranslationError(new Error("Translation HTTP 401"))).toBe(
      false,
    );
    expect(
      isRetryableTranslationError(
        new Error("Translation result does not match the active document"),
      ),
    ).toBe(false);
  });

  test("sends section context once and reserves enough model output tokens", async () => {
    let requestBody: Record<string, unknown> | null = null;
    globalThis.fetch = (async (_url, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  '{"translations":[{"id":"a::0","text":"甲"},{"id":"b::0","text":"乙"}]}',
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const profile: ProviderProfile = {
      id: "or",
      name: "OpenRouter",
      kind: "openrouter",
      baseUrl: OPENROUTER_BASE_URL,
      model: "test/free:free",
    };
    const results = await translateBlocks(
      profile,
      "secret",
      "zh-CN",
      [
        {
          id: "a",
          text: "First paragraph.",
          context: { paperTitle: "Paper", sectionTitle: "Methods" },
        },
        {
          id: "b",
          text: "Second paragraph.",
          context: {
            paperTitle: "Paper",
            sectionTitle: "Methods",
            previousText: "First paragraph.",
          },
        },
      ],
      new AbortController().signal,
    );

    expect(results).toEqual([
      { id: "a", text: "甲" },
      { id: "b", text: "乙" },
    ]);
    const sent = requestBody as unknown as {
      max_tokens: number;
      reasoning: { effort: string };
      messages: { content: string }[];
    };
    expect(sent.max_tokens).toBe(4096);
    expect(sent.reasoning).toEqual({ effort: "none" });
    const messages = sent.messages;
    const input = JSON.parse(messages[1]!.content) as Record<string, unknown>;
    expect(input.context).toEqual({
      paperTitle: "Paper",
      sectionTitle: "Methods",
    });
    expect(JSON.stringify(input).match(/paperTitle/g)).toHaveLength(1);
  });

  test("retries once with a larger budget when the provider truncates JSON", async () => {
    const budgets: number[] = [];
    globalThis.fetch = (async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { max_tokens: number };
      budgets.push(body.max_tokens);
      const truncated = budgets.length === 1;
      return new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: truncated ? "length" : "stop",
              message: {
                content: truncated
                  ? '{"translations":['
                  : '{"translations":[{"id":"a::0","text":"完整译文"}]}',
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const profile: ProviderProfile = {
      id: "or",
      name: "OpenRouter",
      kind: "openrouter",
      baseUrl: OPENROUTER_BASE_URL,
      model: "test/free:free",
    };
    const results = await translateBlocks(
      profile,
      "secret",
      "zh-CN",
      [{ id: "a", text: "A paragraph." }],
      new AbortController().signal,
    );

    expect(budgets).toEqual([4096, 8192]);
    expect(results).toEqual([{ id: "a", text: "完整译文" }]);
  });

  test("retries one empty provider response", async () => {
    let calls = 0;
    globalThis.fetch = (async (_url, _init) => {
      calls += 1;
      return new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: {
                content:
                  calls === 1
                    ? null
                    : '{"translations":[{"id":"a::0","text":"重试成功"}]}',
              },
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const profile: ProviderProfile = {
      id: "or",
      name: "OpenRouter",
      kind: "openrouter",
      baseUrl: OPENROUTER_BASE_URL,
      model: "test/free:free",
    };
    const results = await translateBlocks(
      profile,
      "secret",
      "zh-CN",
      [{ id: "a", text: "A paragraph." }],
      new AbortController().signal,
    );

    expect(calls).toBe(2);
    expect(results).toEqual([{ id: "a", text: "重试成功" }]);
  });

  test("batches Google paragraphs and keeps protected markers", async () => {
    let requestUrl = "";
    let source = "";
    globalThis.fetch = (async (url, init) => {
      requestUrl = String(url);
      source = new URLSearchParams(String(init?.body)).get("q") ?? "";
      return new Response(
        JSON.stringify([
          [
            [
              "译文 [[AT_MATH_0]]\n[[AT_BLOCK_0_END]]\n第二段\n[[AT_BLOCK_1_END]]",
              source,
            ],
          ],
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const results = await translateBlocks(
      GOOGLE_PROFILE,
      null,
      "zh-CN",
      [
        { id: "a", text: "Value [[AT_MATH_0]]." },
        { id: "b", text: "Second paragraph." },
      ],
      new AbortController().signal,
    );

    expect(requestUrl).toContain("tl=zh-CN");
    expect(source).toContain("[[AT_BLOCK_0_END]]");
    expect(results).toEqual([
      { id: "a", text: "译文 [[AT_MATH_0]]" },
      { id: "b", text: "第二段" },
    ]);
  });
});
