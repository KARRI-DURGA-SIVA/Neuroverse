const { query } = require("../../../../lib/db");
const { getUserFromReq } = require("../../../../lib/auth");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });
  const { id } = req.query;

  const sessRes = await query(
    `SELECT sess.*, c.title as course_title, s.name as skill_name,
            lu.name as learner_name, mu.name as mentor_name
     FROM sessions sess
     JOIN courses c ON sess.course_id = c.id
     JOIN skills s ON c.skill_id = s.id
     JOIN users lu ON sess.learner_id = lu.id
     JOIN users mu ON sess.mentor_id = mu.id
     WHERE sess.id = $1`,
    [id]
  );
  if (sessRes.rows.length === 0) return res.status(404).json({ error: "Session not found" });
  const session = sessRes.rows[0];

  if (session.learner_id !== authUser.id && session.mentor_id !== authUser.id) {
    return res.status(403).json({ error: "Not part of this session" });
  }

  if (req.method === "GET") {
    const files = await query("SELECT * FROM session_files WHERE session_id = $1 ORDER BY created_at", [id]);
    const messages = await query("SELECT * FROM messages WHERE session_id = $1 ORDER BY created_at", [id]);
    return res.status(200).json({ session, files: files.rows, messages: messages.rows });
  }

  if (req.method === "PATCH") {
    const { status } = req.body;
    const allowed = ["pending", "confirmed", "in_progress", "completed", "cancelled"];
    if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status" });
    const upd = await query("UPDATE sessions SET status = $1 WHERE id = $2 RETURNING *", [status, id]);
    return res.status(200).json({ session: upd.rows[0] });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
