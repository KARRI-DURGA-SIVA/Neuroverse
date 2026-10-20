import { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "../components/Layout";
import { apiFetch } from "../lib/api-client";

export default function Explore() {
  const [skills, setSkills] = useState([]);
  const [courses, setCourses] = useState([]);
  const [courseError, setCourseError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    apiFetch("/api/skills").then((d) => setSkills(d.skills));
    apiFetch("/api/courses")
      .then((data) => setCourses(data.courses || []))
      .catch((error) => setCourseError(error.message || "Could not load published courses."));
  }, []);

  const filtered = skills.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Explore Skills</h1>
          <p className="text-ink-500 text-sm mt-1">Find a skill, then get matched with the most suitable mentor.</p>
        </div>

        <input
          className="input-field max-w-md"
          placeholder="Search skills..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <div key={s.id} className="card card-hover p-5 flex flex-col justify-between">
              <div>
                <span className="badge bg-ink-100 text-ink-700 mb-2">{s.category}</span>
                <h3 className="font-semibold text-ink-900">{s.name}</h3>
                <p className="text-xs text-ink-500 mt-1">Difficulty weight: {Number(s.difficulty_factor).toFixed(1)}x</p>
              </div>
              <div className="flex gap-2 mt-4">
                <Link href={`/mentors/match?skillId=${s.id}`} className="btn-primary text-sm flex-1 text-center">Find mentor</Link>
                <Link href={`/assessment/${s.id}`} className="btn-secondary text-sm flex-1 text-center">Take test</Link>
              </div>
            </div>
          ))}
        </div>

        <section className="space-y-4 border-t border-gray-200 pt-6">
          <div>
            <h2 className="text-xl font-semibold text-ink-900">Published courses</h2>
            <p className="mt-1 text-sm text-ink-500">Courses published by assessed mentors in the NeuroVerse community.</p>
          </div>
          {courseError ? (
            <p role="alert" className="text-sm text-red-700">{courseError}</p>
          ) : courses.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <article key={course.id} className="card flex flex-col p-5">
                  <p className="text-xs font-semibold uppercase text-accent-600">{course.skill_name}</p>
                  <h3 className="mt-2 text-base font-semibold text-ink-900">{course.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm text-ink-500">{course.description || "No description provided."}</p>
                  <p className="mt-3 text-xs text-ink-600">{course.mentor_name} · {Number(course.avg_rating || 0).toFixed(1)} rating · {Number(course.price_per_hour).toFixed(1)} credits/hour</p>
                  <Link href={`/courses/${course.id}`} className="btn-secondary mt-4 self-start text-sm">View course</Link>
                </article>
              ))}
            </div>
          ) : (
            <p className="border-y border-gray-200 py-5 text-sm text-ink-500">No active community courses are published yet.</p>
          )}
        </section>
      </div>
    </Layout>
  );
}
