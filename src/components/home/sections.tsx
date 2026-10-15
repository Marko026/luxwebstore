import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { categoryTiles, featuredCollections, hero, services } from "@/lib/catalog";

const sectionTitle = "text-sm font-bold uppercase tracking-normal";

/** A line of text that rises from its own height when it scrolls into view. */
function Line({ i = 0, children }: { i?: number; children: ReactNode }) {
  return (
    <span data-reveal="line" className="block overflow-hidden" style={{ "--i": i } as CSSProperties}>
      <span className="block">{children}</span>
    </span>
  );
}

const scrim = "absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgb(0_0_0/0.35),transparent_35%)]"; // taste-skill-ignore: neutral scrim under text on a photograph

/** Neutral scrim under text on a photo, bottom third only. */
function BottomScrim() {
  return <div aria-hidden className={scrim} />;
}

export function Hero() {
  return (
    <section
      aria-label="Featured"
      className="relative isolate h-[67svh] min-h-140 overflow-hidden bg-ink text-paper lg:h-[89svh]"
    >
      <div className="hero-media absolute inset-0 -z-20">
        <Image
          src={hero.photo.src}
          alt={hero.photo.alt}
          fill
          sizes="100vw"
          loading="eager"
          fetchPriority="high"
          className="object-cover object-[50%_40%]"
        />
      </div>
      <BottomScrim />
      <div className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-4 px-gutter text-center">
        <h1 className="hero-line overflow-hidden font-medium" style={{ "--d": "0.6s" } as CSSProperties}>
          <span className="block">{hero.label}</span>
        </h1>
        <div className="hero-line overflow-hidden p-1" style={{ "--d": "0.8s" } as CSSProperties}>
          <a href={hero.href} className="btn btn-light h-12">
            Shop now
          </a>
        </div>
      </div>
    </section>
  );
}

/** Four packshots on the page ground, label under each: 4 across on desktop, 2 × 2 on a phone. */
export function CategoryRow() {
  return (
    <section aria-label="Shop by category" className="pt-10 pb-4 lg:pt-16 lg:pb-8">
      <ul className="grid grid-cols-2 lg:grid-cols-4">
        {categoryTiles.map((tile) => (
          <li key={tile.label}>
            <a href={tile.href} className="group block text-center">
              <span data-reveal="img" className="relative block aspect-square overflow-hidden">
                <Image
                  src={tile.photo.src}
                  alt={tile.photo.alt}
                  fill
                  sizes="(min-width: 1024px) 25vw, 50vw"
                  className="object-contain transition-[scale] duration-(--t-image) ease-lux group-hover:scale-105"
                />
              </span>
              <span className="block px-2.5 pt-6 pb-10 text-xs lg:pt-14 lg:pb-8">{tile.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FeaturedCollections() {
  return (
    <section aria-label="Featured collections" className="grid lg:grid-cols-2">
      {featuredCollections.map((item) => (
        <div key={item.label} className="relative isolate aspect-3/4 overflow-hidden text-paper">
          <div data-reveal="img" className="absolute inset-0 -z-20 overflow-hidden">
            <Image
              src={item.photo.src}
              alt={item.photo.alt}
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
              style={{ objectPosition: item.position }}
            />
          </div>
          <BottomScrim />
          <div className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-4 px-gutter text-center">
            <h2 className="font-medium">
              <Line>{item.label}</Line>
            </h2>
            <Line i={1}>
              <a href={item.href} className="btn btn-outline m-1 h-12">
                Shop now
              </a>
            </Line>
          </div>
        </div>
      ))}
    </section>
  );
}

export function Services() {
  return (
    <section id="services" aria-labelledby="services-title" className="scroll-mt-16 pt-14 pb-14 lg:pt-16 lg:pb-16">
      <h2 id="services-title" className={`mb-10 text-center ${sectionTitle}`}>
        <Line>Luxwebstore Services</Line>
      </h2>
      <ul className="no-scrollbar mx-auto flex max-w-page snap-x snap-mandatory gap-4 overflow-x-auto px-gutter lg:grid lg:grid-cols-3 lg:gap-10 lg:overflow-visible xl:px-0">
        {services.map((item) => (
          <li key={item.title} className="w-[80vw] shrink-0 snap-start lg:w-auto">
            <a href={item.href} className="group block text-center">
              <span data-reveal="img" className="relative block aspect-square overflow-hidden bg-tile">
                <Image
                  src={item.photo.src}
                  alt={item.photo.alt}
                  fill
                  sizes="(min-width: 1440px) 26rem, (min-width: 1024px) 30vw, 80vw"
                  className="object-cover"
                />
              </span>
              <span className={`mt-6 block ${sectionTitle}`}>{item.title}</span>
              <span className="mt-5 inline-block font-medium">
                <span className="link-wipe">{item.link}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Black band that runs straight into the black footer. */
export function SignUp() {
  return (
    <section aria-labelledby="signup-title" className="bg-ink px-gutter pt-20 pb-6 text-center text-paper lg:pt-24">
      <h2 id="signup-title" className={sectionTitle}>
        <Line>Sign up for Luxwebstore updates</Line>
      </h2>
      <p className="mx-auto mt-6 max-w-200 text-xl font-thin lg:text-2xl">
        <Line i={1}>Be the first to hear about new collections, private appointments and news from the workshop.</Line>
      </p>
      <a href="#newsletter" className="mt-8 inline-flex items-center gap-2 text-xs font-semibold">
        + <span className="link-wipe">Subscribe</span>
      </a>
    </section>
  );
}
