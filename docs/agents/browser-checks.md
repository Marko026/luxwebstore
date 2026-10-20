# Checking UI in the browser pane

Gotchas that cost time when verifying pages through the built-in browser (`preview_start` with the `dev` config from `.claude/launch.json`).

- **Width.** The pane is narrower than Tailwind's `lg` breakpoint (1024px), so it shows the phone/tablet layout: no desktop nav bar, the drawer menu instead. For desktop checks, `resize_window` to 1280×800 first; for phone checks use the `mobile` preset. Reset to `desktop` when done.
- **Branch switches.** After `git switch`, the running dev server keeps serving the old build ("This page couldn't load", 404s). Restart it (`preview_stop`, then `preview_start`) before checking anything.
- **Hydration.** Clicks fired right after navigation can land before React hydrates and do nothing. Wait for a client-only element (for example the header bag button) to respond, or take a fresh `read_page` before clicking.
- **Shared tab.** The user can click in the same tab. Read the current URL before acting on a page you navigated to earlier.
- **Screenshots** are the most expensive call. Pass `scale` (0.5 is usually enough) and prefer `read_page` / `get_page_text` for checking text and structure.
