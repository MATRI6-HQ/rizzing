import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Exercises the REAL guard (RequireAuth in App.jsx) against the REAL route table
// (routes.jsx). Only the leaf screens are stubbed — they have their own tests, and
// stubbing them keeps this file about routing decisions, not screen internals.
// CheckEmailScreen is deliberately NOT stubbed: the /auth/callback landing is part
// of the state machine under test here.
vi.mock('../screens/Home/HomeScreen', () => ({ default: () => <div>HOME</div> }))
vi.mock('../screens/Auth/AuthScreen', () => ({ default: () => <div>AUTH</div> }))
vi.mock('../screens/Onboarding/OnboardingFlow', () => ({
  default: () => <div>ONBOARDING</div>,
}))
vi.mock('../screens/Conversation/ConversationFlow', () => ({
  default: () => <div>CONVERSATION</div>,
}))
vi.mock('../screens/Profile/ProfileScreen', () => ({ default: () => <div>PROFILE</div> }))

import { AppRoutes } from '../App'
import { useAuthStore } from '../store/authStore'
import { useProfileStore } from '../store/profileStore'

const CONFIRMED = {
  user: { id: 'u1', email: 'a@b.com', email_confirmed_at: '2026-07-26T00:00:00Z' },
}
const UNCONFIRMED = { user: { id: 'u1', email: 'a@b.com', email_confirmed_at: null } }

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

/** Seed the auth store the way authStore.init would after a real session load. */
function setSession(session) {
  useAuthStore.setState({ session, user: session?.user ?? null, loading: false })
}

describe('RequireAuth — email verification gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSession(null)
    // Stub the network-backed profile load; onboarding_complete drives where a
    // confirmed user lands, so each test sets it explicitly.
    useProfileStore.setState({
      load: vi.fn().mockResolvedValue(undefined),
      onboarding_complete: true,
    })
  })

  it('no session → /auth', () => {
    renderAt('/')
    expect(screen.getByText('AUTH')).toBeInTheDocument()
    expect(screen.queryByText('HOME')).not.toBeInTheDocument()
  })

  it('session with email_confirmed_at null → blocked from Home, parked on the wall', () => {
    setSession(UNCONFIRMED)
    renderAt('/')
    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(screen.queryByText('HOME')).not.toBeInTheDocument()
  })

  it('session with email_confirmed_at null → blocked from ConversationFlow too', () => {
    setSession(UNCONFIRMED)
    renderAt('/conversation')
    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(screen.queryByText('CONVERSATION')).not.toBeInTheDocument()
  })

  it('confirmed session → Home renders', () => {
    setSession(CONFIRMED)
    renderAt('/')
    expect(screen.getByText('HOME')).toBeInTheDocument()
  })

  it('confirmed session → ConversationFlow renders', () => {
    setSession(CONFIRMED)
    renderAt('/conversation')
    expect(screen.getByText('CONVERSATION')).toBeInTheDocument()
  })

  it('the wall itself stays reachable with an unconfirmed session (no redirect loop)', () => {
    setSession(UNCONFIRMED)
    renderAt('/auth/check-email')
    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
  })
})

describe('/auth/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setSession(null)
    useProfileStore.setState({
      load: vi.fn().mockResolvedValue(undefined),
      onboarding_complete: true,
    })
  })

  it('confirmed session → routes to Home', async () => {
    setSession(CONFIRMED)
    renderAt('/auth/callback')
    await waitFor(() => expect(screen.getByText('HOME')).toBeInTheDocument())
  })

  it('confirmed session but onboarding incomplete → routes to onboarding, not Home', async () => {
    setSession(CONFIRMED)
    useProfileStore.setState({
      load: vi.fn().mockResolvedValue(undefined),
      onboarding_complete: false,
    })
    renderAt('/auth/callback')
    await waitFor(() => expect(screen.getByText('ONBOARDING')).toBeInTheDocument())
  })

  it('session present but still unconfirmed → bounced back to the wall', () => {
    setSession(UNCONFIRMED)
    renderAt('/auth/callback')
    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
  })

  it('no session (stale/used link) → shows Verifying, never leaks to Home', () => {
    renderAt('/auth/callback')
    expect(screen.getByText('Verifying…')).toBeInTheDocument()
    expect(screen.queryByText('HOME')).not.toBeInTheDocument()
  })
})
