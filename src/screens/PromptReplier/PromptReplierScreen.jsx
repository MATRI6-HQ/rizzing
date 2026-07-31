import { useState } from 'react'
import { useTransitionNavigate } from '../../components/PageTransition'
import { generatePromptReply } from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import ChatBubble, { TypingIndicator } from '../../components/ChatBubble'
import ChatThread from '../../components/ChatThread'
import { SUPPORT_EMAIL, supportMailto } from '../../lib/support'

// Copied-to-clipboard confirmation. Same duration as ConversationFlow's TOAST_DURATION_MS.
const TOAST_MS = 1800

// Consecutive failures before we stop calling it a blip and offer a human. Same rule as
// ConversationFlow's FAILURES_BEFORE_SUPPORT.
const FAILURES_BEFORE_SUPPORT = 2

const REPLY_TONES = ['safe', 'witty', 'bold']

// Shown as placeholders. Real Hinge phrasing, so it's obvious what goes in each field —
// the whole feature falls apart if the user pastes her answer into the prompt box.
const PROMPT_EXAMPLE = 'The way to win me over is'
const ANSWER_EXAMPLE = 'going on long walks under the Bougainville trees'

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

/**
 * Standalone opener generator for a dating-app profile prompt + her answer.
 *
 * Deliberately has NO match and writes NOTHING: no matches row, no conversation_turns,
 * no matchStore, no update-weights. It is a pure input → generate → display flow, and
 * acting on an opener is a copy-paste (CLAUDE.md). Everything it shares with
 * ConversationFlow — the bubbles, the thread, the tone tags — is shared by importing the
 * same components, not by reimplementing them.
 */
export default function PromptReplierScreen() {
  const navigate = useTransitionNavigate()
  const user = useAuthStore((s) => s.user)

  const [prompt, setPrompt] = useState('')
  const [answer, setAnswer] = useState('')
  const [generating, setGenerating] = useState(false)
  const [drafts, setDrafts] = useState(null) // { safe, witty, bold }
  const [selectedTone, setSelectedTone] = useState(null)
  const [error, setError] = useState('')
  const [failures, setFailures] = useState(0)
  const [toast, setToast] = useState('')

  const canGenerate = prompt.trim() !== '' && answer.trim() !== '' && !generating

  async function handleGenerate() {
    if (!canGenerate) return
    setDrafts(null)
    setSelectedTone(null)
    setError('')
    setGenerating(true)
    try {
      const result = await generatePromptReply({
        prompt: prompt.trim(),
        answer: answer.trim(),
        user_id: user?.id,
      })
      setDrafts(result)
      setFailures(0)
    } catch (err) {
      setError(err?.message ?? 'Could not generate openers')
      setFailures((n) => n + 1)
    } finally {
      setGenerating(false)
    }
  }

  /** Copy is the only commit action here — there's no thread to send into. */
  async function handleCopy() {
    if (!drafts || !selectedTone) return
    try {
      await navigator.clipboard?.writeText(drafts[selectedTone])
      setToast(`✓ ${selectedTone} opener copied`)
    } catch {
      // Clipboard is blocked in some webviews and there's no fallback worth building —
      // the text is on screen and selectable.
      setToast('Copy blocked — select the text instead')
    }
    setTimeout(() => setToast(''), TOAST_MS)
  }

  return (
    <div className="chat-screen bg-ambient flex items-center justify-center">
      <div className="app-shell flex flex-col relative overflow-hidden">
        <header className="h-14 px-4 flex items-center gap-3 border-b border-white/[0.04] shrink-0">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Back to home"
            className="press icon-chip w-9 h-9 text-text-primary opacity-70 hover:opacity-100 cursor-pointer"
          >
            <BackIcon />
          </button>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-text-primary tracking-wide truncate">
              Prompt replier
            </p>
            <p className="text-[11px] text-text-muted truncate">
              Her profile prompt → your opener
            </p>
          </div>
        </header>

        <ChatThread className="px-5 pt-5 pb-3" autoScrollKey={`${drafts ? 1 : 0}-${generating ? 1 : 0}`}>
          {!drafts && !generating && (
            <div className="text-center py-6">
              <p className="font-display text-[22px] text-text-primary leading-tight">
                Reply to a profile prompt
              </p>
              <p className="text-[13px] text-text-secondary mt-3 leading-relaxed max-w-[290px] mx-auto">
                Paste the prompt she picked and what she wrote under it. You get three
                openers that answer her, not the prompt.
              </p>
            </div>
          )}

          {(generating || drafts) && (
            <ChatBubble variant="incoming" text={`${prompt.trim()}\n${answer.trim()}`} />
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

        {/* Two stacked inputs, always visible — unlike ConversationFlow this screen has
            no thread to fall back to, so hiding them after a generation would leave the
            user with no way to tweak the pair and try again. */}
        <div className="px-4 pb-6 pt-2 shrink-0 space-y-2">
          <input
            className="input-rizzing"
            placeholder={`Her prompt — e.g. "${PROMPT_EXAMPLE}"`}
            aria-label="Her prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <input
            className="input-rizzing"
            placeholder={`Her answer — e.g. "${ANSWER_EXAMPLE}"`}
            aria-label="Her answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />

          {drafts ? (
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="press lift flex-1 text-[13px] py-2.5 rounded-xl border border-white/[0.1] text-text-secondary hover:text-text-primary hover:border-gold/30 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generating ? 'Generating…' : 'Generate another'}
              </button>
              <button
                type="button"
                onClick={handleCopy}
                disabled={!selectedTone}
                className="btn-gold-sm lift-gold flex-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Copy
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="btn-gold lift-gold"
            >
              {generating ? 'Generating…' : 'Get openers'}
            </button>
          )}

          {error && (
            <div className="text-center pt-1">
              <p className="text-red-400 text-xs tracking-wide">{error}</p>
              {failures >= FAILURES_BEFORE_SUPPORT && (
                <p className="text-[11px] text-text-muted mt-1.5">
                  Still not working?{' '}
                  <a href={supportMailto(user?.email)} className="text-gold hover:opacity-70">
                    {SUPPORT_EMAIL}
                  </a>
                </p>
              )}
            </div>
          )}
        </div>

        {toast && <div className="toast-rizzing">{toast}</div>}
      </div>
    </div>
  )
}
