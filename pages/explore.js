import { useEffect, useState } from "react";
import Link from "next/link";
import Layout from "../components/Layout";
import { apiFetch } from "../lib/api-client";

export default function Explore() {
  const [skills, setSkills] = useState([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    apiFetch("/api/skills").then((d) => setSkills(d.skills));
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
      </div>
    </Layout>
  );
}
