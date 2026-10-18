import { query, getPool } from "../../../lib/db";
const { getUserFromReq } = require("../../../lib/auth");
const { computeSessionPrice } = require("../../../lib/pricing");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // body: { courseId, hours, scheduledStart }
  const { courseId, hours, scheduledStart } = req.body;
  if (!courseId || !hours || !scheduledStart) {
    return res.status(400).json({ error: "courseId, hours and scheduledStart are required" });
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

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
       WHERE status IN ('pending', 'confirmed', 'in_progress')
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
      skillDifficultyFactor: Number(course.difficulty_factor),
      mentorAvgRating: Number(course.avg_rating),
      mentorTotalReviews: Number(course.total_reviews),
      hours: Number(hours),
    });

    const sessionRes = await client.query(
      `INSERT INTO sessions
        (learner_id, mentor_id, course_id, hours, scheduled_start, price_per_hour, base_credits,
         platform_fee_credits, total_charged_to_learner, credited_to_mentor, status, meeting_link)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',NULL) RETURNING *`,
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
      ]
    );
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
