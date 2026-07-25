import { describe, it, expect, beforeEach } from 'vitest'
import { usePreviousChatStore } from '../store/previousChatStore'

const store = () => usePreviousChatStore.getState()

const A = { role: 'incoming', text: 'hey there' }
const B = { role: 'outgoing', text: 'hey yourself 😏', tone: 'witty' }
const C = { role: 'incoming', text: 'so when do we meet?' }

beforeEach(() => {
  usePreviousChatStore.setState({ sessions: {} })
})

describe('previousChatStore — continue-previous slot', () => {
  it('a brand-new match has no slot (Continue previous stays empty)', () => {
    expect(store().getSlot('m1')).toBeNull()
  })

  it('saveContinuePrevious on exit copies the active thread into the slot with a preview', () => {
    store().appendTurn('m1', A)
    store().appendTurn('m1', B)
    store().saveContinuePrevious('m1')

    const slot = store().getSlot('m1')
    expect(slot.messages).toEqual([A, B])
    expect(slot.preview).toBe('hey yourself 😏')
    expect(typeof slot.savedAt).toBe('string')
  })

  it('an empty active never overwrites a real slot', () => {
    store().appendTurn('m1', A)
    store().saveContinuePrevious('m1') // slot = [A]
    // Simulate landing in a fresh session (active cleared) then leaving without chatting.
    store().startFresh('m1') // slot stays [A], active cleared
    store().saveContinuePrevious('m1') // active empty → no-op
    expect(store().getSlot('m1').messages).toEqual([A])
  })

  it('continuePrevious loads the slot messages back into the active thread', () => {
    store().appendTurn('m1', A)
    store().appendTurn('m1', B)
    store().saveContinuePrevious('m1')
    store().startFresh('m1') // active now empty, slot = [A, B]
    expect(store().getActive('m1')).toEqual([])

    store().continuePrevious('m1')
    expect(store().getActive('m1')).toEqual([A, B])
    // Slot is untouched by loading.
    expect(store().getSlot('m1').messages).toEqual([A, B])
  })

  it('overwrite rule: a newer exchange after "New topic" becomes the new slot', () => {
    store().appendTurn('m1', A)
    store().saveContinuePrevious('m1') // slot = [A]
    store().startFresh('m1') // new topic
    store().appendTurn('m1', B)
    store().appendTurn('m1', C)
    store().saveContinuePrevious('m1') // exit → slot = [B, C]

    const slot = store().getSlot('m1')
    expect(slot.messages).toEqual([B, C])
    expect(slot.preview).toBe('so when do we meet?')
  })

  it('slots are keyed per match — one match never leaks into another', () => {
    store().appendTurn('m1', A)
    store().saveContinuePrevious('m1')
    expect(store().getSlot('m2')).toBeNull()
  })
})
