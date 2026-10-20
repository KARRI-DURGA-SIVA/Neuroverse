CREATE TABLE IF NOT EXISTS assistant_conversations (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assistant_messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES assistant_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learner_learning_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id BIGINT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  learning_goal TEXT,
  skill_level TEXT CHECK (skill_level IS NULL OR skill_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
  teaching_style TEXT,
  availability_preference TEXT,
  sessions_per_week INT CHECK (sessions_per_week IS NULL OR sessions_per_week BETWEEN 1 AND 7),
  budget_preference TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, skill_id)
);

ALTER TABLE learner_learning_profiles DROP CONSTRAINT IF EXISTS learner_learning_profiles_skill_level_check;
ALTER TABLE learner_learning_profiles ADD CONSTRAINT learner_learning_profiles_skill_level_check
  CHECK (skill_level IS NULL OR skill_level IN ('beginner', 'intermediate', 'advanced', 'expert'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_assistant_one_active_conversation
  ON assistant_conversations(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_assistant_messages_conversation
  ON assistant_messages(conversation_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_learner_learning_profiles_user
  ON learner_learning_profiles(user_id, updated_at DESC);