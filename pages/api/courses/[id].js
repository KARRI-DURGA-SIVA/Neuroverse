import { query } from "../../../lib/db";
const { getUserFromReq } = require("../../../lib/auth");
const { computeSessionPrice } = require("../../../lib/pricing");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });

  const { id } = req.query;
  if (!/^\d{1,18}$/.test(String(id || ""))) return res.status(400).json({ error: "Valid course id required" });

  if (req.method === "GET") {
    const result = await query(
      `SELECT c.*, s.name AS skill_name, s.category, s.difficulty_factor,
              u.name AS mentor_name, u.profile_pic AS mentor_profile_pic,
              u.bio AS mentor_bio, u.languages AS mentor_languages,
              mr.avg_rating, mr.total_reviews
       FROM courses c
       JOIN skills s ON s.id = c.skill_id
       JOIN users u ON u.id = c.mentor_id
       LEFT JOIN mentor_reputation mr ON mr.mentor_id = c.mentor_id
       WHERE c.id = $1 AND c.is_active IS NOT FALSE
         AND u.email NOT LIKE '%@demo.neuroverse.invalid'`,
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Course not found" });
    const course = result.rows[0];
    const price = computeSessionPrice({
      baseRate: Number(course.base_rate_credits),
      mentorLevel: course.mentor_level,
      skillDifficultyFactor: Number(course.difficulty_factor),
      mentorAvgRating: Number(course.avg_rating),
      mentorTotalReviews: Number(course.total_reviews),
      hours: 1,
    });
    return res.status(200).json({ course: { ...course, price_per_hour: price.pricePerHour } });
  }

  if (req.method === "DELETE") {
    const existing = await query("SELECT id, mentor_id FROM courses WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }

    if (String(existing.rows[0].mentor_id) !== String(authUser.id)) {
      return res.status(403).json({ error: "You can only withdraw your own course" });
    }

    const updated = await query(
      "UPDATE courses SET is_active = FALSE WHERE id = $1 AND mentor_id = $2 RETURNING *",
      [id, authUser.id]
    );

    return res.status(200).json({
      course: updated.rows[0],
      message: "Course withdrawn successfully",
    });
  }

  res.setHeader("Allow", "GET, DELETE");

  return res.status(405).json({ error: "Method not allowed" });
}
