
import pool from "../../lib/db";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      connected: false,
      message: "Method not allowed",
    });
  }

  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database,
        current_user AS username,
        NOW() AS server_time
    `);

    console.log("✅ Neon PostgreSQL connection successful!");
    console.log("📦 Database:", result.rows[0].database);
    console.log("👤 Database user:", result.rows[0].username);

    return res.status(200).json({
      connected: true,
      message: "Neon PostgreSQL connected successfully",
      database: result.rows[0].database,
      username: result.rows[0].username,
      serverTime: result.rows[0].server_time,
    });
  } catch (error) {
    console.error("❌ Neon connection failed:", error.message);

    return res.status(500).json({
      connected: false,
      message: "Database connection failed",
    });
  }
}
