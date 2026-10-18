import { query } from "../../../lib/db";
const { getUserFromReq } = require("../../../lib/auth");
const { CREDIT_PACKS } = require("../../../lib/pricing");

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  const Stripe = require("stripe");
  return new Stripe(secretKey, { apiVersion: "2024-06-20" });
}

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });

  if (req.method === "GET") {
    return res.status(200).json({ packs: CREDIT_PACKS, paymentEnabled: Boolean(process.env.STRIPE_SECRET_KEY) });
  }

  if (req.method === "POST") {
    const { packIndex, paymentSource, sessionId } = req.body;
    const pack = CREDIT_PACKS[packIndex];
    if (!pack) return res.status(400).json({ error: "Invalid credit pack" });

    const stripe = getStripe();
    if (paymentSource === "checkout") {
      if (!stripe || !sessionId) return res.status(400).json({ error: "Payment session could not be verified." });

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "paid" || session.metadata?.userId !== authUser.id
        || session.metadata?.packIndex !== String(packIndex)) {
        return res.status(400).json({ error: "Payment has not been completed or does not match this account." });
      }

      const reference = `stripe:${session.id}`;
      const existing = await query(
        "SELECT credits FROM transactions WHERE user_id = $1 AND description = $2 LIMIT 1",
        [authUser.id, reference]
      );
      if (existing.rows.length > 0) {
        const result = await query("SELECT credits FROM users WHERE id = $1", [authUser.id]);
        return res.status(200).json({ credits: result.rows[0].credits, paymentEnabled: true, mode: "stripe" });
      }

      await query("UPDATE users SET credits = credits + $1 WHERE id = $2", [pack.credits, authUser.id]);
      await query(
        `INSERT INTO transactions (user_id, type, credits, description) VALUES ($1,'purchase',$2,$3)`,
        [authUser.id, pack.credits, reference]
      );
      const result = await query("SELECT credits FROM users WHERE id = $1", [authUser.id]);
      return res.status(200).json({ credits: result.rows[0].credits, paymentEnabled: true, mode: "stripe" });
    }

    if (stripe && paymentSource !== "demo") {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url: `${appUrl}/wallet?checkout=success&packIndex=${encodeURIComponent(packIndex)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/wallet?checkout=cancelled`,
        customer_email: authUser.email,
        line_items: [{
          price_data: {
            currency: "usd",
            product_data: { name: `${pack.credits} NeuroVerse Credits` },
            unit_amount: Math.round(pack.priceUSD * 100),
          },
          quantity: 1,
        }],
        metadata: {
          userId: authUser.id,
          packIndex: String(packIndex),
          credits: String(pack.credits),
        },
      });

      return res.status(200).json({ checkoutUrl: session.url, paymentEnabled: true, mode: "stripe" });
    }

    if (paymentSource !== "demo") {
      return res.status(503).json({ error: "Payments are not configured yet. Add STRIPE_SECRET_KEY to enable credit purchases." });
    }

    if (process.env.NODE_ENV === "production") {
      return res.status(503).json({ error: "Demo credit purchases are disabled in production. Configure a payment provider to buy credits." });
    }

    await query("UPDATE users SET credits = credits + $1 WHERE id = $2", [pack.credits, authUser.id]);
    await query(
      `INSERT INTO transactions (user_id, type, credits, description) VALUES ($1,'purchase',$2,$3)`,
      [authUser.id, pack.credits, `Purchased ${pack.credits} credits for $${pack.priceUSD}`]
    );

    const result = await query("SELECT credits FROM users WHERE id = $1", [authUser.id]);
    return res.status(200).json({ credits: result.rows[0].credits, paymentEnabled: Boolean(process.env.STRIPE_SECRET_KEY), mode: "demo" });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
