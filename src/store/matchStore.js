import { create } from 'zustand'
import { supabase } from '../lib/supabase'

// Matches list + the currently open match. Deletes are soft (is_active = false).
export const useMatchStore = create((set, get) => ({
  matches: [],
  activeMatch: null,
  loading: false,

  /** Load active matches for a user, most recently opened first. */
  loadMatches: async (userId) => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('last_opened', { ascending: false })
    if (error) {
      set({ loading: false })
      throw error
    }
    set({ matches: data ?? [], loading: false })
  },

  /** Create a new match and prepend it to the list. */
  addMatch: async ({ userId, name, platform = 'other' }) => {
    const { data, error } = await supabase
      .from('matches')
      .insert({ user_id: userId, name, platform })
      .select()
      .single()
    if (error) throw error
    set({ matches: [data, ...get().matches] })
    return data
  },

  setActiveMatch: (match) => set({ activeMatch: match }),

  /** Soft-delete: flip is_active and drop from the local list. */
  removeMatch: async (matchId) => {
    const { error } = await supabase
      .from('matches')
      .update({ is_active: false })
      .eq('id', matchId)
    if (error) throw error
    set({ matches: get().matches.filter((m) => m.id !== matchId) })
  },

  reset: () => set({ matches: [], activeMatch: null, loading: false }),
}))
