import { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "../components/Layout";
import RiddleWidget from "../components/RiddleWidget";
import { apiFetch } from "../lib/api-client";

const LEVEL_DONUT_COLORS = { beginner: "#8B7CF6", intermediate: "#6C5CE7", advanced: "#4A3BA8" };

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    apiFetch("/api/dashboard").then(setData).catch(() => {});
  }, []);

  const sessionsCompleted = data?.performance ? Number(data.performance.sessions_completed) : 0;
  const avgScore = data?.performance ? Math.round(data.performance.avg_assessment_score) : 0;

  return (
    <Layout>
      {({ user }) => (
        <div className="space-y-8 pb-10">
          <header className="rounded-[28px] border border-slate-200 bg-gradient-to-r from-[#f5f2ff] via-white to-[#eef7ff] p-5 shadow-[0_18px_40px_rgba(25,35,66,0.06)] sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-600">NeuroVerse learning desk</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Welcome back, {(user.name || "Learner").split(" ")[0]}.</h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">Your next breakthrough is waiting. Pick up a skill, book a mentor, and keep your momentum moving.</p>
              </div>
              <div className="flex items-center gap-3 self-start rounded-2xl border border-violet-200 bg-white/80 px-4 py-3 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 text-sm font-semibold text-white shadow-sm">
                  {(user.name || "L").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Profile</p>
                  <p className="text-sm font-semibold text-slate-800">{user.name || "Learner"}</p>
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link href="/courses" className="btn-primary inline-flex items-center gap-2 text-sm">Browse courses <span aria-hidden>↗</span></Link>
              <Link href="/mentoring" className="btn-secondary inline-flex items-center gap-2 text-sm">Find a mentor</Link>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-y-4 border-b border-gray-200 pb-6 sm:grid-cols-4 sm:gap-0">
            <OverviewStat value={data?.credits ?? "—"} label="Credits" />
            <OverviewStat value={data?.continueLearning?.length ?? 0} label="Learning goals" />
            <OverviewStat value={data?.upcomingSessions?.length ?? 0} label="Upcoming sessions" />
            <OverviewStat value={`${avgScore}%`} label="Assessment average" />
          </div>

          <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">
            <div className="space-y-9">
              <Section title="My learning goals" action={{ href: "/my-learning", label: "View all" }}>
                {data?.continueLearning?.length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {data.continueLearning.slice(0, 3).map((skill, index) => (
                      <article key={skill.id} className="soft-goal-card" style={{ background: `linear-gradient(135deg, ${index % 2 === 0 ? '#f2f5ff' : '#f7f3ff'} 0%, ${index % 2 === 0 ? '#eef3ff' : '#f6f0ff'} 100%)` }}>
                        <div>
                          <span className="inline-flex rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{skill.desired_level || "Learning goal"}</span>
                          <h2 className="mt-5 text-xl font-semibold text-slate-900">{skill.skill_name}</h2>
                        </div>
                        <Link href={`/mentors/match?skillId=${skill.skill_id}`} className="mt-5 flex items-center gap-2 border-t border-slate-200 pt-3 text-sm font-semibold text-slate-800">Find a mentor <span aria-hidden>→</span></Link>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="border-y border-gray-200 py-5">
                    <p className="text-sm text-ink-500">Your learning goals will appear here when you choose a skill.</p>
                    <Link href="/explore" className="mt-3 inline-flex text-sm font-semibold text-accent-600">Explore skills <span className="ml-2" aria-hidden>→</span></Link>
                  </div>
                )}
              </Section>

              <Section title="My next sessions" action={{ href: "/my-learning", label: "View learning" }}>
                {data?.upcomingSessions?.length ? (
                  <div className="divide-y divide-gray-200 border-y border-gray-200">
                    {data.upcomingSessions.map((session) => (
                      <div key={session.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink-900">{session.course_title}</p>
                          <p className="mt-1 text-sm text-ink-500">with {session.mentor_name} · {new Date(session.scheduled_start).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                        </div>
                        <Link href={`/session/${session.id}`} className="btn-secondary w-fit shrink-0 text-sm">Open session</Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="border-y border-gray-200 py-5 text-sm text-ink-500">No sessions booked yet. Find a mentor when you are ready for a little guidance.</p>
                )}
              </Section>

              <Section title="Assessment history" action={{ href: "/explore", label: "Take another test" }}>
                {data?.assessmentHistory?.length ? (
                  <div className="divide-y divide-gray-200 border-y border-gray-200">
                    {data.assessmentHistory.map((attempt) => (
                      <div key={attempt.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-ink-900">{attempt.skill_name} · {attempt.classified_level}</p>
                          <p className="text-xs text-ink-500">{Number(attempt.score).toFixed(1)}% · {attempt.correct_count} correct · {attempt.wrong_count} wrong · {attempt.unanswered_count} unanswered · {new Date(attempt.created_at).toLocaleDateString()}</p>
                        </div>
                        <Link href={`/mentors/match?skillId=${attempt.skill_id}&targetLevel=${attempt.classified_level}`} className="btn-secondary w-fit text-xs">Find mentor</Link>
                      </div>
                    ))}
                  </div>
                ) : <p className="border-y border-gray-200 py-4 text-sm text-ink-500">Completed assessments and skill levels will appear here.</p>}
              </Section>
            </div>

            <aside className="space-y-6">
              <section className="flex min-h-[245px] flex-col justify-between rounded-lg bg-[#b8f52b] p-6 text-[#171719]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em]">A good next step</p>
                  <h2 className="mt-5 text-2xl font-semibold leading-tight">{data?.recommendedSkills?.[0]?.name || "Find your next skill"}</h2>
                  <p className="mt-3 text-sm leading-relaxed opacity-75">{data?.recommendedSkills?.[0] ? `${data.recommendedSkills[0].mentor_count} mentors are ready to help.` : "Explore the community course library and find something that sparks your curiosity."}</p>
                </div>
                <Link href={data?.recommendedSkills?.[0] ? `/mentors/match?skillId=${data.recommendedSkills[0].id}` : "/courses"} className="mt-8 inline-flex items-center justify-between rounded bg-[#171719] px-4 py-3 text-sm font-semibold text-white">Explore recommendations <span aria-hidden>↗</span></Link>
              </section>

              <ProgressDonut skills={data?.continueLearning || []} />

              <Section title="Mentors for your goals" action={{ href: "/mentoring", label: "Meet mentors" }}>
                {data?.recommendedMentors?.length ? (
                  <div className="divide-y divide-gray-200 border-y border-gray-200">
                    {data.recommendedMentors.slice(0, 3).map((mentor) => (
                      <div key={mentor.course_id} className="flex items-center gap-3 py-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-100 text-sm font-semibold text-accent-700">
                          {mentor.profile_pic ? <img src={mentor.profile_pic} alt={mentor.mentor_name} className="h-full w-full object-cover" /> : mentor.mentor_name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink-900">{mentor.mentor_name}</p>
                          <p className="truncate text-xs text-ink-500">{mentor.skill_name} · {Number(mentor.avg_rating || 0).toFixed(1)} rating</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="border-y border-gray-200 py-4 text-sm text-ink-500">Add a learning goal to see mentors matched to your interests.</p>}
              </Section>

              <RiddleWidget />
            </aside>
          </div>
        </div>
      )}
    </Layout>
  );
}

function OverviewStat({ value, label }) {
  return (
    <div className="sm:border-l sm:border-gray-200 sm:pl-5 first:sm:border-0 first:sm:pl-0">
      <p className="text-2xl font-semibold leading-none text-ink-900">{value}</p>
      <p className="mt-1.5 text-xs text-ink-500">{label}</p>
    </div>
  );
}

function HeroStat({ value, label }) {
  return (
    <div className="bg-white/10 rounded-xl2 px-4 py-2.5 text-center min-w-[76px]">
      <p className="text-lg font-semibold leading-tight">{value}</p>
      <p className="text-[11px] text-white/60 mt-0.5">{label}</p>
    </div>
  );
}

const CHIP_ICONS = {
  credit: (p) => <svg {...p} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  calendar: (p) => <svg {...p} viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  target: (p) => <svg {...p} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8"/><circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8"/></svg>,
  check: (p) => <svg {...p} viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

// Tailwind's class scanner needs full literal class strings, not interpolated
// template pieces (e.g. `bg-${chip}-bg` never gets generated) — so every chip
// color combination is spelled out here instead.
const CHIP_CLASSES = {
  mint: "bg-mint-bg text-mint-fg",
  peach: "bg-peach-bg text-peach-fg",
  violet: "bg-violet-bg text-violet-fg",
  pink: "bg-pink-bg text-pink-fg",
};

function StatChip({ chip, icon, value, label, href }) {
  const Icon = CHIP_ICONS[icon];
  return (
    <Link href={href} className="card card-hover p-4 flex items-center gap-3 block">
      <div className={`stat-chip-icon ${CHIP_CLASSES[chip]}`}>
        <Icon width={20} height={20} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-semibold text-ink-900 leading-tight">{value}</p>
        <p className="text-xs text-ink-500 truncate">{label}</p>
      </div>
    </Link>
  );
}

function ProgressDonut({ skills }) {
  const counts = { beginner: 0, intermediate: 0, advanced: 0 };
  skills.forEach((s) => {
    const lvl = s.desired_level || "intermediate";
    if (counts[lvl] !== undefined) counts[lvl] += 1;
  });
  const total = counts.beginner + counts.intermediate + counts.advanced;

  let gradient = "#e5e7eb";
  if (total > 0) {
    let acc = 0;
    const segments = Object.entries(counts)
      .filter(([, c]) => c > 0)
      .map(([level, c]) => {
        const start = (acc / total) * 360;
        acc += c;
        const end = (acc / total) * 360;
        return `${LEVEL_DONUT_COLORS[level]} ${start}deg ${end}deg`;
      });
    gradient = segments.join(", ");
  }

  return (
    <div className="card p-5">
      <h2 className="text-base font-semibold text-ink-900 mb-4">My Learning Mix</h2>
      <div className="flex items-center gap-5">
        <div className="donut w-28 h-28 shrink-0" style={{ background: `conic-gradient(${gradient})` }}>
          <div className="donut-hole w-[70px] h-[70px]">
            <span className="text-lg font-semibold text-ink-900">{total}</span>
            <span className="text-[10px] text-ink-500">skills</span>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          {Object.entries(counts).map(([level, c]) => (
            <div key={level} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: LEVEL_DONUT_COLORS[level] }} />
              <span className="text-ink-700 capitalize">{level}</span>
              <span className="text-ink-500 text-xs">({c})</span>
            </div>
          ))}
          {total === 0 && <p className="text-ink-500 text-xs">Add a learning goal to see your mix.</p>}
        </div>
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
