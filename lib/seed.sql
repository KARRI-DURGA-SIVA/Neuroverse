-- Seed: default skills
INSERT INTO skills (name, category, test_type, difficulty_factor) VALUES
  ('Python', 'programming', 'code', 1.5),
  ('JavaScript', 'programming', 'code', 1.4),
  ('Java', 'programming', 'code', 1.5),
  ('SQL', 'programming', 'code', 1.2),
  ('English', 'language', 'mcq', 1.0),
  ('Spanish', 'language', 'mcq', 1.0),
  ('French', 'language', 'mcq', 1.0),
  ('Public Speaking', 'general', 'mcq', 1.1),
  ('Digital Marketing', 'general', 'mcq', 1.1),
  ('Data Analysis', 'programming', 'mixed', 1.4),
  ('Guitar', 'general', 'mcq', 1.1),
  ('Graphic Design', 'general', 'mcq', 1.2)
ON CONFLICT (name) DO NOTHING;

-- Sample assessment questions for Python (code-based)
INSERT INTO assessment_questions (skill_id, question_type, difficulty, question_text, options, correct_answer, starter_code, points)
SELECT id, 'code', 'beginner', 'Write a function that returns the sum of two numbers a and b.', NULL, 'return a + b', 'def add(a, b):\n    # your code here\n    pass', 10
FROM skills WHERE name = 'Python'
ON CONFLICT DO NOTHING;

INSERT INTO assessment_questions (skill_id, question_type, difficulty, question_text, options, correct_answer, starter_code, points)
SELECT id, 'code', 'intermediate', 'Write a function that returns True if a string is a palindrome, ignoring case.', NULL, 's.lower() == s.lower()[::-1]', 'def is_palindrome(s):\n    # your code here\n    pass', 15
FROM skills WHERE name = 'Python'
ON CONFLICT DO NOTHING;

INSERT INTO assessment_questions (skill_id, question_type, difficulty, question_text, options, correct_answer, starter_code, points)
SELECT id, 'code', 'advanced', 'Write a function that returns the nth Fibonacci number using memoization.', NULL, 'memoized fibonacci implementation', 'def fib(n, memo={}):\n    # your code here\n    pass', 20
FROM skills WHERE name = 'Python'
ON CONFLICT DO NOTHING;

-- Sample assessment questions for English (mcq)
INSERT INTO assessment_questions (skill_id, question_type, difficulty, question_text, options, correct_answer, points)
SELECT id, 'mcq', 'beginner', 'Choose the correct sentence:', '["She go to school.", "She goes to school.", "She going to school.", "She gone to school."]', 'She goes to school.', 10
FROM skills WHERE name = 'English'
ON CONFLICT DO NOTHING;

INSERT INTO assessment_questions (skill_id, question_type, difficulty, question_text, options, correct_answer, points)
SELECT id, 'mcq', 'intermediate', 'Identify the correct use of the past perfect tense:', '["I have eaten breakfast.", "I had eaten breakfast before I left.", "I eat breakfast.", "I am eating breakfast."]', 'I had eaten breakfast before I left.', 15
FROM skills WHERE name = 'English'
ON CONFLICT DO NOTHING;

INSERT INTO assessment_questions (skill_id, question_type, difficulty, question_text, options, correct_answer, points)
SELECT id, 'mcq', 'advanced', 'Choose the sentence with correct subjunctive mood:', '["If I was rich, I would travel.", "If I were rich, I would travel.", "If I am rich, I would travel.", "If I will be rich, I would travel."]', 'If I were rich, I would travel.', 20
FROM skills WHERE name = 'English'
ON CONFLICT DO NOTHING;

-- ============================================================
-- Daily login riddles, matched to skills where possible.
-- These power the optional "Skill Riddle" login game
-- (see lib/riddles.js / pages/api/riddle/*).
-- ============================================================

-- Python
INSERT INTO riddles (skill_id, category, difficulty, question, answer, hint)
SELECT id, 'programming', 'beginner', 'I start counting from zero, not from one. In a Python list, what number is my very first index?', '0', 'Think about how list indexing begins in Python.'
FROM skills WHERE name = 'Python' ON CONFLICT DO NOTHING;

INSERT INTO riddles (skill_id, category, difficulty, question, answer, hint)
SELECT id, 'programming', 'beginner', 'I am a Python keyword used to create a function. What am I?', 'def', 'It comes right before the function name.'
FROM skills WHERE name = 'Python' ON CONFLICT DO NOTHING;

INSERT INTO riddles (skill_id, category, difficulty, question, answer, hint)
SELECT id, 'programming', 'intermediate', 'I am an immutable ordered sequence in Python, written with round brackets instead of square ones. What data type am I?', 'tuple', 'Lists use [ ], I use ( ).'
FROM skills WHERE name = 'Python' ON CONFLICT DO NOTHING;

-- JavaScript
INSERT INTO riddles (skill_id, category, difficulty, question, answer, hint)
SELECT id, 'programming', 'beginner', 'I am the JavaScript keyword for declaring a variable that can never be reassigned. What am I?', 'const', 'The opposite of "let" when it comes to reassignment.'
FROM skills WHERE name = 'JavaScript' ON CONFLICT DO NOTHING;

INSERT INTO riddles (skill_id, category, difficulty, question, answer, hint)
SELECT id, 'programming', 'intermediate', 'In JavaScript, what special value does a function return by default if it has no return statement?', 'undefined', 'It is also the type of a variable that has been declared but not assigned.'
FROM skills WHERE name = 'JavaScript' ON CONFLICT DO NOTHING;

INSERT INTO riddles (skill_id, category, difficulty, question, answer, hint)
SELECT id, 'programming', 'beginner', 'I am the array method that adds one or more elements to the end of an array. What am I?', 'push', 'The opposite of "pop".'
FROM skills WHERE name = 'JavaScript' ON CONFLICT DO NOTHING;

-- Java
INSERT INTO riddles (skill_id, category, difficulty, question, answer, hint)
SELECT id, 'programming', 'beginner', 'Every Java program needs a method with this exact name as its entry point. What is it called?', 'main', 'public static void ___(String[] args)'
FROM skills WHERE name = 'Java' ON CONFLICT DO NOTHING;

INSERT INTO riddles (skill_id, category, difficulty, question, answer, hint)
SELECT id, 'programming', 'intermediate', 'I am the Java keyword used to make a class unable to be extended by any other class. What am I?', 'final', 'The same word also stops a variable from being reassigned.'
FROM skills WHERE name = 'Java' ON CONFLICT DO NOTHING;

-- SQL
INSERT INTO riddles (skill_id, category, difficulty, question, answer, hint)
SELECT id, 'programming', 'beginner', 'I am the SQL keyword that removes duplicate rows from a result set. What am I?', 'DISTINCT', 'It goes right after SELECT.'
FROM skills WHERE name = 'SQL' ON CONFLICT DO NOTHING;

INSERT INTO riddles (skill_id, category, difficulty, question, answer, hint)
SELECT id, 'programming', 'intermediate', 'I am the SQL clause used to filter groups of rows after a GROUP BY. What am I?', 'HAVING', 'WHERE filters rows before grouping, I filter after.'
FROM skills WHERE name = 'SQL' ON CONFLICT DO NOTHING;

-- Data Analysis
INSERT INTO riddles (skill_id, category, difficulty, question, answer, hint)
SELECT id, 'programming', 'beginner', 'I am the statistical measure you get by adding up all values and dividing by how many there are. What am I?', 'mean', 'Not the median, not the mode.'
FROM skills WHERE name = 'Data Analysis' ON CONFLICT DO NOTHING;

INSERT INTO riddles (skill_id, category, difficulty, question, answer, hint)
SELECT id, 'programming', 'intermediate', 'I am the popular Python library whose main object is the DataFrame. What am I?', 'pandas', 'Its name sounds like the bear, but it is all about data tables.'
FROM skills WHERE name = 'Data Analysis' ON CONFLICT DO NOTHING;

-- English
INSERT INTO riddles (skill_id, category, difficulty, question, answer, hint)
SELECT id, 'language', 'beginner', 'I am the plural form of "child". What am I?', 'children', 'It does not simply end in "s".'
FROM skills WHERE name = 'English' ON CONFLICT DO NOTHING;

INSERT INTO riddles (skill_id, category, difficulty, question, answer, hint)
SELECT id, 'language', 'intermediate', 'I am the grammatical term for a word like "quickly" or "silently" that describes a verb. What part of speech am I?', 'adverb', 'Many of these end in -ly.'
FROM skills WHERE name = 'English' ON CONFLICT DO NOTHING;

-- Spanish
INSERT INTO riddles (skill_id, category, difficulty, question, answer, hint)
SELECT id, 'language', 'beginner', 'In Spanish, what is the word for "thank you"?', 'gracias', 'You would say it after receiving a gift.'
FROM skills WHERE name = 'Spanish' ON CONFLICT DO NOTHING;

INSERT INTO riddles (skill_id, category, difficulty, question, answer, hint)
SELECT id, 'language', 'intermediate', 'What is the Spanish verb "to be" used for permanent traits and identity (as opposed to "estar")?', 'ser', 'Estar is for temporary states; this one is for who you fundamentally are.'
FROM skills WHERE name = 'Spanish' ON CONFLICT DO NOTHING;

-- French
INSERT INTO riddles (skill_id, category, difficulty, question, answer, hint)
SELECT id, 'language', 'beginner', 'In French, what is the word for "hello"?', 'bonjour', 'You would say it in the morning or afternoon when greeting someone.'
FROM skills WHERE name = 'French' ON CONFLICT DO NOTHING;

-- Public Speaking
INSERT INTO riddles (skill_id, category, difficulty, question, answer, hint)
SELECT id, 'general', 'beginner', 'I am the fear of public speaking, named after the Greek word for "assembly". What phobia am I?', 'glossophobia', 'It combines "glossa" (tongue/speech) with "phobia".'
FROM skills WHERE name = 'Public Speaking' ON CONFLICT DO NOTHING;

-- Digital Marketing
INSERT INTO riddles (skill_id, category, difficulty, question, answer, hint)
SELECT id, 'general', 'beginner', 'I am the acronym for the practice of improving a website''s ranking on search engines. What three-letter acronym am I?', 'SEO', 'It stands for Search Engine ___.'
FROM skills WHERE name = 'Digital Marketing' ON CONFLICT DO NOTHING;

-- Guitar
INSERT INTO riddles (skill_id, category, difficulty, question, answer, hint)
SELECT id, 'general', 'beginner', 'How many strings does a standard acoustic guitar have?', '6', 'Standard tuning is E-A-D-G-B-E.'
FROM skills WHERE name = 'Guitar' ON CONFLICT DO NOTHING;

-- Graphic Design
INSERT INTO riddles (skill_id, category, difficulty, question, answer, hint)
SELECT id, 'general', 'beginner', 'I am the color model designers use for screens, made of three letters standing for Red, Green and this third color. What am I?', 'RGB', 'The third letter stands for a color that mixes red and blue.'
FROM skills WHERE name = 'Graphic Design' ON CONFLICT DO NOTHING;

-- Generic fallback riddles (no specific skill required)
INSERT INTO riddles (skill_id, category, difficulty, question, answer, hint) VALUES
  (NULL, 'general', 'beginner', 'The more you take, the more you leave behind. What am I?', 'footsteps', 'Think about walking.'),
  (NULL, 'general', 'beginner', 'I have keys but open no locks, space but no room, and you can enter but not go inside. What am I?', 'keyboard', 'You are probably touching one right now.'),
  (NULL, 'general', 'beginner', 'What has to be broken before you can use it?', 'egg', 'Breakfast-related.'),
  (NULL, 'general', 'beginner', 'What gets wetter the more it dries?', 'towel', 'You use it after a shower.')
ON CONFLICT DO NOTHING;
