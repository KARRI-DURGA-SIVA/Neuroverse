import { getPool } from "../../../lib/db";
const { getUserFromReq } = require("../../../lib/auth");
const { CREDIT_PACKS } = require("../../../lib/pricing");
const { getRazorpayConfig, verifyCheckoutSignature, razorpayRequest } = require("../../../lib/razorpay");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { orderId, paymentId, signature } = req.body || {};
  const config = getRazorpayConfig();
  if (!orderId || !paymentId || !signature || !config.keySecret) {
    return res.status(400).json({ error: "Payment verification details are required" });
  }
  if (!verifyCheckoutSignature(orderId, paymentId, signature, config.keySecret)) {
    return res.status(400).json({ error: "Invalid Razorpay payment signature" });
  }

  let payment;
  try {
    payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);
  } catch (error) {
    return res.status(502).json({ error: "Could not verify payment with Razorpay. Please retry." });
  }
  if (payment.order_id !== orderId || payment.status !== "captured" || payment.currency !== "INR"
    || !["upi", "netbanking"].includes(payment.method)) {
    return res.status(400).json({ error: "Payment is not captured or does not match this order" });
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const topupResult = await client.query(
      "SELECT * FROM wallet_topups WHERE user_id = $1 AND order_id = $2 FOR UPDATE",
      [authUser.id, orderId]
    );
    const topup = topupResult.rows[0];
    if (!topup) throw new Error("Wallet order not found for this account");
    if (Number(payment.amount) !== Number(topup.amount_paise)
      || Number(topup.credits) !== Number(CREDIT_PACKS[topup.pack_index]?.credits)) {
      throw new Error("Payment amount does not match the wallet order");
    }
    if (topup.status === "credited") {
      const balance = await client.query("SELECT credits FROM users WHERE id = $1", [authUser.id]);
      await client.query("COMMIT");
      return res.status(200).json({ credits: balance.rows[0].credits, duplicate: true });
    }
    if (topup.status !== "created") throw new Error("Wallet order is not eligible for crediting");

    await client.query("UPDATE users SET credits = credits + $1 WHERE id = $2", [topup.credits, authUser.id]);
    await client.query(
      `INSERT INTO transactions (user_id, type, credits, description)
       VALUES ($1,'purchase',$2,$3)`,
      [authUser.id, topup.credits, `razorpay:${paymentId}`]
    );
    await client.query(
      `UPDATE wallet_topups SET payment_id = $1, status = 'credited', updated_at = now()
       WHERE id = $2`,
      [paymentId, topup.id]
    );
    const balance = await client.query("SELECT credits FROM users WHERE id = $1", [authUser.id]);
    await client.query("COMMIT");
    return res.status(200).json({ credits: balance.rows[0].credits, duplicate: false });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
}