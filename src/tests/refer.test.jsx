import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ReferPage from '../screens/Refer/ReferPage'
import { ROUTES } from '../routes'

function renderRefer() {
  return render(
    <MemoryRouter initialEntries={['/refer']}>
      <ReferPage />
    </MemoryRouter>,
  )
}

describe('ReferPage', () => {
  it('is registered as a protected route', () => {
    const route = ROUTES.find((r) => r.path === '/refer')
    expect(route).toBeDefined()
    // Referrals are tied to an account, so the page sits behind the auth guard.
    expect(route.protected).toBe(true)
  })

  it('renders the shared header wordmark', () => {
    const { container } = renderRefer()
    const wordmark = container.querySelector('header .wordmark')
    expect(wordmark).toBeInTheDocument()
    expect(wordmark).toHaveTextContent('RIZZING')
  })

  it('carries the same three-slot footer nav as Home', () => {
    renderRefer()
    expect(screen.getByRole('button', { name: 'Refer' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add match' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument()
  })

  it('marks Refer as the current page in the nav', () => {
    renderRefer()
    expect(screen.getByRole('button', { name: 'Refer' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Profile' })).not.toHaveAttribute('aria-current')
  })

  // Scaffold only — the referral mechanics are pending. This asserts the page is
  // deliberately empty rather than half-built, so nobody ships invented copy.
  it('has no referral content yet beyond the title', () => {
    renderRefer()
    expect(screen.getByRole('heading', { name: 'Refer' })).toBeInTheDocument()
    expect(screen.queryByText(/invite/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/reward/i)).not.toBeInTheDocument()
  })
})
