const { getUserFromReq } = require("../../../lib/auth");
const { runAgentTurn, logProgressNote } = require("../../../lib/agent");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message, history = [] } = req.body;
  if (!message) return res.status(400).json({ error: "message is required" });

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: "The AI assistant needs GEMINI_API_KEY set in .env.local to work. Add it and restart the server.",
    });
  }

  try {
    const result = await runAgentTurn({ userId: authUser.id, message, conversationHistory: history });
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "The assistant hit an error" });
  }
}
