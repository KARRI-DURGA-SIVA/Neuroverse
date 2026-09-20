const { query } = require("../../../lib/db");
const { getUserFromReq } = require("../../../lib/auth");
const { CREDIT_PACKS } = require("../../../lib/pricing");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });

  if (req.method === "GET") {
    return res.status(200).json({ packs: CREDIT_PACKS });
  }

  if (req.method === "POST") {
    // In production this would go through a real payment provider (Stripe etc.)
    // before crediting the account. Here we simulate a successful purchase.
    const { packIndex } = req.body;
    const pack = CREDIT_PACKS[packIndex];
    if (!pack) return res.status(400).json({ error: "Invalid credit pack" });

    await query("UPDATE users SET credits = credits + $1 WHERE id = $2", [pack.credits, authUser.id]);
    await query(
      `INSERT INTO transactions (user_id, type, credits, description) VALUES ($1,'purchase',$2,$3)`,
      [authUser.id, pack.credits, `Purchased ${pack.credits} credits for $${pack.priceUSD}`]
    );

    const result = await query("SELECT credits FROM users WHERE id = $1", [authUser.id]);
    return res.status(200).json({ credits: result.rows[0].credits });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
