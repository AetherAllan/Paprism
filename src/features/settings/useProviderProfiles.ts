import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteProviderApiKey,
  getProviderApiKey,
  loadProviderState,
  persistProviderState,
  setProviderApiKey,
} from "./providers";
import { validateProfile, type ProviderProfile } from "./providerCore";

export function useProviderProfiles() {
  const [profiles, setProfiles] = useState<ProviderProfile[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadProviderState().then((state) => {
      if (cancelled) return;
      setProfiles(state.profiles);
      setActiveProfileIdState(state.activeProfileId);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveProfile = useCallback(
    async (profile: ProviderProfile, apiKey?: string) => {
      const error = validateProfile(profile);
      if (error) throw new Error(error);
      const nextProfiles = [
        ...profiles.filter((item) => item.id !== profile.id),
        profile,
      ];
      const nextActive = activeProfileId ?? profile.id;
      if (apiKey?.trim()) await setProviderApiKey(profile.id, apiKey);
      await persistProviderState({
        profiles: nextProfiles,
        activeProfileId: nextActive,
      });
      setProfiles(nextProfiles);
      setActiveProfileIdState(nextActive);
    },
    [activeProfileId, profiles],
  );

  const deleteProfile = useCallback(
    async (profileId: string) => {
      const nextProfiles = profiles.filter((item) => item.id !== profileId);
      const nextActive =
        activeProfileId === profileId
          ? nextProfiles[0]?.id ?? null
          : activeProfileId;
      await deleteProviderApiKey(profileId);
      await persistProviderState({
        profiles: nextProfiles,
        activeProfileId: nextActive,
      });
      setProfiles(nextProfiles);
      setActiveProfileIdState(nextActive);
    },
    [activeProfileId, profiles],
  );

  const setActiveProfileId = useCallback(
    async (profileId: string) => {
      await persistProviderState({ profiles, activeProfileId: profileId });
      setActiveProfileIdState(profileId);
    },
    [profiles],
  );

  return {
    ready,
    profiles,
    activeProfileId,
    activeProfile: useMemo(
      () => profiles.find((profile) => profile.id === activeProfileId) ?? null,
      [activeProfileId, profiles],
    ),
    saveProfile,
    deleteProfile,
    setActiveProfileId,
    getApiKey: getProviderApiKey,
  };
}
