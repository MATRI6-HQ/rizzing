import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { generateReplies, updateWeights } from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import { useMatchStore } from '../../store/matchStore'
import { usePreviousChatStore } from '../../store/previousChatStore'
import ChatBubble, { TypingIndicator } from '../../components/ChatBubble'
import ChatThread from '../../components/ChatThread'
import CustomizeSheet from './CustomizeSheet'

// ── Tunables (no magic numbers) ──────────────────────────────────────────────
const TOAST_DURATION_MS = 1800 // how long the "remember this" toast stays visible

// Stage thresholds (rule-based MVP). Upper bound is inclusive.
const STAGE_RULES = [
  { key: 'cold_open', label: 'Cold Open', max: 2 },
  { key: 'rapport', label: 'Rapport', max: 6 },
  { key: 'connection', label: 'Connection', max: 12 },
  { key: 'escalation', label: 'Escalation', max: Infinity },
]

const REPLY_TONES = ['safe', 'witty', 'bold']

const MODE_COPY = {
  context: 'Picking up the context you gave',
  new: 'Starting a new topic',
  continue: 'Continuing where you left off',
}

// Stable reference so the Zustand selector below doesn't return a fresh []
// on every render (which would defeat useSyncExternalStore's Object.is check
// and loop forever).
const EMPTY_TURNS = []

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Rule-based stage detection from the number of past turns for this match. */
export function detectStage(turnCount) {
  return STAGE_RULES.find((r) => turnCount <= r.max) ?? STAGE_RULES[STAGE_RULES.length - 1]
}

// ── Icons ────────────────────────────────────────────────────────────────────
function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function MiniSpinner() {
  return (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function ConversationFlow() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const matchId = searchParams.get('matchId')
  const mode = searchParams.get('mode')

  const user = useAuthStore((s) => s.user)
  const matches = useMatchStore((s) => s.matches)

  // Committed thread for this match — lives in the persisted chat-session store so
  // "continue previous" can restore it later (see previousChatStore.js / CLAUDE.md).
  const thread = usePreviousChatStore((s) => s.sessions[matchId]?.active ?? EMPTY_TURNS)
  const appendTurn = usePreviousChatStore((s) => s.appendTurn)

  // Save the active thread into the durable "continue previous" slot when the user
  // leaves this chat (back button / navigation away). Reads fresh state via getState so
  // the unmount closure can't go stale; the store guards against saving an empty thread.
  useEffect(() => {
    if (!matchId) return
    return () => usePreviousChatStore.getState().saveContinuePrevious(matchId)
  }, [matchId])

  // Prefer the match already in the store (came from Home); fall back to a fetch
  // for deep links / refreshes where the store is empty.
  const matchFromStore = useMemo(
    () => matches.find((m) => m.id === matchId) ?? null,
    [matches, matchId],
  )
  const [match, setMatch] = useState(matchFromStore)

  const [message, setMessage] = useState('')
  const [turnCount, setTurnCount] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [drafts, setDrafts] = useState(null) // { safe, witty, bold }
  const [selectedTone, setSelectedTone] = useState(null)
  const [sending, setSending] = useState(false)
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [toast, setToast] = useState(false)
  const [sentTone, setSentTone] = useState(null)
  const [error, setError] = useState('')

  const stage = detectStage(turnCount)

  // Load the match (if not in store) and the existing turn count for this match.
  useEffect(() => {
    if (!matchId) return
    let cancelled = false
    ;(async () => {
      if (!matchFromStore) {
        const { data } = await supabase.from('matches').select('*').eq('id', matchId).single()
        if (!cancelled && data) setMatch(data)
      }
      const { count } = await supabase
        .from('conversation_turns')
        .select('id', { count: 'exact', head: true })
        .eq('match_id', matchId)
      if (!cancelled && typeof count === 'number') setTurnCount(count)
    })()
    return () => {
      cancelled = true
    }
  }, [matchId, matchFromStore])

  const initial = match?.name?.charAt(0)?.toUpperCase() ?? '?'

  /** Shared by the initial Generate and "Generate another" — same call, fresh drafts. */
  async function requestReplies(herMessage) {
    setDrafts(null)
    setSelectedTone(null)
    setError('')
    setGenerating(true)
    try {
      const result = await generateReplies({
        her_message: herMessage,
        match_id: matchId,
        user_id: user?.id,
      })
      setDrafts(result)
    } catch (err) {
      setError(err?.message ?? 'Could not generate replies')
    } finally {
      setGenerating(false)
    }
  }

  function handleGenerate() {
    if (message.trim() === '' || generating) return
    requestReplies(message.trim())
  }

  // Enter sends (generates); Shift+Enter inserts a newline, messenger-style.
  function handleComposerKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleGenerate()
    }
  }

  /** Customize re-calls generate-replies with the instruction folded into the same
   *  her_message string — the Edge Function only accepts one message field, so this
   *  is the only way to steer it without a backend change. */
  function handleCustomize(instruction) {
    if (message.trim() === '' || instruction.trim() === '') return
    setCustomizeOpen(false)
    requestReplies(`${message.trim()}\n\n(Reply instruction from user: ${instruction.trim()})`)
  }

  async function handleSend() {
    if (!drafts || !selectedTone || sending) return
    const replyText = drafts[selectedTone]

    setSending(true)
    // Copy to clipboard (best-effort — not all environments expose the API).
    try {
      await navigator.clipboard?.writeText(replyText)
    } catch {
      /* clipboard blocked — non-fatal */
    }

    // Persist the turn. Column names match the deployed conversation_turns schema
    // (CLAUDE.md): her_message/sent_text/picked/detected_stage.
    let turnId = null
    try {
      const { data } = await supabase
        .from('conversation_turns')
        .insert({
          match_id: matchId,
          user_id: user?.id,
          her_message: message.trim(),
          detected_stage: stage.key,
          option_safe: drafts.safe,
          option_witty: drafts.witty,
          option_bold: drafts.bold,
          picked: selectedTone,
          sent_text: replyText,
        })
        .select('id')
        .single()
      turnId = data?.id ?? null
    } catch {
      /* keep the UX flowing even if the write fails */
    }

    // Fire-and-forget: bump the match + nudge weights in the background, don't block the UX.
    updateWeights({
      user_id: user?.id,
      match_id: matchId,
      turn_id: turnId,
      picked: selectedTone,
      sent_text: replyText,
      was_edited: false,
    }).catch(() => {})

    appendTurn(matchId, { role: 'incoming', text: message.trim() })
    appendTurn(matchId, { role: 'outgoing', text: replyText, tone: selectedTone })
    // Mirror the fresh exchange into the durable slot so a mid-chat refresh survives.
    usePreviousChatStore.getState().saveContinuePrevious(matchId)

    setMessage('')
    setDrafts(null)
    setSentTone(selectedTone)
    setSelectedTone(null)
    setSending(false)
    setToast(true)
    setTimeout(() => setToast(false), TOAST_DURATION_MS)
  }

  const canGenerate = message.trim() !== '' && !generating

  return (
    <div className="min-h-screen bg-ambient flex items-center justify-center">
      <div className="app-shell flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="h-14 px-4 flex items-center gap-3 border-b border-white/[0.04] shrink-0">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Back to home"
            className="press icon-chip w-9 h-9 text-text-primary opacity-70 hover:opacity-100 cursor-pointer"
          >
            <BackIcon />
          </button>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold/80 to-gold/40 flex items-center justify-center text-black font-bold text-base font-display shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-text-primary tracking-wide truncate">
              {match?.name ?? 'Match'}
            </p>
            {mode && MODE_COPY[mode] && (
              <p className="text-[11px] text-text-muted truncate">{MODE_COPY[mode]}</p>
            )}
          </div>
        </header>

        <ChatThread
          className="flex-1 px-5 pt-5 pb-3"
          autoScrollKey={`${thread.length}-${drafts ? 1 : 0}-${generating ? 1 : 0}`}
        >
          {thread.map((t, i) => (
            <ChatBubble key={i} variant={t.role} text={t.text} tone={t.tone ?? 'neutral'} />
          ))}

          {(generating || drafts) && (
            <>
              <div className="flex justify-center py-1">
                <span
                  className="text-[11px] tracking-[0.15em] uppercase px-3 py-1 rounded-full border border-gold/30 text-gold"
                  style={{ background: 'var(--color-gold-tint)' }}
                >
                  {stage.label}
                </span>
              </div>
              {message.trim() && <ChatBubble variant="incoming" text={message.trim()} />}
            </>
          )}

          {generating && <TypingIndicator />}

          {drafts && (
            <div className="flex flex-col gap-3 items-end">
              {REPLY_TONES.map((tone) => (
                <ChatBubble
                  key={tone}
                  variant="outgoing"
                  tone={tone}
                  text={drafts[tone]}
                  selectable
                  selected={selectedTone === tone}
                  onClick={() => setSelectedTone(tone)}
                />
              ))}
            </div>
          )}
        </ChatThread>

        {/* Bottom area: messenger composer, or the customize/regenerate/send controls
            once drafts exist. No Paste/Type/Screenshot tabs — one input, like a DM. */}
        <div className="px-4 pb-6 pt-2 shrink-0">
          {!drafts ? (
            <>
              <div className="chat-composer">
                <textarea
                  rows={1}
                  className=""
                  placeholder="Paste or type her message…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleComposerKey}
                />
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  aria-label="Generate replies"
                  className="press chat-send"
                >
                  {generating ? <MiniSpinner /> : <SendIcon />}
                </button>
              </div>
              {error && (
                <p className="text-red-400 text-xs tracking-wide text-center mt-3">{error}</p>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCustomizeOpen(true)}
                  disabled={generating}
                  className="press lift flex-1 text-[13px] py-2.5 rounded-xl border border-white/[0.1] text-text-secondary hover:text-text-primary hover:border-gold/30 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Customize
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="press lift flex-1 text-[13px] py-2.5 rounded-xl border border-white/[0.1] text-text-secondary hover:text-text-primary hover:border-gold/30 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {generating ? 'Generating…' : 'Generate another'}
                </button>
              </div>
              <button
                type="button"
                onClick={handleSend}
                disabled={!selectedTone || sending}
                className="btn-gold lift-gold"
              >
                {sending ? 'Sending…' : 'Send →'}
              </button>
              {error && <p className="text-red-400 text-xs tracking-wide text-center">{error}</p>}
            </div>
          )}
        </div>

        {/* Micro-interaction toast */}
        {toast && (
          <div className="absolute inset-x-0 bottom-24 flex justify-center pointer-events-none">
            <span className="text-gold text-[15px] font-display tracking-wide animate-pulse">
              ✓ Sent as {sentTone} · We'll remember this
            </span>
          </div>
        )}

        {customizeOpen && (
          <CustomizeSheet onClose={() => setCustomizeOpen(false)} onSubmit={handleCustomize} />
        )}
      </div>
    </div>
  )
}
