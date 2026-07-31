import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// The screen navigates via useTransitionNavigate, which wraps React Router's navigate.
// Spy on the underlying one so assertions are about routes, not transitions.
const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockNavigate,
}))

// Auto-chaining Supabase stub. `updateSpy` captures the soft-delete payload; `db.result`
// is what every chain resolves to, so a test can flip it to an error mid-file.
const { updateSpy, db } = vi.hoisted(() => ({
  updateSpy: vi.fn(),
  db: { result: { data: [{ id: 'm1' }], error: null } },
}))
vi.mock('../lib/supabase', () => {
  const chain = {}
  ;['select', 'eq', 'order', 'insert', 'upsert', 'single'].forEach((m) => {
    chain[m] = () => chain
  })
  chain.update = (payload) => {
    updateSpy(payload)
    return chain
  }
  chain.then = (resolve) => resolve(db.result)
  return { supabase: { from: () => chain } }
})

import HomeScreen from '../screens/Home/HomeScreen'
import { useMatchStore } from '../store/matchStore'

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <HomeScreen />
    </MemoryRouter>,
  )
}

describe('HomeScreen', () => {
  beforeEach(() => {
    // No authenticated user in tests → the mount fetch is skipped, so the store
    // state we set here is what renders.
    useMatchStore.setState({ matches: [], activeMatch: null, loading: false })
    db.result = { data: [{ id: 'm1' }], error: null }
    vi.clearAllMocks()
  })

  // The header carries the RIZZING wordmark, not the puzzle-piece image mark. The
  // image still appears in the empty state as a hero illustration — a different job —
  // so this asserts the header specifically rather than "no img anywhere".
  it('renders the RIZZING wordmark in the header', () => {
    const { container } = renderHome()
    const wordmark = container.querySelector('header .wordmark')
    expect(wordmark).toBeInTheDocument()
    expect(wordmark).toHaveTextContent('RIZZING')
    expect(container.querySelector('header img')).not.toBeInTheDocument()
  })

  it('shows the empty state when matchStore is empty', () => {
    renderHome()
    expect(screen.getByText('No matches yet')).toBeInTheDocument()
  })

  // The footer's + is the single gold "add match" control on every state of the
  // screen, so the empty state's own CTA is a ghost button, not a second primary.
  it('the footer + is the add action in both the empty and populated states', () => {
    const { unmount } = renderHome()
    expect(screen.getByRole('button', { name: 'Add match' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Add your first match/ })).toBeInTheDocument()
    unmount()

    useMatchStore.setState({ matches: [{ id: 'm1', name: 'Aisha' }] })
    renderHome()
    expect(screen.getByRole('button', { name: 'Add match' })).toBeInTheDocument()
    // The empty-state CTA is gone; the footer + is the only way in.
    expect(screen.queryByRole('button', { name: /Add your first match/ })).not.toBeInTheDocument()
  })

  // Profile lives in the footer nav now — the header button that used to duplicate it
  // is gone, so there is exactly one route into /profile from Home.
  it('exposes Refer and Profile once each, in the footer nav', () => {
    renderHome()
    expect(screen.getByRole('button', { name: 'Refer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument()
  })

  it('renders a match card when matchStore has a match', () => {
    useMatchStore.setState({
      matches: [{ id: 'm1', name: 'Aisha', last_message_preview: null }],
    })
    renderHome()
    expect(screen.getByText('Aisha')).toBeInTheDocument()
  })

  // The + used to open the add-match sheet directly. It forks first now, because
  // "add someone I'm talking to" and "write an opener off a profile prompt" are two
  // different jobs sharing one button.
  describe('the + fork', () => {
    function openPlus() {
      renderHome()
      fireEvent.click(screen.getByRole('button', { name: 'Add match' }))
    }

    it('opens a two-option menu instead of the add-match sheet', () => {
      openPlus()
      expect(screen.getByText('Start new conversation')).toBeInTheDocument()
      expect(screen.getByText('Prompt replier')).toBeInTheDocument()
      // The add-match sheet is now behind the first option, not on the + itself.
      expect(screen.queryByPlaceholderText('Her name or nickname')).not.toBeInTheDocument()
    })

    it('"Start new conversation" opens the existing add-match sheet unchanged', () => {
      openPlus()
      fireEvent.click(screen.getByText('Start new conversation'))
      expect(screen.getByPlaceholderText('Her name or nickname')).toBeInTheDocument()
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('"Prompt replier" routes to the standalone screen', () => {
      openPlus()
      fireEvent.click(screen.getByText('Prompt replier'))
      expect(mockNavigate).toHaveBeenCalledWith('/prompt-replier')
    })
  })

  describe('deleting a conversation', () => {
    const AISHA = { id: 'm1', name: 'Aisha', last_message_preview: null }

    function renderWithMatch() {
      useMatchStore.setState({ matches: [AISHA] })
      return renderHome()
    }

    function confirmDelete() {
      fireEvent.click(screen.getByRole('menuitem', { name: /Delete conversation/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    }

    it('the kebab opens the card action menu', () => {
      renderWithMatch()
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'More options for Aisha' }))
      expect(screen.getByRole('menuitem', { name: /Delete conversation/ })).toBeInTheDocument()
    })

    // Right-click is the desktop-web entry point; the app ships web-first.
    it('right-clicking the card opens the same menu', () => {
      renderWithMatch()
      fireEvent.contextMenu(screen.getByText('Aisha').closest('.card-elevated'))
      expect(screen.getByRole('menuitem', { name: /Delete conversation/ })).toBeInTheDocument()
    })

    // The long-press fires while the finger is down; the lift produces a click that
    // would otherwise open the chat on top of the menu that just opened.
    it('a long press opens the menu and the release does not open the chat', () => {
      vi.useFakeTimers()
      try {
        renderWithMatch()
        const card = screen.getByText('Aisha').closest('.card-elevated')
        fireEvent.touchStart(card)
        act(() => {
          vi.advanceTimersByTime(600)
        })
        expect(screen.getByRole('menuitem', { name: /Delete conversation/ })).toBeInTheDocument()

        fireEvent.touchEnd(card)
        fireEvent.click(card)
        // The 3-mode entry sheet did NOT open.
        expect(screen.queryByText('How do you want to start?')).not.toBeInTheDocument()
      } finally {
        vi.useRealTimers()
      }
    })

    it('a short tap still opens the chat rather than the menu', () => {
      vi.useFakeTimers()
      try {
        renderWithMatch()
        const card = screen.getByText('Aisha').closest('.card-elevated')
        fireEvent.touchStart(card)
        act(() => {
          vi.advanceTimersByTime(120)
        })
        fireEvent.touchEnd(card)
        fireEvent.click(card)
        expect(screen.getByText('How do you want to start?')).toBeInTheDocument()
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      } finally {
        vi.useRealTimers()
      }
    })

    it('deleting requires a confirm step first', () => {
      renderWithMatch()
      fireEvent.click(screen.getByRole('button', { name: 'More options for Aisha' }))
      fireEvent.click(screen.getByRole('menuitem', { name: /Delete conversation/ }))
      // Nothing has been written yet — the dialog is the gate.
      expect(screen.getByRole('dialog', { name: 'Delete conversation' })).toBeInTheDocument()
      expect(updateSpy).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(updateSpy).not.toHaveBeenCalled()
      expect(useMatchStore.getState().matches).toHaveLength(1)
    })

    // is_active = false IS the soft delete in the deployed schema (there is no
    // soft_deleted column), and both list queries already filter is_active = true —
    // so the row survives and simply stops being fetched.
    it('confirming soft-deletes the row and drops the card from the list', async () => {
      renderWithMatch()
      fireEvent.click(screen.getByRole('button', { name: 'More options for Aisha' }))
      confirmDelete()

      await waitFor(() => expect(updateSpy).toHaveBeenCalledWith({ is_active: false }))
      expect(screen.queryByText('Aisha')).not.toBeInTheDocument()
      expect(useMatchStore.getState().matches).toHaveLength(0)
    })

    // PostgREST answers an RLS-rejected UPDATE with 2xx and zero rows, so "no error"
    // is not proof of a delete. Zero rows must roll the card back, not silently drop it.
    it('rolls the card back and explains itself when the update affects no rows', async () => {
      db.result = { data: [], error: null }
      renderWithMatch()
      fireEvent.click(screen.getByRole('button', { name: 'More options for Aisha' }))
      confirmDelete()

      await waitFor(() => expect(screen.getByText(/RLS policy/)).toBeInTheDocument())
      expect(useMatchStore.getState().matches).toEqual([AISHA])
      expect(screen.getByText('Aisha')).toBeInTheDocument()
    })

    it('rolls the card back on a Supabase error', async () => {
      db.result = { data: null, error: { message: 'network down' } }
      renderWithMatch()
      fireEvent.click(screen.getByRole('button', { name: 'More options for Aisha' }))
      confirmDelete()

      await waitFor(() => expect(screen.getByText('network down')).toBeInTheDocument())
      expect(useMatchStore.getState().matches).toEqual([AISHA])
    })
  })
})
