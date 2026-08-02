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
 * Where Supabase should send the browser back to after an OAuth round-trip.
 *
 * VITE_APP_URL is the deliberate override (currently NOT set in .env — add it in Vercel
 * project settings if the redirect ever needs to differ from the serving origin);
 * `window.location.origin` is the fallback so a missing var degrades to "come back to
 * wherever we started" instead of the string "undefined/auth/callback", which Supabase
 * would reject as an unlisted redirect. Neither branch hardcodes a URL, so localhost,
 * a Vercel preview and rizzing.matri6.com all work off the same build.
 *
 * NOTE: whatever this resolves to must be listed under Auth → URL Configuration →
 * Redirect URLs in the Supabase dashboard, or the redirect silently falls back to
 * site_url. Since the app moved under /app, the listed URL is
 * https://rizzing.matri6.com/app/auth/callback — the old root-level one no longer exists.
 */
function oauthRedirectTo() {
  const origin = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '')
  // BASE_URL already carries the deploy's subpath ('/app/' on web, '/' under Capacitor and
  // in tests), so the callback tracks vite.config.js instead of hardcoding a second copy.
  return `${origin}${import.meta.env.BASE_URL}auth/callback`
}

/**
 * Start the Google OAuth flow. Resolves only far enough to hand the browser off —
 * signInWithOAuth navigates away, so nothing after this runs on success.
 *
 * Throws on failure to match signIn/signUp above: signInWithOAuth resolves with
 * `{ error }` rather than rejecting, and a caller that only awaited it would show a
 * dead button on a misconfigured provider instead of an error.
 */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: oauthRedirectTo() },
  })
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
