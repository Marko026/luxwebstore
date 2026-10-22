import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/reveal";
import { SiteFooter } from "@/components/home/site-footer";
import { SiteHeader } from "@/components/home/site-header";
import { CategoryNav } from "@/components/product/category-nav";
import { ProductCard } from "@/components/product/product-card";
import { getCategories, getCategory, getCategorySlugs } from "@/db/queries/products";

// Every category in the database at build time is prerendered; unknown slugs fall through to 404.
export async function generateStaticParams() {
  return (await getCategorySlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/category/[slug]">): Promise<Metadata> {
  const category = await getCategory((await params).slug);
  if (!category) return {};
  return { title: `${category.name} — Luxwebstore`, description: `${category.name}, hand-finished in Italy.` };
}

// Same App Shell as the product page: header and footer are static, the slug-dependent part streams behind Suspense.
export default function CategoryPage({ params }: PageProps<"/category/[slug]">) {
  return (
    <>
      <SiteHeader overlay={false} />
      <main className="pt-16 lg:pt-18">
        <Suspense fallback={<CategorySkeleton />}>
          <CategoryProducts params={params} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

/** Same footprint as the title row and category bar, so the grid doesn't jump when the category streams in. */
function CategorySkeleton() {
  return <div aria-busy className="h-60 lg:h-72" />;
}

/** Category page: title, item count, then the same edge-to-edge grid as /products (2 large columns). */
async function CategoryProducts({ params }: { params: PageProps<"/category/[slug]">["params"] }) {
  const { slug } = await params;
  const [category, categories] = await Promise.all([getCategory(slug), getCategories()]);
  if (!category) notFound();

  return (
    <>
      <div className="px-gutter pt-10 lg:pt-16">
        <nav aria-label="Breadcrumb" className="text-xs text-muted">
          <ol className="flex flex-wrap gap-1.5">
            <li>
              <Link href="/" className="link-wipe">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href="/products" className="link-wipe">
                Bags
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>{category.name}</li>
          </ol>
        </nav>
        <div className="flex items-end justify-between gap-4 pt-8 pb-3 lg:pb-5">
          <h1 className="text-2xl font-thin">{category.name}</h1>
          <p className="shrink-0 text-xs">
            {category.products.length} {category.products.length === 1 ? "item" : "items"}
          </p>
        </div>
      </div>
      <CategoryNav categories={categories} active={slug} />

      {category.products.length ? (
        <ul className="grid grid-cols-2">
          {category.products.map((p) => (
            <li key={p.slug}>
              <ProductCard product={p} sizes="50vw" />
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-gutter pb-16 text-xs text-muted">
          Nothing here yet.{" "}
          <Link href="/products" className="link-wipe text-ink">
            See all bags
          </Link>
        </p>
      )}
      <Reveal />
    </>
  );
}
