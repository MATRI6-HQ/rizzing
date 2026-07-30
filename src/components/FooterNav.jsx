import { useEffect, useState } from 'react'
import { useTransitionNavigate } from './PageTransition'

// How long the "Coming soon" toast stays up. Matches ConversationFlow's TOAST_DURATION_MS.
const TOAST_MS = 1800

// ── Inline icons (this codebase has no icon library — every icon is hand-rolled) ──
function HomeIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  )
}

// Profile Enhancer — a wand + sparks. Reads as "make this better" rather than the
// generic star that would collide with a favourites/rating affordance.
function EnhancerIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20L14.5 9.5" />
      <path d="M12.5 7.5l4 4" />
      <path d="M17 3v3M20.5 4.5l-1.5 1.5M21 9h-3" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function GiftIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="9" width="18" height="12" rx="2" />
      <path d="M3 13h18M12 9v12" />
      <path d="M12 9S10.5 4 8 4a2.2 2.2 0 000 5zM12 9s1.5-5 4-5a2.2 2.2 0 010 5z" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  )
}

/**
 * The five-slot bottom nav shared by Home and Refer:
 * Home · Enhancer · (+) · Refer · Profile.
 *
 * The centre `+` is the ONE gold control on the screen (the app's standing rule is
 * exactly one gold thing to press at a time) — which is why Home's corner
 * `.fab-extended` was retired when this arrived rather than kept alongside it. The
 * four flanking items are muted icon+label buttons so the `+` stays the focal point
 * without needing to shout; the current route's item goes gold-on-flat, never filled,
 * for the same reason.
 *
 * `onAdd` is a prop rather than a route because "add match" is a bottom-sheet on
 * Home, not a page. Refer has no add flow of its own, so it hands Home's route the
 * job via `?add=1` (see ReferPage) instead of duplicating the sheet.
 *
 * Rendered as a normal flex sibling inside `.app-shell`, NOT `position: fixed`.
 * The shell is a centred 440px column, so a fixed bar would have to re-derive that
 * width and centring by hand; as a flex child it inherits both for free and can't
 * drift out of alignment with the column.
 */
export default function FooterNav({ active, onAdd }) {
  const navigate = useTransitionNavigate()
  const [toast, setToast] = useState('')

  // Clear on unmount too — navigating away mid-toast would otherwise setState on a
  // dead component.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), TOAST_MS)
    return () => clearTimeout(t)
  }, [toast])

  // Every non-centre slot is the same shape, so build them from a list rather than
  // five near-identical JSX blocks that can drift apart.
  const items = [
    { key: 'home', label: 'Home', icon: <HomeIcon />, onClick: () => navigate('/') },
    {
      key: 'enhancer',
      label: 'Enhancer',
      icon: <EnhancerIcon />,
      // Not built yet. Left tappable on purpose: a disabled control gives no feedback
      // at all on touch, so a tap would read as the app being broken rather than as
      // the feature being unfinished.
      onClick: () => setToast('Coming soon'),
    },
    { key: 'refer', label: 'Refer', icon: <GiftIcon />, onClick: () => navigate('/refer') },
    { key: 'profile', label: 'Profile', icon: <PersonIcon />, onClick: () => navigate('/profile') },
  ]

  const renderItem = (item) => (
    <button
      key={item.key}
      type="button"
      onClick={item.onClick}
      aria-current={active === item.key ? 'page' : undefined}
      className={`press footer-nav__item ${active === item.key ? 'is-active' : ''}`}
    >
      {item.icon}
      <span className="footer-nav__label">{item.label}</span>
    </button>
  )

  return (
    <>
      <nav className="footer-nav shrink-0" aria-label="Primary">
        {items.slice(0, 2).map(renderItem)}

        <button
          type="button"
          onClick={onAdd}
          aria-label="Add match"
          className="press footer-nav__plus"
        >
          <PlusIcon />
        </button>

        {items.slice(2).map(renderItem)}
      </nav>

      {toast && (
        <div className="toast-rizzing" role="status">
          {toast}
        </div>
      )}
    </>
  )
}
