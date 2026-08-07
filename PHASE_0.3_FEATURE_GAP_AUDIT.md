# Phase 0.3: Definitive Feature Gap Audit

**Generated:** 2025-01-17  
**Status:** Cutover gate — every row must be verified closed or explicitly dropped-with-redirects  
**Methodology:** Route-by-route and component-by-component comparison of:

- Official app: `remix-store` origin/main (91 files in app/)
- Experimental app: v3 platform skeleton
- Migration plan: `REMIX_STORE_MIGRATION_PLAN.md`
- Parity plan: `REMIX_STORE_PARITY_PLAN.md`

---

## Executive Summary

**Total gaps identified:** 15  
**Port to v3:** 9  
**Verify during port:** 3  
**Drop with redirects:** 1 (pending human decision)  
**Audit/document:** 2

### Phase 2 Blocker: Locale/Markets Decision

**LOCALE/MARKETS DISPOSITION (Gap #5) — BLOCKS PHASE 2 ROUTING WORK:**  
The official store implements locale path prefix infrastructure (`($locale)` route wrapper, `getLocaleFromRequest()`, sitemap alternates for EN-US/EN-CA/FR-CA) but has **no user-facing locale selector** and no UI that consumes `pathPrefix`. The only external surface is SEO: sitemap advertises locale alternate URLs to search engines.

**Decision required before Phase 2 begins:** Check Shopify admin for:

1. Active Markets configuration (Canada market enabled/configured?)
2. CA order volume (meaningful CA orders in last 90 days?)
3. Merchandising intent (CA market actively maintained?)

**Outcome A (CA inactive):** Drop locale plumbing in Phase 2; implement permanent redirect `/^[a-z]{2}-[a-z]{2}(\/|$)/` → unprefixed path; remove sitemap alternates; fixed EN-US only.

**Outcome B (CA active):** Port locale infrastructure to v3 in Phase 2.15; preserve SEO alternates; test Markets integration.

**This decision blocks Phase 2 routing architecture.** Phase 0.3 leaves locale behavior unchanged; no code changes are made pending Markets check.

---

## Gap Inventory

### Routes

| #   | Gap                                    | Official Source                                      | Experimental Status               | Disposition                                    | Phase 2 Task | Evidence                                                                                                                                                                                                               |
| --- | -------------------------------------- | ---------------------------------------------------- | --------------------------------- | ---------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Subscribe route (`/subscribe`)         | `app/routes/pages/($locale).subscribe.tsx`           | Missing (no route, no controller) | **Build**                                      | 2.14         | Admin API customer create/update, tag merge, single-opt-in email consent; `app/lib/data/subscribe.server.ts` (288 lines)                                                                                               |
| 2   | Back-in-stock form (sold-out variants) | Product page component + subscribe server boundary   | Missing (no UI, no server action) | **Build**                                      | 2.14         | Conditional on `custom.subscribe_if_back_in_stock` metafield; shares Admin API boundary with subscribe route                                                                                                           |
| 3   | Cart permalink `/cart/:lines`          | `app/routes/pages/($locale).cart.$lines.tsx`         | Missing (no route)                | **Verify during port**                         | 2.11         | Creates cart from URL, applies discount code from query, redirects to checkout; experimental app has `handleShopifyRoutes()` in middleware but needs explicit route verification                                       |
| 4   | Catch-all `$` → storefront-redirect    | `app/routes/pages/($locale).$.tsx`                   | Present per parity plan           | **Verify during port**                         | 2.11         | Fallback to Shopify storefront redirect API on 404; experimental app should have this in middleware                                                                                                                    |
| 5   | Locale path prefix + `@inContext`      | `app/routes/pages/($locale).tsx` + `app/lib/i18n.ts` | Missing (fixed EN-US)             | **PHASE 2 BLOCKER: Markets decision required** | 2.15         | **BLOCKS** Phase 2 routing work — see Executive Summary; `getLocaleFromRequest()` parses `/xx-yy` prefix; sitemap emits EN-US/EN-CA/FR-CA alternates; no UI consumes `pathPrefix`; decision determines route structure |
| 6   | `/components` styleguide               | `app/routes/pages/components.tsx`                    | Missing (intentional)             | **Drop on main now**                           | —            | Internal dev-only route; **REMOVED IN THIS PR** per D6 (103 lines)                                                                                                                                                     |
| 7   | `/components/animated-link` styleguide | `app/routes/pages/components.animated-link.tsx`      | Missing (intentional)             | **Drop on main now**                           | —            | Internal dev-only route; **REMOVED IN THIS PR** per D6 (142 lines)                                                                                                                                                     |

### Features / Components

| #   | Gap                              | Official Source                             | Experimental Status               | Disposition               | Phase 2 Task | Evidence                                                                                                                                                                                                                         |
| --- | -------------------------------- | ------------------------------------------- | --------------------------------- | ------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8   | Store-wide sale marquee          | `app/components/store-wide-sale.tsx` (5.9K) | Missing (deferred in parity plan) | **Build**                 | 2.13         | Queries `custom.storewide_sale` shop metafield (title/desc/end_date); renders 48px fixed marquee above header; reduced-motion fallback                                                                                           |
| 9   | Automatic discount label in cart | Header/cart integration with sale data      | Missing (deferred)                | **Build**                 | 2.13         | Uses sale title from metaobject as cart discount label; wired via `useCartDiscounts` hook in `app/components/cart.tsx`                                                                                                           |
| 10  | Seasonal snow (December)         | `app/components/snow-field.tsx` (4.4K)      | Missing (deferred)                | **Build**                 | 2.16         | Canvas particle effect; date-gated December only; reduced-motion fallback; lazy-loaded on home route                                                                                                                             |
| 11  | Session-secret-backed session    | `app/lib/session.ts` (60 lines)             | Unclear/unknown                   | **Audit**                 | 2.17         | `AppSession` class implementing `HydrogenSession`; uses `SESSION_SECRET` env var; determine what it protects in new stack vs. can retire                                                                                         |
| 12  | Checkout domain handling         | Env var + checkout redirect logic           | **Missing in experimental**       | **Fold into env mapping** | 0.5 + 2.11   | `PUBLIC_CHECKOUT_DOMAIN` (checkout.remix.run) **absent in experimental**; official app redirects checkout to custom domain; document in env var mapping (0.5); verify experimental middleware handles this or add explicit logic |

### Shared/Verification Items

| #   | Gap                               | Official Source                                 | Experimental Status                  | Disposition                   | Phase 2 Task | Evidence                                                                                                                                                                           |
| --- | --------------------------------- | ----------------------------------------------- | ------------------------------------ | ----------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13  | Discount code routes              | `app/routes/pages/($locale).discount.$code.tsx` | Present (`app/actions/discounts.ts`) | **Verify during port**        | 2.11         | `/discount/:code` and `?discount=` query handling; experimental app has controller; verify parity with official behavior                                                           |
| 14  | Shopify standard redirects        | Server entry integrations                       | Present per middleware               | **Verify during port**        | 2.11         | Checkout redirect, AJAX cart, `/admin`, MyShopify domain rewrites; experimental app uses `handleShopifyRoutes()` in `app/middleware/storefront.ts`                                 |
| 15  | Redirect inventory (0.2 fixtures) | Full production redirect map                    | **Depends on Phase 0.2 completion**  | **Validate against fixtures** | 2.10 + 2.11  | **Blocked on Phase 0.2 behavior snapshots**; snapshot-driven diff; official redirect behavior must be captured in 0.2 fixtures before Phase 2 can validate experimental app parity |

---

## Component/Dependency Orphan Analysis

**Removal scope:** `/components` and `/components/animated-link` routes (this PR)

### Components Checked for Orphaning

**NOT orphaned (still used):**

- `app/components/ui/animated-link.tsx` — used in:
  - `app/components/navbar.tsx`
  - `app/root.tsx`
  - `app/routes/pages/($locale)._index.tsx` (home)
  - `app/routes/pages/($locale).cart.tsx`
  - **Only reference in removed route:** `app/routes/pages/components.animated-link.tsx`

- `app/components/ui/dropdown-menu.tsx` — used in:
  - `app/routes/pages/($locale).products.$handle.tsx` (product options)
  - **Only reference in removed route:** `app/routes/pages/components.tsx`

- `app/components/ui/popover.tsx` — used in:
  - `app/components/navbar.tsx` (cart popover trigger)

- `app/components/ui/details-menu.tsx` — used in:
  - `app/components/mobile-menu.tsx`

**Dependencies checked (all still used):**

- `@radix-ui/react-dropdown-menu` — product page options
- `@radix-ui/react-popover` — navbar cart trigger
- `class-variance-authority` — AnimatedLink variants
- `clsx` / `tailwind-merge` — utility classes throughout

**Conclusion:** No components or dependencies are orphaned by removing the styleguide routes. All UI components remain actively used in production surfaces.

---

## Route Inventory: Official vs. Experimental

### Official App Routes (17 files)

```
app/routes/pages/
├── ($locale).tsx                           [LOCALE WRAPPER - gap #5]
├── ($locale)._index.tsx                    ✓ Parity (home)
├── ($locale).cart.tsx                      ✓ Parity
├── ($locale).cart.$lines.tsx               [GAP #3 - verify]
├── ($locale).collections._index.tsx        ✓ Parity
├── ($locale).collections.$handle.tsx       ✓ Parity
├── ($locale).products.$handle.tsx          ✓ Parity
├── ($locale).policies.$handle.tsx          ✓ Parity
├── ($locale).subscribe.tsx                 [GAP #1 - build]
├── ($locale).discount.$code.tsx            [GAP #13 - verify]
├── ($locale).$.tsx                         [GAP #4 - verify]
├── ($locale).[sitemap.xml].tsx             ✓ Parity (index)
├── ($locale).sitemap.$type.$page[.xml].tsx ✓ Parity (sub-pages)
├── [robots.txt].tsx                        ✓ Parity
├── components.tsx                          [REMOVED THIS PR]
└── components.animated-link.tsx            [REMOVED THIS PR]

app/routes/resources/
└── load-more-products.tsx                  ✓ Parity (collection pagination)
```

### Experimental App Routes (from `app/routes.ts`)

```
/ (home)                                    ✓
/collections                                ✓
/collections/:handle                        ✓
/products/:handle                           ✓
/policies/:handle                           ✓
/sitemap.xml                                ✓
/sitemap/:type/:page.xml                    ✓
/robots.txt                                 ✓
/discount/:code                             ✓
/cart                                       ✓
```

**Missing from experimental:**

- Locale wrapper (decision pending)
- Subscribe route (build)
- Cart permalink (verify middleware)
- Catch-all `$` (verify middleware)

---

## Component Inventory: Official vs. Experimental

### Official App Components (20 files)

```
app/components/
├── cart.tsx                                ✓ Experimental has app/assets/cart.tsx
├── footer.tsx                              ✓ Experimental has app/assets/footer.tsx
├── matrix-text.tsx                         ✓ Experimental has app/assets/matrix-text.tsx
├── mobile-menu.tsx                         ✓ Experimental has mobile behavior in navbar
├── navbar.tsx                              ✓ Experimental has app/ui/navbar.tsx + app/assets/navbar.tsx
├── page-title.tsx                          ✓ Experimental has app/assets/page-title.tsx
├── product-grid.tsx                        ✓ Experimental has app/ui/product-grid.tsx + product-card.tsx
├── product-images.tsx                      ✓ Experimental has product-form.tsx (integrated)
├── remix-logo.tsx                          ✓ Experimental has logo in navbar assets
├── remix-runner.tsx                        ✓ Experimental has runner in home assets
├── snow-field.tsx                          [GAP #10 - build]
├── store-wide-sale.tsx                     [GAP #8 - build]
├── icon/ (index.tsx, types.generated.ts)   ✓ Experimental has icon system
├── carousel/ (arrow-buttons, dot-button)   ✓ Experimental uses CSS scroll snap
├── ui/animated-link.tsx                    ✓ Experimental has animated pill links
├── ui/blur-image.tsx                       ✓ Experimental has shopify-image with blur
├── ui/details-menu.tsx                     ✓ Experimental has native details in navbar
├── ui/dropdown-menu.tsx                    ✓ Experimental has native select/details
└── ui/popover.tsx                          ✓ Experimental uses native dialog
```

**Component philosophy difference:** Official uses Radix UI primitives; experimental uses native HTML elements. This is architectural, not a gap — experimental approach is per migration plan design.

---

## Data Layer Inventory

### Official `app/lib/data/` (7 server files)

```
collection.server.ts                        ✓ Experimental has app/actions/collections/controller.tsx
header.server.ts                            ✓ Experimental has app/ui/shell-data.tsx (menus)
hero.server.ts                              ✓ Experimental has app/actions/home/page.tsx (hero metaobject)
lookbook.server.ts                          ✓ Experimental has app/actions/home/page.tsx (lookbook metaobject)
policy.server.ts                            ✓ Experimental has app/actions/policies/controller.tsx
product.server.ts                           ✓ Experimental has app/actions/products/controller.tsx
subscribe.server.ts                         [GAP #1 - build; 288 lines Admin API boundary]
```

### Official `app/lib/` (supporting utilities)

```
context.ts                                  ✓ Experimental has app/data/storefront.server.ts
fragments.ts                                ✓ Experimental has inline fragments in controllers
i18n.ts                                     [GAP #5 - decision pending]
session.ts                                  [GAP #11 - audit]
image-utils.ts                              ✓ Experimental has app/ui/shopify-image.tsx
meta.ts                                     ✓ Experimental has meta generation in controllers
redirect.ts                                 ✓ Experimental has same-origin redirect safety
```

---

## File Count Summary

| Area                 | Official (origin/main)           | Experimental (v3 skeleton)                  |
| -------------------- | -------------------------------- | ------------------------------------------- |
| **Total app/ files** | 91                               | Skeletal (minimal porting baseline)         |
| **Routes**           | 17 (15 after styleguide removal) | 10 route definitions                        |
| **Components**       | 20                               | ~20 (different structure: assets/ + ui/)    |
| **Data/controllers** | 7 server files in lib/data/      | 8 controller files in actions/ + data/      |
| **Middleware**       | Integrated in server.ts          | Explicit in app/middleware/                 |
| **Tests**            | Vitest + Testing Library         | remix test (unit + browser), Playwright e2e |

---

## Changes Made in This PR

### Removed Files

- `app/routes/pages/components.tsx` (103 lines)
- `app/routes/pages/components.animated-link.tsx` (142 lines)

**Justification (per D6):** Internal dev-only styleguide routes; 404 in production; no longer maintained; removal does not affect production functionality.

### Orphan Check Results

- **0 components removed** (all UI components still actively used)
- **0 dependencies removed** (Radix, CVA, etc. still required by production routes)

---

## Cutover Gate Checklist

**Phase 2 must close every gap before merge to main.** This audit is the canonical tracking document.

### Build (9 items)

- [ ] **2.14** Subscribe route + Admin API boundary (gaps #1, #2)
- [ ] **2.13** Store-wide sale marquee + cart discount label (gaps #8, #9)
- [ ] **2.16** Seasonal snow (gap #10)

### Verify During Port (3 items)

- [ ] **2.11** Cart permalink `/cart/:lines` (gap #3)
- [ ] **2.11** Catch-all `$` → storefront-redirect (gap #4)
- [ ] **2.11** Discount code routes (gap #13)
- [ ] **2.11** Shopify standard redirects (gap #14)

### Phase 2 Blocker — Human Decision Required (1 item)

- [ ] **BLOCKER:** Locale/Markets disposition (gap #5) — **MUST BE RESOLVED BEFORE PHASE 2 ROUTING WORK** — requires Shopify admin access to check CA market status

### Audit/Document (2 items)

- [ ] **2.17** Session/secret audit (gap #11)
- [ ] **0.5** Checkout domain handling (gap #12) — fold into env var mapping

### Validation (depends on Phase 0.2 completion)

- [ ] **2.10 + 2.11** Redirect inventory diff driven to zero (gap #15) — **BLOCKED** until Phase 0.2 behavior snapshots are complete

---

## Acceptance Criteria for This PR (Phase 0.3)

- [x] Route-by-route and component-by-component audit complete
- [x] Every gap marked port/verify/drop with Phase 2 task mapping
- [x] Locale decision clearly marked as human/admin decision (no code changes)
- [x] `/components` routes removed
- [x] Orphan analysis performed; no components/deps removed (all still used)
- [ ] Routes validate (no broken imports)
- [ ] Typecheck passes
- [ ] Lint passes
- [ ] Tests pass
- [ ] Build succeeds
- [ ] Committed to branch `phase0/feature-gap-audit`
- [ ] PR opened to main (not merged)
- [ ] PR body highlights locale decision requirement

---

## Phase 2 Task Dependencies

This audit establishes the ground truth for:

- **2.11** Redirects/permalinks (gaps #3, #4, #12, #13, #14, #15) — **Gap #15 BLOCKED on Phase 0.2 completion**; gap #12 (PUBLIC_CHECKOUT_DOMAIN) absent in experimental
- **2.13** Store-wide sale (gaps #8, #9)
- **2.14** Subscribe + back-in-stock (gaps #1, #2)
- **2.15** Locale disposition (gap #5) — **BLOCKS ALL PHASE 2 ROUTING WORK** — must be resolved before route architecture decisions
- **2.16** Seasonal snow (gap #10)
- **2.17** Session audit (gap #11)

**Critical path:**

- **Gap #5 (locale) is a hard blocker** — must be resolved before Phase 2 begins to avoid rework of entire routing layer
- **Gap #15 (redirects) depends on Phase 0.2** — behavior snapshot fixtures must be complete before redirect validation can proceed
- **Gap #12 (checkout domain) requires env mapping** — PUBLIC_CHECKOUT_DOMAIN missing in experimental; needs Phase 0.5 documentation + Phase 2.11 implementation

---

## Notes for Phase 2 Implementers

1. **Subscribe/Admin API (2.14):** The official implementation is complete and production-tested (`app/lib/data/subscribe.server.ts`, 288 lines). Port with security hardening checklist: validation, rate limiting, no PII logging, explicit consent handling.

2. **Store-wide sale (2.13):** Requires two Shopify Admin pieces: (a) `custom.storewide_sale` metaobject with title/desc/end_date, (b) automatic discount. Current official implementation caches header data for 1 hour.

3. **Cart permalink (2.11):** Official route is 67 lines; creates cart from URL, applies discount from query, redirects to checkout. Experimental middleware has `handleShopifyRoutes()`; verify this covers the permalink case or port the explicit route.

4. **Locale (2.15):** If dropped, implement permanent redirect `/^[a-z]{2}-[a-z]{2}(\/|$)/` → unprefixed path (same-origin safety); remove sitemap alternates; test SEO fixture diff. If kept, port `app/lib/i18n.ts` + `($locale)` wrapper + sitemap logic to v3.

5. **Session audit (2.17):** Determine what `SESSION_SECRET` protects. Official app uses `AppSession` class wrapping React Router cookie session storage. Experimental app may not need session if cart is cookie-only and no other personalization exists.

6. **Orphan vigilance:** If Phase 2 removes Radix/Embla during component porting (per parity plan's native-elements preference), re-run dependency orphan check before removing packages.

---

**Audit complete.** Ready for validation and PR.
