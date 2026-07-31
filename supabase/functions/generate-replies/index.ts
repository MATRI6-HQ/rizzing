// generate-replies — three distinct reply variants (safe / witty / bold).
//
// Provider routing (B1): a strict fallback CHAIN, tried in order, each with its own
// backoff. Gemini (primary) → Groq (first fallback) → Cerebras (second fallback). A
// provider only falls through once its own retries are exhausted; nothing skips ahead.
// Set REPLY_PROVIDER=gemini (default) + the keys below in the Edge Function secrets.
// All three are forced into strict JSON so a model can never return bare keys.
//
// Two request shapes, one function — same provider chain, different prompt:
//
//   chat (from src/lib/api.js → generateReplies):
//     { her_message: string, match_id: string, user_id: string }
//   standalone profile prompt (→ generatePromptReply):
//     { mode: "prompt_reply", prompt: string, answer: string, user_id: string }
//
// The standalone path has NO match and NO history by design (Prompt Replier is a
// throwaway generator — nothing is persisted, see CLAUDE.md), so it skips the match and
// conversation_turns reads entirely rather than querying them with a null match_id.
//
// Response (rendered by ConversationFlow.jsx / PromptReplierScreen.jsx reply bubbles):
//   { safe: string, witty: string, bold: string, provider: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders, json } from "../_shared/cors.ts"
import {
  buildPromptReplySystem,
  buildSystem,
  boldLevelFor,
  detectStage,
  formatPromptAnswer,
  HISTORY_TURNS,
  PROMPT_REPLY_MODE,
  type Profile,
  type Replies,
  type Turn,
} from "./prompt.ts"

// gemini (default) = run the whole chain. Any other provider name pins that one provider.
const REPLY_PROVIDER = (Deno.env.get("REPLY_PROVIDER") ?? "gemini").toLowerCase()

// `-latest` on purpose, not a pinned version. Google retired gemini-2.5-flash-lite for
// new API keys mid-flight (404 "no longer available to new users") while still LISTING it
// in /v1beta/models — a pinned id silently becomes a dead primary. The alias tracks the
// current flash-lite. Verified 2026-07-26: gemini-flash-lite-latest 1.3s vs
// gemini-3.5-flash-lite 6.3s for the same prompt.
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-lite-latest"
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

// Groq is OpenAI-compatible. MODEL_NAME keeps the existing testing model.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = Deno.env.get("MODEL_NAME") ?? "llama-3.1-8b-instant"

// Cerebras is also OpenAI-compatible — same helper, different host/model/key.
// NOT llama-3.3-70b: /v1/models on this account returns only zai-glm-4.7, gpt-oss-120b
// and gemma-4-31b — no llama at all, so the old default 404'd unconditionally.
const CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
const CEREBRAS_MODEL = Deno.env.get("CEREBRAS_MODEL") ?? "gpt-oss-120b"

// Retry schedules for 429 / 5xx responses — ms to wait before each retry. Tune here;
// no other file reads these. Attempts = schedule.length + 1 (the initial try).
//
// Primary (Gemini) is the most likely to succeed and the best output, so it's worth
// waiting on. The fallback tiers are already a degraded path — a user is watching a
// spinner by then, so they drop the long 4s retry and fail fast into the next provider.
//
// Worst case (all three exhaust, every attempt 429s) = pure sleep time:
//   gemini 500+1500+4000 = 6000ms | groq 500+1500 = 2000ms | cerebras 500+1500 = 2000ms
//   → 10000ms of sleep + 10 round-trips. Was 18000ms + 12 round-trips.
const PRIMARY_BACKOFF_MS = [500, 1500, 4000]
const FALLBACK_BACKOFF_MS = [500, 1500]
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type ProviderResult =
  | { ok: true; data: Replies }
  | { ok: false; status: number; rateLimited: boolean; detail: string }

/** Tolerant parse: strip ``` fences, JSON.parse, require the three string keys. */
function parseReplies(raw: string): Replies {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim()
  const obj = JSON.parse(cleaned) as Record<string, unknown>
  const pick = (k: string) => (typeof obj[k] === "string" ? (obj[k] as string).trim() : "")
  const replies = { safe: pick("safe"), witty: pick("witty"), bold: pick("bold") }
  if (!replies.safe && !replies.witty && !replies.bold) throw new Error("no reply keys present")
  return replies
}

/** `backoff` is the caller's schedule — PRIMARY_BACKOFF_MS or FALLBACK_BACKOFF_MS. */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  backoff: number[],
): Promise<Response> {
  let res: Response = await fetch(url, init)
  for (let attempt = 0; attempt < backoff.length; attempt++) {
    if (res.ok) return res
    const retryable = res.status === 429 || res.status >= 500
    if (!retryable) return res
    await sleep(backoff[attempt])
    res = await fetch(url, init)
  }
  return res
}

async function callGemini(system: string, herMessage: string): Promise<ProviderResult> {
  const apiKey = Deno.env.get("GEMINI_API_KEY")
  if (!apiKey) return { ok: false, status: 0, rateLimited: false, detail: "GEMINI_API_KEY not set" }

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: herMessage }] }],
    generationConfig: {
      temperature: 0.95,
      responseMimeType: "application/json",
      // A response schema guarantees a real object, not bare keys.
      responseSchema: {
        type: "OBJECT",
        properties: {
          safe: { type: "STRING" },
          witty: { type: "STRING" },
          bold: { type: "STRING" },
        },
        required: ["safe", "witty", "bold"],
      },
    },
  })

  const res = await fetchWithRetry(
    GEMINI_URL,
    {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body,
    },
    PRIMARY_BACKOFF_MS,
  )
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    return {
      ok: false,
      status: res.status,
      rateLimited: res.status === 429 || res.status >= 500,
      detail: `gemini ${res.status}: ${text.slice(0, 200)}`,
    }
  }
  const completion = await res.json()
  const content = completion.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
  try {
    return { ok: true, data: parseReplies(content) }
  } catch (e) {
    return { ok: false, status: 502, rateLimited: false, detail: `gemini parse: ${(e as Error).message}` }
  }
}

/**
 * Groq and Cerebras both speak the OpenAI chat-completions dialect, so they share one
 * body/parse/backoff path — a fix to either lands on both. Same signature contract as
 * callGemini: (system, herMessage) → ProviderResult.
 */
async function callOpenAICompatible(
  name: string,
  url: string,
  model: string,
  apiKey: string | undefined,
  keyEnvName: string,
  system: string,
  herMessage: string,
): Promise<ProviderResult> {
  if (!apiKey) return { ok: false, status: 0, rateLimited: false, detail: `${keyEnvName} not set` }

  const body = JSON.stringify({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: herMessage },
    ],
    temperature: 0.9,
    response_format: { type: "json_object" },
  })

  // Both OpenAI-compatible providers are fallback tiers — short schedule, fail fast.
  const res = await fetchWithRetry(
    url,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body,
    },
    FALLBACK_BACKOFF_MS,
  )
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    return {
      ok: false,
      status: res.status,
      rateLimited: res.status === 429 || res.status >= 500,
      detail: `${name} ${res.status}: ${text.slice(0, 200)}`,
    }
  }
  const completion = await res.json()
  const content = completion.choices?.[0]?.message?.content ?? ""
  try {
    return { ok: true, data: parseReplies(content) }
  } catch (e) {
    return { ok: false, status: 502, rateLimited: false, detail: `${name} parse: ${(e as Error).message}` }
  }
}

function callGroq(system: string, herMessage: string): Promise<ProviderResult> {
  return callOpenAICompatible(
    "groq", GROQ_URL, GROQ_MODEL, Deno.env.get("GROQ_API_KEY"), "GROQ_API_KEY", system, herMessage,
  )
}

function callCerebras(system: string, herMessage: string): Promise<ProviderResult> {
  return callOpenAICompatible(
    "cerebras", CEREBRAS_URL, CEREBRAS_MODEL, Deno.env.get("CEREBRAS_API_KEY"), "CEREBRAS_API_KEY",
    system, herMessage,
  )
}

// THE FALLBACK CHAIN — order is load-bearing. Each entry is only reached after the one
// above it has exhausted its own BACKOFF_MS retries inside fetchWithRetry.
//   1. gemini    — primary / frontier
//   2. groq      — first fallback
//   3. cerebras  — second fallback
const CHAIN: Array<[string, (s: string, h: string) => Promise<ProviderResult>]> = [
  ["gemini", callGemini],
  ["groq", callGroq],
  ["cerebras", callCerebras],
]

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { her_message, match_id, user_id, mode, prompt, answer } = await req.json()
    const isPromptReply = mode === PROMPT_REPLY_MODE

    if (isPromptReply) {
      if (!prompt || typeof prompt !== "string" || !answer || typeof answer !== "string") {
        return json({ error: "prompt and answer are required" }, 400)
      }
    } else if (!her_message || typeof her_message !== "string") {
      return json({ error: "her_message is required" }, 400)
    }

    // Auth-passthrough client so RLS lets us read this user's own rows.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    )

    const profileQuery = supabase
      .from("personality_profiles")
      .select("hinglish_ratio, emoji_frequency, confidence, humor, sarcasm, boldness, escalation")
      .eq("user_id", user_id)
      .maybeSingle()

    let p: Profile = {}
    let system: string
    let userContent: string

    if (isPromptReply) {
      // No match_id exists on this path, so there is nothing to detect a stage from and no
      // history to fetch — a profile prompt IS the cold open. Only the personality dials
      // are read; buildPromptReplySystem supplies the rest.
      p = ((await profileQuery).data ?? {}) as Profile
      system = buildPromptReplySystem(p, boldLevelFor(p))
      userContent = formatPromptAnswer(prompt, answer)
    } else {
      // Personality + stage + history are all best-effort — the function still works with
      // defaults if any of them come back empty.
      const [profileRes, matchRes, turnsRes] = await Promise.all([
        profileQuery,
        supabase.from("matches").select("message_count").eq("id", match_id).maybeSingle(),
        // The "last 10 turns" CLAUDE.md always specified — it was never actually queried, so
        // every request looked like a fresh conversation to the model and it fell back on its
        // generic prior. Newest-first + limit, then reversed into reading order below.
        supabase
          .from("conversation_turns")
          .select("her_message, sent_text")
          .eq("match_id", match_id)
          .order("created_at", { ascending: false })
          .limit(HISTORY_TURNS),
      ])
      p = (profileRes.data ?? {}) as Profile
      const stage = detectStage(matchRes.data?.message_count ?? 0)
      const turns = ((turnsRes.data ?? []) as Turn[]).slice().reverse()
      // Bold scales with boldness/escalation but never drops below the floor (B2).
      system = buildSystem(p, stage, boldLevelFor(p), turns)
      userContent = her_message
    }

    // Default (REPLY_PROVIDER=gemini) runs the full chain. Naming any other provider
    // pins that one — the existing single-provider escape hatch, now for 3 names.
    const pinned = CHAIN.find(([name]) => name === REPLY_PROVIDER)
    const providers = !pinned || REPLY_PROVIDER === "gemini" ? CHAIN : [pinned]

    let anyRateLimited = false
    for (const [name, fn] of providers) {
      // A network-level failure (DNS, TLS, connection reset) throws instead of returning
      // a status, so it bypasses fetchWithRetry's status-code path entirely. Uncaught it
      // would escape the loop and 500 the whole request — i.e. an outage in the PRIMARY
      // would take out the fallback chain that exists for exactly that case. Treat it as
      // "this provider failed, try the next one". rateLimited: a thrown fetch is transient,
      // so an all-throw chain lands on the retryable 503, not the hard PROVIDER_ERROR.
      let result: ProviderResult
      try {
        result = await fn(system, userContent)
      } catch (e) {
        result = { ok: false, status: 0, rateLimited: true, detail: `${name} threw: ${(e as Error).message}` }
      }
      // `provider` names whoever actually served it, not whoever was asked first.
      if (result.ok) return json({ ...result.data, provider: name })
      anyRateLimited = anyRateLimited || result.rateLimited
      // Log the raw provider detail server-side only — never surface it to the UI.
      console.error(`[generate-replies] ${name} failed → ${result.detail}`)
    }

    // Everything failed. Distinguish rate-limit (retryable) from a hard provider error;
    // the frontend maps RATE_LIMIT_RETRY_EXHAUSTED to a friendly "assistant is busy" note.
    if (anyRateLimited) {
      return json(
        {
          error: "The assistant is busy right now. Please try again in a moment.",
          code: "RATE_LIMIT_RETRY_EXHAUSTED",
        },
        503,
      )
    }
    return json(
      { error: "Couldn't generate replies right now. Please try again.", code: "PROVIDER_ERROR" },
      502,
    )
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
