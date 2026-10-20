"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { Photo } from "@/lib/catalog";
import { frame } from "./frame";

/**
 * Phone: a swipe row, one image per screen, with a "1 / 3" counter.
 * Desktop: the same images stacked in a column beside the sticky product details.
 * The first image is the packshot (contained on white), the rest are editorial (cover).
 */
export function ProductGallery({ photos, name }: { photos: Pick<Photo, "src" | "alt">[]; name: string }) {
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);

  const onScroll = () => {
    const el = track.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className="relative">
      <ul
        ref={track}
        onScroll={onScroll}
        aria-label={`${name}, photos`}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto lg:flex-col lg:gap-px lg:overflow-visible"
      >
        {photos.map((photo, i) => (
          <li key={photo.src} className={`relative w-full shrink-0 snap-start overflow-hidden ${frame}`}>
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="(min-width: 1024px) 60vw, 100vw"
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              className={i === 0 ? "object-contain lg:p-8" : "object-cover"}
            />
          </li>
        ))}
      </ul>
      {photos.length > 1 && (
        <p aria-hidden className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-sm bg-paper px-2 py-0.5 text-xs lg:hidden">
          {index + 1} / {photos.length}
        </p>
      )}
    </div>
  );
}
