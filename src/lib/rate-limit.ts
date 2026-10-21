// A fixed-window request counter in Postgres, so the limit holds across server instances (ADR 0002).
import { lte, sql } from "drizzle-orm";
import { rateLimits } from "@/db/schema";
import type { Db } from "@/lib/bag";

/** At most `max` requests per key in a window of `windowSeconds`, which starts at the key's first request. */
export type RateLimit = { max: number; windowSeconds: number };

/**
 * Counts one request for `key` and says whether it is within `limit`. A refused request is counted too, but never
 * extends the window. The count is one atomic upsert, so concurrent requests cannot both take the last place; a
 * transaction would add nothing. Time is the database's, the same for every server instance.
 */
export async function consumeRateLimit(db: Db, key: string, limit: RateLimit): Promise<boolean> {
  const expired = sql`${rateLimits.expiresAt} <= now()`;
  const [[row]] = await Promise.all([
    db
      .insert(rateLimits)
      .values({ key, count: 1, expiresAt: sql`now() + make_interval(secs => ${limit.windowSeconds})` })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`case when ${expired} then 1 else ${rateLimits.count} + 1 end`,
          expiresAt: sql`case when ${expired} then excluded.expires_at else ${rateLimits.expiresAt} end`,
        },
      })
      .returning({ count: rateLimits.count }),
    // Expired rows of any key; one the count just renewed is no longer expired, so it stays
    db.delete(rateLimits).where(lte(rateLimits.expiresAt, sql`now()`)),
  ]);
  return row!.count <= limit.max;
}
