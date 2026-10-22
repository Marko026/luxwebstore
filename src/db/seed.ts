// Loads the sample catalog, and a test User for browser checks when TEST_USER_EMAIL and TEST_USER_PASSWORD are set.
// Idempotent: rows are upserted by slug or email, so it is safe to re-run.
// Run with: npm run db:seed. Every name, price and stock level is placeholder content.
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { account, categories, products, user } from "./schema";

const db = drizzle({ client: neon(process.env.DATABASE_URL!) });

const categoryData = [
  { slug: "womens-top-handle-bags", name: "Women's Top-Handle Bags" },
  { slug: "womens-shoulder-bags", name: "Women's Shoulder Bags" },
  { slug: "crossbody-bags", name: "Crossbody Bags" },
  { slug: "mens-bags", name: "Men's Bags" },
];

const productData = [
  {
    slug: "black-top-handle-bag",
    category: "womens-top-handle-bags",
    name: "Textured leather top-handle bag",
    priceCents: 245000,
    stock: 6,
    images: [
      {
        src: "/images/products/pk-black-top-handle-bag-front.jpg",
        alt: "Black textured leather dome top-handle bag with two rolled handles and gold-tone rings, seen from the front",
      },
      {
        src: "/images/home/ed-women.jpg",
        alt: "A woman in an olive wool suit seated in a copper-lit room with a black leather bag on her lap",
      },
    ],
    description:
      "A structured top-handle bag in black grained calfskin, closed with a gold-tone zip. Sized for the day, with room for a phone, wallet and keys.",
    details: ["Black grained calfskin", "Gold-tone hardware", "Zip closure", "Interior slip pocket", "W 28 × H 20 × D 11 cm", "Made in Italy"],
    care: "Keep away from direct sunlight and moisture. Store stuffed, in the dust bag provided.",
  },
  {
    slug: "grey-pleated-shoulder-bag",
    category: "womens-shoulder-bags",
    name: "Pleated leather shoulder bag",
    priceCents: 189000,
    stock: 2,
    images: [
      { src: "/images/products/pk-grey-pleated-shoulder-bag-front.jpg", alt: "Grey pleated leather shoulder bag with a long strap" },
    ],
    description: "Soft grey nappa gathered into deep pleats, on a long strap that sits comfortably on the shoulder.",
    details: ["Grey nappa leather", "Adjustable long strap", "Magnetic closure", "W 32 × H 22 × D 9 cm", "Made in Italy"],
    care: "Wipe with a soft dry cloth. Do not use solvents or leather creams on nappa.",
  },
  {
    slug: "black-camera-crossbody-bag",
    category: "crossbody-bags",
    name: "Leather camera crossbody bag",
    priceCents: 135000,
    stock: 0,
    images: [
      { src: "/images/products/pk-black-camera-crossbody-bag-front.jpg", alt: "Black leather camera crossbody bag with a gold zip pocket" },
    ],
    description: "A compact camera bag in smooth black calfskin, with a gold-tone zip pocket on the front.",
    details: ["Smooth black calfskin", "Gold-tone hardware", "Front zip pocket", "Adjustable strap", "W 22 × H 15 × D 7 cm", "Made in Italy"],
    care: "Keep away from direct sunlight and moisture. Store in the dust bag provided.",
  },
  {
    slug: "green-leather-tote",
    category: "womens-top-handle-bags",
    name: "Structured leather tote",
    priceCents: 198000,
    stock: 5,
    images: [
      {
        src: "/images/products/pk-green-leather-tote-front.jpg",
        alt: "Forest-green structured leather tote with two tall handles and gold-tone clasps",
      },
    ],
    description: "A squared tote in forest-green smooth leather, with two tall handles and a pair of gold-tone clasps on the front.",
    details: ["Forest-green smooth leather", "Gold-tone hardware", "Two tall handles", "Detachable shoulder strap", "W 30 × H 24 × D 12 cm", "Made in Italy"],
    care: "Wipe with a soft dry cloth. Keep away from direct sunlight so the colour stays even.",
  },
  {
    slug: "tan-barrel-bag",
    category: "womens-top-handle-bags",
    name: "Leather barrel bag",
    priceCents: 142000,
    stock: 8,
    images: [
      {
        src: "/images/products/pk-tan-barrel-bag-front.jpg",
        alt: "Rose-tan leather barrel bag with brown handles and a long brown strap",
      },
    ],
    description: "A small barrel bag in rose-tan washed leather, trimmed in brown, with short handles and a long strap.",
    details: ["Rose-tan washed leather", "Brown leather trims", "Zip closure", "Detachable long strap", "W 26 × H 16 × D 14 cm", "Made in Italy"],
    care: "Washed leather marks easily: blot spills at once and let it dry naturally.",
  },
  {
    slug: "cognac-croc-shoulder-bag",
    category: "womens-shoulder-bags",
    name: "Croc-embossed shoulder bag",
    priceCents: 226000,
    stock: 3,
    images: [
      {
        src: "/images/products/pk-cognac-croc-shoulder-bag-front.jpg",
        alt: "Cognac croc-embossed leather shoulder bag with a flap and a gold-tone clasp on its strap, seen from the side",
      },
    ],
    description: "A deep, flap-top shoulder bag in cognac croc-embossed leather, on a rolled strap with gold-tone clasps.",
    details: ["Cognac croc-embossed leather", "Gold-tone hardware", "Flap closure", "Rolled shoulder strap", "W 28 × H 26 × D 14 cm", "Made in Italy"],
    care: "Dust the embossed grain with a soft brush. Store stuffed, in the dust bag provided.",
  },
  {
    slug: "two-tone-structured-bag",
    category: "womens-shoulder-bags",
    name: "Two-tone structured bag",
    priceCents: 172000,
    stock: 4,
    images: [
      {
        src: "/images/products/pk-two-tone-structured-bag-front.jpg",
        alt: "Dark brown textured leather bag with black handles and tabs, shown open with its long strap in front",
      },
    ],
    description: "A boxy bag in dark brown textured leather with black handles and tabs. Carry it by hand or on the long strap.",
    details: ["Dark brown textured leather", "Black smooth-leather handles", "Open top with magnetic tab", "Detachable long strap", "W 30 × H 20 × D 13 cm", "Made in Italy"],
    care: "Keep away from direct sunlight and moisture. Store stuffed, in the dust bag provided.",
  },
  {
    slug: "brown-camera-crossbody-bag",
    category: "crossbody-bags",
    name: "Washed leather camera bag",
    priceCents: 128000,
    stock: 10,
    images: [
      {
        src: "/images/products/pk-brown-camera-crossbody-bag-front.jpg",
        alt: "Brown washed leather camera crossbody bag with a front zip pocket and an adjustable strap",
      },
    ],
    description: "A camera bag in brown washed leather, with a front zip pocket and an adjustable strap worn across the body.",
    details: ["Brown washed leather", "Gold-tone hardware", "Front zip pocket", "Adjustable strap", "W 22 × H 16 × D 9 cm", "Made in Italy"],
    care: "Washed leather marks easily: blot spills at once and let it dry naturally.",
  },
  {
    slug: "cognac-leather-satchel",
    category: "mens-bags",
    name: "Buckled leather satchel",
    priceCents: 210000,
    stock: 12,
    images: [{ src: "/images/home/pk-satchel.jpg", alt: "Cognac leather satchel with two buckled straps" }],
    description:
      "A cognac vegetable-tanned leather satchel with two buckled straps. The leather darkens and softens with use.",
    details: ["Cognac vegetable-tanned leather", "Brass buckles", 'Fits a 14" laptop', "W 38 × H 28 × D 10 cm", "Made in Italy"],
    care: "Treat with a neutral leather balm twice a year. Let it dry naturally if it gets wet.",
  },
];

async function main() {
  const savedCategories = await db
    .insert(categories)
    .values(categoryData)
    .onConflictDoUpdate({ target: categories.slug, set: { name: sql`excluded.name` } })
    .returning({ id: categories.id, slug: categories.slug });
  const categoryId = new Map(savedCategories.map((c) => [c.slug, c.id]));

  const rows = productData.map(({ category, ...p }) => {
    const id = categoryId.get(category);
    if (!id) throw new Error(`Unknown category "${category}" for product "${p.slug}"`);
    return { ...p, categoryId: id };
  });

  await db
    .insert(products)
    .values(rows)
    .onConflictDoUpdate({
      target: products.slug,
      set: {
        categoryId: sql`excluded.category_id`,
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        details: sql`excluded.details`,
        care: sql`excluded.care`,
        priceCents: sql`excluded.price_cents`,
        stock: sql`excluded.stock`,
        images: sql`excluded.images`,
        updatedAt: sql`now()`,
      },
    });

  console.log(`Seeded ${savedCategories.length} categories and ${rows.length} products.`);

  await seedTestUser();
}

/**
 * A User with an email-and-password account, as Better Auth's sign-up would create it; its password is reset on each run.
 * Only an @example.test address (a reserved domain no real person has) is accepted, so the reset can never take over
 * a real account. Stored lowercase, as Better Auth looks it up on sign-in.
 */
async function seedTestUser() {
  const email = process.env.TEST_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) return;
  if (!email.endsWith("@example.test")) throw new Error(`TEST_USER_EMAIL must be an @example.test address, not ${email}`);

  const [seeded] = await db
    .insert(user)
    .values({ id: randomUUID(), name: "Test User", email, isAnonymous: false })
    .onConflictDoUpdate({ target: user.email, set: { updatedAt: sql`now()` } })
    .returning({ id: user.id });
  if (!seeded) throw new Error(`Could not seed test User ${email}`);
  const { id } = seeded;

  await db.batch([
    db.delete(account).where(and(eq(account.userId, id), eq(account.providerId, "credential"))),
    db.insert(account).values({
      id: randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: await hashPassword(password),
      updatedAt: new Date(),
    }),
  ]);

  console.log(`Seeded test User ${email}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
