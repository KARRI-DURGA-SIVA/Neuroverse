
import { query } from "../../../lib/db";
import { getAuthenticatedUser } from "../../../lib/auth";

export default async function handler(req, res) {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate"
  );

  res.setHeader("Allow", "GET");

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const authUser = await getAuthenticatedUser(req);
    const userId = authUser?.userId ?? authUser?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Not authenticated",
      });
    }

    // Replace this example query with the actual
    // SQL query used by your skills API.
    const result = await query(
      "SELECT * FROM skills ORDER BY name ASC"
    );

    return res.status(200).json({
      success: true,
      skills: result.rows,
    });
  } catch (error) {
    console.error("Skills API error:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to load skills",
    });
  }
}
