import { create } from 'zustand'
import { supabase } from '../lib/supabase'

// Weights are floats in [0.1, 0.9]. Clamp on every update — never below 0.1 or above 0.9.
const WEIGHT_MIN = 0.1
const WEIGHT_MAX = 0.9
const clamp = (v) => Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, v))

// Initial state mirrors the personality_profiles table defaults, EXCEPT hinglish_ratio /
// emoji_frequency: those start null so "not loaded" and "not chosen" don't both render as
// a confidently-highlighted pill the user never picked. normalizeLanguage/normalizeEmoji
// turn a null into the unset state on screen.
const initialProfile = {
  confidence: 0.5,
  humor: 0.5,
  persistence: 0.5,
  emotional_tone: 0.5,
  escalation: 0.5,
  boldness: 0.5,
  sarcasm: 0.5,
  hinglish_ratio: null,
  emoji_frequency: null,
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
      // Never fail silently — a swallowed read is indistinguishable from an all-default row.
      console.warn('[profileStore] could not load personality_profiles:', error.message)
      set({ loading: false })
      throw error
    }
    if (data) set({ ...data, loading: false })
    else set({ loading: false })
    return data
  },

  /**
   * Persist a patch to personality_profiles and mirror it locally.
   * `.select()` is deliberate: without a returned row an RLS UPDATE rejection comes back
   * as a success with zero rows affected, which is exactly how a preference silently
   * fails to save. Throws so the caller can keep the draft and offer a retry.
   */
  savePatch: async (userId, patch) => {
    const { data, error } = await supabase
      .from('personality_profiles')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select()
      .maybeSingle()
    if (error) {
      console.warn('[profileStore] preference save failed:', error.message)
      throw error
    }
    if (!data) {
      console.warn('[profileStore] preference save affected 0 rows — check the UPDATE RLS policy')
      throw new Error('Could not save — no matching profile row')
    }
    set(data)
    return data
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
