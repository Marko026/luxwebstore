import Link from "next/link";
import { categoryHref, type CategoryLink } from "@/lib/products";

/**
 * Row of links to every category, with "All" for /products. Plain links (no JS filter): they work without
 * scripts, can be shared, and need no extra ARIA. The current one carries aria-current and keeps its underline,
 * so it isn't marked by colour alone. Scrolls sideways on a phone. `active={null}` marks "All"; leave it out
 * on pages that aren't a category (e.g. New Arrivals) so no link reads as the current page.
 */
export function CategoryNav({ categories, active }: { categories: CategoryLink[]; active?: string | null }) {
  const items = [{ href: "/products", name: "All", current: active === null }].concat(
    categories.map((c) => ({ href: categoryHref(c.slug), name: c.name, current: c.slug === active })),
  );

  return (
    <nav aria-label="Categories" className="no-scrollbar overflow-x-auto">
      <ul className="flex gap-6 text-xs whitespace-nowrap">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className="link-reveal text-muted transition-colors duration-(--t-ui) ease-lux hover:text-ink aria-[current=page]:text-ink aria-[current=page]:after:scale-100"
            >
              {item.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
