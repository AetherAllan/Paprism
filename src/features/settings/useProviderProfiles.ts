import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteProviderApiKey,
  getProviderApiKey,
  loadAskProviderId,
  loadProviderState,
  persistProviderState,
  persistAskProviderId,
  setProviderApiKey,
} from "./providers";
import {
  GOOGLE_PROFILE_ID,
  validateProfile,
  type ProviderProfile,
} from "./providerCore";

export function useProviderProfiles() {
  const [profiles, setProfiles] = useState<ProviderProfile[]>([]);
  const [activeProfileId, setActiveProfileIdState] = useState<string | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [activeAskProfileId, setActiveAskProfileIdState] = useState<
    string | null
  >(null);
  const [recoveryWarning, setRecoveryWarning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const state = await loadProviderState();
      let askProfileId: string | null = null;
      let askRecovered = false;
      try {
        askProfileId = await loadAskProviderId();
      } catch {
        // Ask is optional. A corrupt or unavailable preference must not revive
        // the permanent-loading failure this hook is designed to prevent.
        askRecovered = true;
      }
      if (cancelled) return;
      setProfiles(state.profiles);
      setActiveProfileIdState(state.activeProfileId);
      setActiveAskProfileIdState(
        state.profiles.some(
          (profile) =>
            profile.id === askProfileId && profile.id !== GOOGLE_PROFILE_ID,
        )
          ? askProfileId
          : null,
      );
      setRecoveryWarning(state.recovered || askRecovered);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveProfile = useCallback(
    async (profile: ProviderProfile, apiKey?: string) => {
      if (profile.id === GOOGLE_PROFILE_ID) return;
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
      if (profileId === GOOGLE_PROFILE_ID) return;
      const nextProfiles = profiles.filter((item) => item.id !== profileId);
      const nextActive =
        activeProfileId === profileId
          ? (nextProfiles[0]?.id ?? null)
          : activeProfileId;
      await deleteProviderApiKey(profileId);
      await persistProviderState({
        profiles: nextProfiles,
        activeProfileId: nextActive,
      });
      setProfiles(nextProfiles);
      setActiveProfileIdState(nextActive);
      if (activeAskProfileId === profileId) {
        await persistAskProviderId(null);
        setActiveAskProfileIdState(null);
      }
    },
    [activeAskProfileId, activeProfileId, profiles],
  );

  const setActiveProfileId = useCallback(
    async (profileId: string) => {
      await persistProviderState({ profiles, activeProfileId: profileId });
      setActiveProfileIdState(profileId);
    },
    [profiles],
  );
  const clearRecoveryWarning = useCallback(() => setRecoveryWarning(false), []);
  const setActiveAskProfileId = useCallback(async (profileId: string) => {
    if (profileId === GOOGLE_PROFILE_ID)
      throw new Error("Google Translate cannot answer Ask questions");
    await persistAskProviderId(profileId);
    setActiveAskProfileIdState(profileId);
  }, []);

  return {
    ready,
    recoveryWarning,
    clearRecoveryWarning,
    profiles,
    activeProfileId,
    activeAskProfileId,
    activeProfile: useMemo(
      () => profiles.find((profile) => profile.id === activeProfileId) ?? null,
      [activeProfileId, profiles],
    ),
    activeAskProfile: useMemo(
      () =>
        profiles.find((profile) => profile.id === activeAskProfileId) ?? null,
      [activeAskProfileId, profiles],
    ),
    saveProfile,
    deleteProfile,
    setActiveProfileId,
    setActiveAskProfileId,
    getApiKey: getProviderApiKey,
  };
}
