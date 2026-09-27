const DIFFICULTIES = ["beginner", "intermediate", "advanced", "expert"];
const QUESTION_COUNTS = { beginner: 5, intermediate: 5, advanced: 6, expert: 4 };

function parseJsonResponse(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Gemini returned invalid question JSON");
  return JSON.parse(candidate.slice(start, end + 1));
}

function validateQuestions(payload, testType) {
  if (!Array.isArray(payload.questions) || payload.questions.length !== 20) {
    throw new Error("Gemini must return exactly 20 assessment questions");
  }

  const counts = Object.fromEntries(DIFFICULTIES.map((difficulty) => [difficulty, 0]));
  const questionTexts = new Set();
  const questions = payload.questions.map((question) => {
    if (!DIFFICULTIES.includes(question.difficulty)) throw new Error("Invalid question difficulty");
    if (!['mcq', 'code'].includes(question.question_type)) throw new Error("Invalid question type");
    if (!question.question_text || !question.correct_answer) throw new Error("Question text and answer are required");
    const normalizedQuestion = String(question.question_text).trim().toLowerCase();
    if (questionTexts.has(normalizedQuestion)) throw new Error("Gemini returned duplicate questions");
    questionTexts.add(normalizedQuestion);
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
      points: Number(question.points) || (question.difficulty === "expert" ? 25 : question.difficulty === "advanced" ? 20 : question.difficulty === "intermediate" ? 15 : 10),
    };
  });

  if (DIFFICULTIES.some((difficulty) => counts[difficulty] !== QUESTION_COUNTS[difficulty])) {
    throw new Error("Gemini returned the wrong question distribution");
  }
  return questions;
}

async function generateAssessmentQuestions(skill) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured on the server (.env.local)");

  const typeRule = skill.test_type === "code"
    ? "All 20 questions must be code questions with a starter_code template."
    : skill.test_type === "mcq"
      ? "All 20 questions must be four-option multiple-choice questions."
      : "Return a balanced mix of code and multiple-choice questions, with the required distribution at every difficulty.";
  const prompt = `You are an expert assessment designer. Create a fair diagnostic test for the skill "${skill.name}".\n\n${typeRule}\n\nUse exactly 20 questions with this distribution: 5 beginner questions testing basic concepts and terminology, 5 intermediate questions testing application and understanding, 6 advanced questions testing problem-solving, debugging, and real situations, and 4 expert questions testing complex scenarios, design decisions, and edge cases. Difficulty must reflect real skill progression. Every question must test a distinct practical concept; do not repeat questions or merely change names. MCQ distractors must be plausible and exactly one option must be correct. Code answers should be short reference solutions or essential solution logic suitable for lightweight keyword grading. Assign 10 points to beginner, 15 to intermediate, 20 to advanced, and 25 to expert.\n\nReturn ONLY valid JSON with this exact shape, with no markdown:\n{"questions":[{"question_type":"mcq|code","difficulty":"beginner|intermediate|advanced|expert","question_text":"...","options":["...","...","...","..."],"correct_answer":"...","starter_code":"...","points":10}]}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
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