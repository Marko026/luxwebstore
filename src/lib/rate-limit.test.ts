import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { rateLimits } from "@/db/schema";
import { createTestDb } from "@/test/db";
import { consumeRateLimit } from "./rate-limit";

let db: Awaited<ReturnType<typeof createTestDb>>;
let seq = 0;

beforeAll(async () => {
  db = await createTestDb();
});

// Each test gets its own key, so tests never see each other's counts.
function aKey() {
  return `key-${++seq}`;
}

/** The window passing: the key's row is already past its expiry. */
async function endWindow(key: string) {
  await db
    .update(rateLimits)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(eq(rateLimits.key, key));
}

async function consumeTimes(key: string, times: number, limit: { max: number; windowSeconds: number }) {
  const results: boolean[] = [];
  for (let i = 0; i < times; i++) results.push(await consumeRateLimit(db, key, limit));
  return results;
}

describe("consumeRateLimit", () => {
  const limit = { max: 3, windowSeconds: 60 };

  it("allows max requests for a key and refuses the next one", async () => {
    const key = aKey();

    expect(await consumeTimes(key, 3, limit)).toEqual([true, true, true]);
    expect(await consumeRateLimit(db, key, limit)).toBe(false);
  });

  it("counts keys separately", async () => {
    const busy = aKey();
    const quiet = aKey();
    await consumeTimes(busy, 4, limit);

    expect(await consumeRateLimit(db, quiet, limit)).toBe(true);
  });

  it("does not extend the window when a request is refused", async () => {
    const key = aKey();
    await consumeTimes(key, 5, limit);
    const [before] = await db.select().from(rateLimits).where(eq(rateLimits.key, key));

    await consumeRateLimit(db, key, limit);
    const [after] = await db.select().from(rateLimits).where(eq(rateLimits.key, key));
    expect(after!.expiresAt).toEqual(before!.expiresAt);

    await endWindow(key);
    expect(await consumeRateLimit(db, key, limit)).toBe(true);
  });

  it("starts counting again from 1 after the window passes", async () => {
    const key = aKey();
    await consumeTimes(key, 5, limit);
    await endWindow(key);

    expect(await consumeTimes(key, 3, limit)).toEqual([true, true, true]);
    expect(await consumeRateLimit(db, key, limit)).toBe(false);
  });

  it("deletes other keys' expired rows but keeps unexpired ones", async () => {
    const expired = aKey();
    const live = aKey();
    const counting = aKey();
    await consumeRateLimit(db, expired, limit);
    await consumeRateLimit(db, live, limit);
    await endWindow(expired);

    await consumeRateLimit(db, counting, limit);

    const keys = (await db.select().from(rateLimits)).map((row) => row.key);
    expect(keys).not.toContain(expired);
    expect(keys).toContain(live);
    expect(keys).toContain(counting);
  });

  it("never lets more than max through when requests are concurrent", async () => {
    const key = aKey();

    const results = await Promise.all(Array.from({ length: 10 }, () => consumeRateLimit(db, key, limit)));

    expect(results.filter(Boolean)).toHaveLength(3);
  });
});
