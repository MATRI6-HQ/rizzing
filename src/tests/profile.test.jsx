import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../lib/supabase', () => {
  const chain = {}
  ;['select', 'eq', 'update', 'upsert'].forEach((m) => {
    chain[m] = () => chain
  })
  chain.then = (resolve) => resolve({ data: null, error: null })
  return { supabase: { from: () => chain } }
})

import ProfileScreen from '../screens/Profile/ProfileScreen'
import { useAuthStore } from '../store/authStore'
import { useProfileStore } from '../store/profileStore'

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <ProfileScreen />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAuthStore.setState({ user: { id: 'u1', email: 'dweep@example.com' }, session: {} })
  useProfileStore.setState({
    full_name: 'Dweep',
    confidence: 0.7,
    humor: 0.6,
    persistence: 0.4,
    emotional_tone: 0.5,
    escalation: 0.8,
    boldness: 0.9,
    sarcasm: 0.3,
    hinglish_ratio: 'medium',
    emoji_frequency: 'sometimes',
    preferred_emojis: ['🔥', '😂'],
  })
})

describe('ProfileScreen', () => {
  it('renders the persona axes, account email, and preferences', () => {
    renderProfile()
    expect(screen.getByText('Your rizz persona')).toBeInTheDocument()
    for (const axis of ['Confidence', 'Humor', 'Persistence', 'Emotional tone', 'Escalation', 'Boldness', 'Sarcasm']) {
      expect(screen.getByText(axis)).toBeInTheDocument()
    }
    expect(screen.getAllByText('dweep@example.com').length).toBeGreaterThan(0)
    expect(screen.getByText('Free · ad-supported')).toBeInTheDocument()
  })

  it('opens the Terms & Privacy sheet', () => {
    renderProfile()
    fireEvent.click(screen.getByText('Terms & Privacy →'))
    expect(screen.getByText('Terms & Privacy')).toBeInTheDocument()
    expect(screen.getByText(/RIZZING helps you craft better replies/)).toBeInTheDocument()
  })

  it('editing a preference updates the local store', () => {
    renderProfile()
    fireEvent.click(screen.getByText('Hinglish'))
    expect(useProfileStore.getState().hinglish_ratio).toBe('high')
  })
})
