// Single source of truth for the support contact. Referenced by ProfileScreen (Account +
// Terms rows) and by ConversationFlow's repeated-failure state.
export const SUPPORT_EMAIL = 'hq@matri6.com'
export const SUPPORT_REPLY_WINDOW = 'Questions, bugs, or feedback — we reply within 48 hours.'

/**
 * mailto: with the user's own address in the subject, so an inbound mail identifies the
 * account without the sender having to say who they are.
 */
export function supportMailto(userEmail) {
  const subject = `RIZZING Support — ${userEmail || 'account unknown'}`
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`
}
