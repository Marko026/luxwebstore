import { allPhotos } from "@/lib/catalog";
import { ChevronIcon } from "./icons";
import { Wordmark } from "./wordmark";

const columns = [
  { title: "May we help you?", links: ["Contact Us", "My Order", "FAQs", "Email Unsubscribe", "Sitemap"] },
  {
    title: "The company",
    links: ["About Luxwebstore", "The Workshop", "Careers", "Legal", "Privacy Policy", "Cookie Policy", "Cookie Settings"],
  },
];
const serviceLinks = ["Discover Our Services", "Book an Appointment", "Personalization", "Repairs"];

const label = "text-xs font-bold uppercase";

function LinkList({ links }: { links: string[] }) {
  return (
    <ul className="space-y-4 text-xs">
      {links.map((item) => (
        <li key={item}>
          <a href="#contact" className="link-wipe">
            {item}
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Underlined form field with an arrow, as on the reference. */
function LineField({ id, labelText, placeholder, type }: { id: string; labelText: string; placeholder: string; type: string }) {
  return (
    <form action="#" className="relative mt-4">
      <label htmlFor={id} className="sr-only">
        {labelText}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        className="h-11 w-full border-b border-paper/40 bg-transparent pr-10 text-base text-paper transition-colors duration-(--t-ui) ease-lux placeholder:text-paper/60 focus:border-paper focus:outline-none"
      />
      <button
        type="submit"
        aria-label={`Submit ${labelText.toLowerCase()}`}
        className="absolute top-1/2 right-0 -translate-y-1/2 p-2 transition-[translate] duration-(--t-ui) ease-lux hover:translate-x-1"
      >
        <ChevronIcon />
      </button>
    </form>
  );
}

export function SiteFooter() {
  return (
    <footer id="contact" className="scroll-mt-16 bg-ink text-paper">
      <div className="mx-auto max-w-page px-gutter xl:px-0">
        <div className="grid gap-y-2 pt-14 lg:grid-cols-12 lg:gap-x-8 lg:pt-28">
          {/* link columns: open columns on desktop, accordions on a phone */}
          {columns.map((col) => (
            <div key={col.title} className="lg:col-span-3">
              <details className="group border-b border-paper/20 py-4 lg:hidden">{/* taste-skill-ignore: accordion dividers, as on the reference footer */}
                <summary className={`flex cursor-pointer list-none items-center justify-between ${label}`}>
                  {col.title}
                  <ChevronIcon className="rotate-90 transition-transform duration-(--t-ui) ease-lux group-open:-rotate-90" />
                </summary>
                <div className="pt-5 pb-2">
                  <LinkList links={col.links} />
                </div>
              </details>
              <div className="hidden lg:block">
                <h2 className={`${label} mb-6`}>{col.title}</h2>
                <LinkList links={col.links} />
              </div>
            </div>
          ))}

          <div className="order-first mb-8 space-y-10 lg:order-0 lg:col-span-6 lg:col-start-7 lg:mb-0">
            <div>
              <h2 className={label}>Store locator</h2>
              <LineField id="store" labelText="Country, region or city" placeholder="Country/Region, City" type="text" />
            </div>
            <div id="newsletter" className="scroll-mt-24">
              <h2 className={label}>Sign up for Luxwebstore updates</h2>
              <p className="mt-3 max-w-[60ch] text-xs">
                Get updates on new collections, personalized communication and the workshop&apos;s news.
              </p>
              <LineField id="email" labelText="Email" placeholder="Email" type="email" />
            </div>
            <div>
              <h2 className={label}>Country/Region</h2>
              <a href="#contact" className="link-wipe mt-3 text-xs">
                Serbia (EUR €)
              </a>
            </div>
          </div>
        </div>

        <div className="pt-12 lg:pt-20">
          <h2 className={`${label} mb-6`}>Luxwebstore services</h2>
          <LinkList links={serviceLinks} />
        </div>

        <div className="pt-16 text-xs">
          <p>© 2026 Luxwebstore. All rights reserved. Prices include VAT.</p>
          <details className="mt-3">
            <summary className="cursor-pointer">Sample photography from Unsplash and Pexels (free licences)</summary>
            <ul className="mt-3 columns-2 gap-6 lg:columns-4">
              {allPhotos.map((photo) => (
                <li key={photo.src}>
                  <a href={photo.source} className="link-wipe" rel="noreferrer" target="_blank">
                    {photo.source.includes("pexels") ? "Pexels" : "Unsplash"} · {photo.src.split("/").pop()}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </div>

        <div className="pt-16 pb-10" aria-hidden>
          <Wordmark className="h-auto w-full" />
        </div>
      </div>
    </footer>
  );
}
