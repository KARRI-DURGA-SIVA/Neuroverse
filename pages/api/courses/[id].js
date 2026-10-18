import { query } from "../../../lib/db";
const { getUserFromReq } = require("../../../lib/auth");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: "Course id required" });

  if (req.method === "DELETE") {
    const existing = await query("SELECT id, mentor_id FROM courses WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Course not found" });
    }

    if (existing.rows[0].mentor_id !== authUser.id) {
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

  return res.status(405).json({ error: "Method not allowed" });
}
