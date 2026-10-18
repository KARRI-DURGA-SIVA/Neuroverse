import { query } from "../../../lib/db";
const { getUserFromReq } = require("../../../lib/auth");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });

  if (req.method === "GET") {
    const result = await query(
      `SELECT us.*, s.name as skill_name, s.category, s.test_type
       FROM user_skills us JOIN skills s ON us.skill_id = s.id
       WHERE us.user_id = $1 ORDER BY us.type, s.name`,
      [authUser.id]
    );
    return res.status(200).json({ skills: result.rows });
  }

  if (req.method === "POST") {
    // body: { known: [skillId,...], learning: [{skillId, desiredLevel}, ...] }
    const { known = [], learning = [] } = req.body;

    try {
      for (const skillId of known) {
        await query(
          `INSERT INTO user_skills (user_id, skill_id, type)
           VALUES ($1, $2, 'known')
           ON CONFLICT (user_id, skill_id, type) DO NOTHING`,
          [authUser.id, skillId]
        );
      }
      for (const item of learning) {
        await query(
          `INSERT INTO user_skills (user_id, skill_id, type, desired_level)
           VALUES ($1, $2, 'learning', $3)
           ON CONFLICT (user_id, skill_id, type) DO UPDATE SET desired_level = $3`,
          [authUser.id, item.skillId, item.desiredLevel || "intermediate"]
        );
      }
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to save skills", details: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
