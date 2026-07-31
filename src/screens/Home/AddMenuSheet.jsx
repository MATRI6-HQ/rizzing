// Shown when the footer's centre `+` is tapped. The `+` used to open the add-match
// sheet directly; it now forks first, because "start a conversation with someone" and
// "write an opener off a profile prompt" are two different jobs that happen to share
// one entry point.
//
// Same bottom-sheet shell as EntryModeSheet — the two are siblings in the flow and
// should not look like different mechanisms.

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h8M8 13.5h5" />
    </svg>
  )
}

// A quote mark over a line: a profile prompt is something she wrote to a fixed
// question, not a message she sent — the icon should not read as a chat bubble.
function PromptIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6.5c-2.2.6-3.5 2.2-3.5 4.2H8v4H4.5v-4" />
      <path d="M18.5 6.5c-2.2.6-3.5 2.2-3.5 4.2h2.5v4H14v-4" />
      <path d="M4 19h16" />
    </svg>
  )
}

function MenuCard({ icon, title, subtitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press lift btn-shadow card-rizzing w-full flex items-center gap-4 p-4 text-left cursor-pointer hover:border-gold/30"
    >
      <div className="icon-chip w-11 h-11 shrink-0 bg-white/[0.04] text-gold">{icon}</div>
      <div className="min-w-0">
        <p className="font-display text-[16px] text-text-primary tracking-wide">{title}</p>
        <p className="text-[12px] text-text-secondary mt-0.5">{subtitle}</p>
      </div>
    </button>
  )
}

export default function AddMenuSheet({ onClose, onNewConversation, onPromptReplier }) {
  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] z-50 bg-[#141414] rounded-t-3xl px-6 pt-5 pb-10 border-t border-white/[0.06]">
        <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-6" />
        <h2 className="font-display text-xl text-text-primary">What are we writing?</h2>
        <p className="text-xs tracking-widest uppercase opacity-30 mt-1 mb-6">Pick one</p>
        <div className="flex flex-col gap-3">
          <MenuCard
            icon={<ChatIcon />}
            title="Start new conversation"
            subtitle="Add whoever you're talking to"
            onClick={onNewConversation}
          />
          <MenuCard
            icon={<PromptIcon />}
            title="Prompt replier"
            subtitle="Answer a profile prompt from Hinge or Bumble"
            onClick={onPromptReplier}
          />
        </div>
      </div>
    </>
  )
}
