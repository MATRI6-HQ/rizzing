import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// The nav navigates via useTransitionNavigate, which wraps React Router's navigate.
// Spy on the underlying one so the assertions are about routes, not transitions.
const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => mockNavigate,
}))

import FooterNav from '../components/FooterNav'

function renderNav(props = {}) {
  return render(
    <MemoryRouter>
      <FooterNav active="home" onAdd={() => {}} {...props} />
    </MemoryRouter>,
  )
}

describe('FooterNav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders five slots in order: Home, Enhancer, Add, Refer, Profile', () => {
    const { container } = renderNav()
    const labels = [...container.querySelectorAll('.footer-nav__item')].map((b) =>
      b.textContent.trim(),
    )
    expect(labels).toEqual(['Home', 'Enhancer', 'Refer', 'Profile'])
    // The centre + is not a labelled item — it sits between Enhancer and Refer.
    const plus = screen.getByRole('button', { name: 'Add match' })
    expect(plus).toBeInTheDocument()
    expect(plus.className).toContain('footer-nav__plus')
  })

  it.each([
    ['Home', '/'],
    ['Refer', '/refer'],
    ['Profile', '/profile'],
  ])('%s navigates to %s', (label, path) => {
    renderNav()
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(mockNavigate).toHaveBeenCalledWith(path)
  })

  it('Add calls the handler it was given rather than navigating', () => {
    const onAdd = vi.fn()
    renderNav({ onAdd })
    fireEvent.click(screen.getByRole('button', { name: 'Add match' }))
    expect(onAdd).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('Profile Enhancer shows a "Coming soon" toast and goes nowhere', () => {
    renderNav()
    expect(screen.queryByText('Coming soon')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Enhancer' }))

    expect(screen.getByRole('status')).toHaveTextContent('Coming soon')
    expect(mockNavigate).not.toHaveBeenCalled()
    // Left tappable on purpose — a disabled button gives no touch feedback at all.
    expect(screen.getByRole('button', { name: 'Enhancer' })).toBeEnabled()
  })

  it('the toast clears itself', () => {
    vi.useFakeTimers()
    try {
      renderNav()
      fireEvent.click(screen.getByRole('button', { name: 'Enhancer' }))
      expect(screen.getByRole('status')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it.each(['home', 'refer', 'profile', 'enhancer'])(
    'marks the %s slot as the current page',
    (active) => {
      const { container } = renderNav({ active })
      const current = container.querySelectorAll('[aria-current="page"]')
      // Exactly one item is ever current, and it's the one carrying .is-active.
      expect(current).toHaveLength(1)
      expect(current[0].className).toContain('is-active')
    },
  )

  it('marks nothing current on a route the nav does not own', () => {
    const { container } = renderNav({ active: 'conversation' })
    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(0)
  })
})
