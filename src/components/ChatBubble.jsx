// Shared bubble used by both Onboarding scenarios and ConversationFlow — keeping
// one component means both surfaces stay visually identical by construction.

const TONE_CLASS = {
  safe: 'chat-bubble--tone-safe',
  witty: 'chat-bubble--tone-witty',
  bold: 'chat-bubble--tone-bold',
  neutral: '',
}

const TONE_LABEL = {
  safe: 'Safe',
  witty: 'Witty',
  bold: 'Bold',
}

export default function ChatBubble({
  variant = 'incoming',
  text,
  timestamp,
  tone = 'neutral',
  selectable = false,
  selected = false,
  onClick,
}) {
  const isOutgoing = variant === 'outgoing'
  const classes = [
    'press chat-bubble',
    isOutgoing ? 'chat-bubble--outgoing' : 'chat-bubble--incoming',
    TONE_CLASS[tone] || '',
    selectable ? 'chat-bubble--selectable' : '',
    selected ? 'chat-bubble--selected' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const Tag = selectable ? 'button' : 'div'

  return (
    <Tag
      type={selectable ? 'button' : undefined}
      onClick={selectable ? onClick : undefined}
      className={classes}
    >
      {tone !== 'neutral' && (
        <span className="chat-bubble__tag">{TONE_LABEL[tone]}</span>
      )}
      <p className="chat-bubble__text">{text}</p>
      {timestamp && <span className="chat-bubble__time">{timestamp}</span>}
    </Tag>
  )
}

/** Three staggered dots inside an incoming-styled bubble, shown before a message reveals. */
export function TypingIndicator() {
  return (
    <div className="chat-bubble chat-bubble--incoming chat-bubble--typing" aria-label="typing…">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </div>
  )
}
