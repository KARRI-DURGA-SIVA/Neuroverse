-- NeuroVerse database schema (PostgreSQL / NeonDB)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- category: 'programming' | 'language' | 'general'
-- test_type: 'code' | 'mcq' | 'mixed'
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  test_type TEXT NOT NULL DEFAULT 'mcq',
  difficulty_factor NUMERIC(4,2) NOT NULL DEFAULT 1.0,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- type: 'known' | 'learning'
-- level: 'beginner' | 'intermediate' | 'advanced' (only for known skills after assessment)
CREATE TABLE IF NOT EXISTS user_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  level TEXT,
  assessment_score NUMERIC(5,2),
  desired_level TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, skill_id, type)
);

-- question_type: 'code' | 'mcq'
CREATE TABLE IF NOT EXISTS assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL,
  classified_level TEXT NOT NULL,
  answers JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  mentor_level TEXT NOT NULL, -- beginner | intermediate | advanced (mentor's classified level in this skill)
  base_rate_credits NUMERIC(10,2) NOT NULL, -- credits per hour, pre mentor-expertise multiplier
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mentor_reputation (
  mentor_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  avg_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  total_reviews INT NOT NULL DEFAULT 0,
  expertise_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.0
);

-- status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  hours NUMERIC(5,2) NOT NULL,
  scheduled_start TIMESTAMPTZ NOT NULL,
  price_per_hour NUMERIC(10,2) NOT NULL,
  base_credits NUMERIC(10,2) NOT NULL,
  platform_fee_credits NUMERIC(10,2) NOT NULL,
  total_charged_to_learner NUMERIC(10,2) NOT NULL,
  credited_to_mentor NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  meeting_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- type: 'purchase' | 'spend' | 'earn' | 'refund' | 'signup_bonus' | 'platform_fee'
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  credits NUMERIC(10,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS session_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Daily login riddle game.
-- Each riddle is optionally tied to a skill so it can be matched against the
-- skills a learner already knows (user_skills.type = 'known'). Riddles with a
-- NULL skill_id are generic and used as a fallback when no skill-specific
-- riddle is available.
CREATE TABLE IF NOT EXISTS riddles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  riddle_id UUID NOT NULL REFERENCES riddles(id) ON DELETE CASCADE,
  correct BOOLEAN NOT NULL DEFAULT false,
  credits_awarded NUMERIC(5,2) NOT NULL DEFAULT 0,
  attempt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_skill ON user_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_sessions_learner ON sessions(learner_id);
CREATE INDEX IF NOT EXISTS idx_sessions_mentor ON sessions(mentor_id);
CREATE INDEX IF NOT EXISTS idx_courses_skill ON courses(skill_id);
CREATE INDEX IF NOT EXISTS idx_riddles_skill ON riddles(skill_id);
CREATE INDEX IF NOT EXISTS idx_riddle_attempts_user_date ON riddle_attempts(user_id, attempt_date);
