// pages/api/chat/gemini.js
// Proxies chat messages to Google's Gemini API using your own GEMINI_API_KEY.
// Set GEMINI_API_KEY in .env.local — never expose it to the client directly.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server (.env.local)" });
  }

  const { message, context } = req.body;
  if (!message) return res.status(400).json({ error: "message is required" });

  try {
    const systemContext = context
      ? `You are a helpful study assistant inside a live mentoring session on the topic: "${context}". Keep answers concise and relevant to the session.`
      : "You are a helpful study assistant inside a live mentoring session.";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${systemContext}\n\nLearner question: ${message}` }],
            },
          ],
        }),
      }
    );

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || "Gemini API error" });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sorry, I couldn't generate a response right now.";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to reach Gemini API", details: err.message });
  }
}
