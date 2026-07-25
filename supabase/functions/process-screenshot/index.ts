// process-screenshot — PLACEHOLDER shell. The real vision/OCR call is isolated in
// callVisionProvider() below, so switching to the production provider is a one-function edit.
//
// Request  (from src/lib/api.js → processScreenshot):
//   { image_base64: string, user_id: string }
// Response (used as the extracted message in ConversationFlow.jsx):
//   { extracted_text: string }
import { corsHeaders, json } from "../_shared/cors.ts"

// Fixed mock returned until a real provider is wired in.
const MOCK_EXTRACTED_TEXT =
  "Heyy so are you actually going to ask me out or just keep texting? 😏"

/**
 * The ONLY place the vision provider is called. Swap the body of this function to go live.
 *
 * ─── REAL PROVIDER CALL GOES HERE ───────────────────────────────────────────────
 * Production plan (CLAUDE.md): Gemini Flash-Lite for OCR/vision. Testing used Groq
 * Vision (llama-3.2-11b-vision), read from the VISION_MODEL secret. Send `imageBase64`
 * to the provider, ask it to extract only the received message text, and return that
 * string. Everything else in this file stays exactly as-is.
 * ────────────────────────────────────────────────────────────────────────────────
 */
async function callVisionProvider(imageBase64: string): Promise<string> {
  void imageBase64 // unused until the real provider is wired in
  return MOCK_EXTRACTED_TEXT
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const { image_base64 } = await req.json()
    if (!image_base64 || typeof image_base64 !== "string") {
      return json({ error: "image_base64 is required" }, 400)
    }

    const extracted_text = await callVisionProvider(image_base64)
    return json({ extracted_text })
  } catch (err) {
    return json({ error: (err as Error).message }, 500)
  }
})
