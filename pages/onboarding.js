import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { apiFetch } from "../lib/api-client";

export default function Onboarding() {
  const [skills, setSkills] = useState([]);
  const [known, setKnown] = useState([]);
  const [learning, setLearning] = useState([]);
  const [customKnown, setCustomKnown] = useState("");
  const [customLearning, setCustomLearning] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    apiFetch("/api/skills").then((d) => setSkills(d.skills));
  }, []);

  function toggle(list, setList, skillId) {
    setList((prev) => (prev.includes(skillId) ? prev.filter((x) => x !== skillId) : [...prev, skillId]));
  }

  async function addCustom(which) {
    const name = which === "known" ? customKnown : customLearning;
    if (!name.trim()) return;
    const { skill } = await apiFetch("/api/skills", { method: "POST", body: JSON.stringify({ name }) });
    setSkills((prev) => (prev.find((s) => s.id === skill.id) ? prev : [...prev, skill]));
    if (which === "known") {
      setKnown((prev) => [...prev, skill.id]);
      setCustomKnown("");
    } else {
      setLearning((prev) => [...prev, skill.id]);
      setCustomLearning("");
    }
  }

  async function finish() {
    setSaving(true);
    try {
      await apiFetch("/api/user/skills", {
        method: "POST",
        body: JSON.stringify({
          known,
          learning: learning.map((skillId) => ({ skillId, desiredLevel: "intermediate" })),
        }),
      });
      router.push("/dashboard");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fafafa] px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-2xl card p-8">
        <h1 className="text-xl font-semibold text-ink-900 mb-1">Tell us about your skills</h1>
        <p className="text-sm text-ink-500 mb-8">Select what you already know and what you'd like to learn. Can't find it? Type it in — we'll add it.</p>

        <SkillPicker
          title="Skills I know (can teach)"
          skills={skills}
          selected={known}
          onToggle={(id) => toggle(known, setKnown, id)}
          customValue={customKnown}
          onCustomChange={setCustomKnown}
          onAddCustom={() => addCustom("known")}
        />

        <div className="h-6" />

        <SkillPicker
          title="Skills I want to learn"
          skills={skills}
          selected={learning}
          onToggle={(id) => toggle(learning, setLearning, id)}
          customValue={customLearning}
          onCustomChange={setCustomLearning}
          onAddCustom={() => addCustom("learning")}
          accent="indigo"
        />

        <button onClick={finish} disabled={saving} className="btn-primary w-full mt-8">
          {saving ? "Saving..." : "Continue to Dashboard"}
        </button>
      </div>
    </div>
  );
}

function SkillPicker({ title, skills, selected, onToggle, customValue, onCustomChange, onAddCustom }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-ink-900 mb-3">{title}</h2>
      <div className="flex flex-wrap gap-2 mb-3">
        {skills.map((s) => {
          const active = selected.includes(s.id);
          return (
            <button
              type="button"
              key={s.id}
              onClick={() => onToggle(s.id)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                active ? "bg-accent-500 border-accent-500 text-white" : "bg-white border-gray-300 text-ink-700 hover:border-accent-400"
              }`}
            >
              {s.name}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <input
          className="input-field"
          placeholder="Not listed? Type a skill and press Add"
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAddCustom())}
        />
        <button type="button" onClick={onAddCustom} className="btn-secondary shrink-0">Add</button>
      </div>
    </div>
  );
}
