
import { query } from "../../../lib/db";
import { getAuthenticatedUser } from "../../../lib/auth";

export default async function handler(req, res) {
  res.setHeader("Allow", "GET, PATCH");

  if (!["GET", "PATCH"].includes(req.method)) {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const authUser = await getAuthenticatedUser(req);
    const userId = authUser?.userId ?? authUser?.id;

    if (!userId) {
      return res.status(401).json({
        error: "Not authenticated",
      });
    }

    if (req.method === "GET") {
      const result = await query(
        `SELECT *
         FROM notifications
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId]
      );

      return res.status(200).json({
        notifications: result.rows,
      });
    }

    if (req.method === "PATCH") {
      const id = req.body?.id;

      if (id !== undefined && id !== null && id !== "") {
        await query(
          `UPDATE notifications
           SET is_read = TRUE
           WHERE id = $1 AND user_id = $2`,
          [id, userId]
        );
      } else {
        await query(
          `UPDATE notifications
           SET is_read = TRUE
           WHERE user_id = $1`,
          [userId]
        );
      }

      return res.status(200).json({
        ok: true,
        message: "Notifications marked as read",
      });
    }
  } catch (error) {
    console.error("Notifications API error:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      table: error.table,
      column: error.column,
    });

    return res.status(500).json({
      error: "Failed to process notifications",
    });
  }
}
