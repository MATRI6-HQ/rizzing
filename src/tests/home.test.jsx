import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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
})
