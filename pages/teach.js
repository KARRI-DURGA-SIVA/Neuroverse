import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { apiFetch } from "../lib/api-client";

export default function Teach() {
  const [knownSkills, setKnownSkills] = useState([]);
  const [myCourses, setMyCourses] = useState([]);
  const [form, setForm] = useState({ skillId: "", title: "", description: "" });
  const [msg, setMsg] = useState("");
  const [workingCourseId, setWorkingCourseId] = useState("");

  async function load() {
    const [skillsData, coursesData] = await Promise.all([
      apiFetch("/api/user/skills"),
      apiFetch("/api/courses?mine=true"),
    ]);

    setKnownSkills(skillsData.skills.filter((s) => s.type === "known" && s.level && s.level !== "not_assessed"));
    setMyCourses(coursesData.courses || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function publish(e) {
    e.preventDefault();
    setMsg("");
    try {
      const res = await apiFetch("/api/courses", { method: "POST", body: JSON.stringify(form) });
      setMyCourses((c) => [res.course, ...c]);
      setMsg("Course published successfully.");
      setForm({ skillId: "", title: "", description: "" });
    } catch (err) {
      setMsg(err.message);
    }
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
              <select className="input-field" required value={form.skillId} onChange={(e) => setForm((f) => ({ ...f, skillId: e.target.value }))}>
                <option value="">Select an assessed skill</option>
                {knownSkills.map((s) => (
                  <option key={s.skill_id} value={s.skill_id}>{s.skill_name} — {s.level}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Course title</label>
              <input className="input-field" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Python for Beginners" />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input-field h-24" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What will learners get from this course?" />
            </div>
            {msg && <p className="text-sm text-accent-700">{msg}</p>}
            <button className="btn-primary">Publish course</button>
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
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
