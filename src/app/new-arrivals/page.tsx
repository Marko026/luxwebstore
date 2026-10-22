import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { SiteFooter } from "@/components/home/site-footer";
import { SiteHeader } from "@/components/home/site-header";
import { CategoryNav } from "@/components/product/category-nav";
import { ProductCard } from "@/components/product/product-card";
import { getCategories, getNewArrivals } from "@/db/queries/products";

export const metadata: Metadata = {
  title: "New Arrivals — Luxwebstore",
  description: "The latest leather bags, hand-finished in Italy.",
};

/**
 * Newest products in the same title row and edge-to-edge grid as the category page (4 across, 2 on a phone).
 * The category bar marks no link as current (this isn't a category); the button under the grid leads on to every bag.
 */
export default async function NewArrivalsPage() {
  const [products, categories] = await Promise.all([getNewArrivals(), getCategories()]);

  return (
    <>
      <SiteHeader overlay={false} />
      <main className="pt-16 lg:pt-18">
        <div className="px-gutter pt-10 lg:pt-16">
          <nav aria-label="Breadcrumb" className="text-xs text-muted">
            <ol className="flex flex-wrap gap-1.5">
              <li>
                <Link href="/" className="link-wipe">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>New Arrivals</li>
            </ol>
          </nav>
          <div className="flex items-end justify-between gap-4 pt-8">
            <h1 className="text-2xl font-thin">New Arrivals</h1>
            <p className="shrink-0 text-xs">
              {products.length} {products.length === 1 ? "item" : "items"}
            </p>
          </div>
          <p className="mt-2 max-w-[48ch] pb-3 text-sm text-muted lg:pb-5">
            The latest bags to reach the atelier, newest first.
          </p>
        </div>
        <CategoryNav categories={categories} />

        {products.length ? (
          <>
            <ul className="grid grid-cols-2">
              {products.map((p) => (
                <li key={p.slug}>
                  <ProductCard product={p} sizes="50vw" />
                </li>
              ))}
            </ul>
            <div className="flex justify-center px-gutter pt-6 pb-16 lg:pb-24">
              <Link href="/products" className="btn btn-dark h-12">
                Shop all bags
              </Link>
            </div>
          </>
        ) : (
          <p className="px-gutter pb-16 text-xs text-muted">
            Nothing here yet.{" "}
            <Link href="/products" className="link-wipe text-ink">
              See all bags
            </Link>
          </p>
        )}
      </main>
      <SiteFooter />
      <Reveal />
    </>
  );
}
