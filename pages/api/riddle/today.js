const { getUserFromReq } = require("../../../lib/auth");
const {
  MAX_DAILY_RIDDLE_CREDITS,
  CREDITS_PER_CORRECT_ANSWER,
  getCreditsEarnedToday,
  pickRiddleForUser,
} = require("../../../lib/riddles");

// GET /api/riddle/today
// Returns an optional riddle for the logged-in user to play this session.
// Never returns the correct answer to the client.
export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const creditsToday = await getCreditsEarnedToday(authUser.id);
  const dailyCapReached = creditsToday >= MAX_DAILY_RIDDLE_CREDITS;

  if (dailyCapReached) {
    return res.status(200).json({
      available: false,
      dailyCapReached: true,
      creditsToday,
      maxDailyCredits: MAX_DAILY_RIDDLE_CREDITS,
    });
  }

  const riddle = await pickRiddleForUser(authUser.id);
  if (!riddle) {
    return res.status(200).json({ available: false, dailyCapReached: false, creditsToday });
  }

  return res.status(200).json({
    available: true,
    dailyCapReached: false,
    creditsToday,
    maxDailyCredits: MAX_DAILY_RIDDLE_CREDITS,
    creditsPerCorrectAnswer: CREDITS_PER_CORRECT_ANSWER,
    riddle: {
      id: riddle.id,
      question: riddle.question,
      hint: riddle.hint,
      difficulty: riddle.difficulty,
      category: riddle.category,
    },
  });
}
