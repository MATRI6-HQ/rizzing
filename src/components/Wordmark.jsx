/**
 * The RIZZING wordmark — the brand's header identity, replacing the puzzle-piece
 * image mark (`/1.jpg`) that used to sit in Home's top bar.
 *
 * It lives in one file because it is now rendered by more than one screen (Home,
 * Refer) and a wordmark that drifts between screens stops reading as a brand. The
 * type treatment is Playfair (`font-display`) + tracked caps to match the display
 * moments elsewhere in the app; gold is the brand accent.
 *
 * Deliberately NOT a link/button: the header on both screens is a passive
 * identity strip, and a tappable logo that goes to the page you are already on is
 * a dead control.
 */
export default function Wordmark({ className = '' }) {
  return (
    <span className={`wordmark ${className}`} aria-label="RIZZING">
      RIZZING
    </span>
  )
}
