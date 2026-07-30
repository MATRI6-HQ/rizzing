import { useEffect, useState } from 'react'
import { useTransitionNavigate } from '../../components/PageTransition'
import { signIn, signUp, signInWithGoogle } from '../../lib/auth'
import { useAuthStore } from '../../store/authStore'
import { useProfileStore } from '../../store/profileStore'

// Plain inline SVGs — no icon library (per design rules).
function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 mx-auto text-black" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

// Same spinner geometry as above, in gold — the Google button is a dark outline
// button, so the black stroke that reads correctly on .btn-gold would vanish here.
function SpinnerGold() {
  return (
    <svg className="animate-spin h-5 w-5 text-gold" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

// Google's four-colour "G", inlined (no icon library, per design rules). The brand
// mark itself must keep Google's colours — their branding terms don't allow
// recolouring it — so this is the one place in the app that isn't on the RIZZING
// palette. Everything around it (border, fill, type) is.
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  )
}

export default function AuthScreen() {
  const navigate = useTransitionNavigate()
  const loadProfile = useProfileStore((s) => s.load)
  // authStore.init() (called in App.jsx) keeps the session in sync via onAuthChange.
  // Capture the session present at mount once, so the redirect below can't fire
  // off the post-mount session that an auto-confirm sign-up would create.
  const [initialSession] = useState(() => useAuthStore.getState().session)

  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // Kept separate from `loading` / `error` so a Google failure is reported under the
  // Google button rather than above the divider, where it would read as a form error.
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState('')

  const isSignup = mode === 'signup'

  // Already signed in and somehow on /auth? Send them onward.
  useEffect(() => {
    if (!initialSession) return
    if (!initialSession.user?.email_confirmed_at) {
      navigate('/auth/check-email', { replace: true })
      return
    }
    const onboardingComplete = useProfileStore.getState().onboarding_complete
    navigate(onboardingComplete ? '/' : '/onboarding', { replace: true })
  }, [initialSession, navigate])

  function toggleMode() {
    setMode(isSignup ? 'signin' : 'signup')
    setError('')
    setNotice('')
    setGoogleError('')
  }

  /**
   * On success this never returns — signInWithOAuth navigates the browser to Google.
   * So the spinner is deliberately NOT cleared on the happy path: the button stays
   * busy for the handful of frames before the page goes away, instead of flicking
   * back to its resting state and looking like the tap did nothing.
   */
  async function handleGoogle() {
    if (googleLoading || loading) return
    setGoogleError('')
    setError('')
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setGoogleError(err?.message ?? 'Could not reach Google. Try again.')
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (loading) return
    setError('')
    setNotice('')
    setLoading(true)
    try {
      if (isSignup) {
        const signUpData = await signUp(email, password)
        // No session back means "Confirm email" is on and the account is pending — the
        // password sign-in below would just fail with "Email not confirmed". Park them
        // on the verification wall instead.
        if (!signUpData?.session) {
          navigate('/auth/check-email', { replace: true, state: { email } })
          return
        }
        // Auto-confirm projects hand back a session immediately; sign in anyway so the
        // store holds a full, refreshable one.
        const data = await signIn(email, password)
        useAuthStore.setState({ session: data.session, user: data.user })
        const userId = data?.user?.id
        if (userId) {
          try {
            await loadProfile(userId)
          } catch {
            // Non-fatal: fall back to onboarding if the profile can't be read.
          }
        }
        const onboardingComplete = useProfileStore.getState().onboarding_complete
        navigate(onboardingComplete ? '/' : '/onboarding', { replace: true })
      } else {
        const data = await signIn(email, password)
        const userId = data?.user?.id
        if (userId) {
          try {
            await loadProfile(userId)
          } catch {
            // Non-fatal: fall back to onboarding if the profile can't be read.
          }
        }
        const onboardingComplete = useProfileStore.getState().onboarding_complete
        navigate(onboardingComplete ? '/' : '/onboarding', { replace: true })
      }
    } catch (err) {
      const msg = err?.message ?? 'Something went wrong'
      // Signing in before clicking the link is the common case, not an error worth
      // showing — send them somewhere with a Resend button.
      if (/not confirmed/i.test(msg)) {
        navigate('/auth/check-email', { replace: true, state: { email } })
        return
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ambient flex items-center justify-center">
      <div className="app-shell flex flex-col items-center justify-center px-6 py-12">
        {/* Brand */}
        <div className="flex flex-col items-center mb-10">
          <img
            src="/1.jpg"
            alt="RIZZING"
            className="w-20 h-20 rounded-xl object-cover border border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
          />
          <h1 className="mt-5 text-gold font-display font-bold tracking-[0.2em] text-4xl">RIZZING</h1>
          <p className="mt-2 text-text-secondary text-xs tracking-[0.15em] uppercase opacity-40">
            Your move, your vibe.
          </p>
          {isSignup && (
            <span className="mt-3 text-[10px] tracking-widest bg-gold/10 text-gold border border-gold/20 rounded-full px-3 py-1 mx-auto">
              NEW
            </span>
          )}
        </div>

        {/* Mode heading */}
        <h2 className="font-display text-2xl text-text-primary mb-6">
          {isSignup ? 'Create your account' : 'Welcome back'}
        </h2>

        {/* Form */}
        {/* w-full: the form was shrink-to-fit (its width came from the longest label,
            ~285px in a 440px shell), so the full-width divider and Google button below
            it did not line up. Everything in the column is one width now. */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input-rizzing"
          />

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-rizzing"
              style={{ paddingRight: '44px' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:opacity-70 transition-opacity cursor-pointer"
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>

          <button type="submit" disabled={loading || googleLoading} className="btn-gold lift-gold">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner />
                {isSignup ? 'Signing up...' : 'Signing in...'}
              </span>
            ) : isSignup ? (
              'Create Account'
            ) : (
              'Sign In'
            )}
          </button>

          {error && <p className="text-red-400 text-xs tracking-wide text-center">{error}</p>}
          {notice && <p className="text-safe text-xs text-center">{notice}</p>}

          <button
            type="button"
            onClick={toggleMode}
            className="press text-gold text-sm tracking-wide text-center no-underline mt-1 hover:opacity-80 active:opacity-60 transition-opacity duration-150 cursor-pointer"
          >
            {isSignup ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </button>
        </form>

        {/* Divider — hairline rules in the app's border token, not a Tailwind gray. */}
        <div className="w-full flex items-center gap-3 my-5" aria-hidden="true">
          <span className="h-px flex-1 bg-bg-border" />
          <span className="text-[11px] tracking-[0.18em] uppercase text-text-muted">or</span>
          <span className="h-px flex-1 bg-bg-border" />
        </div>

        {/* Google — a quiet outline button on purpose. .btn-gold is the screen's one
            primary; a second gold button would make the two sign-in paths compete. */}
        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
          className="press btn-google"
        >
          {googleLoading ? (
            <>
              <SpinnerGold />
              <span>Redirecting…</span>
            </>
          ) : (
            <>
              <GoogleIcon />
              <span>Sign in with Google</span>
            </>
          )}
        </button>

        {googleError && (
          <p className="text-red-400 text-xs tracking-wide text-center mt-3">{googleError}</p>
        )}
      </div>
    </div>
  )
}
