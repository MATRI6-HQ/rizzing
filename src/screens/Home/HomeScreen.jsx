import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTransitionNavigate } from '../../components/PageTransition'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useMatchStore } from '../../store/matchStore'
import { usePreviousChatStore } from '../../store/previousChatStore'
import Wordmark from '../../components/Wordmark'
import FooterNav from '../../components/FooterNav'
import EntryModeSheet from './EntryModeSheet'
import AddMenuSheet from './AddMenuSheet'

// How long a finger has to stay down before the card's action menu opens. 500ms is the
// platform convention (Android's ViewConfiguration long-press timeout) — shorter and a
// slow tap opens the menu instead of the chat.
const LONG_PRESS_MS = 500

// ── Inline icons (no icon library) ───────────────────────────────────────────
function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-30 shrink-0">
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

function KebabIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
      <circle cx="12" cy="5" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="12" cy="19" r="1.7" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  )
}

// RIZZING puzzle-piece brand mark (public asset /1.jpg — same image as the favicon).
const LOGO_SRC = '/1.jpg'

// ── Match card ───────────────────────────────────────────────────────────────
/**
 * Three ways into the action menu, because the app ships to two input models at once:
 * the kebab (discoverable on web, and the only one a mouse user will find), long-press
 * (what an Android user reaches for first), and right-click.
 *
 * The long-press fires while the finger is still down, and lifting it produces a click —
 * which would open the chat on top of the menu that just opened. `suppressClickRef`
 * swallows exactly that one click. It's a ref, not state: it has to be readable in the
 * click handler of the same gesture, before any re-render.
 */
function MatchCard({ match, onOpen, index, menuOpen, onMenuOpen, onMenuClose, onDelete }) {
  const preview = match.last_message_preview
  const initial = match.name?.charAt(0)?.toUpperCase() ?? '?'
  const pressTimerRef = useRef(null)
  const suppressClickRef = useRef(false)

  const cancelPress = () => clearTimeout(pressTimerRef.current)
  // Navigating away mid-press would otherwise fire the timer into a dead component.
  useEffect(() => cancelPress, [])

  function startPress() {
    cancelPress()
    pressTimerRef.current = setTimeout(() => {
      suppressClickRef.current = true
      onMenuOpen()
    }, LONG_PRESS_MS)
  }

  function handleClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    onOpen()
  }

  return (
    <div className="relative">
      <div
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault()
          onMenuOpen()
        }}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        onTouchMove={cancelPress}
        onTouchCancel={cancelPress}
        className="press lift card-elevated p-4 cursor-pointer hover:border-white/10 flex items-center gap-3 select-none"
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
        <button
          type="button"
          aria-label={`More options for ${match.name}`}
          onClick={(e) => {
            // Without this the card's own onClick also runs and opens the chat.
            e.stopPropagation()
            onMenuOpen()
          }}
          className="press icon-chip w-8 h-8 text-text-secondary opacity-40 hover:opacity-100 cursor-pointer"
        >
          <KebabIcon />
        </button>
        <div className="icon-chip w-8 h-8 text-text-primary">
          <ChevronIcon />
        </div>
      </div>

      {menuOpen && (
        <>
          {/* Click-anywhere-else to dismiss. Fixed and full-bleed so it also covers the
              other cards — otherwise dismissing the menu would open a different chat. */}
          <div className="fixed inset-0 z-40" onClick={onMenuClose} aria-hidden="true" />
          <div role="menu" aria-label={`Actions for ${match.name}`} className="card-menu">
            <button
              type="button"
              role="menuitem"
              onClick={onDelete}
              className="press card-menu__item"
            >
              <TrashIcon />
              Delete conversation
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/** Destructive confirm — same centred-dialog shape as ProfileScreen's UnsavedDialog. */
function DeleteMatchDialog({ match, deleting, error, onConfirm, onCancel }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Delete conversation"
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[86%] max-w-[340px] z-[60] card-elevated p-5"
      >
        <h3 className="font-display text-lg text-text-primary">Delete conversation?</h3>
        <p className="text-[13px] text-text-secondary mt-2 leading-relaxed">
          {match.name} disappears from your matches. Nothing is sent to her.
        </p>
        <div className="flex flex-col gap-2 mt-5">
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="press btn-danger"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <button type="button" onClick={onCancel} disabled={deleting} className="press btn-ghost">
            Cancel
          </button>
        </div>
        {error && <p className="text-red-400 text-xs tracking-wide mt-3 text-center">{error}</p>}
      </div>
    </>
  )
}

// ── Screen ───────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const navigate = useTransitionNavigate()
  const user = useAuthStore((s) => s.user)
  const matches = useMatchStore((s) => s.matches)

  const [loading, setLoading] = useState(true)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [sheetError, setSheetError] = useState('')
  const [entryMatch, setEntryMatch] = useState(null)
  const [menuMatchId, setMenuMatchId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const removeMatch = useMatchStore((s) => s.removeMatch)
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
  // reopen it. It lands on the same fork the local + opens, not on the add sheet
  // directly, so the two entry points can't drift apart.
  useEffect(() => {
    if (searchParams.get('add') !== '1') return
    setAddMenuOpen(true)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  function closeSheet() {
    setSheetOpen(false)
    setSheetError('')
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    setDeleteError('')
    try {
      await removeMatch(deleteTarget.id)
      setDeleteTarget(null)
    } catch (err) {
      // The store already put the card back; the dialog stays open to say why.
      setDeleteError(err?.message ?? 'Could not delete this conversation')
    } finally {
      setDeleting(false)
    }
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
              onClick={() => setAddMenuOpen(true)}
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
                <MatchCard
                  key={m.id}
                  match={m}
                  index={i}
                  onOpen={() => setEntryMatch(m)}
                  menuOpen={menuMatchId === m.id}
                  onMenuOpen={() => setMenuMatchId(m.id)}
                  onMenuClose={() => setMenuMatchId(null)}
                  onDelete={() => {
                    setMenuMatchId(null)
                    setDeleteError('')
                    setDeleteTarget(m)
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Bottom nav — its centre + is the primary "add" action, which is why the
            corner .fab-extended that used to live here is gone. It forks into
            AddMenuSheet rather than opening the add-match sheet directly. */}
        <FooterNav active="home" onAdd={() => setAddMenuOpen(true)} />

        {/* + fork: new conversation vs. prompt replier */}
        {addMenuOpen && (
          <AddMenuSheet
            onClose={() => setAddMenuOpen(false)}
            onNewConversation={() => {
              setAddMenuOpen(false)
              setSheetOpen(true)
            }}
            onPromptReplier={() => {
              setAddMenuOpen(false)
              navigate('/prompt-replier')
            }}
          />
        )}

        {/* Delete confirm */}
        {deleteTarget && (
          <DeleteMatchDialog
            match={deleteTarget}
            deleting={deleting}
            error={deleteError}
            onConfirm={handleDelete}
            onCancel={() => {
              setDeleteTarget(null)
              setDeleteError('')
            }}
          />
        )}

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
