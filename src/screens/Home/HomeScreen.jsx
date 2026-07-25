import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useMatchStore } from '../../store/matchStore'
import { usePreviousChatStore } from '../../store/previousChatStore'
import EntryModeSheet from './EntryModeSheet'

// ── Inline icons (no icon library) ───────────────────────────────────────────
function PersonIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-30 shrink-0">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

// RIZZING puzzle-piece brand mark (public asset /1.jpg — same image as the favicon).
const LOGO_SRC = '/1.jpg'

// ── Match card ───────────────────────────────────────────────────────────────
function MatchCard({ match, onOpen }) {
  const preview = match.last_message_preview
  const initial = match.name?.charAt(0)?.toUpperCase() ?? '?'
  return (
    <div
      onClick={onOpen}
      className="press lift btn-shadow card-rizzing p-4 cursor-pointer hover:border-white/10 flex items-center gap-4"
    >
      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-gold/80 to-gold/40 flex items-center justify-center text-black font-bold text-lg font-display shrink-0 shadow-[0_4px_14px_rgba(212,168,67,0.25)]">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-text-primary tracking-wide truncate">{match.name}</p>
        {preview ? (
          <p className="text-[13px] text-text-primary opacity-35 truncate mt-0.5">{preview}</p>
        ) : (
          <p className="text-[13px] text-gold opacity-40 truncate mt-0.5">Start a conversation →</p>
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
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const matches = useMatchStore((s) => s.matches)

  const [loading, setLoading] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [sheetError, setSheetError] = useState('')
  const [entryMatch, setEntryMatch] = useState(null)
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
        {/* Top bar — RIZZING puzzle-piece logo on the left, profile on the right */}
        <header className="h-14 px-6 flex items-center justify-between border-b border-white/[0.04]">
          <img
            src={LOGO_SRC}
            alt="RIZZING"
            className="h-9 w-9 rounded-lg object-cover shrink-0"
          />
          <button
            type="button"
            onClick={() => navigate('/profile')}
            aria-label="Profile"
            className="press icon-chip w-10 h-10 text-text-primary opacity-70 hover:opacity-100 cursor-pointer"
          >
            <PersonIcon />
          </button>
        </header>

        {/* Content */}
        {loading ? (
          <div className="flex-1 px-6 pt-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card-rizzing h-[72px] animate-pulse opacity-30" />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center pb-24">
            <img
              src={LOGO_SRC}
              alt="RIZZING"
              className="h-16 w-16 rounded-2xl object-cover opacity-70 shadow-[0_0_0_1px_rgba(212,168,67,0.12),0_4px_20px_rgba(212,168,67,0.15)]"
            />
            <p className="font-display text-xl text-text-primary mt-4 opacity-60">No matches yet</p>
            <p className="text-[13px] tracking-widest uppercase opacity-25 mt-2">
              Tap + to add your first match
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 pt-4 pb-24 space-y-3">
            {matches.map((m) => (
              <MatchCard key={m.id} match={m} onOpen={() => setEntryMatch(m)} />
            ))}
          </div>
        )}

        {/* FAB */}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-label="Add match"
          className="press lift-gold absolute bottom-6 right-6 w-[52px] h-[52px] rounded-full bg-gold shadow-[0_6px_28px_rgba(212,168,67,0.4)] flex items-center justify-center text-black cursor-pointer"
        >
          <PlusIcon />
        </button>

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
