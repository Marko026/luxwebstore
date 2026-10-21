import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { categories } from "@/db/schema";
import type { Db } from "@/lib/bag";
import { createTestDb } from "./db";

let db: Db;

beforeAll(async () => {
  db = await createTestDb();
});

async function categoryExists(slug: string) {
  const rows = await db.select().from(categories).where(eq(categories.slug, slug));
  return rows.length > 0;
}

// Checkout relies on `db.transaction` being all-or-nothing (ADR 0003); PGlite must behave like Neon here.
describe("db.transaction", () => {
  it("rolls back every write when one write fails", async () => {
    const result = db.transaction(async (tx) => {
      await tx.insert(categories).values({ slug: "rolled-back", name: "Rolled back" });
      // The same slug again breaks the unique constraint
      await tx.insert(categories).values({ slug: "rolled-back", name: "Rolled back" });
    });

    await expect(result).rejects.toThrow();
    expect(await categoryExists("rolled-back")).toBe(false);
  });

  it("keeps every write when all succeed", async () => {
    await db.transaction(async (tx) => {
      await tx.insert(categories).values({ slug: "kept-1", name: "Kept 1" });
      await tx.insert(categories).values({ slug: "kept-2", name: "Kept 2" });
    });

    expect(await categoryExists("kept-1")).toBe(true);
    expect(await categoryExists("kept-2")).toBe(true);
  });
});
