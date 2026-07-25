import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Records that the user accepted the Terms & Privacy Policy: which version and when.
// Persisted to localStorage so a mid-onboarding drop-off still leaves proof of consent;
// the same {version, acceptedAt} is also folded into personality_profiles.onboarding_responses
// when the profile is saved (see OnboardingFlow.finish), giving a server-side copy too.
export const useConsentStore = create(
  persist(
    (set) => ({
      accepted: false,
      version: null,
      acceptedAt: null,

      accept: (version) =>
        set({ accepted: true, version, acceptedAt: new Date().toISOString() }),

      reset: () => set({ accepted: false, version: null, acceptedAt: null }),
    }),
    { name: 'rizzing-consent' },
  ),
)
