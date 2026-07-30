import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Mutable result so a test can decide what the next Supabase round-trip resolves to —
// the save-failure path needs an error, the save-success path needs a row back.
const { db } = vi.hoisted(() => ({
  db: { next: { data: null, error: null, count: 0 } },
}))

vi.mock('../lib/supabase', () => {
  const chain = {}
  ;['select', 'eq', 'update', 'upsert', 'insert', 'order', 'single', 'maybeSingle'].forEach(
    (m) => {
      chain[m] = () => chain
    },
  )
  chain.then = (resolve) => resolve(db.next)
  return { supabase: { from: () => chain } }
})

import ProfileScreen from '../screens/Profile/ProfileScreen'
import { useAuthStore } from '../store/authStore'
import { useProfileStore } from '../store/profileStore'
import { useMatchStore } from '../store/matchStore'

const SAVED_ROW = {
  hinglish_ratio: 'mix',
  emoji_frequency: 'sometimes',
}

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <ProfileScreen />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  db.next = { data: null, error: null, count: 0 }
  useAuthStore.setState({ user: { id: 'u1', email: 'dweep@example.com' }, session: {} })
  useMatchStore.setState({ matches: [], activeMatch: null, loading: false })
  useProfileStore.setState({
    full_name: 'Dweep',
    confidence: 0.7,
    humor: 0.6,
    persistence: 0.4,
    emotional_tone: 0.5,
    escalation: 0.8,
    boldness: 0.9,
    sarcasm: 0.3,
    hinglish_ratio: 'mix',
    emoji_frequency: 'sometimes',
    preferred_emojis: ['🔥', '😂'],
    pick_history: { safe: 2, witty: 5, bold: 3, override: 0 },
  })
})

describe('ProfileScreen', () => {
  it('leads with the derived archetype and renders the radar', () => {
    renderProfile()
    // boldness 0.9 + escalation 0.8 is the top pair → The Closer.
    expect(screen.getByText('The Closer')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Persona radar/ })).toBeInTheDocument()
  })

  it('keeps the numeric axes behind "See breakdown"', () => {
    renderProfile()
    expect(screen.queryByText('Persistence')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('See breakdown'))
    // getAllByText: three of the seven names are shared with the radar's own axis labels.
    for (const axis of ['Confidence', 'Humor', 'Persistence', 'Emotional tone', 'Escalation', 'Boldness', 'Sarcasm']) {
      expect(screen.getAllByText(axis).length).toBeGreaterThan(0)
    }
  })

  it('shows the forming panel instead of a flat all-50 radar', () => {
    useProfileStore.setState({
      confidence: 0.5, humor: 0.5, persistence: 0.5, emotional_tone: 0.5,
      escalation: 0.5, boldness: 0.5, sarcasm: 0.5,
    })
    renderProfile()
    expect(screen.getByText('Your persona is still forming')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Persona radar/ })).not.toBeInTheDocument()
  })

  it('renders the tone mix from pick_history', () => {
    renderProfile()
    // 5 of 10 picks were witty.
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('Top tone')).toBeInTheDocument()
  })

  describe('preferences — draft / save / discard', () => {
    it('shows the three language options: English, Hindi, Mix', () => {
      renderProfile()
      for (const label of ['English', 'Hindi', 'Mix']) {
        expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
      }
      // The redundant "Hinglish" option is gone.
      expect(screen.queryByRole('button', { name: 'Hinglish' })).not.toBeInTheDocument()
    })

    it('reads a legacy stored value onto the right pill', () => {
      useProfileStore.setState({ hinglish_ratio: 'high' })
      renderProfile()
      expect(screen.getByRole('button', { name: 'Hindi' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('renders an unset preference with no pill selected and a prompt', () => {
      useProfileStore.setState({ emoji_frequency: null })
      renderProfile()
      expect(screen.getByText('Not set yet — pick one.')).toBeInTheDocument()
      for (const label of ['Rarely', 'Sometimes', 'A lot']) {
        expect(screen.getByRole('button', { name: label })).toHaveAttribute('aria-pressed', 'false')
      }
    })

    it('a tap edits draft state only — the store is untouched until Save', () => {
      renderProfile()
      fireEvent.click(screen.getByRole('button', { name: 'Hindi' }))
      expect(useProfileStore.getState().hinglish_ratio).toBe('mix')
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
    })

    it('Save changes persists and confirms', async () => {
      renderProfile()
      fireEvent.click(screen.getByRole('button', { name: 'Hindi' }))
      db.next = { data: { ...SAVED_ROW, hinglish_ratio: 'hindi' }, error: null }
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

      expect(await screen.findByText('Preferences saved')).toBeInTheDocument()
      expect(useProfileStore.getState().hinglish_ratio).toBe('hindi')
      // Save bar clears once the draft matches what's stored.
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument(),
      )
    })

    it('Discard reverts the draft to the saved value', () => {
      renderProfile()
      fireEvent.click(screen.getByRole('button', { name: 'Hindi' }))
      fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
      expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Mix' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('a failed save keeps the draft and shows a retryable error', async () => {
      renderProfile()
      fireEvent.click(screen.getByRole('button', { name: 'Hindi' }))
      db.next = { data: null, error: { message: 'network is down' } }
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('network is down')
      // Draft survives so the user can retry rather than redo the edit.
      expect(screen.getByRole('button', { name: 'Hindi' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
    })

    it('leaving with unsaved changes asks first', () => {
      renderProfile()
      fireEvent.click(screen.getByRole('button', { name: 'Hindi' }))
      fireEvent.click(screen.getByRole('button', { name: 'Back to home' }))
      expect(screen.getByRole('dialog', { name: /Unsaved/ })).toBeInTheDocument()
      expect(screen.getByText(/Save before leaving\?/)).toBeInTheDocument()
      // Cancel puts them back where they were, edit intact.
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
    })

    it('leaving with no unsaved changes does not interrupt', () => {
      renderProfile()
      fireEvent.click(screen.getByRole('button', { name: 'Back to home' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('go-to emojis', () => {
    it('shows the saved emojis and a count, with the grid collapsed', () => {
      renderProfile()
      expect(screen.getByText('🔥 😂')).toBeInTheDocument()
      expect(screen.getByText('2 / 5')).toBeInTheDocument()
      // The 20-tile grid stays behind Edit so it can't dominate the Preferences card.
      expect(screen.queryByRole('button', { name: '💀' })).not.toBeInTheDocument()
    })

    it('Edit opens the grid and a tap only marks the draft dirty', () => {
      renderProfile()
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
      fireEvent.click(screen.getByRole('button', { name: '💀' }))

      expect(screen.getByRole('button', { name: '💀' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByText('3 / 5')).toBeInTheDocument()
      // Same draft-first contract as the pills: nothing is written until Save.
      expect(useProfileStore.getState().preferred_emojis).toEqual(['🔥', '😂'])
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
    })

    it('tapping a selected emoji removes it', () => {
      renderProfile()
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
      fireEvent.click(screen.getByRole('button', { name: '🔥' }))
      expect(screen.getByText('1 / 5')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '🔥' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('caps the selection at 5 by disabling the unpicked tiles', () => {
      useProfileStore.setState({ preferred_emojis: ['😂', '🔥', '💀', '😅', '😏'] })
      renderProfile()
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

      expect(screen.getByRole('button', { name: '❤️' })).toBeDisabled()
      // Picked tiles stay live so the user can swap one out.
      expect(screen.getByRole('button', { name: '🔥' })).not.toBeDisabled()
      expect(screen.getByText(/That's all 5/)).toBeInTheDocument()
    })

    it('Save persists preferred_emojis as an ordered array', async () => {
      renderProfile()
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
      fireEvent.click(screen.getByRole('button', { name: '💀' }))

      db.next = { data: { ...SAVED_ROW, preferred_emojis: ['🔥', '😂', '💀'] }, error: null }
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

      expect(await screen.findByText('Preferences saved')).toBeInTheDocument()
      expect(useProfileStore.getState().preferred_emojis).toEqual(['🔥', '😂', '💀'])
    })

    it('Discard reverts the emoji draft', () => {
      renderProfile()
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
      fireEvent.click(screen.getByRole('button', { name: '💀' }))
      fireEvent.click(screen.getByRole('button', { name: 'Discard' }))

      expect(screen.getByText('2 / 5')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
    })

    it('renders the empty case honestly rather than guessing emojis', () => {
      useProfileStore.setState({ preferred_emojis: [] })
      renderProfile()
      expect(screen.getByText("None picked — we'll leave emojis out.")).toBeInTheDocument()
      expect(screen.getByText('0 / 5')).toBeInTheDocument()
    })
  })

  describe('support contact', () => {
    it('exposes hq@matri6.com with the user email in the subject', () => {
      renderProfile()
      const link = screen.getAllByRole('link', { name: /matri6/ })[0]
      const href = link.getAttribute('href')
      expect(href).toContain('mailto:hq@matri6.com')
      expect(href).toContain(encodeURIComponent('RIZZING Support — dweep@example.com'))
      expect(screen.getByText(/we reply within 48 hours/)).toBeInTheDocument()
    })

    it('offers a Need help? link alongside Terms & Privacy', () => {
      renderProfile()
      expect(screen.getByRole('link', { name: 'Need help?' })).toBeInTheDocument()
    })
  })

  it('opens the Terms & Privacy sheet', () => {
    renderProfile()
    fireEvent.click(screen.getByText('Terms & Privacy →'))
    expect(screen.getByText('Terms & Privacy')).toBeInTheDocument()
    expect(screen.getByText(/RIZZING helps you craft better replies/)).toBeInTheDocument()
  })

  // The P0 bug: /profile trusted a Zustand store only ever hydrated at sign-in, so a
  // reload showed every axis at the 0.5 default (a flat 50) no matter what the DB held.
  it('re-fetches the profile from Supabase on mount', async () => {
    db.next = {
      data: { confidence: 0.82, humor: 0.4, persistence: 0.4, emotional_tone: 0.4,
        escalation: 0.4, boldness: 0.4, sarcasm: 0.4, hinglish_ratio: 'english' },
      error: null,
    }
    renderProfile()
    await waitFor(() => expect(useProfileStore.getState().confidence).toBe(0.82))
  })
})
