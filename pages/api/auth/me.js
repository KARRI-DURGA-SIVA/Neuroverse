const { getUserFromReq } = require("../../../lib/auth");
const { query } = require("../../../lib/db");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });

  const result = await query(
    "SELECT id, name, email, age, profile_pic, languages, bio, credits, created_at FROM users WHERE id = $1",
    [authUser.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: "User not found" });

  return res.status(200).json({ user: result.rows[0] });
}
