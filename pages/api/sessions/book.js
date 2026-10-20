import { query, getPool } from "../../../lib/db";
const { getUserFromReq } = require("../../../lib/auth");
const { computeSessionPrice } = require("../../../lib/pricing");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // body: { courseId, hours, scheduledStart, skillLevel, requestKey }
  const { courseId, hours, scheduledStart, skillLevel, requestKey } = req.body;
  if (!courseId || !hours || !scheduledStart || !skillLevel || !requestKey) {
    return res.status(400).json({ error: "courseId, hours, scheduledStart, skillLevel and requestKey are required" });
  }
  if (!["beginner", "intermediate", "advanced", "expert"].includes(skillLevel)) {
    return res.status(400).json({ error: "Invalid session skill level" });
  }
  if (!/^[\w-]{8,100}$/.test(String(requestKey))) {
    return res.status(400).json({ error: "A valid request key is required" });
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingRequest = await client.query(
      "SELECT * FROM sessions WHERE learner_id = $1 AND request_key = $2 FOR UPDATE",
      [authUser.id, requestKey]
    );
    if (existingRequest.rows.length) {
      await client.query("COMMIT");
      return res.status(200).json({ session: existingRequest.rows[0], duplicate: true });
    }

    const courseRes = await client.query(
      `SELECT c.*, s.difficulty_factor, mr.avg_rating, mr.total_reviews, mentor.email as mentor_email
       FROM courses c
       JOIN skills s ON c.skill_id = s.id
       JOIN users mentor ON mentor.id = c.mentor_id
       LEFT JOIN mentor_reputation mr ON mr.mentor_id = c.mentor_id
       WHERE c.id = $1
       FOR UPDATE OF c`,
      [courseId]
    );
    if (courseRes.rows.length === 0) throw new Error("Course not found");
    const course = courseRes.rows[0];

    if (course.mentor_id === authUser.id) throw new Error("You cannot book your own course");
    if (course.mentor_email.endsWith("@demo.neuroverse.invalid")) throw new Error("Sample courses cannot be booked");
    if (!Number.isFinite(Number(hours)) || Number(hours) < 0.5 || Number(hours) > 8) {
      throw new Error("Session duration must be between 0.5 and 8 hours");
    }
    if (!Number.isFinite(Date.parse(scheduledStart)) || new Date(scheduledStart) <= new Date()) {
      throw new Error("Choose a future session time");
    }

    const participantIds = [authUser.id, course.mentor_id].sort();
    await client.query("SELECT id FROM users WHERE id = ANY($1::bigint[]) ORDER BY id FOR UPDATE", [participantIds]);

    const requestedStart = new Date(scheduledStart);
    const requestedEnd = new Date(requestedStart.getTime() + Number(hours) * 60 * 60 * 1000);
    const overlap = await client.query(
      `SELECT id FROM sessions
      WHERE status IN ('pending', 'accepted', 'meeting_pending', 'confirmed', 'in_progress')
         AND (learner_id = $1 OR mentor_id = $1 OR learner_id = $2 OR mentor_id = $2)
         AND scheduled_start < $4::timestamptz
         AND scheduled_start + (hours::double precision * interval '1 hour') > $3::timestamptz
       LIMIT 1`,
      [authUser.id, course.mentor_id, requestedStart.toISOString(), requestedEnd.toISOString()]
    );
    if (overlap.rows.length) {
      const conflict = new Error("You already have a pending or booked session at this time. Choose a different time.");
      conflict.statusCode = 409;
      throw conflict;
    }

    const price = computeSessionPrice({
      baseRate: Number(course.base_rate_credits),
      mentorLevel: course.mentor_level,
      sessionLevel: skillLevel,
      skillDifficultyFactor: Number(course.difficulty_factor),
      mentorAvgRating: Number(course.avg_rating),
      mentorTotalReviews: Number(course.total_reviews),
      hours: Number(hours),
    });

    const sessionRes = await client.query(
      `INSERT INTO sessions
        (learner_id, mentor_id, course_id, hours, scheduled_start, price_per_hour, base_credits,
        platform_fee_credits, total_charged_to_learner, credited_to_mentor, status, meeting_link, skill_level, request_key)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',NULL,$11,$12)
      ON CONFLICT (learner_id, request_key) DO NOTHING RETURNING *`,
      [
        authUser.id,
        course.mentor_id,
        courseId,
        hours,
        scheduledStart,
        price.pricePerHour,
        price.baseCredits,
        price.platformFee,
        price.totalChargedToLearner,
        price.creditedToMentor,
        skillLevel,
        requestKey,
      ]
    );
    if (!sessionRes.rows.length) {
      const duplicate = await client.query(
        "SELECT * FROM sessions WHERE learner_id = $1 AND request_key = $2 FOR UPDATE",
        [authUser.id, requestKey]
      );
      await client.query("COMMIT");
      return res.status(200).json({ session: duplicate.rows[0], duplicate: true });
    }
    const session = sessionRes.rows[0];

    await client.query(
      `INSERT INTO notifications (user_id, message, type) VALUES ($1,$2,'session_booked')`,
      [course.mentor_id, `${authUser.name || "A learner"} requested "${course.title}" for ${new Date(scheduledStart).toLocaleString()}. Review it in Mentoring.`]
    );

    await client.query("COMMIT");

    return res.status(201).json({ session, price, message: "Session request sent to the mentor for approval." });
  } catch (err) {
    await client.query("ROLLBACK");
    return res.status(err.statusCode || 400).json({ error: err.message });
  } finally {
    client.release();
  }
}
