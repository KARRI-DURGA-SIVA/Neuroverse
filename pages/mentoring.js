import { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "../components/Layout";
import { apiFetch } from "../lib/api-client";

export default function Mentoring() {
  const [sessions, setSessions] = useState([]);
  const [userId, setUserId] = useState(null);
  const [workingId, setWorkingId] = useState(null);
  const [message, setMessage] = useState("");
  const [policyOpen, setPolicyOpen] = useState(false);

  useEffect(() => {
    apiFetch("/api/auth/me").then((d) => setUserId(d.user.id));
    apiFetch("/api/sessions").then((d) => setSessions(d.sessions));
  }, []);

  const mentorSessions = sessions.filter((s) => s.mentor_id === userId);

  async function respondToRequest(session, status) {
    setWorkingId(session.id);
    setMessage("");
    try {
      await apiFetch(`/api/sessions/${session.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      setSessions((current) => current.map((item) => item.id === session.id ? { ...item, status } : item));
      setMessage(status === "confirmed" ? "Request accepted. The learner has been notified and the session is booked." : "Request declined. The learner has been notified.");
    } catch (err) {
      setMessage(err.message || "Could not update this request.");
    } finally {
      setWorkingId(null);
    }
  }

  async function cancelSession(session) {
    if (!window.confirm("Withdraw this pending session request?")) return;
    setWorkingId(session.id);
    setMessage("");
    try {
      await apiFetch(`/api/sessions/${session.id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) });
      setSessions((current) => current.map((item) => item.id === session.id ? { ...item, status: "cancelled" } : item));
      setMessage("Session request withdrawn.");
    } catch (err) {
      setMessage(err.message || "Could not cancel this session.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Mentoring</h1>
          <p className="text-ink-500 text-sm mt-1">Sessions where you're the mentor.</p>
        </div>

        <div className="space-y-3">
          {message && <p role="status" className="text-sm text-accent-700">{message}</p>}
          {mentorSessions.map((s) => (
            <div key={s.id} className="card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
              <div>
                <p className="font-medium text-ink-900">{s.course_title} <span className="badge bg-ink-100 text-ink-700 ml-2">{s.status === "pending" ? "Request pending" : s.status}</span></p>
                <p className="text-sm text-ink-500">learner: {s.learner_name} · {s.skill_name} · {new Date(s.scheduled_start).toLocaleString()}</p>
                <p className="text-xs text-ink-500 mt-1">{s.hours}h · {s.status === "pending" ? `You will earn ${s.credited_to_mentor} credits if accepted` : `You earned ${s.credited_to_mentor} credits`}</p>
              </div>
              {s.status === "pending" ? (
                <div className="flex shrink-0 gap-2">
                  <button disabled={workingId === s.id} onClick={() => respondToRequest(s, "declined")} className="btn-secondary text-sm">Decline</button>
                  <button disabled={workingId === s.id} onClick={() => respondToRequest(s, "confirmed")} className="btn-primary text-sm">{workingId === s.id ? "Saving..." : "Accept request"}</button>
                  <button disabled={workingId === s.id} onClick={() => cancelSession(s)} className="btn-secondary text-sm">Withdraw</button>
                </div>
              ) : s.status === "confirmed" || s.status === "in_progress" ? (
                <div className="flex shrink-0 items-center gap-2">
                  <Link href={`/session/${s.id}`} className="btn-secondary text-sm">Open session</Link>
                  <button onClick={() => setPolicyOpen(true)} className="text-xs font-medium text-ink-500 underline underline-offset-2">Cancellation policy</button>
                </div>
              ) : null}
            </div>
          ))}
          {mentorSessions.length === 0 && (
            <div className="card p-6 text-center text-sm text-ink-500">
              No mentoring sessions yet. <Link href="/teach" className="text-accent-600 font-medium">Publish a course</Link> to start earning.
            </div>
          )}
        </div>
        {policyOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setPolicyOpen(false); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="mentor-cancel-policy-title" className="w-full max-w-sm bg-white p-6 shadow-xl">
              <h2 id="mentor-cancel-policy-title" className="text-lg font-semibold text-ink-900">Session confirmed</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">Once confirmed, the session cannot be cancelled. Only pending requests can be withdrawn.</p>
              <button onClick={() => setPolicyOpen(false)} className="btn-primary mt-5 text-sm">Got it</button>
            </section>
          </div>
        )}
      </div>
    </Layout>
  );
}

