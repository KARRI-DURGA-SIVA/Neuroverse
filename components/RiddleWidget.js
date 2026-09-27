import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api-client";

// Optional "skill riddle" game shown on login/dashboard visit.
// - Riddles are related to skills the user already knows.
// - A correct answer earns 1 credit, capped at 5 credits/day total.
// - Fully skippable — dismissing just hides the card for this visit.
export default function RiddleWidget() {
  const [state, setState] = useState({ status: "loading" }); // loading | hidden | ready | answered
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch("/api/riddle/today")
      .then((d) => {
        if (!d.available) {
          setState({ status: "hidden", ...d });
        } else {
          setState({ status: "ready", ...d });
        }
      })
      .catch(() => setState({ status: "hidden" }));
  }, []);

  async function submitAnswer(e) {
    e.preventDefault();
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    try {
      const d = await apiFetch("/api/riddle/answer", {
        method: "POST",
        body: JSON.stringify({ riddleId: state.riddle.id, answer }),
      });
      setResult(d);
      setState((s) => ({ ...s, status: "answered" }));
    } catch (err) {
      setResult({ error: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === "loading" || state.status === "hidden") return null;

  return (
    <div className="card p-5 border-accent-200 bg-gradient-to-br from-accent-50/60 to-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧩</span>
          <h3 className="font-semibold text-ink-900 text-sm">Daily Skill Riddle</h3>
          <span className="badge bg-accent-100 text-accent-700">optional</span>
        </div>
        {state.status === "ready" && (
          <button
            onClick={() => setState({ status: "hidden" })}
            className="text-xs text-ink-500 hover:text-ink-700"
          >
            Skip
          </button>
        )}
      </div>

      {state.status === "ready" && (
        <form onSubmit={submitAnswer} className="mt-3 space-y-3">
          <p className="text-sm text-ink-900">{state.riddle.question}</p>
          {state.riddle.hint && (
            <p className="text-xs text-ink-500 italic">Hint: {state.riddle.hint}</p>
          )}
          <div className="flex gap-2">
            <input
              className="input-field"
              placeholder="Your answer..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              autoFocus
            />
            <button className="btn-primary text-sm whitespace-nowrap" disabled={submitting}>
              {submitting ? "Checking..." : "Submit"}
            </button>
          </div>
          <p className="text-xs text-ink-500">
            Answer correctly to earn {state.creditsPerCorrectAnswer || 1} credit · {Math.max(0, (state.maxDailyCredits || 5) - (state.creditsToday || 0))} of {state.maxDailyCredits || 5} daily riddle credits left today
          </p>
        </form>
      )}

      {state.status === "answered" && result && !result.error && (
        <div className="mt-3">
          {result.correct ? (
            <p className="text-sm text-green-700 font-medium">
              ✅ Correct! {result.creditsAwarded > 0
                ? `You earned ${result.creditsAwarded} credit.`
                : "You've already hit today's riddle credit cap, but nice work!"}
            </p>
          ) : (
            <p className="text-sm text-red-600 font-medium">
              ❌ Not quite. The answer was "{result.correctAnswer}".
            </p>
          )}
          <p className="text-xs text-ink-500 mt-1">
            {result.creditsToday ?? 0} of {result.maxDailyCredits ?? 5} daily riddle credits earned today.
          </p>
        </div>
      )}

      {state.status === "answered" && result?.error && (
        <p className="text-sm text-red-600 mt-3">{result.error}</p>
      )}
    </div>
  );
}
