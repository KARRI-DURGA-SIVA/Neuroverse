import { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "../components/Layout";
import { apiFetch } from "../lib/api-client";

export default function Messages() {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    apiFetch("/api/sessions").then((d) => setSessions(d.sessions));
  }, []);

  return (
    <Layout>
      {({ user }) => (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-ink-900">Messages</h1>
            <p className="text-ink-500 text-sm mt-1">Conversations happen inside each session room.</p>
          </div>
          <div className="space-y-3">
            {sessions.map((s) => {
              const isLearner = s.learner_id === user.id;
              const other = isLearner ? s.mentor_name : s.learner_name;
              return (
                <Link key={s.id} href={`/session/${s.id}`} className="card card-hover p-4 flex items-center justify-between block">
                  <div>
                    <p className="font-medium text-ink-900">{other}</p>
                    <p className="text-sm text-ink-500">{s.course_title} · {s.status}</p>
                  </div>
                  <span className="text-accent-600 text-sm font-medium">Open chat →</span>
                </Link>
              );
            })}
            {sessions.length === 0 && <div className="card p-6 text-center text-sm text-ink-500">No conversations yet.</div>}
          </div>
        </div>
      )}
    </Layout>
  );
}
