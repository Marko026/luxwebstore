"use client";

import { useEffect, useEffectEvent, useRef, type ReactNode } from "react";
import { CloseIcon } from "@/components/home/icons";

/**
 * Right-hand drawer (design reference §4): slides in from the right with the house easing over a blurred and dimmed
 * backdrop; full screen on phones, from sm a panel at least 440px wide. A modal dialog: while open the page can't scroll, focus moves
 * to the round close button, and Escape, the backdrop or that button call `onClose`; once closed, focus goes back to
 * whatever had it when the drawer opened. Stays mounted while closed (inert and hidden) so it can slide out.
 * `children` fill the panel and scroll themselves; the close button sits over them, top right.
 */
export function Drawer({
  open,
  onClose,
  id,
  label,
  closeLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  id?: string;
  /** Accessible name of the dialog. */
  label: string;
  /** Accessible name of the close button and the backdrop. */
  closeLabel: string;
  children: ReactNode;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const onEscape = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onEscape);
      document.body.style.overflow = "";
      opener?.focus();
    };
  }, [open]);

  // Visibility turns on at once when opening (a transition would keep it hidden for the first frame, and focus() on a
  // hidden button does nothing) and off only after the fade when closing.
  return (
    <div
      inert={!open}
      className={`fixed inset-0 z-40 duration-(--t-ui) ease-lux ${
        open ? "visible opacity-100 transition-opacity" : "invisible opacity-0 transition-[opacity,visibility]"
      }`}
    >
      <button
        type="button"
        aria-label={closeLabel}
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-scrim backdrop-blur-[15px]"
      />
      <div
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={`absolute inset-y-0 right-0 w-full overflow-hidden bg-paper text-ink transition-transform duration-(--t-ui) ease-lux sm:w-[clamp(27.5rem,36vw,38.75rem)] ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <button
          ref={closeButton}
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="absolute top-4 right-4 z-10 grid size-12 place-items-center rounded-full bg-ink text-paper transition-[scale] duration-(--t-press) active:scale-95"
        >
          <CloseIcon />
        </button>
        {children}
      </div>
    </div>
  );
}
