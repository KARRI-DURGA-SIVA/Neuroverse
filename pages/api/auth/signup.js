const bcrypt = require("bcryptjs");
const { query } = require("../../../lib/db");
const { signToken, setAuthCookie } = require("../../../lib/auth");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { name, email, password, age, languages, profilePic, bio } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email and password are required" });
  }

  // profilePic is a data URL (e.g. "data:image/jpeg;base64,...") produced by
  // client-side resizing in pages/signup.js. Guard against absurdly large
  // payloads being posted directly to the API.
  if (profilePic && profilePic.length > 2_000_000) {
    return res.status(400).json({ error: "Profile picture is too large" });
  }
  if (bio && bio.length > 280) {
    return res.status(400).json({ error: "Bio must be 280 characters or fewer" });
  }

  try {
    const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const STARTING_CREDITS = 50;

    const result = await query(
      `INSERT INTO users (name, email, password_hash, age, languages, credits, profile_pic, bio)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, name, email, credits, profile_pic, bio`,
      [name, email, passwordHash, age || null, languages || [], STARTING_CREDITS, profilePic || null, bio || null]
    );

    const user = result.rows[0];

    await query(
      `INSERT INTO transactions (user_id, type, credits, description) VALUES ($1, 'signup_bonus', $2, 'Welcome bonus on account creation')`,
      [user.id, STARTING_CREDITS]
    );

    await query(
      `INSERT INTO mentor_reputation (mentor_id, avg_rating, total_reviews, expertise_multiplier) VALUES ($1, 0, 0, 1.0)`,
      [user.id]
    );

    const token = signToken(user);
    setAuthCookie(res, token);

    return res.status(201).json({ user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Signup failed", details: err.message });
  }
}
