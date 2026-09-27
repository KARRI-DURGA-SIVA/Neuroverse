// lib/agent.js
//
// Agentic AI layer for NeuroVerse.
//
// Design (perceive -> plan -> act -> observe -> respond), with one deliberate
// safety boundary: the agent can freely READ (profile, matches, availability,
// credits, learning path) but can never itself execute a money-moving action.
// Booking only happens when the person clicks "Confirm booking" in the UI,
// which calls the existing, already-audited /api/sessions/book endpoint.
// The agent's job stops at proposing a plan — a human always pulls the trigger
// on spending credits.
//
// Tool surface (mirrors the brief this was scoped against):
//   get_profile            -> getProfile()
//   find_matches           -> findMatches()          (wraps lib/mentorSearch)
//   check_availability     -> describeAvailability()  (best-effort; see note below)
//   check_credits          -> checkCredits()
//   recommend_learning_path-> already returned by findMatches() via buildLearningPath
//   book_session            -> NOT called by the agent; the client calls the
//                              existing /api/sessions/book endpoint directly
//                              after the person confirms the proposal.
//   update_progress         -> logProgressNote()      (lightweight hook)

const { query } = require("./db");
const { findMentorsForSkill, resolveSkillByName } = require("./mentorSearch");

const GEMINI_MODEL = "gemini-3.8-flash";

// --- Tool implementations -------------------------------------------------

async function getProfile(userId) {
  const userRes = await query(
    "SELECT id, name, credits, languages FROM users WHERE id = $1",
    [userId]
  );
  const skillsRes = await query(
    `SELECT us.type, us.level, us.desired_level, s.id as skill_id, s.name as skill_name
     FROM user_skills us JOIN skills s ON us.skill_id = s.id
     WHERE us.user_id = $1`,
    [userId]
  );
  return { user: userRes.rows[0], skills: skillsRes.rows };
}

async function checkCredits(userId) {
  const res = await query("SELECT credits FROM users WHERE id = $1", [userId]);
  return Number(res.rows[0]?.credits || 0);
}

async function findMatches({ userId, skillName, level, languages }) {
  const skill = await resolveSkillByName(skillName);
  if (!skill) return { found: false, skillName };

  const result = await findMentorsForSkill({
    skillId: skill.id,
    targetLevel: level || "intermediate",
    preferredLanguages: languages || [],
    excludeUserId: userId,
  });
  return { found: true, skill, ...result };
}

// NOTE: NeuroVerse's course listings don't currently store structured
// mentor availability (see lib/matching.js — availability is a best-effort
// free-text signal only). Rather than pretend to check real calendar slots,
// the agent is explicit about this limitation and defers the actual time
// confirmation to the booking step, where the learner and mentor coordinate
// a scheduled_start directly. This is an honest design choice, not a bug.
function describeAvailability(mentor) {
  return `Availability isn't tracked as structured calendar slots yet — pick a time when booking and the mentor will see it as a session request.`;
}

async function logProgressNote(userId, note) {
  await query(
    `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, 'agent_progress_note')`,
    [userId, note]
  );
  return { logged: true };
}

// --- Intent parsing via Gemini (structured JSON output) -------------------

async function parseIntent(message, conversationHistory = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server (.env.local)");
  }

  const historyText = conversationHistory
    .slice(-6)
    .map((m) => `${m.role === "user" ? "Learner" : "Assistant"}: ${m.content}`)
    .join("\n");

  const systemPrompt = `You are the intent parser for NeuroVerse, a peer-to-peer learning platform.
Read the learner's message (and recent conversation for context) and extract their learning request as JSON only, no prose, no markdown fences.

Schema:
{
  "intent": "find_mentor" | "check_profile" | "check_credits" | "small_talk" | "unclear",
  "skillName": string | null,
  "level": "beginner" | "intermediate" | "advanced" | null,
  "timeframe": string | null,
  "languages": string[] | null
}

Rules:
- "intent" is "find_mentor" whenever the learner wants to learn something or find someone to teach them, even implicitly.
- If they don't state a level, use null (do not guess "beginner").
- "timeframe" is a free-text description of when they want it (e.g. "this weekend", "weekday evenings"), or null if unstated.
- Respond with raw JSON only.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\nConversation so far:\n${historyText}\n\nLearner's new message: "${message}"` }],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || "Gemini API error while parsing intent");
  }

  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return { intent: "unclear" };
  }
}

async function composeReply(promptContext) {
  const apiKey = process.env.GEMINI_API_KEY;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: promptContext }] }],
      }),
    }
  );
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// --- Orchestrator: perceive -> plan -> act -> observe -> respond ----------

async function runAgentTurn({ userId, message, conversationHistory = [] }) {
  const intentData = await parseIntent(message, conversationHistory);

  if (intentData.intent === "check_credits") {
    const credits = await checkCredits(userId);
    return { reply: `You currently have ${credits} credits.`, proposal: null };
  }

  if (intentData.intent === "check_profile") {
    const profile = await getProfile(userId);
    const known = profile.skills.filter((s) => s.type === "known").map((s) => `${s.skill_name} (${s.level || "unrated"})`);
    const learning = profile.skills.filter((s) => s.type === "learning").map((s) => s.skill_name);
    return {
      reply: `You know: ${known.join(", ") || "nothing listed yet"}. You're learning: ${learning.join(", ") || "nothing listed yet"}. Credits: ${profile.user.credits}.`,
      proposal: null,
    };
  }

  if (intentData.intent !== "find_mentor" || !intentData.skillName) {
    return {
      reply: "I can help you find a mentor, check your credits, or check your profile. Try something like: \"I want to learn Python from beginner level, find someone available this weekend.\"",
      proposal: null,
    };
  }

  // 1. get_profile — pull learner's stated languages as a matching signal
  const profile = await getProfile(userId);

  // 2. find_matches
  const matchResult = await findMatches({
    userId,
    skillName: intentData.skillName,
    level: intentData.level || "intermediate",
    languages: profile.user.languages || intentData.languages || [],
  });

  if (!matchResult.found) {
    return {
      reply: `I couldn't find "${intentData.skillName}" in our skill catalog yet. You can add it manually from the Explore or Onboarding page, and it'll be searchable right away.`,
      proposal: null,
    };
  }

  if (matchResult.mentors.length === 0) {
    return {
      reply: `Nobody is teaching ${matchResult.skill.name} yet. I'll notify you as soon as a mentor lists it — in the meantime, you could be the first to teach it yourself if you know it!`,
      proposal: null,
    };
  }

  const top = matchResult.mentors[0];

  // 3. check_availability (best-effort, see describeAvailability note above)
  const availabilityNote = describeAvailability(top);

  // 4. check_credits
  const credits = await checkCredits(userId);
  const canAfford = credits >= top.pricePerHour * 1.1; // rough 1hr + 10% fee estimate

  // 5. recommend_learning_path (already attached to matchResult)
  const pathSummary = matchResult.learningPath.map((s) => s.title).join(" → ");

  const reply =
    `I found a ${top.suitabilityPercent}% match: **${top.mentorName}** teaches ${matchResult.skill.name} at ${top.mentorLevel} level` +
    (top.avgRating > 0 ? ` (${top.avgRating.toFixed(1)}★, ${top.totalReviews} reviews)` : " (new mentor, no reviews yet)") +
    `, at ${top.pricePerHour} credits/hour. ${availabilityNote}` +
    (canAfford ? " You have enough credits to book." : ` You have ${credits} credits — that may not be enough after the 10% platform fee, consider topping up first.`) +
    ` Suggested learning path: ${pathSummary}.` +
    ` Want me to set this up? Confirm below and pick a time.`;

  return {
    reply,
    proposal: {
      type: "booking",
      courseId: top.courseId,
      mentorName: top.mentorName,
      skillName: matchResult.skill.name,
      mentorLevel: top.mentorLevel,
      pricePerHour: top.pricePerHour,
      suitabilityPercent: top.suitabilityPercent,
      avgRating: top.avgRating,
      totalReviews: top.totalReviews,
      reasons: top.reasons,
      canAfford,
      credits,
      learningPath: matchResult.learningPath,
      timeframeHint: intentData.timeframe || null,
    },
  };
}

module.exports = {
  runAgentTurn,
  getProfile,
  checkCredits,
  findMatches,
  logProgressNote,
};
