import { useCallback, useEffect, useState } from "react";
import type { EmbeddingProfile } from "./askTypes";
import {
  clearEmbeddingProfile,
  getEmbeddingApiKey,
  loadEmbeddingProfile,
  saveEmbeddingProfile,
} from "./embeddingProviders";

export function useEmbeddingProfile() {
  const [profile, setProfile] = useState<EmbeddingProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadEmbeddingProfile().then((loaded) => {
      if (!cancelled) {
        setProfile(loaded);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async (next: EmbeddingProfile, apiKey?: string) => {
    await saveEmbeddingProfile(next, apiKey);
    setProfile(next);
  }, []);
  const clear = useCallback(async () => {
    await clearEmbeddingProfile();
    setProfile(null);
  }, []);

  return { ready, profile, save, clear, getApiKey: getEmbeddingApiKey };
}
