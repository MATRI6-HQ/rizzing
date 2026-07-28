// Prompt construction for generate-replies — pure, no Deno/network/env access.
//
// Split out of index.ts so the prompt can be exercised directly (compile this file
// and call buildSystem) without standing up a Deno server or a Supabase client.
// index.ts keeps everything that touches the outside world: provider calls, retries,
// the fallback chain. Same precedent as ../_shared/cors.ts.

/** One past exchange, as stored in conversation_turns. */
export type Turn = { her_message: string | null; sent_text: string | null }

export type Replies = { safe: string; witty: string; bold: string }

// Bold must always read noticeably bolder than Safe/Witty (B2), even for a timid
// profile. It scales up from here with the user's boldness/escalation.
export const BOLD_FLOOR = 6

// How many past exchanges to feed the model. CLAUDE.md's "last 10 turns" — this is the
// cap on the API call, not on what's stored.
export const HISTORY_TURNS = 10

/** Rule-based stage detection from the match's message_count (CLAUDE.md MVP rule). */
export function detectStage(messageCount: number): string {
  if (messageCount < 3) return "cold open"
  if (messageCount < 10) return "rapport"
  if (messageCount < 20) return "connection"
  return "escalation"
}

/**
 * What "bold" is allowed to mean, per stage.
 *
 * The bug this fixes: the old prompt defined bold as "make a direct move like suggesting
 * you meet or asking for her number" at EVERY stage. That's a concrete instruction sitting
 * next to abstract ones ("tease her", "build tension"), and models reach for the concrete
 * one — so Bold was a coffee invite on message one, forever. Escalation is now earned:
 * `canPropose` gates meeting/number behind actually having rapport, and each stage gets its
 * own menu of moves so there's more than one way to be bold.
 */
export const BOLD_BY_STAGE: Record<string, { canPropose: string; moves: string }> = {
  "cold open": {
    canPropose:
      "Do NOT suggest meeting, a date, coffee, drinks, or ask for her number/Instagram. " +
      "You have no rapport yet — proposing anything here reads as desperate, not bold.",
    moves:
      "a confident flip of her opener, a playful challenge, teasing something in what she " +
      "wrote, or an unbothered high-status reply that makes her work for the next one",
  },
  rapport: {
    canPropose:
      "Do NOT propose meeting up or ask for her number yet — it's still too early and it " +
      "cuts the thread short.",
    moves:
      "direct interest stated plainly, a compliment with an edge to it, calling out a shared " +
      "thread from earlier, or teasing her in a way that invites her to hit back",
  },
  connection: {
    canPropose:
      "You may HINT at meeting only if she has already brought up plans, going out, or being " +
      "free — otherwise stay in the conversation.",
    moves:
      "open flirting, naming the chemistry out loud, a confident callback to something she " +
      "said earlier, or raising the tension a notch",
  },
  escalation: {
    canPropose:
      "Proposing a specific plan, or asking for her number/Instagram, IS on the table here — " +
      "but only if it follows naturally from her last message.",
    moves:
      "a concrete, specific plan (not a vague 'we should hang out'), asking to move the chat " +
      "off the app, or a direct statement of what you want",
  },
}

/** Personality dials as stored in personality_profiles (0-1 floats). */
export type Profile = {
  hinglish_ratio?: string
  emoji_frequency?: string
  confidence?: number
  humor?: number
  sarcasm?: number
  boldness?: number
  escalation?: number
}

/** 0-1 weight → a 0-10 dial the model can actually reason about. */
const dial = (v: unknown, fallback: number) => Math.round(Number(v ?? fallback) * 10)

/** Bold intensity for this user — scales with boldness/escalation, never below the floor. */
export function boldLevelFor(p: Profile): number {
  const boldScore = (Number(p.boldness ?? 0.6) + Number(p.escalation ?? 0.6)) / 2
  return Math.max(BOLD_FLOOR, Math.round(boldScore * 10))
}

/** Render the last N exchanges as a transcript block, or "" when there's no history. */
export function buildHistory(turns: Turn[]): string {
  if (turns.length === 0) return ""
  const lines = turns
    .flatMap((t) => [
      t.her_message ? `her: ${t.her_message}` : null,
      t.sent_text ? `him: ${t.sent_text}` : null,
    ])
    .filter(Boolean)
  if (lines.length === 0) return ""
  return `RECENT HISTORY (oldest first — this is the conversation so far):\n${lines.join("\n")}\n\n`
}

/**
 * Build the system prompt. boldLevel (1-10) sharpens and scales the Bold persona;
 * `stage` now drives what Bold is permitted to do, not just a label at the top.
 */
export function buildSystem(
  p: Profile,
  stage: string,
  boldLevel: number,
  turns: Turn[],
): string {
  const bold = BOLD_BY_STAGE[stage] ?? BOLD_BY_STAGE["rapport"]
  return (
    `You are RIZZING, a dating-reply assistant for Indian users on apps like Tinder, ` +
    `Bumble and Hinge. Write in the user's own texting voice — like a real person, not an AI.\n\n` +
    `HIS STYLE (these are the user's own dials — the replies must sound like him):\n` +
    `- Confidence: ${dial(p.confidence, 0.5)}/10\n` +
    `- Humor: ${dial(p.humor, 0.5)}/10\n` +
    `- Sarcasm: ${dial(p.sarcasm, 0.5)}/10\n` +
    `- Boldness: ${dial(p.boldness, 0.6)}/10\n` +
    `- Escalation pace: ${dial(p.escalation, 0.6)}/10\n` +
    `- Hinglish level: ${p.hinglish_ratio ?? "medium"}. Emoji use: ${p.emoji_frequency ?? "sometimes"}.\n\n` +
    `CONVERSATION STAGE: ${stage}.\n\n` +
    buildHistory(turns) +
    `Reply to her last message with exactly three options, as a JSON object whose keys are ` +
    `"safe", "witty" and "bold", each mapping to a reply string:\n` +
    `{"safe": "...", "witty": "...", "bold": "..."}\n\n` +
    `- safe: warm, friendly, low-risk. Keeps things comfortable.\n` +
    `- witty: clever and playful — a light tease, joke, or unexpected angle, dialled to his ` +
    `humor and sarcasm above. Confident, not risky.\n` +
    `- bold: the highest-risk of the three (bold intensity ${boldLevel}/10 for this user). ` +
    `At THIS stage, bold means: ${bold.moves}. ${bold.canPropose}\n\n` +
    `BOLD RULES — this is the option most likely to come out generic, so:\n` +
    `- Bold must answer what she ACTUALLY said. It is a bolder response to HER message, not a ` +
    `change of subject.\n` +
    `- Vary the move. Do not reach for the same kind of bold reply every time.\n` +
    `- If the bold reply could be pasted into a completely different conversation without ` +
    `changing a word, it is wrong — rewrite it so it only makes sense here.\n` +
    `- Never use the stock lines: suggesting coffee, "we should hang out sometime", or any ` +
    `vague invitation with no specifics.\n` +
    `- Do not repeat a move that already appears in RECENT HISTORY, especially one she didn't ` +
    `engage with.\n` +
    `- Charming and confident, never crude, creepy or disrespectful.\n\n` +
    `Rules:\n` +
    `- Match the user's Hinglish level and emoji preference exactly.\n` +
    `- Each reply under 30 words. The three must be clearly different in energy.\n` +
    // Restated last on purpose. The same gate appears above next to the bold definition,
    // but models weight the end of a prompt most heavily and Gemini in particular still
    // slipped a cold-open coffee invite through when this only appeared mid-prompt.
    `- FINAL CHECK on "bold" before you answer: ${bold.canPropose}\n` +
    `- Return ONLY the JSON object, nothing else.`
  )
}
