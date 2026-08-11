export const SELECTED_JOB_PROFILE_COOKIE = "selected-job-search-profile";

export function selectActiveProfile<T extends { id: string }>(
  profiles: T[],
  requestedProfileId?: string,
  savedProfileId?: string,
): T | null {
  if (requestedProfileId) {
    const requested = profiles.find((profile) => profile.id === requestedProfileId);
    if (requested) return requested;
  }
  if (savedProfileId) {
    const saved = profiles.find((profile) => profile.id === savedProfileId);
    if (saved) return saved;
  }
  return profiles[0] ?? null;
}

export function serializeSelectedProfileCookie(
  userId: string,
  profileId: string,
): string {
  return `${encodeURIComponent(userId)}:${encodeURIComponent(profileId)}`;
}

export function parseSelectedProfileCookie(
  value: string | undefined,
  userId: string,
): string | undefined {
  if (!value) return undefined;
  const separator = value.indexOf(":");
  if (separator < 1) return undefined;

  try {
    const savedUserId = decodeURIComponent(value.slice(0, separator));
    const profileId = decodeURIComponent(value.slice(separator + 1));
    return savedUserId === userId && profileId ? profileId : undefined;
  } catch {
    return undefined;
  }
}
