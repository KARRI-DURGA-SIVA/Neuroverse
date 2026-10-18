import { getUserFromReq } from "../../../lib/auth";
import { runAgentTurn } from "../../../lib/agent";

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message, history = [] } = req.body || {};
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }
  if (!Array.isArray(history)) return res.status(400).json({ error: "history must be an array" });

  try {
    const result = await runAgentTurn({ userId: authUser.id, message: message.trim(), conversationHistory: history });
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "The assistant hit an error" });
  }
}
