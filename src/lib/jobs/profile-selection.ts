export function selectActiveProfile<T extends { id: string }>(
  profiles: T[],
  requestedProfileId?: string,
): T | null {
  if (requestedProfileId) {
    const requested = profiles.find((profile) => profile.id === requestedProfileId);
    if (requested) return requested;
  }
  return profiles[0] ?? null;
}
