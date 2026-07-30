/**
 * Go-to emoji input — a plain text field that the OS emoji keyboard types into,
 * plus removable chips for what's been picked. Capped at MAX_EMOJIS.
 *
 * This replaced a fixed 20-emoji grid. The grid could only offer emojis we'd guessed
 * at; the OS keyboard offers all of them, already sorted by what this user actually
 * uses, in their skin tone, for free. On mobile the field raises the native keyboard
 * (emoji is a tab on it); on desktop it takes Win+. / Cmd+Ctrl+Space or a paste.
 * No picker library — that's the entire point of the change.
 *
 * Values are stored as a `text[]`, so this component's contract is a plain array of
 * strings and it never mutates the one it is given.
 */

export const MAX_EMOJIS = 5

// A grapheme counts as emoji if it contains a pictographic char, a regional indicator
// (flags are two of those), or the combining enclosing keycap (1️⃣, #️⃣ — whose base
// char is an ordinary digit or #, so those would otherwise be rejected).
const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|⃣/u

/**
 * Split a string into user-perceived characters.
 *
 * Intl.Segmenter is the only thing that gets this right: a single emoji is very often
 * several code points (👩‍💻 is 3 + 2 joiners, 👍🏽 is 2), so `split('')` would shred it
 * into mojibake and even `Array.from` — which is code-point aware — would still break
 * ZWJ sequences into their parts. The fallback only runs on engines without Segmenter,
 * where mangling a multi-part emoji beats throwing.
 */
function toGraphemes(text) {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(seg.segment(text), (s) => s.segment)
  }
  return Array.from(text)
}

export default function EmojiPicker({ value, onChange }) {
  const selected = value ?? []
  const full = selected.length >= MAX_EMOJIS

  /**
   * The field is a chute, not a text box: whatever lands in it is converted to chips
   * and the input is cleared on the same change. Keeping it permanently empty is what
   * makes a native-keyboard tap feel like "picked" rather than "typed" — and it means
   * the component never has to reconcile two sources of truth for the selection.
   */
  function handleInput(e) {
    const graphemes = toGraphemes(e.target.value)
    const next = [...selected]
    for (const g of graphemes) {
      if (next.length >= MAX_EMOJIS) break
      // Non-emoji typing is dropped rather than stored — preferred_emojis feeds the
      // reply prompt, and a stray "a" in there is a prompt bug, not a preference.
      if (!EMOJI_RE.test(g)) continue
      if (next.includes(g)) continue
      next.push(g)
    }
    // Always clear, even when nothing was accepted, so rejected input doesn't linger.
    e.target.value = ''
    if (next.length !== selected.length) onChange(next)
  }

  function remove(emoji) {
    onChange(selected.filter((e) => e !== emoji))
  }

  return (
    <div>
      <input
        type="text"
        value=""
        onChange={handleInput}
        disabled={full}
        // inputMode="text" (not "none") is what lets the on-screen keyboard open at
        // all — the emoji tab lives on that keyboard. autoComplete/autoCorrect off so
        // the field isn't second-guessed by predictive text.
        inputMode="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck="false"
        aria-label="Add an emoji"
        placeholder={full ? `That's all ${MAX_EMOJIS}` : 'Tap to add emoji'}
        className="input-rizzing"
      />

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {selected.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => remove(emoji)}
              aria-label={`Remove ${emoji}`}
              className="press emoji-chip"
            >
              <span aria-hidden="true">{emoji}</span>
              <span className="emoji-chip__x" aria-hidden="true">
                ×
              </span>
            </button>
          ))}
        </div>
      )}

      <p className="text-[11px] text-text-muted mt-3">
        {full
          ? `That's all ${MAX_EMOJIS} — remove one to swap it out.`
          : `Pick up to ${MAX_EMOJIS}. We'll work these into your replies.`}
      </p>
    </div>
  )
}
