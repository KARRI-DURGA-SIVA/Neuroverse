// lib/pricing.js
// Central pricing engine for NeuroVerse.
//
// price_per_hour = DEFAULT_BASE_RATE * skillLevelFactor * skillDifficultyFactor * mentorExpertiseFactor
//
// - skillLevelFactor: mentor's classified level in the skill (beginner/intermediate/advanced)
// - skillDifficultyFactor: per-skill weight (e.g. Python harder than English) stored on skills.difficulty_factor
// - mentorExpertiseFactor: derived from mentor's average rating (reputation)
//
// Platform fee: an additional 10% is charged on top of the session cost to the
// learner, AND 10% is deducted from what the mentor receives.

const DEFAULT_BASE_RATE_CREDITS_PER_HOUR = 20; // tune as needed
const PLATFORM_FEE_RATE = 0.10;

const SKILL_LEVEL_FACTORS = {
  beginner: configuredFactor("SESSION_LEVEL_FACTOR_BEGINNER", 0.5),
  intermediate: configuredFactor("SESSION_LEVEL_FACTOR_INTERMEDIATE", 1.0),
  advanced: configuredFactor("SESSION_LEVEL_FACTOR_ADVANCED", 1.5),
  expert: configuredFactor("SESSION_LEVEL_FACTOR_EXPERT", 2.0),
};

function configuredFactor(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

// Mentor expertise multiplier tiers based on average rating (out of 5).
// Example given by product spec: rating < 2 => 0.5x
const EXPERTISE_TIERS = [
  { minRating: 4.5, multiplier: 1.5 },
  { minRating: 3.5, multiplier: 1.2 },
  { minRating: 2.0, multiplier: 1.0 },
  { minRating: 0, multiplier: 0.5 }, // < 2 rating (also used for brand-new mentors with 0 reviews -> neutral 1.0 override below)
];

function mentorExpertiseMultiplier(avgRating, totalReviews) {
  // New mentors with no reviews yet get a neutral 1.0x so they aren't penalized before earning ratings.
  if (!totalReviews || totalReviews === 0) return 1.0;
  for (const tier of EXPERTISE_TIERS) {
    if (avgRating >= tier.minRating) return tier.multiplier;
  }
  return 0.5;
}

function skillLevelFactor(level) {
  return SKILL_LEVEL_FACTORS[level] || 1.0;
}

/**
 * Computes the full price breakdown for a session.
 * @param {Object} params
 * @param {number} params.baseRate - credits/hour base rate (defaults to DEFAULT_BASE_RATE_CREDITS_PER_HOUR)
 * @param {string} params.mentorLevel - beginner | intermediate | advanced
 * @param {number} params.skillDifficultyFactor - from skills.difficulty_factor
 * @param {number} params.mentorAvgRating
 * @param {number} params.mentorTotalReviews
 * @param {number} params.hours
 */
function computeSessionPrice({
  baseRate = DEFAULT_BASE_RATE_CREDITS_PER_HOUR,
  mentorLevel,
  sessionLevel,
  skillDifficultyFactor = 1.0,
  mentorAvgRating = 0,
  mentorTotalReviews = 0,
  hours,
}) {
  const levelFactor = skillLevelFactor(sessionLevel || mentorLevel);
  const expertiseFactor = mentorExpertiseMultiplier(mentorAvgRating, mentorTotalReviews);

  const pricePerHour = round2(baseRate * levelFactor * skillDifficultyFactor * expertiseFactor);
  const baseCredits = round2(pricePerHour * hours);
  const platformFee = round2(baseCredits * PLATFORM_FEE_RATE);
  const totalChargedToLearner = round2(baseCredits + platformFee);
  const mentorCut = round2(baseCredits * PLATFORM_FEE_RATE); // mentor also loses 10% of their earning
  const creditedToMentor = round2(baseCredits - mentorCut);

  return {
    pricePerHour,
    levelFactor,
    skillDifficultyFactor,
    expertiseFactor,
    baseCredits,
    platformFee,
    totalChargedToLearner,
    creditedToMentor,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Credit purchase packs (learner tops up credits when balance is insufficient).
// 1 credit ~= $0.10 as a starting reference price — tune after evaluating usage.
const CREDIT_PACKS = [
  { credits: 100, priceUSD: 9 },
  { credits: 250, priceUSD: 20 },
  { credits: 600, priceUSD: 45 },
  { credits: 1500, priceUSD: 100 },
];

module.exports = {
  DEFAULT_BASE_RATE_CREDITS_PER_HOUR,
  PLATFORM_FEE_RATE,
  SKILL_LEVEL_FACTORS,
  SESSION_LEVEL_FACTORS: SKILL_LEVEL_FACTORS,
  computeSessionPrice,
  mentorExpertiseMultiplier,
  skillLevelFactor,
  CREDIT_PACKS,
};
