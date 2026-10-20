import { getCategories, getNewArrivals } from "@/db/queries/products";
import { SiteHeaderClient } from "./site-header-client";

/** Reads the menu data (cached, so it stays in the static shell) and hands it to the client header. */
export async function SiteHeader({ overlay }: { overlay?: boolean }) {
  const [categories, newArrivals] = await Promise.all([getCategories(), getNewArrivals(2)]);
  return <SiteHeaderClient overlay={overlay} categories={categories} newArrivals={newArrivals} />;
}
