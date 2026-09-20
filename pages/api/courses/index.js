const { query } = require("../../../lib/db");
const { getUserFromReq } = require("../../../lib/auth");
const { computeSessionPrice, DEFAULT_BASE_RATE_CREDITS_PER_HOUR } = require("../../../lib/pricing");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });

  if (req.method === "GET") {
    const { skillId } = req.query;
    let sql = `
      SELECT c.*, s.name as skill_name, s.difficulty_factor, u.name as mentor_name,
             mr.avg_rating, mr.total_reviews
      FROM courses c
      JOIN skills s ON c.skill_id = s.id
      JOIN users u ON c.mentor_id = u.id
      LEFT JOIN mentor_reputation mr ON mr.mentor_id = c.mentor_id
    `;
    const params = [];
    if (skillId) {
      sql += " WHERE c.skill_id = $1";
      params.push(skillId);
    }
    sql += " ORDER BY c.created_at DESC";
    const result = await query(sql, params);

    const courses = result.rows.map((c) => {
      const price = computeSessionPrice({
        mentorLevel: c.mentor_level,
        skillDifficultyFactor: Number(c.difficulty_factor),
        mentorAvgRating: Number(c.avg_rating),
        mentorTotalReviews: Number(c.total_reviews),
        hours: 1,
      });
      return { ...c, price_per_hour: price.pricePerHour };
    });

    return res.status(200).json({ courses });
  }

  if (req.method === "POST") {
    // A user can only teach a skill they've been classified for via assessment.
    const { skillId, title, description } = req.body;
    if (!skillId || !title) return res.status(400).json({ error: "skillId and title required" });

    const skillLevel = await query(
      `SELECT level FROM user_skills WHERE user_id = $1 AND skill_id = $2 AND type = 'known'`,
      [authUser.id, skillId]
    );
    if (skillLevel.rows.length === 0 || !skillLevel.rows[0].level || skillLevel.rows[0].level === "not_assessed") {
      return res.status(400).json({
        error: "You must complete the skill assessment for this skill before publishing a course",
      });
    }

    const result = await query(
      `INSERT INTO courses (mentor_id, skill_id, title, description, mentor_level, base_rate_credits)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [authUser.id, skillId, title, description || "", skillLevel.rows[0].level, DEFAULT_BASE_RATE_CREDITS_PER_HOUR]
    );

    return res.status(201).json({ course: result.rows[0] });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
