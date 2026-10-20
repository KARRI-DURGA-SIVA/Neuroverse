// lib/mentorSearch.js
// Factored out of pages/api/mentors/match.js so the agentic assistant (lib/agent.js)
// can call the same ranking logic in-process, without an HTTP round-trip.
import { query } from "./db";
const { computeSuitability, buildLearningPath } = require("./matching");
const { computeSessionPrice } = require("./pricing");

export async function findMentorsForSkill({
  skillId,
  targetLevel = "intermediate",
  preferredLanguages = [],
  preferredAvailability = null,
  learnerGoal = "",
  teachingStyle = "",
  budgetCredits = null,
  excludeUserId = null,
}) {
  const skillRes = await query("SELECT * FROM skills WHERE id = $1", [skillId]);
  if (skillRes.rows.length === 0) return null;
  const skill = skillRes.rows[0];

  const params = [skillId];
  let sql = `
        SELECT c.*, c.availability_text AS availability, u.name as mentor_name, u.languages, u.profile_pic, u.age, u.bio,
          mr.avg_rating, mr.total_reviews,
          (SELECT COUNT(*) FROM sessions booked
           WHERE booked.mentor_id = c.mentor_id
        AND booked.scheduled_start > now()
        AND booked.status IN ('pending', 'accepted', 'meeting_pending', 'confirmed', 'in_progress')) as upcoming_session_count
    FROM courses c
    JOIN users u ON c.mentor_id = u.id
    LEFT JOIN mentor_reputation mr ON mr.mentor_id = c.mentor_id
    WHERE c.skill_id = $1 AND c.is_active IS NOT FALSE
      AND u.email NOT LIKE '%@demo.neuroverse.invalid'
  `;
  if (excludeUserId) {
    params.push(excludeUserId);
    sql += ` AND c.mentor_id != $${params.length}`;
  }
  const coursesRes = await query(sql, params);

  const ranked = coursesRes.rows.map((course) => {
    const { suitabilityPercent, reasons } = computeSuitability({
      mentor: course,
      requestedSkillId: skillId,
      requestedLevel: targetLevel,
      learnerLanguages: preferredLanguages,
      learnerAvailability: preferredAvailability,
    });

    const price = computeSessionPrice({
      mentorLevel: course.mentor_level,
      sessionLevel: targetLevel,
      skillDifficultyFactor: Number(skill.difficulty_factor),
      mentorAvgRating: Number(course.avg_rating),
      mentorTotalReviews: Number(course.total_reviews),
      hours: 1,
    });

    const preferenceEvidence = findPreferenceEvidence({ course, learnerGoal, teachingStyle });
    const hasBudget = budgetCredits !== null && budgetCredits !== undefined && Number.isFinite(Number(budgetCredits));
    const budgetMatch = !hasBudget || price.totalChargedToLearner <= Number(budgetCredits);
    const budgetReasons = !budgetMatch ? ["Session estimate is above your stated credit budget"] : [];
    const availabilityNote = course.availability
      ? "Mentor availability is listed on their profile; confirm the exact time before booking"
      : "A recurring schedule is not listed; the mentor must confirm your requested time";

    return {
      courseId: course.id,
      mentorId: course.mentor_id,
      mentorName: course.mentor_name,
      mentorLevel: course.mentor_level,
      title: course.title,
      description: course.description,
      availability: course.availability || "Not listed",
      mentorBio: course.bio,
      languages: course.languages,
      avgRating: Number(course.avg_rating) || 0,
      totalReviews: Number(course.total_reviews) || 0,
      pricePerHour: price.pricePerHour,
      totalCreditsPerHour: price.totalChargedToLearner,
      upcomingSessionCount: Number(course.upcoming_session_count) || 0,
      suitabilityPercent: Math.max(0, Math.min(100, suitabilityPercent + preferenceEvidence.score - budgetReasons.length * 8)),
      reasons: [...reasons, ...preferenceEvidence.reasons, availabilityNote, ...budgetReasons],
      budgetMatch,
    };
  });

  ranked.sort((a, b) => Number(b.budgetMatch) - Number(a.budgetMatch) || b.suitabilityPercent - a.suitabilityPercent);

  return { skill, mentors: ranked, learningPath: buildLearningPath(skill.name, targetLevel) };
}

function findPreferenceEvidence({ course, learnerGoal, teachingStyle }) {
  const profileText = [course.title, course.description, course.bio].filter(Boolean).join(" ").toLowerCase();
  const preferences = [learnerGoal, teachingStyle]
    .join(" ")
    .toLowerCase()
    .match(/[a-z0-9]{4,}/g) || [];
  const stopWords = new Set(["want", "learn", "learning", "with", "from", "that", "this", "have", "would", "like", "mentor", "sessions", "session", "explain"]);
  const matched = [...new Set(preferences.filter((word) => !stopWords.has(word) && profileText.includes(word)))].slice(0, 3);
  return {
    score: Math.min(matched.length * 3, 9),
    reasons: matched.length ? [`Course or mentor profile mentions ${matched.join(", ")}`] : [],
  };
}

// Fuzzy-ish skill name resolver: exact match first, then partial ILIKE match.
export async function resolveSkillByName(name) {
  if (!name) return null;
  const exact = await query("SELECT * FROM skills WHERE LOWER(name) = LOWER($1)", [name]);
  if (exact.rows.length > 0) return exact.rows[0];
  const partial = await query("SELECT * FROM skills WHERE name ILIKE $1 ORDER BY name LIMIT 1", [`%${name}%`]);
  return partial.rows[0] || null;
}
