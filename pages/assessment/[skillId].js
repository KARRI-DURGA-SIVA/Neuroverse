import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../../components/Layout";
import { apiFetch } from "../../lib/api-client";

export default function Assessment() {
  const router = useRouter();
  const { skillId } = router.query;
  const [skill, setSkill] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!skillId) return;
    apiFetch(`/api/assessment/${skillId}`).then((d) => {
      setSkill(d.skill);
      setQuestions(d.questions);
    });
  }, [skillId]);

  async function submit() {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/assessment/${skillId}`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      });
      setResult(res);
    } finally {
      setLoading(false);
    }
  }

  async function generateQuestions() {
    setGenerating(true);
    setError("");
    try {
      const data = await apiFetch(`/api/assessment/${skillId}`, {
        method: "POST",
        body: JSON.stringify({ action: "generate" }),
      });
      setQuestions(data.questions);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">{skill ? `${skill.name} Assessment` : "Loading assessment..."}</h1>
          <p className="text-ink-500 text-sm mt-1">
            {skill?.test_type === "code" ? "This test is code-based." : "This test is multiple choice."} We'll classify you as beginner, intermediate, or advanced.
          </p>
        </div>

        {!result && questions.length === 0 && skill && (
          <div className="card p-6">
            <p className="text-sm text-ink-500 mb-4">No questions are configured for this skill yet.</p>
            <button onClick={generateQuestions} disabled={generating} className="btn-primary">
              {generating ? "Framing your test..." : "Generate a fresh test"}
            </button>
            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
          </div>
        )}

        {!result &&
          questions.map((q, idx) => (
            <div key={q.id} className="card p-5">
              <p className="text-xs font-medium text-accent-600 uppercase tracking-wide mb-1">{q.difficulty} · {q.points} pts</p>
              <p className="font-medium text-ink-900 mb-3">{idx + 1}. {q.question_text}</p>

              {q.question_type === "mcq" ? (
                <div className="space-y-2">
                  {(q.options || []).map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-ink-700">
                      <input
                        type="radio"
                        name={q.id}
                        value={opt}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  className="input-field font-mono text-sm h-32"
                  defaultValue={q.starter_code || ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                />
              )}
            </div>
          ))}

        {!result && questions.length > 0 && (
          <button onClick={submit} disabled={loading} className="btn-primary">
            {loading ? "Grading..." : "Submit assessment"}
          </button>
        )}

        {result && (
          <div className="card p-6 text-center">
            <p className="text-sm text-ink-500 mb-1">Your score</p>
            <p className="text-3xl font-semibold text-ink-900 mb-2">{result.scorePercent}%</p>
            <span className="badge bg-accent-500 text-white text-sm">{result.classifiedLevel === "not_assessed" ? "RETAKE REQUIRED" : result.classifiedLevel.toUpperCase()}</span>
            <p className="text-sm text-ink-500 mt-4">
              {result.classifiedLevel === "not_assessed"
                ? `You need at least 20% to be classified in ${skill?.name}. Please review the material and retake the assessment.`
                : `You're now classified as ${result.classifiedLevel} in ${skill?.name}. You can publish a course under Teach.`}
            </p>
            {result.classifiedLevel !== "not_assessed" && <button onClick={() => router.push("/teach")} className="btn-primary mt-4">Go to Teach</button>}
          </div>
        )}
      </div>
    </Layout>
  );
}
