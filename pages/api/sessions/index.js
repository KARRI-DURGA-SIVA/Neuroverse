import { query } from "../../../lib/db";
const { getUserFromReq } = require("../../../lib/auth");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const result = await query(
    `SELECT sess.*, c.title as course_title, s.name as skill_name,
            lu.name as learner_name, mu.name as mentor_name
     FROM sessions sess
     JOIN courses c ON sess.course_id = c.id
     JOIN skills s ON c.skill_id = s.id
     JOIN users lu ON sess.learner_id = lu.id
     JOIN users mu ON sess.mentor_id = mu.id
     WHERE sess.learner_id = $1 OR sess.mentor_id = $1
     ORDER BY sess.scheduled_start DESC`,
    [authUser.id]
  );

  return res.status(200).json({ sessions: result.rows });
}
