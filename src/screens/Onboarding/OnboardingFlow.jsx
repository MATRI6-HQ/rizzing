import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import PageTransition, { withViewTransition } from '../../components/PageTransition'
import ChatBubble, { TypingIndicator } from '../../components/ChatBubble'
import TermsContent from '../../components/TermsContent'
import { TERMS_VERSION } from '../../lib/legal'
import { useAuthStore } from '../../store/authStore'
import { useProfileStore } from '../../store/profileStore'
import { useConsentStore } from '../../store/consentStore'

// Beat before her message reveals — long enough to read as "typing", short enough
// not to feel like a stall.
export const TYPING_REVEAL_MS = 700

// ── Constants ────────────────────────────────────────────────────────────────
// Numbered steps: 1 personal info + 2 quick-pref + 7 scenarios = 10.
// (The T&C consent gate and the vibe-check interstitial are NOT numbered steps.)
const SETUP_STEPS = 3 // steps 1..3 are the setup/quick-pref phase
const FIRST_SCENARIO_STEP = SETUP_STEPS + 1 // steps 4..10 are scenarios 0..6
const SKIP_EMOJI_WEIGHT = 0.3 // emoji weight applied when the user skips
const WEIGHT_MIN = 0.1
const WEIGHT_MAX = 0.9
const clamp = (v) => Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, v))

// Age bounds for the personal-info input.
const AGE_MIN = 18
const AGE_MAX = 50

// QuickPref options (English only). Value is the weight written to the profile.
const HINGLISH_OPTIONS = [
  { label: 'Pure English only', value: 0.1 },
  { label: 'Mix of English and Hindi', value: 0.5 },
  { label: 'Mostly Hindi / Hinglish', value: 0.9 },
]
const EMOJI_OPTIONS = [
  { label: 'Rarely or never', value: 0.1 },
  { label: 'Sometimes, when it fits', value: 0.5 },
  { label: "All the time, can't stop", value: 0.9 },
]

// 7 scenarios — one per personality axis (revealed preference; no Safe/Bold labels
// shown to the user). Order matches CLAUDE.md's axis mapping. Option order is roughly
// lowest-energy → boldest; the per-axis weight arrays below encode the actual signal.
const SCENARIOS = [
  {
    // 0 → confidence (she sends a cold opener)
    message: "Haha okay, so what makes you think I'd be interested in talking to you? 😏",
    options: [
      'Haha honestly? No idea. Worth a shot though 😅',
      "I don't know yet — that's what I'd like to find out",
      "Because I'm probably the most interesting person on your match list",
      "I don't. But I figured you'd regret it if I didn't try 😉",
    ],
  },
  {
    // 1 → humor (she makes a joke / asks for something interesting)
    message: 'Tell me something interesting about yourself',
    options: [
      "I'm really passionate about travel and meeting new people",
      'I once argued with my GPS for 20 mins and lost',
      "Interesting is subjective. Statistically speaking, I'm top 5% on this app",
      "I make a killer chai and I'm not afraid to use that as a personality trait",
    ],
  },
  {
    // 2 → escalation (she's clearly interested)
    message: 'You seem sweet. What are you looking for on here?',
    options: [
      'Just seeing where things go, no pressure',
      'Honestly? Someone worth actually texting every day',
      'Someone I can meet for coffee and actually enjoy the silence with',
      'You, apparently. Too forward? 😂',
    ],
  },
  {
    // 3 → persistence (dry, low-effort "hmm ok" — each option leans into a different axis)
    message: 'hmm ok 🙂',
    options: [
      "That 'hmm ok' is carrying a lot of weight lol. What's actually on your mind?", // playful callout
      'Careful — all that enthusiasm might overwhelm me 😄', // sarcastic deflect
      'Okay, you clearly need rescuing from a boring day. Coffee this week?', // bold re-route
      "No worries at all — I'll be around whenever you feel like chatting.", // secure & low-pressure
    ],
  },
  {
    // 4 → emotional_tone (she mentions something personal)
    message: 'Ugh, today was such a bad day 😞',
    options: [
      'Oh no, hope you feel better soon!',
      'Arey kya hua? Tell me everything',
      "Bad days mean you're due for a really good one. What happened?",
      "Okay drop the details, I'm your official rant listener now",
    ],
  },
  {
    // 5 → boldness (she's being playful/flirty)
    message: 'Wow you actually messaged first, impressive 😂',
    options: [
      'Haha yeah I thought I\'d give it a shot!',
      "I know, I'm very brave. It's one of my many qualities",
      'Someone had to. You were clearly waiting 😏',
      "Don't get used to it. Next one's on you 😂",
    ],
  },
  {
    // 6 → sarcasm (she says something obvious/generic)
    message: "Wow it's really raining a lot today huh",
    options: [
      "Haha yeah it's been pouring since morning!",
      'Right? Perfect weather to stay in and text strangers',
      "Groundbreaking observation, I'm impressed 😏",
      'Wow, rain during monsoon? Stop the press 📰',
    ],
  },
]

// Total numbered steps: setup (3) + scenarios (7) = 10.
const TOTAL_STEPS = SETUP_STEPS + SCENARIOS.length

// Per-option weight for each scenario's single axis. Index = the option the user picked.
// Ordering intent noted where it isn't simply low→high.
const CONFIDENCE = [0.1, 0.4, 0.9, 0.8]
const HUMOR = [0.2, 0.7, 0.9, 0.5]
const ESCALATION = [0.1, 0.6, 0.7, 0.95]
// persistence: callout=stays engaged, sarcastic=medium, bold-reroute=very persistent, secure=backs off.
const PERSISTENCE = [0.65, 0.5, 0.9, 0.1]
const TONE = [0.2, 0.95, 0.6, 0.85]
const BOLDNESS = [0.2, 0.6, 0.85, 0.9]
const SARCASM = [0.1, 0.5, 0.85, 0.95]

/** Reduce the 7 scenario choices into all seven scored personality weights. */
export function computeWeights(choices) {
  return {
    confidence: clamp(CONFIDENCE[choices[0]]),
    humor: clamp(HUMOR[choices[1]]),
    escalation: clamp(ESCALATION[choices[2]]),
    persistence: clamp(PERSISTENCE[choices[3]]),
    tone: clamp(TONE[choices[4]]),
    boldness: clamp(BOLDNESS[choices[5]]),
    sarcasm: clamp(SARCASM[choices[6]]),
  }
}

// The deployed schema stores these as text buckets, not floats (see CLAUDE.md).
const hinglishToText = (v) => (v <= 0.3 ? 'low' : v <= 0.6 ? 'medium' : 'high')
const emojiToText = (v) => (v <= 0.3 ? 'never' : v <= 0.6 ? 'sometimes' : 'always')

// ── Small presentational pieces ──────────────────────────────────────────────
function Spinner() {
  return (
    <svg className="animate-spin h-7 w-7 text-gold" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0d0d0d"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  )
}

const INPUT_CLASS = 'input-rizzing'

function PillButton({ label, onClick, selected }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`press lift card-rizzing w-full py-3 px-4 text-left text-[15px] font-medium cursor-pointer ${
        selected ? 'pill-selected' : 'text-text-primary'
      }`}
    >
      {label}
    </button>
  )
}

// Single progress indicator (segmented pips) — the ONLY progress UI in onboarding.
// One filled pip per completed-or-current step, plus a "Step X of N" label.
function ProgressPips({ current, total, label }) {
  return (
    <div className="mt-4 mb-8">
      <div className="scenario-pips" data-testid="progress-pips">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="scenario-pip">
            <div className="scenario-pip__fill" style={{ width: i < current ? '100%' : '0%' }} />
          </div>
        ))}
      </div>
      <p className="text-text-primary text-[12px] tracking-[0.1em] uppercase mt-2 text-center opacity-70">
        {label}
      </p>
    </div>
  )
}

// Terms & Privacy consent gate — shown once, before any onboarding step. A required
// checkbox gates Continue. Not a numbered step.
function TermsGate({ onAccept }) {
  const [checked, setChecked] = useState(false)
  return (
    <div className="min-h-screen bg-ambient flex items-center justify-center">
      <div className="app-shell flex flex-col px-6 py-10">
        <PageTransition transitionKey="terms-gate" className="flex-1 flex flex-col justify-center">
          <h2 className="text-text-primary text-2xl font-medium font-display leading-snug">
            Before we start
          </h2>
          <p className="text-text-secondary text-[15px] mt-1 mb-5">A quick note on your data</p>

          <TermsContent />

          <label className="flex items-start gap-3 mt-5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="sr-only"
            />
            <span className={`consent-check ${checked ? 'consent-check--on' : ''}`}>
              {checked && <CheckIcon />}
            </span>
            <span className="text-text-secondary text-[13px] leading-relaxed">
              I agree to the Terms &amp; Privacy Policy
            </span>
          </label>

          <button
            type="button"
            onClick={onAccept}
            disabled={!checked}
            className="btn-gold lift-gold mt-6"
          >
            Continue
          </button>
        </PageTransition>
      </div>
    </div>
  )
}

// Shown once, right before the first scenario — testers found the jump into
// "what would you reply" questions jarring without it. Not a numbered step.
function VibeCheckIntro({ onContinue }) {
  return (
    <div className="min-h-screen bg-ambient flex items-center justify-center">
      <div className="app-shell flex flex-col justify-center px-6">
        <PageTransition transitionKey="vibe-check-intro">
          <div className="card-rizzing px-6 py-8">
            <h2 className="text-text-primary text-2xl font-medium font-display leading-snug">
              Quick vibe check before we start
            </h2>
            <p className="text-text-secondary text-[15px] leading-relaxed mt-4">
              We're gonna show you a few real chat moments. Just react how you actually would — no
              overthinking it. This is how we figure out your rizz style, not your grammar.
            </p>
            <button type="button" onClick={onContinue} className="btn-gold lift-gold mt-8">
              Let's go
            </button>
          </div>
        </PageTransition>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function OnboardingFlow() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const loadProfile = useProfileStore((s) => s.load)
  const consentAccepted = useConsentStore((s) => s.accepted)
  const acceptConsent = useConsentStore((s) => s.accept)

  const [step, setStep] = useState(1)
  const [introSeen, setIntroSeen] = useState(false)

  // Every step change animates: enter via <PageTransition>, exit via the View
  // Transitions API where the browser supports it.
  const goToStep = (n) => withViewTransition(() => setStep(n))

  // Step 1 — personal info
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [city, setCity] = useState('')
  const [saving, setSaving] = useState(false)

  // QuickPrefs
  const [hinglishLevel, setHinglishLevel] = useState(null)
  const [emojiLevel, setEmojiLevel] = useState(null)
  const [emojiFavorites, setEmojiFavorites] = useState('')

  // Scenarios
  const [choices, setChoices] = useState(Array(SCENARIOS.length).fill(null))
  const [phase, setPhase] = useState('quiz') // 'quiz' | 'building'
  const [error, setError] = useState('')

  const ageAsNumber = age.trim() === '' ? null : Number(age)
  // Schema column preferred_emojis is text[] — split the free-text field into an array.
  const preferredEmojis = emojiFavorites.trim() === '' ? [] : emojiFavorites.trim().split(/\s+/)

  async function handleContinue() {
    if (name.trim() === '' || saving) return
    setError('')
    setSaving(true)
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(
          { id: user?.id, full_name: name.trim(), age: ageAsNumber, city: city.trim() || null },
          { onConflict: 'id' },
        )
      if (profileError) throw profileError
      // Keep the name handy in local state for the rest of the app.
      useProfileStore.setState({ full_name: name.trim() })
      goToStep(2)
    } catch (err) {
      setError(err?.message ?? 'Could not save your details')
    } finally {
      setSaving(false)
    }
  }

  // QuickPref pills only select — advancing is done with the Next button.
  function selectHinglish(value) {
    setHinglishLevel(value)
  }

  function selectEmoji(value) {
    setEmojiLevel(value)
  }

  function skipEmoji() {
    setEmojiLevel(SKIP_EMOJI_WEIGHT)
    setEmojiFavorites('')
    goToStep(FIRST_SCENARIO_STEP)
  }

  // Picking a scenario option only highlights it — advancing happens via the gold FAB.
  function pickScenario(optionIndex) {
    const scenarioIndex = step - FIRST_SCENARIO_STEP
    const next = [...choices]
    next[scenarioIndex] = optionIndex
    setChoices(next)
  }

  function advanceScenario() {
    if (step < TOTAL_STEPS) {
      goToStep(step + 1)
    } else {
      setPhase('building')
      finish(choices)
    }
  }

  function handleBack() {
    if (step > 1) goToStep(step - 1)
  }

  function handleNext() {
    if (step === TOTAL_STEPS) {
      setPhase('building')
      finish(choices)
    } else {
      goToStep(step + 1)
    }
  }

  // Whether the bottom-nav Next is enabled for the current step.
  function isNextEnabled() {
    if (step === 2) return hinglishLevel !== null
    if (step === 3) return emojiLevel !== null
    if (step >= FIRST_SCENARIO_STEP) return choices[step - FIRST_SCENARIO_STEP] !== null
    return false // step 1 uses the Continue button instead
  }

  async function finish(finalChoices) {
    setError('')
    try {
      if (!user?.id) throw new Error('You are not signed in')
      const weights = computeWeights(finalChoices)
      const consent = useConsentStore.getState()

      // personality_profiles.user_id FKs to profiles(id), so the parent row must exist
      // first. Merge name/age/city here too (idempotent upsert).
      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: user.id,
          email: user.email,
          full_name: name.trim() || null,
          age: ageAsNumber,
          city: city.trim() || null,
        },
        { onConflict: 'id' },
      )
      if (profileError) throw profileError

      // Map logical fields → actual deployed columns (CLAUDE.md schema is authoritative).
      const { error: upsertError } = await supabase.from('personality_profiles').upsert(
        {
          user_id: user.id,
          confidence: weights.confidence,
          humor: weights.humor,
          emotional_tone: weights.tone,
          escalation: weights.escalation,
          boldness: weights.boldness,
          sarcasm: weights.sarcasm,
          persistence: weights.persistence,
          hinglish_ratio: hinglishToText(hinglishLevel),
          emoji_frequency: emojiToText(emojiLevel),
          preferred_emojis: preferredEmojis,
          onboarding_responses: {
            hinglish_level: hinglishLevel,
            emoji_level: emojiLevel,
            preferred_emojis: preferredEmojis,
            scenario_choices: finalChoices,
            // Server-side copy of consent, alongside the localStorage record.
            terms: { version: consent.version, accepted_at: consent.acceptedAt },
          },
          onboarding_complete: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      if (upsertError) throw upsertError

      // Sync local store from the freshly written row, then leave onboarding.
      await loadProfile(user.id)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err?.message ?? 'Could not save your profile')
    }
  }

  const nextEnabled = isNextEnabled()
  const inScenarios = phase === 'quiz' && step >= FIRST_SCENARIO_STEP
  const scenarioIndex = step - FIRST_SCENARIO_STEP

  // T&C consent gate — before anything else. Once accepted (persisted), it never
  // reappears, so Back from step 1 has nowhere to go.
  if (phase === 'quiz' && !consentAccepted) {
    return <TermsGate onAccept={() => withViewTransition(() => acceptConsent(TERMS_VERSION))} />
  }

  // Interstitial before the very first scenario. Not a step: `step` stays put,
  // so the progress indicator doesn't move and Back still returns to the emoji step.
  if (phase === 'quiz' && step === FIRST_SCENARIO_STEP && !introSeen) {
    return <VibeCheckIntro onContinue={() => withViewTransition(() => setIntroSeen(true))} />
  }

  return (
    <div className="min-h-screen bg-ambient flex items-center justify-center">
      <div className="app-shell flex flex-col px-6 pt-4 pb-16 relative">
        {/* Single progress indicator — pips for both phases, no legacy bar. */}
        {phase !== 'building' &&
          (inScenarios ? (
            <ProgressPips
              current={scenarioIndex + 1}
              total={SCENARIOS.length}
              label={`Step ${scenarioIndex + 1} of ${SCENARIOS.length}`}
            />
          ) : (
            <ProgressPips current={step} total={SETUP_STEPS} label={`Step ${step} of ${SETUP_STEPS}`} />
          ))}

        {phase === 'building' ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            {!error && <Spinner />}
            {!error && (
              <p className="text-text-muted text-xs tracking-[0.15em] uppercase opacity-40 mt-3">
                Building your profile...
              </p>
            )}
            {error && (
              <>
                <p className="text-red-400 text-sm text-center">{error}</p>
                <button
                  type="button"
                  onClick={() => finish(choices)}
                  className="press lift w-full bg-bg-card border border-gold text-gold rounded-xl py-3 px-4 cursor-pointer"
                >
                  Try again
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Keyed on step: enter animation replays, and goToStep's view
                transition fades the outgoing step out. */}
            <PageTransition transitionKey={step} className="flex-1 flex flex-col">
              {step === 1 ? (
                <div className="flex-1 flex flex-col justify-center">
                  <h2 className="text-text-primary text-2xl font-medium font-display leading-snug">
                    Let's set up your profile
                  </h2>
                  <p className="text-text-secondary text-sm mt-1 mb-8">
                    This helps us personalise your replies
                  </p>
                  <div className="flex flex-col gap-3">
                    <input
                      type="text"
                      placeholder="What do people call you?"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={INPUT_CLASS}
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      min={AGE_MIN}
                      max={AGE_MAX}
                      placeholder="Your age"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      className={INPUT_CLASS}
                    />
                    <input
                      type="text"
                      placeholder="Which city are you in?"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleContinue}
                    disabled={name.trim() === '' || saving}
                    className="btn-gold lift-gold mt-6"
                  >
                    {saving ? 'Saving…' : 'Continue'}
                  </button>
                  {error && <p className="text-red-400 text-xs text-center mt-3">{error}</p>}
                </div>
              ) : step === 2 ? (
                <div className="flex-1 flex flex-col justify-center">
                  <h2 className="text-text-primary text-2xl font-medium font-display leading-snug">
                    How do you naturally text?
                  </h2>
                  <p className="text-text-secondary text-xs tracking-widest uppercase opacity-40 mt-1 mb-6">
                    Pick the style that feels most like you
                  </p>
                  <div className="flex flex-col gap-3">
                    {HINGLISH_OPTIONS.map((opt) => (
                      <PillButton
                        key={opt.label}
                        label={opt.label}
                        selected={hinglishLevel === opt.value}
                        onClick={() => selectHinglish(opt.value)}
                      />
                    ))}
                  </div>
                </div>
              ) : step === 3 ? (
                <div className="flex-1 flex flex-col justify-center">
                  <h2 className="text-text-primary text-2xl font-medium font-display leading-snug">
                    How often do you use emojis?
                  </h2>
                  <p className="text-text-secondary text-xs tracking-widest uppercase opacity-40 mt-1 mb-6">
                    Be honest 😄
                  </p>
                  <div className="flex flex-col gap-3">
                    {EMOJI_OPTIONS.map((opt) => (
                      <PillButton
                        key={opt.label}
                        label={opt.label}
                        selected={emojiLevel === opt.value}
                        onClick={() => selectEmoji(opt.value)}
                      />
                    ))}
                  </div>

                  <div className="mt-6">
                    <label className="text-text-secondary text-sm block mb-2">
                      Your go-to emojis (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 😂 🔥 💀"
                      value={emojiFavorites}
                      onChange={(e) => setEmojiFavorites(e.target.value)}
                      className={INPUT_CLASS}
                    />
                    <p className="text-text-muted text-xs mt-2">We'll use these in your replies</p>
                  </div>

                  <button
                    type="button"
                    onClick={skipEmoji}
                    className="mt-6 text-text-muted text-sm no-underline hover:opacity-70 cursor-pointer self-start"
                  >
                    Skip for now →
                  </button>
                </div>
              ) : (
                <ScenarioStep
                  scenario={SCENARIOS[scenarioIndex]}
                  onPick={pickScenario}
                  selectedIndex={choices[scenarioIndex]}
                />
              )}
            </PageTransition>

            {/* Bottom prev/next navigation — present on every step (quiz phase) */}
            <div className="flex items-center justify-between pt-4">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="text-text-muted text-[13px] tracking-wide opacity-25 hover:opacity-50 cursor-pointer"
                >
                  ← Back
                </button>
              ) : (
                <span />
              )}
              {step !== 1 && !inScenarios && (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!nextEnabled}
                  className={`text-[13px] tracking-wide ${
                    nextEnabled
                      ? 'text-gold font-medium cursor-pointer hover:opacity-70'
                      : 'text-text-muted opacity-40 cursor-not-allowed'
                  }`}
                >
                  Next →
                </button>
              )}
            </div>

            {/* Scenario advance — gold circular FAB, gated on a choice being selected */}
            {inScenarios && (
              <button
                type="button"
                aria-label="Next scenario"
                onClick={advanceScenario}
                disabled={!nextEnabled}
                className="press fab-next absolute bottom-8 right-6"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ScenarioStep({ scenario, onPick, selectedIndex }) {
  const [revealed, setRevealed] = useState(false)

  // Fresh mount every scenario (PageTransition keys on `step`), so this timer
  // always restarts — a beat of "typing" before her message lands.
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), TYPING_REVEAL_MS)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="flex-1 flex flex-col justify-center">
      {/* Match header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gold text-black font-bold flex items-center justify-center ring-2 ring-gold/30 ring-offset-2 ring-offset-bg-app">
          A
        </div>
        <span className="text-text-muted text-sm">Aisha</span>
      </div>

      {/* Her message, revealed after a typing beat */}
      <div className="mb-6">
        {revealed ? <ChatBubble variant="incoming" text={scenario.message} /> : <TypingIndicator />}
      </div>

      {/* Reply options — selectable outgoing-style bubbles. Tapping only highlights;
          advancing is via the FAB (advanceScenario in the parent). */}
      {revealed && (
        <div className="flex flex-col gap-3 items-end">
          {scenario.options.map((opt, i) => (
            <ChatBubble
              key={i}
              variant="outgoing"
              text={opt}
              selectable
              selected={selectedIndex === i}
              onClick={() => onPick(i)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
