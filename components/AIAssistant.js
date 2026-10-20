import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api-client";

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: "ai", text: "Hi! What would you like to learn?" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [loadError, setLoadError] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    apiFetch("/api/agent/chat")
      .then((saved) => {
        setConversationId(saved.conversationId);
        setMessages(saved.messages?.map((item) => ({ role: item.role === "user" ? "user" : "ai", text: item.content })) || []);
        setRecommendations(saved.recommendations || []);
      })
      .catch((error) => setLoadError(error.message || "Could not load your saved chat."));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, recommendations, selectedMentor]);

  async function send(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setMessages((current) => [...current, { role: "user", text }]);
    setInput("");
    setRecommendations([]);
    setSelectedMentor(null);
    setLoading(true);

    try {
      const res = await apiFetch("/api/agent/chat", {
        method: "POST",
        body: JSON.stringify({ message: text, ...(conversationId ? { conversationId } : {}) }),
      });

      setConversationId(res.conversationId);
      setMessages((m) => [...m, { role: "ai", text: res.reply }]);
      setRecommendations(res.recommendations || []);
    } catch (err) {
      setMessages((m) => [...m, { role: "ai", text: `Sorry — ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  async function startNewConversation() {
    if (loading) return;
    setLoading(true);
    setLoadError("");
    try {
      const next = await apiFetch("/api/agent/chat", { method: "POST", body: JSON.stringify({ action: "new" }) });
      setConversationId(next.conversationId);
      setMessages(next.messages.map((item) => ({ role: "ai", text: item.content })));
      setRecommendations([]);
      setSelectedMentor(null);
    } catch (error) {
      setLoadError(error.message || "Could not start a new conversation.");
    } finally {
      setLoading(false);
    }
  }

  async function addBookingMessage(sessionId) {
    try {
      const result = await apiFetch("/api/agent/chat", {
        method: "POST",
        body: JSON.stringify({ action: "booking-created", conversationId, sessionId }),
      });
      setMessages((current) => [...current, { role: "ai", text: result.reply }]);
    } catch (error) {
      setMessages((current) => [...current, { role: "ai", text: `The booking request was sent, but I couldn't save its status to chat history: ${error.message}` }]);
    }
  }

  return (
    <>
      <button onClick={() => setOpen((o) => !o)} className="agent-fab" aria-label="Open AI assistant">
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        ) : (
          <span className="text-2xl leading-none">🤖</span>
        )}
      </button>

      {open && (
        <div className="agent-panel">
          <div className="agent-header">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <span className="font-medium text-sm">NeuroVerse AI Assistant</span>
            </div>
            <button type="button" onClick={startNewConversation} disabled={loading} className="text-xs text-white/80 hover:text-white disabled:opacity-50">New chat</button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#fafafa]">
            {loadError && <p role="alert" className="text-xs text-red-700">{loadError}</p>}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "agent-bubble-user" : "agent-bubble-ai"}>
                {m.text}
              </div>
            ))}

            {loading && (
              <div className="agent-bubble-ai flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-ink-500 animate-bounce [animation-delay:-0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-ink-500 animate-bounce [animation-delay:-0.1s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-ink-500 animate-bounce" />
                <span className="text-xs text-ink-500 ml-1">Thinking...</span>
              </div>
            )}

            {recommendations.length > 0 && !selectedMentor && !loading && (
              <RecommendationList recommendations={recommendations} onSelect={setSelectedMentor} />
            )}
            {selectedMentor && !loading && (
              <BookingProposal proposal={selectedMentor} onDone={() => setSelectedMentor(null)} onSystemMessage={addBookingMessage} />
            )}
          </div>

          <form onSubmit={send} className="border-t border-gray-100 p-3 shrink-0 bg-white">
            <div className="flex items-center gap-2 bg-ink-100/70 rounded-full pl-4 pr-1.5 py-1">
              <input
                className="flex-1 bg-transparent text-sm outline-none py-1.5"
                placeholder="Type your learning goal..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading || Boolean(loadError)}
              />
              <button type="submit" disabled={loading || !input.trim()} className="w-8 h-8 rounded-full bg-accent-500 disabled:opacity-40 text-white flex items-center justify-center shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 12h16M14 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function RecommendationList({ recommendations, onSelect }) {
  return (
    <div className="space-y-2">
      {recommendations.map((mentor) => (
        <article key={mentor.courseId} className="agent-proposal-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-sm text-ink-900">{mentor.mentorName}</p>
              <p className="text-xs text-ink-500">{mentor.courseTitle} · {mentor.mentorLevel} mentor</p>
            </div>
            <span className="badge bg-green-50 text-green-700">{mentor.suitabilityPercent}% match</span>
          </div>
          <p className="mt-2 text-xs text-ink-600">{mentor.description}</p>
          <p className="mt-2 text-xs text-ink-600">
            {mentor.avgRating > 0 ? `${mentor.avgRating.toFixed(1)} rating · ${mentor.totalReviews} reviews` : "No reviews recorded"}
            {` · ${mentor.totalCreditsPerHour} credits/hour including fee`}
          </p>
          <p className="mt-1 text-xs text-ink-500">{mentor.upcomingSessionCount} recorded upcoming booking{mentor.upcomingSessionCount === 1 ? "" : "s"}; exact recurring availability is not listed.</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-ink-500">
            {mentor.reasons.slice(0, 4).map((reason, index) => <li key={`${mentor.courseId}-${index}`}>{reason}</li>)}
          </ul>
          <button type="button" onClick={() => onSelect(mentor)} className="btn-primary mt-3 w-full text-xs">Select this mentor</button>
        </article>
      ))}
    </div>
  );
}

function BookingProposal({ proposal, onDone, onSystemMessage }) {
  const [hours, setHours] = useState(1);
  const [skillLevel, setSkillLevel] = useState(proposal.targetLevel || "intermediate");
  const [requestKey] = useState(() => `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const [scheduledStart, setScheduledStart] = useState("");
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    if (!scheduledStart) {
      setError("Pick a date and time first.");
      return;
    }
    setBooking(true);
    setError("");
    try {
      // The agent never calls this itself — booking only happens from this
      // explicit, human-clicked confirmation, through the same audited
      // endpoint the rest of the app uses.
      const res = await apiFetch("/api/sessions/book", {
        method: "POST",
        body: JSON.stringify({ courseId: proposal.courseId, hours: Number(hours), scheduledStart, skillLevel, requestKey }),
      });
      onSystemMessage(res.session.id);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBooking(false);
    }
  }

  return (
    <div className="agent-proposal-card">
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <p className="font-semibold text-sm text-ink-900">Book with {proposal.mentorName}</p>
          <p className="text-xs text-ink-500">{proposal.courseTitle}</p>
        </div>
        <span className="badge bg-green-50 text-green-700">Selected</span>
      </div>
      <p className="text-xs text-ink-500 mb-2">
        {proposal.skillName} · {proposal.mentorLevel} mentor · {proposal.totalCreditsPerHour} credits/hr incl. fee
        {proposal.avgRating > 0 ? ` · ${proposal.avgRating.toFixed(1)}★` : ""}
      </p>
      {!proposal.canAfford && (
        <p className="text-xs text-amber-600 mb-2">Your balance ({proposal.credits} credits) may not cover this after fees — top up in Wallet if needed.</p>
      )}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-[11px] text-ink-500 block mb-1">Your target level</label>
          <select className="input-field text-sm py-1.5" value={skillLevel} onChange={(event) => setSkillLevel(event.target.value)}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="expert">Expert</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] text-ink-500 block mb-1">Hours</label>
          <input type="number" min="0.5" step="0.5" className="input-field text-sm py-1.5" value={hours} onChange={(e) => setHours(e.target.value)} />
        </div>
        <div>
          <label className="text-[11px] text-ink-500 block mb-1">Date &amp; time</label>
          <input type="datetime-local" className="input-field text-sm py-1.5" value={scheduledStart} onChange={(e) => setScheduledStart(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onDone} className="btn-secondary text-xs py-1.5 flex-1">Not now</button>
        <button onClick={confirm} disabled={booking} className="btn-primary text-xs py-1.5 flex-1">{booking ? "Sending..." : "Send request"}</button>
      </div>
    </div>
  );
}
