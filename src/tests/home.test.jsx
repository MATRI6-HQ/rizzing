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

  it('renders the RIZZING puzzle-piece logo in the header', () => {
    renderHome()
    // Header + empty-state both render the brand mark from /1.jpg.
    const logos = screen.getAllByAltText('RIZZING')
    expect(logos.length).toBeGreaterThan(0)
    expect(logos[0].getAttribute('src')).toBe('/1.jpg')
  })

  it('shows the empty state when matchStore is empty', () => {
    renderHome()
    expect(screen.getByText('No matches yet')).toBeInTheDocument()
  })

  // The empty state owns the primary action, so the corner FAB stands down there —
  // exactly one gold control on screen at a time.
  it('the empty state carries the primary add action', () => {
    renderHome()
    expect(screen.getByRole('button', { name: /Add your first match/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add match' })).not.toBeInTheDocument()
  })

  it('renders the corner FAB once there is at least one match', () => {
    useMatchStore.setState({ matches: [{ id: 'm1', name: 'Aisha' }] })
    renderHome()
    expect(screen.getByRole('button', { name: 'Add match' })).toBeInTheDocument()
  })

  it('renders a match card when matchStore has a match', () => {
    useMatchStore.setState({
      matches: [{ id: 'm1', name: 'Aisha', last_message_preview: null }],
    })
    renderHome()
    expect(screen.getByText('Aisha')).toBeInTheDocument()
  })
})
