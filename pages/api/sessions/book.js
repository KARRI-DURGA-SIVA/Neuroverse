const { v4: uuidv4 } = require("uuid");
const { query, getPool } = require("../../../lib/db");
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
      `SELECT c.*, s.difficulty_factor, mr.avg_rating, mr.total_reviews
       FROM courses c
       JOIN skills s ON c.skill_id = s.id
       LEFT JOIN mentor_reputation mr ON mr.mentor_id = c.mentor_id
       WHERE c.id = $1
       FOR UPDATE OF c`,
      [courseId]
    );
    if (courseRes.rows.length === 0) throw new Error("Course not found");
    const course = courseRes.rows[0];

    if (course.mentor_id === authUser.id) throw new Error("You cannot book your own course");

    const price = computeSessionPrice({
      baseRate: Number(course.base_rate_credits),
      mentorLevel: course.mentor_level,
      skillDifficultyFactor: Number(course.difficulty_factor),
      mentorAvgRating: Number(course.avg_rating),
      mentorTotalReviews: Number(course.total_reviews),
      hours: Number(hours),
    });

    const learnerRes = await client.query("SELECT credits FROM users WHERE id = $1 FOR UPDATE", [authUser.id]);
    const learnerCredits = Number(learnerRes.rows[0].credits);

    if (learnerCredits < price.totalChargedToLearner) {
      throw new Error(
        `Insufficient credits. This session costs ${price.totalChargedToLearner} credits (including 10% platform fee), you have ${learnerCredits}. Please buy more credits.`
      );
    }

    // Deduct from learner (base cost + platform fee)
    await client.query("UPDATE users SET credits = credits - $1 WHERE id = $2", [
      price.totalChargedToLearner,
      authUser.id,
    ]);

    // Credit mentor (base cost minus mentor's 10% platform cut)
    await client.query("UPDATE users SET credits = credits + $1 WHERE id = $2", [
      price.creditedToMentor,
      course.mentor_id,
    ]);

    const meetingLink = `https://meet.jit.si/neuroverse-${uuidv4()}`;

    const sessionRes = await client.query(
      `INSERT INTO sessions
        (learner_id, mentor_id, course_id, hours, scheduled_start, price_per_hour, base_credits,
         platform_fee_credits, total_charged_to_learner, credited_to_mentor, status, meeting_link)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'confirmed',$11) RETURNING *`,
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
        meetingLink,
      ]
    );
    const session = sessionRes.rows[0];

    await client.query(
      `INSERT INTO transactions (user_id, type, credits, description) VALUES ($1,'spend',$2,$3)`,
      [authUser.id, -price.totalChargedToLearner, `Booked session ${session.id} (incl. 10% platform fee)`]
    );
    await client.query(
      `INSERT INTO transactions (user_id, type, credits, description) VALUES ($1,'earn',$2,$3)`,
      [course.mentor_id, price.creditedToMentor, `Earned from session ${session.id} (after 10% platform fee)`]
    );

    await client.query(
      `INSERT INTO notifications (user_id, message, type) VALUES ($1,$2,'session_booked')`,
      [course.mentor_id, `New session booked with a learner for "${course.title}" on ${scheduledStart}.`]
    );
    await client.query(
      `INSERT INTO notifications (user_id, message, type) VALUES ($1,$2,'session_booked')`,
      [authUser.id, `Your session for "${course.title}" is confirmed. Meeting link is ready.`]
    );

    await client.query("COMMIT");

    return res.status(201).json({ session, price });
  } catch (err) {
    await client.query("ROLLBACK");
    return res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
}
