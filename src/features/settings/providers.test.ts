import { beforeEach, describe, expect, mock, test } from "bun:test";

const asyncValues = new Map<string, string>();
const secureValues = new Map<string, string>();

mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => asyncValues.get(key) ?? null,
    setItem: async (key: string, value: string) => void asyncValues.set(key, value),
    removeItem: async (key: string) => void asyncValues.delete(key),
  },
}));
mock.module("expo-secure-store", () => ({
  getItemAsync: async (key: string) => secureValues.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => void secureValues.set(key, value),
  deleteItemAsync: async (key: string) => void secureValues.delete(key),
}));
mock.module("expo-file-system/legacy", () => ({
  documentDirectory: null,
  getInfoAsync: async () => ({ exists: false }),
  makeDirectoryAsync: async () => undefined,
  readAsStringAsync: async () => "",
  writeAsStringAsync: async () => undefined,
}));

const { persistProviderState, setProviderApiKey } = await import("./providers");

describe("provider secret ownership", () => {
  beforeEach(() => {
    asyncValues.clear();
    secureValues.clear();
  });

  test("stores API keys only in SecureStore", async () => {
    await setProviderApiKey("profile-1", "secret-value");
    await persistProviderState({
      activeProfileId: "profile-1",
      profiles: [
        {
          id: "profile-1",
          name: "OpenRouter",
          kind: "openrouter",
          baseUrl: "https://openrouter.ai/api/v1",
          model: "free/model:free",
        },
      ],
    });

    expect([...secureValues.values()]).toEqual(["secret-value"]);
    expect([...asyncValues.values()].join(" ")).not.toContain("secret-value");
  });
});
