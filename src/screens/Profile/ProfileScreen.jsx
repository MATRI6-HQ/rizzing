import { useEffect, useState } from 'react'
import { useTransitionNavigate } from '../../components/PageTransition'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useProfileStore } from '../../store/profileStore'
import { useMatchStore } from '../../store/matchStore'
import TermsContent from '../../components/TermsContent'
import PersonaRadar from '../../components/PersonaRadar'
import EmojiPicker, { MAX_EMOJIS } from '../../components/EmojiPicker'
import { deriveArchetype, isPersonaForming, AXIS_KEYS } from '../../lib/archetype'
import { LANGUAGE_CHOICES, EMOJI_CHOICES, normalizeLanguage, normalizeEmoji } from '../../lib/prefs'
import { SUPPORT_EMAIL, SUPPORT_REPLY_WINDOW, supportMailto } from '../../lib/support'

const TOAST_MS = 2200

// Persona axes → display labels (sentence case per design rules). Keys match the
// personality_profiles columns loaded into profileStore; order matches AXIS_KEYS so the
// radar and the breakdown bars can never disagree about which value is which.
const AXIS_LABELS = {
  confidence: 'Confidence',
  humor: 'Humor',
  persistence: 'Persistence',
  emotional_tone: 'Emotional tone',
  escalation: 'Escalation',
  boldness: 'Boldness',
  sarcasm: 'Sarcasm',
}
// Shorter forms for the radar, where seven labels have to ring a 250-unit viewBox.
const AXIS_SHORT = {
  confidence: 'Confidence',
  humor: 'Humor',
  persistence: 'Persist',
  emotional_tone: 'Feeling',
  escalation: 'Escalate',
  boldness: 'Bold',
  sarcasm: 'Sarcasm',
}

const TONES = [
  { key: 'safe', label: 'Safe', className: 'tone-seg--safe', color: 'var(--color-safe)' },
  { key: 'witty', label: 'Witty', className: 'tone-seg--witty', color: 'var(--color-gold)' },
  { key: 'bold', label: 'Bold', className: 'tone-seg--bold', color: 'var(--color-bold)' },
]

// ── Icons ────────────────────────────────────────────────────────────────────
function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function ChevronIcon({ open }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

// ── Small presentational pieces ──────────────────────────────────────────────
function Card({ title, children, className = '' }) {
  return (
    <section className={`card-elevated p-5 ${className}`}>
      {title && (
        <h2 className="text-text-secondary text-[10px] tracking-[0.2em] uppercase opacity-55 mb-4">
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}

/**
 * Preference pills. `pending` marks the whole row as edited-but-unsaved (gold outline +
 * dot on the chosen pill); `value === null` renders every pill unselected, which is the
 * honest state for a preference that was skipped during onboarding.
 */
function ChoiceRow({ choices, value, pending, onSelect, label, helper }) {
  return (
    <>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-[13px] text-text-secondary">{label}</p>
        {value === null && <p className="text-[11px] text-gold/70">Not set yet — pick one.</p>}
      </div>
      <div className="flex gap-2">
        {choices.map((c) => {
          const selected = value === c.value
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => onSelect(c.value)}
              aria-pressed={selected}
              className={`press relative flex-1 text-[13px] py-2.5 rounded-xl border cursor-pointer transition-all ${
                selected
                  ? pending
                    ? 'pill-pending'
                    : 'pill-selected'
                  : 'border-white/[0.08] text-text-secondary hover:text-text-primary'
              }`}
            >
              {c.label}
            </button>
          )
        })}
      </div>
      {helper && <p className="text-[11px] text-text-muted mt-2">{helper}</p>}
    </>
  )
}

function TermsSheet({ onClose, userEmail }) {
  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] z-50 bg-[#141414] rounded-t-3xl px-6 pt-5 pb-10 border-t border-white/[0.06]">
        <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-6" />
        <h2 className="font-display text-xl text-text-primary mb-4">Terms &amp; Privacy</h2>
        <TermsContent />
        <p className="text-[12px] text-text-muted mt-4">
          Need help?{' '}
          <a href={supportMailto(userEmail)} className="text-gold hover:opacity-70">
            {SUPPORT_EMAIL}
          </a>
        </p>
        <button type="button" onClick={onClose} className="btn-gold lift-gold mt-5">
          Close
        </button>
      </div>
    </>
  )
}

/** Save / Discard / Cancel — three outcomes, so window.confirm can't express it. */
function UnsavedDialog({ onSave, onDiscard, onCancel, saving }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Unsaved preference changes"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[86%] max-w-[340px] z-[60] card-elevated p-5"
      >
        <h3 className="font-display text-lg text-text-primary">Unsaved changes</h3>
        <p className="text-[13px] text-text-secondary mt-2 leading-relaxed">
          You have unsaved preference changes. Save before leaving?
        </p>
        <div className="flex flex-col gap-2 mt-5">
          <button type="button" onClick={onSave} disabled={saving} className="press btn-gold-sm">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={onDiscard} className="press btn-ghost">
            Discard
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="press text-[13px] py-2 text-text-muted hover:text-text-secondary cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const navigate = useTransitionNavigate()
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const profile = useProfileStore()
  const loadProfile = useProfileStore((s) => s.load)
  const savePatch = useProfileStore((s) => s.savePatch)
  const matches = useMatchStore((s) => s.matches)

  const [animated, setAnimated] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [matchCount, setMatchCount] = useState(matches.length)

  // Preference draft state — taps edit this, not the store (Section 4).
  const [draft, setDraft] = useState({
    hinglish_ratio: null,
    emoji_frequency: null,
    preferred_emojis: [],
  })
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [toast, setToast] = useState('')
  // A navigation the user asked for that's parked behind the unsaved-changes dialog.
  const [pendingExit, setPendingExit] = useState(null)

  // Re-fetch on mount. The store is only hydrated at explicit sign-in, so on a reload —
  // or on coming back from ConversationFlow after a pick moved the weights — trusting it
  // showed a stale all-defaults persona (every axis at exactly 50). This is that fix.
  useEffect(() => {
    if (!user?.id) return
    loadProfile(user.id).catch(() => {
      /* already logged in the store; the screen still renders with what it has */
    })
  }, [user?.id, loadProfile])

  // Match count for the stats row — ProfileScreen can be opened directly (deep link,
  // refresh) without Home having ever populated matchStore.
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      const { count } = await supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true)
      if (!cancelled && typeof count === 'number') setMatchCount(count)
    })()
    return () => {
      cancelled = true
    }
  }, [user?.id])

  // Fill the bars / radar from nothing on mount for a gentle reveal.
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 60)
    return () => clearTimeout(t)
  }, [])

  // The saved values, normalized through the shared vocabulary so legacy rows
  // (low/medium/high, 'hinglish') land on the right pill instead of none.
  const savedLanguage = normalizeLanguage(profile.hinglish_ratio)
  const savedEmoji = normalizeEmoji(profile.emoji_frequency)
  const savedEmojiList = profile.preferred_emojis ?? []
  // preferred_emojis is an ORDERED text[], so joining is real equality, not a shortcut.
  // It also gives the effect below a primitive to depend on — a fresh array literal from
  // the store would be a new reference every render and re-seed the draft forever,
  // wiping the user's edit on each keystroke elsewhere on the screen.
  const savedEmojiKey = savedEmojiList.join(' ')

  // Re-seed the draft whenever the saved values change (initial load, or a save landing).
  useEffect(() => {
    setDraft({
      hinglish_ratio: savedLanguage,
      emoji_frequency: savedEmoji,
      preferred_emojis: savedEmojiKey === '' ? [] : savedEmojiKey.split(' '),
    })
  }, [savedLanguage, savedEmoji, savedEmojiKey])

  const emojisDirty = draft.preferred_emojis.join(' ') !== savedEmojiKey
  const dirty =
    draft.hinglish_ratio !== savedLanguage ||
    draft.emoji_frequency !== savedEmoji ||
    emojisDirty

  const name = profile.full_name || user?.email?.split('@')[0] || 'You'
  const initial = name.charAt(0).toUpperCase()

  const axes = AXIS_KEYS.map((key) => ({
    key,
    label: AXIS_LABELS[key],
    short: AXIS_SHORT[key],
    value: typeof profile[key] === 'number' ? profile[key] : 0.5,
  }))

  const forming = isPersonaForming(profile)
  const archetype = deriveArchetype(profile)

  // Tone mix comes from pick_history, which update-weights increments on every send.
  const picks = profile.pick_history ?? {}
  const toneCounts = TONES.map((t) => ({ ...t, count: Number(picks[t.key] ?? 0) }))
  const totalPicks = toneCounts.reduce((sum, t) => sum + t.count, 0)
  const topTone = totalPicks > 0
    ? toneCounts.reduce((best, t) => (t.count > best.count ? t : best))
    : null

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    try {
      await savePatch(user.id, {
        hinglish_ratio: draft.hinglish_ratio,
        emoji_frequency: draft.emoji_frequency,
        preferred_emojis: draft.preferred_emojis,
      })
      setToast('Preferences saved')
      setTimeout(() => setToast(''), TOAST_MS)
      return true
    } catch (err) {
      // Draft survives on purpose — the user shouldn't lose their edit to a failed write.
      setSaveError(err?.message ?? 'Could not save. Try again.')
      return false
    } finally {
      setSaving(false)
    }
  }

  function handleDiscard() {
    setDraft({
      hinglish_ratio: savedLanguage,
      emoji_frequency: savedEmoji,
      preferred_emojis: savedEmojiList,
    })
    setSaveError('')
  }

  /** Route every exit through the unsaved-changes gate. */
  function leave(action) {
    if (dirty) {
      setPendingExit(() => action)
      return
    }
    action()
  }

  async function saveThenLeave() {
    const ok = await handleSave()
    if (!ok) return // stay put, inline error is showing
    const action = pendingExit
    setPendingExit(null)
    action?.()
  }

  function discardThenLeave() {
    handleDiscard()
    const action = pendingExit
    setPendingExit(null)
    action?.()
  }

  async function doLogout() {
    try {
      await signOut()
    } catch {
      /* ignore — we redirect regardless */
    }
    useMatchStore.getState().reset?.()
    useProfileStore.getState().reset?.()
    navigate('/auth', { replace: true })
  }

  return (
    <div className="min-h-screen bg-ambient flex items-center justify-center">
      <div className="app-shell flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="h-14 px-4 flex items-center gap-3 border-b border-white/[0.04] shrink-0">
          <button
            type="button"
            onClick={() => leave(() => navigate('/'))}
            aria-label="Back to home"
            className="press icon-chip w-9 h-9 text-text-primary opacity-70 hover:opacity-100 cursor-pointer"
          >
            <BackIcon />
          </button>
          <p className="text-[13px] tracking-[0.16em] uppercase text-text-secondary opacity-70">
            Profile
          </p>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pt-7 pb-8 space-y-5">
          {/* ── Hero: the archetype ─────────────────────────────────────────── */}
          <div className="relative flex flex-col items-center text-center">
            <div className="hero-glow" aria-hidden="true" />
            <div className="relative p-[2px] rounded-full bg-gradient-to-br from-gold-light via-gold to-gold-dark shadow-[0_8px_28px_rgba(212,168,67,0.28)]">
              <div className="w-[68px] h-[68px] rounded-full bg-bg-app flex items-center justify-center">
                <span className="font-display text-[26px] text-gold">{initial}</span>
              </div>
            </div>
            <h1 className="font-display text-[30px] leading-tight text-text-primary mt-4">
              {archetype.name}
            </h1>
            <p className="text-[13px] text-text-secondary mt-1.5 max-w-[280px] leading-relaxed">
              {archetype.descriptor}
            </p>
            <p className="text-[11px] tracking-[0.14em] uppercase text-text-muted mt-3">
              {name}
            </p>
          </div>

          {/* ── Persona radar + collapsible breakdown ───────────────────────── */}
          <Card title="Your rizz persona">
            {forming ? (
              // Empty/new-user state — a flat all-50 radar says nothing, so don't draw one.
              <div className="text-center py-3">
                <div className="w-11 h-11 rounded-full mx-auto border border-gold/25 flex items-center justify-center text-gold text-lg">
                  ◌
                </div>
                <p className="font-display text-lg text-text-primary mt-3">
                  Your persona is still forming
                </p>
                <p className="text-[13px] text-text-secondary mt-1.5 leading-relaxed">
                  Pick a few replies and watch it shift — we learn your style from what you
                  actually send, not from a survey.
                </p>
              </div>
            ) : (
              <>
                <PersonaRadar
                  axes={axes.map((a) => ({ key: a.key, label: a.short, value: a.value }))}
                  animate={animated}
                />
                <button
                  type="button"
                  onClick={() => setBreakdownOpen((v) => !v)}
                  aria-expanded={breakdownOpen}
                  className="press w-full flex items-center justify-center gap-2 text-[12px] text-text-secondary hover:text-text-primary mt-1 py-2 cursor-pointer"
                >
                  {breakdownOpen ? 'Hide breakdown' : 'See breakdown'}
                  <ChevronIcon open={breakdownOpen} />
                </button>

                {breakdownOpen && (
                  <div className="flex flex-col gap-3.5 pt-2">
                    {axes.map(({ key, label, value }) => (
                      <div key={key}>
                        <div className="flex justify-between items-baseline mb-1.5">
                          <span className="text-[13px] text-text-primary">{label}</span>
                          <span className="text-[11px] text-text-muted tabular-nums">
                            {Math.round(value * 100)}
                          </span>
                        </div>
                        <div className="persona-track">
                          <div
                            className="persona-fill"
                            style={{ width: animated ? `${value * 100}%` : '0%' }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </Card>

          {/* ── Tone mix ────────────────────────────────────────────────────── */}
          <Card title="Tone mix">
            {totalPicks === 0 ? (
              <p className="text-[13px] text-text-muted">
                No sends yet — this fills in as you pick replies.
              </p>
            ) : (
              <>
                <div className="tone-strip">
                  {toneCounts.map((t) => (
                    <div
                      key={t.key}
                      className={`tone-seg ${t.className}`}
                      style={{ width: animated ? `${(t.count / totalPicks) * 100}%` : '0%' }}
                    />
                  ))}
                </div>
                <div className="flex justify-between mt-3">
                  {toneCounts.map((t) => (
                    <div key={t.key} className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: t.color }}
                      />
                      <span className="text-[12px] text-text-secondary">{t.label}</span>
                      <span className="text-[12px] text-text-primary tabular-nums">
                        {Math.round((t.count / totalPicks) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          {/* ── Stats ───────────────────────────────────────────────────────── */}
          <div className="flex gap-2.5">
            <div className="stat-tile">
              <span className="stat-tile__value tabular-nums">{totalPicks}</span>
              <span className="stat-tile__label">Replies sent</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile__value tabular-nums">{matchCount}</span>
              <span className="stat-tile__label">Matches</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile__value">{topTone ? topTone.label : '—'}</span>
              <span className="stat-tile__label">Top tone</span>
            </div>
          </div>

          {/* ── Preferences (draft → save / discard) ────────────────────────── */}
          <Card title="Preferences">
            <ChoiceRow
              label="Language mix"
              choices={LANGUAGE_CHOICES}
              value={draft.hinglish_ratio}
              pending={draft.hinglish_ratio !== savedLanguage}
              onSelect={(v) => setDraft((d) => ({ ...d, hinglish_ratio: v }))}
            />
            <div className="mt-6">
              <ChoiceRow
                label="Emoji use"
                choices={EMOJI_CHOICES}
                value={draft.emoji_frequency}
                pending={draft.emoji_frequency !== savedEmoji}
                onSelect={(v) => setDraft((d) => ({ ...d, emoji_frequency: v }))}
              />
            </div>

            {/* Go-to emojis — previously a read-only helper line under "Emoji use",
                set once in onboarding and un-editable after. It feeds the reply prompt,
                so it's a real preference and belongs in the same draft → Save flow. */}
            <div className="mt-6">
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-[13px] text-text-secondary">
                  Go-to emojis
                  {emojisDirty && <span className="text-gold ml-1.5">•</span>}
                </p>
                <p className="text-[11px] text-text-muted tabular-nums">
                  {draft.preferred_emojis.length} / {MAX_EMOJIS}
                </p>
              </div>

              <div className="flex items-center justify-between gap-3">
                {draft.preferred_emojis.length > 0 ? (
                  <p className="text-[19px] leading-none tracking-[0.12em] truncate">
                    {draft.preferred_emojis.join(' ')}
                  </p>
                ) : (
                  <p className="text-[12px] text-text-muted">
                    None picked — we'll leave emojis out.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setEmojiOpen((v) => !v)}
                  aria-expanded={emojiOpen}
                  className="press text-[12px] text-gold hover:opacity-70 cursor-pointer shrink-0"
                >
                  {emojiOpen ? 'Done' : 'Edit'}
                </button>
              </div>

              {emojiOpen && (
                <div className="mt-3">
                  <EmojiPicker
                    value={draft.preferred_emojis}
                    onChange={(next) => setDraft((d) => ({ ...d, preferred_emojis: next }))}
                  />
                </div>
              )}
            </div>

            {saveError && (
              <p className="text-red-400 text-[12px] mt-4" role="alert">
                {saveError}
              </p>
            )}

            {dirty && (
              <div className="save-bar">
                <button
                  type="button"
                  onClick={handleDiscard}
                  disabled={saving}
                  className="press btn-ghost flex-1"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="press btn-gold-sm flex-1"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            )}
          </Card>

          {/* ── Account ─────────────────────────────────────────────────────── */}
          <Card title="Account">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[13px] text-text-secondary shrink-0">Email</span>
              <span className="text-[13px] text-text-primary truncate">{user?.email ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-[13px] text-text-secondary">Plan</span>
              <span className="text-[11px] tracking-wide px-2.5 py-1 rounded-full border border-white/[0.1] text-text-muted">
                Free · ad-supported
              </span>
            </div>

            <div className="mt-4 pt-4 border-t border-white/[0.05]">
              <div className="flex items-center justify-between gap-4">
                <span className="text-[13px] text-text-secondary shrink-0">Support</span>
                <a
                  href={supportMailto(user?.email)}
                  // select-text: on a device with no mail client the tap is a silent no-op
                  // (Capacitor swallows ActivityNotFoundException), so the address must
                  // always be highlightable by hand.
                  className="press text-[13px] text-gold hover:opacity-70 truncate select-text"
                >
                  {SUPPORT_EMAIL}
                </a>
              </div>
              <p className="text-[11px] text-text-muted mt-1.5">{SUPPORT_REPLY_WINDOW}</p>
            </div>

            <div className="flex items-center justify-between gap-3 mt-4">
              <button
                type="button"
                onClick={() => setTermsOpen(true)}
                className="press text-gold text-[13px] hover:opacity-70 cursor-pointer"
              >
                Terms &amp; Privacy →
              </button>
              <a
                href={supportMailto(user?.email)}
                className="press text-[12px] text-text-muted hover:text-gold"
              >
                Need help?
              </a>
            </div>
          </Card>

          {/* ── Actions — both quiet; nothing here competes with the hero ───── */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={() => leave(() => navigate('/onboarding'))}
              className="press btn-ghost w-full"
            >
              Redo personality onboarding
            </button>
            <button
              type="button"
              onClick={() => leave(doLogout)}
              className="press text-[12px] py-3 text-text-muted hover:text-text-secondary cursor-pointer"
            >
              Log out
            </button>
          </div>
        </div>

        {termsOpen && (
          <TermsSheet onClose={() => setTermsOpen(false)} userEmail={user?.email} />
        )}
        {pendingExit && (
          <UnsavedDialog
            saving={saving}
            onSave={saveThenLeave}
            onDiscard={discardThenLeave}
            onCancel={() => setPendingExit(null)}
          />
        )}
        {toast && <div className="toast-rizzing">{toast}</div>}
      </div>
    </div>
  )
}
