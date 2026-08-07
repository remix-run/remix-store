# Remix Store Design and Feature Parity Plan

Reference implementation: [`~/code/remix-store`](../remix-store) and [shop.remix.run](https://shop.remix.run). The local source is the authority when rendered behavior and production HTML differ.

The conversion targets the reference storefront’s visual language, content model, responsive behavior, and shopper-visible states while preserving this app’s Remix 3 architecture and newer framework-neutral Hydrogen primitives. Port behavior; do not transplant the React Router component architecture.

## Conversion rules

| Preserve from this app | Recreate from `remix-store` |
|---|---|
| Typed `app/routes.ts` contract and route-owned controllers | Brand tokens, fonts, icons, logos, imagery, and motion |
| Server-rendered links/forms and no-JavaScript fallbacks | Fixed navigation, editorial home, product grids, product gallery, cart presentation, footer |
| `createProductFormStore()` variant state | Shopify metaobject, menu, metafield, policy, and sale data contracts |
| Shared `createCartStore()` with optimistic updates and scoped errors | Reference loading, empty, sold-out, sale, subscription, and error states |
| Native `<dialog>` cart drawer | Blue mini-cart visual treatment and responsive cart CTAs |
| Consent-aware analytics and confirmed cart tracking | Reference page metadata, social assets, favicons, and font preloads |
| Request-scoped Storefront client and explicit query cache strategies | Responsive images, focal points, hover image swap, and blur-up loading |
| Remix `clientEntry`, `css()`, `mix`, and `navigate()` | Scroll-linked effects with reduced-motion fallbacks |

Do not add Tailwind, React Router UI hooks, React Hydrogen components, Radix, or Embla merely because the reference uses them. Use Remix server components and browser entries, native controls, and the installed framework-neutral Hydrogen package.

## Parity scope

| Area | Reference behavior | Current state | Conversion target | Tier |
|---|---|---|---|---:|
| Visual system | Black canvas, Remix brand spectrum, four local fonts, custom breakpoints | Neutral system styling | Exact token and font system | 1 |
| Header | Fixed gradient header, animated Remix logo, merchant menu, responsive mobile menu | Parity shell without search controls | Preserve the reference navigation and cart treatment | 1 |
| Home | Scroll-scrubbed campaign hero, lookbook, runner interstitial, catalog grid | Shop title, collection cards, featured products | Recreate editorial composition from Shopify metaobjects | 1 |
| Product grid | Responsive 1–5 column grid, two-image hover swap, sale prices, load more | Shared parity grid complete | Reuse across home and collections | 1 |
| Collection | Layered scrolling title and incremental catalog loading | Plain title and fixed result set | Page-title treatment plus progressive load more | 1 |
| Product | Desktop image column, mobile carousel, sticky details, category menu, rich descriptions | Parity layout, variant behavior, and Shop Pay express checkout complete | Preserve variant correctness and progressive add-to-cart behavior | 1 |
| Cart | Quantity-aware header CTA, blue mini-cart, free-shipping meter, sale pricing, designed empty state | Shared optimistic cart with parity drawer, full page, summary, and empty state | Preserve existing shared cart UI and native dialog | 1 |
| Footer | Animated spectrum strips, Remix marks, social links, merchant policy menu | One-line footer | Recreate full footer and motion fallback | 1 |
| Errors | Animated hexadecimal 404/500 artwork and branded return CTA | Shared branded 404/500/empty-state system complete | Preserve static SSR and reduced-motion fallbacks | 2 |
| Store-wide sale | Timed Shopify metaobject drives marquee and discount labels | Intentionally excluded from current scope | Revisit only when merchandising requests it | 2 |
| Subscribe | General newsletter and product back-in-stock forms | Intentionally excluded from current scope | Revisit only with Admin API security and consent safeguards | 2 |
| Policies/contact | Shopify policy/page HTML in branded layout | Local Shopify-backed routes with controlled HTML rendering | Maintain routes used by the footer menu | 2 |
| SEO/public files | Social cards, favicons, robots, sitemap, preconnects, font preloads | Metadata, assets, robots, and sitemap resources complete | Validate against the production origin at cutover | 2 |
| Discount/permalink routes | Discount links and cart permalinks | Discount paths/query parameters and Hydrogen cart permalinks complete | Maintain safe same-origin redirects and private caching | 3 |
| Locales | Optional `language-country` path prefix; sitemap lists US/CA locales | Fixed US/English | Defer unless localized parity is explicitly required | 3 |
| Seasonal snow | December-only canvas snow with reduced-motion mode | None | Optional final polish | 3 |

Tier 1 establishes the recognizable storefront. Tier 2 completes the reference’s supporting experience. Tier 3 is conditional parity, not a styling prerequisite.

## Visual system

### Tokens

| Token group | Reference values |
|---|---|
| Canvas | `#000`; white foreground; `color-scheme: dark` |
| Brand | blue `#20aaff`, green `#80e464`, yellow `#ffdf5f`, pink `#ff65db`, red `#ff5148` |
| Supporting blue | `#54bbff`, `#367cff` |
| Gray scale | `#f7f7f7`, `#e3e3e3`, `#c8c8c8`, `#a4a4a4`, `#818181`, `#666`, `#515151`, `#434343`, `#212121`, `#111` |
| Body font | Inter variable roman and italic |
| Monospace | JetBrains Mono |
| Display | Lexend Zetta Black |
| Breakpoints | 430, 810, 1400, 1640, 2000, 2700 px |
| Header height | 80 px below 810; 136 px at 810+ |
| Primary control | White pill, black text, 54 px radius, 48/64 px height |
| Motion curve | `cubic-bezier(0.13, 0.74, 0.41, 0.92)` |

Copy the reference font, favicon, runner, logo, social-image, matrix-image, and sprite source assets into `public/` or the narrowest app-owned asset location. Record third-party font provenance; do not depend on the reference build output.

### Shared interaction patterns

- Pill CTAs reveal an icon, additional word, or full-width spread on hover/focus.
- Links keep visible keyboard focus and do not rely on color alone.
- Product imagery swaps to image two and performs a small bounce on card hover.
- Sale prices pair a struck-through compare-at amount with a red sale amount.
- Scroll-linked effects update through one animation-frame callback per frame.
- `prefers-reduced-motion: reduce` disables scroll scrubbing, marquees, runners, snow, glitches, image fades, and decorative transforms while retaining all content.
- Server HTML contains every essential heading, link, price, option, form, and cart action.

## Global shell

### Header

Source: `app/components/navbar.tsx`, `mobile-menu.tsx`, `remix-logo.tsx`, and `store-wide-sale.tsx`.

- Fixed above content with a transparent black top-to-bottom gradient.
- Three-column desktop layout: logo, centered menu, cart CTA.
- Mobile layout: logo, native `<details>` menu, cart/shop CTA.
- Remix logo shows the white mark at the top of the page and expands to the colored wordmark after approximately 20 px of scrolling.
- Menu comes from Shopify `main-menu`; MyShopify/store-domain links become internal app URLs.
- Mobile menu closes on outside click/focus, Escape, and completed navigation.
- Empty cart CTA says “Shop” / “Shop All” and links to `/collections/all`.
- Non-empty CTA shows quantity and reveals “Item” or “Items”.
- Search controls and the search-results route are intentionally omitted to match the reference storefront.
- When a store-wide sale is active, render the 48 px marquee above the header and offset the header accordingly.

### Footer

Source: `app/components/footer.tsx`.

- Black, isolated footer with 33 vertical spectrum strips and black shading overlays.
- Animate strip scale from the center outward only while at least 35% of the footer is visible.
- Content uses compact uppercase JetBrains Mono.
- Include catalog/version link, “Designed in USA”, Remix logo/glyph/runner lockup, three brand statements, `remix.run`, GitHub, X, YouTube, Discord, merchant footer links, license copy, and current year.
- External links open safely with `target="_blank"` and `rel="noopener noreferrer"`; internal links stay app-local.
- Footer menu comes from Shopify `footer`. It is non-critical data; a Remix Frame is acceptable only if it avoids blocking the page and preserves a stable server-rendered footer shell.

## Home page

Source: `app/routes/pages/($locale)._index.tsx`, `hero.server.ts`, and `lookbook.server.ts`.

### Campaign hero

- Two-viewport-height black section with a sticky, viewport-height stage.
- Shopify `hero` metaobject supplies up to 100 media-image frames and a collection reference.
- Current production identifiers:
  - type: `hero`
  - handle: `remix-3-drop-playground`
  - image field: `asset_images`
  - collection field: `collection`
- Request frames at approximately 1600×900 with center crop.
- Render frame zero immediately. After hydration, preload remaining frames and map scroll progress to the visible frame at the reference speed multiplier of 1.5.
- If frame loading fails or reduced motion is enabled, remain on frame zero.
- Bottom-left overlay contains “Remix 3 Racing Team Collection” and “Shop New Items”; the CTA’s hit area covers the hero without obscuring semantic link text.
- Keep masthead copy configurable even though the current reference hardcodes it.

### Lookbook

- Full-bleed entries are 640 px tall on small screens and 800 px at 810+.
- Shopify `lookbook` metaobject supplies ordered entry references.
- Current production identifiers:
  - type: `lookbook`
  - handle: `lookbook-remix-racing`
  - entries field: `lookbook`
- Each entry requires a `MediaImage`; an optional `Product` supplies handle, title, and minimum price.
- Respect Shopify image focal-point metadata through `object-position`.
- Product-linked entries make the entire visual region clickable and show title, middle dot, and whole-dollar price in a bottom-left pill.
- Entries without a product show a non-interactive “Coming Soon” mail pill; no subscribe route is promised in the current scope.
- Insert the animated Remix runner brand panel after the first lookbook entry: 390 px small, 480 px medium, 800 px large; cycle blue, green, red, pink, and yellow over 14 seconds.

### Catalog transition

- Finish with a `#2d2d38` to black vertical gradient and the shared product grid.
- Initially request 15 products from collection handle `all`.
- Load subsequent products through the shared cursor endpoint and button.

## Product grid and collection pages

Source: `product-grid.tsx`, `collection.server.ts`, `load-more-products.tsx`, and `page-title.tsx`.

### Product card data

Each card needs:

- product ID, handle, and title;
- first two images with ID, URL, alt text, width, and height;
- selected/first available variant price and compare-at price;
- price-range fallback when no selected variant exists.

### Product card presentation

- Grid columns: 1 by default, 2 at 810, 3 at 1400/1640, 4 at 2000, 5 at 2700.
- Product image occupies about 70% of card width and stays within 90% of its image region.
- Use Shopify CDN `srcset`/`sizes`, intrinsic dimensions, lazy loading, and a stable aspect ratio.
- Swap image one for image two on hover; omit the swap when only one image exists.
- Make the card region clickable through one semantic product link.
- Center title and price with a minimum 64 px text region.
- Display compare-at and sale price correctly; preserve currency formatting rather than copying the home lookbook’s whole-dollar shortcut outside that decorative CTA.
- Loading skeleton uses the same geometry and a subtle radial pulse.

### Collection page

- `/collections` redirects to `/collections/all` for reference parity; retaining a designed collection index is an intentional extension, not required parity.
- The collection heading uses the stacked Lexend Zetta treatment: white foreground plus pink, red, yellow, green, and blue copies moving apart with scroll.
- The decorative copies are `aria-hidden`; only one `<h1>` is exposed.
- Initial collection request returns 15 products and cursor `pageInfo`.
- “Load more” requests 8 products, deduplicates by product ID, updates the cursor, disables while pending, and disappears at the end.
- Keep a real GET form/resource URL as a no-JavaScript fallback. A non-JavaScript submission may navigate to a cursor URL instead of appending in place.
- Do not build filter or sort UI for parity: the reference accepts filter query variables but exposes no visible controls.

## Product page

Source: `($locale).products.$handle.tsx`, `product.server.ts`, and `product-images.tsx`.

### Data additions

- Product category name.
- Up to five product images with intrinsic dimensions.
- SEO title and description.
- `custom.description` rich-text metafield.
- `custom.technical_description` rich-text metafield.
- `custom.subscribe_if_back_in_stock` boolean metafield.
- Shopify `product-sidebar-menu` menu.
- Variant image, SKU, price, compare-at price, selected options, product handle/title, and availability.

### Responsive composition

- Offset content below the fixed header.
- Large screens: sticky category-menu column, image column, sticky details column.
- Medium screens: image column plus sticky details; omit sidebar menu.
- Small screens: full-width image carousel followed by details.
- Desktop image cards are square with 24 px rounding and 18 px gaps. The image nearest the header is fully opaque; distant images fade no lower than 20% opacity. Disable fading for reduced motion.
- Mobile gallery uses native CSS scroll snap or a small client entry with previous/next controls and dot indicators. Do not add Embla solely for parity.
- Images use a 32 px Shopify CDN blur preview, then transition to the full responsive image. Image errors must remove the blur rather than leave an unreadable placeholder.

### Product details and variants

- Show category, title, compare-at/sale price, option controls, add-to-cart, description, and technical description.
- Style options as 3 px white bordered pills/dropdowns with large touch targets and checkmarks.
- Preserve the current product store’s support for all Shopify options, combined listings, impossible combinations, sold-out selections, URL preservation, immediate price/media updates, and progressive links. Do not copy the reference’s Size-only filtering.
- Preserve confirmed add-to-cart behavior and scoped errors. The success state may use the reference green check animation, but must not impose an artificial two-second pending period or open the cart before confirmation.
- Selling-plan-required, unresolved, sold-out, pending, warning, and failure states need parity-quality layouts.
- Render Shopify rich-text metafields with a controlled renderer. Merchant HTML/JSON must not be passed blindly to `innerHTML`.

### Back-in-stock form (deferred)

This feature is outside the current scope. If it returns, when the selected variant is sold out and `subscribe_if_back_in_stock` is true:

- Show email, product handle, and variant title fields.
- Hydrated submission stays in place and returns success/error copy; no-JavaScript submission redirects to `/collections/all` after success.
- Success treatment uses the green check state.
- Implement only after the Admin API boundary includes validation, abuse protection/rate limiting, safe error logging, and explicit email-marketing consent behavior.

## Cart surfaces

Source: `navbar.tsx`, `cart.tsx`, and `($locale).cart.tsx`.

Restyle the existing shared cart store rather than porting `CartForm`, `useOptimisticCart`, or the Radix popover.

### Header mini-cart

- Keep the native `<dialog>` and Standard Action integration.
- Present the open desktop drawer as the reference blue (`#20aaff`) rounded mini-cart near the header: rounded top corners, 42 px lower radius, white text, close control, max 60 vh scrolling line list, and fixed summary/checkout area.
- Mobile may retain the accessible drawer instead of switching to the reference’s full-page-only behavior.
- Opening publishes `cart_viewed`; closing supports button, Escape, and light dismiss.
- Line image links close the drawer before navigation.

### Shared cart line

- 80 px white rounded product thumbnail.
- Product title, non-default variant title/options, quantity controls, total price, and compare-at price.
- Circular minus/remove and plus controls with accessible labels.
- Pending lines/totals remain visible with muted treatment; errors stay adjacent to the affected line.

### Summary

- Display subtotal, automatic discount label/amount, discounted total, free-shipping progress, and checkout CTA.
- Reference free-shipping threshold is USD 75. Make the threshold and eligibility market-aware/configurable before supporting other currencies.
- Progress bar clamps to 0–100%, announces its state, and changes to green when achieved.
- Full cart uses an 800 px maximum content width and a sticky bottom summary.
- Preserve the current discount-code form and scoped Shopify errors even though the reference emphasizes automatic discounts.
- Checkout remains disabled while the cart is optimistic or has no authoritative checkout URL.

### Empty cart

- Replace generic copy with the branded matrix-art state, “No items in cart”, explanatory copy, and “Shop All” spread CTA.
- Keep a meaningful static heading and link before hydration; the decorative glitch layer is optional enhancement.

## Sale, subscription, policies, and errors

### Store-wide sale (deferred)

This feature is intentionally excluded from the current scope. Source for any future implementation: `header.server.ts` and `store-wide-sale.tsx`.

- Query shop metafield `custom.storewide_sale`, whose metaobject fields are `title`, `description`, and `end_date_and_time`.
- Hide expired sales server-side.
- Render a fixed 48 px red-tinted marquee with repeated uppercase mono text; expose one concise accessible label and hide repeated copies.
- Stop marquee motion for reduced-motion users.
- Use the sale title as the automatic-discount label in cart summaries.

### Subscribe route (deferred)

This route is intentionally excluded from the current scope. Source for any future implementation: `($locale).subscribe.tsx` and `subscribe.server.ts`.

- Branded layered “Subscribe” title, explanatory copy, email input, pill submit button, pending state, green success state, and inline error.
- Validate email and optional tag inputs server-side.
- Reference behavior creates/updates Shopify customers, merges tags, and sets single-opt-in email marketing consent through the Admin API.
- Back-in-stock tags follow:
  - `back-in-stock-subscriber`
  - `<product-handle>-<sanitized-variant-title>-back-in-stock-subscriber`
- Keep `ADMIN_ACCESS_TOKEN` server-only. Add request throttling and avoid logging customer email addresses or Admin responses containing customer data.

### Policies and contact

Source: `($locale).policies.$handle.tsx` and `policy.server.ts`.

- Support refund, privacy, shipping, and terms policy handles plus contact information from Shopify page handle `contact`.
- Use the layered page title and a centered 700 px rich-content column.
- Style headings, paragraphs, links, blockquotes, lists, and bottom spacing to match the reference.
- Treat Shopify policy/page HTML as merchant-authored content under an explicit trust policy; sanitize if store-admin trust is insufficient.

### Error and empty-state art

Source: `matrix-text.tsx` and the root error boundary.

- Add source images for 404, 500, and empty cart.
- Convert image pixels to monospace hexadecimal characters in a client entry, with a blurred color layer and approximately 8% character glitching every 80 ms.
- Reduced motion shows the static generated text.
- Server HTML must still provide the status heading, useful message, and back-home/shop link.
- Use the same composition for route 404, app 500, and empty cart, with route-appropriate copy.

## Responsive images and assets

Build one browser-safe Shopify image helper/component for native `<img>` output:

- Preserve source URL parameters and add width transforms safely.
- Emit intrinsic `width`/`height`, aspect ratio, `srcset`, and route-specific `sizes`.
- Support crop and focal-point positioning.
- Hero: frame zero eager/high priority; remaining frames hydrate/preload after first paint.
- Lookbook: lazy except the first visible entry.
- Product grid: lazy; widths aligned to 1–5 column breakpoints.
- Product page: first image eager; remaining images lazy.
- Cart: small fixed-size source.
- Decorative imagery uses empty alt text; product imagery uses merchant alt text with product-title fallback.

Static asset inventory from the reference:

- Inter roman/italic variable, JetBrains Mono, Lexend Zetta Black.
- Remix favicon SVG/PNG and Apple touch icon.
- Remix logo, glyphs, runner static/animated SVGs.
- UI icons: bag, cart, check, chevrons, circles, Discord, fast-forward, GitHub, info, mail, menu, X, YouTube.
- Social images for home and collections.
- Matrix source images for 404, 500, and empty state.
- Optional December snow canvas; do not copy `splash.avif` unless a rendered parity surface uses it.

## Metadata and support routes

Source: `meta.ts`, robots/sitemap routes, discount route, and cart-permalink route.

- Generate title, description, Open Graph, and Twitter card metadata for home, collection, product, cart, and policy pages.
- Use each request’s canonical route URL, not only the site origin.
- Product social image uses the primary product image transformed to approximately 1200×630 with black padding.
- Add Shopify CDN and Shop preconnects plus local font preloads.
- Add favicon and touch-icon links.
- Add `/robots.txt` with Shopify-appropriate exclusions and a sitemap pointer.
- Add sitemap index/resource routes using APIs available in the installed Hydrogen preview or direct Storefront queries; do not copy unavailable legacy helpers.
- Use `handleShopifyRoutes()` for checkout, AJAX cart, and cart-permalink behavior; keep app-owned `/discount/:code` and `?discount=` redirects because the Hydrogen interceptor does not provide them.
- Keep cart and personalized responses private/no-store. Do not change HTML caching as part of visual parity.

## Reference-to-Remix 3 translation

| Reference primitive | Conversion |
|---|---|
| Tailwind utility classes | Remix `css()`/`mix` tokens and narrowly owned style modules |
| React Router `Link`, `Form`, `useFetcher` | Server anchors/forms plus `navigate()` or route-owned client entries |
| Hydrogen React `Image` | Native responsive Shopify image helper |
| Hydrogen React `Money` | Existing `formatMoney()` paths |
| `Analytics.Provider` and view components | Existing `AnalyticsShell` and event bus |
| React `CartForm` / `useOptimisticCart` | Existing shared `createCartStore()` and form register |
| `useOptimisticVariant()` / `getProductOptions()` | Existing `createProductFormStore()` implementation |
| Radix popover | Existing native `<dialog>` drawer |
| Radix dropdown menu | Server option links/buttons; native details/select or small accessible client control if needed |
| Embla carousel | CSS scroll snap with optional client controls |
| React hooks for scroll/motion | Route-owned `clientEntry` with listeners tied to `handle.signal` |
| `Suspense`/`Await` footer | Stable shell; optional Remix Frame only for genuinely non-critical menu data |
| Oxygen `createContentSecurityPolicy()` | App-owned CSP/nonces only when launch hardening is scheduled |

## Implementation sequence

### Phase 1 — assets, tokens, and primitives

- [x] Copy and inventory licensed static assets.
- [x] Add font faces, brand colors, breakpoints, dark canvas, global focus rules, and reduced-motion rules.
- [x] Build icon, Remix logo, runner, animated pill link, page title, product price, and responsive image primitives.
- [x] Add browser coverage for shared interactive and loading states.

### Phase 2 — shell

- [x] Query and cache `main-menu` and `footer` menus.
- [x] Build fixed desktop/mobile header and animated logo.
- [x] Restyle existing cart trigger without changing cart ownership.
- [x] Build full footer with static reduced-motion fallback.
- [x] Add preconnects, font preloads, favicons, and social assets.

### Phase 3 — home and catalog

- [x] Query hero and lookbook metaobjects with validated fallbacks.
- [x] Build sticky frame hero, lookbook entries, and runner interstitial.
- [x] Extend card query to two images and compare-at pricing.
- [x] Build shared responsive product grid and loading skeleton.
- [x] Add cursor “Load more” with GET fallback.
- [x] Build layered collection title and reuse the shared catalog grid.

### Phase 4 — product

- [x] Add category, image dimensions, rich metafields, subscription flag, and product sidebar menu to the product query.
- [x] Build desktop image column and mobile scroll-snap carousel.
- [x] Apply parity controls and success/error styles to the existing product form store.
- [x] Render custom and technical rich text.
- [ ] Add back-in-stock UI only if it returns to scope; Admin mutation still requires the documented safeguards.

### Phase 5 — cart

- [x] Apply mini-cart and full-cart layouts to the shared cart components.
- [x] Add responsive thumbnails, compare-at pricing, server-provided automatic-discount summary, and free-shipping meter.
- [x] Add branded empty state.
- [x] Verify optimistic, rollback, rapid-update, scoped-error, Escape, and no-JavaScript tests still pass.

### Phase 6 — supporting parity

- [ ] Active-sale query and marquee intentionally skipped for the current scope.
- [x] Add Shopify-backed policy/contact routes; subscribe intentionally skipped.
- [x] Add branded 404/500 matrix enhancement.
- [x] Add route metadata, robots, and sitemap behavior.
- [ ] Optional December snow intentionally deferred.

## Verification matrix

| Surface | Required widths/states |
|---|---|
| Header/footer | 390, 430, 810, 1400, 2000; top/scrolled; menu open; reduced motion |
| Home | Hero first/loading/loaded/failure; lookbook linked/unlinked; load-more pending/end |
| Product grid | 1–5 columns; one/two/no image; regular/sale price; slow image |
| Collection | Initial, empty, pending, appended, API failure, back/forward |
| Product | Mobile/desktop; multi-image; available/sold-out/impossible; combined listing; pending/success/error; rich text |
| Cart drawer/page | Empty/non-empty; automatic discount; threshold below/above; optimistic; rollback; scoped error; keyboard dismiss |
| Subscribe | Deferred; add this matrix only if subscription work returns to scope |
| Policies/errors | Long policy content; 404/500; reduced motion |

For each Tier 1 page, capture screenshots at 390×844, 820×1180, and 1440×1000 and compare composition, spacing, type scale, colors, imagery, and interaction states against the local reference. Behavioral tests continue to assert server rendering and progressive enhancement; screenshots protect parity, not implementation details.

## Intentional non-parity

The reference does not require these for the visual conversion:

- customer account UI;
- storefront search and predictive search;
- visible collection filters or sorting;
- Shop Pay buttons;
- blogs or article routes;
- order notes;
- distributed cache infrastructure;
- copying the source’s React Router, Oxygen, Tailwind, Radix, or Embla architecture.

Keep the stronger cart/product error handling as an extension. Markets/localized path prefixes remain a separate product decision; do not let them block the design conversion.
