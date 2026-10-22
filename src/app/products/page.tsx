import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { SiteFooter } from "@/components/home/site-footer";
import { SiteHeader } from "@/components/home/site-header";
import { CategoryNav } from "@/components/product/category-nav";
import { ProductCard } from "@/components/product/product-card";
import { photos } from "@/lib/catalog";
import { getCategories, getProducts } from "@/db/queries/products";

export const metadata: Metadata = {
  title: "Bags — Luxwebstore",
  description: "Leather handbags, shoulder bags, crossbody bags and men's bags, hand-finished in Italy.",
};

/** Category page, as on the reference: editorial hero, item count, then a 4-across edge-to-edge grid (2 on a phone). */
export default async function ProductsPage() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);

  return (
    <>
      <SiteHeader />
      <main>
        <section aria-label="Bags" className="relative isolate h-[60svh] min-h-120 overflow-hidden bg-ink text-paper">
          <div className="hero-media absolute inset-0 -z-20">
            <Image
              src={photos.edWomen.src}
              alt={photos.edWomen.alt}
              fill
              sizes="100vw"
              loading="eager"
              fetchPriority="high"
              className="object-cover object-[50%_60%]"
            />
          </div>
          <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(0_0_0/0.35),transparent_35%)]" />{/* taste-skill-ignore: neutral scrim under text on a photograph */}
          <div className="absolute inset-x-0 bottom-10 px-gutter">
            <h1 className="hero-line overflow-hidden text-2xl font-thin">
              <span className="block">Bags</span>
            </h1>
            <p className="hero-line mt-2 max-w-[48ch] overflow-hidden text-sm" style={{ "--d": "0.2s" } as CSSProperties}>
              <span className="block">Leather bags cut and finished by hand, made to soften with use.</span>
            </p>
          </div>
        </section>

        <div className="flex items-center justify-between px-gutter pt-6 pb-3 text-xs lg:pt-8">
          <nav aria-label="Breadcrumb" className="text-muted">
            <ol className="flex gap-1.5">
              <li>
                <Link href="/" className="link-wipe">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>Bags</li>
            </ol>
          </nav>
          <p>{products.length} items</p>
        </div>
        <CategoryNav categories={categories} active={null} />

        <ul className="grid grid-cols-2">
          {products.map((p) => (
            <li key={p.slug}>
              <ProductCard product={p} sizes="50vw" />
            </li>
          ))}
        </ul>
      </main>
      <SiteFooter />
      <Reveal />
    </>
  );
}
