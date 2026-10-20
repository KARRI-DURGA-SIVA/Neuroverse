import { useEffect, useRef, useState } from "react";
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
  const [runId, setRunId] = useState(null);
  const [testStarted, setTestStarted] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [focusLossCount, setFocusLossCount] = useState(0);
  const [warning, setWarning] = useState("");
  const assessmentRef = useRef(null);

  useEffect(() => {
    if (!skillId) return;
    apiFetch(`/api/assessment/${skillId}`).then((d) => {
      setSkill(d.skill);
      setQuestions(d.questions);
    }).catch((err) => setError(err.message || "Could not prepare this assessment."));
  }, [skillId]);

  useEffect(() => {
    if (!testStarted || !runId) return undefined;
    const onVisibilityChange = () => {
      if (!document.hidden) return;
      setWarning("Leaving the assessment was recorded. Return to the test when you're ready.");
      apiFetch(`/api/assessment/${skillId}`, {
        method: "POST",
        body: JSON.stringify({ action: "focus-loss", runId }),
      }).then((data) => setFocusLossCount(data.focusLossCount))
        .catch((requestError) => setWarning(requestError.message || "Could not record this focus change."));
    };
    const onFullscreenChange = () => {
      if (document.fullscreenElement !== assessmentRef.current) {
        setWarning("Fullscreen ended. This assessment remains active; leaving the page is not blocked.");
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [testStarted, runId, skillId]);

  async function startAssessment(fresh = false) {
    setGenerating(true);
    setError("");
    setWarning("");
    try {
      if (!assessmentRef.current?.requestFullscreen) {
        throw new Error("Fullscreen mode is not supported by this browser.");
      }
      await assessmentRef.current.requestFullscreen();
      const run = await apiFetch(`/api/assessment/${skillId}`, {
        method: "POST",
        body: JSON.stringify({ action: fresh ? "generate" : "start" }),
      });
      setSkill(run.skill);
      setQuestions(run.questions);
      setRunId(run.runId);
      setQuestionIndex(0);
      setAnswers({});
      setFocusLossCount(0);
      setTestStarted(true);
    } catch (err) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      setError(err.message || "Could not start the assessment.");
    } finally {
      setGenerating(false);
    }
  }

  async function submit() {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/assessment/${skillId}`, {
        method: "POST",
        body: JSON.stringify({ runId, answers }),
      });
      if (document.fullscreenElement) await document.exitFullscreen();
      setTestStarted(false);
      setResult(res);
    } catch (err) {
      setError(err.message || "Could not submit the assessment. Your answers are still here; try again.");
    } finally {
      setLoading(false);
    }
  }

  function retake() {
    setResult(null);
    setAnswers({});
    startAssessment(true);
  }

  const currentQuestion = questions[questionIndex];

  return (
    <Layout>
      <div ref={assessmentRef} className={testStarted ? "fixed inset-0 z-[100] m-0 max-w-none overflow-y-auto bg-slate-50 p-5 sm:p-8" : "max-w-2xl mx-auto space-y-6"}>
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">{skill ? `${skill.name} Assessment` : "Loading assessment..."}</h1>
          <p className="text-ink-500 text-sm mt-1">
            {skill?.test_type === "code" ? "This test is code-based." : "This test is multiple choice."} Every test has 20 questions: 5 beginner, 5 intermediate, 6 advanced, and 4 expert.
          </p>
        </div>

        {!result && questions.length === 0 && skill && (
          <div className="card p-6">
            <p className="text-sm text-ink-500 mb-4">Your assessment will be prepared when you start. Questions are generated for this skill and saved without replacing existing history.</p>
            <button onClick={startAssessment} disabled={generating} className="btn-primary">
              {generating ? "Preparing your test..." : "Start full-screen assessment"}
            </button>
            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
          </div>
        )}

        {!result && questions.length > 0 && !testStarted && (
          <div className="card space-y-4 border-l-4 border-accent-500 p-5">
            <div>
              <p className="text-sm font-semibold text-ink-900">Assessment ready</p>
              <p className="mt-1 text-xs text-ink-500">20 questions: 5 beginner, 5 intermediate, 6 advanced, and 4 expert. Your score and skill level are saved when you submit.</p>
              <p className="mt-2 text-xs text-ink-500">Tab changes are recorded. You can still use normal browser and computer controls.</p>
            </div>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button onClick={startAssessment} disabled={generating} className="btn-primary">
              {generating ? "Starting assessment..." : "Start full-screen assessment"}
            </button>
          </div>
        )}

        {testStarted && currentQuestion && (
          <div className="mx-auto max-w-3xl space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-accent-600">Question {questionIndex + 1} of {questions.length}</p>
                <p className="mt-1 text-xs text-ink-500">Tab changes recorded: {focusLossCount}</p>
              </div>
              <button type="button" onClick={submit} disabled={loading} className="btn-primary">{loading ? "Grading..." : "Submit assessment"}</button>
            </div>
            <div className="h-2 overflow-hidden rounded bg-slate-200" role="progressbar" aria-valuenow={questionIndex + 1} aria-valuemin={1} aria-valuemax={questions.length}>
              <div className="h-full bg-accent-500" style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} />
            </div>
            {warning && <p role="status" className="border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{warning}</p>}
            {error && <p role="alert" className="border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            {[currentQuestion].map((q) => (
            <div key={q.id} className="card p-5">
              <p className="text-xs font-medium text-accent-600 uppercase tracking-wide mb-1">{q.difficulty} · {q.points} pts</p>
              <p className="font-medium text-ink-900 mb-3">{questionIndex + 1}. {q.question_text}</p>

              {q.question_type === "mcq" ? (
                <div className="space-y-2">
                  {(q.options || []).map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-ink-700">
                      <input
                        type="radio"
                        name={q.id}
                        value={opt}
                        checked={answers[q.id] === opt}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  className="input-field font-mono text-sm h-32"
                  value={answers[q.id] ?? q.starter_code ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                />
              )}
            </div>
            ))}
            <div className="flex justify-between">
              <button type="button" onClick={() => setQuestionIndex((index) => Math.max(0, index - 1))} disabled={questionIndex === 0} className="btn-secondary">Previous</button>
              <button type="button" onClick={() => setQuestionIndex((index) => Math.min(questions.length - 1, index + 1))} disabled={questionIndex === questions.length - 1} className="btn-primary">Next</button>
            </div>
          </div>
        )}

        {result && (
          <div className="card p-6 text-center">
            <p className="text-sm text-ink-500 mb-1">Your score</p>
            <p className="text-3xl font-semibold text-ink-900 mb-2">{result.scorePercent}%</p>
            <p className="text-sm text-ink-700">{result.correctCount} correct · {result.wrongCount} wrong · {result.unansweredCount} unanswered · {result.totalQuestions} questions</p>
            <p className="mt-1 text-xs text-ink-500">{result.earnedPoints} of {result.totalPoints} points · {result.focusLossCount} tab change(s) recorded</p>
            <span className="badge bg-accent-500 text-white text-sm">{result.classifiedLevel === "not_assessed" ? "RETAKE REQUIRED" : result.classifiedLevel.toUpperCase()}</span>
            <p className="text-sm text-ink-500 mt-4">
              {result.classifiedLevel === "not_assessed"
                ? `You need at least 20% to be classified in ${skill?.name}. Please review the material and retake the assessment.`
                : `You're now classified as ${result.classifiedLevel} in ${skill?.name}. You can publish a course under Teach.`}
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <button onClick={retake} className="btn-secondary">Retake with new questions</button>
              <button onClick={() => router.push(`/mentors/match?skillId=${skillId}${["beginner", "intermediate", "advanced", "expert"].includes(result.classifiedLevel) ? `&targetLevel=${result.classifiedLevel}` : ""}`)} className="btn-secondary">Find a mentor</button>
              {result.classifiedLevel !== "not_assessed" && <button onClick={() => router.push("/teach")} className="btn-primary">Go to Teach</button>}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
