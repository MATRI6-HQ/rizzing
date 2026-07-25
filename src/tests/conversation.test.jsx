import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// The screen now calls the real Edge Function wrappers — mock them so tests stay offline.
vi.mock('../lib/api', () => ({
  generateReplies: vi.fn(async () => ({
    safe: 'Safe reply here',
    witty: 'Witty reply here',
    bold: 'Bold reply here',
  })),
  processScreenshot: vi.fn(async () => ({ extracted_text: 'extracted from screenshot' })),
  updateWeights: vi.fn(async () => ({ success: true })),
}))

// Auto-chaining mock: every query-builder method returns the same thenable object,
// so `.select().eq().single()` (or any other chain) resolves without a real network call.
vi.mock('../lib/supabase', () => {
  const chain = {}
  ;['select', 'eq', 'order', 'insert', 'upsert', 'single'].forEach((m) => {
    chain[m] = () => chain
  })
  chain.then = (resolve) => resolve({ data: null, error: null, count: 0 })
  return { supabase: { from: () => chain } }
})

import ConversationFlow, { detectStage } from '../screens/Conversation/ConversationFlow'
import { generateReplies } from '../lib/api'
import { useMatchStore } from '../store/matchStore'
import { usePreviousChatStore } from '../store/previousChatStore'

function renderFlow(matchId, mode) {
  const params = new URLSearchParams()
  if (matchId) params.set('matchId', matchId)
  if (mode) params.set('mode', mode)
  const path = params.toString() ? `/conversation?${params}` : '/conversation'
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ConversationFlow />
    </MemoryRouter>,
  )
}

async function generate(message = 'so when are we meeting?') {
  fireEvent.change(screen.getByPlaceholderText('Paste or type her message…'), {
    target: { value: message },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Generate replies' }))
  await screen.findByText('Safe reply here')
}

beforeEach(() => {
  useMatchStore.setState({ matches: [], activeMatch: null, loading: false })
  usePreviousChatStore.setState({ sessions: {} })
  vi.clearAllMocks()
})

describe('detectStage (rule-based)', () => {
  it('maps turn counts to the right stage', () => {
    expect(detectStage(0).label).toBe('Cold Open')
    expect(detectStage(2).label).toBe('Cold Open')
    expect(detectStage(3).label).toBe('Rapport')
    expect(detectStage(6).label).toBe('Rapport')
    expect(detectStage(7).label).toBe('Connection')
    expect(detectStage(12).label).toBe('Connection')
    expect(detectStage(13).label).toBe('Escalation')
    expect(detectStage(99).label).toBe('Escalation')
  })
})

describe('ConversationFlow', () => {
  it('renders without crashing — single messenger composer, no input tabs', () => {
    // No matchId → the mount fetch short-circuits, so no Supabase call is made.
    renderFlow()
    expect(screen.getByPlaceholderText('Paste or type her message…')).toBeInTheDocument()
    expect(screen.getByText('Match')).toBeInTheDocument()
    // The Paste / Type / Screenshot tabs are gone.
    expect(screen.queryByText('Screenshot')).not.toBeInTheDocument()
    expect(screen.queryByText('Paste')).not.toBeInTheDocument()
  })

  it('disables the send/generate button until there is text', () => {
    renderFlow()
    const button = screen.getByRole('button', { name: 'Generate replies' })
    expect(button).toBeDisabled()

    fireEvent.change(screen.getByPlaceholderText('Paste or type her message…'), {
      target: { value: 'hey there' },
    })
    expect(button).not.toBeDisabled()
  })

  it('shows the stage badge and all 3 draft bubbles after generating', async () => {
    renderFlow()
    await generate()

    // turnCount defaults to 0 with no matchId → Cold Open.
    expect(screen.getByText('Cold Open')).toBeInTheDocument()
    // All three tone-tagged bubbles render from the { safe, witty, bold } shape.
    expect(screen.getByText('Safe')).toBeInTheDocument()
    expect(screen.getByText('Witty')).toBeInTheDocument()
    expect(screen.getByText('Bold')).toBeInTheDocument()
    expect(screen.getByText('Witty reply here')).toBeInTheDocument()
    expect(screen.getByText('Bold reply here')).toBeInTheDocument()
  })

  it('selecting a draft only highlights it — it does not send or clear the drafts', async () => {
    renderFlow()
    await generate()

    fireEvent.click(screen.getByText('Witty reply here'))
    // Still visible, nothing dismissed, no toast fired.
    expect(screen.getByText('Witty reply here')).toBeInTheDocument()
    expect(screen.getByText('Safe reply here')).toBeInTheDocument()
    expect(screen.queryByText(/We'll remember this/)).not.toBeInTheDocument()
  })

  it('Send stays disabled until a draft is selected', async () => {
    renderFlow()
    await generate()
    expect(screen.getByText('Send →')).toBeDisabled()
    fireEvent.click(screen.getByText('Safe reply here'))
    expect(screen.getByText('Send →')).not.toBeDisabled()
  })

  it('clicking Send commits the picked reply and clears the drafts', async () => {
    renderFlow('m1')
    await generate()
    fireEvent.click(screen.getByText('Bold reply here'))
    fireEvent.click(screen.getByText('Send →'))

    await waitFor(() => expect(screen.getByText(/Sent as bold/)).toBeInTheDocument())
    expect(screen.queryByText('Safe reply here')).not.toBeInTheDocument()
    // Committed into the persisted per-match thread.
    expect(usePreviousChatStore.getState().getActive('m1')).toEqual([
      { role: 'incoming', text: 'so when are we meeting?' },
      { role: 'outgoing', text: 'Bold reply here', tone: 'bold' },
    ])
  })

  it('Generate another re-requests fresh drafts and clears the selection', async () => {
    renderFlow()
    await generate()
    fireEvent.click(screen.getByText('Safe reply here'))
    expect(generateReplies).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByText('Generate another'))
    await waitFor(() => expect(generateReplies).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Send →')).toBeDisabled()
  })

  it('Customize folds the instruction into a fresh generate-replies call', async () => {
    renderFlow()
    await generate()

    fireEvent.click(screen.getByText('Customize'))
    fireEvent.click(screen.getByText('More flirty'))
    fireEvent.click(screen.getByText('Regenerate →'))

    await waitFor(() => expect(generateReplies).toHaveBeenCalledTimes(2))
    expect(generateReplies.mock.calls[1][0].her_message).toMatch(/More flirty/)
  })
})
