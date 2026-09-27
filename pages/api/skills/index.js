const { query } = require("../../../lib/db");

export default async function handler(req, res) {
  if (req.method === "GET") {
    const result = await query("SELECT * FROM skills ORDER BY name ASC");
    return res.status(200).json({ skills: result.rows });
  }

  if (req.method === "POST") {
    // Manual entry: user typed a skill that isn't in the dropdown list.
    const { name, category, test_type, difficulty_factor } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    try {
      const existing = await query("SELECT * FROM skills WHERE LOWER(name) = LOWER($1)", [name]);
      if (existing.rows.length > 0) {
        return res.status(200).json({ skill: existing.rows[0] });
      }

      const result = await query(
        `INSERT INTO skills (name, category, test_type, difficulty_factor, is_custom)
         VALUES ($1, $2, $3, $4, true) RETURNING *`,
        [
          name,
          category || "general",
          test_type || "mcq",
          difficulty_factor || 1.0,
        ]
      );
      return res.status(201).json({ skill: result.rows[0] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to add skill", details: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
