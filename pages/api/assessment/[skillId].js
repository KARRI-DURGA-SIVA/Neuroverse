import { query, getPool } from "../../../lib/db";
const { getUserFromReq } = require("../../../lib/auth");
const { scoreAssessment } = require("../../../lib/classification");
const { generateLocalAssessmentQuestions } = require("../../../lib/local-assessment-generator");
const { generateAssessmentQuestions } = require("../../../lib/assessment-generator");

async function generateQuestions(skill) {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "your-gemini-api-key-here") {
    return generateLocalAssessmentQuestions(skill);
  }

  try {
    return await generateAssessmentQuestions(skill);
  } catch (error) {
    console.error("Gemini assessment generation failed; using local question bank:", error.message);
    return generateLocalAssessmentQuestions(skill);
  }
}

async function saveQuestions(skillId, questions) {
  const seen = new Set();
  for (const question of questions) {
    const normalized = question.question_text.trim().replace(/\s+/g, " ").toLowerCase();
    if (seen.has(normalized)) throw new Error("Generated assessment contains duplicate questions");
    seen.add(normalized);
  }
  if (questions.length !== 20) throw new Error("Assessment must contain exactly 20 questions");

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`assessment-skill-${skillId}`]);
    for (const question of questions) {
      await client.query(
        `INSERT INTO assessment_questions
         (skill_id, question_type, difficulty, question_text, options, correct_answer, starter_code, points)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (skill_id, question_text) DO NOTHING`,
        [skillId, question.question_type, question.difficulty, question.question_text,
          question.options ? JSON.stringify(question.options) : null, question.correct_answer,
          question.starter_code, question.points]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const DIFFICULTY_COUNTS = { beginner: 5, intermediate: 5, advanced: 6, expert: 4 };

async function getBalancedQuestions(skillId) {
  const questions = [];
  for (const [difficulty, count] of Object.entries(DIFFICULTY_COUNTS)) {
    const result = await query(
      `SELECT id, question_type, difficulty, question_text, options, starter_code, points
       FROM assessment_questions WHERE skill_id = $1 AND difficulty = $2
       ORDER BY random() LIMIT $3`,
      [skillId, difficulty, count]
    );
    if (result.rows.length !== count) return [];
    questions.push(...result.rows);
  }
  return questions;
}

async function prepareQuestions(skill, forceGenerate = false) {
  let questions = forceGenerate ? [] : await getBalancedQuestions(skill.id);
  if (questions.length !== 20) {
    await saveQuestions(skill.id, await generateQuestions(skill));
    questions = await getBalancedQuestions(skill.id);
  }
  if (questions.length !== 20) throw new Error("Could not prepare the required 20-question assessment");
  return questions;
}

async function startRun(userId, skill, forceGenerate) {
  const questions = await prepareQuestions(skill, forceGenerate);
  const run = await query(
    `INSERT INTO assessment_runs (user_id, skill_id, question_ids)
     VALUES ($1,$2,$3::bigint[]) RETURNING id, started_at`,
    [userId, skill.id, questions.map((question) => question.id)]
  );
  return { runId: run.rows[0].id, startedAt: run.rows[0].started_at, skill, questions };
}

async function recordFocusLoss(userId, runId) {
  const updated = await query(
    `UPDATE assessment_runs SET focus_loss_count = focus_loss_count + 1
     WHERE id = $1 AND user_id = $2 AND status = 'in_progress'
     RETURNING focus_loss_count`,
    [runId, userId]
  );
  if (!updated.rows.length) {
    const run = await query("SELECT user_id, status FROM assessment_runs WHERE id = $1", [runId]);
    if (!run.rows.length) return { status: 404, error: "Assessment run not found" };
    if (String(run.rows[0].user_id) !== String(userId)) return { status: 403, error: "Not allowed to update this assessment" };
    return { status: 409, error: "Assessment run is no longer active" };
  }
  await query(
    `INSERT INTO assessment_run_events (run_id, event_type)
     VALUES ($1,'visibility_lost')`,
    [runId]
  );
  return { status: 200, focusLossCount: updated.rows[0].focus_loss_count };
}

function validateAnswers(answers, questions) {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return "answers must be an object";
  const allowedIds = new Set(questions.map((question) => String(question.id)));
  for (const [questionId, answer] of Object.entries(answers)) {
    if (!allowedIds.has(questionId)) return "answers contain a question outside this assessment";
    if (typeof answer !== "string" || answer.length > 10000) return "each answer must be text under 10000 characters";
  }
  return null;
}

function publicBreakdown(questions, scoredBreakdown, answers) {
  return questions.map((question, index) => ({
    questionId: question.id,
    difficulty: question.difficulty,
    correct: scoredBreakdown[index].correct,
    submitted: Boolean(String(answers[question.id] || "").trim()),
    points: Number(question.points),
    earnedPoints: scoredBreakdown[index].correct ? Number(question.points) : 0,
  }));
}

function formatAttempt(attempt) {
  return {
    attemptId: attempt.id,
    scorePercent: Number(attempt.score),
    classifiedLevel: attempt.classified_level,
    correctCount: Number(attempt.correct_count),
    wrongCount: Number(attempt.wrong_count),
    unansweredCount: Number(attempt.unanswered_count),
    totalQuestions: Number(attempt.total_questions),
    completionStatus: attempt.completed ? "completed" : "incomplete",
    focusLossCount: Number(attempt.focus_loss_count),
  };
}

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ error: "Method not allowed" });

  const skillId = String(req.query.skillId || "");
  if (!/^\d{1,18}$/.test(skillId)) return res.status(400).json({ error: "Invalid skillId" });

  try {
    const skillResult = await query("SELECT * FROM skills WHERE id = $1", [skillId]);
    if (!skillResult.rows.length) return res.status(404).json({ error: "Skill not found" });
    const skill = skillResult.rows[0];

    if (req.method === "GET") {
      const questions = await getBalancedQuestions(skillId);
      return res.status(200).json({ skill, questions });
    }

    const { action, runId } = req.body || {};
    if (action === "start" || action === "generate") {
      const run = await startRun(authUser.id, skill, action === "generate");
      return res.status(201).json(run);
    }
    if (action === "focus-loss") {
      if (!/^\d{1,18}$/.test(String(runId || ""))) return res.status(400).json({ error: "Valid runId is required" });
      const result = await recordFocusLoss(authUser.id, runId);
      return res.status(result.status).json(result.status === 200 ? result : { error: result.error });
    }
    if (action) return res.status(400).json({ error: "Unknown assessment action" });
    if (!/^\d{1,18}$/.test(String(runId || ""))) return res.status(400).json({ error: "runId is required to submit this assessment" });

    const answers = req.body?.answers;
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const runResult = await client.query("SELECT * FROM assessment_runs WHERE id = $1 FOR UPDATE", [runId]);
      const run = runResult.rows[0];
      if (!run) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Assessment run not found" });
      }
      if (String(run.user_id) !== String(authUser.id)) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Not allowed to submit this assessment" });
      }
      if (String(run.skill_id) !== skillId) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Assessment run does not match this skill" });
      }
      if (run.status === "completed") {
        const previous = await client.query("SELECT * FROM assessment_attempts WHERE run_id = $1", [runId]);
        await client.query("COMMIT");
        return res.status(200).json({ ...formatAttempt(previous.rows[0]), duplicate: true });
      }
      if (run.status !== "in_progress") {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Assessment run is not active" });
      }

      const questionsResult = await client.query(
        `SELECT * FROM assessment_questions
         WHERE skill_id = $1 AND id = ANY($2::bigint[])
         ORDER BY array_position($2::bigint[], id)`,
        [skillId, run.question_ids]
      );
      const questions = questionsResult.rows;
      if (questions.length !== 20) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Assessment questions are unavailable; start a new test" });
      }
      const validationError = validateAnswers(answers, questions);
      if (validationError) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: validationError });
      }

      const scored = scoreAssessment(questions, answers);
      const correctCount = scored.breakdown.filter((item) => item.correct).length;
      const unansweredCount = questions.filter((question) => !String(answers[question.id] || "").trim()).length;
      const wrongCount = questions.length - correctCount - unansweredCount;
      const totalPoints = questions.reduce((total, question) => total + Number(question.points), 0);
      const earnedPoints = questions.reduce((total, question, index) => total + (scored.breakdown[index].correct ? Number(question.points) : 0), 0);
      const snapshot = questions.map((question) => ({
        id: question.id,
        question_type: question.question_type,
        difficulty: question.difficulty,
        question_text: question.question_text,
        options: question.options,
        correct_answer: question.correct_answer,
        starter_code: question.starter_code,
        points: Number(question.points),
        submitted_answer: answers[question.id] || "",
      }));

      const attempt = await client.query(
        `INSERT INTO assessment_attempts
           (user_id, skill_id, score, classified_level, answers, run_id, correct_count,
            wrong_count, unanswered_count, total_questions, completed, focus_loss_count, question_snapshot)
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,true,$11,$12::jsonb)
         RETURNING *`,
        [authUser.id, skillId, scored.scorePercent, scored.classifiedLevel, JSON.stringify(answers),
          runId, correctCount, wrongCount, unansweredCount, questions.length, run.focus_loss_count, JSON.stringify(snapshot)]
      );
      await client.query(
        `INSERT INTO user_skills (user_id, skill_id, type, level, assessment_score)
         VALUES ($1,$2,'known',$3,$4)
         ON CONFLICT (user_id, skill_id, type)
         DO UPDATE SET level = EXCLUDED.level, assessment_score = EXCLUDED.assessment_score`,
        [authUser.id, skillId, scored.classifiedLevel, scored.scorePercent]
      );
      await client.query("UPDATE assessment_runs SET status = 'completed', completed_at = now() WHERE id = $1", [runId]);
      await client.query("COMMIT");
      return res.status(200).json({
        ...formatAttempt(attempt.rows[0]),
        totalPoints,
        earnedPoints,
        breakdown: publicBreakdown(questions, scored.breakdown, answers),
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Assessment API failed:", error);
    if (error.code === "23505") return res.status(409).json({ error: "An assessment operation conflicted with an existing record" });
    return res.status(500).json({ error: "Assessment request failed. Please try again." });
  }
}
