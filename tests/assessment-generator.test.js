const test = require("node:test");
const assert = require("node:assert/strict");
const { generateLocalAssessmentQuestions } = require("../lib/local-assessment-generator");

test("mixed Data Analysis assessment has 20 unique questions at required difficulty counts", () => {
  const questions = generateLocalAssessmentQuestions({ name: "Data Analysis", test_type: "mixed" });
  assert.equal(questions.length, 20);
  assert.equal(new Set(questions.map((question) => question.question_text)).size, 20);
  assert.deepEqual(
    Object.fromEntries(["beginner", "intermediate", "advanced", "expert"].map((level) => [
      level,
      questions.filter((question) => question.difficulty === level).length,
    ])),
    { beginner: 5, intermediate: 5, advanced: 6, expert: 4 }
  );
  assert.equal(questions.some((question) => question.question_type === "code"), true);
  assert.equal(questions.some((question) => question.question_type === "mcq"), true);
});

test("assessment generation produces unique question text for every catalog test type", () => {
  const skills = [
    { name: "Python", test_type: "code" },
    { name: "JavaScript", test_type: "code" },
    { name: "SQL", test_type: "code" },
    { name: "English", test_type: "mcq" },
    { name: "Digital Marketing", test_type: "mcq" },
    { name: "Custom Skill", test_type: "general" },
    { name: "Data Analysis", test_type: "mixed" },
  ];

  for (const skill of skills) {
    const questions = generateLocalAssessmentQuestions(skill);
    assert.equal(questions.length, 20, `${skill.name} question count`);
    assert.equal(new Set(questions.map((question) => question.question_text)).size, 20, `${skill.name} unique prompts`);
  }
});