"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BagIcon, ChevronIcon, CloseIcon, MenuIcon, PlusIcon, SearchIcon, UserIcon } from "./icons";
import { Wordmark } from "./wordmark";

type MenuItem = { label: string; children?: string[] };

const categories: MenuItem[] = [
  { label: "New In", children: ["New Bags", "New Small Leather Goods", "Gifts"] },
  { label: "Handbags", children: ["Top-Handle Bags", "Totes", "Crossbody Bags", "Shoulder Bags", "Box Bags", "Mini Bags"] },
  { label: "Small Leather Goods", children: ["Wallets", "Card Holders", "Belts", "Key Rings"] },
  { label: "Gifts", children: ["Gifts for Her", "Gifts for Him", "Personalized Gifts"] },
];
const services: MenuItem[] = [
  { label: "Luxwebstore Services", children: ["Book an Appointment", "Personalization", "Repairs", "Care Guide"] },
  { label: "Store Locator" },
];
const account = ["Sign In", "My Orders", "Contact Us"];

/** Chevron hidden until hover/focus on desktop, always shown beside the label on touch screens. */
const chevron =
  "transition-[opacity,translate] duration-(--t-ui) ease-lux lg:-translate-x-1 lg:opacity-0 lg:group-hover:translate-x-0 lg:group-hover:opacity-100 lg:group-focus-visible:translate-x-0 lg:group-focus-visible:opacity-100";

/** Transparent over the hero, white once the page scrolls; the menu is a right-hand drawer with a second level. */
export function SiteHeader() {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<MenuItem | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    if (open) closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    setLevel(null);
  };

  const label = "text-xs font-bold tracking-[-0.05em]";

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-30 transition-colors duration-(--t-ui) ease-lux ${
          solid ? "bg-paper text-ink" : "bg-transparent text-paper"
        }`}
      >
        <div className="mx-auto grid h-16 max-w-page grid-cols-[1fr_auto_1fr] items-center px-gutter lg:h-18 xl:px-0">
          <a href="#contact" className={`group hidden items-center gap-2 lg:flex ${label}`}>
            <PlusIcon /> <span className="link-wipe">Contact Us</span>
          </a>
          <Link href="/" aria-label="Luxwebstore, home" className="col-start-1 lg:col-start-2">
            <Wordmark className="h-4 w-30 lg:h-5 lg:w-34" />
          </Link>
          <nav aria-label="Account" className="col-start-3 flex items-center justify-end gap-3 lg:gap-5">
            <a href="#bag" aria-label="Shopping bag" className="p-1 transition-opacity duration-(--t-ui) ease-lux hover:opacity-60">
              <BagIcon />
            </a>
            <a href="#account" aria-label="My account" className="hidden p-1 transition-opacity duration-(--t-ui) ease-lux hover:opacity-60 sm:block">
              <UserIcon />
            </a>
            <a href="#search" aria-label="Search" className="p-1 transition-opacity duration-(--t-ui) ease-lux hover:opacity-60">
              <SearchIcon />
            </a>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-controls="site-menu"
              className={`flex items-center gap-2 p-1 uppercase transition-opacity duration-(--t-ui) ease-lux hover:opacity-60 ${label}`}
            >
              <MenuIcon />
              <span className="hidden lg:inline">Menu</span>
            </button>
          </nav>
        </div>
      </header>

      {/* drawer */}
      <div
        inert={!open}
        className={`fixed inset-0 z-40 transition-[opacity,visibility] duration-(--t-ui) ease-lux ${
          open ? "visible opacity-100" : "invisible opacity-0"
        }`}
      >
        <button
          type="button"
          aria-label="Close menu"
          tabIndex={-1}
          onClick={close}
          className="absolute inset-0 bg-scrim backdrop-blur-[15px]"
        />
        <div
          id="site-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className={`absolute inset-y-0 right-0 w-full overflow-hidden bg-paper text-ink transition-transform duration-(--t-ui) ease-lux sm:w-[clamp(27.5rem,36vw,38.75rem)] ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <button
            ref={closeButton}
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="absolute top-4 right-4 z-10 grid size-12 place-items-center rounded-full bg-ink text-paper transition-[scale] duration-(--t-press) active:scale-95"
          >
            <CloseIcon />
          </button>

          {/* two-panel track: level 1 and level 2 slide horizontally */}
          <div
            className={`flex h-full w-[200%] transition-transform duration-(--t-ui) ease-lux ${
              level ? "-translate-x-1/2" : "translate-x-0"
            }`}
          >
            <nav aria-label="Main" inert={!!level} className="h-full w-1/2 overflow-y-auto px-8 pt-24 pb-10 sm:pl-16">
              <ul className="space-y-5">
                {categories.map((item) => (
                  <li key={item.label}>
                    <button
                      type="button"
                      onClick={() => setLevel(item)}
                      className="group flex items-center gap-2 text-lg font-medium"
                    >
                      {item.label}
                      <ChevronIcon className={chevron} />
                    </button>
                  </li>
                ))}
              </ul>
              <ul className="mt-10 space-y-5">
                {services.map((item) => (
                  <li key={item.label}>
                    {item.children ? (
                      <button type="button" onClick={() => setLevel(item)} className="group flex items-center gap-2">
                        {item.label}
                        <ChevronIcon className={chevron} />
                      </button>
                    ) : (
                      <a href="#services" onClick={close} className="link-wipe">
                        {item.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              <ul className="mt-16 space-y-6 text-xs">
                {account.map((item) => (
                  <li key={item}>
                    <a href="#contact" onClick={close} className="link-wipe">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label={level?.label ?? "Submenu"} inert={!level} className="h-full w-1/2 overflow-y-auto px-8 pt-24 pb-10 sm:pl-16">
              <button
                type="button"
                onClick={() => setLevel(null)}
                className={`group flex items-center gap-2 uppercase ${label}`}
              >
                <ChevronIcon className="rotate-180" />
                <span className="link-wipe">Back</span>
              </button>
              <p className="mt-8 text-2xl font-thin">{level?.label}</p>
              <ul className="mt-8 space-y-5">
                {level?.children?.map((child) => (
                  <li key={child}>
                    <a href="#new" onClick={close} className="link-wipe">
                      {child}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </>
  );
}
