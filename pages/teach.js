import { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "../components/Layout";
import { apiFetch } from "../lib/api-client";

export default function Teach() {
  const [knownSkills, setKnownSkills] = useState([]);
  const [myCourses, setMyCourses] = useState([]);
  const [form, setForm] = useState({ skillId: "", title: "", description: "", availability: "" });
  const [msg, setMsg] = useState("");
  const [workingCourseId, setWorkingCourseId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requestKey, setRequestKey] = useState("");

  async function load() {
    try {
      const [skillsData, coursesData] = await Promise.all([
        apiFetch("/api/user/skills"),
        apiFetch("/api/courses?mine=true"),
      ]);
      setKnownSkills(skillsData.skills.filter((s) => s.type === "known" && s.level && s.level !== "not_assessed"));
      setMyCourses(coursesData.courses || []);
    } catch (error) {
      setMsg(error.message || "Could not load your teaching data.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function publish(e) {
    e.preventDefault();
    setMsg("");
    const title = form.title.trim();
    const description = form.description.trim();
    const availability = form.availability.trim();
    if (!form.skillId || title.length < 3 || title.length > 120 || description.length > 2000 || availability.length > 200) {
      setMsg("Choose an assessed skill, enter a 3-120 character title, and keep description and availability within their limits.");
      return;
    }
    if (submitting) return;
    const publishKey = requestKey || createPublishKey();
    setRequestKey(publishKey);
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/courses", {
        method: "POST",
        body: JSON.stringify({ skillId: form.skillId, title, description, availability, requestKey: publishKey }),
      });
      setMyCourses((c) => [res.course, ...c]);
      setMsg("Course published successfully.");
      setForm({ skillId: "", title: "", description: "", availability: "" });
      setRequestKey("");
    } catch (err) {
      setMsg(err.message || "Course could not be published. Your entries are saved; please retry.");
    } finally {
      setSubmitting(false);
    }
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setRequestKey("");
  }

  async function withdrawCourse(courseId) {
    if (!window.confirm("Withdraw this published course? Learners will no longer see it in the marketplace.")) return;

    setWorkingCourseId(courseId);
    try {
      await apiFetch(`/api/courses/${courseId}`, { method: "DELETE" });
      setMyCourses((courses) => courses.filter((course) => course.id !== courseId));
      setMsg("Course withdrawn successfully.");
    } catch (err) {
      setMsg(err.message || "Unable to withdraw this course.");
    } finally {
      setWorkingCourseId("");
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Teach a skill</h1>
          <p className="text-ink-500 text-sm mt-1">
            Publish a course for any skill you've completed the assessment for. Your session base rate is calculated automatically from your classified level, the skill's difficulty, and your mentor reputation.
          </p>
        </div>

        {knownSkills.length === 0 ? (
          <div className="card p-6 text-sm text-ink-500">
            You haven't taken any skill assessments yet. Head to <strong>Explore Skills</strong> and take a test to get classified before publishing a course.
          </div>
        ) : (
            <form onSubmit={publish} className="card p-6 space-y-4">
            <div>
              <label className="label">Skill</label>
              <select className="input-field" required value={form.skillId} onChange={(e) => updateForm("skillId", e.target.value)}>
                <option value="">Select an assessed skill</option>
                {knownSkills.map((s) => (
                  <option key={s.skill_id} value={s.skill_id}>{s.skill_name} — {s.level}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Course title</label>
              <input className="input-field" required minLength={3} maxLength={120} value={form.title} onChange={(e) => updateForm("title", e.target.value)} placeholder="e.g. Python for Beginners" />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input-field h-24" maxLength={2000} value={form.description} onChange={(e) => updateForm("description", e.target.value)} placeholder="What will learners get from this course?" />
            </div>
            <div>
              <label className="label">Availability</label>
              <input className="input-field" maxLength={200} value={form.availability} onChange={(e) => updateForm("availability", e.target.value)} placeholder="e.g. Weekday evenings, 6-9 PM" />
            </div>
            {msg && <p role="status" className="text-sm text-accent-700">{msg}</p>}
            <button disabled={submitting} className="btn-primary disabled:opacity-60">{submitting ? "Publishing..." : "Publish course"}</button>
          </form>
        )}

        <section className="card p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink-900">Your published courses</h2>
            <span className="text-sm text-ink-500">{myCourses.length} active</span>
          </div>

          {myCourses.length === 0 ? (
            <p className="text-sm text-ink-500">You haven't published any courses yet.</p>
          ) : (
            <div className="space-y-3">
              {myCourses.map((course) => (
                <div key={course.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-base font-semibold text-ink-900">{course.title}</p>
                      <p className="text-sm text-ink-500">{course.skill_name || "Skill"}</p>
                      <p className="text-xs text-ink-500">{Number(course.price_per_hour || 0).toFixed(1)} credits/hour{course.availability_text ? ` · ${course.availability_text}` : " · Availability not listed"}</p>
                    </div>
                    <button
                      type="button"
                      disabled={workingCourseId === course.id}
                      onClick={() => withdrawCourse(course.id)}
                      className="btn-secondary text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {workingCourseId === course.id ? "Withdrawing..." : "Withdraw course"}
                    </button>
                  </div>
                  {course.description && <p className="mt-3 text-sm text-ink-600">{course.description}</p>}
                  <Link href={`/courses/${course.id}`} className="mt-3 inline-flex text-sm font-semibold text-accent-600">View course details</Link>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}

function createPublishKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
