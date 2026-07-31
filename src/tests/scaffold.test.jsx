import { describe, it, expect } from 'vitest'
import tailwindConfig from '../../tailwind.config.js'
import { ROUTES } from '../routes'
import { useAuthStore } from '../store/authStore'
import { useProfileStore } from '../store/profileStore'
import { useMatchStore } from '../store/matchStore'

describe('scaffold', () => {
  it('Supabase client initializes without throwing', async () => {
    const mod = await import('../lib/supabase')
    expect(mod.supabase).toBeDefined()
    expect(typeof mod.supabase.auth).toBe('object')
    expect(typeof mod.supabase.from).toBe('function')
  })

  it('authStore initializes with user: null and session: null', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.session).toBeNull()
  })

  it('profileStore initializes with onboarding_complete: false', () => {
    const state = useProfileStore.getState()
    expect(state.onboarding_complete).toBe(false)
  })

  it('matchStore initializes with matches as empty array', () => {
    const state = useMatchStore.getState()
    expect(Array.isArray(state.matches)).toBe(true)
    expect(state.matches).toHaveLength(0)
  })

  it('All 9 routes are defined in the router', () => {
    const paths = ROUTES.map((r) => r.path)
    expect(ROUTES).toHaveLength(9)
    expect(paths).toEqual(
      expect.arrayContaining([
        '/auth',
        '/auth/check-email',
        '/auth/callback',
        '/onboarding',
        '/',
        '/conversation',
        '/prompt-replier',
        '/profile',
        '/refer',
      ]),
    )
  })

  it('the email-verification routes are unprotected (guard redirects into them)', () => {
    const gate = ROUTES.filter((r) => r.path.startsWith('/auth/'))
    expect(gate).toHaveLength(2)
    expect(gate.every((r) => r.protected === false)).toBe(true)
  })

  it('Tailwind config contains the gold token (#D4A843)', () => {
    expect(tailwindConfig.theme.extend.colors.gold).toBe('#D4A843')
  })
})
