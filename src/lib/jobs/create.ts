import { scrapeJobDescription } from "@/lib/ai/jd-scraper";
import { insertJob } from "./repo";

export async function createJobForUser({
  userId,
  url,
}: {
  userId: string;
  url: string;
}): Promise<string> {
  const parsed = await scrapeJobDescription({ url });
  return insertJob({ userId, sourceUrl: url, parsed });
}
