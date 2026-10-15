"use client";

import { useEffect } from "react";

/**
 * Reveals every `[data-reveal]` element once it enters the viewport by adding `.is-in`.
 * `<html class="js">` is set in the root layout before first paint; without JavaScript
 * (or with reduced motion) nothing is hidden, see globals.css.
 */
export function Reveal() {
  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return null;
}
