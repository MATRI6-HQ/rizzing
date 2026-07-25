import { useState } from 'react'

// Quick-pick nudges — tapping one fills the textarea, still requires the user to
// hit Send so they can tweak the wording before it re-triggers generate-replies.
const QUICK_SUGGESTIONS = ['Make it shorter', 'More flirty', 'Fewer emojis', 'Add Hinglish']

export default function CustomizeSheet({ onClose, onSubmit }) {
  const [instruction, setInstruction] = useState('')

  function submit() {
    if (instruction.trim() === '') return
    onSubmit(instruction.trim())
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] z-50 bg-[#141414] rounded-t-3xl px-6 pt-5 pb-10 border-t border-white/[0.06]">
        <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-6" />
        <h2 className="font-display text-xl text-text-primary">Customize replies</h2>
        <p className="text-xs tracking-widest uppercase opacity-30 mt-1 mb-5">
          Tell us how to tweak them
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {QUICK_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setInstruction(s)}
              className={`press text-[12px] py-1.5 px-3 rounded-full border transition-all cursor-pointer ${
                instruction === s
                  ? 'pill-selected'
                  : 'border-white/[0.1] text-text-secondary hover:text-text-primary'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <textarea
          className="input-rizzing resize-none"
          rows={2}
          placeholder="e.g. make it less formal…"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          autoFocus
        />

        <button
          type="button"
          onClick={submit}
          disabled={instruction.trim() === ''}
          className="btn-gold lift-gold mt-4"
        >
          Regenerate →
        </button>
      </div>
    </>
  )
}
