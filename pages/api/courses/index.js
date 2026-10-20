import { query, getPool } from "../../../lib/db";
const { getUserFromReq } = require("../../../lib/auth");
const { computeSessionPrice, DEFAULT_BASE_RATE_CREDITS_PER_HOUR, SESSION_LEVEL_FACTORS } = require("../../../lib/pricing");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });

  if (req.method === "GET") {
    const { skillId, mine } = req.query;
    let sql = `
            SELECT c.*, s.name as skill_name, s.category, s.difficulty_factor,
              u.name as mentor_name, u.profile_pic as mentor_profile_pic,
              u.bio as mentor_bio, u.languages as mentor_languages,
             mr.avg_rating, mr.total_reviews
      FROM courses c
      JOIN skills s ON c.skill_id = s.id
      JOIN users u ON c.mentor_id = u.id
      LEFT JOIN mentor_reputation mr ON mr.mentor_id = c.mentor_id
    `;
    const params = [];
    const conditions = ["c.is_active IS NOT FALSE", "u.email NOT LIKE '%@demo.neuroverse.invalid'"];

    if (skillId) {
      params.push(skillId);
      conditions.push(`c.skill_id = $${params.length}`);
    }

    if (mine === "true") {
      params.push(authUser.id);
      conditions.push(`c.mentor_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
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

    return res.status(200).json({ courses, skillLevelFactors: SESSION_LEVEL_FACTORS });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const skillId = String(body.skillId || "");
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const availability = typeof body.availability === "string" ? body.availability.trim() : "";
    const requestKey = String(body.requestKey || "");
    if (!/^\d{1,18}$/.test(skillId)) return res.status(400).json({ error: "A valid skillId is required" });
    if (title.length < 3 || title.length > 120) return res.status(400).json({ error: "Course title must be 3 to 120 characters" });
    if (description.length > 2000) return res.status(400).json({ error: "Course description must be 2000 characters or fewer" });
    if (availability.length > 200) return res.status(400).json({ error: "Availability must be 200 characters or fewer" });
    if (!/^[\w-]{8,100}$/.test(requestKey)) return res.status(400).json({ error: "A valid publication request key is required" });

    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query(
        `SELECT c.id FROM courses c
         WHERE c.mentor_id = $1 AND c.publish_request_key = $2 FOR UPDATE`,
        [authUser.id, requestKey]
      );
      if (existing.rows.length) {
        const course = await getCourseForOwner(client, existing.rows[0].id, authUser.id);
        await client.query("COMMIT");
        return res.status(200).json({ course, duplicate: true });
      }

      const skill = await client.query("SELECT id FROM skills WHERE id = $1", [skillId]);
      if (!skill.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Skill not found" });
      }

      const eligibility = await client.query(
        `SELECT us.level, us.assessment_score, a.id AS attempt_id
         FROM user_skills us
         JOIN LATERAL (
           SELECT id, classified_level
           FROM assessment_attempts
           WHERE user_id = us.user_id AND skill_id = us.skill_id AND completed = true
           ORDER BY created_at DESC, id DESC LIMIT 1
         ) a ON a.classified_level = us.level
         WHERE us.user_id = $1 AND us.skill_id = $2 AND us.type = 'known'
           AND us.level IN ('beginner','intermediate','advanced','expert')
         FOR UPDATE OF us`,
        [authUser.id, skillId]
      );
      if (!eligibility.rows.length) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Complete the skill assessment before publishing a course" });
      }

      const inserted = await client.query(
        `INSERT INTO courses
           (mentor_id, skill_id, title, description, availability_text,
            publish_request_key, mentor_level, base_rate_credits)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (mentor_id, publish_request_key) WHERE publish_request_key IS NOT NULL
         DO NOTHING RETURNING id`,
        [authUser.id, skillId, title, description, availability || null, requestKey,
          eligibility.rows[0].level, DEFAULT_BASE_RATE_CREDITS_PER_HOUR]
      );
      const courseId = inserted.rows[0]?.id;
      if (!courseId) {
        const duplicate = await client.query(
          "SELECT id FROM courses WHERE mentor_id = $1 AND publish_request_key = $2",
          [authUser.id, requestKey]
        );
        const course = await getCourseForOwner(client, duplicate.rows[0].id, authUser.id);
        await client.query("COMMIT");
        return res.status(200).json({ course, duplicate: true });
      }
      const course = await getCourseForOwner(client, courseId, authUser.id);
      await client.query("COMMIT");
      return res.status(201).json({ course });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Course publish failed:", error);
      if (error.code === "23505") return res.status(409).json({ error: "This course publication already exists" });
      if (error.code === "23503") return res.status(400).json({ error: "Selected skill or assessment is no longer available" });
      return res.status(500).json({ error: "Course could not be published. Please try again." });
    } finally {
      client.release();
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

async function getCourseForOwner(client, courseId, userId) {
  const result = await client.query(
    `SELECT c.*, s.name AS skill_name, s.category, s.difficulty_factor,
            u.name AS mentor_name, u.profile_pic AS mentor_profile_pic,
            u.bio AS mentor_bio, u.languages AS mentor_languages,
            mr.avg_rating, mr.total_reviews
     FROM courses c
     JOIN skills s ON s.id = c.skill_id
     JOIN users u ON u.id = c.mentor_id
     LEFT JOIN mentor_reputation mr ON mr.mentor_id = c.mentor_id
     WHERE c.id = $1 AND c.mentor_id = $2`,
    [courseId, userId]
  );
  const course = result.rows[0];
  if (!course) return null;
  const price = computeSessionPrice({
    baseRate: Number(course.base_rate_credits),
    mentorLevel: course.mentor_level,
    skillDifficultyFactor: Number(course.difficulty_factor),
    mentorAvgRating: Number(course.avg_rating),
    mentorTotalReviews: Number(course.total_reviews),
    hours: 1,
  });
  return { ...course, price_per_hour: price.pricePerHour };
}
