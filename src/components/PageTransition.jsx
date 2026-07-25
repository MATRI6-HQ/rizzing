import { flushSync } from 'react-dom'

/**
 * Fade + slight upward slide on enter (see .page-transition in index.css).
 * Changing `transitionKey` remounts the wrapper, which restarts the animation.
 */
export default function PageTransition({ transitionKey, className = '', children }) {
  return (
    <div key={transitionKey} className={`page-transition ${className}`}>
      {children}
    </div>
  )
}

/**
 * Wrap a state update so browsers with the View Transitions API also fade the
 * *outgoing* content out instead of snapping it away. flushSync is required —
 * startViewTransition snapshots the DOM when its callback returns, so the React
 * update has to be committed synchronously. Elsewhere it's a plain update and
 * only the enter animation plays.
 */
export function withViewTransition(update) {
  if (typeof document !== 'undefined' && document.startViewTransition) {
    document.startViewTransition(() => flushSync(update))
  } else {
    update()
  }
}
