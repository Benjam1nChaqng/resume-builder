export function indexLatestFitsByResume<T extends { resumeId: string }>(
  newestFirstFits: T[],
): Map<string, T> {
  const latest = new Map<string, T>();
  for (const fit of newestFirstFits) {
    if (!latest.has(fit.resumeId)) latest.set(fit.resumeId, fit);
  }
  return latest;
}
