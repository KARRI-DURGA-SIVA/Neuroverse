import { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api-client";

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "ai", text: "Hi! What would you like to learn? Tell me the skill, your level, and when you're free — e.g. \"I want to learn Python from beginner level, find someone available this weekend.\"" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, proposal]);

  async function send(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages = [...messages, { role: "user", text }];
    setMessages(nextMessages);
    setInput("");
    setProposal(null);
    setLoading(true);

    try {
      const history = nextMessages
        .filter((m) => m.role === "user" || m.role === "ai")
        .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));

      const res = await apiFetch("/api/agent/chat", {
        method: "POST",
        body: JSON.stringify({ message: text, history }),
      });

      setMessages((m) => [...m, { role: "ai", text: res.reply }]);
      if (res.proposal) setProposal(res.proposal);
    } catch (err) {
      setMessages((m) => [...m, { role: "ai", text: `Sorry — ${err.message}` }]);
    } finally {
      setLoading(false);
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
            <span className="text-[10px] text-white/50 uppercase tracking-wide">Agentic</span>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#fafafa]">
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
                <span className="text-xs text-ink-500 ml-1">Finding suitable matches...</span>
              </div>
            )}

            {proposal && !loading && (
              <BookingProposal proposal={proposal} onDone={() => setProposal(null)} onSystemMessage={(text) => setMessages((m) => [...m, { role: "ai", text }])} />
            )}
          </div>

          <form onSubmit={send} className="border-t border-gray-100 p-3 shrink-0 bg-white">
            <div className="flex items-center gap-2 bg-ink-100/70 rounded-full pl-4 pr-1.5 py-1">
              <input
                className="flex-1 bg-transparent text-sm outline-none py-1.5"
                placeholder="Type your learning goal..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
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

function BookingProposal({ proposal, onDone, onSystemMessage }) {
  const [hours, setHours] = useState(1);
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
        body: JSON.stringify({ courseId: proposal.courseId, hours: Number(hours), scheduledStart }),
      });
      onSystemMessage(`Request sent to ${proposal.mentorName}. The mentor needs to accept before the session is booked; credits are charged only after acceptance. Track the request in My Learning.`);
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
        <p className="font-semibold text-sm text-ink-900">{proposal.mentorName}</p>
        <span className="badge bg-green-50 text-green-700">{proposal.suitabilityPercent}% match</span>
      </div>
      <p className="text-xs text-ink-500 mb-2">
        {proposal.skillName} · {proposal.mentorLevel} level · {proposal.pricePerHour} credits/hr
        {proposal.avgRating > 0 ? ` · ${proposal.avgRating.toFixed(1)}★` : ""}
      </p>
      {!proposal.canAfford && (
        <p className="text-xs text-amber-600 mb-2">Your balance ({proposal.credits} credits) may not cover this after fees — top up in Wallet if needed.</p>
      )}
      <div className="grid grid-cols-2 gap-2 mb-2">
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
