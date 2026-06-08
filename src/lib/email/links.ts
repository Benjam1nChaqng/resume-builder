/**
 * Builds "open my email pre-filled" links. We never send mail ourselves — the
 * user reviews the draft and sends from their own account, so it comes from
 * their real address (best for job applications) with zero setup.
 *
 * Pure string building, browser-safe (no server imports), so the client
 * component can call these directly and they're trivial to test.
 */
export type EmailDraft = {
  to?: string | null;
  subject: string;
  body: string;
};

// RFC 6068 / Gmail both accept %20-encoded spaces; encodeURIComponent avoids
// the "+ becomes a literal plus" problem that URLSearchParams would introduce.
function enc(value: string): string {
  return encodeURIComponent(value);
}

/** Deep-links to a pre-filled Gmail compose window. */
export function gmailComposeUrl({ to, subject, body }: EmailDraft): string {
  const parts = ["view=cm", "fs=1", `su=${enc(subject)}`, `body=${enc(body)}`];
  if (to) parts.unshift(`to=${enc(to)}`);
  return `https://mail.google.com/mail/?${parts.join("&")}`;
}

/** Standard mailto: opens the user's default mail app pre-filled. */
export function mailtoUrl({ to, subject, body }: EmailDraft): string {
  const query = `subject=${enc(subject)}&body=${enc(body)}`;
  return `mailto:${enc(to ?? "")}?${query}`;
}
