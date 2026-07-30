import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Vertical scroll container for the conversation thread, with WhatsApp-style
 * scroll ownership: the thread follows new content only while the user is already
 * at the bottom. The moment they scroll up to read history, new content must not
 * move the viewport under them — it offers a "jump to latest" pill instead.
 */

// How close to the bottom still counts as "pinned to the latest message". Absorbs
// sub-pixel rounding and the few px of slack a fling can leave behind, so a user who
// is visually at the bottom isn't treated as having scrolled away.
const NEAR_BOTTOM_PX = 48

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export default function ChatThread({ children, className = '', autoScrollKey }) {
  const ref = useRef(null)
  // Refs, not state: these are read inside the layout effect that runs on the SAME
  // commit as the content change. State would be a render behind and would auto-scroll
  // using the previous frame's answer.
  const pinnedRef = useRef(true)
  const firstPaintRef = useRef(true)
  const [showJump, setShowJump] = useState(false)

  const scrollToBottom = useCallback((behavior) => {
    const el = ref.current
    // jsdom (unit tests) doesn't implement scrollTo — feature-detect rather than skip.
    if (!el || typeof el.scrollTo !== 'function') return
    el.scrollTo({ top: el.scrollHeight, behavior })
    pinnedRef.current = true
    setShowJump(false)
  }, [])

  const handleScroll = useCallback(() => {
    const el = ref.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    pinnedRef.current = distanceFromBottom <= NEAR_BOTTOM_PX
    // Scrolling back down yourself dismisses the pill; scrolling up never summons it
    // on its own — it only appears when content actually arrives (below).
    if (pinnedRef.current) setShowJump(false)
  }, [])

  // useLayoutEffect, not useEffect: the initial jump must land BEFORE the browser
  // paints. With useEffect the thread paints scrolled to the top for one frame and
  // then visibly slides down — the "it scrolls into place on open" artefact.
  useLayoutEffect(() => {
    if (firstPaintRef.current) {
      firstPaintRef.current = false
      scrollToBottom('auto') // instant — opening a chat is not an animation
      return
    }
    if (pinnedRef.current) scrollToBottom('smooth')
    else setShowJump(true) // reading history: hold position, just offer the way back
  }, [autoScrollKey, scrollToBottom])

  // The on-screen keyboard resizes the visual viewport without firing scroll or resize
  // on the element, so a thread that was pinned ends up hidden behind the composer.
  // Re-pin on viewport change, but only if the user hadn't scrolled away.
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return
    const onViewportChange = () => {
      if (pinnedRef.current) scrollToBottom('auto')
    }
    vv.addEventListener('resize', onViewportChange)
    return () => vv.removeEventListener('resize', onViewportChange)
  }, [scrollToBottom])

  return (
    <div className="chat-thread-wrap">
      <div ref={ref} onScroll={handleScroll} className={`chat-thread ${className}`}>
        <div className="chat-thread__grain" aria-hidden="true" />
        <div className="chat-thread__content">{children}</div>
      </div>
      {showJump && (
        <button
          type="button"
          onClick={() => scrollToBottom('smooth')}
          className="press chat-jump"
          aria-label="Jump to latest message"
        >
          Latest
          <ChevronDownIcon />
        </button>
      )}
    </div>
  )
}
