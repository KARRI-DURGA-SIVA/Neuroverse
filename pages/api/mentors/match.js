const { getUserFromReq } = require("../../../lib/auth");
const { findMentorsForSkill } = require("../../../lib/mentorSearch");

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // body: { skillId, targetLevel, preferredLanguages: [], preferredAvailability: "" }
  const { skillId, targetLevel = "intermediate", preferredLanguages = [], preferredAvailability = null } = req.body;
  if (!skillId) return res.status(400).json({ error: "skillId is required" });

  const result = await findMentorsForSkill({
    skillId,
    targetLevel,
    preferredLanguages,
    preferredAvailability,
    excludeUserId: authUser.id,
  });
  if (!result) return res.status(404).json({ error: "Skill not found" });

  return res.status(200).json({ mentors: result.mentors, learningPath: result.learningPath, skill: result.skill });
}
