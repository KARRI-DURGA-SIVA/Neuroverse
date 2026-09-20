import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { apiFetch } from "../lib/api-client";

export default function Teach() {
  const [knownSkills, setKnownSkills] = useState([]);
  const [myCourses, setMyCourses] = useState([]);
  const [form, setForm] = useState({ skillId: "", title: "", description: "" });
  const [msg, setMsg] = useState("");

  async function load() {
    const us = await apiFetch("/api/user/skills");
    setKnownSkills(us.skills.filter((s) => s.type === "known" && s.level && s.level !== "not_assessed"));
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

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
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
      </div>
    </Layout>
  );
}
