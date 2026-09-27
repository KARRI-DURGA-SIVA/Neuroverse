// lib/matching.js
// Computes a suitability % for each candidate mentor against a learner's stated
// preferences, and produces a simple linear learning path.

const WEIGHTS = {
  skillMatch: 40, // mentor teaches the exact requested skill
  levelFit: 20, // mentor's level is at/above the learner's target level (not wildly overqualified)
  languageMatch: 15, // shared spoken language
  rating: 15, // mentor reputation
  availability: 10, // mentor has stated availability overlapping learner's preference
};

const LEVEL_ORDER = { beginner: 1, intermediate: 2, advanced: 3 };

function computeSuitability({
  mentor,
  requestedSkillId,
  requestedLevel, // learner's desired outcome level: beginner | intermediate | advanced
  learnerLanguages = [],
  learnerAvailability = null, // e.g. "evenings" - free text match, optional
}) {
  let score = 0;
  const reasons = [];

  // 1. Skill match (mentor must teach this skill to be considered at all)
  if (mentor.skill_id === requestedSkillId) {
    score += WEIGHTS.skillMatch;
    reasons.push("Teaches the exact skill you want to learn");
  }

  // 2. Level fit — mentor should be at or above the level the learner wants to reach
  const mentorRank = LEVEL_ORDER[mentor.mentor_level] || 1;
  const targetRank = LEVEL_ORDER[requestedLevel] || 1;
  if (mentorRank >= targetRank) {
    // full credit if exact match tier, slightly less if overqualified (still fine)
    const diff = mentorRank - targetRank;
    const levelScore = diff === 0 ? WEIGHTS.levelFit : WEIGHTS.levelFit * 0.85;
    score += levelScore;
    reasons.push(`Mentor level (${mentor.mentor_level}) covers your target level (${requestedLevel})`);
  } else {
    reasons.push(`Mentor level (${mentor.mentor_level}) is below your target level (${requestedLevel})`);
  }

  // 3. Language overlap
  const mentorLangs = mentor.languages || [];
  const overlap = mentorLangs.filter((l) => learnerLanguages.includes(l));
  if (learnerLanguages.length === 0) {
    score += WEIGHTS.languageMatch * 0.5; // neutral if learner didn't specify
  } else if (overlap.length > 0) {
    score += WEIGHTS.languageMatch;
    reasons.push(`Speaks ${overlap.join(", ")}`);
  }

  // 4. Rating
  const rating = Number(mentor.avg_rating) || 0;
  const ratingScore = Math.min(rating / 5, 1) * WEIGHTS.rating;
  score += ratingScore;
  if (rating > 0) reasons.push(`${rating.toFixed(1)}★ average rating`);

  // 5. Availability (best-effort free text overlap; optional)
  if (!learnerAvailability || !mentor.availability) {
    score += WEIGHTS.availability * 0.5;
  } else if (
    mentor.availability.toLowerCase().includes(learnerAvailability.toLowerCase())
  ) {
    score += WEIGHTS.availability;
    reasons.push("Availability matches your preferred time");
  }

  const suitabilityPercent = Math.round(Math.min(score, 100));
  return { suitabilityPercent, reasons };
}

// Builds a simple ordered learning path from beginner -> target level for a skill.
function buildLearningPath(skillName, targetLevel) {
  const stages = [
    { level: "beginner", title: `${skillName} Fundamentals`, description: `Core concepts, terminology, and hands-on basics of ${skillName}.` },
    { level: "intermediate", title: `${skillName} in Practice`, description: `Applied exercises and real-world use cases to build fluency in ${skillName}.` },
    { level: "advanced", title: `${skillName} Mastery`, description: `Advanced techniques, edge cases, and independent project work in ${skillName}.` },
  ];
  const targetRank = LEVEL_ORDER[targetLevel] || 1;
  return stages.filter((s) => LEVEL_ORDER[s.level] <= targetRank);
}

module.exports = { computeSuitability, buildLearningPath, WEIGHTS, LEVEL_ORDER };
