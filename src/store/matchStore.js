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

  /**
   * Soft-delete a match: drop it from the list immediately, then flip `is_active`.
   * There is no `soft_deleted` column — `is_active = false` IS the soft delete in the
   * deployed schema, and both list queries already filter `is_active = true`, so the
   * row stops appearing without ever being destroyed.
   *
   * Optimistic + rollback: the card vanishes on tap, and a failed write puts it back at
   * the SAME index (not by restoring the whole array — a concurrent add would be lost).
   *
   * `.select()` is not decoration. PostgREST answers an RLS-rejected UPDATE with 2xx and
   * zero rows, so without the returned row a missing policy is indistinguishable from a
   * successful delete — the card would disappear and reappear on the next fetch.
   */
  removeMatch: async (matchId) => {
    const index = get().matches.findIndex((m) => m.id === matchId)
    if (index === -1) return
    const removed = get().matches[index]
    set({ matches: get().matches.filter((m) => m.id !== matchId) })

    const { data, error } = await supabase
      .from('matches')
      .update({ is_active: false })
      .eq('id', matchId)
      .select('id')

    if (error || !data?.length) {
      const restored = get().matches.slice()
      restored.splice(index, 0, removed)
      set({ matches: restored })
      throw error ?? new Error('Could not delete — check the matches update RLS policy.')
    }
  },

  reset: () => set({ matches: [], activeMatch: null, loading: false }),
}))
