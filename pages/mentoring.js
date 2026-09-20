import { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "../components/Layout";
import { apiFetch } from "../lib/api-client";

export default function Mentoring() {
  const [sessions, setSessions] = useState([]);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    apiFetch("/api/auth/me").then((d) => setUserId(d.user.id));
    apiFetch("/api/sessions").then((d) => setSessions(d.sessions));
  }, []);

  const mentorSessions = sessions.filter((s) => s.mentor_id === userId);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Mentoring</h1>
          <p className="text-ink-500 text-sm mt-1">Sessions where you're the mentor.</p>
        </div>

        <div className="space-y-3">
          {mentorSessions.map((s) => (
            <div key={s.id} className="card p-5 flex items-center justify-between">
              <div>
                <p className="font-medium text-ink-900">{s.course_title} <span className="badge bg-ink-100 text-ink-700 ml-2">{s.status}</span></p>
                <p className="text-sm text-ink-500">learner: {s.learner_name} · {s.skill_name} · {new Date(s.scheduled_start).toLocaleString()}</p>
                <p className="text-xs text-ink-500 mt-1">{s.hours}h · you earn {s.credited_to_mentor} credits (after 10% platform fee)</p>
              </div>
              <Link href={`/session/${s.id}`} className="btn-secondary text-sm">Open</Link>
            </div>
          ))}
          {mentorSessions.length === 0 && (
            <div className="card p-6 text-center text-sm text-ink-500">
              No mentoring sessions yet. <Link href="/teach" className="text-accent-600 font-medium">Publish a course</Link> to start earning.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
