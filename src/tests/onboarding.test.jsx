import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Step 1's "Continue" (and finish) awaits Supabase writes — auto-chaining mock so any
// query chain resolves instantly without a network call.
vi.mock('../lib/supabase', () => {
  const chain = {}
  ;['select', 'eq', 'order', 'insert', 'upsert', 'maybeSingle', 'single'].forEach((m) => {
    chain[m] = () => chain
  })
  chain.then = (resolve) => resolve({ data: null, error: null })
  return { supabase: { from: () => chain } }
})

import OnboardingFlow, { computeWeights, TYPING_REVEAL_MS } from '../screens/Onboarding/OnboardingFlow'
import { useConsentStore } from '../store/consentStore'

function renderOnboarding() {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <OnboardingFlow />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  // Default: consent already given, so flow tests start at step 1. The dedicated
  // consent-gate test resets this to false.
  useConsentStore.setState({ accepted: true, version: 'test', acceptedAt: '2026-07-25' })
})

async function fillNameAndContinue() {
  fireEvent.change(screen.getByPlaceholderText('What do people call you?'), {
    target: { value: 'Dweep' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  await screen.findByText('How do you naturally text?')
}

/** Reach scenario 0: fill step 1, pick a texting style, skip emojis, dismiss the vibe check. */
async function reachFirstScenario() {
  await fillNameAndContinue()
  fireEvent.click(screen.getByText('English only'))
  fireEvent.click(screen.getByRole('button', { name: 'Next →' }))
  fireEvent.click(screen.getByText('Skip for now →'))
  fireEvent.click(screen.getByRole('button', { name: "Let's go" }))
}

/** The scenario's options only render after the typing-indicator beat elapses. */
async function waitForOptionsToReveal() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, TYPING_REVEAL_MS + 50))
  })
}

/** Pick an option (highlight only) then advance via the gold FAB. */
async function answerAndAdvance(optionMatcher) {
  await waitForOptionsToReveal()
  fireEvent.click(screen.getByText(optionMatcher))
  fireEvent.click(screen.getByRole('button', { name: 'Next scenario' }))
}

describe('Terms & Privacy consent gate', () => {
  it('gates onboarding: shows first, requires the checkbox, then reveals step 1', () => {
    useConsentStore.setState({ accepted: false, version: null, acceptedAt: null })
    renderOnboarding()

    expect(screen.getByText('Before we start')).toBeInTheDocument()
    const continueBtn = screen.getByRole('button', { name: 'Continue' })
    expect(continueBtn).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox'))
    expect(continueBtn).toBeEnabled()

    fireEvent.click(continueBtn)
    // Consent recorded + step 1 now visible.
    expect(useConsentStore.getState().accepted).toBe(true)
    expect(screen.getByText("Let's set up your profile")).toBeInTheDocument()
  })
})

describe('OnboardingFlow', () => {
  it('personal info step renders with a name input', () => {
    renderOnboarding()
    expect(screen.getByPlaceholderText('What do people call you?')).toBeInTheDocument()
    expect(screen.getByText("Let's set up your profile")).toBeInTheDocument()
  })

  it('setup progress reads "Step 1 of 3" (3 setup steps) with segmented pips', () => {
    renderOnboarding()
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()
    // Exactly one progress indicator renders — no legacy duplicate bar.
    expect(screen.getByTestId('progress-pips').children).toHaveLength(3)
  })

  it('Continue button is disabled when name is empty', () => {
    renderOnboarding()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  it('after filling name and clicking Continue, step 2 (texting style) appears', async () => {
    renderOnboarding()
    await fillNameAndContinue()
    expect(screen.getByText('How do you naturally text?')).toBeInTheDocument()
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument()
  })

  it('Skip link on the emoji step advances to scenario 1, revealed via a typing beat', async () => {
    renderOnboarding()
    await fillNameAndContinue()
    fireEvent.click(screen.getByText('English only'))
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }))
    expect(screen.getByText('How often do you use emojis?')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Skip for now →'))
    expect(screen.getByText('Quick vibe check before we start')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: "Let's go" }))

    // Message is typing before it reveals — the option text isn't there yet.
    expect(screen.queryByText(/what makes you think I'd be interested/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText('typing…')).toBeInTheDocument()

    await waitForOptionsToReveal()
    expect(screen.getByText(/what makes you think I'd be interested/i)).toBeInTheDocument()
    expect(screen.getByText('Aisha')).toBeInTheDocument()
    expect(screen.getByText('Step 1 of 7')).toBeInTheDocument()
  })

  it('picking a scenario option only highlights it — it does not auto-advance', async () => {
    renderOnboarding()
    await reachFirstScenario()
    await waitForOptionsToReveal()

    fireEvent.click(screen.getByText(/Worth a shot though/))
    // Still on scenario 0 — the FAB is what advances, not the pick itself.
    expect(screen.getByText(/what makes you think I'd be interested/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next scenario' })).not.toBeDisabled()
  }, 10000)

  it('the gold FAB is disabled until an option is picked', async () => {
    renderOnboarding()
    await reachFirstScenario()
    await waitForOptionsToReveal()
    expect(screen.getByRole('button', { name: 'Next scenario' })).toBeDisabled()
  }, 10000)

  it('Step 4 ("hmm ok") shows the reworked options', async () => {
    renderOnboarding()
    await reachFirstScenario()
    await answerAndAdvance(/Worth a shot though/) // S0
    await answerAndAdvance(/passionate about travel/) // S1
    await answerAndAdvance(/seeing where things go/) // S2

    await waitForOptionsToReveal()
    expect(screen.getByText('hmm ok 🙂')).toBeInTheDocument()
    expect(screen.getByText('Step 4 of 7')).toBeInTheDocument()
    expect(screen.getByText(/carrying a lot of weight/)).toBeInTheDocument()
    expect(screen.getByText(/Coffee this week/)).toBeInTheDocument()
    expect(screen.getByText(/whenever you feel like chatting/)).toBeInTheDocument()
  }, 15000)

  it('the 7th scenario (sarcasm) is reachable after answering the first six', async () => {
    renderOnboarding()
    await reachFirstScenario()

    const firstSix = [
      /Worth a shot though/, // S0 confidence
      /passionate about travel/, // S1 humor
      /seeing where things go/, // S2 escalation
      /carrying a lot of weight/, // S3 persistence (new "hmm ok")
      /hope you feel better/, // S4 emotional_tone
      /give it a shot/, // S5 boldness
    ]
    for (const opt of firstSix) {
      await answerAndAdvance(opt)
    }

    await waitForOptionsToReveal()
    expect(screen.getByText("Wow it's really raining a lot today huh")).toBeInTheDocument()
    expect(screen.getByText('Step 7 of 7')).toBeInTheDocument()
  }, 20000)

  it('the vibe-check interstitial shows once, before the first scenario only', async () => {
    renderOnboarding()
    await reachFirstScenario()
    await answerAndAdvance(/Worth a shot though/)
    expect(screen.queryByText('Quick vibe check before we start')).not.toBeInTheDocument()
    await waitForOptionsToReveal()
    expect(screen.getByText('Tell me something interesting about yourself')).toBeInTheDocument()
  }, 10000)

  it('scenario progress shows "Step 1 of 7" with 7 pips', async () => {
    renderOnboarding()
    await reachFirstScenario()
    expect(screen.getByText('Step 1 of 7')).toBeInTheDocument()
    expect(screen.getByTestId('progress-pips').children).toHaveLength(7)
  })

  it('step 1 has no Back or Next arrow (Continue handles advancing)', () => {
    renderOnboarding()
    expect(screen.queryByRole('button', { name: '← Back' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next →' })).not.toBeInTheDocument()
  })

  it('on step 2, selecting a pill does not advance but enables Next', async () => {
    renderOnboarding()
    await fillNameAndContinue()
    expect(screen.getByRole('button', { name: 'Next →' })).toBeDisabled()
    fireEvent.click(screen.getByText('English only'))
    expect(screen.getByText('How do you naturally text?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next →' })).toBeEnabled()
  })

  it('Back returns from step 2 to step 1', async () => {
    renderOnboarding()
    await fillNameAndContinue()
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '← Back' }))
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()
    expect(screen.getByText("Let's set up your profile")).toBeInTheDocument()
  })
})

describe('computeWeights (all 7 personality axes, 7 scenario choices)', () => {
  const AXES = ['confidence', 'humor', 'tone', 'escalation', 'boldness', 'sarcasm', 'persistence']

  it('outputs all seven axes, each clamped to [0.1, 0.9]', () => {
    const w = computeWeights([0, 0, 0, 0, 0, 0, 0])
    for (const axis of AXES) {
      expect(w).toHaveProperty(axis)
      expect(w[axis]).toBeGreaterThanOrEqual(0.1)
      expect(w[axis]).toBeLessThanOrEqual(0.9)
    }
  })

  it('picking the boldest option maxes the boldness and sarcasm axes', () => {
    const w = computeWeights([3, 3, 3, 3, 3, 3, 3])
    expect(w.boldness).toBe(0.9) // BOLDNESS[3]
    expect(w.sarcasm).toBe(0.9) // SARCASM[3] = 0.95 clamped to 0.9
  })

  it('persistence tracks the "hmm ok" option: bold re-route is high, back-off is low', () => {
    // Scenario 3 option 2 = bold re-route (coffee) → high persistence.
    expect(computeWeights([0, 0, 0, 2, 0, 0, 0]).persistence).toBe(0.9)
    // Scenario 3 option 3 = secure & low-pressure → low persistence.
    expect(computeWeights([0, 0, 0, 3, 0, 0, 0]).persistence).toBe(0.1)
  })

  it('different scenario picks move axes independently', () => {
    const earnest = computeWeights([0, 0, 0, 0, 0, 0, 0])
    const bold = computeWeights([0, 0, 0, 0, 0, 3, 0]) // boldness = scenario index 5
    expect(bold.boldness).toBeGreaterThan(earnest.boldness)
    expect(bold.sarcasm).toBe(earnest.sarcasm) // sarcasm unchanged
  })
})
