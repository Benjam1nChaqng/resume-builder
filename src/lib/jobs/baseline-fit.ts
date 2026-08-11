const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "be",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "year",
  "years",
]);

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .split(" ")
    .map((token) => token.replace(/^\.+|\.+$/g, ""))
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function overlapScore(requirement: string, resumeTokens: Set<string>): number {
  const requirementTokens = [...new Set(tokens(requirement))];
  if (requirementTokens.length === 0) return 0;
  return (
    requirementTokens.filter((token) => resumeTokens.has(token)).length /
    requirementTokens.length
  );
}

export type BaselineFitResult = {
  score: number;
  matchedRequirements: string[];
  missingRequirements: string[];
};

export function calculateBaselineFit({
  jobTitle,
  requirements,
  resumeText,
}: {
  jobTitle: string;
  requirements: string[];
  resumeText: string;
}): BaselineFitResult {
  const resumeTokens = new Set(tokens(resumeText));
  const requirementScores = requirements.map((requirement) => ({
    requirement,
    score: overlapScore(requirement, resumeTokens),
  }));
  const matchedRequirements = requirementScores
    .filter((result) => result.score >= 0.6)
    .map((result) => result.requirement);
  const missingRequirements = requirementScores
    .filter((result) => result.score < 0.6)
    .map((result) => result.requirement);
  const requirementAverage =
    requirementScores.length > 0
      ? requirementScores.reduce((total, result) => total + result.score, 0) /
        requirementScores.length
      : 0;
  const titleScore = overlapScore(jobTitle, resumeTokens);

  return {
    score: Math.round(Math.min(1, requirementAverage * 0.85 + titleScore * 0.15) * 100),
    matchedRequirements,
    missingRequirements,
  };
}
