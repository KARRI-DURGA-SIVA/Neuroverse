import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Layout from "../../components/Layout";
import { apiFetch } from "../../lib/api-client";

export default function SessionRoom() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [botMessages, setBotMessages] = useState([
    { role: "bot", text: "Hi! Ask me anything during this session and I'll help explain." },
  ]);
  const [botInput, setBotInput] = useState("");
  const [botLoading, setBotLoading] = useState(false);
  const fileInputRef = useRef(null);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [reviewMsg, setReviewMsg] = useState("");

  async function load() {
    if (!id) return;
    const d = await apiFetch(`/api/sessions/${id}`);
    setData(d);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function sendMsg() {
    if (!chatInput.trim()) return;
    await apiFetch(`/api/sessions/${id}/messages`, { method: "POST", body: JSON.stringify({ content: chatInput }) });
    setChatInput("");
    load();
  }

  async function uploadFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    await fetch(`/api/sessions/${id}/files`, { method: "POST", body: formData, credentials: "include" });
    load();
  }

  async function askBot() {
    if (!botInput.trim()) return;
    const question = botInput;
    setBotMessages((m) => [...m, { role: "user", text: question }]);
    setBotInput("");
    setBotLoading(true);
    try {
      const res = await apiFetch("/api/chat/gemini", {
        method: "POST",
        body: JSON.stringify({ message: question, context: data?.session?.course_title }),
      });
      setBotMessages((m) => [...m, { role: "bot", text: res.reply }]);
    } catch (err) {
      setBotMessages((m) => [...m, { role: "bot", text: `Error: ${err.message}` }]);
    } finally {
      setBotLoading(false);
    }
  }

  async function markComplete() {
    await apiFetch(`/api/sessions/${id}`, { method: "PATCH", body: JSON.stringify({ status: "completed" }) });
    load();
  }

  async function submitReview() {
    try {
      await apiFetch("/api/reviews", { method: "POST", body: JSON.stringify({ sessionId: id, rating, feedback }) });
      setReviewMsg("Thanks for your feedback! Mentor reputation updated.");
    } catch (err) {
      setReviewMsg(err.message);
    }
  }

  if (!data) return <Layout><div className="text-sm text-ink-500">Loading session...</div></Layout>;

  const { session, files, messages } = data;

  if (["pending", "declined", "cancelled"].includes(session.status)) {
    return (
      <Layout>
        {({ user }) => (
          <div className="mx-auto max-w-xl border border-gray-200 bg-white p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5149e8]">Session request</p>
            <h1 className="mt-3 text-2xl font-semibold text-ink-900">{session.course_title}</h1>
            <p className="mt-2 text-sm text-ink-500">{session.status === "pending" ? "This request is waiting for the mentor to respond. The session is not booked yet, and no credits have been charged." : `This request was ${session.status}. No session room is available.`}</p>
            <Link href={session.status === "pending" && user.id === session.mentor_id ? "/mentoring" : "/my-learning"} className="btn-primary mt-6 inline-flex text-sm">
              {session.status === "pending" && user.id === session.mentor_id ? "Review request" : "Back to my learning"}
            </Link>
          </div>
        )}
      </Layout>
    );
  }

  return (
    <Layout>
      {({ user }) => (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-ink-900">{session.course_title}</h1>
              <p className="text-ink-500 text-sm mt-1">{session.skill_name} · {new Date(session.scheduled_start).toLocaleString()} · {session.hours}h</p>
            </div>
            <span className="badge bg-accent-50 text-accent-700 text-sm">{session.status}</span>
          </div>

          <div className="card p-5 flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm text-ink-500">Video meeting</p>
              <a href={session.meeting_link} target="_blank" rel="noreferrer" className="text-accent-600 font-medium text-sm break-all">{session.meeting_link}</a>
            </div>
            <div className="flex gap-2">
              <a href={session.meeting_link} target="_blank" rel="noreferrer" className="btn-primary text-sm">Join meeting</a>
              {session.status !== "completed" && (
                <button onClick={markComplete} className="btn-secondary text-sm">Mark session complete</button>
              )}
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Files + chat */}
            <div className="lg:col-span-2 space-y-6">
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-ink-900">Session materials</h2>
                  <button onClick={() => fileInputRef.current.click()} className="btn-secondary text-sm">Upload file</button>
                  <input type="file" ref={fileInputRef} className="hidden" onChange={uploadFile} />
                </div>
                <div className="space-y-2">
                  {files.map((f) => (
                    <a key={f.id} href={f.url} download className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2 text-sm hover:bg-gray-50">
                      <span>{f.filename}</span>
                      <span className="text-accent-600 text-xs font-medium">Download</span>
                    </a>
                  ))}
                  {files.length === 0 && <p className="text-sm text-ink-500">No files shared yet. Mentors can upload notes, slides, or videos here.</p>}
                </div>
              </div>

              <div className="card p-5">
                <h2 className="font-semibold text-ink-900 mb-3">Session chat</h2>
                <div className="space-y-2 max-h-56 overflow-y-auto mb-3">
                  {messages.map((m) => (
                    <div key={m.id} className={`text-sm p-2 rounded-lg max-w-[80%] ${m.sender_id === user.id ? "bg-accent-50 ml-auto text-right" : "bg-gray-100"}`}>
                      {m.content}
                    </div>
                  ))}
                  {messages.length === 0 && <p className="text-sm text-ink-500">No messages yet.</p>}
                </div>
                <div className="flex gap-2">
                  <input className="input-field" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type a message..." onKeyDown={(e) => e.key === "Enter" && sendMsg()} />
                  <button onClick={sendMsg} className="btn-primary text-sm shrink-0">Send</button>
                </div>
              </div>

              {session.status === "completed" && session.learner_id === user.id && (
                <div className="card p-5">
                  <h2 className="font-semibold text-ink-900 mb-3">Rate this session</h2>
                  <div className="flex gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => setRating(n)} className={`text-2xl ${n <= rating ? "text-amber-400" : "text-gray-300"}`}>★</button>
                    ))}
                  </div>
                  <textarea className="input-field h-20 mb-3" placeholder="Leave feedback for your mentor..." value={feedback} onChange={(e) => setFeedback(e.target.value)} />
                  {reviewMsg && <p className="text-sm text-accent-700 mb-2">{reviewMsg}</p>}
                  <button onClick={submitReview} className="btn-primary text-sm">Submit review</button>
                </div>
              )}
            </div>

            {/* Gemini chatbot */}
            <div className="card p-5 flex flex-col h-[560px]">
              <h2 className="font-semibold text-ink-900 mb-1">Study assistant</h2>
              <p className="text-xs text-ink-500 mb-3">Ask questions during the live session. Powered by Gemini.</p>
              <div className="flex-1 overflow-y-auto space-y-2 mb-3">
                {botMessages.map((m, i) => (
                  <div key={i} className={`text-sm p-2.5 rounded-lg max-w-[90%] ${m.role === "user" ? "bg-accent-50 ml-auto text-right" : "bg-gray-100"}`}>
                    {m.text}
                  </div>
                ))}
                {botLoading && <div className="text-sm text-ink-500">Thinking...</div>}
              </div>
              <div className="flex gap-2">
                <input className="input-field" value={botInput} onChange={(e) => setBotInput(e.target.value)} placeholder="Ask a question..." onKeyDown={(e) => e.key === "Enter" && askBot()} />
                <button onClick={askBot} className="btn-primary text-sm shrink-0">Ask</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
