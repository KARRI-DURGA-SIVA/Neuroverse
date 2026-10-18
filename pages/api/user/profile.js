import { query } from "../../../lib/db";
const { getUserFromReq } = require("../../../lib/auth");

// PATCH /api/user/profile  { profilePic?, bio?, name? }
// Lets a logged-in user update their profile picture and/or bio after signup.
export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });
  if (req.method !== "PATCH") return res.status(405).json({ error: "Method not allowed" });

  const { profilePic, bio, name } = req.body;

  if (profilePic && profilePic.length > 2_000_000) {
    return res.status(400).json({ error: "Profile picture is too large" });
  }
  if (bio !== undefined && bio !== null && bio.length > 280) {
    return res.status(400).json({ error: "Bio must be 280 characters or fewer" });
  }

  const fields = [];
  const values = [];
  let i = 1;

  if (profilePic !== undefined) {
    fields.push(`profile_pic = $${i++}`);
    values.push(profilePic);
  }
  if (bio !== undefined) {
    fields.push(`bio = $${i++}`);
    values.push(bio);
  }
  if (name !== undefined && name.trim()) {
    fields.push(`name = $${i++}`);
    values.push(name.trim());
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  values.push(authUser.id);

  try {
    const result = await query(
      `UPDATE users SET ${fields.join(", ")} WHERE id = $${i}
       RETURNING id, name, email, age, profile_pic, languages, bio, credits, created_at`,
      values
    );
    return res.status(200).json({ user: result.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update profile", details: err.message });
  }
}
