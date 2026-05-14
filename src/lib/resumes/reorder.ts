export function validateOrderedIds(
  existing: readonly string[],
  proposed: readonly string[],
): boolean {
  if (existing.length !== proposed.length) return false;
  const existingSet = new Set(existing);
  if (existingSet.size !== existing.length) return false;
  const proposedSet = new Set(proposed);
  if (proposedSet.size !== proposed.length) return false;
  for (const id of proposed) {
    if (!existingSet.has(id)) return false;
  }
  return true;
}
