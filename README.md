# NeuroVerse — Peer-to-Peer Learning Platform

A full-stack scaffold implementing:
- **Redesigned UI**: dark hero welcome banner, pastel stat chips, bold flat "Continue Learning" cards, and a CSS-only progress donut — see "Design system" below for the full palette and where it lives in the code.
- **Conversational AI mentor assistant**: a floating chat that asks one relevant question at a time, remembers account-linked goals and preferences, recommends real mentor courses, and hands a selected course into the normal booking flow.
- Signup/login with 50 starting credits, stored in **NeonDB** (Postgres)
- **Profile picture + bio** at signup (editable later from the Profile page)
- **Daily login riddle game** — an optional riddle tied to a skill the learner already knows; a correct answer earns 1 credit, capped at 5 credits/day (see "Daily riddle game" section below)
- Skill selection (known / learning) with dropdown + manual "not listed" entry
- Skill assessment with beginner/intermediate/advanced classification (code-based tests for programming skills, MCQ for languages/general skills)
- Credit-based session pricing: `base rate × skill-level factor (0.5/1/1.5) × skill-difficulty factor × mentor-expertise factor`, +10% platform fee on the learner and a 10% cut from the mentor's payout
- Mentor matching with a suitability % and an auto-generated learning path
- Session requests with learner-selected skill level, mentor approval, learner schedule confirmation, wallet-credit deduction, and scheduled Zoom meetings
- Razorpay wallet top-ups with captured-payment verification and duplicate protection; the existing Stripe wallet checkout remains available
- Wallet-funded session extensions with Zoom duration updates and compensating credit refunds when the provider definitively rejects an operation
- Live session room: file sharing (notes/PPT/video), in-session chat, and a Gemini-powered study assistant chatbot
- Post-session ratings/feedback that update mentor reputation (and therefore future pricing)
- Dashboard with performance stats and upskilling recommendations

> ⚠️ This is a working MVP scaffold, not a production system. Payment and Zoom credentials, pricing, provider reconciliation, and code-test grading still require production review.

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

The assistant collects the learner's subject, goal, current level, teaching preferences, schedule/frequency, and optional budget in separate turns. It stores conversation messages and per-skill preferences under the authenticated account. Booking remains a deliberate learner action: selecting a recommendation submits a request through `/api/sessions/book`; the mentor must accept, then the learner confirms a schedule to spend wallet credits.

**Where it lives:**
- `lib/agent-conversation.js` — deterministic slot collection and next-question selection, with a one-question-at-a-time flow and skip handling.
- `lib/agent.js` — loads and persists account-owned chat history, updates per-skill learner preferences, optionally extracts natural-language details with Gemini, and queries the real mentor catalog.
- `lib/mentorSearch.js` — shared mentor ranking using actual skills, course/profile text, ratings, credit pricing, and recorded future bookings.
- `lib/assistant-schema.sql` — additive tables for conversations, messages, and saved per-skill learner preferences; applied by `npm run db:init`.
- `pages/api/agent/chat.js` — the API route the widget talks to.
- `components/AIAssistant.js` — the floating widget, persisted chat resume/new-chat controls, recommendation cards with match evidence, and selected-course booking form.

**How a request flows through it:**
1. The assistant asks for the missing learning details one at a time and retains prior answers in the database.
2. Gemini (`gemini-3.8-flash`) can extract details expressed naturally; deterministic slot parsing remains available when Gemini is not configured.
3. After enough details are collected, the server saves preferences per skill and ranks active, non-demo courses using the shared matching code.
4. The assistant shows up to three database-backed recommendations with their actual descriptions, rating/review counts, estimated credit prices, and match reasons.
5. The learner selects a course and submits a request through `/api/sessions/book`. Mentor acceptance and learner schedule/payment confirmation remain separate lifecycle steps.

**Honest limitation:** mentor profiles do not have structured recurring calendar slots or verified employment-experience fields. Recommendations can show actual bios, course descriptions, ratings, prices, and recorded future booking counts, but exact availability must be confirmed by the mentor. INR budget preferences are saved, but are not compared against credit prices because no currency conversion is configured.

**Conversation storage is not model fine-tuning.** The supplied examples guide the runtime question flow and extraction prompt; user messages and preferences are stored in the app database for that account only. They are not used to train or fine-tune Gemini.

**Requires:** run `npm run db:init` to apply `lib/assistant-schema.sql`. `GEMINI_API_KEY` enables more flexible slot extraction; deterministic extraction works without it.

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
RAZORPAY_KEY_ID=rzp_test_your-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
RAZORPAY_CONFIG_ID=your-upi-netbanking-checkout-config-id
RAZORPAY_CREDIT_PACK_PRICES_INR=99,199,449,999
ZOOM_ACCOUNT_ID=your-zoom-account-id
ZOOM_CLIENT_ID=your-zoom-client-id
ZOOM_CLIENT_SECRET=your-zoom-client-secret
ZOOM_USER_ID=me
```

Set `RAZORPAY_CREDIT_PACK_PRICES_INR` to four business-approved INR prices, in the same order as `CREDIT_PACKS` in `lib/pricing.js`; the example values are placeholders. The app does not infer an INR exchange rate from existing Stripe USD prices. Configure the Razorpay Dashboard checkout configuration to allow UPI and netbanking and enable automatic capture, then use matching test or live keys. Stripe remains an optional wallet top-up method.

Configure a Zoom Server-to-Server OAuth app with meeting creation and update permissions. `ZOOM_USER_ID` can be `me` or the account's host user ID. NeuroVerse stores and shares only the participant `join_url`, never Zoom's host `start_url`.

### Step 5: Initialize the database (applies additive schema changes + seed skills/questions)
```bash
npm run db:init
```
You should see `Database initialized successfully.` This runs `lib/schema.sql`, `lib/assistant-schema.sql`, then `lib/seed.sql` against your NeonDB. These schemas add wallet top-up and extension ledgers, session payment/Zoom fields, and account-linked assistant data without dropping existing records.

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
- Session price per hour = `base_rate (20 credits/hr default) × learner-selected level factor × skill_difficulty_factor × mentor_expertise_factor`
  - The learner selects beginner, intermediate, advanced, or expert. Configure the factors with `SESSION_LEVEL_FACTOR_BEGINNER`, `SESSION_LEVEL_FACTOR_INTERMEDIATE`, `SESSION_LEVEL_FACTOR_ADVANCED`, and `SESSION_LEVEL_FACTOR_EXPERT` (defaults: 0.5×, 1×, 1.5×, 2×).
  - `skill_difficulty_factor`: per-skill weight in the `skills` table (e.g. Python 1.5×, English 1.0×) — tune these anytime
  - `mentor_expertise_factor`: derived from mentor rating — <2★ → 0.5×, 2–3.49★ → 1.0×, 3.5–4.49★ → 1.2×, ≥4.5★ → 1.5× (new mentors with 0 reviews get a neutral 1.0×)
- Mentor acceptance does not charge credits. When the learner confirms the schedule, the server locks the session and wallet, verifies the balance, and deducts credits exactly once. The mentor receives `base cost − 10% platform fee` after Zoom meeting creation succeeds.
- Learners buy credits through Razorpay in INR. The server verifies the checkout signature and confirms captured status, amount, currency, order, and UPI/netbanking method before adding credits. Repeated verification cannot credit the same order twice.
- Session extensions are charged proportionally from wallet credits and update the Zoom meeting duration. A definitive Zoom rejection is compensated in the ledger. A timeout with an unknown provider outcome remains processing for reconciliation; do not retry blindly.
- If a learner runs out of credits, they can buy more from the Wallet page (`lib/pricing.js` → `CREDIT_PACKS`, currently a placeholder $/credit ratio you can tune after evaluating usage).
- All the thresholds/multipliers above live in `lib/pricing.js` and `lib/classification.js` — change the constants there to retune the whole system in one place.

## Profile picture & bio

- Added to the **Sign up** form: pick an image (client-side resized to a small JPEG and stored as a `profile_pic` data URL on the `users` row — no separate file-storage bucket needed) and an optional 280-char bio.
- Both are editable later from **Profile → Edit profile** (`pages/api/user/profile.js`, `PATCH`).
- The avatar renders in the Topbar, Sidebar link, and Profile page automatically; users without one still get the original colored-initial placeholder.

## How skill assessment classification works

- Assessments run one question at a time in browser fullscreen. Tab visibility changes are recorded in the assessment run; normal browser controls are not blocked.
- Each run snapshots its 20 questions. Results persist correct, wrong, unanswered counts, score, classified level, focus-change count, submitted answers, and question/answer snapshots in `assessment_attempts`.
- Score ≥ 90% → **expert**, 70–89% → **advanced**, 50–69% → **intermediate**, 20–49% → **beginner**, and below 20% → **not assessed** (`lib/classification.js`, `LEVEL_THRESHOLDS`).
- The dashboard shows recent assessment history and links each result to mentor matching at the assessed level.
- Programming skills (Python, JavaScript, etc.) get **code-based** questions; languages and general skills get **multiple-choice** questions, driven by each skill's `test_type` column.
- Question generation uses a per-skill database lock and additive unique inserts. It does not delete existing question records, and mixed-type prompts are checked for duplicate text before storage.
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

- `lib/matching.js` scores each candidate mentor 0–100% based on skill match, assessed target level (including Expert), language overlap, rating, and mentor-provided availability where listed.
- Mentors can add optional availability text to a course in Teach. When none is listed, the UI says so rather than inventing a schedule.
- Course publishing requires a completed assessment for the selected skill. Publication uses a per-mentor idempotency key, and Explore, My Learning, course details, and mentor matching read active course rows from PostgreSQL. Course withdrawal is a soft deactivation; the existing course row is retained.
- A learning path is generated from beginner through the selected target level.

---

## What to harden before production

- **Code grading**: `lib/classification.js` currently uses a lightweight keyword-overlap heuristic for code answers. Swap in a real sandboxed execution service (e.g. Judge0 or the Piston API) with actual test cases for trustworthy grading.
- **Provider reconciliation**: a timeout after a Zoom create/update request can have an unknown provider outcome. Those operations remain marked processing to prevent duplicate meetings or extensions; reconcile them with Zoom before proceeding.
- **File storage**: uploads currently save to local disk (`public/uploads`). Move to S3/Cloud Storage for a deployed environment.
- **Payments**: set business-approved INR credit-pack prices, configure Razorpay's UPI/netbanking restriction, use provider test keys, and establish live-payment monitoring and refund procedures. Stripe wallet checkout remains optional.
- **Auth**: passwords are hashed with bcrypt and sessions use httpOnly JWT cookies — fine for an MVP, but add rate limiting, email verification, and password reset flows for production.
