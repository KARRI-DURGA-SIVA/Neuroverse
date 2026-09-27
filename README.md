# NeuroVerse — Peer-to-Peer Learning Platform

A full-stack scaffold implementing:
- **Redesigned UI**: dark hero welcome banner, pastel stat chips, bold flat "Continue Learning" cards, and a CSS-only progress donut — see "Design system" below for the full palette and where it lives in the code.
- **Agentic AI assistant**: a floating chatbot (bottom-right, on every page) that parses a natural-language request like *"I want to learn Python from beginner level, find someone available this weekend"*, checks your profile and credits, ranks real mentors, and proposes a bookable session — see "Agentic AI layer" below.
- Signup/login with 50 starting credits, stored in **NeonDB** (Postgres)
- **Profile picture + bio** at signup (editable later from the Profile page)
- **Daily login riddle game** — an optional riddle tied to a skill the learner already knows; a correct answer earns 1 credit, capped at 5 credits/day (see "Daily riddle game" section below)
- Skill selection (known / learning) with dropdown + manual "not listed" entry
- Skill assessment with beginner/intermediate/advanced classification (code-based tests for programming skills, MCQ for languages/general skills)
- Credit-based session pricing: `base rate × skill-level factor (0.5/1/1.5) × skill-difficulty factor × mentor-expertise factor`, +10% platform fee on the learner and a 10% cut from the mentor's payout
- Mentor matching with a suitability % and an auto-generated learning path
- Session booking with credit deduction, notifications, and an auto-generated video meeting link
- Live session room: file sharing (notes/PPT/video), in-session chat, and a Gemini-powered study assistant chatbot
- Post-session ratings/feedback that update mentor reputation (and therefore future pricing)
- Dashboard with performance stats and upskilling recommendations

> ⚠️ This is a working MVP scaffold, not a production system. Video calls use free Jitsi Meet links (no API key needed) rather than a dedicated video SDK, and code-test grading uses a lightweight heuristic rather than real code execution — see the "What to harden before production" section at the bottom.

---

## Design system

The new look is driven entirely by design tokens, so it applies platform-wide without every page needing edits:

| Token | Where | Values |
|---|---|---|
| `accent-*` | `tailwind.config.js` | Primary indigo/violet (`#6C5CE7`), used for buttons, links, active nav |
| `mint` / `peach` / `violet` / `pink` | `tailwind.config.js` | Pastel `{bg, fg}` pairs for the dashboard stat chips |
| `course-blue` / `course-orange` / `course-dark` / `course-lime` | `tailwind.config.js` | Bold flat colors cycled across "Continue Learning" cards |
| `surface-900` | `tailwind.config.js` | Near-black with a violet tint, used for the dashboard hero banner |
| `.hero-dark`, `.stat-chip-icon`, `.course-card`, `.donut`, `.agent-*` | `styles/globals.css` | Reusable utility classes built on the tokens above |

**Where it shows up right now:** `components/Sidebar.js` (solid active-pill nav), `components/Topbar.js` (pill search bar, mint credits chip), and `pages/dashboard.js` (hero banner, 4 stat chips, flat course cards, CSS donut "Learning Mix" widget). Every other page automatically picked up the new accent color and card styling because they use the same `.card` / `.btn-primary` / `.badge` classes — if you want the hero-banner/stat-chip treatment on another page (e.g. Teach or Mentoring), copy the pattern from `pages/dashboard.js`.

**Important Tailwind gotcha to know about if you extend this:** class names built with string interpolation (e.g. `` `bg-${chip}-bg` ``) are invisible to Tailwind's static scanner and silently produce no styling. `pages/dashboard.js` works around this with a `CHIP_CLASSES` lookup object of fully-spelled-out class strings — follow that pattern for any new dynamic color.

To swap the palette for the one you actually want (you mentioned sending colors separately): edit the hex values in `tailwind.config.js` under `colors.accent`, `colors.mint/peach/violet/pink`, and `colors.course` — nothing else needs to change, since every component reads from those tokens.

---

## Agentic AI layer

This is a genuine agent loop (perceive → plan → call tools → observe → respond), not just a chatbot, with one deliberate safety rule: **the agent can look things up freely, but it never spends your credits itself.** Booking only happens when you click "Confirm booking" in the widget, which calls the same `/api/sessions/book` endpoint (and all its transaction safety) that the rest of the app already uses.

**Where it lives:**
- `lib/agent.js` — the orchestrator. `runAgentTurn()` implements the tool sequence: `get_profile` → `find_matches` → `check_availability` → `check_credits` → `recommend_learning_path`, then returns a proposal instead of booking.
- `lib/mentorSearch.js` — mentor ranking logic factored out of `pages/api/mentors/match.js` so both the UI's search page and the agent call the exact same code path (no duplicated/drifting logic).
- `pages/api/agent/chat.js` — the API route the widget talks to.
- `components/AIAssistant.js` — the floating widget (bottom-right on every page), including the inline booking-proposal card with its own hours/date picker.

**How a request flows through it:**
1. You type something like *"I want to learn Python from beginner level, find someone available this weekend."*
2. Gemini (`gemini-3.8-flash`, structured JSON output) parses that into `{ skillName, level, timeframe }` — this is the "perceive" step.
3. The server deterministically runs the tool sequence in `lib/agent.js`: pulls your profile and languages, resolves "Python" against the skills table, ranks real mentors with the existing suitability algorithm, checks your credit balance, and builds a learning path.
4. It replies with a natural-language summary **and** a structured proposal, which the widget renders as a card with a suitability %, price, and an hours/date picker.
5. You confirm → the widget calls `/api/sessions/book` directly (bypassing the agent entirely for the money-moving step) → you land in the session room.

**Honest limitation, stated on purpose:** NeuroVerse doesn't yet store structured mentor calendar slots (see `lib/matching.js` — availability is a best-effort free-text signal). Rather than fake a calendar check, `describeAvailability()` in `lib/agent.js` says so plainly and defers the actual time to the booking step, where the learner picks a slot and the mentor sees it as a request. If you add structured availability later, that's the one function to upgrade.

**Requires:** `GEMINI_API_KEY` in `.env.local` (same variable the in-session study assistant already uses). Without it, the widget still opens but replies with a clear "not configured" message instead of failing silently.

---

## Project structure

```
neuroverse/
├── pages/                # Next.js pages (UI) + pages/api (backend routes)
├── components/           # Sidebar, Topbar, Layout
├── lib/                  # db.js, schema.sql, seed.sql, pricing.js, classification.js, matching.js, auth.js
├── styles/                globals.css (Tailwind)
├── colab/                 NeuroVerse_Colab_Demo.ipynb
├── public/uploads/       # session file uploads land here
├── .env.example
└── package.json
```

---

## Part 1 — Run in VSCode (the real app)

### Step 1: Install prerequisites
- Node.js 18+ (https://nodejs.org)
- A free NeonDB account (https://neon.tech) — click "Create a project", copy the connection string
- (Optional but needed for the in-session chatbot) A Gemini API key from https://aistudio.google.com/app/apikey

### Step 2: Open the project
```bash
cd neuroverse
code .
```

### Step 3: Install dependencies
```bash
npm install
```

### Step 4: Configure environment variables
```bash
cp .env.example .env.local
```
Open `.env.local` and fill in:
```
DATABASE_URL=postgresql://user:password@ep-xxxx.neon.tech/neuroverse?sslmode=require
JWT_SECRET=some-long-random-string
GEMINI_API_KEY=your-gemini-key
```

### Step 5: Initialize the database (creates all tables + seed skills/questions)
```bash
npm run db:init
```
You should see `Database initialized successfully.` This runs `lib/schema.sql` then `lib/seed.sql` against your NeonDB.

### Step 6: Run the app
```bash
npm run dev
```
Open http://localhost:3000 — you'll be redirected to Sign Up. Create an account (you'll get 50 credits automatically), complete onboarding, and explore.

### Step 7 (optional): Production build
```bash
npm run build
npm start
```

---

## Part 2 — Run the companion notebook in Google Colab

Colab can't host the Next.js UI (no persistent public server, no browser routing), so the Colab notebook instead runs a **standalone FastAPI backend** implementing the same pricing/classification/matching logic, connected to the **same NeonDB** database, and exposes it publicly via `ngrok`. Use it to test the algorithms, integrate with other Python tooling, or demo the logic without the UI.

1. Open `colab/NeuroVerse_Colab_Demo.ipynb` in Google Colab (File → Upload notebook, or open directly from GitHub if you push this repo).
2. Run the cells top to bottom.
3. When prompted, paste:
   - The same `DATABASE_URL` from your `.env.local`
   - An ngrok authtoken from https://dashboard.ngrok.com/get-started/your-authtoken (free account)
4. The last cell prints a public URL — visit `<url>/skills`, `<url>/mentors/<skill_id>`, or POST to `<url>/price` / `<url>/classify` to test the logic live.

---

## How the credit/pricing system works

- New accounts start with **50 credits**.
- Session price per hour = `base_rate (20 credits/hr default) × skill_level_factor × skill_difficulty_factor × mentor_expertise_factor`
  - `skill_level_factor`: beginner 0.5×, intermediate 1×, advanced 1.5× (based on the mentor's assessed level)
  - `skill_difficulty_factor`: per-skill weight in the `skills` table (e.g. Python 1.5×, English 1.0×) — tune these anytime
  - `mentor_expertise_factor`: derived from mentor rating — <2★ → 0.5×, 2–3.49★ → 1.0×, 3.5–4.49★ → 1.2×, ≥4.5★ → 1.5× (new mentors with 0 reviews get a neutral 1.0×)
- On booking: the learner is charged `base cost + 10% platform fee`; the mentor receives `base cost − 10% platform fee`.
- If a learner runs out of credits, they can buy more from the Wallet page (`lib/pricing.js` → `CREDIT_PACKS`, currently a placeholder $/credit ratio you can tune after evaluating usage).
- All the thresholds/multipliers above live in `lib/pricing.js` and `lib/classification.js` — change the constants there to retune the whole system in one place.

## Profile picture & bio

- Added to the **Sign up** form: pick an image (client-side resized to a small JPEG and stored as a `profile_pic` data URL on the `users` row — no separate file-storage bucket needed) and an optional 280-char bio.
- Both are editable later from **Profile → Edit profile** (`pages/api/user/profile.js`, `PATCH`).
- The avatar renders in the Topbar, Sidebar link, and Profile page automatically; users without one still get the original colored-initial placeholder.

## How skill assessment classification works

- Score ≥ 80% → **advanced**, 50–79% → **intermediate**, <50% → **beginner** (`lib/classification.js`, `LEVEL_THRESHOLDS`).
- Programming skills (Python, JavaScript, etc.) get **code-based** questions; languages and general skills get **multiple-choice** questions, driven by each skill's `test_type` column.
- Add more questions any time by inserting into `assessment_questions` (see `lib/seed.sql` for the format), or extend the onboarding UI to let mentors submit their own questions.

## Daily riddle game

- Shown as an optional card at the top of the **Dashboard** every time it loads (i.e. effectively "on login", since Dashboard is where you land after signing in).
- The riddle is chosen from the `riddles` table, preferring one tied to a skill the user has marked as **known** (`user_skills.type = 'known'`); if none match, it falls back to a generic riddle.
- Answering correctly awards **1 credit** (`lib/riddles.js` → `CREDITS_PER_CORRECT_ANSWER`).
- No matter how many times a user logs in/plays, they can earn at most **5 credits per calendar day** from riddles (`MAX_DAILY_RIDDLE_CREDITS`), enforced server-side by summing `riddle_attempts.credits_awarded` for today before crediting the account. Once the cap is hit, the widget hides itself.
- Playing is always optional — there's a "Skip" button, and skipping never affects credits.
- Add more riddles any time by inserting into the `riddles` table (see `lib/seed.sql` for the format) — tie a riddle to a skill via `skill_id`, or leave it `NULL` for a generic fallback riddle.
- Code: `lib/riddles.js` (shared logic), `pages/api/riddle/today.js` (GET next riddle), `pages/api/riddle/answer.js` (POST grade + award credit), `components/RiddleWidget.js` (UI).

## Mentor matching

- `lib/matching.js` scores each candidate mentor 0–100% based on skill match, level fit, language overlap, rating, and availability, and returns human-readable reasons for the match.
- A simple linear learning path (beginner → intermediate → advanced stages) is generated per skill/target level.

---

## What to harden before production

- **Code grading**: `lib/classification.js` currently uses a lightweight keyword-overlap heuristic for code answers. Swap in a real sandboxed execution service (e.g. Judge0 or the Piston API) with actual test cases for trustworthy grading.
- **Video calls**: sessions get a free Jitsi Meet link (`https://meet.jit.si/...`). For branded/recorded calls, integrate a provider like Daily.co, Twilio Video, or Zoom's SDK.
- **File storage**: uploads currently save to local disk (`public/uploads`). Move to S3/Cloud Storage for a deployed environment.
- **Payments**: `Wallet → Buy credits` simulates a successful purchase. Wire it to Stripe (or similar) before charging real money.
- **Auth**: passwords are hashed with bcrypt and sessions use httpOnly JWT cookies — fine for an MVP, but add rate limiting, email verification, and password reset flows for production.
