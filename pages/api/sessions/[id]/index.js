const { query } = require("../../../../lib/db");
const { getPool } = require("../../../../lib/db");
const { getUserFromReq } = require("../../../../lib/auth");
const { v4: uuidv4 } = require("uuid");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });
  const { id } = req.query;

  const sessRes = await query(
    `SELECT sess.*, c.title as course_title, s.name as skill_name,
            lu.name as learner_name, mu.name as mentor_name
     FROM sessions sess
     JOIN courses c ON sess.course_id = c.id
     JOIN skills s ON c.skill_id = s.id
     JOIN users lu ON sess.learner_id = lu.id
     JOIN users mu ON sess.mentor_id = mu.id
     WHERE sess.id = $1`,
    [id]
  );
  if (sessRes.rows.length === 0) return res.status(404).json({ error: "Session not found" });
  const session = sessRes.rows[0];

  if (session.learner_id !== authUser.id && session.mentor_id !== authUser.id) {
    return res.status(403).json({ error: "Not part of this session" });
  }

  if (req.method === "GET") {
    const files = await query("SELECT * FROM session_files WHERE session_id = $1 ORDER BY created_at", [id]);
    const messages = await query("SELECT * FROM messages WHERE session_id = $1 ORDER BY created_at", [id]);
    return res.status(200).json({ session, files: files.rows, messages: messages.rows });
  }

  if (req.method === "PATCH") {
    const { status } = req.body;
    const allowed = ["confirmed", "declined", "cancelled", "completed"];
    if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status" });

    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query("SELECT * FROM sessions WHERE id = $1 FOR UPDATE", [id]);
      const current = locked.rows[0];
      if (!current) throw new Error("Session not found");

      if (status === "confirmed" || status === "declined") {
        if (authUser.id !== current.mentor_id) throw new Error("Only the mentor can respond to this request");
        if (current.status !== "pending") throw new Error("This request has already been handled");

        if (status === "confirmed") {
          const participantIds = [current.learner_id, current.mentor_id].sort();
          await client.query("SELECT id FROM users WHERE id = ANY($1::uuid[]) ORDER BY id FOR UPDATE", [participantIds]);
          const requestedEnd = new Date(new Date(current.scheduled_start).getTime() + Number(current.hours) * 60 * 60 * 1000);
          const overlap = await client.query(
            `SELECT id FROM sessions
             WHERE id != $1 AND status IN ('pending', 'confirmed', 'in_progress')
               AND (learner_id = $2 OR mentor_id = $2 OR learner_id = $3 OR mentor_id = $3)
               AND scheduled_start < $5::timestamptz
               AND scheduled_start + (hours::double precision * interval '1 hour') > $4::timestamptz
             LIMIT 1`,
            [id, current.learner_id, current.mentor_id, current.scheduled_start, requestedEnd.toISOString()]
          );
          if (overlap.rows.length) throw new Error("This time now overlaps another pending or booked session. Please decline this request.");

          const learner = await client.query("SELECT credits FROM users WHERE id = $1 FOR UPDATE", [current.learner_id]);
          if (Number(learner.rows[0].credits) < Number(current.total_charged_to_learner)) {
            throw new Error("The learner no longer has enough credits for this session");
          }

          const course = await client.query("SELECT title FROM courses WHERE id = $1", [current.course_id]);
          const meetingLink = `https://meet.jit.si/neuroverse-${uuidv4()}`;
          await client.query("UPDATE users SET credits = credits - $1 WHERE id = $2", [current.total_charged_to_learner, current.learner_id]);
          await client.query("UPDATE users SET credits = credits + $1 WHERE id = $2", [current.credited_to_mentor, current.mentor_id]);
          await client.query("INSERT INTO transactions (user_id, type, credits, description) VALUES ($1,'spend',$2,$3)", [current.learner_id, -current.total_charged_to_learner, `Booked session ${id} (incl. 10% platform fee)`]);
          await client.query("INSERT INTO transactions (user_id, type, credits, description) VALUES ($1,'earn',$2,$3)", [current.mentor_id, current.credited_to_mentor, `Earned from session ${id} (after 10% platform fee)`]);
          await client.query("UPDATE sessions SET status = 'confirmed', meeting_link = $1 WHERE id = $2", [meetingLink, id]);
          await client.query("INSERT INTO notifications (user_id, message, type) VALUES ($1,$2,'session_booked')", [current.learner_id, `Your request for "${course.rows[0].title}" was accepted. Your session is booked and the meeting link is ready.`]);
        } else {
          await client.query("UPDATE sessions SET status = 'declined' WHERE id = $1", [id]);
          await client.query("INSERT INTO notifications (user_id, message, type) VALUES ($1,$2,'session_declined')", [current.learner_id, "The mentor could not accept your session request. No credits were charged."]);
        }
      } else if (status === "cancelled") {
        if (current.status !== "pending") throw new Error("Confirmed sessions cannot be cancelled. Only pending requests can be withdrawn.");
        if (authUser.id !== current.learner_id && authUser.id !== current.mentor_id) throw new Error("Not part of this session");
        await client.query("UPDATE sessions SET status = 'cancelled' WHERE id = $1", [id]);
        const notifiedUserId = authUser.id === current.learner_id ? current.mentor_id : current.learner_id;
        await client.query("INSERT INTO notifications (user_id, message, type) VALUES ($1,$2,'session_cancelled')", [notifiedUserId, "A pending session request was withdrawn."]);
      } else {
        if (authUser.id !== current.mentor_id) throw new Error("Only the mentor can complete this session");
        if (current.status !== "confirmed" && current.status !== "in_progress") throw new Error("Only an approved session can be completed");
        await client.query("UPDATE sessions SET status = 'completed' WHERE id = $1", [id]);
      }

      const updated = await client.query("SELECT * FROM sessions WHERE id = $1", [id]);
      await client.query("COMMIT");
      return res.status(200).json({ session: updated.rows[0] });
    } catch (err) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: err.message });
    } finally {
      client.release();
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
