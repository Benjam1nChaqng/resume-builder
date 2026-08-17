import { randomUUID } from "node:crypto";
import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export const agentAccessToken = pgTable(
  "agent_access_token",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenPrefix: text("token_prefix").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("agent_access_token_user_id_idx").on(table.userId),
    uniqueIndex("agent_access_token_hash_unique").on(table.tokenHash),
  ],
);
