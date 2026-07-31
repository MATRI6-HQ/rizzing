import { supabase } from './supabase'

// Thin wrappers over the 3 Supabase Edge Functions. The app NEVER calls Groq/Claude
// directly — everything goes through these functions. Bodies match the CLAUDE.md contracts.
//
// LOCAL TESTING: set VITE_FUNCTIONS_URL in the root .env (e.g.
// http://127.0.0.1:54321/functions/v1) to route these calls at locally-served functions
// while auth + DB stay on the hosted project. Unset → normal hosted invoke.
const LOCAL_FUNCTIONS_URL = import.meta.env.VITE_FUNCTIONS_URL

// Shown when generate-replies exhausted its retries against a rate-limited / overloaded
// provider (structured body code from the Edge Function). Anything else falls back to the
// function's own { error } string, or a generic message if none reached us.
const RATE_LIMIT_MESSAGE = 'The assistant is busy right now. Please wait a moment and try again.'
const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

function messageForError(body, fallback) {
  if (body?.code === 'RATE_LIMIT_RETRY_EXHAUSTED') return RATE_LIMIT_MESSAGE
  return body?.error ?? fallback ?? GENERIC_MESSAGE
}

/**
 * Invoke an Edge Function. Uses hosted supabase.functions.invoke by default; when
 * VITE_FUNCTIONS_URL is set, fetches the locally-served function directly and forwards the
 * signed-in user's JWT so the function's auth-passthrough client still satisfies RLS.
 */
async function callFunction(name, body) {
  if (!LOCAL_FUNCTIONS_URL) {
    const { data, error } = await supabase.functions.invoke(name, { body })
    // invoke's error.message is always the generic "non-2xx status code" — the function's
    // own { error } body is only reachable through error.context (the raw Response).
    if (error) {
      const body = await error.context?.json?.().catch(() => null)
      throw new Error(messageForError(body, error.message))
    }
    return data
  }
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${LOCAL_FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(messageForError(data, `Function ${name} failed (${res.status})`))
  return data
}

/**
 * generate-replies: returns three reply options for an incoming message.
 * @param {{ her_message: string, match_id: string, user_id: string }} payload
 * @returns {Promise<{ safe: string, witty: string, bold: string }>}
 */
export async function generateReplies({ her_message, match_id, user_id }) {
  return callFunction('generate-replies', { her_message, match_id, user_id })
}

/**
 * generate-replies, standalone profile-prompt path: three openers for a dating-app
 * profile prompt + her answer to it (Hinge/Bumble). Same Edge Function, selected by
 * `mode` — it swaps in a prompt template that states the input shape itself, so the
 * user never has to explain where the two fields came from.
 *
 * No match_id: Prompt Replier is a throwaway generator with no persistence (CLAUDE.md).
 * @param {{ prompt: string, answer: string, user_id: string }} payload
 * @returns {Promise<{ safe: string, witty: string, bold: string }>}
 */
export async function generatePromptReply({ prompt, answer, user_id }) {
  return callFunction('generate-replies', { mode: 'prompt_reply', prompt, answer, user_id })
}

/**
 * process-screenshot: OCRs an incoming message screenshot.
 * @param {{ image_base64: string, user_id: string }} payload
 * @returns {Promise<{ extracted_text: string }>}
 */
export async function processScreenshot({ image_base64, user_id }) {
  return callFunction('process-screenshot', { image_base64, user_id })
}

/**
 * update-weights: nudges the personality profile after a pick. Fire-and-forget from the UI.
 * @param {{ user_id: string, match_id: string, turn_id: string, picked: string, sent_text: string, was_edited: boolean }} payload
 */
export async function updateWeights({ user_id, match_id, turn_id, picked, sent_text, was_edited }) {
  return callFunction('update-weights', { user_id, match_id, turn_id, picked, sent_text, was_edited })
}
