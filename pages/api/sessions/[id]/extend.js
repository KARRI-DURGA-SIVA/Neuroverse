import { getPool } from "../../../../lib/db";
const { getUserFromReq } = require("../../../../lib/auth");
const { updateZoomMeetingDuration } = require("../../../../lib/zoom");
const { PLATFORM_FEE_RATE } = require("../../../../lib/pricing");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const sessionId = req.query.id;
  const extraMinutes = Number(req.body?.extraMinutes);
  const idempotencyKey = String(req.body?.idempotencyKey || "");
  if (!Number.isInteger(extraMinutes) || extraMinutes < 15 || extraMinutes > 120 || extraMinutes % 15 !== 0) {
    return res.status(400).json({ error: "Extension must be 15 to 120 minutes in 15-minute increments" });
  }
  if (!/^[\w-]{8,100}$/.test(idempotencyKey)) {
    return res.status(400).json({ error: "A valid idempotency key is required" });
  }

  const client = await getPool().connect();
  let extension;
  try {
    await client.query("BEGIN");
    const result = await client.query("SELECT * FROM sessions WHERE id = $1 FOR UPDATE", [sessionId]);
    const session = result.rows[0];
    if (!session) throw new Error("Session not found");
    if (String(session.learner_id) !== String(authUser.id)) throw new Error("Only the learner can extend this session");
    if (session.status !== "confirmed" && session.status !== "in_progress") throw new Error("Only a booked session can be extended");
    if (!session.zoom_meeting_id) throw new Error("The Zoom meeting is not available for extension");
    const sessionStart = new Date(session.scheduled_start).getTime();
    const currentEnd = sessionStart + Number(session.hours) * 60 * 60 * 1000;
    if (Date.now() < sessionStart || Date.now() >= currentEnd) throw new Error("A session can only be extended during its scheduled time");
    const extendedDuration = Number(session.hours) * 60 + extraMinutes;
    if (extendedDuration > 1440) throw new Error("A Zoom session cannot exceed 24 hours");

    const existingResult = await client.query(
      "SELECT * FROM session_extensions WHERE session_id = $1 AND idempotency_key = $2 FOR UPDATE",
      [sessionId, idempotencyKey]
    );
    if (existingResult.rows.length) {
      const existing = existingResult.rows[0];
      if (Number(existing.extra_minutes) !== extraMinutes) throw new Error("Idempotency key was already used for another extension");
      await client.query("COMMIT");
      if (existing.status === "completed") return res.status(200).json({ session, duplicate: true });
      if (existing.status === "processing") return res.status(202).json({ processing: true, message: "This extension is already processing" });
      throw new Error("This extension attempt cannot be reused");
    }

    const pendingResult = await client.query(
      "SELECT id FROM session_extensions WHERE session_id = $1 AND status = 'processing' LIMIT 1",
      [sessionId]
    );
    if (pendingResult.rows.length) throw new Error("Another session extension is still processing");

    const newEnd = new Date(new Date(session.scheduled_start).getTime() + extendedDuration * 60_000);
    const overlap = await client.query(
      `SELECT id FROM sessions
       WHERE id != $1 AND status IN ('pending', 'accepted', 'meeting_pending', 'confirmed', 'in_progress')
         AND (learner_id = $2 OR mentor_id = $2 OR learner_id = $3 OR mentor_id = $3)
         AND scheduled_start < $5::timestamptz
         AND scheduled_start + (hours::double precision * interval '1 hour') > $4::timestamptz
       LIMIT 1`,
      [sessionId, session.learner_id, session.mentor_id, session.scheduled_start, newEnd.toISOString()]
    );
    if (overlap.rows.length) throw new Error("This extension would overlap another participant booking");

    const baseCredits = round2(Number(session.price_per_hour) * extraMinutes / 60);
    const fee = round2(baseCredits * PLATFORM_FEE_RATE);
    const charge = round2(baseCredits + fee);
    const mentorCredits = round2(baseCredits - fee);
    const learner = await client.query("SELECT credits FROM users WHERE id = $1 FOR UPDATE", [session.learner_id]);
    if (Number(learner.rows[0]?.credits) < charge) {
      const error = new Error("Not enough wallet credits to extend this session");
      error.statusCode = 402;
      throw error;
    }

    await client.query("UPDATE users SET credits = credits - $1 WHERE id = $2", [charge, session.learner_id]);
    await client.query(
      `INSERT INTO transactions (user_id, type, credits, description)
       VALUES ($1,'spend',$2,$3)`,
      [session.learner_id, -charge, `session:${sessionId}:extension:${idempotencyKey}:spend`]
    );
    const created = await client.query(
      `INSERT INTO session_extensions
        (session_id, learner_id, idempotency_key, extra_minutes, base_credits,
         platform_fee_credits, charge_credits, mentor_credits)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [sessionId, session.learner_id, idempotencyKey, extraMinutes, baseCredits, fee, charge, mentorCredits]
    );
    extension = { ...created.rows[0], zoomMeetingId: session.zoom_meeting_id, newDuration: extendedDuration };
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(error.statusCode || (error.message.includes("Idempotency") ? 409 : 400)).json({ error: error.message });
  } finally {
    client.release();
  }

  try {
    await updateZoomMeetingDuration(extension.zoomMeetingId, extension.newDuration);
  } catch (error) {
    if (error.definitive) {
      await refundExtension(sessionId, extension);
      return res.status(502).json({ error: `Zoom rejected the extension. Wallet credits were refunded. ${error.message}` });
    }
    return res.status(202).json({ processing: true, error: "Zoom did not confirm the extension update. The wallet debit is held for reconciliation; do not retry." });
  }

  const finalize = await getPool().connect();
  try {
    await finalize.query("BEGIN");
    const lockedExtension = await finalize.query(
      "SELECT * FROM session_extensions WHERE id = $1 FOR UPDATE",
      [extension.id]
    );
    if (lockedExtension.rows[0]?.status !== "processing") throw new Error("Extension state changed during Zoom update");
    const sessionResult = await finalize.query("SELECT * FROM sessions WHERE id = $1 FOR UPDATE", [sessionId]);
    const session = sessionResult.rows[0];
    await finalize.query(
      `UPDATE sessions SET hours = hours + $2 / 60.0,
         base_credits = base_credits + $3,
         platform_fee_credits = platform_fee_credits + $4,
         total_charged_to_learner = total_charged_to_learner + $5,
         credited_to_mentor = credited_to_mentor + $6
       WHERE id = $1`,
      [sessionId, extraMinutes, extension.base_credits, extension.platform_fee_credits, extension.charge_credits, extension.mentor_credits]
    );
    await finalize.query("UPDATE users SET credits = credits + $1 WHERE id = $2", [extension.mentor_credits, session.mentor_id]);
    await finalize.query(
      `INSERT INTO transactions (user_id, type, credits, description)
       VALUES ($1,'earn',$2,$3)`,
      [session.mentor_id, extension.mentor_credits, `session:${sessionId}:extension:${idempotencyKey}:earn`]
    );
    await finalize.query("UPDATE session_extensions SET status = 'completed', updated_at = now() WHERE id = $1", [extension.id]);
    await finalize.query("COMMIT");
    const updated = await finalize.query("SELECT * FROM sessions WHERE id = $1", [sessionId]);
    return res.status(200).json({ session: updated.rows[0] });
  } catch (error) {
    await finalize.query("ROLLBACK");
    return res.status(202).json({ processing: true, error: "Zoom was extended, but wallet ledger finalization needs reconciliation." });
  } finally {
    finalize.release();
  }
}

async function refundExtension(sessionId, extension) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query("SELECT * FROM session_extensions WHERE id = $1 FOR UPDATE", [extension.id]);
    if (locked.rows[0]?.status !== "processing") {
      await client.query("ROLLBACK");
      return;
    }
    await client.query("UPDATE users SET credits = credits + $1 WHERE id = $2", [extension.charge_credits, extension.learner_id]);
    await client.query(
      `INSERT INTO transactions (user_id, type, credits, description)
       VALUES ($1,'refund',$2,$3)`,
      [extension.learner_id, extension.charge_credits, `session:${sessionId}:extension:${extension.idempotency_key}:refund`]
    );
    await client.query("UPDATE session_extensions SET status = 'refunded', updated_at = now() WHERE id = $1", [extension.id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function round2(value) {
  return Math.round(value * 100) / 100;
}