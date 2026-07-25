import { create } from 'zustand'
import { getSession, signIn, signOut, signUp, onAuthChange } from '../lib/auth'

// Holds the Supabase user session. Initialised on app start; kept in sync via onAuthChange.
export const useAuthStore = create((set) => ({
  user: null,
  session: null,
  loading: true,

  /** Load the existing session at app start and subscribe to changes. */
  init: async () => {
    const session = await getSession()
    set({ session, user: session?.user ?? null, loading: false })
    onAuthChange((_event, newSession) => {
      set({ session: newSession, user: newSession?.user ?? null })
    })
  },

  signUp: async (email, password) => {
    const data = await signUp(email, password)
    set({ session: data.session, user: data.user })
    return data
  },

  signIn: async (email, password) => {
    const data = await signIn(email, password)
    set({ session: data.session, user: data.user })
    return data
  },

  signOut: async () => {
    await signOut()
    set({ session: null, user: null })
  },
}))
