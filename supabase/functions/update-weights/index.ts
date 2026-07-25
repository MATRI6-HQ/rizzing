// update-weights — REAL. Bumps the match and nudges the personality profile after a pick.
//
// Request  (from src/lib/api.js → updateWeights):
//   { user_id, match_id, turn_id, picked, sent_text, was_edited }
// Response:
//   { success: true, message_count: number, nudged: string[] }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders, json } from "../_shared/cors.ts"

// Mirrors profileStore.js: weights are floats clamped to [0.1, 0.9], nudged in small steps.
const WEIGHT_MIN = 0.1
const WEIGHT_MAX = 0.9
const NUDGE_DELTA = 0.05
const clamp = (v: number) => Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, v))

// Which personality axes each pick nudges up (CLAUDE.md weight-update logic).
const PICK_AXES: Record<string, string[]> = {
  safe: ["persistence", "emotional_tone"],
  witty: ["humor", "confidence"],
  bold: ["boldness", "escalation"],
  // 'override' / 'skipped' nudge no axis.
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { user_id, match_id, picked, sent_text } = await req.json()
    if (!match_id || !picked) {
      return json({ error: "match_id and picked are required" }, 400)
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    )

    // 1) Bump the match: message_count + 1, preview + last_opened. Read-then-write since
    //    supabase-js can't express `message_count = message_count + 1` inline.
    const { data: match } = await supabase
      .from("matches")
      .select("message_count")
      .eq("id", match_id)
      .maybeSingle()
    const nextCount = (match?.message_count ?? 0) + 1
    await supabase
      .from("matches")
      .update({
        message_count: nextCount,
        last_message_preview: sent_text ?? null,
        last_opened: new Date().toISOString(),
      })
      .eq("id", match_id)

    // 2) Nudge the relevant personality axes (same clamp as profileStore.nudgeWeight).
    const axes = PICK_AXES[picked] ?? []
    if (axes.length > 0) {
      const { data: profile } = await supabase
        .from("personality_profiles")
        .select(axes.join(","))
        .eq("user_id", user_id)
        .maybeSingle()

      if (profile) {
        const updates: Record<string, number> = {}
        for (const axis of axes) {
          const current = (profile as Record<string, number>)[axis]
          if (typeof current === "number") updates[axis] = clamp(current + NUDGE_DELTA)
        }
        if (Object.keys(updates).length > 0) {
          await supabase
            .from("personality_profiles")
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq("user_id", user_id)
        }
      }
    }

    return json({ success: true, message_count: nextCount, nudged: axes })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
