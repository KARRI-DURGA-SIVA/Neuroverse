
import { query } from "../../../lib/db";
import { getAuthenticatedUser } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const auth = getAuthenticatedUser(req);

    if (!auth) {
      return res.status(401).json({
        message: "Please log in again",
      });
    }

    const result = await query(
      `SELECT id, name, email, age, bio, profile_pic, credits, created_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [auth.userId]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        message: "User account not found",
      });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Authentication check error:", error);

    return res.status(500).json({
      message: "Unable to verify your session",
    });
  }
}
