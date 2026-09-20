// lib/riddles.js
// Shared logic for the optional "daily login riddle" game.
//
// Rules (kept in one place so the two API routes below always agree):
// - Riddles are matched to skills the user already marked as "known".
// - Answering correctly earns CREDITS_PER_CORRECT_ANSWER credit(s).
// - A user can never earn more than MAX_DAILY_RIDDLE_CREDITS credits per
//   calendar day from riddles, no matter how many times they log in or
//   answer correctly.
// - Playing is always optional; the user can skip/dismiss it.

const { query } = require("./db");

const CREDITS_PER_CORRECT_ANSWER = 1;
const MAX_DAILY_RIDDLE_CREDITS = 5;

// How many credits this user has already earned from riddles today.
async function getCreditsEarnedToday(userId) {
  const result = await query(
    `SELECT COALESCE(SUM(credits_awarded), 0) as total
     FROM riddle_attempts
     WHERE user_id = $1 AND attempt_date = CURRENT_DATE`,
    [userId]
  );
  return Number(result.rows[0].total);
}

// Picks a riddle for this user: prefers riddles tied to a skill the user
// already knows, prefers ones not already answered correctly, and falls
// back to generic riddles if nothing skill-specific is left.
async function pickRiddleForUser(userId) {
  const knownSkills = await query(
    `SELECT skill_id FROM user_skills WHERE user_id = $1 AND type = 'known'`,
    [userId]
  );
  const skillIds = knownSkills.rows.map((r) => r.skill_id);

  const alreadyCorrect = await query(
    `SELECT riddle_id FROM riddle_attempts WHERE user_id = $1 AND correct = true`,
    [userId]
  );
  const solvedIds = alreadyCorrect.rows.map((r) => r.riddle_id);
  const excludeClause = solvedIds.length ? "AND r.id != ALL($2::uuid[])" : "";
  const excludeParam = solvedIds.length ? [solvedIds] : [];

  // 1) Try a riddle tied to one of the user's known skills, unsolved first.
  if (skillIds.length > 0) {
    const bySkill = await query(
      `SELECT r.* FROM riddles r
       WHERE r.skill_id = ANY($1::uuid[]) ${excludeClause}
       ORDER BY random() LIMIT 1`,
      [skillIds, ...excludeParam]
    );
    if (bySkill.rows.length > 0) return bySkill.rows[0];

    // All skill-specific riddles for known skills have been solved — allow repeats.
    const bySkillAny = await query(
      `SELECT r.* FROM riddles r WHERE r.skill_id = ANY($1::uuid[]) ORDER BY random() LIMIT 1`,
      [skillIds]
    );
    if (bySkillAny.rows.length > 0) return bySkillAny.rows[0];
  }

  // 2) Fall back to a generic (no skill_id) riddle, unsolved first.
  const generic = await query(
    `SELECT r.* FROM riddles r WHERE r.skill_id IS NULL ${excludeClause}
     ORDER BY random() LIMIT 1`,
    excludeParam
  );
  if (generic.rows.length > 0) return generic.rows[0];

  // 3) Last resort: any riddle at all.
  const any = await query(`SELECT * FROM riddles ORDER BY random() LIMIT 1`);
  return any.rows[0] || null;
}

function normalizeAnswer(str) {
  return (str || "").toString().trim().toLowerCase();
}

module.exports = {
  CREDITS_PER_CORRECT_ANSWER,
  MAX_DAILY_RIDDLE_CREDITS,
  getCreditsEarnedToday,
  pickRiddleForUser,
  normalizeAnswer,
};
