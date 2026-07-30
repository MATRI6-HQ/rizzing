// Language + emoji preference vocabulary. Shared by OnboardingFlow and ProfileScreen so
// the labels and the values written to personality_profiles can't drift apart.
//
// hinglish_ratio used to store low|medium|high behind the labels English / Mix / Hinglish —
// "Mix" and "Hinglish" named the same thing. The stored vocabulary is now english|hindi|mix.
// No migration is needed (the column is plain text): normalizeLanguage() reads every legacy
// value, and supabase/functions/generate-replies/prompt.ts has the same map on its side.

export const LANGUAGE_CHOICES = [
  { value: 'english', label: 'English' },
  { value: 'hindi', label: 'Hindi' },
  { value: 'mix', label: 'Mix' },
]

export const EMOJI_CHOICES = [
  { value: 'never', label: 'Rarely' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'always', label: 'A lot' },
]

// Legacy stored values → current vocabulary. `medium` was labelled "Mix"; `high` was
// labelled "Hinglish", i.e. mostly-Hindi; a literal 'hinglish' is read as 'mix'.
const LEGACY_LANGUAGE = { low: 'english', medium: 'mix', high: 'hindi', hinglish: 'mix' }

const isKnown = (choices, v) => choices.some((c) => c.value === v)

/** Any stored hinglish_ratio → the current vocabulary. null means "never set". */
export function normalizeLanguage(value) {
  if (!value) return null
  const v = String(value).toLowerCase()
  if (isKnown(LANGUAGE_CHOICES, v)) return v
  return LEGACY_LANGUAGE[v] ?? null
}

/** Any stored emoji_frequency → the current vocabulary. null means "never set". */
export function normalizeEmoji(value) {
  if (!value) return null
  const v = String(value).toLowerCase()
  return isKnown(EMOJI_CHOICES, v) ? v : null
}
