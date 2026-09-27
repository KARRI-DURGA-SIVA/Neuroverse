// lib/classification.js
// Classifies a user's skill level from an assessment score (percentage 0-100).
// Thresholds are centralized here so they're easy to tune later.

const LEVEL_THRESHOLDS = {
  EXPERT_MIN: 90, // score >= 90% => expert
  ADVANCED_MIN: 70, // 70% <= score < 90% => advanced
  INTERMEDIATE_MIN: 50, // 50% <= score < 80% => intermediate
  BEGINNER_MIN: 20, // 20% <= score < 50% => beginner
  // score < 20% => not assessed
};

function classifyLevel(scorePercent) {
  if (scorePercent >= LEVEL_THRESHOLDS.EXPERT_MIN) return "expert";
  if (scorePercent >= LEVEL_THRESHOLDS.ADVANCED_MIN) return "advanced";
  if (scorePercent >= LEVEL_THRESHOLDS.INTERMEDIATE_MIN) return "intermediate";
  if (scorePercent >= LEVEL_THRESHOLDS.BEGINNER_MIN) return "beginner";
  return "not_assessed";
}

function normalizedCode(code) {
  return code.toString().toLowerCase().replace(/#.*$/gm, "").replace(/\/\/.*$/gm, "").replace(/\s+/g, " ").trim();
}

function hasCodeToken(code, token) {
  if (/^[+\-*/%=<>]+$/.test(token)) return code.includes(token);
  return new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(code);
}

function codeMatchesReference(question, submitted) {
  const code = normalizedCode(submitted);
  if (code.length < 5) return false;

  const prompt = question.question_text.toLowerCase();
  if (prompt.includes("palindrome")) {
    return (code.includes("lower") || code.includes("casefold")) &&
      (code.includes("[::-1]") || code.includes("reversed") || code.includes("reverse"));
  }
  if (prompt.includes("fibonacci") && prompt.includes("memoization")) {
    return (code.includes("fib") || code.includes("fibonacci")) &&
      (code.includes("memo") || code.includes("cache") || code.includes("lru_cache"));
  }

  const referenceTokens = normalizedCode(question.correct_answer).match(/[a-z_][a-z0-9_]*|[+\-*/%=<>]+/g) || [];
  const ignored = new Set(["the", "and", "or", "implementation", "solution", "code", "result"]);
  const requiredTokens = [...new Set(referenceTokens)].filter((token) => !ignored.has(token));
  if (requiredTokens.length === 0) return code.length > 5;

  const aliases = { memoized: ["memoized", "memo", "cache"], fibonacci: ["fibonacci", "fib"], length: ["length", "len"] };
  const requiredOperators = requiredTokens.filter((token) => /^[+\-*/%=<>]+$/.test(token));
  if (!requiredOperators.every((operator) => hasCodeToken(code, operator))) return false;
  const hits = requiredTokens.filter((token) =>
    (aliases[token] || [token]).some((candidate) => hasCodeToken(code, candidate))
  ).length;
  return hits / requiredTokens.length >= 0.6;
}

// Scores a submitted assessment against the question bank.
// answers: { [questionId]: submittedAnswer }
// questions: rows from assessment_questions
// For code questions we do a lightweight keyword/structure match since we don't
// execute arbitrary code server-side in this scaffold. Swap in a real sandboxed
// code runner (e.g. Judge0, Piston API) for production-grade grading.
function scoreAssessment(questions, answers) {
  let totalPoints = 0;
  let earnedPoints = 0;
  const breakdown = [];

  for (const q of questions) {
    totalPoints += Number(q.points);
    const submitted = (answers[q.id] || "").toString().trim();
    let correct = false;

    if (q.question_type === "mcq") {
      correct = submitted.toLowerCase() === q.correct_answer.toLowerCase().trim();
    } else if (q.question_type === "code") {
      correct = codeMatchesReference(q, submitted);
    }

    if (correct) earnedPoints += Number(q.points);
    breakdown.push({ questionId: q.id, correct, points: q.points });
  }

  const scorePercent = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
  return {
    scorePercent: Math.round(scorePercent * 100) / 100,
    classifiedLevel: classifyLevel(scorePercent),
    breakdown,
  };
}

module.exports = { classifyLevel, scoreAssessment, LEVEL_THRESHOLDS };
