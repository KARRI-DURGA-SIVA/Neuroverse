import { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "../components/Layout";
import RiddleWidget from "../components/RiddleWidget";
import { apiFetch } from "../lib/api-client";

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    apiFetch("/api/dashboard").then(setData).catch(() => {});
  }, []);

  return (
    <Layout>
      {({ user }) => (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-ink-900">Welcome back, {user.name.split(" ")[0]}</h1>
            <p className="text-ink-500 text-sm mt-1">Here's what's happening with your learning journey.</p>
          </div>

          <RiddleWidget />

          {/* Top stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Credit Balance" value={`${data?.credits ?? "—"}`} sub="credits available" cta={{ href: "/wallet", label: "Buy more" }} />
            <StatCard label="Upcoming Sessions" value={data?.upcomingSessions?.length ?? "—"} sub="scheduled" cta={{ href: "/my-learning", label: "View all" }} />
            <StatCard
              label="Avg. Assessment Score"
              value={data?.performance ? `${Math.round(data.performance.avg_assessment_score)}%` : "—"}
              sub="across your skills"
              cta={{ href: "/profile", label: "View dashboard" }}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Continue Learning */}
              <Section title="Continue Learning" action={{ href: "/explore", label: "Explore more" }}>
                {(!data?.continueLearning || data.continueLearning.length === 0) && (
                  <EmptyState text="You haven't started learning any skills yet." cta={{ href: "/explore", label: "Explore skills" }} />
                )}
                <div className="grid sm:grid-cols-2 gap-4">
                  {data?.continueLearning?.map((s) => (
                    <div key={s.id} className="card card-hover p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="badge bg-accent-50 text-accent-700">{s.desired_level || "intermediate"}</span>
                      </div>
                      <h3 className="font-medium text-ink-900">{s.skill_name}</h3>
                      <Link href={`/mentors/match?skillId=${s.skill_id}`} className="text-sm text-accent-600 font-medium mt-2 inline-block">
                        Find a mentor →
                      </Link>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Upcoming Sessions */}
              <Section title="Upcoming Sessions" action={{ href: "/my-learning", label: "View all" }}>
                {(!data?.upcomingSessions || data.upcomingSessions.length === 0) && (
                  <EmptyState text="No sessions booked yet." cta={{ href: "/explore", label: "Book a session" }} />
                )}
                <div className="space-y-3">
                  {data?.upcomingSessions?.map((s) => (
                    <div key={s.id} className="card p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-ink-900">{s.course_title}</p>
                        <p className="text-sm text-ink-500">with {s.mentor_name} · {new Date(s.scheduled_start).toLocaleString()}</p>
                      </div>
                      <Link href={`/session/${s.id}`} className="btn-secondary text-sm">Open</Link>
                    </div>
                  ))}
                </div>
              </Section>
            </div>

            <div className="space-y-6">
              {/* Recommended Skills */}
              <Section title="Recommended Skills">
                <div className="space-y-2">
                  {data?.recommendedSkills?.map((s) => (
                    <Link key={s.id} href={`/mentors/match?skillId=${s.id}`} className="card card-hover p-3 flex items-center justify-between block">
                      <span className="text-sm font-medium text-ink-900">{s.name}</span>
                      <span className="text-xs text-ink-500">{s.mentor_count} mentors</span>
                    </Link>
                  ))}
                  {(!data?.recommendedSkills || data.recommendedSkills.length === 0) && (
                    <p className="text-sm text-ink-500">No recommendations yet.</p>
                  )}
                </div>
              </Section>

              {/* Recommended Mentors */}
              <Section title="Recommended Mentors">
                <div className="space-y-3">
                  {data?.recommendedMentors?.map((m) => (
                    <div key={m.course_id} className="card p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center font-semibold text-sm shrink-0">
                          {m.mentor_name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink-900 truncate">{m.mentor_name}</p>
                          <p className="text-xs text-ink-500 truncate">{m.skill_name} · {Number(m.avg_rating || 0).toFixed(1)}★</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!data?.recommendedMentors || data.recommendedMentors.length === 0) && (
                    <p className="text-sm text-ink-500">Add a skill you want to learn to see mentor recommendations.</p>
                  )}
                </div>
              </Section>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function StatCard({ label, value, sub, cta }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium text-ink-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-semibold text-ink-900 mt-1.5">{value}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-ink-500">{sub}</span>
        {cta && <Link href={cta.href} className="text-xs font-medium text-accent-600">{cta.label}</Link>}
      </div>
    </div>
  );
}

function Section({ title, action, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        {action && <Link href={action.href} className="text-sm font-medium text-accent-600">{action.label}</Link>}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ text, cta }) {
  return (
    <div className="card p-6 text-center">
      <p className="text-sm text-ink-500 mb-3">{text}</p>
      {cta && <Link href={cta.href} className="btn-primary inline-block text-sm">{cta.label}</Link>}
    </div>
  );
}
