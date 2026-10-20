const test = require("node:test");
const assert = require("node:assert/strict");
const { scoreAssessment } = require("../lib/classification");

test("assessment score reports correct, wrong, unanswered, and completion metrics", () => {
  const questions = [
    { id: 1, question_type: "mcq", correct_answer: "A", points: 10 },
    { id: 2, question_type: "mcq", correct_answer: "B", points: 10 },
    { id: 3, question_type: "mcq", correct_answer: "C", points: 10 },
  ];
  const result = scoreAssessment(questions, { 1: "a", 2: "wrong" });

  assert.equal(result.correctCount, 1);
  assert.equal(result.wrongCount, 1);
  assert.equal(result.unansweredCount, 1);
  assert.equal(result.totalQuestions, 3);
  assert.equal(result.totalPoints, 30);
  assert.equal(result.earnedPoints, 10);
  assert.equal(result.scorePercent, 33.33);
  assert.equal(result.classifiedLevel, "beginner");
  assert.equal(result.completed, true);
});

test("assessment result preserves expert classification", () => {
  const questions = Array.from({ length: 20 }, (_, index) => ({
    id: index + 1,
    question_type: "mcq",
    correct_answer: "yes",
    points: 5,
  }));
  const answers = Object.fromEntries(questions.map((question) => [question.id, "yes"]));
  assert.equal(scoreAssessment(questions, answers).classifiedLevel, "expert");
});