import type { Metadata } from "next";
import { Reveal } from "@/components/reveal";
import { CategoryRow, FeaturedCollections, Hero, Services, SignUp } from "@/components/home/sections";
import { SiteFooter } from "@/components/home/site-footer";
import { SiteHeader } from "@/components/home/site-header";

export const metadata: Metadata = {
  title: "Luxwebstore — Leather Bags and Small Leather Goods",
  description: "Leather bags and small leather goods, hand-finished, with complimentary personalization.",
};

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <CategoryRow />
        <FeaturedCollections />
        <Services />
        <SignUp />
      </main>
      <SiteFooter />
      <Reveal />
    </>
  );
}
