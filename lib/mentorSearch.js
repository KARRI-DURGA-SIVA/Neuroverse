// lib/mentorSearch.js
// Factored out of pages/api/mentors/match.js so the agentic assistant (lib/agent.js)
// can call the same ranking logic in-process, without an HTTP round-trip.
const { query } = require("./db");
const { computeSuitability, buildLearningPath } = require("./matching");
const { computeSessionPrice } = require("./pricing");

async function findMentorsForSkill({ skillId, targetLevel = "intermediate", preferredLanguages = [], preferredAvailability = null, excludeUserId = null }) {
  const skillRes = await query("SELECT * FROM skills WHERE id = $1", [skillId]);
  if (skillRes.rows.length === 0) return null;
  const skill = skillRes.rows[0];

  const params = [skillId];
  let sql = `
    SELECT c.*, u.name as mentor_name, u.languages, u.profile_pic, u.age, u.bio,
           mr.avg_rating, mr.total_reviews
    FROM courses c
    JOIN users u ON c.mentor_id = u.id
    LEFT JOIN mentor_reputation mr ON mr.mentor_id = c.mentor_id
    WHERE c.skill_id = $1 AND u.email NOT LIKE '%@demo.neuroverse.invalid'
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
      skillDifficultyFactor: Number(skill.difficulty_factor),
      mentorAvgRating: Number(course.avg_rating),
      mentorTotalReviews: Number(course.total_reviews),
      hours: 1,
    });

    return {
      courseId: course.id,
      mentorId: course.mentor_id,
      mentorName: course.mentor_name,
      mentorLevel: course.mentor_level,
      title: course.title,
      description: course.description,
      languages: course.languages,
      avgRating: Number(course.avg_rating) || 0,
      totalReviews: Number(course.total_reviews) || 0,
      pricePerHour: price.pricePerHour,
      suitabilityPercent,
      reasons,
    };
  });

  ranked.sort((a, b) => b.suitabilityPercent - a.suitabilityPercent);

  return { skill, mentors: ranked, learningPath: buildLearningPath(skill.name, targetLevel) };
}

// Fuzzy-ish skill name resolver: exact match first, then partial ILIKE match.
async function resolveSkillByName(name) {
  if (!name) return null;
  const exact = await query("SELECT * FROM skills WHERE LOWER(name) = LOWER($1)", [name]);
  if (exact.rows.length > 0) return exact.rows[0];
  const partial = await query("SELECT * FROM skills WHERE name ILIKE $1 ORDER BY name LIMIT 1", [`%${name}%`]);
  return partial.rows[0] || null;
}

module.exports = { findMentorsForSkill, resolveSkillByName };
