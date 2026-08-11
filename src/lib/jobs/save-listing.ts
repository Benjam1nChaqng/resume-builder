import { createJobForUser } from "./create";
import {
  getDiscoveredListingForUser,
  updateListingStatusForUser,
} from "./discovery-repo";

export async function saveDiscoveredListingForUser({
  userId,
  listingId,
}: {
  userId: string;
  listingId: string;
}): Promise<string> {
  const listing = await getDiscoveredListingForUser({ userId, listingId });
  if (!listing) throw new Error("Job listing not found.");

  if (listing.jobId) {
    return listing.jobId;
  }
  if (listing.status !== "discovered") {
    throw new Error("Only discovered listings can be saved.");
  }

  const jobId = await createJobForUser({
    userId,
    url: listing.canonicalUrl,
  });
  await updateListingStatusForUser({
    userId,
    listingId,
    status: "saved",
    jobId,
  });
  return jobId;
}
