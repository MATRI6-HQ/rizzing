# RIZZING — Claude Code Context

## Company structure
- Parent company: **MATRI6**
- This product: **RIZZING** (first product, dating conversation assistant)
- Web URL: rizzing.matri6.com
- Bundle ID: com.matri6.rizzing
- Play Store account: MATRI6

---

## What this app does
RIZZING is an AI-powered dating conversation assistant for the Indian market. Users paste, screenshot, or type a message they received, and the app returns three labelled reply options (Safe, Witty, Bold) tailored to their personality. The core edge is a personality engine that learns from what the user picks — not from surveys.

**Target users:** Indian males and females on dating apps (Tinder, Bumble, Hinge) and WhatsApp.
**Primary platform:** Android (via Capacitor wrapping React)
**Language mix:** English + Hinglish (Hindi-English code-switching)

---

## Tech stack

| Layer | Tool |
|---|---|
| Frontend | React + Vite |
| Styling | Tailwind CSS (configured with RIZZING tokens) |
| Routing | React Router v6 |
| State | Zustand |
| Backend/DB | Supabase (auth, database, edge functions, storage) |
| AI — testing | Groq API (llama-3.1-8b-instant for replies, llama-3.2-11b-vision for OCR) |
| AI — launch | Claude API (swap endpoint only, no logic changes) |
| Mobile | Capacitor (bundled mode — assets compiled into APK) |
| Distribution | APK via Firebase App Distribution (testing), Play Store (launch) |

---

## Design system

### Color palette — always use these exact hex values

```css
/* Base surfaces */
--bg-app:        #0D0D0D;   /* app background */
--bg-card:       #171717;   /* cards, bottom sheets */
--bg-elevated:   #212121;   /* modals, overlays */
--bg-border:     #2E2E2E;   /* borders */

/* Gold accent — primary brand color */
--gold-tint:     #1A1608;   /* subtle gold background */
--gold-light:    #E8C56F;   /* hover states */
--gold:          #D4A843;   /* primary CTA, active states, Witty reply */
--gold-dark:     #B08828;   /* pressed states */

/* Text */
--text-primary:   #F0EDE8;  /* main text */
--text-secondary: #9B9690;  /* supporting text */
--text-muted:     #5C5852;  /* timestamps, labels */

/* Reply type system */
--safe:          #3D8B5E;   /* safe reply — green */
--safe-bg:       #0E1A13;   /* safe reply card background */
--witty:         #D4A843;   /* witty reply — same as brand gold */
--witty-bg:      #1A1608;   /* witty reply card background */
--bold:          #C4503A;   /* bold reply — coral */
--bold-bg:       #1A0E0B;   /* bold reply card background */
```

### Typography
- Font: System default (San Francisco on iOS, Roboto on Android via Capacitor)
- Headings: font-weight 500, never 600 or 700
- Body: 14px, line-height 1.6
- Caption: 11px, text-muted color
- Always sentence case — never ALL CAPS or Title Case in UI labels

### UI rules
- Dark mode only — no light mode
- Border radius: 8px for cards, 12px for bottom sheets, 20px for full-screen sheets
- Borders: always 0.5px, never 1px
- **Depth & hover (updated — the app now ships as a responsive web build):** soft
  drop shadows and a faint gold glow on primary actions ARE used intentionally for
  depth (the earlier "no shadows/gradients" rule is superseded). Shared utilities in
  `index.css`: `.lift` / `.lift-gold` (hover lift + shadow / gold glow, paired with
  `.press` for the active state), `.btn-shadow` (static depth). Gold gradients appear
  on outgoing bubbles, persona bars, and progress fills. Keep it smooth, never bouncy.
- **Responsive app shell:** every top-level screen column uses `.app-shell`
  (max-width 440px). Phones go edge-to-edge; from 480px up the column gets a hairline
  side border + soft shadow so it reads as a phone, not a stretched page. Fixed bottom
  sheets use `max-w-[440px]` to match.
- The active / selected reply option gets a 1.5px border (not 0.5px)
- WhatsApp/Instagram style conversation thread — her messages left, sent messages right
- Conversation input is a single messenger composer bar (see below), not tabs

### Motion (shared, do not hand-roll per screen)
- `src/components/PageTransition.jsx` — the only place transition logic lives.
  Default export wraps content and replays a fade + 10px upward slide (220ms
  ease-out) whenever its `transitionKey` prop changes. Used in `App.jsx` keyed on
  `location.pathname` (route changes) and in `OnboardingFlow.jsx` keyed on `step`.
  Named export `withViewTransition(update)` wraps a state update so browsers with
  the View Transitions API also fade the *outgoing* view out; elsewhere it is a
  plain update and only the enter animation plays.
  Named export **`useTransitionNavigate()`** is the navigate to use for user-initiated
  route changes — it routes React Router's `navigate` through `withViewTransition` so the
  two screens cross-fade. Without it the outgoing tree is swapped out synchronously and
  only the incoming screen animates; that one-frame gap is what read as a "hard cut".
  Wired into Auth, Onboarding, Home, Conversation and Profile.
  **Auto-redirects fired from an effect keep the plain `useNavigate`** (CheckEmailScreen /
  AuthCallback): `withViewTransition` calls `flushSync`, which warns inside a lifecycle,
  and a redirect the user never asked for shouldn't animate anyway.
  `withViewTransition` sets `data-view-transition="active"` on `<html>` for the duration;
  `index.css` uses it to mute `.page-transition`'s own enter animation, since during a view
  transition the root snapshot already plays `page-enter` and the two would otherwise stack
  into a 20px double-bounce. The flag is cleared via `transition.finished.finally` — the
  `finally` matters because `finished` *rejects* on a skipped transition, and an unhandled
  rejection there would leave the app permanently un-animated.
- CSS lives in `src/index.css`: `@keyframes page-enter` / `page-exit`, the
  `.page-transition` class, and the `::view-transition-old/new(root)` rules.
  `.page-transition` uses `animation-fill-mode: backwards` on purpose — a forwards
  fill leaves an identity transform behind, which would turn the wrapper into a
  containing block for the `position: fixed` bottom sheets.
- `.press` (also in `index.css`) is the shared tactile press class: `scale: 0.97`
  over 100ms on `:active:not(:disabled)`. Put `.press` on every tappable control;
  `.btn-gold` gets it automatically. It uses the `scale` property rather than
  `transform` so it never fights a transform set elsewhere on the same element.
  Do not add per-instance `active:scale-*` Tailwind utilities — use `.press`.
- No spring/bounce/overshoot anywhere. Reduced-motion is honoured via
  `@media (prefers-reduced-motion: reduce)`.

### Chat bubble system (shared by Onboarding scenarios + ConversationFlow)
- `src/components/ChatBubble.jsx` — default export `ChatBubble` (`variant`:
  `incoming`/`outgoing`, `tone`: `safe`/`witty`/`bold`/`neutral`, `selectable`,
  `selected`, `onClick`). Named export `TypingIndicator` — three staggered dots
  shown while a message is "being typed". Both surfaces render every message
  through this component so they stay visually identical by construction — do
  not hand-roll bubble markup elsewhere.
- `src/components/ChatThread.jsx` — scrollable container, auto-scrolls to the
  newest child on `autoScrollKey` change, and renders a faint SVG-turbulence
  grain overlay for atmosphere. `el.scrollTo` is feature-detected since jsdom
  (unit tests) doesn't implement it.
- `.chat-bubble__text` sets **`overflow-wrap: anywhere`** — do not remove it.
  `white-space: pre-wrap` does not break an unbroken token and `.chat-bubble` has no
  `overflow: hidden`, so a pasted URL rendered 517px of text inside a 243px bubble and
  pushed the 375px column into horizontal scroll. This is the one place user-pasted text
  renders without `truncate`, so it's the only spot that needs it.
- CSS lives in `src/index.css` under "Chat bubble system": `.chat-bubble`,
  `.chat-bubble--incoming/--outgoing`, `.chat-bubble--tone-*`,
  `.chat-bubble--selectable/--selected`, `.typing-dot`, `.fab-next` (the gold
  circular scenario-advance FAB), `.scenario-pips` (segmented progress).
- Onboarding scenarios (`OnboardingFlow.jsx`'s `ScenarioStep`): tapping an
  option only highlights it (`ChatBubble selected`) — it never advances.
  Advancing is only via the gold FAB (`advanceScenario`), disabled until a
  choice is picked. Her message reveals after a `TYPING_REVEAL_MS` (700ms)
  typing beat. Progress during the scenario phase shows as segmented pips +
  "Step X of {SCENARIOS.length}" (8, not 7 — escalation is double-sampled
  across two scenarios, see the axis-map comment in OnboardingFlow.jsx).
- ConversationFlow: past committed turns render as `ChatBubble`s from
  `previousChatStore`; the current her-message + 3 draft replies render below,
  tone-tagged and selectable. Selecting a draft only highlights it — sending is
  a separate explicit "Send →" action.

### 3-mode chat entry + "continue previous" (Home → ConversationFlow)
- `src/screens/Home/EntryModeSheet.jsx` — shown when a match card is tapped
  (instead of navigating straight to `/conversation`). Three cards: Context,
  New topic, Continue previous. No new route — it's a modal state
  (`entryMatch`) on `HomeScreen`; the choice is passed to ConversationFlow as
  `?mode=context|new|continue` (cosmetic subtitle only, same input flow).
- `src/store/previousChatStore.js` — Zustand + `persist` (**localStorage key
  `rizzing-continue-previous`** — renamed from the old `rizzing-chat-sessions`;
  persistence is what makes "Continue previous" survive a refresh). Client-only
  for MVP: **no Supabase sync yet.** Cross-device sync is deferred — the durable
  server-side history already lives in `conversation_turns`, so reconstruct from
  there rather than adding a new table/column (the deployed schema is frozen).
  One entry per `matchId`: `{ active: Turn[], slot: { messages, savedAt, preview } | null }`.
  - `active` — the live thread ConversationFlow renders + appends to.
  - `slot` — the ONE durable "continue previous" snapshot. `preview` = last
    message text; `savedAt` = ISO timestamp (shown in the entry sheet).
  - `saveContinuePrevious(matchId)` — copies `active` → `slot`. **No-op if
    `active` is empty**, so leaving an untouched session never wipes a real slot.
    Called at three trigger points: on **Send** (`handleSend`), on **back /
    navigate-away** (ConversationFlow unmount `useEffect` cleanup, via
    `getState()` so the closure can't go stale), and inside `startFresh`.
  - `startFresh(matchId)` — called on **Context** and **New topic**: archives
    `active` → `slot` (if non-empty), then clears `active`.
  - `continuePrevious(matchId)` — called on **Continue previous**: loads
    `slot.messages` back into `active` (slot untouched, so a later New topic
    still archives correctly).
  - `appendTurn(matchId, turn)` — pushes `{ role, text, tone? }` onto `active`.
  - `EntryModeSheet` shows the slot's `preview` + relative `savedAt` as the
    "Continue previous" subtitle; the card is disabled with "No previous chat
    yet" when `getSlot(matchId)` is null/empty.
  - **The bug this fixed:** the old model only filled the slot on a *second*
    `startFresh`, so pressing back then reopening always showed "No previous
    chat yet". Saving on exit + on send is what populates the slot.

---

## App screens

### 1. Auth
- Email + password via Supabase email auth (for testing)
- Phone OTP replaces this at launch when Twilio is configured
- Keep auth logic in one file (src/lib/auth.js) so swapping providers is a single change
- UI: email input, password input, toggle between sign in and sign up, minimal
- Tagline under the wordmark: **"Your move, your vibe."** (English-forward — replaced
  the earlier Hinglish tagline; keep the same tracked, uppercased treatment)
- **Email verification gate** (Supabase "Confirm email" is ON):
  `src/screens/Auth/CheckEmailScreen.jsx` holds both halves — default export is the
  `/auth/check-email` wall (resend button, 30s cooldown), named export `AuthCallback`
  is `/auth/callback`. Both routes are `protected: false` on purpose; protecting them
  would loop against the guard. `RequireAuth` in `App.jsx` bounces any session whose
  `user.email_confirmed_at` is null to the wall, so Home/ConversationFlow stay blocked.
  Signup no longer auto-signs-in when `signUp` returns `session: null`. A sign-in that
  fails with "Email not confirmed" also routes to the wall rather than showing a
  dead-end error. `AppRoutes` is exported from `App.jsx` purely so
  `src/tests/authGuard.test.jsx` can mount the real guard against the real route table
  inside a `MemoryRouter` — don't inline it back into `App`.
  **APK caveat:** the AndroidManifest intent-filter reopens the app on the deep link, but
  nothing yet routes the webview to `/auth/callback` or hands the token to supabase-js.
  Until that's wired, point the APK's Supabase redirect at the **web** URL
  (`https://rizzing.matri6.com/auth/callback`) — verification completes in the browser,
  then the user returns to the app and signs in. See "Android deep link" below.

### 2. Onboarding (runs once)
**Part A — Quick prefs (30 seconds):**
- Hinglish level: three tappable pills — Pure English / Thoda Hindi / Full Hinglish
- Emoji use: Never / Sometimes / Har jagah
- Favourite emojis: grid of 20 common ones, user picks up to 5

**Interstitial — vibe check (shown once, between the quick prefs and the first scenario):**
Not a numbered step — `step` does not increment and the progress bar does not move.
Component: `VibeCheckIntro` in `src/screens/Onboarding/OnboardingFlow.jsx`, gated on
the `introSeen` state. Copy is fixed:
- Heading: "Quick vibe check before we start"
- Body: "We're gonna show you a few real chat moments. Just react how you actually would — no overthinking it. This is how we figure out your rizz style, not your grammar."
- Button: "Let's go"

**Consent gate (runs before everything — added when data storage + ads were introduced):**
A Terms & Privacy screen (`TermsGate` in `OnboardingFlow.jsx`) shows once before step 1.
A required checkbox gates Continue. Acceptance (version + timestamp) is stored in
`useConsentStore` (persisted localStorage, `rizzing-consent`) AND folded into
`personality_profiles.onboarding_responses.terms` at finish. Content lives in
`src/lib/legal.js` (`TERMS_VERSION`, `TERMS_SUMMARY`, `TERMS_SECTIONS`) and renders via
`src/components/TermsContent.jsx`, reused by the Profile screen. **The copy is a
PLACEHOLDER** — replace with reviewed ToS/Privacy before launch (see the note in legal.js).

**Part B — 7 scenarios (revealed preference):**
Each screen shows a girl's message and 4 reply options as chat bubbles. Picking one only
highlights it; a gold FAB advances (no auto-advance). This is how the personality profile
is built — do NOT ask survey questions. There are exactly **7 scenarios → 7 axes** (1:1),
scored by `computeWeights` from 7 choices. Progress shows as segmented pips + "Step X of 7"
(setup steps show "Step X of 3") — this is the ONLY progress indicator; there is no legacy
top bar. Scenario 4 ("hmm ok") options each lean into a different axis but score persistence.

Scenario axis mapping:
1. She sends a cold opener → confidence level
2. She makes a joke → humor style
3. She's giving one-word replies → persistence
4. She mentions something personal → emotional tone
5. She's clearly interested → escalation pace
6. She's being playful/flirty → boldness
7. She says something obvious/generic → sarcasm tendency

### 3. Home (matches list)
- Header: RIZZING puzzle-piece logo (`/1.jpg`, the public brand mark / favicon) top-left,
  profile (person silhouette) top-right. The empty state reuses the same logo.
- List of matches the user has created
- Each match shows name, stage badge, last opened
- FAB to add new match
- Tap a match → opens the 3-mode entry sheet (see "3-mode chat entry" above)

### 4. Conversation screen (core feature)
**Entry:** tapping a match on Home opens the 3-mode entry sheet (Context / New
topic / Continue previous — see "3-mode chat entry" above) before landing here.
**Top:** Match name + mode subtitle + stage badge.
**Middle:** `ChatThread` of `ChatBubble`s — committed turns from
`previousChatStore`, then the pending her-message + 3 tone-tagged draft
replies once generated.
**Bottom:** A single **messenger composer bar** (`.chat-composer`: one textarea +
gold circular send button, Enter sends / Shift+Enter newline) while no drafts are up.
There are NO Paste/Type/Screenshot tabs and **no screenshot/OCR path** — that feature
was dropped from the UI (zero budget, no vision API). `process-screenshot` still exists
as an Edge Function but nothing in the app calls it. Once drafts exist the bottom area
becomes Customize / Generate another / Send.
Selecting a draft only highlights it — **Send** is the explicit commit action:
copies to clipboard, writes the `conversation_turns` row, fires
`update-weights` in the background, appends both sides of the exchange to
`previousChatStore`, and shows "✓ Sent as {tone} · We'll remember this". The
thread stays open afterwards (no auto-navigate home) — it's a persistent chat,
not a one-shot. **Customize** (`CustomizeSheet`) re-calls `generate-replies` with a
tweak instruction folded into the her_message string.

### 5. Profile screen (`ProfileScreen.jsx` — built)
The user's **rizz persona**, not a dating profile:
- Persona: the 7 personality axes as gold gradient bars (`.persona-track`/`.persona-fill`).
- Preferences: Hinglish level + emoji use as editable pills — a change writes
  `hinglish_ratio` / `emoji_frequency` to `personality_profiles` and updates the store.
- Account: email, plan badge ("Free · ad-supported" — no purchase flow), Terms & Privacy
  link (opens a sheet reusing `TermsContent`).
- Actions: redo onboarding (→ /onboarding), log out (signs out + resets stores → /auth).

---

## Background engine (bg engine)

### What it does
Takes: personality profile + her message + conversation stage + last 10 turns of match history
Returns: three reply options in one API call

### Stage detection (rule-based for MVP)
Detect from message count stored in the match:
- Cold open: message_count < 3
- Rapport: 3–10
- Connection: 10–20
- Escalation: 20+

Also detect escalation signals in her message text: mentions of meeting, number, WhatsApp, "kab miloge", etc.

### Prompt construction — `generate-replies/prompt.ts`

All prompt building lives in `prompt.ts`, split out of `index.ts` and importing nothing
(no Deno, no network). `index.ts` keeps provider calls, retries and the fallback chain.
The split exists so the prompt can be compiled and run against a live provider directly —
that's the only practical way to check a prompt change, since prompt regressions are
statistical and nothing a unit test can assert.

**Bold is defined per stage, not globally** (`BOLD_BY_STAGE`). The original prompt defined
bold as "make a direct move like suggesting you meet or asking for her number" at *every*
stage. That concrete instruction sat next to abstract ones ("tease her", "build tension")
and models reach for the concrete one — so Bold was a coffee invite on message one, every
time. Now each stage carries its own `moves` menu plus a `canPropose` gate:

| Stage | Can Bold propose meeting / ask for number? |
|---|---|
| cold open | No — explicitly forbidden, there's no rapport to justify it |
| rapport | No — still too early |
| connection | Only if *she* raised plans/being free first |
| escalation | Yes — but it must be a specific plan, not "we should hang out sometime" |

`canPropose` is stated **twice**: next to the bold definition, and again as the last rule
before the JSON instruction. The restatement is load-bearing — with it appearing only
mid-prompt, Gemini still leaked cold-open coffee invites; moving a copy to the end fixed it.

**The history fetch is what stops repetition.** CLAUDE.md always specified "last 10 turns",
but `conversation_turns` was never actually queried — every request looked like a brand-new
conversation, so the model fell back on its generic prior. `HISTORY_TURNS` (10) of
`{her_message, sent_text}` now go in as a transcript block. `confidence`/`humor`/`sarcasm`
were likewise being SELECTed and then dropped on the floor; they're in the prompt now.

Measured on the four fixture conversations (one per stage), Bold reaching for the
meet-up/coffee cliché: **Groq 60% → 8%, Gemini 83% → 0%** at pre-escalation stages.

### Model call structure (provider routing — updated)
- `generate-replies` runs a fixed fallback `CHAIN`: **Gemini (primary) → Groq (first
  fallback) → Cerebras (second fallback)**. Each provider exhausts its own `BACKOFF_MS`
  retries before the next is tried — nothing skips ahead. `REPLY_PROVIDER` (default
  `gemini`) runs the whole chain; naming any other provider pins that single one.
  The response includes `provider`, naming whoever actually served the request.
  Groq + Cerebras are both OpenAI-compatible and share `callOpenAICompatible()`.
  `callGemini()` uses `responseMimeType: application/json` + a `responseSchema`;
  `callGroq()` uses `response_format: {type:"json_object"}`. Both are forced into a
  strict `{safe, witty, bold}` object, and a tolerant parser strips ``` fences and
  validates the three keys — so the old Groq "bare keys" failure can't reach the UI.
- Bold is sharpened + scaled by the user's `boldness`/`escalation` weights, with a
  hard floor (`BOLD_FLOOR = 6/10`) so Bold always reads clearly bolder than Safe/Witty.
- Rate-limit / 5xx get backoff+retry; exhausted → `RATE_LIMIT_RETRY_EXHAUSTED` (a clean
  UI message), never the raw provider blob. **Two schedules, both at the top of the file:**
  `PRIMARY_BACKOFF_MS = [500, 1500, 4000]` (Gemini — worth waiting on) and
  `FALLBACK_BACKOFF_MS = [500, 1500]` (Groq + Cerebras — already degraded, fail fast).
  `fetchWithRetry(url, init, backoff)` takes the schedule as its third arg. Worst case
  (all three exhaust) = 10s of sleep + 10 round-trips, down from 18s + 12.
- One call, returns all 3 replies as JSON. Target: under 5 seconds total.
- **Secrets to set in Supabase (Edge Function → Secrets), then redeploy:**
  `REPLY_PROVIDER=gemini`, `GEMINI_API_KEY=<key>` (verify it's a real Generative
  Language API key, `AIza…`, not an OAuth token), optionally `GEMINI_MODEL`. Groq stays
  as first fallback via `GROQ_API_KEY` + `MODEL_NAME`; Cerebras is the second fallback via
  `CEREBRAS_API_KEY` (+ optional `CEREBRAS_MODEL`). Deploy:
  `supabase functions deploy generate-replies`. **Local edits are not live until this
  deploy runs.**

#### Model names — verified live 2026-07-26, do not guess these
| Provider | Model | Note |
|---|---|---|
| Gemini | `gemini-flash-lite-latest` | ✅ ~1.1s. **Not** `gemini-2.5-flash-lite` — Google 404s it for new API keys ("no longer available to new users") while STILL listing it in `/v1beta/models`. A pinned id can die under you; the alias can't. `gemini-3.5-flash-lite` also works but is 6.3s. |
| Groq | `llama-3.1-8b-instant` | ✅ ~0.3s, fastest of the three. |
| Cerebras | `gpt-oss-120b` | ⚠️ **All** Cerebras models return HTTP 402 "Payment required" until billing is enabled. `/v1/models` on this account offers only `zai-glm-4.7`, `gpt-oss-120b`, `gemma-4-31b` — **no llama**, so the old `llama-3.3-70b` default 404'd unconditionally. |

402 is deliberately outside the retryable set (`429 || >= 500`), so a billing-blocked
Cerebras costs one round-trip, not a backoff cycle.

To re-verify all three at any time, run the probe in the scratchpad against
`supabase/functions/.env` (same URLs/models/JSON-mode params as the function, no Deno needed).

### System prompt structure (for Edge Function)
```
You are a dating conversation assistant for Indian users. 

User personality:
- Confidence: {score}/10
- Humor: {score}/10  
- Sarcasm: {score}/10
- Boldness: {score}/10
- Escalation pace: {score}/10
- Hinglish level: {low/medium/high}
- Emoji use: {never/sometimes/always}

Conversation stage: {stage}
Last messages: {last_3_turns}

She just sent: "{her_message}"

Generate exactly 3 replies as JSON:
{
  "safe": "...",
  "witty": "...",
  "bold": "..."
}

Rules:
- Match the user's Hinglish level exactly
- Safe = warm, low risk
- Witty = clever, confident, light humour
- Bold = direct, high energy
- Each reply under 30 words
- Return ONLY the JSON object, nothing else
```

### Weight update logic
After every pick, update the personality_profiles row (one per user, keyed by user_id):
- Pick safe → persistence + emotional_tone nudge up slightly
- Pick witty → humor + confidence nudge up
- Pick bold → boldness + escalation nudge up
- Increment the matching counter in pick_history jsonb
- Edit before send → set was_edited true, store the change in conversation_turns.edit_delta
- Write own reply (picked = 'override') → append raw text to personality_profiles.raw_overrides array
- Clamp every weight between 0.1 and 0.9 — never below or above

---

## Supabase schema

This is the ACTUAL schema already deployed in Supabase with RLS enabled. Do not recreate these tables — they exist. Match all code (queries, inserts, types) to these exact column names.

### Table: profiles
```sql
id uuid references auth.users(id) on delete cascade primary key,
full_name text,
age integer,
city text,
gender text,
email text,
avatar_url text,
created_at timestamptz default now(),
updated_at timestamptz default now()
```
RLS: users can do all on rows where auth.uid() = id

### Table: personality_profiles
```sql
id uuid default gen_random_uuid() primary key,
user_id uuid references profiles(id) on delete cascade unique,
confidence float default 0.5,
humor float default 0.5,
persistence float default 0.5,
emotional_tone float default 0.5,
escalation float default 0.5,
boldness float default 0.5,
sarcasm float default 0.5,
hinglish_ratio text default 'medium',
emoji_frequency text default 'sometimes',
preferred_emojis text[] default '{}',
onboarding_responses jsonb default '[]',
pick_history jsonb default '{"safe": 0, "witty": 0, "bold": 0, "override": 0}',
raw_overrides jsonb default '[]',
onboarding_complete boolean default false,
created_at timestamptz default now(),
updated_at timestamptz default now()
```
RLS: users can do all on rows where auth.uid() = user_id
Note: user_id is unique — one personality profile per user (use upsert).

### Table: matches
```sql
id uuid default gen_random_uuid() primary key,
user_id uuid references profiles(id) on delete cascade,
name text not null,
platform text default 'other',
stage text default 'cold_open',
message_count integer default 0,
last_opened timestamptz default now(),
is_active boolean default true,
created_at timestamptz default now()
```
RLS: users can do all on rows where auth.uid() = user_id
Note: deletes are soft — set is_active = false, never hard delete. Filter lists by is_active = true.

### Table: conversation_turns
```sql
id uuid default gen_random_uuid() primary key,
match_id uuid references matches(id) on delete cascade,
user_id uuid references profiles(id) on delete cascade,
her_message text not null,
detected_stage text,
option_safe text,
option_witty text,
option_bold text,
picked text,
sent_text text,
was_edited boolean default false,
edit_delta text,
created_at timestamptz default now()
```
RLS: users can do all on rows where auth.uid() = user_id
Note: picked is one of 'safe' / 'witty' / 'bold' / 'override' / 'skipped'

---

## Supabase Edge Functions (3 functions)

### generate-replies
POST /functions/v1/generate-replies
Body: { her_message, match_id, user_id }
- Fetches personality profile from DB
- Fetches last 10 turns for this match
- Detects stage from match.message_count
- Builds system prompt
- Calls Groq (or Claude at launch)
- Returns { safe, witty, bold }

### process-screenshot
POST /functions/v1/process-screenshot
Body: { image_base64, user_id }
- Passes image to Groq Vision (llama-3.2-11b-vision)
- Extracts the text message from the screenshot
- Returns { extracted_text }

### update-weights
POST /functions/v1/update-weights
Body: { user_id, match_id, turn_id, picked, sent_text, was_edited }
- Updates personality_profiles weights based on pick
- If was_edited, stores diff in raw_overrides
- Updates match.message_count + last_opened

---

## Environment variables

The .env file in the project root is already set up with these two (do not regenerate it):

```env
VITE_SUPABASE_URL=https://jeatammaspubsqbwbhgf.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...   # Supabase publishable key — safe for client, RLS protects data
```

These are already set as Supabase Edge Function secrets (never put them in the app or .env):
```
GROQ_API_KEY      = (set)
MODEL_NAME        = llama-3.1-8b-instant      # swap to claude model string at launch
VISION_MODEL      = llama-3.2-11b-vision      # swap to a Claude vision model at launch
# At launch, add: ANTHROPIC_API_KEY
```

The Edge Functions read MODEL_NAME and VISION_MODEL from secrets, so switching from Groq to Claude at launch is a secrets change plus the base URL in the function — no app code change.

---

## Project file structure

```
rizzing/
├── CLAUDE.md
├── public/                (Vite publicDir — see "Static assets" below; NOT optional)
│   ├── 1.jpg              (MATRI6/RIZZING puzzle icon)
│   └── 2.jpg              (RIZZING full logo with wordmark)
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── routes.jsx         (single source of truth for the router)
│   ├── index.css          (Tailwind + CSS tokens + chat-bubble system)
│   ├── lib/
│   │   ├── supabase.js    (Supabase client)
│   │   ├── auth.js        (auth helpers)
│   │   ├── legal.js       (Terms/Privacy PLACEHOLDER copy + TERMS_VERSION)
│   │   └── api.js         (calls to Edge Functions)
│   ├── store/
│   │   ├── authStore.js         (Zustand — user session)
│   │   ├── profileStore.js      (personality profile + weights)
│   │   ├── matchStore.js        (matches + active match)
│   │   ├── consentStore.js      (T&C acceptance, persisted)
│   │   └── previousChatStore.js (per-match active/previous chat, persisted)
│   ├── screens/
│   │   ├── Auth/
│   │   │   └── AuthScreen.jsx
│   │   ├── Onboarding/
│   │   │   └── OnboardingFlow.jsx   (consent gate + QuickPrefs + vibe-check + 7 scenarios)
│   │   ├── Home/
│   │   │   ├── HomeScreen.jsx
│   │   │   └── EntryModeSheet.jsx   (Context / New topic / Continue previous)
│   │   ├── Conversation/
│   │   │   ├── ConversationFlow.jsx (messenger composer — no screenshot/OCR)
│   │   │   └── CustomizeSheet.jsx
│   │   └── Profile/
│   │       └── ProfileScreen.jsx    (persona bars, prefs, account, T&C link)
│   └── components/
│       ├── PageTransition.jsx   (shared route/step transition wrapper)
│       ├── ChatBubble.jsx       (ChatBubble + TypingIndicator)
│       ├── ChatThread.jsx
│       └── TermsContent.jsx     (shared T&C body — onboarding + profile)
├── supabase/
│   └── functions/
│       ├── generate-replies/
│       │   ├── prompt.ts        (pure prompt building — no Deno/network, so it's probeable)
│       │   └── index.ts         (Gemini primary + Groq fallback, strict JSON)
│       ├── process-screenshot/
│       │   └── index.ts         (exists but UNUSED — screenshot/OCR dropped from UI)
│       └── update-weights/
│           └── index.ts
├── android/               (generated by Capacitor)
├── capacitor.config.ts
├── tailwind.config.js
├── vite.config.js
└── package.json
```

---

## Key conventions

- All screens are full-height mobile (max-width 430px, centered on desktop)
- No light mode — hardcode dark theme everywhere
- Use the hex values from the design system — do not use Tailwind's default colors
- Tailwind config must extend with RIZZING color tokens
- All API calls go through Supabase Edge Functions — never call Groq directly from the app
- Weights are floats between 0 and 1 — clamp when updating, never go below 0.1 or above 0.9
- Personality profile loads once at app start, stored in Zustand, updated locally then synced
- Match history is capped at last 10 turns when passed to the engine (not in DB, just in API call)
- The three reply cards are the primary interaction — not a text input field
- After picking a reply, fire update-weights in background — don't block the UI

---

## Deployment flow

This is a mobile-first React app. It runs three ways from one codebase:

1. Browser (development) — `npm run dev`, day-to-day building and testing.
2. Web on Vercel — the React build deployed to rizzing.matri6.com. This is the live web version and also the staging preview. Vercel auto-deploys on push to main.
3. Android via Capacitor (bundled mode) — the same React build is compiled into the APK. The web assets ship inside the APK, so the app works offline and does not depend on Vercel at runtime.

Capacitor must be configured for bundled mode: no `server.url` pointing at Vercel. The build output (dist) is copied into the native project by `cap sync`.

### Static assets — anything referenced by a runtime path MUST live in `public/`

`vite build` copies **only** `public/` into `dist/`. The dev server additionally serves the
project root, so a file sitting at the repo root resolves fine at `npm run dev` and then
404s in every deployed build — dev is not a check for this.

- `<img src="/1.jpg">` in JSX is an opaque runtime string. Vite never rewrites it, so the
  file must exist at `dist/1.jpg`, i.e. be committed at `public/1.jpg`.
- The same path in `index.html` **is** build-time input: Vite resolves and hashes it into
  `assets/`. That asymmetry is a trap — it means a misplaced image can leave the favicon
  working while every in-app `<img>` is broken, which looks like a CSS bug, not a path bug.
- On Netlify the SPA catch-all (`/*` → `/index.html`, 200) serves the HTML document for a
  missing image instead of a 404, so it fails silently with no console error.

If you add an image, put it in `public/` and confirm it appears in `dist/` after a build.

Build pipeline:
```
React (Vite)  →  dist/
                 ├──  Vercel (web: rizzing.matri6.com)
                 └──  Capacitor sync  →  Android Studio  →  APK
                                          ├── Firebase App Distribution (testing)
                                          └── Play Store (launch)
```

## Build commands

```bash
npm run dev          # browser development

npm run build        # production build → dist/  (this is what both Vercel and Capacitor use)

# Vercel: connect the repo, set build command "npm run build", output dir "dist",
# add the two VITE_ env vars in Vercel project settings, then set custom domain rizzing.matri6.com

# Android (run after npm run build):
npx cap sync android   # copies dist/ into the Android project
npx cap open android   # open in Android Studio → build APK

# Supabase Edge Functions
supabase functions serve                    # local dev
supabase functions deploy generate-replies  # deploy one
supabase functions deploy --all             # deploy all

npm run typecheck:functions   # tsc over the Edge Functions using supabase/functions/deno-shim.d.ts
```

`typecheck:functions` exists because there's no Deno toolchain on this machine — the shim
declares just enough of the Deno global for plain `tsc` to check the function bodies.
It covers `generate-replies` + `update-weights`; `process-screenshot` is deliberately
excluded (dropped from the UI, not maintained).

Capacitor plugins needed early: @capacitor/camera (screenshot input), @capacitor/preferences (light local cache). Add others only when a screen needs them.

### Android deep link (`android/` is scaffolded)
`npx cap add android` generates **only** the LAUNCHER intent-filter. The Supabase
redirect filter was added by hand to `android/app/src/main/AndroidManifest.xml`:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="${applicationId}" android:host="auth" />
</intent-filter>
```

`${applicationId}` is a Gradle placeholder resolving to `com.matri6.rizzing`, so the
scheme cannot drift from the bundle ID. `launchMode="singleTask"` (Capacitor's default)
makes the link reuse the running task.

**This is necessary but NOT sufficient.** The filter reopens the app; it does not route
the webview to `/auth/callback`, because the webview is served from `localhost` and never
sees the deep-link URL. Completing it needs `@capacitor/app` (a new dependency) plus an
`appUrlOpen` listener that forwards the URL fragment to `supabase.auth.setSession`.
Until then, set the APK's Supabase redirect to the **web** URL — verification finishes in
the browser and the user returns to the app to sign in. Regenerating `android/` wipes the
manifest edit; re-apply it after any `cap add android`.

---

## What to build first

1. Project scaffold (Vite + React + Tailwind configured with RIZZING tokens)
2. Auth screen (phone OTP via Supabase)
3. Onboarding flow (QuickPrefs → 7 Scenarios → writes personality_profiles row)
4. Home screen (matches list + add match)
5. Conversation screen (core feature — input → generate-replies → 3 cards → pick → update-weights)
6. Profile screen
7. Capacitor setup + APK build

Do not move to step N+1 until step N works end-to-end.