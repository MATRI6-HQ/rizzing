// update-weights — REAL. Bumps the match and nudges the personality profile after a pick.
//
// Request  (from src/lib/api.js → updateWeights):
//   { user_id, match_id, turn_id, picked, sent_text, was_edited }
// Response:
//   { success: true, message_count: number, nudged: string[], before: Weights, after: Weights }
//
// `before`/`after` are returned so the client can log the actual movement — the weights bug
// this fixed was invisible precisely because every write here was fire-and-forget on both
// ends. Every .update() now carries a .select(): PostgREST answers an RLS-rejected update
// with 2xx and zero rows affected, so without the returned row a missing UPDATE policy is
// indistinguishable from a successful nudge.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders, json } from "../_shared/cors.ts"

// Mirrors profileStore.js: weights are floats clamped to [0.1, 0.9], nudged in small steps.
// 0.05 on a float column moves the /profile display a visible 5 points per pick.
const WEIGHT_MIN = 0.1
const WEIGHT_MAX = 0.9
const NUDGE_DELTA = 0.05
const clamp = (v: number) => Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, v))

// All seven axes — read in full (not just the nudged pair) so `before`/`after` is a
// complete table rather than a two-column slice.
const AXES = [
  "confidence",
  "humor",
  "persistence",
  "emotional_tone",
  "escalation",
  "boldness",
  "sarcasm",
] as const

// Which personality axes each pick nudges up (CLAUDE.md weight-update logic).
const PICK_AXES: Record<string, string[]> = {
  safe: ["persistence", "emotional_tone"],
  witty: ["humor", "confidence"],
  bold: ["boldness", "escalation"],
  // 'override' / 'skipped' nudge no axis — but 'override' is still counted below.
}

// Counted in pick_history. 'skipped' is deliberately absent: it isn't a preference signal.
const COUNTED_PICKS = ["safe", "witty", "bold", "override"]
const EMPTY_HISTORY = { safe: 0, witty: 0, bold: 0, override: 0 }

type Weights = Record<string, number>

const pickWeights = (row: Record<string, unknown>): Weights =>
  Object.fromEntries(AXES.map((a) => [a, Number(row?.[a] ?? 0.5)]))

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
    const { error: matchError } = await supabase
      .from("matches")
      .update({
        message_count: nextCount,
        last_message_preview: sent_text ?? null,
        last_opened: new Date().toISOString(),
      })
      .eq("id", match_id)
    // Logged, not fatal: a failed match bump must not cost the user their weight nudge.
    if (matchError) console.error(`[update-weights] match bump failed → ${matchError.message}`)

    // 2) Nudge the personality axes + count the pick. Both live on the same row, so one
    //    read and one write cover them.
    const axes = PICK_AXES[picked] ?? []
    const counts = COUNTED_PICKS.includes(picked)
    let before: Weights = {}
    let after: Weights = {}

    if (axes.length > 0 || counts) {
      const { data: profile, error: readError } = await supabase
        .from("personality_profiles")
        .select(`${AXES.join(",")},pick_history`)
        .eq("user_id", user_id)
        .maybeSingle()

      if (readError || !profile) {
        console.error(
          `[update-weights] no personality_profiles row for ${user_id} → ${readError?.message ?? "not found"}`,
        )
      } else {
        const row = profile as Record<string, unknown>
        before = pickWeights(row)

        const updates: Weights = {}
        for (const axis of axes) updates[axis] = clamp(before[axis] + NUDGE_DELTA)

        // pick_history is jsonb; spread over the zeroed shape so a partial or absent
        // object can't drop a counter.
        const history = { ...EMPTY_HISTORY, ...((row.pick_history as object) ?? {}) } as Record<string, number>
        if (counts) history[picked] = (history[picked] ?? 0) + 1

        const { data: updated, error: writeError } = await supabase
          .from("personality_profiles")
          .update({ ...updates, pick_history: history, updated_at: new Date().toISOString() })
          .eq("user_id", user_id)
          .select(AXES.join(","))
          .maybeSingle()

        if (writeError) {
          console.error(`[update-weights] weight write failed → ${writeError.message}`)
        } else if (!updated) {
          // 2xx with no row back = the UPDATE matched nothing the caller is allowed to see.
          console.error(
            `[update-weights] weight update affected 0 rows for ${user_id} — check the personality_profiles UPDATE RLS policy`,
          )
        } else {
          after = pickWeights(updated as Record<string, unknown>)
        }
      }
    }

    return json({ success: true, message_count: nextCount, nudged: axes, before, after })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
