"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AuthModal } from "@/components/auth/auth-modal";
import { authClient } from "@/lib/auth-client";
import { ProductCard } from "@/components/product/product-card";
import { categoryHref, type CategoryLink, type Product } from "@/lib/products";
import { BagIcon, ChevronIcon, CloseIcon, MenuIcon, PlusIcon, SearchIcon, UserIcon } from "./icons";
import { Wordmark } from "./wordmark";

type MenuLink = { label: string; href: string };
type MenuItem = { label: string; children?: MenuLink[] };

const services: MenuItem[] = [
  {
    label: "Luxwebstore Services",
    children: ["Book an Appointment", "Personalization", "Repairs", "Care Guide"].map((label) => ({ label, href: "#new" })),
  },
  { label: "Store Locator" },
];
const account = ["My Orders", "Contact Us"];

/** Chevron hidden until hover/focus on desktop, always shown beside the label on touch screens. */
const chevron =
  "transition-[opacity,translate] duration-(--t-ui) ease-lux lg:-translate-x-1 lg:opacity-0 lg:group-hover:translate-x-0 lg:group-hover:opacity-100 lg:group-focus-visible:translate-x-0 lg:group-focus-visible:opacity-100";

type PanelId = "bags" | "services";

/**
 * Transparent over the hero, white once the page scrolls. From lg (1024px) the bar shows the main sections:
 * New Arrivals as a link, Bags and Services as buttons that open a panel (disclosure: aria-expanded, Esc closes and
 * returns focus); the Bags panel also shows the newest products. On phones and tablets the same sections are the
 * levels of a right-hand drawer, opened by the hamburger. Categories and products come from the database.
 * Pages without a full-bleed hero pass `overlay={false}` to keep it white from the start.
 */
export function SiteHeaderClient({
  overlay = true,
  categories,
  newArrivals,
}: {
  overlay?: boolean;
  categories: CategoryLink[];
  newArrivals: Product[];
}) {
  const bags: MenuItem = {
    label: "Bags",
    children: [
      { label: "All Bags", href: "/products" },
      ...categories.map((c) => ({ label: c.name, href: categoryHref(c.slug) })),
    ],
  };
  const panels: { id: PanelId; label: string; links: MenuLink[] }[] = [
    { id: "bags", label: bags.label, links: bags.children! },
    { id: "services", label: "Services", links: [...services[0].children!, { label: "Store Locator", href: "#services" }] },
  ];
  const [scrolled, setScrolled] = useState(false);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const panelButtons = useRef<Partial<Record<PanelId, HTMLButtonElement | null>>>({});
  const desktopNav = useRef<HTMLElement>(null);
  const solid = !overlay || scrolled || panel !== null;
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<MenuItem | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const { data: session } = authClient.useSession();
  const user = session?.user;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
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

  // Desktop panels: Esc closes the open one and puts focus back on its button; a click outside the bar closes it.
  useEffect(() => {
    if (!panel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPanel(null);
        panelButtons.current[panel]?.focus();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (!desktopNav.current?.contains(e.target as Node)) setPanel(null);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [panel]);

  // The hamburger is gone from lg up, so a drawer left open while the window widens closes itself.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 64rem)");
    const onChange = () => {
      if (desktop.matches) {
        setOpen(false);
        setLevel(null);
      }
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, []);

  const close = () => {
    setOpen(false);
    setLevel(null);
  };

  const openAuth = () => {
    close();
    setAuthOpen(true);
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
          {/* desktop: the main sections; Bags and Services open a panel. Below lg they live in the drawer */}
          <nav ref={desktopNav} aria-label="Main" className="hidden lg:block">
            <ul className={`flex items-center gap-8 ${label}`}>
              <li>
                <Link href="/new-arrivals" className="link-reveal">
                  New Arrivals
                </Link>
              </li>
              {panels.map((p) => (
                <li key={p.id}>
                  <button
                    ref={(el) => {
                      panelButtons.current[p.id] = el;
                    }}
                    type="button"
                    onClick={() => setPanel((v) => (v === p.id ? null : p.id))}
                    aria-expanded={panel === p.id}
                    aria-controls={`${p.id}-menu`}
                    className="group flex items-center gap-2"
                  >
                    <span className="link-reveal">{p.label}</span>
                    <ChevronIcon
                      className={`transition-transform duration-(--t-ui) ease-lux ${panel === p.id ? "-rotate-90" : "rotate-90"}`}
                    />
                  </button>
                </li>
              ))}
            </ul>
            {panels.map((p) => (
              <div
                key={p.id}
                id={`${p.id}-menu`}
                hidden={panel !== p.id}
                className="absolute inset-x-0 top-full border-t border-line bg-paper text-ink"
              >
                <div className="mx-auto flex max-w-page justify-between gap-10 px-gutter pt-8 xl:px-0">
                  <ul className="space-y-4 pb-8 text-sm">
                    {p.links.map((item) => (
                      <li key={item.label}>
                        <Link href={item.href} onClick={() => setPanel(null)} className="link-wipe">
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {p.id === "bags" && newArrivals.length > 0 && (
                    <div className="w-sm">
                      <Link href="/new-arrivals" onClick={() => setPanel(null)} className={`link-wipe ${label}`}>
                        New Arrivals
                      </Link>
                      <ul className="mt-4 grid grid-cols-2">
                        {newArrivals.map((product) => (
                          <li key={product.slug} onClick={() => setPanel(null)}>
                            <ProductCard product={product} sizes="12rem" />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </nav>
          <Link href="/" aria-label="Luxwebstore, home" className="col-start-1 row-start-1 lg:col-start-2">
            <Wordmark className="h-4 w-30 lg:h-5 lg:w-34" />
          </Link>
          <nav aria-label="Account" className="col-start-3 row-start-1 flex items-center justify-end gap-3 lg:gap-5">
            <a href="#contact" className={`group mr-1 hidden items-center gap-2 lg:flex ${label}`}>
              <PlusIcon /> <span className="link-wipe">Contact Us</span>
            </a>
            <a href="#bag" aria-label="Shopping bag" className="p-1 transition-opacity duration-(--t-ui) ease-lux hover:opacity-60">
              <BagIcon />
            </a>
            {user ? (
              <span className={`hidden items-center gap-3 sm:flex ${label}`}>
                <span className="max-w-32 truncate">{user.name}</span>
                <button type="button" onClick={() => authClient.signOut()} className="link-wipe uppercase">
                  Sign out
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={openAuth}
                aria-label="Sign in"
                aria-haspopup="dialog"
                className="hidden p-1 transition-opacity duration-(--t-ui) ease-lux hover:opacity-60 sm:block"
              >
                <UserIcon />
              </button>
            )}
            <a href="#search" aria-label="Search" className="p-1 transition-opacity duration-(--t-ui) ease-lux hover:opacity-60">
              <SearchIcon />
            </a>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-controls="site-menu"
              className={`flex items-center gap-2 p-1 uppercase transition-opacity duration-(--t-ui) ease-lux hover:opacity-60 lg:hidden ${label}`}
            >
              <MenuIcon />
              <span className="hidden sm:inline">Menu</span>
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
                <li>
                  <Link href="/new-arrivals" onClick={close} className="link-wipe text-lg font-medium">
                    New Arrivals
                  </Link>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setLevel(bags)}
                    className="group flex items-center gap-2 text-lg font-medium"
                  >
                    {bags.label}
                    <ChevronIcon className={chevron} />
                  </button>
                </li>
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
                <li>
                  {user ? (
                    <span className="flex gap-3">
                      <span className="truncate">{user.name}</span>
                      <button type="button" onClick={() => authClient.signOut()} className="link-wipe">
                        Sign out
                      </button>
                    </span>
                  ) : (
                    <button type="button" onClick={openAuth} aria-haspopup="dialog" className="link-wipe">
                      Sign In
                    </button>
                  )}
                </li>
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
                  <li key={child.label}>
                    <Link href={child.href} onClick={close} className="link-wipe">
                      {child.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
