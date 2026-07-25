import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useProfileStore } from '../../store/profileStore'
import { useMatchStore } from '../../store/matchStore'
import TermsContent from '../../components/TermsContent'

// Persona axes → display labels (sentence case per design rules). Keys match the
// personality_profiles columns loaded into profileStore.
const AXES = [
  { key: 'confidence', label: 'Confidence' },
  { key: 'humor', label: 'Humor' },
  { key: 'persistence', label: 'Persistence' },
  { key: 'emotional_tone', label: 'Emotional tone' },
  { key: 'escalation', label: 'Escalation' },
  { key: 'boldness', label: 'Boldness' },
  { key: 'sarcasm', label: 'Sarcasm' },
]

// Editable preference buckets → the text values stored in the schema.
const HINGLISH_CHOICES = [
  { value: 'low', label: 'English' },
  { value: 'medium', label: 'Mix' },
  { value: 'high', label: 'Hinglish' },
]
const EMOJI_CHOICES = [
  { value: 'never', label: 'Rarely' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'always', label: 'A lot' },
]

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}

function Card({ title, children }) {
  return (
    <section className="card-rizzing btn-shadow p-5">
      {title && (
        <h2 className="text-text-secondary text-[11px] tracking-[0.18em] uppercase opacity-60 mb-4">
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}

function ChoiceRow({ choices, value, onSelect }) {
  return (
    <div className="flex gap-2">
      {choices.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onSelect(c.value)}
          className={`press flex-1 text-[13px] py-2 rounded-lg border cursor-pointer transition-all ${
            value === c.value
              ? 'pill-selected'
              : 'border-white/[0.08] text-text-secondary hover:text-text-primary'
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  )
}

function TermsSheet({ onClose }) {
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
        <button type="button" onClick={onClose} className="btn-gold lift-gold mt-5">
          Close
        </button>
      </div>
    </>
  )
}

export default function ProfileScreen() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)
  const profile = useProfileStore()

  const [animated, setAnimated] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [savingPref, setSavingPref] = useState(false)

  // Fill the bars from 0 → value on mount for a gentle reveal.
  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 60)
    return () => clearTimeout(t)
  }, [])

  const name = profile.full_name || user?.email?.split('@')[0] || 'You'
  const initial = name.charAt(0).toUpperCase()

  /** Persist a preference change locally + to the personality_profiles row. */
  async function savePref(patch) {
    useProfileStore.setState(patch)
    if (!user?.id || savingPref) return
    setSavingPref(true)
    try {
      await supabase.from('personality_profiles').update(patch).eq('user_id', user.id)
    } catch {
      /* non-fatal — local state already reflects the choice */
    } finally {
      setSavingPref(false)
    }
  }

  async function handleLogout() {
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
            onClick={() => navigate('/')}
            aria-label="Back to home"
            className="press icon-chip w-9 h-9 text-text-primary opacity-70 hover:opacity-100 cursor-pointer"
          >
            <BackIcon />
          </button>
          <p className="font-display text-lg text-text-primary">Profile</p>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* Identity */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-gold/80 to-gold/40 flex items-center justify-center text-black font-bold text-2xl font-display shrink-0 shadow-[0_6px_20px_rgba(212,168,67,0.3)]">
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-medium text-text-primary truncate">{name}</p>
              <p className="text-[13px] text-text-muted truncate">{user?.email ?? '—'}</p>
            </div>
          </div>

          {/* Rizz persona */}
          <Card title="Your rizz persona">
            <div className="flex flex-col gap-3.5">
              {AXES.map(({ key, label }) => {
                const value = typeof profile[key] === 'number' ? profile[key] : 0.5
                return (
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
                )
              })}
            </div>
            <p className="text-text-muted text-[11px] leading-relaxed mt-4">
              This grows as you pick replies — we learn your style from what you send.
            </p>
          </Card>

          {/* Preferences */}
          <Card title="Preferences">
            <p className="text-[13px] text-text-secondary mb-2">Language mix</p>
            <ChoiceRow
              choices={HINGLISH_CHOICES}
              value={profile.hinglish_ratio}
              onSelect={(v) => savePref({ hinglish_ratio: v })}
            />
            <p className="text-[13px] text-text-secondary mt-5 mb-2">Emoji use</p>
            <ChoiceRow
              choices={EMOJI_CHOICES}
              value={profile.emoji_frequency}
              onSelect={(v) => savePref({ emoji_frequency: v })}
            />
            {profile.preferred_emojis?.length > 0 && (
              <p className="text-[13px] text-text-muted mt-4">
                Go-to emojis: <span className="text-text-primary">{profile.preferred_emojis.join(' ')}</span>
              </p>
            )}
          </Card>

          {/* Account */}
          <Card title="Account">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-text-secondary">Email</span>
              <span className="text-[13px] text-text-primary truncate ml-4">{user?.email ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="text-[13px] text-text-secondary">Plan</span>
              <span className="text-[11px] tracking-wide px-2.5 py-1 rounded-full border border-white/[0.1] text-text-muted">
                Free · ad-supported
              </span>
            </div>
            <p className="text-text-muted text-[11px] mt-2">Ad-free subscription coming soon.</p>
            <button
              type="button"
              onClick={() => setTermsOpen(true)}
              className="press text-gold text-[13px] mt-4 hover:opacity-70 cursor-pointer"
            >
              Terms &amp; Privacy →
            </button>
          </Card>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={() => navigate('/onboarding')}
              className="press lift text-[13px] py-3 rounded-xl border border-white/[0.1] text-text-secondary hover:text-text-primary hover:border-gold/30 cursor-pointer"
            >
              Redo personality onboarding
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="press text-[13px] py-3 rounded-xl text-bold hover:opacity-80 cursor-pointer"
              style={{ color: 'var(--color-bold)' }}
            >
              Log out
            </button>
          </div>
        </div>

        {termsOpen && <TermsSheet onClose={() => setTermsOpen(false)} />}
      </div>
    </div>
  )
}
