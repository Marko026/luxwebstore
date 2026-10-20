import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/reveal";
import { ChevronIcon } from "@/components/home/icons";
import { SiteFooter } from "@/components/home/site-footer";
import { SiteHeader } from "@/components/home/site-header";
import { ProductCard } from "@/components/product/product-card";
import { AddToBagButton } from "@/components/product/add-to-bag-button";
import { frame } from "@/components/product/frame";
import { ProductGallery } from "@/components/product/product-gallery";
import { getProduct, getProductSlugs, getRelatedProducts } from "@/db/queries/products";
import { categoryHref, formatPrice, stockLabel, stockState } from "@/lib/products";

const sectionTitle = "text-sm font-bold uppercase tracking-normal";

// Every product in the database at build time is prerendered; unknown slugs fall through to 404.
export async function generateStaticParams() {
  return (await getProductSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const product = await getProduct((await params).slug);
  if (!product) return {};
  return { title: `${product.name} — Luxwebstore`, description: product.description };
}

/** Hairline accordion row, as the reference uses between product details. */
function Accordion({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group border-b border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between py-5 text-xs font-bold uppercase">
        {title}
        <ChevronIcon className="rotate-90 transition-transform duration-(--t-ui) ease-lux group-open:-rotate-90" />
      </summary>
      <div className="pb-6 text-xs">{children}</div>
    </details>
  );
}

// Header and footer form the shared App Shell; everything that reads the slug streams in behind Suspense,
// so client navigation between products is instant (Partial Prefetching validates this in dev).
export default function ProductPage({ params }: PageProps<"/products/[slug]">) {
  return (
    <>
      <SiteHeader overlay={false} />
      <main className="pt-16 lg:pt-18">
        <Suspense fallback={<ProductSkeleton />}>
          <ProductDetails params={params} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

/** Same footprint as the loaded page, so nothing jumps when the product streams in. */
function ProductSkeleton() {
  return (
    <div aria-busy className="lg:grid lg:grid-cols-12">
      <div className={`bg-tile lg:col-span-7 xl:col-span-8 ${frame}`} />
    </div>
  );
}

async function ProductDetails({ params }: { params: PageProps<"/products/[slug]">["params"] }) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();

  const state = stockState(product.stock);
  const soldOut = state === "sold-out";
  const related = await getRelatedProducts(product.slug);

  return (
    <>
      <div className="lg:grid lg:grid-cols-12">
        <div className="lg:col-span-7 xl:col-span-8">
          <ProductGallery photos={product.gallery} name={product.name} />
        </div>

        <div className="px-gutter pt-8 pb-14 lg:sticky lg:top-18 lg:col-span-5 lg:self-start lg:px-16 lg:pt-16 xl:col-span-4">
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
              <li>
                <Link href={categoryHref(product.categorySlug)} className="link-wipe">
                  {product.category}
                </Link>
              </li>
            </ol>
          </nav>

          <p className={`mt-8 ${sectionTitle}`}>{product.category}</p>
          <h1 className="mt-3 text-xl font-thin lg:text-2xl">{product.name}</h1>
          <p className="mt-4">{formatPrice(product.priceCents)}</p>
          <p className="mt-1 text-xs text-muted">Price includes VAT</p>

          <p className="mt-8 flex items-center gap-2 text-xs">
            <span
              aria-hidden
              className={`size-1.5 rounded-full ${soldOut ? "border border-ink" : "bg-ink"}`}
            />
            {stockLabel(product.stock)}
            {state === "low" && <span className="text-muted">· order soon</span>}
          </p>

          <AddToBagButton slug={product.slug} soldOut={soldOut} />
          {soldOut && (
            <a href="#contact" className="mt-4 inline-block text-xs">
              <span className="link-wipe">Contact us about availability</span>
            </a>
          )}

          <p className="mt-10">{product.description}</p>

          <div className="mt-8 border-t border-line">
            <Accordion title="Details">
              <ul className="space-y-1.5">
                {product.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </Accordion>
            <Accordion title="Materials & care">
              <p>{product.care}</p>
            </Accordion>
          </div>

          <ul className="mt-8 space-y-4 text-xs">
            <li>
              <a href="#contact" className="link-wipe">
                Book an appointment
              </a>
            </li>
            <li>
              <a href="#contact" className="link-wipe">
                Complimentary personalization
              </a>
            </li>
          </ul>
        </div>
      </div>

      <section aria-labelledby="related-title" className="pt-14 pb-4 lg:pt-16 lg:pb-8">
        <h2 id="related-title" className={`mb-6 text-center lg:mb-10 ${sectionTitle}`}>
          You may also like
        </h2>
        <ul className="grid grid-cols-2 lg:grid-cols-3">
          {related.map((p) => (
            <li key={p.slug}>
              <ProductCard product={p} sizes="(min-width: 1024px) 33vw, 50vw" />
            </li>
          ))}
        </ul>
      </section>
      <Reveal />
    </>
  );
}
