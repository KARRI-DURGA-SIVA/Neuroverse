import { query } from "../../../lib/db";
const { getUserFromReq } = require("../../../lib/auth");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const result = await query(
    "SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100",
    [authUser.id]
  );
  return res.status(200).json({ transactions: result.rows });
}
