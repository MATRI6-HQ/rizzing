// Shown when a match is tapped from Home. Three ways into a chat: continue
// mid-conversation, start on a new topic, or resume the one stored "previous" chat.

function ContextIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function NewTopicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function ContinueIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5M12 7v5l4 2" />
    </svg>
  )
}

function EntryCard({ icon, title, subtitle, disabled, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`press card-rizzing w-full flex items-center gap-4 p-4 text-left ${
        disabled
          ? 'opacity-35 cursor-not-allowed'
          : 'lift btn-shadow cursor-pointer hover:border-gold/30'
      }`}
    >
      <div className="icon-chip w-11 h-11 shrink-0 bg-white/[0.04] text-gold">{icon}</div>
      <div className="min-w-0">
        <p className="text-[15px] font-medium text-text-primary tracking-wide">{title}</p>
        <p className="text-[12px] text-text-secondary mt-0.5 truncate">{subtitle}</p>
      </div>
    </button>
  )
}

/** Compact relative time: "just now", "5m ago", "3h ago", "2d ago". */
function relativeTime(iso) {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export default function EntryModeSheet({ match, previousSlot, onClose, onSelect }) {
  const hasPrevious = Boolean(previousSlot?.messages?.length)
  // Preview: last message snippet + when it was saved. Falls back to the empty hint.
  const continueSubtitle = hasPrevious
    ? `${previousSlot.preview || 'Saved chat'} · ${relativeTime(previousSlot.savedAt)}`
    : 'No previous chat yet'

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] z-50 bg-[#141414] rounded-t-3xl px-6 pt-5 pb-10 border-t border-white/[0.06]">
        <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-6" />
        <h2 className="font-display text-xl text-text-primary">{match?.name}</h2>
        <p className="text-xs tracking-widest uppercase opacity-30 mt-1 mb-6">
          How do you want to start?
        </p>
        <div className="flex flex-col gap-3">
          <EntryCard
            icon={<ContextIcon />}
            title="Context"
            subtitle="Mid-conversation — just need a reply"
            onClick={() => onSelect('context')}
          />
          <EntryCard
            icon={<NewTopicIcon />}
            title="New topic"
            subtitle="Start a fresh conversation"
            onClick={() => onSelect('new')}
          />
          <EntryCard
            icon={<ContinueIcon />}
            title="Continue previous"
            subtitle={continueSubtitle}
            disabled={!hasPrevious}
            onClick={() => onSelect('continue')}
          />
        </div>
      </div>
    </>
  )
}
