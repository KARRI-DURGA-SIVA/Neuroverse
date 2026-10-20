const { getUserFromReq } = require("../../../lib/auth");
import { query } from "../../../lib/db";
import { findMentorsForSkill } from "../../../lib/mentorSearch";

export default async function handler(req, res) {
  const authUser = getUserFromReq(req);
  if (!authUser) return res.status(401).json({ error: "Not authenticated" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // body: { skillId, targetLevel, preferredLanguages: [], preferredAvailability: "" }
  const { skillId, targetLevel, preferredLanguages = [], preferredAvailability = null } = req.body;
  if (!skillId) return res.status(400).json({ error: "skillId is required" });

  const [savedProfile, assessment] = await Promise.all([
    query(
      `SELECT learning_goal, skill_level, teaching_style, availability_preference
       FROM learner_learning_profiles WHERE user_id = $1 AND skill_id = $2`,
      [authUser.id, skillId]
    ),
    query(
      `SELECT level FROM user_skills WHERE user_id = $1 AND skill_id = $2 AND type = 'known'`,
      [authUser.id, skillId]
    ),
  ]);
  const preferences = savedProfile.rows[0] || {};
  const requestedLevel = ["beginner", "intermediate", "advanced", "expert"].includes(targetLevel)
    ? targetLevel
    : (["beginner", "intermediate", "advanced", "expert"].includes(preferences.skill_level)
      ? preferences.skill_level
      : (["beginner", "intermediate", "advanced", "expert"].includes(assessment.rows[0]?.level)
        ? assessment.rows[0].level
        : "intermediate"));

  const result = await findMentorsForSkill({
    skillId,
    targetLevel: requestedLevel,
    preferredLanguages,
    preferredAvailability: preferredAvailability || preferences.availability_preference,
    learnerGoal: preferences.learning_goal || "",
    teachingStyle: preferences.teaching_style || "",
    excludeUserId: authUser.id,
  });
  if (!result) return res.status(404).json({ error: "Skill not found" });

  return res.status(200).json({ mentors: result.mentors, learningPath: result.learningPath, skill: result.skill, targetLevel: requestedLevel });
}
