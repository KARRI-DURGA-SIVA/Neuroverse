const bcrypt = require("bcryptjs");
const { query } = require("../../../lib/db");
const { verifyPasswordResetToken } = require("../../../lib/auth");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = String(req.body?.token || "");
  const password = String(req.body?.password || "");
  if (!token || password.length < 8) return res.status(400).json({ error: "A valid token and password of at least 8 characters are required" });

  try {
    const payload = verifyPasswordResetToken(token);
    const result = await query("SELECT id, email FROM users WHERE id = $1 AND LOWER(email) = $2", [payload.id, payload.email.toLowerCase()]);
    if (result.rows.length === 0 || result.rows[0].email.endsWith("@demo.neuroverse.invalid")) {
      return res.status(400).json({ error: "This reset link is invalid" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, payload.id]);
    return res.status(200).json({ message: "Password updated. You can now log in." });
  } catch (err) {
    return res.status(400).json({ error: "This reset link is invalid or expired" });
  }
}