# NeuroVerse — Peer-to-Peer Learning Platform

A full-stack scaffold implementing:
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
- Clean, white, Coursera/LinkedIn-Learning-style UI (sidebar + topbar + card layout)

> ⚠️ This is a working MVP scaffold, not a production system. Video calls use free Jitsi Meet links (no API key needed) rather than a dedicated video SDK, and code-test grading uses a lightweight heuristic rather than real code execution — see the "What to harden before production" section at the bottom.

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
