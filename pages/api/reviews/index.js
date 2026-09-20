const { query, getPool } = require("../../../lib/db");
const { getUserFromReq } = require("../../../lib/auth");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // body: { sessionId, rating (1-5), feedback }
  const { sessionId, rating, feedback } = req.body;
  if (!sessionId || !rating) return res.status(400).json({ error: "sessionId and rating are required" });

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const sessRes = await client.query("SELECT * FROM sessions WHERE id = $1 FOR UPDATE", [sessionId]);
    if (sessRes.rows.length === 0) throw new Error("Session not found");
    const session = sessRes.rows[0];
    if (session.learner_id !== authUser.id) throw new Error("Only the learner can review this session");

    await client.query(
      `INSERT INTO reviews (session_id, learner_id, mentor_id, rating, feedback) VALUES ($1,$2,$3,$4,$5)`,
      [sessionId, authUser.id, session.mentor_id, rating, feedback || null]
    );

    // Recompute mentor's average rating
    const aggRes = await client.query(
      `SELECT AVG(rating)::numeric(3,2) as avg_rating, COUNT(*)::int as total FROM reviews WHERE mentor_id = $1`,
      [session.mentor_id]
    );
    const avgRating = Number(aggRes.rows[0].avg_rating);
    const totalReviews = Number(aggRes.rows[0].total);

    let multiplier;
    if (avgRating >= 4.5) multiplier = 1.5;
    else if (avgRating >= 3.5) multiplier = 1.2;
    else if (avgRating >= 2.0) multiplier = 1.0;
    else multiplier = 0.5;

    await client.query(
      `INSERT INTO mentor_reputation (mentor_id, avg_rating, total_reviews, expertise_multiplier)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (mentor_id) DO UPDATE SET avg_rating = $2, total_reviews = $3, expertise_multiplier = $4`,
      [session.mentor_id, avgRating, totalReviews, multiplier]
    );

    await client.query(
      `INSERT INTO notifications (user_id, message, type) VALUES ($1,$2,'review_received')`,
      [session.mentor_id, `You received a new ${rating}-star review. Your reputation has been updated.`]
    );

    await client.query("COMMIT");

    return res.status(201).json({ ok: true, avgRating, totalReviews, expertiseMultiplier: multiplier });
  } catch (err) {
    await client.query("ROLLBACK");
    return res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
}
