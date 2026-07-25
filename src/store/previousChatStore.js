import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Per-match chat state, persisted to localStorage (key `rizzing-continue-previous`) so
// the "continue previous" slot survives a page refresh. Turn shape:
//   { role: 'incoming' | 'outgoing', text, tone? }
//
// Each match has:
//   active — the live working thread ConversationFlow renders + appends to.
//   slot   — the ONE durable "continue previous" snapshot:
//            { messages: Turn[], savedAt: ISO_string, preview: string } | null
//
// Save rule (one slot per person, each save overwrites): the active thread is copied
// into slot whenever the user leaves it — on Send, on back/navigate-away (ConversationFlow
// unmount), and before starting a fresh session (startFresh). An empty active never
// overwrites a real slot. Loading rule: continuePrevious restores slot.messages → active.

/** Build the slot payload from a thread. Preview = last message's text (trimmed). */
function makeSlot(messages) {
  const last = messages[messages.length - 1]
  return {
    messages,
    savedAt: new Date().toISOString(),
    preview: last?.text?.trim() ?? '',
  }
}

export const usePreviousChatStore = create(
  persist(
    (set, get) => ({
      sessions: {}, // { [matchId]: { active: Turn[], slot: SlotOrNull } }

      getActive: (matchId) => get().sessions[matchId]?.active ?? [],
      getSlot: (matchId) => get().sessions[matchId]?.slot ?? null,

      /** Copy the active thread into the durable slot. No-op if active is empty, so
       *  leaving an untouched session never wipes a real "continue previous". */
      saveContinuePrevious: (matchId) =>
        set((s) => {
          const existing = s.sessions[matchId]
          const active = existing?.active ?? []
          if (active.length === 0) return s // guard: don't overwrite with nothing
          return {
            sessions: {
              ...s.sessions,
              [matchId]: { active, slot: makeSlot(active) },
            },
          }
        }),

      /** Context / New topic: archive whatever was active into the slot, then clear active. */
      startFresh: (matchId) =>
        set((s) => {
          const existing = s.sessions[matchId]
          const active = existing?.active ?? []
          const slot = active.length ? makeSlot(active) : existing?.slot ?? null
          return {
            sessions: { ...s.sessions, [matchId]: { active: [], slot } },
          }
        }),

      /** Continue previous: load the slot's messages back into active (slot untouched). */
      continuePrevious: (matchId) =>
        set((s) => {
          const existing = s.sessions[matchId]
          const slot = existing?.slot ?? null
          return {
            sessions: {
              ...s.sessions,
              [matchId]: { active: slot ? [...slot.messages] : [], slot },
            },
          }
        }),

      /** Push a turn onto the active thread. */
      appendTurn: (matchId, turn) =>
        set((s) => {
          const existing = s.sessions[matchId] ?? { active: [], slot: null }
          return {
            sessions: {
              ...s.sessions,
              [matchId]: { ...existing, active: [...existing.active, turn] },
            },
          }
        }),
    }),
    { name: 'rizzing-continue-previous' },
  ),
)
