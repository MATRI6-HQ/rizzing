// generate-replies — three distinct reply variants (safe / witty / bold).
//
// Provider routing (B1): a strict fallback CHAIN, tried in order, each with its own
// backoff. Gemini (primary) → Groq (first fallback) → Cerebras (second fallback). A
// provider only falls through once its own retries are exhausted; nothing skips ahead.
// Set REPLY_PROVIDER=gemini (default) + the keys below in the Edge Function secrets.
// All three are forced into strict JSON so a model can never return bare keys.
//
// Request  (from src/lib/api.js → generateReplies):
//   { her_message: string, match_id: string, user_id: string }
// Response (rendered by ConversationFlow.jsx reply bubbles):
//   { safe: string, witty: string, bold: string, provider: string }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders, json } from "../_shared/cors.ts"

// gemini (default) = run the whole chain. Any other provider name pins that one provider.
const REPLY_PROVIDER = (Deno.env.get("REPLY_PROVIDER") ?? "gemini").toLowerCase()

const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash-lite"
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

// Groq is OpenAI-compatible. MODEL_NAME keeps the existing testing model.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = Deno.env.get("MODEL_NAME") ?? "llama-3.1-8b-instant"

// Cerebras is also OpenAI-compatible — same helper, different host/model/key.
const CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions"
const CEREBRAS_MODEL = Deno.env.get("CEREBRAS_MODEL") ?? "llama-3.3-70b"

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

// Bold floor — Bold must always read noticeably bolder than Safe/Witty (B2), even for
// a timid profile. It scales up from here with the user's boldness/escalation.
const BOLD_FLOOR = 6

type Replies = { safe: string; witty: string; bold: string }
type ProviderResult =
  | { ok: true; data: Replies }
  | { ok: false; status: number; rateLimited: boolean; detail: string }

// Rule-based stage detection from the match's message_count (CLAUDE.md MVP rule).
function detectStage(messageCount: number): string {
  if (messageCount < 3) return "cold open"
  if (messageCount < 10) return "rapport"
  if (messageCount < 20) return "connection"
  return "escalation"
}

/** Tolerant parse: strip ``` fences, JSON.parse, require the three string keys. */
function parseReplies(raw: string): Replies {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim()
  const obj = JSON.parse(cleaned) as Record<string, unknown>
  const pick = (k: string) => (typeof obj[k] === "string" ? (obj[k] as string).trim() : "")
  const replies = { safe: pick("safe"), witty: pick("witty"), bold: pick("bold") }
  if (!replies.safe && !replies.witty && !replies.bold) throw new Error("no reply keys present")
  return replies
}

/** Build the system prompt. boldLevel (1-10) sharpens and scales the Bold persona. */
function buildSystem(
  p: { hinglish_ratio?: string; emoji_frequency?: string },
  stage: string,
  boldLevel: number,
): string {
  return (
    `You are RIZZING, a dating-reply assistant for Indian users on apps like Tinder, ` +
    `Bumble and Hinge. Write in the user's own texting voice — like a real person, not an AI.\n` +
    `Hinglish level: ${p.hinglish_ratio ?? "medium"}. Emoji use: ${p.emoji_frequency ?? "sometimes"}.\n` +
    `Conversation stage: ${stage}.\n\n` +
    `Reply to her last message with exactly three options, as a JSON object whose keys are ` +
    `"safe", "witty" and "bold", each mapping to a reply string:\n` +
    `{"safe": "...", "witty": "...", "bold": "..."}\n\n` +
    `- safe: warm, friendly, low-risk. Keeps things comfortable.\n` +
    `- witty: clever and playful — a light tease, joke, or unexpected angle. Confident, not risky.\n` +
    `- bold: genuinely daring (bold intensity ${boldLevel}/10 for this user). Forward and flirty, ` +
    `takes initiative — tease her, build tension, or make a direct move like suggesting you meet or ` +
    `asking for her number. It MUST read clearly bolder than safe and witty. Charming and confident, ` +
    `never crude, creepy or disrespectful.\n\n` +
    `Rules:\n` +
    `- Match the user's Hinglish level and emoji preference exactly.\n` +
    `- Each reply under 30 words. The three must be clearly different in energy.\n` +
    `- Return ONLY the JSON object, nothing else.`
  )
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
    const { her_message, match_id, user_id } = await req.json()
    if (!her_message || typeof her_message !== "string") {
      return json({ error: "her_message is required" }, 400)
    }

    // Auth-passthrough client so RLS lets us read this user's own rows.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    )

    // Personality + stage are best-effort — the function still works with defaults.
    const [profileRes, matchRes] = await Promise.all([
      supabase
        .from("personality_profiles")
        .select("hinglish_ratio, emoji_frequency, confidence, humor, boldness, escalation")
        .eq("user_id", user_id)
        .maybeSingle(),
      supabase.from("matches").select("message_count").eq("id", match_id).maybeSingle(),
    ])
    const p = profileRes.data ?? {}
    const stage = detectStage(matchRes.data?.message_count ?? 0)

    // Bold scales with boldness/escalation but never drops below the floor (B2).
    const boldScore = (Number(p.boldness ?? 0.6) + Number(p.escalation ?? 0.6)) / 2
    const boldLevel = Math.max(BOLD_FLOOR, Math.round(boldScore * 10))

    const system = buildSystem(p, stage, boldLevel)

    // Default (REPLY_PROVIDER=gemini) runs the full chain. Naming any other provider
    // pins that one — the existing single-provider escape hatch, now for 3 names.
    const pinned = CHAIN.find(([name]) => name === REPLY_PROVIDER)
    const providers = !pinned || REPLY_PROVIDER === "gemini" ? CHAIN : [pinned]

    let anyRateLimited = false
    for (const [name, fn] of providers) {
      const result = await fn(system, her_message)
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
