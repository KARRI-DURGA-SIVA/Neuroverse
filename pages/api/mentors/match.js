const { query } = require("../../../lib/db");
const { getUserFromReq } = require("../../../lib/auth");
const { computeSuitability, buildLearningPath } = require("../../../lib/matching");
const { computeSessionPrice } = require("../../../lib/pricing");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // body: { skillId, targetLevel, preferredLanguages: [], preferredAvailability: "" }
  const { skillId, targetLevel = "intermediate", preferredLanguages = [], preferredAvailability = null } = req.body;
  if (!skillId) return res.status(400).json({ error: "skillId is required" });

  const skillRes = await query("SELECT * FROM skills WHERE id = $1", [skillId]);
  if (skillRes.rows.length === 0) return res.status(404).json({ error: "Skill not found" });
  const skill = skillRes.rows[0];

  const coursesRes = await query(
    `SELECT c.*, u.name as mentor_name, u.languages, u.profile_pic, u.age, u.bio,
            mr.avg_rating, mr.total_reviews
     FROM courses c
     JOIN users u ON c.mentor_id = u.id
     LEFT JOIN mentor_reputation mr ON mr.mentor_id = c.mentor_id
     WHERE c.skill_id = $1 AND c.mentor_id != $2`,
    [skillId, authUser.id]
  );

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
      profilePic: course.profile_pic,
      age: course.age,
      bio: course.bio,
      languages: course.languages,
      avgRating: Number(course.avg_rating) || 0,
      totalReviews: Number(course.total_reviews) || 0,
      pricePerHour: price.pricePerHour,
      suitabilityPercent,
      reasons,
    };
  });

  ranked.sort((a, b) => b.suitabilityPercent - a.suitabilityPercent);

  const learningPath = buildLearningPath(skill.name, targetLevel);

  return res.status(200).json({ mentors: ranked, learningPath, skill });
}
