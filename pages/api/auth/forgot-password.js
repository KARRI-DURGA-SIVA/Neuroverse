const { query } = require("../../../lib/db");
const { signPasswordResetToken } = require("../../../lib/auth");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const result = await query("SELECT id, email FROM users WHERE LOWER(email) = $1", [email]);
    const response = { message: "If an account exists for that email, reset instructions have been prepared." };

    if (result.rows.length > 0 && !email.endsWith("@demo.neuroverse.invalid")) {
      const token = signPasswordResetToken(result.rows[0]);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;
      if (process.env.NODE_ENV !== "production") {
        console.log(`Password reset link for ${email}: ${resetUrl}`);
        response.resetUrl = resetUrl;
      }
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Could not prepare password reset" });
  }
}