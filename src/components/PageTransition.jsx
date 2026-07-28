import { useCallback } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'

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
 *
 * The data attribute is what stops the two animations from stacking. During a view
 * transition the root snapshot already runs page-enter; the freshly-keyed
 * .page-transition div inside it would run page-enter a second time, compounding
 * both the fade and the 10px slide into a 20px double-bounce. index.css keys off
 * [data-view-transition="active"] to mute the inner one for the duration.
 */
export function withViewTransition(update) {
  if (typeof document !== 'undefined' && document.startViewTransition) {
    const root = document.documentElement
    root.dataset.viewTransition = 'active'
    const transition = document.startViewTransition(() => flushSync(update))
    // `finished` also rejects if the transition is skipped (e.g. another one starts
    // mid-flight), so clear the flag on both paths or the app keeps its enter
    // animation muted forever.
    transition.finished.finally(() => {
      delete root.dataset.viewTransition
    })
  } else {
    update()
  }
}

/**
 * navigate() that plays the shared route transition. React Router's own navigate
 * swaps the tree synchronously, so the outgoing screen is gone before the incoming
 * one starts fading in — that one-frame gap is what reads as a hard cut. Routing
 * through withViewTransition cross-fades the two instead.
 *
 * Use for user-initiated navigation only. Auto-redirects that fire from an effect
 * (the auth guard, the post-confirm landing) must keep the plain useNavigate:
 * flushSync inside a lifecycle warns, and a redirect the user never asked for
 * shouldn't animate anyway.
 */
export function useTransitionNavigate() {
  const navigate = useNavigate()
  return useCallback((...args) => withViewTransition(() => navigate(...args)), [navigate])
}
