import { getCategories } from "@/db/queries/products";
import { SiteHeaderClient } from "./site-header-client";

/** Reads the categories for the menu (cached, so it stays in the static shell) and hands them to the client header. */
export async function SiteHeader({ overlay }: { overlay?: boolean }) {
  return <SiteHeaderClient overlay={overlay} categories={await getCategories()} />;
}
