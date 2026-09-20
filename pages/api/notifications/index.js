const { query } = require("../../../lib/db");
const { getUserFromReq } = require("../../../lib/auth");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });

  if (req.method === "GET") {
    const result = await query(
      "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
      [authUser.id]
    );
    return res.status(200).json({ notifications: result.rows });
  }

  if (req.method === "PATCH") {
    const { id } = req.body;
    if (id) {
      await query("UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2", [id, authUser.id]);
    } else {
      await query("UPDATE notifications SET is_read = true WHERE user_id = $1", [authUser.id]);
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
