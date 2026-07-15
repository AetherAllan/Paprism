import { describe, expect, test } from "bun:test";
import {
  normalizeModels,
  OPENROUTER_BASE_URL,
  searchModels,
  validateProfile,
  type ProviderProfile,
} from "./providerCore";

const profile: ProviderProfile = {
  id: "p1",
  name: "OpenRouter",
  kind: "openrouter",
  baseUrl: OPENROUTER_BASE_URL,
  model: "model/free:free",
};

describe("provider configuration", () => {
  test("requires HTTPS and locks the OpenRouter endpoint", () => {
    expect(validateProfile(profile)).toBeNull();
    expect(
      validateProfile({ ...profile, baseUrl: "http://example.com/v1" }),
    ).toBe("Endpoint must use HTTPS");
    expect(
      validateProfile({ ...profile, baseUrl: "https://example.com/v1" }),
    ).toBe("OpenRouter endpoint cannot be changed");
  });

  test("puts free OpenRouter models first without inventing generic pricing", () => {
    const payload = {
      data: [
        { id: "paid/model", name: "Paid", pricing: { prompt: "0.1" } },
        { id: "unknown/model", name: "Unknown" },
        { id: "free/model:free", name: "Free", pricing: { prompt: "0" } },
        {
          id: "image/model:free",
          name: "Image only",
          pricing: { prompt: "0", completion: "0" },
          architecture: {
            input_modalities: ["text"],
            output_modalities: ["image"],
          },
        },
      ],
    };
    expect(
      normalizeModels(payload, "openrouter").map((model) => model.id),
    ).toEqual(["free/model:free", "paid/model", "unknown/model"]);
    expect(
      normalizeModels(payload, "openai-compatible").every(
        (model) => !model.free,
      ),
    ).toBe(true);
  });

  test("searches model names, slugs and providers", () => {
    const models = normalizeModels(
      { data: [{ id: "google/gemini-free", name: "Gemini Flash" }] },
      "openrouter",
    );
    expect(searchModels(models, "google")).toHaveLength(1);
    expect(searchModels(models, "flash")).toHaveLength(1);
    expect(searchModels(models, "missing")).toHaveLength(0);
  });
});
