const { query } = require("../../../lib/db");
const { getUserFromReq } = require("../../../lib/auth");
const { scoreAssessment } = require("../../../lib/classification");
const { generateLocalAssessmentQuestions } = require("../../../lib/local-assessment-generator");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });

  const { skillId } = req.query;

  const skillRes = await query("SELECT * FROM skills WHERE id = $1", [skillId]);
  if (skillRes.rows.length === 0) return res.status(404).json({ error: "Skill not found" });
  const skill = skillRes.rows[0];

  if (req.method === "POST" && req.body?.action === "generate") {
    try {
      const questions = generateLocalAssessmentQuestions(skill);
      await query("DELETE FROM assessment_questions WHERE skill_id = $1", [skillId]);
      for (const question of questions) {
        await query(
          `INSERT INTO assessment_questions
           (skill_id, question_type, difficulty, question_text, options, correct_answer, starter_code, points)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [skillId, question.question_type, question.difficulty, question.question_text,
            question.options ? JSON.stringify(question.options) : null, question.correct_answer,
            question.starter_code, question.points]
        );
      }
      return res.status(200).json({ skill, questions });
    } catch (err) {
      console.error("Assessment generation failed:", err);
      return res.status(502).json({ error: err.message || "Could not generate assessment" });
    }
  }

  if (req.method === "GET") {
    // Return a balanced set of questions across difficulty levels for this skill.
    const qRes = await query(
      "SELECT id, question_type, difficulty, question_text, options, starter_code, points FROM assessment_questions WHERE skill_id = $1 ORDER BY difficulty",
      [skillId]
    );

    return res.status(200).json({ skill, questions: qRes.rows });
  }

  if (req.method === "POST") {
    // body: { answers: { [questionId]: answerText } }
    const { answers = {} } = req.body;

    const qRes = await query(
      "SELECT * FROM assessment_questions WHERE skill_id = $1",
      [skillId]
    );
    if (qRes.rows.length === 0) {
      return res.status(400).json({ error: "No assessment questions configured for this skill yet" });
    }

    const { scorePercent, classifiedLevel, breakdown } = scoreAssessment(qRes.rows, answers);

    await query(
      `INSERT INTO assessment_attempts (user_id, skill_id, score, classified_level, answers)
       VALUES ($1, $2, $3, $4, $5)`,
      [authUser.id, skillId, scorePercent, classifiedLevel, JSON.stringify(answers)]
    );

    await query(
      `INSERT INTO user_skills (user_id, skill_id, type, level, assessment_score)
       VALUES ($1, $2, 'known', $3, $4)
       ON CONFLICT (user_id, skill_id, type)
       DO UPDATE SET level = $3, assessment_score = $4`,
      [authUser.id, skillId, classifiedLevel, scorePercent]
    );

    return res.status(200).json({ scorePercent, classifiedLevel, breakdown });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
