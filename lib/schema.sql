-- NeuroVerse database schema (PostgreSQL / NeonDB)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  age INT,
  profile_pic TEXT,
  languages TEXT[] DEFAULT '{}',
  bio TEXT,
  credits NUMERIC(10,2) NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS languages TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE users ALTER COLUMN credits TYPE NUMERIC(10,2) USING credits::NUMERIC(10,2);

-- category: 'programming' | 'language' | 'general'
-- test_type: 'code' | 'mcq' | 'mixed'
CREATE TABLE IF NOT EXISTS skills (
  id BIGSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  test_type TEXT NOT NULL DEFAULT 'mcq',
  difficulty_factor NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE skills ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';
ALTER TABLE skills ADD COLUMN IF NOT EXISTS test_type TEXT NOT NULL DEFAULT 'mcq';
ALTER TABLE skills ADD COLUMN IF NOT EXISTS difficulty_factor NUMERIC(4,2) NOT NULL DEFAULT 1.0;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE skills ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- type: 'known' | 'learning'
-- level: 'beginner' | 'intermediate' | 'advanced' | 'expert' (only for known skills after assessment)
CREATE TABLE IF NOT EXISTS user_skills (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id BIGINT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  level TEXT,
  assessment_score NUMERIC(5,2),
  desired_level TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, skill_id, type)
);

-- question_type: 'code' | 'mcq'
CREATE TABLE IF NOT EXISTS assessment_questions (
  id BIGSERIAL PRIMARY KEY,
  skill_id BIGINT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL,
  difficulty TEXT NOT NULL, -- beginner | intermediate | advanced | expert (target difficulty of the question)
  question_text TEXT NOT NULL,
  options JSONB, -- for mcq: ["a","b","c","d"]
  correct_answer TEXT NOT NULL,
  starter_code TEXT, -- for code questions
  points NUMERIC(5,2) NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessment_attempts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id BIGINT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL,
  classified_level TEXT NOT NULL,
  answers JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessment_runs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id BIGINT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  question_ids BIGINT[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  focus_loss_count INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS assessment_run_events (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES assessment_runs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS run_id BIGINT REFERENCES assessment_runs(id);
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS correct_count INT NOT NULL DEFAULT 0;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS wrong_count INT NOT NULL DEFAULT 0;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS unanswered_count INT NOT NULL DEFAULT 0;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS total_questions INT NOT NULL DEFAULT 0;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS focus_loss_count INT NOT NULL DEFAULT 0;
ALTER TABLE assessment_attempts ADD COLUMN IF NOT EXISTS question_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS courses (
  id BIGSERIAL PRIMARY KEY,
  mentor_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id BIGINT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  availability_text TEXT,
  publish_request_key TEXT,
  mentor_level TEXT NOT NULL, -- beginner | intermediate | advanced | expert (mentor's classified level in this skill)
  base_rate_credits NUMERIC(10,2) NOT NULL, -- credits per hour, pre mentor-expertise multiplier
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mentor_reputation (
  mentor_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  avg_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  total_reviews INT NOT NULL DEFAULT 0,
  expertise_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.0
);

-- status: 'pending' | 'accepted' | 'meeting_pending' | 'confirmed' | 'in_progress' | 'completed' | 'declined' | 'cancelled'
CREATE TABLE IF NOT EXISTS sessions (
  id BIGSERIAL PRIMARY KEY,
  learner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentor_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  hours NUMERIC(5,2) NOT NULL,
  scheduled_start TIMESTAMPTZ NOT NULL,
  price_per_hour NUMERIC(10,2) NOT NULL,
  base_credits NUMERIC(10,2) NOT NULL,
  platform_fee_credits NUMERIC(10,2) NOT NULL,
  total_charged_to_learner NUMERIC(10,2) NOT NULL,
  credited_to_mentor NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  meeting_link TEXT,
  skill_level TEXT NOT NULL DEFAULT 'intermediate',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  payment_reference TEXT,
  payment_attempt INT NOT NULL DEFAULT 0,
  request_key TEXT,
  zoom_meeting_id TEXT,
  zoom_creation_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS skill_level TEXT NOT NULL DEFAULT 'intermediate';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS payment_attempt INT NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS request_key TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS zoom_meeting_id TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS zoom_creation_started_at TIMESTAMPTZ;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS availability_text TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS publish_request_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_publish_request_key
  ON courses(mentor_id, publish_request_key) WHERE publish_request_key IS NOT NULL;

-- type: 'purchase' | 'spend' | 'earn' | 'refund' | 'signup_bonus' | 'platform_fee'
CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  credits NUMERIC(10,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_topups (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  order_id TEXT UNIQUE,
  payment_id TEXT UNIQUE,
  pack_index INT NOT NULL,
  credits NUMERIC(10,2) NOT NULL,
  amount_paise INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'creating',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS session_extensions (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  learner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  extra_minutes INT NOT NULL,
  base_credits NUMERIC(10,2) NOT NULL,
  platform_fee_credits NUMERIC(10,2) NOT NULL,
  charge_credits NUMERIC(10,2) NOT NULL,
  mentor_credits NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, idempotency_key)
);

ALTER TABLE session_extensions ADD COLUMN IF NOT EXISTS base_credits NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE session_extensions ADD COLUMN IF NOT EXISTS platform_fee_credits NUMERIC(10,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS reviews (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  learner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentor_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'info';

CREATE TABLE IF NOT EXISTS session_files (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  uploaded_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Daily login riddle game.
-- Each riddle is optionally tied to a skill so it can be matched against the
-- skills a learner already knows (user_skills.type = 'known'). Riddles with a
-- NULL skill_id are generic and used as a fallback when no skill-specific
-- riddle is available.
CREATE TABLE IF NOT EXISTS riddles (
  id BIGSERIAL PRIMARY KEY,
  skill_id BIGINT REFERENCES skills(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general', -- 'programming' | 'language' | 'general'
  difficulty TEXT NOT NULL DEFAULT 'beginner',
  question TEXT NOT NULL,
  answer TEXT NOT NULL, -- matched case-insensitively / trimmed
  hint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per riddle attempt. Used both to grade answers and to enforce the
-- "max 5 credits earned per day from riddles" rule (SUM(credits_awarded) for
-- attempt_date = today), and to avoid re-serving a riddle the user already
-- answered correctly.
CREATE TABLE IF NOT EXISTS riddle_attempts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  riddle_id BIGINT NOT NULL REFERENCES riddles(id) ON DELETE CASCADE,
  correct BOOLEAN NOT NULL DEFAULT false,
  credits_awarded NUMERIC(5,2) NOT NULL DEFAULT 0,
  attempt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_skill ON user_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_sessions_learner ON sessions(learner_id);
CREATE INDEX IF NOT EXISTS idx_sessions_mentor ON sessions(mentor_id);
CREATE INDEX IF NOT EXISTS idx_assessment_runs_user_skill ON assessment_runs(user_id, skill_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_assessment_run_events_run ON assessment_run_events(run_id, occurred_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_attempts_run ON assessment_attempts(run_id) WHERE run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_courses_skill ON courses(skill_id);
CREATE INDEX IF NOT EXISTS idx_riddles_skill ON riddles(skill_id);
CREATE INDEX IF NOT EXISTS idx_riddle_attempts_user_date ON riddle_attempts(user_id, attempt_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assessment_questions_skill_text
  ON assessment_questions(skill_id, question_text);
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_spend_transaction
  ON transactions(description) WHERE type = 'spend' AND description LIKE 'session:%:spend';
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_request_key
  ON sessions(learner_id, request_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_earn_transaction
  ON transactions(description) WHERE type = 'earn' AND description LIKE 'session:%:earn';
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_refund_transaction
  ON transactions(description) WHERE type = 'refund' AND description LIKE 'session:%:refund';
CREATE UNIQUE INDEX IF NOT EXISTS idx_riddles_skill_question
  ON riddles((COALESCE(skill_id, 0)), question);
