import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Spy on navigation without a real router history.
const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockNavigate,
}))

// Mock the auth lib so no real network calls happen.
vi.mock('../lib/auth', () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  resendVerification: vi.fn(),
  signInWithGoogle: vi.fn(),
}))

// Mocked separately from ../lib/auth: the "calls signInWithOAuth" test below reaches
// past the auth-lib mock with importActual, so the REAL signInWithGoogle has to land
// on a fake supabase client rather than a live OAuth redirect.
const { mockSignInWithOAuth } = vi.hoisted(() => ({ mockSignInWithOAuth: vi.fn() }))
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signInWithOAuth: mockSignInWithOAuth } },
}))

import { signIn, signUp, resendVerification, signInWithGoogle } from '../lib/auth'
import AuthScreen from '../screens/Auth/AuthScreen'
import CheckEmailScreen from '../screens/Auth/CheckEmailScreen'
import { useAuthStore } from '../store/authStore'

function renderAuth() {
  return render(
    <MemoryRouter initialEntries={['/auth']}>
      <AuthScreen />
    </MemoryRouter>,
  )
}

describe('AuthScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    renderAuth()
    expect(screen.getByRole('heading', { name: 'RIZZING' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
  })

  it('toggling to Sign Up mode shows the correct button text', () => {
    renderAuth()
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'New here? Create an account' }))
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign In' })).not.toBeInTheDocument()
  })

  it('shows an error message when signIn rejects', async () => {
    signIn.mockRejectedValueOnce(new Error('Invalid login credentials'))
    renderAuth()

    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'a@b.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'secret123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(screen.getByText('Invalid login credentials')).toBeInTheDocument()
    })
  })

  it('a signup that returns no session lands on "check your email", not Home', async () => {
    // "Confirm email" ON → signUp resolves with a user but session: null.
    signUp.mockResolvedValueOnce({ user: { id: 'u1' }, session: null })
    renderAuth()

    fireEvent.click(screen.getByRole('button', { name: 'New here? Create an account' }))
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/auth/check-email', {
      replace: true,
      state: { email: 'a@b.com' },
    }))
    // The old flow signed in straight after signUp — that would throw "Email not confirmed".
    expect(signIn).not.toHaveBeenCalled()
  })

  it('signing in on an unconfirmed account routes to the wall, not a raw error', async () => {
    // Supabase's real message for this case.
    signIn.mockRejectedValueOnce(new Error('Email not confirmed'))
    renderAuth()

    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/auth/check-email', {
        replace: true,
        state: { email: 'a@b.com' },
      }),
    )
    // A dead-end error string would leave them with no way to get a new link.
    expect(screen.queryByText('Email not confirmed')).not.toBeInTheDocument()
  })

  describe('Sign in with Google', () => {
    it('renders the Google button below the email form', () => {
      renderAuth()
      expect(screen.getByRole('button', { name: /Sign in with Google/i })).toBeEnabled()
    })

    it('clicking it starts the OAuth flow', async () => {
      signInWithGoogle.mockResolvedValueOnce({ provider: 'google', url: 'https://accounts.google.com/…' })
      renderAuth()

      fireEvent.click(screen.getByRole('button', { name: /Sign in with Google/i }))
      await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledTimes(1))
      // The email path must be untouched by the Google button.
      expect(signIn).not.toHaveBeenCalled()
      expect(signUp).not.toHaveBeenCalled()
    })

    it('surfaces a failure inline instead of leaving a dead button', async () => {
      signInWithGoogle.mockRejectedValueOnce(new Error('Unsupported provider'))
      renderAuth()

      fireEvent.click(screen.getByRole('button', { name: /Sign in with Google/i }))
      expect(await screen.findByText('Unsupported provider')).toBeInTheDocument()
      // Spinner cleared on failure, so they can retry.
      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Sign in with Google/i })).toBeEnabled(),
      )
    })

    it('stays busy after a successful hand-off (the page is about to navigate away)', async () => {
      // Resolve with a URL but never actually navigate — mirrors the real flow, where
      // the browser leaves before any post-await state update would matter.
      signInWithGoogle.mockResolvedValueOnce({ url: 'https://accounts.google.com/…' })
      renderAuth()

      fireEvent.click(screen.getByRole('button', { name: /Sign in with Google/i }))
      expect(await screen.findByText('Redirecting…')).toBeInTheDocument()
      // The email submit is locked out while the redirect is in flight.
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeDisabled()
    })
  })
})

// Exercises the real lib function against a mocked supabase client — the AuthScreen
// tests above mock ../lib/auth wholesale, so this is the only place the actual
// provider argument gets checked.
describe('signInWithGoogle (lib/auth)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls signInWithOAuth with provider 'google' and a /auth/callback redirect", async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({ data: { url: 'https://accounts.google.com/…' }, error: null })
    const actual = await vi.importActual('../lib/auth')

    await actual.signInWithGoogle()

    expect(mockSignInWithOAuth).toHaveBeenCalledTimes(1)
    const arg = mockSignInWithOAuth.mock.calls[0][0]
    expect(arg.provider).toBe('google')
    // The origin varies by environment (VITE_APP_URL, else window.location.origin), so
    // pin the route, not the host — and assert it is a real absolute URL, since the
    // "undefined/auth/callback" failure mode is exactly what the fallback exists to stop.
    expect(arg.options.redirectTo).toMatch(/^https?:\/\/.+\/auth\/callback$/)
    expect(arg.options.redirectTo).not.toContain('undefined')
  })

  it('throws when the provider call errors, so the UI can show it', async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({ data: null, error: new Error('Unsupported provider') })
    const actual = await vi.importActual('../lib/auth')

    await expect(actual.signInWithGoogle()).rejects.toThrow('Unsupported provider')
  })
})

// Mirrors RESEND_COOLDOWN_S in CheckEmailScreen.jsx.
const RESEND_COOLDOWN_S = 30

describe('CheckEmailScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.setState({ user: null, session: null })
  })

  function renderCheckEmail(email = 'a@b.com') {
    return render(
      <MemoryRouter initialEntries={[{ pathname: '/auth/check-email', state: { email } }]}>
        <CheckEmailScreen />
      </MemoryRouter>,
    )
  }

  it('shows the pending address and a resend button', () => {
    renderCheckEmail()
    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(screen.getByText('a@b.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resend verification email' })).toBeEnabled()
  })

  it('resend fires once then locks behind a 30s cooldown', async () => {
    resendVerification.mockResolvedValueOnce(undefined)
    renderCheckEmail()

    fireEvent.click(screen.getByRole('button', { name: 'Resend verification email' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Resend in 30s' })).toBeDisabled(),
    )
    expect(resendVerification).toHaveBeenCalledWith('a@b.com')

    fireEvent.click(screen.getByRole('button', { name: 'Resend in 30s' }))
    expect(resendVerification).toHaveBeenCalledTimes(1)
  })

  it('the cooldown expires after 30s and the button re-enables', async () => {
    vi.useFakeTimers()
    try {
      resendVerification.mockResolvedValue(undefined)
      renderCheckEmail()

      fireEvent.click(screen.getByRole('button', { name: 'Resend verification email' }))
      // Flush the resend promise so setCooldown(30) lands.
      await act(async () => {})
      expect(screen.getByRole('button', { name: 'Resend in 30s' })).toBeDisabled()

      // The countdown is a CHAIN: each tick's effect arms the next timeout. React's
      // act() defers commits to the end of its scope, so a single bulk advance fires
      // only tick 1 — the next timeout doesn't exist yet. One act per tick instead.
      for (let i = 0; i < RESEND_COOLDOWN_S; i++) {
        await act(async () => {
          vi.advanceTimersByTime(1000)
        })
      }

      const button = screen.getByRole('button', { name: 'Resend verification email' })
      expect(button).toBeEnabled()

      // And a second send actually goes through.
      fireEvent.click(button)
      await act(async () => {})
      expect(resendVerification).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
