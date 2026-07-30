import { describe, it, expect } from 'vitest'
import {
  deriveArchetype,
  isPersonaForming,
  ARCHETYPES,
  AXIS_KEYS,
  FORMING,
} from '../lib/archetype'
import { normalizeLanguage, normalizeEmoji, LANGUAGE_CHOICES } from '../lib/prefs'

/** A low baseline across all seven axes, with the named ones raised. */
const profileWith = (overrides) => ({
  ...Object.fromEntries(AXIS_KEYS.map((k) => [k, 0.3])),
  ...overrides,
})

describe('deriveArchetype', () => {
  it('names The Closer for high boldness + escalation', () => {
    expect(deriveArchetype(profileWith({ boldness: 0.9, escalation: 0.9 })).id).toBe('closer')
  })

  it('names The Dry Wit for high humor + sarcasm', () => {
    expect(deriveArchetype(profileWith({ humor: 0.9, sarcasm: 0.9 })).id).toBe('dry-wit')
  })

  it('names The Slow Burn for high persistence + emotional tone', () => {
    expect(deriveArchetype(profileWith({ persistence: 0.9, emotional_tone: 0.9 })).id).toBe(
      'slow-burn',
    )
  })

  it('names The Charmer for high confidence + humor', () => {
    expect(deriveArchetype(profileWith({ confidence: 0.9, humor: 0.85 })).id).toBe('charmer')
  })

  it('is deterministic — the same profile always derives the same archetype', () => {
    const p = profileWith({ sarcasm: 0.8, boldness: 0.75 })
    expect(deriveArchetype(p).id).toBe(deriveArchetype(p).id)
  })

  it('falls back to the forming state on an untouched all-default profile', () => {
    const flat = Object.fromEntries(AXIS_KEYS.map((k) => [k, 0.5]))
    expect(isPersonaForming(flat)).toBe(true)
    expect(deriveArchetype(flat)).toBe(FORMING)
  })

  it('treats a differentiated profile as formed', () => {
    expect(isPersonaForming(profileWith({ boldness: 0.9 }))).toBe(false)
  })

  it('every axis is used by at least one archetype — no wasted signal', () => {
    const used = new Set(ARCHETYPES.flatMap((a) => a.axes))
    for (const key of AXIS_KEYS) expect(used.has(key)).toBe(true)
  })

  it('handles a missing/partial profile without throwing', () => {
    expect(() => deriveArchetype({})).not.toThrow()
    expect(() => deriveArchetype(null)).not.toThrow()
  })
})

describe('preference normalization', () => {
  it('reads the current vocabulary straight through', () => {
    for (const { value } of LANGUAGE_CHOICES) expect(normalizeLanguage(value)).toBe(value)
  })

  it('maps every legacy hinglish_ratio value — no orphans', () => {
    expect(normalizeLanguage('low')).toBe('english')
    expect(normalizeLanguage('medium')).toBe('mix')
    expect(normalizeLanguage('high')).toBe('hindi')
    expect(normalizeLanguage('hinglish')).toBe('mix')
  })

  it('reports unset (null) rather than guessing a default', () => {
    expect(normalizeLanguage(null)).toBeNull()
    expect(normalizeLanguage('')).toBeNull()
    expect(normalizeLanguage('nonsense')).toBeNull()
    expect(normalizeEmoji(null)).toBeNull()
    expect(normalizeEmoji('sometimes')).toBe('sometimes')
  })
})
