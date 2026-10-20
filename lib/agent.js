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

import { query } from "./db";
import { findMentorsForSkill, resolveSkillByName } from "./mentorSearch";
const {
  collectLearnerDetails,
  emptyLearnerContext,
  getNextQuestion,
  isReadyForRecommendations,
} = require("./agent-conversation");

const GEMINI_MODEL = "gemini-3.8-flash";

// --- Tool implementations -------------------------------------------------

export async function getProfile(userId) {
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

export async function checkCredits(userId) {
  const res = await query("SELECT credits FROM users WHERE id = $1", [userId]);
  return Number(res.rows[0]?.credits || 0);
}

export async function findMatches({ userId, skillName, level, languages }) {
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

export async function logProgressNote(userId, note) {
  await query(
    `INSERT INTO notifications (user_id, message, type) VALUES ($1, $2, 'agent_progress_note')`,
    [userId, note]
  );
  return { logged: true };
}

export async function getAgentConversation(userId) {
  const conversationResult = await query(
    `SELECT id, context, updated_at FROM assistant_conversations
     WHERE user_id = $1 AND status = 'active'
     ORDER BY updated_at DESC LIMIT 1`,
    [userId]
  );
  const conversation = conversationResult.rows[0];
  if (conversation) {
    const messages = await query(
      `SELECT role, content FROM assistant_messages
       WHERE conversation_id = $1 ORDER BY created_at, id`,
      [conversation.id]
    );
    return {
      conversationId: conversation.id,
      messages: messages.rows,
      recommendations: conversation.context?.recommendations || [],
    };
  }

  const saved = await getLatestLearnerContext(userId);
  return {
    conversationId: null,
    messages: [{ role: "assistant", content: greetingFor(saved) }],
    recommendations: [],
  };
}

export async function startNewAgentConversation(userId) {
  await query("UPDATE assistant_conversations SET status = 'archived' WHERE user_id = $1 AND status = 'active'", [userId]);
  const context = await getLatestLearnerContext(userId);
  const created = await query(
    `INSERT INTO assistant_conversations (user_id, context)
     VALUES ($1,$2::jsonb) RETURNING id`,
    [userId, JSON.stringify(context)]
  );
  const greeting = greetingFor(context);
  await query(
    "INSERT INTO assistant_messages (conversation_id, role, content) VALUES ($1,'assistant',$2)",
    [created.rows[0].id, greeting]
  );
  return { conversationId: created.rows[0].id, messages: [{ role: "assistant", content: greeting }], recommendations: [] };
}

export async function recordAgentBooking(userId, conversationId, sessionId) {
  const ownedConversation = await query(
    `SELECT id FROM assistant_conversations
     WHERE id = $1 AND user_id = $2 AND status = 'active'`,
    [conversationId, userId]
  );
  if (!ownedConversation.rows.length) {
    const error = new Error("Conversation not found");
    error.statusCode = 404;
    throw error;
  }
  const booking = await query(
    `SELECT sess.id, sess.status, c.title, u.name AS mentor_name
     FROM sessions sess JOIN courses c ON c.id = sess.course_id
     JOIN users u ON u.id = sess.mentor_id
     WHERE sess.id = $1 AND sess.learner_id = $2`,
    [sessionId, userId]
  );
  if (!booking.rows.length) {
    const error = new Error("Booking request not found for this account");
    error.statusCode = 404;
    throw error;
  }
  const item = booking.rows[0];
  const reply = `Request sent for ${item.title} with ${item.mentor_name}. Current status: ${item.status}. The mentor must accept, then you confirm the schedule and spend wallet credits to book the session.`;
  await query(
    `INSERT INTO assistant_messages (conversation_id, role, content, metadata)
     VALUES ($1,'assistant',$2,$3::jsonb)`,
    [conversationId, reply, JSON.stringify({ sessionId: item.id, status: item.status })]
  );
  await query("UPDATE assistant_conversations SET updated_at = now() WHERE id = $1", [conversationId]);
  return { reply };
}

export async function runAgentTurn({ userId, message, conversationId }) {
  const conversation = await getOrCreateConversation(userId, conversationId);
  const id = conversation.id;
  const context = { ...emptyLearnerContext(), ...(conversation.context || {}) };
  const previousMessages = await query(
    `SELECT role, content FROM assistant_messages
     WHERE conversation_id = $1 ORDER BY created_at DESC, id DESC LIMIT 12`,
    [id]
  );
  await query(
    "INSERT INTO assistant_messages (conversation_id, role, content) VALUES ($1,'user',$2)",
    [id, message]
  );

  const quickReply = await getAccountAnswer(userId, message, context);
  if (quickReply) return persistAgentReply(id, context, quickReply, []);
  if (context.skillId && /^(?:hi|hello|hey|good morning|good afternoon|good evening)[!.\s]*$/i.test(message)) {
    return persistAgentReply(id, context, greetingFor(context), conversation.context?.recommendations || []);
  }

  const skillsResult = await query("SELECT id, name FROM skills ORDER BY name");
  const skills = skillsResult.rows;
  let learnerContext = collectLearnerDetails(context, message, skills);
  if (context.skillId && learnerContext.skillId && String(context.skillId) !== String(learnerContext.skillId)) {
    const savedForSkill = await getLearnerContextForSkill(userId, learnerContext.skillId);
    learnerContext = collectLearnerDetails(savedForSkill, message, skills);
  }
  const extracted = await extractStructuredDetails({
    message,
    context: learnerContext,
    previousMessages: previousMessages.rows.reverse(),
    skills,
  });
  learnerContext = applyStructuredDetails(learnerContext, extracted, skills);

  if (learnerContext.skillId) await saveLearnerProfile(userId, learnerContext);

  const nextQuestion = getNextQuestion(learnerContext);
  if (nextQuestion) {
    const reply = learnerContext.unmatchedSubject && nextQuestion.field === "subject"
      ? await explainUnmatchedSubject(learnerContext.unmatchedSubject, skills)
      : nextQuestion.text;
    return persistAgentReply(id, learnerContext, reply, []);
  }

  if (!isReadyForRecommendations(learnerContext)) {
    return persistAgentReply(id, learnerContext, "What would you like to change or add to your learning preferences?", []);
  }

  const profile = await getProfile(userId);
  const budgetCredits = extractCreditBudget(learnerContext.budgetPreference);
  const matchResult = await findMentorsForSkill({
    skillId: learnerContext.skillId,
    targetLevel: learnerContext.skillLevel || "intermediate",
    preferredLanguages: profile.user?.languages || [],
    preferredAvailability: learnerContext.availability,
    learnerGoal: learnerContext.goal,
    teachingStyle: learnerContext.teachingStyle,
    budgetCredits,
    excludeUserId: userId,
  });

  if (!matchResult) {
    learnerContext.skillId = null;
    learnerContext.subject = null;
    learnerContext.answered.subject = false;
    return persistAgentReply(id, learnerContext, "I couldn't match that subject to a skill in the catalog. What skill should I search for?", []);
  }
  if (!matchResult.mentors.length) {
    return persistAgentReply(id, learnerContext, `I couldn't find active courses for ${matchResult.skill.name} in the mentor database yet. I won't invent a recommendation. Would you like to search another skill?`, []);
  }

  const credits = await checkCredits(userId);
  const recommendations = matchResult.mentors.slice(0, 3).map((mentor) => ({
    type: "booking",
    courseId: mentor.courseId,
    mentorId: mentor.mentorId,
    mentorName: mentor.mentorName,
    skillName: matchResult.skill.name,
    courseTitle: mentor.title,
    description: mentor.description || mentor.mentorBio || "No course description is listed.",
    targetLevel: learnerContext.skillLevel,
    mentorLevel: mentor.mentorLevel,
    pricePerHour: mentor.pricePerHour,
    totalCreditsPerHour: mentor.totalCreditsPerHour,
    suitabilityPercent: mentor.suitabilityPercent,
    avgRating: mentor.avgRating,
    totalReviews: mentor.totalReviews,
    reasons: mentor.reasons,
    budgetMatch: mentor.budgetMatch,
    credits,
  }));

  const budgetNote = learnerContext.budgetPreference && budgetCredits === null
    ? " Your budget is saved, but I can't compare it to credit prices without a configured currency conversion."
    : "";
  const reply = `I found ${recommendations.length} active ${matchResult.skill.name} course${recommendations.length === 1 ? "" : "s"} in the database. These matches use your ${learnerContext.skillLevel} level, goal, and teaching preferences. Prices are in credits per hour, including the platform fee.${budgetNote} Mentor profiles do not contain confirmed recurring time slots, so the schedule must be confirmed by the mentor after you send a request.`;
  return persistAgentReply(id, learnerContext, reply, recommendations);
}

async function getOrCreateConversation(userId, conversationId) {
  if (conversationId) {
    const owned = await query(
      `SELECT id, context FROM assistant_conversations
       WHERE id = $1 AND user_id = $2 AND status = 'active'`,
      [conversationId, userId]
    );
    if (!owned.rows.length) {
      const error = new Error("Conversation not found");
      error.statusCode = 404;
      throw error;
    }
    return owned.rows[0];
  }

  const active = await query(
    `SELECT id, context FROM assistant_conversations
     WHERE user_id = $1 AND status = 'active'
     ORDER BY updated_at DESC LIMIT 1`,
    [userId]
  );
  if (active.rows.length) return active.rows[0];

  const context = await getLatestLearnerContext(userId);
  const created = await query(
    `INSERT INTO assistant_conversations (user_id, context)
     VALUES ($1,$2::jsonb) RETURNING id, context`,
    [userId, JSON.stringify(context)]
  );
  const greeting = greetingFor(context);
  await query(
    "INSERT INTO assistant_messages (conversation_id, role, content) VALUES ($1,'assistant',$2)",
    [created.rows[0].id, greeting]
  );
  return created.rows[0];
}

async function getLatestLearnerContext(userId) {
  const saved = await query(
    `SELECT p.*, s.name AS subject FROM learner_learning_profiles p
     JOIN skills s ON s.id = p.skill_id
     WHERE p.user_id = $1 ORDER BY p.updated_at DESC LIMIT 1`,
    [userId]
  );
  if (!saved.rows.length) return emptyLearnerContext();
  const profile = saved.rows[0];
  return {
    ...emptyLearnerContext(),
    subject: profile.subject,
    skillId: String(profile.skill_id),
    goal: profile.learning_goal,
    skillLevel: profile.skill_level,
    teachingStyle: profile.teaching_style,
    availability: profile.availability_preference,
    sessionsPerWeek: profile.sessions_per_week,
    budgetPreference: profile.budget_preference,
    answered: {
      subject: true,
      goal: Boolean(profile.learning_goal),
      skillLevel: Boolean(profile.skill_level),
      teachingStyle: Boolean(profile.teaching_style),
      availability: Boolean(profile.availability_preference),
      sessionsPerWeek: Boolean(profile.sessions_per_week),
    },
  };
}

async function getLearnerContextForSkill(userId, skillId) {
  const result = await query(
    `SELECT p.*, s.name AS subject FROM learner_learning_profiles p
     JOIN skills s ON s.id = p.skill_id
     WHERE p.user_id = $1 AND p.skill_id = $2`,
    [userId, skillId]
  );
  if (!result.rows.length) return emptyLearnerContext();
  const profile = result.rows[0];
  return {
    ...emptyLearnerContext(),
    subject: profile.subject,
    skillId: String(profile.skill_id),
    goal: profile.learning_goal,
    skillLevel: profile.skill_level,
    teachingStyle: profile.teaching_style,
    availability: profile.availability_preference,
    sessionsPerWeek: profile.sessions_per_week,
    budgetPreference: profile.budget_preference,
    answered: {
      subject: true,
      goal: Boolean(profile.learning_goal),
      skillLevel: Boolean(profile.skill_level),
      teachingStyle: Boolean(profile.teaching_style),
      availability: Boolean(profile.availability_preference),
      sessionsPerWeek: Boolean(profile.sessions_per_week),
    },
  };
}

function greetingFor(context) {
  if (context.skillId && context.subject) {
    return `Welcome back. I have your saved ${context.subject} goal${context.goal ? ` (${context.goal})` : ""}. Would you like mentor recommendations for it, or would you like to update your preferences?`;
  }
  return "Hi! What would you like to learn?";
}

async function saveLearnerProfile(userId, context) {
  await query(
    `INSERT INTO learner_learning_profiles
       (user_id, skill_id, learning_goal, skill_level, teaching_style,
        availability_preference, sessions_per_week, budget_preference)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (user_id, skill_id) DO UPDATE SET
       learning_goal = COALESCE(EXCLUDED.learning_goal, learner_learning_profiles.learning_goal),
       skill_level = COALESCE(EXCLUDED.skill_level, learner_learning_profiles.skill_level),
       teaching_style = COALESCE(EXCLUDED.teaching_style, learner_learning_profiles.teaching_style),
       availability_preference = COALESCE(EXCLUDED.availability_preference, learner_learning_profiles.availability_preference),
       sessions_per_week = COALESCE(EXCLUDED.sessions_per_week, learner_learning_profiles.sessions_per_week),
       budget_preference = COALESCE(EXCLUDED.budget_preference, learner_learning_profiles.budget_preference),
       updated_at = now()`,
    [userId, context.skillId, context.goal, context.skillLevel, context.teachingStyle,
      context.availability, context.sessionsPerWeek, context.budgetPreference]
  );
}

async function persistAgentReply(conversationId, context, reply, recommendations) {
  const updatedContext = { ...context, recommendations };
  await query(
    `INSERT INTO assistant_messages (conversation_id, role, content, metadata)
     VALUES ($1,'assistant',$2,$3::jsonb)`,
    [conversationId, reply, JSON.stringify({ recommendationCount: recommendations.length })]
  );
  await query(
    `UPDATE assistant_conversations SET context = $2::jsonb, updated_at = now()
     WHERE id = $1`,
    [conversationId, JSON.stringify(updatedContext)]
  );
  return { conversationId, reply, recommendations };
}

async function extractStructuredDetails({ message, context, previousMessages, skills }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return {};
  const skillNames = skills.slice(0, 250).map((skill) => skill.name);
  const prompt = `Extract only information the learner explicitly stated. Return JSON with nullable fields: subject, goal, skillLevel, teachingStyle, availability, sessionsPerWeek, budgetPreference. skillLevel must be beginner, intermediate, advanced, or expert. subject must exactly match one of the catalog entries or be null. Do not infer mentor availability, experience, ratings, or prices. Keep existing values unless the latest learner message explicitly changes them. Ask one follow-up at a time; this call only extracts slots and must not answer the learner.\nCatalog skills: ${JSON.stringify(skillNames)}\nCurrent collected slots: ${JSON.stringify(context)}\nRecent conversation: ${JSON.stringify(previousMessages.slice(-8))}\nLatest learner message: ${JSON.stringify(message)}`;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!response.ok) return {};
    const data = await response.json();
    return JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
  } catch (error) {
    console.warn("Gemini conversation extraction unavailable; using local slot parsing:", error.message);
    return {};
  }
}

function applyStructuredDetails(context, extracted, skills) {
  const updated = { ...context, answered: { ...(context.answered || {}) } };
  const clean = (value) => typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : null;
  const subject = clean(extracted.subject);
  if (subject) {
    const match = skills.find((skill) => skill.name.toLowerCase() === subject.toLowerCase());
    if (match) {
      updated.subject = match.name;
      updated.skillId = String(match.id);
      updated.answered.subject = true;
    }
  }
  const goal = clean(extracted.goal);
  if (goal) { updated.goal = goal; updated.answered.goal = true; }
  if (["beginner", "intermediate", "advanced", "expert"].includes(extracted.skillLevel)) {
    updated.skillLevel = extracted.skillLevel;
    updated.answered.skillLevel = true;
  }
  const teachingStyle = clean(extracted.teachingStyle);
  if (teachingStyle) { updated.teachingStyle = teachingStyle; updated.answered.teachingStyle = true; }
  const availability = clean(extracted.availability);
  if (availability) { updated.availability = availability; updated.answered.availability = true; }
  const count = Number(extracted.sessionsPerWeek);
  if (Number.isInteger(count) && count >= 1 && count <= 7) {
    updated.sessionsPerWeek = count;
    updated.answered.sessionsPerWeek = true;
  }
  const budget = clean(extracted.budgetPreference);
  if (budget) updated.budgetPreference = budget;
  return updated;
}

async function explainUnmatchedSubject(subject, skills) {
  const search = await query(
    "SELECT name FROM skills WHERE name ILIKE $1 ORDER BY name LIMIT 5",
    [`%${subject}%`]
  );
  const suggestions = search.rows.map((skill) => skill.name);
  const available = suggestions.length ? ` Similar catalog skills: ${suggestions.join(", ")}.` : " I couldn't find a matching skill in the current catalog.";
  return `I don't see “${subject}” in the mentor skill catalog, so I won't invent a match.${available} Which catalog skill would you like me to search?`;
}

async function getAccountAnswer(userId, message, context) {
  const normalized = message.toLowerCase();
  if (/\b(wallet|credits?|balance)\b/.test(normalized) && /\b(how much|balance|have|wallet|check)\b/.test(normalized)) {
    return `Your current wallet balance is ${await checkCredits(userId)} credits.`;
  }
  if (/\b(did.*accept|accepted|booking status|request status)\b/.test(normalized)) {
    const sessions = await query(
      `SELECT sess.status, c.title, sess.scheduled_start
       FROM sessions sess JOIN courses c ON c.id = sess.course_id
       WHERE sess.learner_id = $1 ORDER BY sess.created_at DESC LIMIT 5`,
      [userId]
    );
    if (!sessions.rows.length) return "I don't see a saved learner booking yet. Once you send a request, I can check its saved status.";
    return `Your latest learner request${sessions.rows.length === 1 ? " is" : "s are"}: ${sessions.rows.map((session) => `${session.title}: ${session.status} (${new Date(session.scheduled_start).toLocaleString()})`).join("; ")}.`;
  }
  if (/\b(profile|my learning goals|what am i learning)\b/.test(normalized)) {
    const saved = await query(
      `SELECT s.name, p.learning_goal, p.skill_level, p.teaching_style,
              p.availability_preference, p.sessions_per_week
       FROM learner_learning_profiles p JOIN skills s ON s.id = p.skill_id
       WHERE p.user_id = $1 ORDER BY p.updated_at DESC`,
      [userId]
    );
    if (!saved.rows.length) return "I don't have saved learning preferences yet. Tell me what you'd like to learn and I'll remember them for your account.";
    return `Your saved learning preferences: ${saved.rows.map((item) => `${item.name}${item.learning_goal ? ` for ${item.learning_goal}` : ""}${item.skill_level ? `, ${item.skill_level}` : ""}${item.teaching_style ? `, mentor style: ${item.teaching_style}` : ""}${item.sessions_per_week ? `, ${item.sessions_per_week} sessions/week` : ""}${item.availability_preference ? `, ${item.availability_preference}` : ""}`).join("; ")}.`;
  }
  if (context.skillId && /\b(recommend|find|show|suggest)\b/.test(normalized)) return null;
  return null;
}

function extractCreditBudget(value) {
  const match = String(value || "").match(/(\d+(?:\.\d+)?)\s*credits?\b/i);
  return match ? Number(match[1]) : null;
}
