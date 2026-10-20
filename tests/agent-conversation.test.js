const test = require("node:test");
const assert = require("node:assert/strict");
const {
  collectLearnerDetails,
  emptyLearnerContext,
  getNextQuestion,
  isReadyForRecommendations,
} = require("../lib/agent-conversation");

const skills = [{ id: 4, name: "Python" }, { id: 5, name: "Java" }];

test("asks one missing question at a time and retains earlier learner answers", () => {
  let context = emptyLearnerContext();
  assert.equal(getNextQuestion(context).field, "subject");

  context = collectLearnerDetails(context, "Python", skills);
  assert.equal(getNextQuestion(context).field, "goal");
  assert.equal(context.subject, "Python");

  context = collectLearnerDetails(context, "I want to prepare for placements", skills);
  assert.equal(getNextQuestion(context).field, "skillLevel");
  assert.equal(context.goal, "I want to prepare for placements");

  context = collectLearnerDetails(context, "Beginner", skills);
  assert.equal(getNextQuestion(context).field, "teachingStyle");
  assert.equal(context.skillLevel, "beginner");

  context = collectLearnerDetails(context, "Explain simply and give practical coding exercises", skills);
  context = collectLearnerDetails(context, "Three sessions per week, in the evening", skills);
  assert.equal(context.sessionsPerWeek, 3);
  assert.match(context.availability, /evening/i);
  assert.equal(isReadyForRecommendations(context), true);
});

test("does not invent a mentor subject when no catalog skill matches", () => {
  const context = collectLearnerDetails(emptyLearnerContext(), "Quantum gardening", skills);
  assert.equal(context.skillId, null);
  assert.equal(context.unmatchedSubject, "Quantum gardening");
  assert.equal(isReadyForRecommendations(context), false);
  assert.match(getNextQuestion(context).text, /would you like to learn/i);
});

test("supports explicit skips without repeating the same question", () => {
  let context = collectLearnerDetails(emptyLearnerContext(), "Python", skills);
  context = collectLearnerDetails(context, "Not sure", skills);
  assert.equal(getNextQuestion(context).field, "skillLevel");
});

test("handles greetings, a goal-first learner, and a short weekly-count answer", () => {
  let context = collectLearnerDetails(emptyLearnerContext(), "Hi", skills);
  assert.equal(getNextQuestion(context).text, "Hi! What would you like to learn?");

  context = collectLearnerDetails(context, "I'm not sure what to learn", skills);
  assert.match(getNextQuestion(context).text, /main goal right now/i);
  context = collectLearnerDetails(context, "I want to prepare for placements", skills);
  assert.match(getNextQuestion(context).text, /Which skill would you like to focus on/i);
  context = collectLearnerDetails(context, "Python", skills);
  assert.equal(getNextQuestion(context).field, "skillLevel");
});

test("recognizes a one-word weekly session count and later teaching preference updates", () => {
  let context = emptyLearnerContext();
  for (const answer of ["Python", "placements", "beginner", "patient explanations", "evenings"]) {
    context = collectLearnerDetails(context, answer, skills);
  }
  context = collectLearnerDetails(context, "three", skills);
  assert.equal(context.sessionsPerWeek, 3);
  context = collectLearnerDetails(context, "I prefer project-based exercises", skills);
  assert.equal(context.teachingStyle, "I prefer project-based exercises");
});

test("allows an explicit learning-goal update after all required slots are collected", () => {
  let context = emptyLearnerContext();
  for (const answer of ["Python", "placements", "beginner", "simple explanations", "three sessions per week in evenings"]) {
    context = collectLearnerDetails(context, answer, skills);
  }
  context = collectLearnerDetails(context, "My goal is to build portfolio projects", skills);
  assert.equal(context.goal, "My goal is to build portfolio projects");
});

test("does not misclassify a new subject as a changed learning goal", () => {
  let context = emptyLearnerContext();
  for (const answer of ["Python", "placements", "beginner", "simple explanations", "three sessions per week in evenings"]) {
    context = collectLearnerDetails(context, answer, skills);
  }
  context = collectLearnerDetails(context, "I want to learn Java", skills);
  assert.equal(context.subject, "Java");
  assert.equal(context.goal, "placements");
});

test("captures Expert as a valid assessment level", () => {
  let context = emptyLearnerContext();
  for (const answer of ["Python", "system design interviews", "expert"]) {
    context = collectLearnerDetails(context, answer, skills);
  }
  assert.equal(context.skillLevel, "expert");
  assert.equal(getNextQuestion(context).field, "teachingStyle");
});