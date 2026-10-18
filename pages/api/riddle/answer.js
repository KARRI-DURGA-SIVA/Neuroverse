import { query } from "../../../lib/db";
const { getUserFromReq } = require("../../../lib/auth");
import {
  MAX_DAILY_RIDDLE_CREDITS,
  CREDITS_PER_CORRECT_ANSWER,
  getCreditsEarnedToday,
  normalizeAnswer,
} from "../../../lib/riddles";

// POST /api/riddle/answer  { riddleId, answer }
// Grades the answer, and — only if correct AND the user hasn't hit the
// per-day riddle credit cap — awards credit(s) and records the transaction.
export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { riddleId, answer } = req.body;
  if (!riddleId) return res.status(400).json({ error: "riddleId is required" });

  try {
    const riddleRes = await query("SELECT * FROM riddles WHERE id = $1", [riddleId]);
    const riddle = riddleRes.rows[0];
    if (!riddle) return res.status(404).json({ error: "Riddle not found" });

    const isCorrect = normalizeAnswer(answer) === normalizeAnswer(riddle.answer);

    const creditsToday = await getCreditsEarnedToday(authUser.id);
    const remainingToday = Math.max(0, MAX_DAILY_RIDDLE_CREDITS - creditsToday);
    const capReached = remainingToday <= 0;

    let creditsAwarded = 0;
    if (isCorrect && !capReached) {
      creditsAwarded = Math.min(CREDITS_PER_CORRECT_ANSWER, remainingToday);
    }

    await query(
      `INSERT INTO riddle_attempts (user_id, riddle_id, correct, credits_awarded)
       VALUES ($1, $2, $3, $4)`,
      [authUser.id, riddleId, isCorrect, creditsAwarded]
    );

    if (creditsAwarded > 0) {
      await query("UPDATE users SET credits = credits + $1 WHERE id = $2", [
        creditsAwarded,
        authUser.id,
      ]);
      await query(
        `INSERT INTO transactions (user_id, type, credits, description)
         VALUES ($1, 'earn', $2, 'Daily riddle game — correct answer')`,
        [authUser.id, creditsAwarded]
      );
    }

    const userRes = await query("SELECT credits FROM users WHERE id = $1", [authUser.id]);

    return res.status(200).json({
      correct: isCorrect,
      creditsAwarded,
      creditsToday: creditsToday + creditsAwarded,
      maxDailyCredits: MAX_DAILY_RIDDLE_CREDITS,
      dailyCapReached: creditsToday + creditsAwarded >= MAX_DAILY_RIDDLE_CREDITS,
      correctAnswer: isCorrect ? undefined : riddle.answer,
      totalCredits: userRes.rows[0].credits,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to grade riddle", details: err.message });
  }
}
