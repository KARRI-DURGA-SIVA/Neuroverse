import { getUserFromReq } from "../../../lib/auth";
import { getAgentConversation, recordAgentBooking, runAgentTurn, startNewAgentConversation } from "../../../lib/agent";

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });
  if (req.method === "GET") {
    try {
      return res.status(200).json(await getAgentConversation(authUser.id));
    } catch (error) {
      console.error("Could not load assistant conversation:", error);
      return res.status(500).json({ error: "Could not load your saved assistant conversation" });
    }
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message, conversationId, action } = req.body || {};
  if (action === "booking-created") {
    if (!/^\d{1,18}$/.test(String(conversationId || "")) || !/^\d{1,18}$/.test(String(req.body?.sessionId || ""))) {
      return res.status(400).json({ error: "A valid conversationId and sessionId are required" });
    }
    try {
      return res.status(200).json(await recordAgentBooking(authUser.id, conversationId, req.body.sessionId));
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
      console.error("Could not save assistant booking note:", error);
      return res.status(500).json({ error: "Could not save the booking note to chat history" });
    }
  }
  if (action === "new") {
    try {
      return res.status(201).json(await startNewAgentConversation(authUser.id));
    } catch (error) {
      console.error("Could not create assistant conversation:", error);
      return res.status(500).json({ error: "Could not start a new assistant conversation" });
    }
  }
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }
  if (message.length > 2000) return res.status(413).json({ error: "message must be 2000 characters or fewer" });
  if (conversationId !== undefined && conversationId !== null && !/^\d{1,18}$/.test(String(conversationId))) {
    return res.status(400).json({ error: "Invalid conversationId" });
  }

  try {
    const result = await runAgentTurn({ userId: authUser.id, message: message.trim(), conversationId });
    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    console.error("Assistant turn failed:", err);
    return res.status(500).json({ error: "The assistant hit an error. Your conversation is saved; please try again." });
  }
}
