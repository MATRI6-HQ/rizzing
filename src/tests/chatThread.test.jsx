import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ChatThread from '../components/ChatThread'

// jsdom implements none of the scroll geometry, so we drive it by hand. These stand in
// for a thread taller than its viewport: 1000px of content in a 400px window.
const metrics = { scrollHeight: 1000, clientHeight: 400, scrollTop: 600 }
const scrollTo = vi.fn()

beforeAll(() => {
  const define = (prop, extra = {}) =>
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get: () => metrics[prop],
      ...extra,
    })
  define('scrollHeight')
  define('clientHeight')
  define('scrollTop', { set: (v) => { metrics.scrollTop = v } })
  // Must exist before mount — the initial jump feature-detects it.
  HTMLElement.prototype.scrollTo = scrollTo
})

beforeEach(() => {
  scrollTo.mockClear()
  // 1000 - 600 - 400 = 0px from the bottom → pinned.
  metrics.scrollTop = 600
})

const thread = (key, text = 'hi') => (
  <ChatThread autoScrollKey={key}>
    <p>{text}</p>
  </ChatThread>
)

/** Put the user 500px up from the bottom and let the component observe it. */
function scrollUp(container) {
  metrics.scrollTop = 100 // 1000 - 100 - 400 = 500px from bottom
  fireEvent.scroll(container.querySelector('.chat-thread'))
}

describe('ChatThread scroll behaviour', () => {
  it('lands at the bottom on open, without an animation', () => {
    render(thread('a'))
    // 'auto' not 'smooth': opening a chat should already be at the bottom on first
    // paint, not scroll down after it.
    expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'auto' })
  })

  it('follows new content smoothly while the user is at the bottom', () => {
    const { rerender } = render(thread('a'))
    scrollTo.mockClear()

    rerender(thread('b', 'new message'))
    expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' })
    expect(screen.queryByRole('button', { name: /jump to latest/i })).toBeNull()
  })

  it('does NOT yank the user down when they have scrolled up to read history', () => {
    const { container, rerender } = render(thread('a'))
    scrollUp(container)
    scrollTo.mockClear()

    rerender(thread('b', 'new message'))

    // The whole point: their position is left alone.
    expect(scrollTo).not.toHaveBeenCalled()
    // ...and they're offered a way back instead.
    expect(screen.getByRole('button', { name: /jump to latest/i })).toBeInTheDocument()
  })

  it('the jump affordance returns to the bottom and dismisses itself', () => {
    const { container, rerender } = render(thread('a'))
    scrollUp(container)
    rerender(thread('b', 'new message'))
    scrollTo.mockClear()

    fireEvent.click(screen.getByRole('button', { name: /jump to latest/i }))

    expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'smooth' })
    expect(screen.queryByRole('button', { name: /jump to latest/i })).toBeNull()
  })

  it('re-pins to the newest message when the keyboard resizes the viewport', () => {
    const listeners = {}
    window.visualViewport = {
      addEventListener: (e, fn) => { listeners[e] = fn },
      removeEventListener: () => {},
    }
    render(thread('a'))
    scrollTo.mockClear()

    listeners.resize() // keyboard opens
    expect(scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'auto' })
    delete window.visualViewport
  })

  it('leaves scroll position alone on viewport resize if the user scrolled up', () => {
    const listeners = {}
    window.visualViewport = {
      addEventListener: (e, fn) => { listeners[e] = fn },
      removeEventListener: () => {},
    }
    const { container } = render(thread('a'))
    scrollUp(container)
    scrollTo.mockClear()

    listeners.resize()
    expect(scrollTo).not.toHaveBeenCalled()
    delete window.visualViewport
  })
})
