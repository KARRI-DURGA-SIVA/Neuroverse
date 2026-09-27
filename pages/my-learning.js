import { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "../components/Layout";
import { apiFetch } from "../lib/api-client";

const DEMO_COURSES = [
  {
    id: "demo-learn-1",
    title: "Design Better Product Stories",
    description: "Learn how to shape your message, improve product communication, and speak with more clarity.",
    skill_name: "Product Thinking",
    mentor_name: "Jordan Ellis",
    price_per_hour: 50,
    avg_rating: 4.8,
    is_demo: true,
  },
  {
    id: "demo-learn-2",
    title: "Guitar Foundations Through Songs",
    description: "Build rhythm, transitions, and confidence with songs you already know and love.",
    skill_name: "Music",
    mentor_name: "Theo Walker",
    price_per_hour: 33,
    avg_rating: 4.8,
    is_demo: true,
  },
  {
    id: "demo-learn-3",
    title: "Data analysis for product decisions",
    description: "Turn messy data into clear insights and better product decisions.",
    skill_name: "Data Analysis",
    mentor_name: "Priya Nair",
    price_per_hour: 63,
    avg_rating: 4.9,
    is_demo: true,
  },
];

export default function MyLearning() {
  const [sessions, setSessions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [userId, setUserId] = useState(null);
  const [workingId, setWorkingId] = useState(null);
  const [message, setMessage] = useState("");
  const [policyOpen, setPolicyOpen] = useState(false);

  useEffect(() => {
    apiFetch("/api/auth/me").then((d) => setUserId(d.user.id));
    apiFetch("/api/sessions").then((d) => setSessions(d.sessions));
    apiFetch("/api/courses")
      .then((d) => setCourses(d.courses || []))
      .catch(() => setCourses([]));
  }, []);

  const learnerSessions = sessions.filter((s) => s.learner_id === userId);
  const displayedCourses = courses.length ? courses.slice(0, 3) : DEMO_COURSES;

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
          <h1 className="text-2xl font-semibold text-ink-900">My Learning</h1>
          <p className="text-ink-500 text-sm mt-1">Explore courses and track the sessions you've booked as a learner.</p>
        </div>

        <section className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-[#f9f7ff] via-white to-[#eef5ff] p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-600">Courses</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">Courses available to learn</h2>
            </div>
            <Link href="/courses" className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700">Browse all <span aria-hidden>↗</span></Link>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {displayedCourses.map((course) => (
              <article key={course.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-700">{course.skill_name || "Skill"}</span>
                  {course.is_demo && <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">Demo</span>}
                </div>
                <h3 className="mt-4 text-lg font-semibold leading-snug text-slate-900">{course.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{course.description}</p>

                <div className="mt-4 flex items-center gap-3 border-t border-slate-200 pt-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-[10px] font-semibold text-white">
                    {(course.mentor_name || "M").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{course.mentor_name}</p>
                    <p className="text-xs text-slate-500">{Number(course.avg_rating || 4.8).toFixed(1)} ★ rating</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">{Number(course.price_per_hour || course.base_rate_credits || 35).toFixed(0)} credits / hour</p>
                  <button type="button" className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white">View</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-slate-900">Your sessions</h2>
          </div>
          {message && <p role="status" className="text-sm text-accent-700">{message}</p>}
          {learnerSessions.map((s) => (
            <div key={s.id} className="card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
              <div>
                <p className="font-medium text-ink-900">{s.course_title} <span className="badge bg-ink-100 text-ink-700 ml-2">{s.status === "pending" ? "Awaiting mentor" : s.status === "declined" ? "Declined" : s.status}</span></p>
                <p className="text-sm text-ink-500">with {s.mentor_name} · {s.skill_name} · {new Date(s.scheduled_start).toLocaleString()}</p>
                <p className="text-xs text-ink-500 mt-1">{s.hours}h · {s.status === "pending" ? "No credits charged until accepted" : s.status === "declined" ? "No credits were charged" : `${s.total_charged_to_learner} credits charged`}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {s.status === "confirmed" || s.status === "in_progress" ? <Link href={`/session/${s.id}`} className="btn-secondary text-sm">Open</Link> : <span className="text-xs text-ink-500">{s.status === "pending" ? "Request sent" : "Request closed"}</span>}
                {s.status === "pending" && <button disabled={workingId === s.id} onClick={() => cancelSession(s)} className="btn-secondary text-sm">{workingId === s.id ? "Withdrawing..." : "Withdraw request"}</button>}
                {s.status === "confirmed" && <button onClick={() => setPolicyOpen(true)} className="text-xs font-medium text-ink-500 underline underline-offset-2">Cancellation policy</button>}
              </div>
            </div>
          ))}
          {learnerSessions.length === 0 && (
            <div className="card p-6 text-center text-sm text-ink-500">
              No sessions yet. <Link href="/explore" className="text-accent-600 font-medium">Explore skills</Link> to book your first one.
            </div>
          )}
        </div>
        {policyOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setPolicyOpen(false); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="cancel-policy-title" className="w-full max-w-sm bg-white p-6 shadow-xl">
              <h2 id="cancel-policy-title" className="text-lg font-semibold text-ink-900">Session confirmed</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-500">Once the mentor confirms, the session can no longer be cancelled. You can withdraw a request while it is still pending.</p>
              <button onClick={() => setPolicyOpen(false)} className="btn-primary mt-5 text-sm">Got it</button>
            </section>
          </div>
        )}
      </div>
    </Layout>
  );
}

function canCancelSession(session) {
  return session.status === "pending";
}
