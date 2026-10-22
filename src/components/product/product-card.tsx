import Image from "next/image";
import Link from "next/link";
import { formatPrice, productHref, stockState, type Product } from "@/lib/products";

/** Packshot on the page ground with name and price under it, like the home category row. No border, no "Add to bag" button. */
export function ProductCard({ product, sizes }: { product: Product; sizes: string }) {
  const photo = product.gallery[0];
  const soldOut = stockState(product.stock) === "sold-out";

  return (
    // scroll margin: a card reached by Tab scrolls clear of the fixed header and the pinned category bar
    <Link href={productHref(product.slug)} className="group block scroll-mt-28 text-center lg:scroll-mt-32">
      <span data-reveal="img" className="relative block aspect-square overflow-hidden">
        {/* The DB allows a product without images: keep the empty tile rather than crash the listing */}
        {photo && (
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            sizes={sizes}
            className="object-contain transition-[scale] duration-(--t-image) ease-lux group-hover:scale-105"
          />
        )}
      </span>
      <span className="block px-2.5 pt-6 text-xs lg:pt-10">{product.name}</span>
      <span className="block px-2.5 pt-1 pb-10 text-xs lg:pb-8">
        {formatPrice(product.priceCents)}
        {soldOut && <span className="text-muted"> · Sold out</span>}
      </span>
    </Link>
  );
}
