import { useEffect, useRef } from 'react'

/**
 * Vertical scroll container shared by the scenario screens and ConversationFlow.
 * Auto-scrolls to the newest child whenever the thread's content changes size.
 */
export default function ChatThread({ children, className = '', autoScrollKey }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    // jsdom (unit tests) doesn't implement scrollTo — feature-detect rather than skip.
    if (!el || typeof el.scrollTo !== 'function') return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [autoScrollKey])

  return (
    <div ref={ref} className={`chat-thread ${className}`}>
      <div className="chat-thread__grain" aria-hidden="true" />
      <div className="chat-thread__content">{children}</div>
    </div>
  )
}
