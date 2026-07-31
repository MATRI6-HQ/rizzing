import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const REPLIES = {
  safe: 'Safe opener here',
  witty: 'Witty opener here',
  bold: 'Bold opener here',
}

// Offline: the screen's only backend call is the standalone generate-replies wrapper.
vi.mock('../lib/api', () => ({ generatePromptReply: vi.fn() }))

import PromptReplierScreen from '../screens/PromptReplier/PromptReplierScreen'
import { generatePromptReply } from '../lib/api'
import { useMatchStore } from '../store/matchStore'

const PROMPT = 'The way to win me over is'
const ANSWER = 'going on long walks under the Bougainville trees'

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/prompt-replier']}>
      <PromptReplierScreen />
    </MemoryRouter>,
  )
}

function fill(prompt = PROMPT, answer = ANSWER) {
  fireEvent.change(screen.getByLabelText('Her prompt'), { target: { value: prompt } })
  fireEvent.change(screen.getByLabelText('Her answer'), { target: { value: answer } })
}

async function generate() {
  fill()
  fireEvent.click(screen.getByRole('button', { name: 'Get openers' }))
  await screen.findByText('Safe opener here')
}

beforeEach(() => {
  useMatchStore.setState({ matches: [], activeMatch: null, loading: false })
  vi.clearAllMocks()
  // clearAllMocks wipes calls but NOT implementations, so a mockRejectedValue set by an
  // error test would leak into every test after it. Re-arm the happy path each time.
  generatePromptReply.mockResolvedValue(REPLIES)
})

describe('PromptReplierScreen', () => {
  it('renders both inputs and nothing else to fill in', () => {
    const { container } = renderScreen()
    expect(screen.getByLabelText('Her prompt')).toBeInTheDocument()
    expect(screen.getByLabelText('Her answer')).toBeInTheDocument()
    expect(container.querySelectorAll('input')).toHaveLength(2)
    // Screenshot/OCR stayed dropped — no file input, no tabs.
    expect(container.querySelector('input[type="file"]')).toBeNull()
  })

  it('needs both fields before it will generate', () => {
    renderScreen()
    const button = screen.getByRole('button', { name: 'Get openers' })
    expect(button).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Her prompt'), { target: { value: PROMPT } })
    expect(button).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Her answer'), { target: { value: ANSWER } })
    expect(button).toBeEnabled()
  })

  // The two fields go to the backend as two labelled fields. They are NOT concatenated
  // client-side: the Edge Function's prompt template is what states "this is a profile
  // prompt and her answer to it", and it can only do that if it receives them apart.
  it('submits the prompt and the answer as separate fields', async () => {
    renderScreen()
    await generate()

    expect(generatePromptReply).toHaveBeenCalledTimes(1)
    expect(generatePromptReply.mock.calls[0][0]).toMatchObject({
      prompt: PROMPT,
      answer: ANSWER,
    })
    // No match is involved — this flow is standalone by design.
    expect(generatePromptReply.mock.calls[0][0].match_id).toBeUndefined()
  })

  it('trims whitespace off both fields before sending', async () => {
    renderScreen()
    fill(`  ${PROMPT}  `, `  ${ANSWER}\n`)
    fireEvent.click(screen.getByRole('button', { name: 'Get openers' }))

    await waitFor(() => expect(generatePromptReply).toHaveBeenCalledTimes(1))
    expect(generatePromptReply.mock.calls[0][0]).toMatchObject({
      prompt: PROMPT,
      answer: ANSWER,
    })
  })

  it('renders the three openers as tone-tagged reply bubbles', async () => {
    renderScreen()
    await generate()

    expect(screen.getByText('Safe')).toBeInTheDocument()
    expect(screen.getByText('Witty')).toBeInTheDocument()
    expect(screen.getByText('Bold')).toBeInTheDocument()
    expect(screen.getByText('Witty opener here')).toBeInTheDocument()
    expect(screen.getByText('Bold opener here')).toBeInTheDocument()
  })

  it('selecting an opener only highlights it — Copy is the explicit action', async () => {
    renderScreen()
    await generate()

    expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled()
    fireEvent.click(screen.getByText('Bold opener here'))
    expect(screen.getByRole('button', { name: 'Copy' })).toBeEnabled()
    // Still on screen, nothing dismissed.
    expect(screen.getByText('Safe opener here')).toBeInTheDocument()
  })

  it('Copy puts the selected opener on the clipboard', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    renderScreen()
    await generate()
    fireEvent.click(screen.getByText('Witty opener here'))
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Witty opener here'))
    expect(await screen.findByText(/witty opener copied/)).toBeInTheDocument()
  })

  // Unlike ConversationFlow there is no thread to fall back on, so the inputs must stay
  // editable after a generation or the user cannot fix a typo and retry.
  it('keeps both inputs editable after generating so the pair can be tweaked', async () => {
    renderScreen()
    await generate()

    expect(screen.getByLabelText('Her prompt')).toHaveValue(PROMPT)
    fireEvent.change(screen.getByLabelText('Her answer'), { target: { value: 'hiking alone' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate another' }))

    await waitFor(() => expect(generatePromptReply).toHaveBeenCalledTimes(2))
    expect(generatePromptReply.mock.calls[1][0].answer).toBe('hiking alone')
  })

  it('surfaces a failure inline and leaves the inputs intact for a retry', async () => {
    generatePromptReply.mockRejectedValueOnce(new Error('The assistant is busy right now.'))
    renderScreen()
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Get openers' }))

    expect(await screen.findByText('The assistant is busy right now.')).toBeInTheDocument()
    expect(screen.getByLabelText('Her prompt')).toHaveValue(PROMPT)
    expect(screen.getByLabelText('Her answer')).toHaveValue(ANSWER)
  })

  it('offers the support address after repeated failures', async () => {
    generatePromptReply.mockRejectedValue(new Error('nope'))
    renderScreen()
    fill()

    for (let attempt = 0; attempt < 2; attempt++) {
      fireEvent.click(screen.getByRole('button', { name: 'Get openers' }))
      // eslint-disable-next-line no-await-in-loop
      await waitFor(() => expect(generatePromptReply).toHaveBeenCalledTimes(attempt + 1))
    }

    expect(await screen.findByText('hq@matri6.com')).toBeInTheDocument()
  })

  // Throwaway by design (CLAUDE.md): no match row, no Supabase write, nothing in the
  // matches list. This test is the guard against someone "helpfully" wiring it up.
  it('never touches matchStore', async () => {
    renderScreen()
    await generate()
    fireEvent.click(screen.getByText('Safe opener here'))
    expect(useMatchStore.getState().matches).toEqual([])
  })
})
