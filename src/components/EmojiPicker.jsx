/**
 * Go-to emoji picker — a fixed grid of common emojis, tap to toggle, capped at
 * MAX_EMOJIS.
 *
 * No dependency. An emoji picker library ships a searchable index of ~1,800
 * emojis plus sprite sheets, which is a large amount of weight to add to an APK
 * for a field whose whole job is "pick up to five of the ones you actually use".
 * A native `<input>` + system emoji keyboard was the other zero-dependency
 * option, but it can't enforce the cap, can't dedupe, and lets any text through —
 * so the value written to `preferred_emojis` (text[]) would need validating
 * anyway. A closed grid makes every one of those problems impossible by
 * construction.
 *
 * Values are stored as a `text[]`, so this component's contract is a plain array
 * of strings and it never mutates the one it is given.
 */

export const MAX_EMOJIS = 5

// The 20 that actually turn up in Indian dating-app chat. Order is roughly
// most-used first, so the common picks are reachable without scanning the grid.
export const EMOJI_GRID = [
  '😂', '🔥', '💀', '😅', '😏',
  '❤️', '😍', '🥺', '😭', '🙃',
  '👀', '💯', '✨', '😌', '🤔',
  '😉', '🫠', '🙌', '😎', '🤡',
]

export default function EmojiPicker({ value, onChange }) {
  const selected = value ?? []
  const full = selected.length >= MAX_EMOJIS

  function toggle(emoji) {
    if (selected.includes(emoji)) {
      onChange(selected.filter((e) => e !== emoji))
      return
    }
    // Silently ignoring the tap would look broken; the button is disabled instead
    // (see `full` below) so the cap is visible before it is hit.
    if (full) return
    onChange([...selected, emoji])
  }

  return (
    <div>
      <div className="grid grid-cols-5 gap-2">
        {EMOJI_GRID.map((emoji) => {
          const isSelected = selected.includes(emoji)
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => toggle(emoji)}
              // Disabling unselected tiles once full keeps the cap self-evident:
              // the grid greys out and the only live tiles are the ones you can
              // remove. aria-pressed carries the state for screen readers.
              disabled={full && !isSelected}
              aria-pressed={isSelected}
              aria-label={emoji}
              className={`press emoji-tile ${isSelected ? 'is-selected' : ''}`}
            >
              {emoji}
            </button>
          )
        })}
      </div>
      <p className="text-[11px] text-text-muted mt-3">
        {full
          ? `That's all ${MAX_EMOJIS} — tap one to swap it out.`
          : `Pick up to ${MAX_EMOJIS}. We'll work these into your replies.`}
      </p>
    </div>
  )
}
