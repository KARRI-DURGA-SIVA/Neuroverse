import { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "../components/Layout";
import { apiFetch } from "../lib/api-client";

const COURSE_ACCENTS = ["#2858e8", "#ff4f32", "#171719", "#7eaa16"];

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All courses");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [hours, setHours] = useState("1");
  const [skillLevel, setSkillLevel] = useState("beginner");
  const [requestKey, setRequestKey] = useState("");
  const [skillLevelFactors, setSkillLevelFactors] = useState({ beginner: 0.5, intermediate: 1, advanced: 1.5 });
  const [scheduledStart, setScheduledStart] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookingMessage, setBookingMessage] = useState("");
  const [bookingComplete, setBookingComplete] = useState(false);

  useEffect(() => {
    apiFetch("/api/courses")
      .then((data) => {
        setCourses(data.courses || []);
        if (data.skillLevelFactors) setSkillLevelFactors(data.skillLevelFactors);
      })
      .catch((err) => { setCourses([]); setError(err.message || "Could not load courses."); })
      .finally(() => setLoading(false));
    apiFetch("/api/sessions").then((data) => setSessions(data.sessions || [])).catch(() => {});
  }, []);

  const categories = [
    "All courses",
    "Programming",
    "Languages",
    "Data & Analytics",
    "Creative",
    ...new Set(courses.map((course) => course.category).filter(Boolean)),
  ].filter((item, index, items) => items.indexOf(item) === index);
  const visibleCourses = courses.filter((course) => {
    const matchesCategory = category === "All courses" || course.category === category;
    const searchable = [course.title, course.skill_name, course.description, course.mentor_name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return matchesCategory && searchable.includes(query.toLowerCase());
  });
  const displayedCourses = visibleCourses;

  async function bookCourse(user) {
    if (!selectedCourse || !hours || !scheduledStart) return;
    const requestedStart = new Date(scheduledStart);
    const requestedEnd = requestedStart.getTime() + Number(hours) * 60 * 60 * 1000;
    const overlappingSession = sessions.find((session) => {
      if (!["pending", "accepted", "meeting_pending", "confirmed", "in_progress"].includes(session.status)) return false;
      const involvesUser = session.learner_id === user.id || session.mentor_id === user.id
        || session.learner_id === selectedCourse.mentor_id || session.mentor_id === selectedCourse.mentor_id;
      const sessionStart = new Date(session.scheduled_start).getTime();
      const sessionEnd = sessionStart + Number(session.hours) * 60 * 60 * 1000;
      return involvesUser && requestedStart.getTime() < sessionEnd && requestedEnd > sessionStart;
    });
    if (overlappingSession) {
      setBookingMessage("You already have a pending or booked session at this time. Choose a different time.");
      return;
    }

    setBooking(true);
    setBookingMessage("");
    try {
      const result = await apiFetch("/api/sessions/book", {
        method: "POST",
        body: JSON.stringify({ courseId: selectedCourse.id, hours, scheduledStart, skillLevel, requestKey }),
      });
      setSessions((current) => [...current, result.session]);
      setBookingComplete(true);
    } catch (err) {
      setBookingMessage(err.message || "We could not book this session. Please try again.");
    } finally {
      setBooking(false);
    }
  }

  return (
    <Layout>
      {({ user }) => (
      <div className="space-y-7 pb-10">
        <div className="hero-dark marketplace-banner">
          <div className="hero-glow-a" />
          <div className="hero-glow-b" />
          <div className="relative z-10 flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-200">NeuroVerse community</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">Learn from mentors who turn skills into momentum.</h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-200">Explore short, practical sessions built by members who have already mastered the skills you want to grow.</p>
            </div>
            <div className="flex items-center gap-3 self-start md:self-auto">
              <Link href="/teach" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[#171719] transition-colors hover:bg-slate-100">
                Share your expertise <span aria-hidden>↗</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full max-w-lg">
            <span className="sr-only">Search courses and mentors</span>
            <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
              <path d="m16 16 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input className="input-field pl-10" placeholder="Search courses, skills, or mentors" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <p className="text-sm text-ink-500">{loading ? "Loading courses..." : `${displayedCourses.length} ${displayedCourses.length === 1 ? "course" : "courses"}`}</p>
        </div>

        <nav aria-label="Filter courses by category" className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`shrink-0 rounded-md border px-3.5 py-2 text-sm capitalize transition-colors ${category === item ? "border-[#2858e8] bg-[#2858e8] text-white" : "border-gray-300 bg-white text-ink-700 hover:border-ink-500"}`}
            >
              {item}
            </button>
          ))}
        </nav>

        {!loading && displayedCourses.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {displayedCourses.map((course, index) => (
              <article key={course.id} className="course-discovery-card" style={{ '--course-accent': COURSE_ACCENTS[index % COURSE_ACCENTS.length] }}>
                <div className="course-discovery-card__bar" style={{ backgroundColor: COURSE_ACCENTS[index % COURSE_ACCENTS.length] }} />
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="course-tag">{course.category || course.skill_name}</span>
                  </div>
                  <h2 className="mt-4 text-xl font-semibold leading-snug text-ink-900">{course.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-500">{course.description || `Build your ${course.skill_name} skills with a NeuroVerse mentor.`}</p>

                  <div className="mt-auto border-t border-gray-200 pt-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e8edff] text-sm font-semibold text-[#2858e8]">
                        {course.mentor_profile_pic
                          ? <img src={course.mentor_profile_pic} alt={course.mentor_name} className="h-full w-full object-cover" />
                          : (course.mentor_name || "M").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-sm font-semibold text-ink-900">{course.mentor_name}</p>
                          {course.avg_rating && <span className="text-xs text-ink-500">{Number(course.avg_rating).toFixed(1)} ★</span>}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-ink-500">{course.mentor_bio || `${course.mentor_level} ${course.skill_name} mentor`}</p>
                        {course.mentor_languages?.length > 0 && <p className="mt-1 text-xs text-ink-500">{course.mentor_languages.join(" · ")}</p>}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-xs text-ink-500"><span className="font-semibold text-ink-900">{Number(course.price_per_hour || course.base_rate_credits).toFixed(0)} credits</span> / hour</p>
                      <div className="flex items-center gap-2">
                        <Link href={`/courses/${course.id}`} className="btn-secondary px-3 py-2 text-sm">View</Link>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCourse(course);
                            setBookingMessage("");
                            setBookingComplete(false);
                            setHours("1");
                            setSkillLevel("beginner");
                            setRequestKey(createRequestKey());
                            setScheduledStart("");
                          }}
                          className="rounded-md bg-[#5149e8] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#423bd0]"
                        >
                          {getActiveCourseSession(sessions, course.id, user.id) ? "Choose time" : "Book"}
                        </button>
                      </div>
                    </div>
                    {getActiveCourseSession(sessions, course.id, user.id) && (
                      <p className="mt-2 text-right text-xs text-ink-500">
                        {getActiveCourseSession(sessions, course.id, user.id).status === "pending" ? "Request awaiting mentor" : getActiveCourseSession(sessions, course.id, user.id).status === "accepted" ? "Awaiting your schedule confirmation" : getActiveCourseSession(sessions, course.id, user.id).status === "meeting_pending" ? "Setting up Zoom meeting" : "Already booked"}
                        {" · "}{new Date(getActiveCourseSession(sessions, course.id, user.id).scheduled_start).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {!loading && displayedCourses.length === 0 && (
          <div className="border-y border-gray-200 py-12 text-center">
            <h2 className="text-lg font-semibold text-ink-900">No courses found</h2>
            <p className="mt-2 text-sm text-ink-500">Try a different search or category, or be the first to share what you know.</p>
            <Link href="/teach" className="mt-4 inline-flex text-sm font-semibold text-accent-600">Create a course <span className="ml-2" aria-hidden>→</span></Link>
          </div>
        )}

        {selectedCourse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#182039]/45 px-4 py-6" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !booking) setSelectedCourse(null);
          }}>
            <section role="dialog" aria-modal="true" aria-labelledby="booking-title" className="w-full max-w-md bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5149e8]">{bookingComplete ? "Mentor notified" : "Book a mentoring session"}</p>
                  <h2 id="booking-title" className="mt-2 text-xl font-semibold text-ink-900">{bookingComplete ? "Request sent" : selectedCourse.title}</h2>
                  {!bookingComplete && <p className="mt-1 text-sm text-ink-500">with {selectedCourse.mentor_name}</p>}
                </div>
                <button type="button" aria-label="Close booking dialog" disabled={booking} onClick={() => setSelectedCourse(null)} className="flex h-8 w-8 shrink-0 items-center justify-center text-lg text-ink-500 hover:bg-gray-100">×</button>
              </div>
              {bookingComplete ? (
                <div className="mt-5 border-y border-gray-200 py-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e6f7ee] text-xl font-semibold text-[#16864b]" aria-label="Success">✓</div>
                  <p className="mt-4 text-sm leading-relaxed text-ink-700">Your request was sent to {selectedCourse.mentor_name}. They will review the time and you’ll get a notification when they respond.</p>
                  <p className="mt-2 text-xs text-ink-500">This session is not booked yet. No credits are charged until the mentor accepts and you confirm the schedule.</p>
                  <button type="button" onClick={() => setSelectedCourse(null)} className="btn-primary mt-5 text-sm">Done</button>
                </div>
              ) : (
                <>
                  <p className="mt-4 border-y border-gray-200 py-3 text-sm text-ink-500">{Number(selectedCourse.price_per_hour || selectedCourse.base_rate_credits).toFixed(0)} credits per hour. The final total includes the platform fee.</p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="booking-level" className="label">Your target skill level</label>
                      <select id="booking-level" className="input-field" value={skillLevel} onChange={(event) => setSkillLevel(event.target.value)}>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                        <option value="expert">Expert</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="booking-hours" className="label">Duration</label>
                      <input id="booking-hours" type="number" min="0.5" max="8" step="0.5" className="input-field" value={hours} onChange={(event) => setHours(event.target.value)} />
                    </div>
                    <div>
                      <label htmlFor="booking-time" className="label">Start time</label>
                      <input id="booking-time" type="datetime-local" min={new Date().toISOString().slice(0, 16)} className="input-field" value={scheduledStart} onChange={(event) => setScheduledStart(event.target.value)} />
                    </div>
                  </div>
                  {(() => {
                    const mentorFactor = skillLevelFactors[selectedCourse.mentor_level] || 1;
                    const hourly = Number(selectedCourse.price_per_hour || selectedCourse.base_rate_credits) * (skillLevelFactors[skillLevel] || 1) / mentorFactor;
                    const estimate = Math.round(hourly * Number(hours || 0) * 1.1 * 100) / 100;
                    return <p className="mt-4 text-sm text-ink-700">Estimated total: <strong>{estimate.toFixed(2)} credits</strong> for {hours || 0} hour(s), including the platform fee. Final price is confirmed by the server.</p>;
                  })()}
                  {bookingMessage && <p role="alert" className="mt-4 text-sm text-red-700">{bookingMessage}</p>}
                  <div className="mt-6 flex justify-end gap-2">
                    <button type="button" disabled={booking} onClick={() => setSelectedCourse(null)} className="btn-secondary text-sm">Cancel</button>
                    <button type="button" disabled={booking || !hours || !scheduledStart} onClick={() => bookCourse(user)} className="btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-50">{booking ? "Sending request..." : "Send request"}</button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
      )}
    </Layout>
  );
}

function getActiveCourseSession(sessions, courseId, userId) {
  return sessions.find((session) => session.course_id === courseId
    && session.learner_id === userId
    && ["pending", "accepted", "meeting_pending", "confirmed", "in_progress"].includes(session.status));
}

function createRequestKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}