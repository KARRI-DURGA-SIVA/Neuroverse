import { query } from "../../../lib/db";
const { getUserFromReq } = require("../../../lib/auth");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const userRes = await query("SELECT credits, name FROM users WHERE id = $1", [authUser.id]);
  const credits = userRes.rows[0]?.credits || 0;

  const upcoming = await query(
    `SELECT sess.*, c.title as course_title, s.name as skill_name, mu.name as mentor_name
     FROM sessions sess
     JOIN courses c ON sess.course_id = c.id
     JOIN skills s ON c.skill_id = s.id
     JOIN users mu ON sess.mentor_id = mu.id
    WHERE sess.learner_id = $1 AND sess.scheduled_start > now() AND sess.status IN ('confirmed', 'in_progress')
     ORDER BY sess.scheduled_start ASC LIMIT 5`,
    [authUser.id]
  );

  const learningSkills = await query(
    `SELECT us.*, s.name as skill_name FROM user_skills us JOIN skills s ON us.skill_id = s.id
     WHERE us.user_id = $1 AND us.type = 'learning'`,
    [authUser.id]
  );

  const knownSkills = await query(
    `SELECT us.*, s.name as skill_name FROM user_skills us JOIN skills s ON us.skill_id = s.id
     WHERE us.user_id = $1 AND us.type = 'known'`,
    [authUser.id]
  );

  // Recommend skills: popular skills the user hasn't already selected as known or learning
  const knownIds = [...knownSkills.rows, ...learningSkills.rows].map((s) => s.skill_id);
  const recSkillsRes = await query(
    `SELECT s.*, COUNT(c.id) FILTER (WHERE u.email IS NULL OR u.email NOT LIKE '%@demo.neuroverse.invalid') as mentor_count FROM skills s
     LEFT JOIN courses c ON c.skill_id = s.id
     LEFT JOIN users u ON c.mentor_id = u.id
    WHERE s.id != ALL($1::bigint[])
     GROUP BY s.id ORDER BY mentor_count DESC LIMIT 6`,
      [knownIds.length ? knownIds : ["0"]]
  );

  // Recommended mentors: top-rated mentors teaching the learner's "learning" skills
  let recMentors = { rows: [] };
  if (learningSkills.rows.length > 0) {
    const learningSkillIds = learningSkills.rows.map((s) => s.skill_id);
    recMentors = await query(
      `SELECT c.id as course_id, c.title, u.name as mentor_name, u.profile_pic, s.name as skill_name,
              mr.avg_rating, mr.total_reviews
       FROM courses c
       JOIN users u ON c.mentor_id = u.id
       JOIN skills s ON c.skill_id = s.id
       LEFT JOIN mentor_reputation mr ON mr.mentor_id = c.mentor_id
      WHERE c.skill_id = ANY($1::bigint[]) AND c.mentor_id != $2
         AND u.email NOT LIKE '%@demo.neuroverse.invalid'
       ORDER BY mr.avg_rating DESC NULLS LAST LIMIT 6`,
      [learningSkillIds, authUser.id]
    );
  }

  // Performance: avg assessment score + completed sessions count
  const perf = await query(
    `SELECT
      (SELECT COUNT(*) FROM sessions WHERE learner_id = $1 AND status = 'completed') as sessions_completed,
      (SELECT COALESCE(AVG(score),0) FROM assessment_attempts WHERE user_id = $1) as avg_assessment_score,
      (SELECT COALESCE(AVG(rating),0) FROM reviews r JOIN sessions s ON r.session_id = s.id WHERE s.mentor_id = $1) as mentor_avg_rating`,
    [authUser.id]
  );

  return res.status(200).json({
    credits,
    upcomingSessions: upcoming.rows,
    continueLearning: learningSkills.rows,
    knownSkills: knownSkills.rows,
    recommendedSkills: recSkillsRes.rows,
    recommendedMentors: recMentors.rows,
    performance: perf.rows[0],
  });
}
