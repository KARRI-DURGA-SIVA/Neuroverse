import { query } from "../../../../lib/db";
const { getUserFromReq } = require("../../../../lib/auth");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });
  const { id } = req.query;

  if (req.method === "GET") {
    const result = await query("SELECT * FROM messages WHERE session_id = $1 ORDER BY created_at", [id]);
    return res.status(200).json({ messages: result.rows });
  }

  if (req.method === "POST") {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: "content required" });
    const result = await query(
      "INSERT INTO messages (session_id, sender_id, content) VALUES ($1,$2,$3) RETURNING *",
      [id, authUser.id, content]
    );
    return res.status(201).json({ message: result.rows[0] });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
