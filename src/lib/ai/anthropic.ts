import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/env";

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!_client) {
    _client = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      baseURL: "https://anthropic.helicone.ai",
      defaultHeaders: {
        "Helicone-Auth": `Bearer ${env.HELICONE_API_KEY}`,
      },
    });
  }
  return _client;
}
