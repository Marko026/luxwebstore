# Design reference: luxury e-commerce (studied: gucci.com)

Studied 2026-10-14 on gucci.com/us/en (home, women's handbags category, one product page, main menu)
in a real Chrome session, at 1440px and 390px. Computed styles were measured at a 792px viewport and
cross-checked against the site's `min-width: 1024px / 1440px` CSS rules (font sizes do not change at
those breakpoints).

Raw screenshots and measurements live in `reference/gucci/` (local only, git-ignored: third-party images).

This is a study of **principles and proportions**, not a copy. We do not take Gucci's text, photos,
typeface (Gucci Sans Pro), wordmark, monogram, stripe colours or any other brand asset.

---

## 1. Typography

**Measured**
- One proprietary sans family for everything, weights 100 / 400 / 500 / 700. The serif exists only as the logo.
- A deliberately small, flat scale: **12 / 14 / 16 / 20 / 24px**. Body 16px/24px, weight 500.
- Product name on the product page is an `h1` at **16px, weight 100**. Hierarchy comes from weight and
  context, not size.
- Slight negative tracking on everything: **-0.04em** at 16px and 24px, -0.03em at 12px.
- Uppercase is reserved for a few roles: section titles (14px/700), the primary button (12px/700),
  and the category filter's active item. Everything else is sentence case.
- The one huge type moment is the wordmark set full-bleed at the bottom of the footer.

**Principle:** quiet, small type lets the photography carry the page. Size contrast is replaced by
weight contrast (100 vs 700).

**For luxwebstore**
- One open-licence sans with a real thin weight. Candidates: Outfit, Jost, Figtree (decide when we
  set the brand). Load it with `next/font`.
- Scale tokens: `xs 12 / sm 14 / base 16 / lg 20 / xl 24` plus one display size for our own name.
- Tracking token `-0.04em` on body and headings.

## 2. Spacing and grid

**Measured**
- Spacing scale in 4px steps (0.25rem → 6rem).
- Page side padding **64px (4rem) on desktop**, 16px on phone.
- Content max-width **1376px** at ≥1440px.
- Large vertical rests between bands (roughly 100–120px on the home page).

**For luxwebstore:** use Tailwind's default 4px scale, with a `--gutter` token of `1rem` on phone and `4rem` from
`lg`, and `max-w-[1376px]` for text/content containers. Media bands ignore the container and run edge to edge.

## 3. Layout patterns

| Page | Structure |
| --- | --- |
| Home | Full-bleed hero (photo or muted video) with one short label and one button, centred near the bottom → 4 category packshots on white (label under each) → two half-width editorial images side by side, each with label + button → 3 service cards (image, title, underlined link) → black sign-up band → black footer ending in the full-width wordmark. |
| Category (PLP) | Editorial hero (~600px) with title + one sentence bottom-left → breadcrumb → horizontal scroll row of sub-categories (active one bold uppercase) → "N items sorted by X" left, "Filter and sort" right → **4-column edge-to-edge product grid** → occasional full editorial tile breaking the grid (2×2) → "Load more" → SEO text block → footer. |
| Product (PDP) | Full-width media stage (dark ground, video first, then images) with a floating mini bar (name, price, bag icon) and a thumbnail strip (`+4`) with round arrow buttons → below, two columns: left = badge, name, price, colour variations as image swatches, personalisation row, description, accordions (Details / Materials & Care / Commitment); right = sticky black **Add to bag**, delivery estimate, contact and appointment links. Then "You may also like" carousel, breadcrumb, footer. |

**Principle:** every page opens with one dominant image; commerce UI is pushed below the fold and
kept extremely plain.

## 4. Navigation

**Measured**
- Header: **transparent over the hero**, white text/icons; becomes white with black icons over content.
- Left: "+ Contact us". Centre: wordmark. Right: bag, account, search icons, then hamburger + "MENU".
- No visible category links in the bar. Everything lives in the menu.
- Menu = **right-side drawer, 440px wide** on desktop, full-screen on phone. Page behind is blurred and
  dimmed. Round black close button (48px circle).
- Three tiers inside the drawer: categories (20px, chevron) → services (16px) → account/utility links
  (12px, underlined).
- Thin rotating announcement bar above the header on some pages (with pause control).
- On phone the "Contact us" and "MENU" labels disappear; only icons remain.

**For luxwebstore:** a transparent-on-hero header with a centred name, icon actions on the right, and a
drawer menu. Keep a visible label next to the hamburger on desktop (better discoverability than icon only).

## 5. Product presentation and imagery

**Measured**
- **Packshots:** object only, no props, shot on a near-white ground (`#fbfbfb`) that equals the tile colour, so
  the product floats. Consistent scale and centring across the grid.
- **Grid tiles:** portrait (~3:4), tiles touch each other with a ~1px gap and no borders; the tone of the tile
  separates them. Each tile is a mini carousel with a thin progress indicator at the image's bottom edge.
- Under the image: name (12–16px, sentence case), price on its own line. A tiny grey badge sits top-left on the image
  ("Personalize…", "Online exclusive").
- **Editorial images** (campaign, interiors, warm saturated colour) interrupt the white grid on purpose.
- **Video** is used in the home hero and as the first item of the product gallery (muted, autoplay, with pause).
- Colour variants are shown as **image swatches** of the product itself, not colour dots.

**For luxwebstore**
- A photography spec for our own products: centred packshot, ground `#fbfbfb`, same crop and margin for
  every SKU, 3:4 ratio. Plus a separate set of lifestyle/editorial shots.
- Product card: image carousel on hover/swipe, name, price, optional badge. No border, no shadow, no "Add to
  cart" on the card.

## 6. Buttons and controls

**Measured**
- Primary: **solid black, white text, 48px tall, 2px radius (effectively square)**, 12px bold uppercase, often with a
  small leading icon. Full width in the product column.
- On images: **white solid button** with black text (hero "Shop now"), or a transparent button with a
  1px white 50% border.
- Secondary actions are **plain underlined text links**, never ghost buttons.
- Icon buttons are 48px round (close, gallery arrows).
- Phone product page: Add to bag is **sticky at the bottom** of the screen.

**For luxwebstore:** two button variants only (solid ink, solid paper-on-image), 48px, square corners.
Everything else is an underlined link.

## 7. Borders, dividers, radius

**Measured:** almost no lines. Where they exist they are **1px `rgba(0,0,0,.15)`**: under the sub-category bar,
between product accordions, around form fields and the personalisation row. Selected swatch = 1px solid
black. Radius is 0–3px everywhere, 50% only on round icon buttons.

## 8. Colour

| Role | Value |
| --- | --- |
| Ink (text, primary button, footer) | `#000000` |
| Paper | `#ffffff` |
| Product tile ground | `#fbfbfb` |
| Hairline | `rgba(0,0,0,.15)` |
| Muted text | `#767676` |
| Scrim / backdrop | `rgba(0,0,0,.4)` |

No accent colour in the UI at all. Colour comes **only from photography**. The footer and sign-up band
are a whole field of black.

**For luxwebstore:** the same monochrome token set (`ink`, `paper`, `tile`, `line`, `muted`, `scrim`), and
our brand colour (when we pick one) used sparingly, or not in the UI at all.

## 9. Responsive behaviour

- Breakpoints in use: **768 / 1024 / 1440px** (mobile-first `min-width`).
- Product grid: 4 columns at ≥1024px, **2 columns on phone**. Gaps stay hairline-thin.
- Home category row: 4 across → 2×2 on phone. Paired editorial images stack.
- Service cards turn into a horizontal swipe row on phone.
- Footer columns turn into accordions on phone.
- Sub-category bar is a horizontal scroll on every width.
- PDP: two columns → single column, sticky bottom Add to bag; gallery shows a `1 / 10` counter.

## 10. Motion

One easing everywhere: **`cubic-bezier(0.5, 0, 0, 1)`, 0.8s** (opacity, transform, colour, max-height),
and 1.2s for image scale. Slow and smooth, never bouncy. Token: `--ease-lux` / `--dur-lux`.

---

## Decisions still open

1. **Typeface:** pick the open-licence sans (Outfit / Jost / Figtree) and decide whether our name gets a
   separate display face.
2. **Conflicts with the `design-taste-frontend` house rules.** Gucci uses things that skill bans:
   uppercase labels, small tracked section titles, 1px hairlines, a blurred menu backdrop. Proposal:
   keep the skill's rules on marketing pages, and accept the e-commerce conventions (hairlines on
   accordions and form fields, a blurred drawer backdrop) where they help usability. They count as
   "real tables and form fields" in the skill's own exceptions.
3. **Our own photography.** The whole look depends on consistent packshots. Without them it falls apart.
