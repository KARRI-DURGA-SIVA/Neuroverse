const DIFFICULTIES = ["beginner", "intermediate", "advanced"];

function parseJsonResponse(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Gemini returned invalid question JSON");
  return JSON.parse(candidate.slice(start, end + 1));
}

function validateQuestions(payload, testType) {
  if (!Array.isArray(payload.questions) || payload.questions.length !== 6) {
    throw new Error("Gemini must return exactly six assessment questions");
  }

  const counts = Object.fromEntries(DIFFICULTIES.map((difficulty) => [difficulty, 0]));
  const questions = payload.questions.map((question) => {
    if (!DIFFICULTIES.includes(question.difficulty)) throw new Error("Invalid question difficulty");
    if (!['mcq', 'code'].includes(question.question_type)) throw new Error("Invalid question type");
    if (!question.question_text || !question.correct_answer) throw new Error("Question text and answer are required");
    if (testType === "code" && question.question_type !== "code") throw new Error("Code tests must contain code questions");
    if (testType === "mcq" && question.question_type !== "mcq") throw new Error("Multiple-choice tests must contain MCQs");

    counts[question.difficulty] += 1;
    const options = question.question_type === "mcq" ? question.options : null;
    if (question.question_type === "mcq" && (!Array.isArray(options) || options.length !== 4)) {
      throw new Error("Each MCQ must have four options");
    }

    return {
      question_type: question.question_type,
      difficulty: question.difficulty,
      question_text: String(question.question_text).trim(),
      options,
      correct_answer: String(question.correct_answer).trim(),
      starter_code: question.question_type === "code" ? String(question.starter_code || "").trim() : null,
      points: Number(question.points) || (question.difficulty === "advanced" ? 20 : question.difficulty === "intermediate" ? 15 : 10),
    };
  });

  if (DIFFICULTIES.some((difficulty) => counts[difficulty] !== 2)) {
    throw new Error("Gemini must return two questions at each difficulty");
  }
  return questions;
}

async function generateAssessmentQuestions(skill) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured on the server (.env.local)");

  const typeRule = skill.test_type === "code"
    ? "All six questions must be code questions with a starter_code template."
    : skill.test_type === "mcq"
      ? "All six questions must be four-option multiple-choice questions."
      : "Return three code questions and three multiple-choice questions, with each difficulty represented twice.";
  const prompt = `You are an expert assessment designer. Create a fair diagnostic test for the skill "${skill.name}".\n\n${typeRule}\n\nUse exactly six questions: two beginner, two intermediate, and two advanced. Difficulty must reflect real skill progression. Every question must test a distinct, practical concept. MCQ distractors must be plausible and exactly one option must be correct. Code answers should be short reference solutions or essential solution logic suitable for lightweight keyword grading. Assign 10 points to beginner, 15 to intermediate, and 20 to advanced.\n\nReturn ONLY valid JSON with this exact shape, with no markdown:\n{"questions":[{"question_type":"mcq|code","difficulty":"beginner|intermediate|advanced","question_text":"...","options":["...","...","...","..."],"correct_answer":"...","starter_code":"...","points":10}]}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "Gemini API error");

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no assessment questions");
  return validateQuestions(parseJsonResponse(text), skill.test_type);
}

module.exports = { generateAssessmentQuestions };