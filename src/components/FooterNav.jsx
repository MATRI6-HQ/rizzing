import { useTransitionNavigate } from './PageTransition'

// ── Inline icons (this codebase has no icon library — every icon is hand-rolled) ──
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

function PlusIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
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
 * The three-slot bottom nav shared by Home and Refer: Refer · + · Profile.
 *
 * The centre `+` is the ONE gold control on the screen (the app's standing rule is
 * exactly one gold thing to press at a time) — which is why Home's corner
 * `.fab-extended` was retired when this arrived rather than kept alongside it.
 * The two flanking items are muted icon+label buttons so the `+` stays the focal
 * point without needing to shout.
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

  return (
    <nav className="footer-nav shrink-0" aria-label="Primary">
      <button
        type="button"
        onClick={() => navigate('/refer')}
        aria-current={active === 'refer' ? 'page' : undefined}
        className={`press footer-nav__item ${active === 'refer' ? 'is-active' : ''}`}
      >
        <GiftIcon />
        <span className="footer-nav__label">Refer</span>
      </button>

      <button
        type="button"
        onClick={onAdd}
        aria-label="Add match"
        className="press footer-nav__plus"
      >
        <PlusIcon />
      </button>

      <button
        type="button"
        onClick={() => navigate('/profile')}
        aria-current={active === 'profile' ? 'page' : undefined}
        className={`press footer-nav__item ${active === 'profile' ? 'is-active' : ''}`}
      >
        <PersonIcon />
        <span className="footer-nav__label">Profile</span>
      </button>
    </nav>
  )
}
