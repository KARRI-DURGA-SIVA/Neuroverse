import { getPool } from "../../../lib/db";
const { getUserFromReq } = require("../../../lib/auth");
const { CREDIT_PACKS } = require("../../../lib/pricing");
const { getRazorpayConfig, isRazorpayEnabled, razorpayRequest } = require("../../../lib/razorpay");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const packIndex = Number(req.body?.packIndex);
  const idempotencyKey = String(req.body?.idempotencyKey || "");
  const config = getRazorpayConfig();
  if (!isRazorpayEnabled(config) || config.pricesInr.length !== CREDIT_PACKS.length) {
    return res.status(503).json({ error: "Razorpay wallet payments are not configured." });
  }
  if (!Number.isInteger(packIndex) || !CREDIT_PACKS[packIndex]) {
    return res.status(400).json({ error: "Invalid credit pack" });
  }
  if (!/^[\w-]{8,100}$/.test(idempotencyKey)) {
    return res.status(400).json({ error: "A valid idempotency key is required" });
  }

  const client = await getPool().connect();
  let topup;
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO wallet_topups (user_id, idempotency_key, pack_index, credits, amount_paise)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id, idempotency_key) DO NOTHING
       RETURNING *`,
      [authUser.id, idempotencyKey, packIndex, CREDIT_PACKS[packIndex].credits, Math.round(config.pricesInr[packIndex] * 100)]
    );
    if (inserted.rows.length) {
      topup = inserted.rows[0];
    } else {
      const existing = await client.query(
        "SELECT * FROM wallet_topups WHERE user_id = $1 AND idempotency_key = $2 FOR UPDATE",
        [authUser.id, idempotencyKey]
      );
      topup = existing.rows[0];
      if (topup.pack_index !== packIndex) throw new Error("Idempotency key was already used for another pack");
      if (topup.order_id) {
        await client.query("COMMIT");
        return res.status(200).json({
          keyId: config.keyId,
          configId: config.configId,
          orderId: topup.order_id,
          amount: topup.amount_paise,
          currency: "INR",
          credits: Number(topup.credits),
        });
      }
      if (topup.status !== "creating") throw new Error("This checkout attempt cannot be reused");
      throw new Error("This checkout attempt is still being prepared. Retry with a new checkout attempt.");
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(error.message.includes("Idempotency") ? 409 : 400).json({ error: error.message });
  } finally {
    client.release();
  }

  try {
    const order = await razorpayRequest("/orders", {
      method: "POST",
      body: {
        amount: topup.amount_paise,
        currency: "INR",
        receipt: `wallet-${topup.id}`,
        notes: { user_id: String(authUser.id), topup_id: String(topup.id) },
      },
    });
    await queryUpdateOrder(topup.id, order.id);
    return res.status(201).json({
      keyId: config.keyId,
      configId: config.configId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      credits: Number(topup.credits),
    });
  } catch (error) {
    const pool = getPool();
    await pool.query("UPDATE wallet_topups SET status = 'failed', updated_at = now() WHERE id = $1 AND status = 'creating'", [topup.id]);
    return res.status(502).json({ error: error.message || "Could not create Razorpay order" });
  }
}

async function queryUpdateOrder(topupId, orderId) {
  await getPool().query(
    "UPDATE wallet_topups SET order_id = $1, status = 'created', updated_at = now() WHERE id = $2 AND status = 'creating'",
    [orderId, topupId]
  );
}