import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTransitionNavigate } from '../../components/PageTransition'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useMatchStore } from '../../store/matchStore'
import { usePreviousChatStore } from '../../store/previousChatStore'
import Wordmark from '../../components/Wordmark'
import FooterNav from '../../components/FooterNav'
import EntryModeSheet from './EntryModeSheet'

// ── Inline icons (no icon library) ───────────────────────────────────────────
function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-30 shrink-0">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

// RIZZING puzzle-piece brand mark (public asset /1.jpg — same image as the favicon).
const LOGO_SRC = '/1.jpg'

// ── Match card ───────────────────────────────────────────────────────────────
function MatchCard({ match, onOpen, index }) {
  const preview = match.last_message_preview
  const initial = match.name?.charAt(0)?.toUpperCase() ?? '?'
  return (
    <div
      onClick={onOpen}
      className="press lift card-elevated p-4 cursor-pointer hover:border-white/10 flex items-center gap-4"
      // Staggered entrance: the list arrives as a sequence, not a slab.
      style={{ animation: `page-enter 320ms ease-out ${index * 45}ms backwards` }}
    >
      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-gold/80 to-gold/40 flex items-center justify-center text-black font-bold text-lg font-display shrink-0 shadow-[0_4px_14px_rgba(212,168,67,0.25)]">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-text-primary truncate">{match.name}</p>
        {preview ? (
          <p className="text-[13px] text-text-secondary opacity-70 truncate mt-0.5">{preview}</p>
        ) : (
          <p className="text-[12px] tracking-[0.1em] uppercase text-gold opacity-55 truncate mt-1">
            Start a conversation
          </p>
        )}
      </div>
      <div className="icon-chip w-8 h-8 text-text-primary">
        <ChevronIcon />
      </div>
    </div>
  )
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const navigate = useTransitionNavigate()
  const user = useAuthStore((s) => s.user)
  const matches = useMatchStore((s) => s.matches)

  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [sheetError, setSheetError] = useState('')
  const [entryMatch, setEntryMatch] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const getSlot = usePreviousChatStore((s) => s.getSlot)
  const startFresh = usePreviousChatStore((s) => s.startFresh)
  const continuePrevious = usePreviousChatStore((s) => s.continuePrevious)

  // Fetch active matches on mount (newest first). is_active is the real soft-delete
  // column (CLAUDE.md schema); the task's "soft_deleted" maps to it inverted.
  useEffect(() => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (!error) useMatchStore.setState({ matches: data ?? [] })
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  // The footer's + on Refer has no sheet of its own, so it routes here with ?add=1.
  // The param is consumed immediately (replace, so it leaves no history entry) —
  // otherwise closing the sheet would leave ?add=1 in the URL and a refresh would
  // reopen it.
  useEffect(() => {
    if (searchParams.get('add') !== '1') return
    setSheetOpen(true)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  function closeSheet() {
    setSheetOpen(false)
    setSheetError('')
  }

  function handleEntrySelect(mode) {
    if (mode === 'continue') {
      continuePrevious(entryMatch.id)
    } else {
      startFresh(entryMatch.id)
    }
    const matchId = entryMatch.id
    setEntryMatch(null)
    navigate(`/conversation?matchId=${matchId}&mode=${mode}`)
  }

  async function handleAdd() {
    const trimmed = newName.trim()
    if (trimmed === '' || adding) return
    setSheetError('')
    setAdding(true)
    try {
      const { data, error } = await supabase
        .from('matches')
        .insert({ user_id: user?.id, name: trimmed })
        .select()
        .single()
      if (error) throw error
      // Prepend the new match locally.
      useMatchStore.setState((s) => ({ matches: [data, ...s.matches] }))
      setNewName('')
      closeSheet()
    } catch (err) {
      setSheetError(err?.message ?? 'Could not add match')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="min-h-screen bg-ambient flex items-center justify-center">
      <div className="app-shell flex flex-col relative overflow-hidden">
        {/* Top bar — the RIZZING wordmark. The profile button that used to sit on the
            right moved into FooterNav: two entry points to /profile on one screen is
            one too many, and the footer is the screen's nav now. */}
        <header className="h-14 px-6 flex items-center justify-center border-b border-white/[0.04] shrink-0">
          <Wordmark />
        </header>

        {/* Content */}
        {loading ? (
          <div className="flex-1 px-6 pt-8 space-y-3">
            {/* Skeletons, not a spinner: the shape of what's coming is already known. */}
            <div className="skeleton h-7 w-44 rounded-lg mb-7" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-[76px]" />
            ))}
          </div>
        ) : matches.length === 0 ? (
          // Empty state owns the primary action outright, so the FAB stands down and
          // there is exactly one gold thing on screen to press.
          <div className="flex-1 flex flex-col items-center justify-center px-8 pb-16 relative text-center">
            <div className="hero-glow" aria-hidden="true" />
            <img
              src={LOGO_SRC}
              alt="RIZZING"
              className="relative h-16 w-16 rounded-2xl object-cover shadow-[0_0_0_1px_rgba(212,168,67,0.16),0_8px_30px_rgba(212,168,67,0.2)]"
            />
            <h1 className="relative font-display text-[28px] leading-tight text-text-primary mt-6">
              No matches yet
            </h1>
            <p className="relative text-[14px] text-text-secondary mt-3 leading-relaxed max-w-[280px]">
              Add whoever you're talking to. Paste her message, get three replies in your
              voice, send the one that sounds like you.
            </p>
            {/* Ghost, not gold: the footer's + is the screen's one gold control now.
                The affordance stays (a new user still gets a button to press) without
                putting two primaries on the same screen. */}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="press btn-ghost mt-8 px-6"
            >
              Add your first match
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 pt-7 pb-6">
            {/* Hero — one display moment, then the list. */}
            <div className="relative mb-7">
              <div className="hero-glow" aria-hidden="true" />
              <h1 className="relative font-display text-[30px] leading-tight text-text-primary">
                Your matches
              </h1>
              <p className="relative text-[12px] tracking-[0.16em] uppercase text-text-muted mt-1.5">
                {matches.length} {matches.length === 1 ? 'conversation' : 'conversations'}
              </p>
            </div>
            <div className="space-y-3">
              {matches.map((m, i) => (
                <MatchCard key={m.id} match={m} index={i} onOpen={() => setEntryMatch(m)} />
              ))}
            </div>
          </div>
        )}

        {/* Bottom nav — its centre + is the primary "add match" action, which is why
            the corner .fab-extended that used to live here is gone. */}
        <FooterNav active="home" onAdd={() => setSheetOpen(true)} />

        {/* 3-mode entry sheet */}
        {entryMatch && (
          <EntryModeSheet
            match={entryMatch}
            previousSlot={getSlot(entryMatch.id)}
            onClose={() => setEntryMatch(null)}
            onSelect={handleEntrySelect}
          />
        )}

        {/* Add-match bottom sheet */}
        {sheetOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
              onClick={closeSheet}
              aria-hidden="true"
            />
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] z-50 bg-[#141414] rounded-t-3xl px-6 pt-5 pb-10 border-t border-white/[0.06]">
              <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-6" />
              <h2 className="font-display text-xl text-text-primary">New match</h2>
              <p className="text-xs tracking-widest uppercase opacity-30 mt-1 mb-6">
                Who are you talking to?
              </p>
              <input
                className="input-rizzing"
                placeholder="Her name or nickname"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={adding || newName.trim() === ''}
                className="btn-gold lift-gold mt-4"
              >
                {adding ? 'Adding…' : 'Add match'}
              </button>
              {sheetError && <p className="text-red-400 text-xs tracking-wide mt-2">{sheetError}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
