import { create } from 'zustand'
import { supabase } from '../lib/supabase'

// Weights are floats in [0.1, 0.9]. Clamp on every update — never below 0.1 or above 0.9.
const WEIGHT_MIN = 0.1
const WEIGHT_MAX = 0.9
const clamp = (v) => Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, v))

// Initial state mirrors the personality_profiles table defaults exactly.
const initialProfile = {
  confidence: 0.5,
  humor: 0.5,
  persistence: 0.5,
  emotional_tone: 0.5,
  escalation: 0.5,
  boldness: 0.5,
  sarcasm: 0.5,
  hinglish_ratio: 'medium',
  emoji_frequency: 'sometimes',
  preferred_emojis: [],
  onboarding_responses: [],
  pick_history: { safe: 0, witty: 0, bold: 0, override: 0 },
  raw_overrides: [],
  onboarding_complete: false,
}

export const useProfileStore = create((set, get) => ({
  ...initialProfile,
  loading: false,

  /** Load the personality profile for a user (one row per user_id). */
  load: async (userId) => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('personality_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      set({ loading: false })
      throw error
    }
    if (data) set({ ...data, loading: false })
    else set({ loading: false })
  },

  /** Locally nudge a single weight with clamping. Caller syncs to DB separately. */
  nudgeWeight: (key, delta) => {
    const current = get()[key]
    if (typeof current !== 'number') return
    set({ [key]: clamp(current + delta) })
  },

  /** Reset back to schema defaults (e.g. on sign out). */
  reset: () => set({ ...initialProfile, loading: false }),
}))
