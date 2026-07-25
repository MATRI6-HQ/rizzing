import { supabase } from './supabase'

// All auth logic lives here so swapping email → phone OTP at launch is one file.
// Current provider: Supabase email + password.

/**
 * Create a new account with email + password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('@supabase/supabase-js').AuthResponse['data']>}
 */
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error
  return data
}

/**
 * Sign in an existing user with email + password.
 * @param {string} email
 * @param {string} password
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

/**
 * Re-send the signup confirmation email. Supabase silently no-ops for an address that
 * is already confirmed, so the UI can call this without leaking account existence.
 * @param {string} email
 */
export async function resendVerification(email) {
  const { error } = await supabase.auth.resend({ type: 'signup', email })
  if (error) throw error
}

/** Sign the current user out. */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/**
 * Get the current session (null if signed out).
 * @returns {Promise<import('@supabase/supabase-js').Session | null>}
 */
export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session
}

/**
 * Subscribe to auth state changes. Returns the unsubscribe function.
 * @param {(event: string, session: import('@supabase/supabase-js').Session | null) => void} callback
 */
export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange(callback)
  return () => data.subscription.unsubscribe()
}
