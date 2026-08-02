import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { resendVerification, signOut } from '../../lib/auth'
import { LOGO_SRC } from '../../lib/assets'
import { useAuthStore } from '../../store/authStore'
import { useProfileStore } from '../../store/profileStore'

// Both halves of the email-verification gate live here — they're one feature and the
// callback is ~15 lines. Default export = the "check your email" wall (/auth/check-email);
// named export AuthCallback = the link target (/auth/callback).

const RESEND_COOLDOWN_S = 30

/** Where a confirmed user belongs: onboarding until the profile says it's done. */
async function landAfterConfirm(userId, navigate) {
  try {
    await useProfileStore.getState().load(userId)
  } catch {
    // Non-fatal: fall back to onboarding if the profile can't be read.
  }
  navigate(useProfileStore.getState().onboarding_complete ? '/' : '/onboarding', { replace: true })
}

export default function CheckEmailScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  // Signup passes the address through router state; the route guard has no state but
  // does have a (still-unconfirmed) session to read it off.
  const email = location.state?.email ?? user?.email ?? ''

  const [cooldown, setCooldown] = useState(0)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Confirmed in another tab? authStore.onAuthChange pushes it here — move them along.
  useEffect(() => {
    if (user?.email_confirmed_at) landAfterConfirm(user.id, navigate)
  }, [user, navigate])

  useEffect(() => {
    if (cooldown === 0) return
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function handleResend() {
    if (cooldown > 0 || sending || !email) return
    setError('')
    setNotice('')
    setSending(true)
    try {
      await resendVerification(email)
      setNotice('Sent. Check your inbox again.')
      setCooldown(RESEND_COOLDOWN_S)
    } catch (err) {
      setError(err?.message ?? 'Could not resend right now')
    } finally {
      setSending(false)
    }
  }

  async function handleBack() {
    // Drop the unconfirmed session so /auth doesn't bounce them straight back here.
    try {
      await signOut()
    } catch {
      // Already signed out — nothing to undo.
    }
    navigate('/auth', { replace: true })
  }

  return (
    <div className="min-h-screen bg-ambient flex items-center justify-center">
      <div className="app-shell flex flex-col items-center justify-center px-6 py-12">
        <img
          src={LOGO_SRC}
          alt="RIZZING"
          className="w-16 h-16 rounded-xl object-cover border border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
        />

        <h1 className="mt-8 font-display text-2xl text-text-primary text-center">
          Check your email
        </h1>
        <p className="mt-3 text-text-secondary text-sm leading-relaxed text-center">
          We sent a verification link to
        </p>
        <p className="mt-1 text-gold text-sm break-all text-center">{email || 'your inbox'}</p>
        <p className="mt-4 text-text-muted text-[11px] leading-relaxed text-center">
          Tap the link to activate your account, then come back here. Check spam if it hasn&apos;t
          landed in a minute.
        </p>

        <div className="w-full mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || sending || !email}
            className="btn-gold lift-gold"
          >
            {cooldown > 0
              ? `Resend in ${cooldown}s`
              : sending
                ? 'Sending...'
                : 'Resend verification email'}
          </button>

          {error && <p className="text-red-400 text-xs tracking-wide text-center">{error}</p>}
          {notice && <p className="text-safe text-xs text-center">{notice}</p>}

          <button
            type="button"
            onClick={handleBack}
            className="press text-gold text-sm tracking-wide text-center hover:opacity-80 transition-opacity duration-150 cursor-pointer"
          >
            Back to sign in
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * /auth/callback — the Supabase redirect target. supabase.js sets detectSessionInUrl,
 * so the client has already swallowed the token from the URL and authStore.onAuthChange
 * has pushed the session in. All that's left is to route on the result.
 */
export function AuthCallback() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (user?.email_confirmed_at) landAfterConfirm(user.id, navigate)
  }, [user, navigate])

  // A stale or already-used link never produces a session — don't spin forever.
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 5000)
    return () => clearTimeout(t)
  }, [])

  if (user && !user.email_confirmed_at) return <Navigate to="/auth/check-email" replace />

  return (
    <div className="min-h-screen bg-ambient flex flex-col items-center justify-center gap-4 px-6">
      {timedOut && !user ? (
        <>
          <p className="text-text-secondary text-sm text-center">
            That link has expired or was already used.
          </p>
          <button
            type="button"
            onClick={() => navigate('/auth', { replace: true })}
            className="press text-gold text-sm tracking-wide cursor-pointer"
          >
            Back to sign in
          </button>
        </>
      ) : (
        <span className="text-gold font-display">Verifying…</span>
      )}
    </div>
  )
}
