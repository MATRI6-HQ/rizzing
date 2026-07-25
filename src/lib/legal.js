// ⚠️ PLACEHOLDER legal copy — plain-language summary so the consent flow works.
// This is NOT reviewed legal text. Replace TERMS_SECTIONS / PRIVACY_SUMMARY with a
// proper Terms of Service + Privacy Policy (ideally lawyer-reviewed) before launch,
// especially given data storage in Supabase and ad usage. Bump TERMS_VERSION whenever
// the content materially changes so stored consent stays auditable.

export const TERMS_VERSION = '2026-07-25.placeholder-1'

// One-paragraph plain-language summary (used as the intro on the consent screen).
export const TERMS_SUMMARY =
  'RIZZING helps you craft better replies. To do this we store your account info ' +
  '(email), your onboarding personality choices, your reply preferences, and the ' +
  'conversation context you enter — used only to personalize your suggestions. Data ' +
  'is stored securely via Supabase. We show ads and offer an ad-free subscription. ' +
  'You can request deletion of your data anytime by contacting us. By continuing you ' +
  'agree to these terms and our Privacy Policy.'

// Sectioned breakdown — real ToS/Privacy text can slot into these bodies (or the array
// can grow) without reworking the consent flow or the Profile link that reuses it.
export const TERMS_SECTIONS = [
  {
    heading: 'What RIZZING does',
    body: 'RIZZING suggests reply options for your dating and messaging conversations. It is an assistant — you choose what to send.',
  },
  {
    heading: 'What we store',
    body: 'Your account email, the personality choices you make during onboarding, your reply preferences (Hinglish level, emoji use), and the conversation context you paste or type in.',
  },
  {
    heading: 'How we use it',
    body: 'Only to personalize the reply suggestions we generate for you. We do not sell your personal data.',
  },
  {
    heading: 'Where your data lives',
    body: 'Securely in Supabase, protected by row-level security so only you can access your own rows.',
  },
  {
    heading: 'Ads & subscription',
    body: 'The free version shows ads. An optional ad-free subscription is available.',
  },
  {
    heading: 'Your control',
    body: 'You can request deletion of your data at any time by contacting us. Continuing means you agree to these terms and our Privacy Policy.',
  },
]
