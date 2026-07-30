// Rizz archetype derivation — the hero line on /profile.
//
// Derivation: every archetype is defined by a PAIR of personality axes. Score each
// archetype as the sum of its two axes and take the highest. That's deterministic, always
// returns something (no "unknown" branch to design around), and reduces to "your top two
// axes name you" without needing an ordered lookup table of 21 pairs.
// Ties resolve to the earlier entry, so the order below is the tie-break order.

export const AXIS_KEYS = [
  'confidence',
  'humor',
  'persistence',
  'emotional_tone',
  'escalation',
  'boldness',
  'sarcasm',
]

// Every axis appears in at least one pair, so no axis can be "wasted" signal.
export const ARCHETYPES = [
  {
    id: 'closer',
    name: 'The Closer',
    axes: ['boldness', 'escalation'],
    descriptor: 'Reads the moment and actually asks for it.',
  },
  {
    id: 'dry-wit',
    name: 'The Dry Wit',
    axes: ['humor', 'sarcasm'],
    descriptor: 'Deadpan delivery, and it lands every time.',
  },
  {
    id: 'provocateur',
    name: 'The Provocateur',
    axes: ['sarcasm', 'boldness'],
    descriptor: 'Pokes the bear. The bear seems into it.',
  },
  {
    id: 'straight-shooter',
    name: 'The Straight Shooter',
    axes: ['confidence', 'boldness'],
    descriptor: 'Says the thing everyone else deletes and retypes.',
  },
  {
    id: 'charmer',
    name: 'The Charmer',
    axes: ['confidence', 'humor'],
    descriptor: 'Easy warmth, and none of the effort shows.',
  },
  {
    id: 'empath',
    name: 'The Empath',
    axes: ['emotional_tone', 'humor'],
    descriptor: 'Makes her feel heard, then makes her laugh.',
  },
  {
    id: 'slow-burn',
    name: 'The Slow Burn',
    axes: ['persistence', 'emotional_tone'],
    descriptor: 'Plays the long game, and the long game plays out.',
  },
  {
    id: 'steady-hand',
    name: 'The Steady Hand',
    axes: ['persistence', 'confidence'],
    descriptor: 'Unbothered, unhurried, always around.',
  },
]

// Shown instead of a real archetype while every axis still sits at the default — a flat
// profile names nobody, and pretending otherwise is worse than saying so.
export const FORMING = {
  id: 'forming',
  name: 'Still forming',
  descriptor: "Pick a few replies and watch this shift — we learn from what you send.",
}

// Below this spread the seven axes are effectively identical (the untouched all-0.5 row),
// so there is no top-two to read.
const FLAT_SPREAD = 0.02

const axisValue = (profile, key) => (typeof profile?.[key] === 'number' ? profile[key] : 0.5)

/** True when the profile is still the undifferentiated default — no persona to name yet. */
export function isPersonaForming(profile) {
  const values = AXIS_KEYS.map((k) => axisValue(profile, k))
  return Math.max(...values) - Math.min(...values) < FLAT_SPREAD
}

/**
 * Derive the archetype from a personality profile.
 * @param {Record<string, number>} profile personality_profiles row (or the store's shape)
 * @returns {{ id: string, name: string, descriptor: string, axes?: string[] }}
 */
export function deriveArchetype(profile) {
  if (isPersonaForming(profile)) return FORMING
  let best = ARCHETYPES[0]
  let bestScore = -Infinity
  for (const archetype of ARCHETYPES) {
    const score = archetype.axes.reduce((sum, key) => sum + axisValue(profile, key), 0)
    if (score > bestScore) {
      bestScore = score
      best = archetype
    }
  }
  return best
}
