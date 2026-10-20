const LEVELS = ["beginner", "intermediate", "advanced", "expert"];
const NUMBER_WORDS = {
  one: 1,
  once: 1,
  two: 2,
  twice: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
};

function emptyLearnerContext() {
  return {
    subject: null,
    skillId: null,
    goal: null,
    skillLevel: null,
    teachingStyle: null,
    availability: null,
    sessionsPerWeek: null,
    budgetPreference: null,
    answered: {},
  };
}

function collectLearnerDetails(currentContext, message, skills) {
  const context = { ...emptyLearnerContext(), ...(currentContext || {}) };
  context.answered = { ...(context.answered || {}) };
  const text = String(message || "").trim();
  const normalized = text.toLowerCase();
  const pending = getPendingField(context);

  const matchedSkill = [...skills]
    .sort((left, right) => right.name.length - left.name.length)
    .find((skill) => normalized.includes(skill.name.toLowerCase()));
  if (matchedSkill) {
    context.subject = matchedSkill.name;
    context.skillId = String(matchedSkill.id);
    context.answered.subject = true;
  }

  const level = LEVELS.find((value) => new RegExp(`\\b${value}\\b`, "i").test(normalized));
  if (level) {
    context.skillLevel = level;
    context.answered.skillLevel = true;
  }

  const sessionsPerWeek = parseSessionsPerWeek(normalized);
  if (sessionsPerWeek) {
    context.sessionsPerWeek = sessionsPerWeek;
    context.answered.sessionsPerWeek = true;
  }

  if (containsAvailability(normalized)) {
    context.availability = text;
    context.answered.availability = true;
  }

  if (/\b(simple explanations?|practical (?:coding )?exercises?|project[- ]based|patient|homework|mock interviews?|debugging|real examples?|accountab|feedback|strict mentor)\b/.test(normalized)) {
    context.teachingStyle = text;
    context.answered.teachingStyle = true;
  }

  if (/\b(?:₹|rs\.?|inr|credits?)\s*\d+|\b\d+\s*(?:₹|rs\.?|inr|credits?)\b/i.test(text)) {
    context.budgetPreference = text;
  }

  if (isSkipAnswer(normalized)) {
    if (pending === "subject") {
      context.answered.subject = true;
    } else if (pending === "schedule") {
      context.answered.sessionsPerWeek = true;
      context.answered.availability = true;
    } else if (pending) {
      context.answered[pending] = true;
    }
    return context;
  }

  if (pending === "subject" && !matchedSkill && !isGreeting(normalized) && !isSkipAnswer(normalized)) {
    context.unmatchedSubject = text;
  } else if ((pending === "goal" && !context.goal)
    || (context.skillId && !matchedSkill && /\b(my goal is|i want to (?:prepare|build|improve|become|switch)|i need to|preparing for)\b/.test(normalized))) {
    context.goal = text;
    context.answered.goal = true;
  } else if (pending === "skillLevel" && !context.skillLevel) {
    const foundLevel = LEVELS.find((value) => normalized.includes(value));
    if (foundLevel) {
      context.skillLevel = foundLevel;
      context.answered.skillLevel = true;
    }
  } else if (pending === "teachingStyle" && !context.teachingStyle) {
    context.teachingStyle = text;
    context.answered.teachingStyle = true;
  }

  if (pending === "schedule") {
    const simpleCount = parseSimpleCount(normalized);
    if (!context.sessionsPerWeek && simpleCount) {
      context.sessionsPerWeek = simpleCount;
      context.answered.sessionsPerWeek = true;
    }
    if (!context.sessionsPerWeek && !sessionsPerWeek && /\b(?:sessions?|classes?)\b/i.test(normalized)) {
      context.sessionsPerWeek = text;
      context.answered.sessionsPerWeek = true;
    }
    if (!context.availability && !context.answered.availability && !context.sessionsPerWeek) {
      context.availability = text;
      context.answered.availability = true;
    }
  }

  return context;
}

function getPendingField(context) {
  if (!context.skillId && !context.answered?.subject) return "subject";
  if (!context.goal && !context.answered?.goal) return "goal";
  if (!context.skillId) return "subject";
  if (!context.skillLevel && !context.answered?.skillLevel) return "skillLevel";
  if (!context.teachingStyle && !context.answered?.teachingStyle) return "teachingStyle";
  if ((!context.sessionsPerWeek && !context.answered?.sessionsPerWeek)
    || (!context.availability && !context.answered?.availability)) return "schedule";
  return null;
}

function getNextQuestion(context) {
  const field = getPendingField(context);
  if (!field) return null;
  if (field === "subject") return { field, text: context.goal ? `Which skill would you like to focus on to reach your goal of ${context.goal}?` : "Hi! What would you like to learn?" };
  if (field === "goal") return { field, text: context.subject ? `What do you want to achieve by learning ${context.subject}?` : "What is your main goal right now: getting a job, improving college performance, building projects, or exploring a new skill?" };
  if (field === "skillLevel") return { field, text: `What is your current ${context.subject} skill level: beginner, intermediate, advanced, or expert?` };
  if (field === "teachingStyle") return { field, text: "What do you expect from your mentor, for example simple explanations, practical exercises, projects, or interview preparation?" };
  if (!context.sessionsPerWeek && !context.availability) {
    return { field, text: "How many sessions per week would you prefer, and when are you generally available?" };
  }
  if (!context.sessionsPerWeek) return { field, text: "How many sessions per week would you prefer?" };
  return { field, text: "When are you generally available? I’ll treat this as a preference, not a confirmed mentor time slot." };
}

function isReadyForRecommendations(context) {
  return !getPendingField(context) && Boolean(context.skillId);
}

function parseSessionsPerWeek(text) {
  const match = text.match(/\b(\d+|one|once|two|twice|three|four|five|six|seven)\s+(?:sessions?|classes?)\s+(?:per|a)\s+week\b/)
    || text.match(/\b(\d+|one|once|two|twice|three|four|five|six|seven)\s+times?\s+(?:per|a)\s+week\b/)
    || text.match(/\b(\d+|one|once|two|twice|three|four|five|six|seven)\s+(?:per|a)\s+week\b/);
  if (!match) return null;
  const count = Number(match[1]) || NUMBER_WORDS[match[1]];
  return count >= 1 && count <= 7 ? count : null;
}

function parseSimpleCount(text) {
  const match = text.match(/^\s*(\d+|one|once|two|twice|three|four|five|six|seven)(?:\s+(?:sessions?|classes?))?\s*[.!]?\s*$/);
  if (!match) return null;
  const count = Number(match[1]) || NUMBER_WORDS[match[1]];
  return count >= 1 && count <= 7 ? count : null;
}

function containsAvailability(text) {
  return /\b(morning|afternoon|evening|night|weekdays?|weekends?|saturday|sunday|monday|tuesday|wednesday|thursday|friday|flexible|after work|before work)\b/.test(text);
}

function isSkipAnswer(text) {
  return /\b(not sure|no preference|skip|rather not say|i don't know|dont know)\b/.test(text);
}

function isGreeting(text) {
  return /^(?:hi|hello|hey|good morning|good afternoon|good evening|how are you)[!.\s]*$/.test(text);
}

module.exports = {
  collectLearnerDetails,
  emptyLearnerContext,
  getNextQuestion,
  getPendingField,
  isReadyForRecommendations,
  parseSessionsPerWeek,
  parseSimpleCount,
};