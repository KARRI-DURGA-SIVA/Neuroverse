import { getPool } from "../../../../lib/db";
const { getUserFromReq } = require("../../../../lib/auth");
const { createZoomMeeting } = require("../../../../lib/zoom");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { id } = req.query;
  const requestedStart = new Date(req.body?.scheduledStart);
  if (!Number.isFinite(requestedStart.getTime()) || requestedStart <= new Date()) {
    return res.status(400).json({ error: "Choose a future session time" });
  }

  const client = await getPool().connect();
  let booking;
  try {
    await client.query("BEGIN");
    const locked = await client.query("SELECT * FROM sessions WHERE id = $1 FOR UPDATE", [id]);
    const session = locked.rows[0];
    if (!session) throw new Error("Session not found");
    if (String(session.learner_id) !== String(authUser.id)) throw new Error("Only the learner can confirm this schedule");
    if (session.status === "confirmed") {
      await client.query("COMMIT");
      return res.status(200).json({ session, duplicate: true });
    }
    if (session.status === "meeting_pending") {
      if (!session.zoom_meeting_id || !session.meeting_link) {
        await client.query("COMMIT");
        return res.status(202).json({ session, processing: true, message: "Meeting setup is still processing. Do not submit another confirmation." });
      }
      const course = await client.query("SELECT title FROM courses WHERE id = $1", [session.course_id]);
      booking = { ...session, course_title: course.rows[0]?.title || "Tutoring session" };
      await client.query("COMMIT");
    } else {
      if (session.status !== "accepted") throw new Error("The mentor must accept this request before you confirm it");

      const end = new Date(requestedStart.getTime() + Number(session.hours) * 60 * 60 * 1000);
      const overlap = await client.query(
        `SELECT id FROM sessions
         WHERE id != $1 AND status IN ('pending', 'accepted', 'meeting_pending', 'confirmed', 'in_progress')
           AND (learner_id = $2 OR mentor_id = $2 OR learner_id = $3 OR mentor_id = $3)
           AND scheduled_start < $5::timestamptz
           AND scheduled_start + (hours::double precision * interval '1 hour') > $4::timestamptz
         LIMIT 1`,
        [id, session.learner_id, session.mentor_id, requestedStart.toISOString(), end.toISOString()]
      );
      if (overlap.rows.length) throw new Error("This schedule overlaps another pending or booked session");

      const participantIds = [session.learner_id, session.mentor_id].sort((left, right) => Number(left) - Number(right));
      await client.query("SELECT id FROM users WHERE id = ANY($1::bigint[]) ORDER BY id FOR UPDATE", [participantIds]);
      const learner = await client.query("SELECT credits FROM users WHERE id = $1", [session.learner_id]);
      const charge = Number(session.total_charged_to_learner);
      if (Number(learner.rows[0]?.credits) < charge) {
        const error = new Error("Not enough wallet credits. Add credits and confirm again.");
        error.statusCode = 402;
        throw error;
      }

      const attempt = Number(session.payment_attempt || 0) + 1;
      await client.query("UPDATE users SET credits = credits - $1 WHERE id = $2", [charge, session.learner_id]);
      await client.query(
        `INSERT INTO transactions (user_id, type, credits, description)
         VALUES ($1,'spend',$2,$3)`,
        [session.learner_id, -charge, `session:${id}:attempt:${attempt}:spend`]
      );
      const pending = await client.query(
        `UPDATE sessions
         SET status = 'meeting_pending', payment_status = 'debited',
             payment_reference = $2, payment_attempt = $3,
             scheduled_start = $4, zoom_creation_started_at = now()
         WHERE id = $1 RETURNING *`,
        [id, `wallet:session:${id}:attempt:${attempt}`, attempt, requestedStart.toISOString()]
      );
      const course = await client.query("SELECT title FROM courses WHERE id = $1", [session.course_id]);
      booking = { ...pending.rows[0], course_title: course.rows[0]?.title || "Tutoring session" };
      await client.query("COMMIT");
    }
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(error.statusCode || 400).json({ error: error.message });
  } finally {
    client.release();
  }

  let meeting = booking.zoom_meeting_id && booking.meeting_link
    ? { id: booking.zoom_meeting_id, joinUrl: booking.meeting_link }
    : null;
  if (!meeting) {
    try {
      meeting = await createZoomMeeting({
        sessionId: id,
        title: booking.course_title,
        scheduledStart: booking.scheduled_start,
        durationMinutes: Math.round(Number(booking.hours) * 60),
      });
      await getPool().query(
        `UPDATE sessions SET meeting_link = $2, zoom_meeting_id = $3
         WHERE id = $1 AND status = 'meeting_pending'`,
        [id, meeting.joinUrl, meeting.id]
      );
    } catch (error) {
      if (error.definitive) {
        await refundDebitedSession(id, booking);
        return res.status(502).json({ error: `Zoom meeting could not be created. ${error.message}. Wallet credits were refunded.` });
      }
      return res.status(202).json({
        error: "Zoom did not confirm whether the meeting was created. The wallet debit is held for reconciliation; do not retry this booking.",
        processing: true,
      });
    }
  }

  const finalize = await getPool().connect();
  try {
    await finalize.query("BEGIN");
    const current = await finalize.query("SELECT * FROM sessions WHERE id = $1 FOR UPDATE", [id]);
    if (!current.rows[0] || current.rows[0].status !== "meeting_pending") {
      throw new Error("Session changed while the Zoom meeting was being created");
    }
    await finalize.query(
      `UPDATE sessions SET status = 'confirmed', payment_status = 'paid',
         meeting_link = $2, zoom_meeting_id = $3 WHERE id = $1`,
      [id, meeting.joinUrl, meeting.id]
    );
    await finalize.query("UPDATE users SET credits = credits + $1 WHERE id = $2", [current.rows[0].credited_to_mentor, current.rows[0].mentor_id]);
    await finalize.query(
      `INSERT INTO transactions (user_id, type, credits, description)
       VALUES ($1,'earn',$2,$3)`,
      [current.rows[0].mentor_id, current.rows[0].credited_to_mentor, `session:${id}:attempt:${current.rows[0].payment_attempt}:earn`]
    );
    await finalize.query(
      `INSERT INTO notifications (user_id, message, type) VALUES
       ($1,$3,'session_booked'), ($2,$4,'session_booked')`,
      [current.rows[0].learner_id, current.rows[0].mentor_id,
        `Your session is booked. Join the Zoom meeting from your session page.`,
        `The learner confirmed and paid for session ${id}. The Zoom meeting is ready.`]
    );
    const updated = await finalize.query("SELECT * FROM sessions WHERE id = $1", [id]);
    await finalize.query("COMMIT");
    return res.status(200).json({ session: updated.rows[0] });
  } catch (error) {
    await finalize.query("ROLLBACK");
    return res.status(202).json({ error: "Zoom meeting was created, but booking finalization needs reconciliation.", processing: true });
  } finally {
    finalize.release();
  }
}

async function refundDebitedSession(id, booking) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const current = await client.query("SELECT * FROM sessions WHERE id = $1 FOR UPDATE", [id]);
    if (!current.rows[0] || current.rows[0].status !== "meeting_pending") {
      await client.query("ROLLBACK");
      return;
    }
    const attempt = Number(current.rows[0].payment_attempt);
    await client.query("UPDATE users SET credits = credits + $1 WHERE id = $2", [current.rows[0].total_charged_to_learner, current.rows[0].learner_id]);
    await client.query(
      `INSERT INTO transactions (user_id, type, credits, description)
       VALUES ($1,'refund',$2,$3)`,
      [current.rows[0].learner_id, current.rows[0].total_charged_to_learner, `session:${id}:attempt:${attempt}:refund`]
    );
    await client.query(
      `UPDATE sessions SET status = 'accepted', payment_status = 'refunded',
         payment_reference = NULL, zoom_creation_started_at = NULL WHERE id = $1`,
      [id]
    );
    await client.query(
      "INSERT INTO notifications (user_id, message, type) VALUES ($1,$2,'session_payment_refunded')",
      [current.rows[0].learner_id, `Wallet credits for session ${id} were refunded because the Zoom meeting could not be created.`]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}