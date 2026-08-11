# Remix Store Migration Plan: Hydrogen 3 + Remix 3

Goal: make [`~/code/remix-store`](../remix-store) (github.com/remix-run/remix-store, deployed at shop.remix.run) the official Hydrogen 3 + Remix 3 storefront, using [`~/code/remix-3-hydrogen`](.) as the source implementation.

Companion document: [`REMIX_STORE_PARITY_PLAN.md`](./REMIX_STORE_PARITY_PLAN.md) — the design/feature parity spec. That document defines *what the storefront looks like and does*; this document defines *how the platform swap lands in the official repo and ships*.

**Progress:** Phase 0 was intentionally narrowed and completed on `main` in #247. The Remix 3 skeleton and native Node/Remix Assets runtime landed on `v3` in #246 and #248. Phase 2.1–2.6 are now complete on `v3`: shared primitives, Storefront data, shell, home, collections/catalog with load more, and the product page with URL-backed variants, gallery, and safe rich text. Browser-reachable source now follows the colocated `app/**/public/**` convention, which keeps the Node asset boundary narrow while the platform work continues toward continuous Fly deployment alongside Oxygen previews.

## Current state

| | `remix-store` (official) | `remix-3-hydrogen` (experimental) |
|---|---|---|
| Framework | React Router 7 + `@shopify/hydrogen` 2026.4.4 (React components) | Remix 3 (`^3.0.0-beta.5`) + framework-neutral Hydrogen preview (`0.0.0-preview-116d5d7-20260730141607`) |
| Styling | Tailwind 4, Radix, Embla, CVA | Remix `css()`/`mix`, native controls, no UI deps |
| Build | Shopify CLI (`shopify hydrogen build`) + `@react-router/dev` | Vite 8 + app-owned adapter `vite/remix-oxygen.ts` (wraps `@hiogawa/vite-plugin-fullstack`) + MiniOxygen |
| Server entry | `server.ts` worker via `@shopify/hydrogen/oxygen` | `app/entry.oxygen.ts` fetch handler; `app/runtime.ts` abstracts env/waitUntil/cache with `process.env` fallback |
| Deploy | GitHub Actions → Oxygen on every push (storefront `1000020043`); `staging` branch exists | `shopify hydrogen deploy --preview` (manual) |
| CI | format, lint, test, oxygen-deployment workflows | None |
| Tests | Vitest + Testing Library | `remix test` (unit + browser), Playwright e2e |
| Features beyond parity plan scope | `($locale)` prefix, `/subscribe`, back-in-stock, store-wide sale, snow, `/cart/:lines` permalink | Deferred per parity plan: locales, subscribe, back-in-stock, sale marquee, snow |

Design parity (Tiers 1–2 of the parity plan) is essentially complete in the experimental app — but it was built as a **"let's see if we can get it working" spike, not correctness-focused**. It proves feasibility and serves as the porting reference; it is not trusted code. The remaining work is **feature-by-feature porting with hardening, gap closure, deployment architecture, and cutover** — not visual conversion.

## Strategy

**Do not attempt a per-route strangler migration inside `remix-store`.** The two framework stacks have incompatible Vite build pipelines (Shopify CLI + `@react-router/dev` vs. the fullstack plugin + custom adapter), and interleaving them would ship two React runtimes, two CSS systems, and a duplicated shell for months.

**Do not bulk-import the experimental app either.** It is a spike — built as "let's see if we can get it working," not correctness-focused. Bulk-copying it would launder untested code through one unreviewable mega-commit. Instead:

1. **Phase 0 was narrowed and completed on `main` in #247** — a portable Playwright acceptance baseline, removal of the unused `/components` route, and concise environment guidance. Separate snapshot, gap-audit, and content-contract artifacts were judged unnecessary.
2. **A long-lived `v3` branch in `remix-store` starts from a minimal platform skeleton**, then features port over **one at a time** — each PR ports one surface from the experimental reference, passes a hardening checklist, gets fresh tests, and deploys to an Oxygen preview environment. The experimental repo is the *reference implementation*; the official RR7 app is the *behavioral spec*; correctness is established during the port, not assumed from the spike.
3. **Both deployment targets use the same branch contents.** During migration, branch pushes may deploy to Oxygen previews and the Fly staging app so runtime drift is caught continuously. After cutover, both workflows are restricted to `main`.

```
remix-store main ── Phase 0 complete ────────────────────────┐
                 \                                           │
                  v3 ─ platform ─ feature ports + hardening ─┴─ merge to main
                       │
                       ├─ Oxygen preview deployments
                       └─ Fly staging deployments
```

## Decisions

### Resolved

| # | Decision | Resolution |
|---|---|---|
| D1 | Feature scope | **Full feature parity.** Port subscribe, back-in-stock, store-wide sale, and seasonal snow. Only unused plumbing may be dropped (see the locale finding below and the gap audit). Cutover does not happen until the gap list is empty. |
| D3 | Deployment workflow model | **Shared branch contents, two continuous deploys.** During migration, Oxygen preview and Fly staging workflows may run for every branch push. After cutover, restrict both to `main`; do not maintain target-specific code branches. |
| — | Prerelease dependencies | **Accepted risk.** The store will ship on Remix 3 beta + Hydrogen preview builds by design. Pin exact versions; upgrades gated by the acceptance suite. |
| — | Timeline posture | **`v3` is a long-lived branch.** No pressure to cut over early; cutover happens when full parity is verified, not before. |
| D6 | `/components` styleguide route | **Dropped on `main` in #247.** The feature was no longer used and does not port to `v3`. |
| D2 | Git history / import shape | **No history preservation, no bulk import.** `v3` starts from a minimal platform skeleton; everything else ports one feature at a time with a hardening pass and fresh tests. The experimental repo stays where it is as the porting reference. |
| D4 | Cutover mechanics | **Merge `v3` → `main`.** `main` stays continuous for clones and CI; rollback = revert the merge commit. |
| D5 | Vite adapter ownership | **Keep vendored** (`vite/remix-oxygen.ts`). No extraction planned — the expectation is the Hydrogen/Oxygen team eventually ships an official adapter; adopt it when it exists. Until then the vendored copy gets a line-by-line review in Phase 1 and its own documentation. |

### Locale finding (informs the gap audit)

The official store's i18n is **plumbing without a user-facing feature**:

- `getLocaleFromRequest()` parses any `/xx-yy` path prefix into language/country for `@inContext`, and `($locale).tsx` 404s invalid prefixes — but **no UI links to any locale**; there is no country selector; `pathPrefix` is consumed nowhere outside `lib/i18n.ts`.
- The only external surface is SEO: sitemap sub-pages advertise `EN-US`, `EN-CA`, `FR-CA` alternate URLs, so those URLs are known to search engines.

**Recommendation: drop the locale plumbing.** Fixed EN-US; permanent redirect for `/^[a-z]{2}-[a-z]{2}(\/|$)/` prefixes to the unprefixed path; sitemap emits no locale alternates. One confirmation before executing: check Shopify admin for active Markets config / CA order volume — if CA is actively merchandised, keep the prefix support instead (small task either way).

### Still open

| Item | What's needed | Needed by |
|---|---|---|
| Locale/Markets check | Someone with Shopify admin access confirms Markets config and CA order volume → finalizes drop-vs-keep for locale plumbing | Phase 2.15 |

## Definitive feature-gap audit (seed list)

What the official store has that the experimental app lacks today. This list and the parity plan are the working checklist; **cutover gate = every row verified closed or explicitly dropped-with-redirects.**

| Gap | Official source | Experimental status | Disposition |
|---|---|---|---|
| Subscribe route (`/subscribe`) + Admin API customer create/update, tag merge, email-marketing consent | `($locale).subscribe.tsx`, `subscribe.server.ts` | Missing (deferred in parity plan) | **Build** (2.14) |
| Back-in-stock form on sold-out variants (`custom.subscribe_if_back_in_stock`) | `products.$handle.tsx` + `subscribe.server.ts` | Missing (deferred) | **Build** (2.14, same Admin API boundary) |
| Store-wide sale marquee + automatic-discount label in cart | `header.server.ts`, `store-wide-sale.tsx` | Missing (deferred) | **Build** (2.13) |
| Seasonal snow (December canvas, reduced-motion) | `snow-field.tsx` | Missing (deferred) | **Build** (2.16) |
| Locale path prefix + `@inContext` + sitemap alternates (EN-US/EN-CA/FR-CA) | `lib/i18n.ts`, `($locale)` routes, sitemap route | Missing (fixed EN-US) | **Drop with redirects** per locale finding, pending Markets check (2.15) |
| Cart permalink `/cart/:lines`, checkout redirect, AJAX cart, `/admin` | `cart.$lines.tsx`, Hydrogen handlers | Present via `handleShopifyRoutes()` in `middleware/storefront.ts` | **Verify during port** (2.11) |
| Catch-all `$` → Shopify storefront-redirect fallback on 404 | `($locale).$.tsx` + `storefrontRedirect` in `server.ts` | Present per parity plan (checkout compat) | **Verify during port** (2.11) |
| `/components` internal styleguide | `components.tsx`, `components.animated-link.tsx` | Missing | **Dropped on `main` in #247** (D6) |
| Session-secret-backed session (`SESSION_SECRET`) | `lib/session.ts` | Unclear | **Audit** (2.17) |
| `PUBLIC_CHECKOUT_DOMAIN` handling (checkout.remix.run) | env + checkout redirect | Unclear | Verify with checkout behavior in 2.11 |

Feature PRs must compare their surface against the official app as they port it. A separate exhaustive Phase 0 audit artifact was intentionally dropped; the table above remains a seed, not proof of completeness.

## Phase 0 — Complete on `main` (#247)

Phase 0 was deliberately reduced to artifacts that improve the active application and remain useful during the migration:

| Outcome | Status |
|---|---|
| Portable Playwright acceptance baseline | Landed on `main`; carried into `v3` with current skeleton and 404 checks enabled. Catalog, product, cart, SEO, and no-JavaScript cases remain skipped until their surfaces port. `BASE_URL` targets existing Oxygen or Fly deployments. |
| Remove unused `/components` styleguide | Landed on `main`. The route does not exist in the new app. |
| Environment guidance | Kept alongside the values in `.env.example`; deployment-specific secrets are documented when their consuming feature or target lands. |

The following standalone Phase 0 artifacts were intentionally dropped:

- production behavior snapshots and a general-purpose diff script;
- a separate exhaustive gap-audit document;
- a separate Shopify content-model contract document; and
- a separate environment-contract table.

The migration plan, parity plan, focused acceptance cases, and GraphQL documents become the maintained contract as each surface ports. Locale/Markets remains an explicit Phase 2.15 decision because it requires Shopify business context, not more repository inventory.

## Phase 1 — Platform skeleton on `remix-store` `v3` branch

Sequential; single owner recommended.

### 1.1 Skeleton
- Create `v3` from `main` (D2: no history import). One reviewable change that removes the RR7 app (app/, server.ts, react-router config, Tailwind/Radix/Embla deps, Shopify CLI build scripts, codegen artifacts) and adds only the **platform**, ported from the experimental reference with a real review pass:
  - `vite/remix-oxygen.ts` — **line-by-line review**; it is load-bearing spike code (build order, `clientEntry()` transform, manifest inlining, hydration-export validation). Document it as part of the port (see 3.1).
  - `app/runtime.ts`, `app/entry.oxygen.ts`, `app/entry.browser.ts`
  - `app/routes.ts` / `app/router.ts` scaffolding + render and error-page middleware
  - Storefront client middleware (`app/middleware/storefront.ts` + `app/data/storefront.ts`) — this is 2.2's surface, but the skeleton needs a working SFAPI query; land it minimal here, harden it in 2.2
  - A minimal document shell and placeholder home route proving **SSR + hydration + one live SFAPI query** end-to-end
- Keep from the official repo: `.github/` (adapted in 1.2), `.env.example`, `LICENSE.md`, `README.md` (rewritten), and editor configuration as desired.
- Pin **exact** versions of `remix` and `@shopify/hydrogen` (no ranges). Verify the Hydrogen preview snapshot is durably installable from the committed lockfile; if it is a temporary tag, coordinate with the Hydrogen team on a stable preview channel before cutover.
- **Acceptance:** `pnpm i && pnpm dev`, `pnpm build`, `pnpm test`, `pnpm typecheck` all work in `remix-store` on `v3` against the real store env; the skeleton page renders live store data on a preview deploy.

### 1.2 CI + preview deploys on `v3`
- Adapt the four workflows (format, lint, test, oxygen-deployment) to the new toolchain. Keep linting and formatting minimal with Oxlint, Oxfmt, and TypeScript.
- Oxygen deployment: confirm `shopify hydrogen deploy` works with the custom Vite build output (`dist/ssr/index.js` worker + `dist/client` assets) for storefront `1000020043` **preview environments** on `v3` pushes. Production env deploys remain bound to `main`.
- Run the portable acceptance suite in CI, scoped to ported surfaces. Skipped unported cases are the explicit allowlist and must shrink to zero by the Phase 4 gate.
- **Acceptance:** push to `v3` → green CI → live preview URL → scoped acceptance suite passes.

### 1.3 Native Node + Remix Assets boundary
- Make `remix/node-fetch-server` + `remix/assets` the default local development runtime so application code does not accumulate Vite-specific asset assumptions.
- Keep shared routes, actions, UI, Storefront middleware, and streaming SSR runtime-neutral. Put Node asset resolution and Oxygen/Vite manifest resolution behind target-specific router composition.
- Keep browser-reachable modules in colocated `app/**/public/**` directories. The Node asset server allows those directories plus the root browser entry only; server-only source stays outside that public import graph.
- Keep `pnpm dev:oxygen`, `pnpm build:oxygen`, and `pnpm preview:oxygen` as explicit Worker-runtime validation paths.
- Add only the Node/Fly-compatible server foundation here; defer Docker, Fly configuration, production cache, compression, health checks, and deployment workflows to Phase 3.2.
- **Acceptance:** the same server-rendered page and browser component work under native Node/Remix Assets and built Oxygen preview; both targets retain focused tests.

## Phase 2 — Feature-by-feature port with hardening (PRs into `v3`)

The experimental app is the **reference**, the official RR7 app is the **behavioral spec**, and the parity plan is the design spec. Every port is one PR that:

1. Ports one surface from the reference — no bulk-copying of multiple surfaces.
2. Passes the hardening checklist below (the spike was not correctness-focused; this is where correctness is established).
3. Ships fresh tests: unit/browser tests in-repo plus enabled or new cases in the portable acceptance suite.
4. Validates on the Oxygen preview deploy before merge.

### Hardening checklist (applies to every port)

- **Error paths:** SFAPI failures, malformed/missing Shopify content (metaobjects, menus, metafields), aborted requests, image load failures.
- **Races + optimistic state:** rapid cart updates, rollback on failure, load-more cursor dedupe, variant-selection URL state.
- **Caching:** correct cache strategy per query; nothing personalized in shared caches; cart/personalized responses `private, no-store`.
- **Accessibility:** keyboard, focus visibility, labels, `aria-hidden` on decorative layers, reduced motion.
- **No-JS:** every essential form/link works server-side.
- **Security:** merchant content only through the controlled rich-text renderer (no raw `innerHTML`); secrets server-only; redirects same-origin-checked.
- **Behavioral diff:** compare against the official RR7 implementation, not just the spike — where they disagree, the RR7 app + parity plan win unless documented otherwise.

### Port sequence (dependency-ordered)

2.1–2.3 land first and mostly serialize; later ports parallelize where surfaces don't overlap.

| # | Surface | Reference (experimental) | Behavioral spec (official) | Extra hardening focus |
|---|---|---|---|---|
| 2.1 | Tokens, fonts, icons, image helper, shared primitives (pills, page title, branded states) | `app/ui/shopify-image`, `page-title`, `branded-state` | `tailwind.css` tokens, `image-utils.ts`, `blur-image.tsx` | srcset/sizes correctness, focal points, font/asset provenance |
| 2.2 | Storefront data layer: client, cache strategies, error handling (hardens the 1.1 minimal version) | `app/data/storefront.ts`, `middleware/storefront.ts` | `lib/context.ts`, `fragments.ts` | request scoping, cache key hygiene, SFAPI error surfaces |
| 2.3 | Shell: document, header/navbar, footer, preconnects/favicons/meta plumbing | `app/ui/document`, `ui/navbar`, `assets/navbar`, `assets/footer` | `navbar.tsx`, `footer.tsx`, `mobile-menu.tsx`, `meta.ts` | menu-data fallbacks, mobile menu a11y, scroll effects + reduced motion |
| 2.4 | Home: hero, lookbook, runner, catalog transition | `app/actions/home`, `assets/home-hero` | `hero.server.ts`, `lookbook.server.ts` | metaobject validation/fallbacks, frame preload failure, scroll scrubbing |
| 2.5 | Product grid + collections + load more | `app/actions/collections`, `ui/product-grid`, `ui/product-card` | `collection.server.ts`, `load-more-products.tsx` | cursor dedupe, GET fallback, back/forward, empty collection |
| 2.6 | Product page: variant store, gallery, rich text | `app/actions/products`, `assets/product-form`, `ui/rich-text` | `product.server.ts`, `product-images.tsx` | combined listings, impossible combos, sold-out states, renderer safety |
| 2.7 | Cart: store, drawer, full page, mutations, summary, empty state | `app/data/cart*`, `assets/cart*` | `cart.tsx`, `($locale).cart.tsx` | optimistic rollback, rapid updates, scoped errors, checkout gating, dialog a11y |
| 2.8 | Policies/contact | `app/actions/policies` | `policy.server.ts` | merchant-HTML trust policy |
| 2.9 | Errors: 404/500/matrix art + branded empty states | `actions/pages`, `assets/matrix-text` | `matrix-text.tsx`, root error boundary | SSR of error states, reduced motion |
| 2.10 | SEO: meta, robots, sitemap | `actions/robots`, `actions/sitemap` | `meta.ts`, sitemap routes | enable and expand portable SEO acceptance cases |
| 2.11 | Redirects/permalinks/discounts/checkout compat: `/discount/:code`, `?discount=`, `/cart/:lines`, checkout (`PUBLIC_CHECKOUT_DOMAIN`), `/admin`, storefront-redirect 404 fallback, MyShopify-domain rewrites | `actions/discounts`, `middleware/storefront.ts` (`handleShopifyRoutes`) | `discount.$code.tsx`, `cart.$lines.tsx`, `server.ts` | portable redirect acceptance cases; same-origin safety |
| 2.12 | Analytics + consent | `app/assets/analytics`, `data/analytics` | analytics wiring | live event verification in Shopify admin against a preview deploy |

### Net-new builds (no experimental reference — build from the official implementation + parity plan)

| # | Feature | Spec |
|---|---|---|
| 2.13 | Store-wide sale marquee + automatic-discount label in cart | parity plan §Store-wide sale; `header.server.ts`, `store-wide-sale.tsx` |
| 2.14 | Subscribe + back-in-stock — Admin API boundary with validation, rate limiting, consent handling, no PII logging; `ADMIN_ACCESS_TOKEN` server-only | parity plan §Subscribe; `subscribe.server.ts` |
| 2.15 | Locale disposition: drop-with-redirects + locale-free sitemap, or port the prefix + `@inContext` wiring (per the Markets check) | locale finding; `lib/i18n.ts`; `hydrogen-markets` skill |
| 2.16 | Seasonal snow (December-only, reduced-motion fallback) | `snow-field.tsx` |
| 2.17 | Session/secret audit: what does `SESSION_SECRET` protect in the new stack; carry over or document retirement | `lib/session.ts` |

**Gate to Phase 4:** every gap row resolved; the acceptance-suite skip list empty; SEO acceptance checks green; analytics verified; one real end-to-end purchase completed and refunded on a preview/staging deploy. `v3` is long-lived — this gate has no deadline and cutover waits for it.

## Phase 3 — Deployment architecture (parallel with Phase 2)

### 3.1 Oxygen target (exists — harden it)
- Keep `app/entry.oxygen.ts` + `vite/remix-oxygen.ts` + MiniOxygen dev/preview vendored (D5). The line-by-line review happens in 1.1; this task adds the durable artifacts.
- Add a short `vite/README` documenting the adapter's responsibilities (build order, `clientEntry()` transform, manifest inlining, hydration-export validation) — it is load-bearing and its source-scanning validation is fragile to refactors. Note the intent to replace it with an official Hydrogen/Oxygen adapter when one ships.
- **Acceptance:** production-environment deploy from a test branch to Oxygen succeeds and passes the acceptance suite.

### 3.2 Node/Fly target (in progress)
- Keep `server.node.ts` + `remix/node-fetch-server` + `remix/assets` as the canonical Node path. Node responses use Remix compression; `public/` and browser assets still short-circuit before Storefront middleware.
- The staging foundation includes a production-only Docker image, `fly.toml`, a cheap `/health` check, one warm Machine, graceful shutdown, and commit-derived `ASSET_BUILD_ID` fingerprinting.
- Runtime hardening that remains before Fly can serve production traffic:
  - **Cache:** Node has no `caches` API. Measure staging Storefront traffic, then add an in-memory TTL cache adapter for catalog strategies if query volume or TTFB requires it. Redis remains a later option.
  - **Env:** Node request runtime uses `process.env`. ✓
  - **waitUntil:** add a deliberate Node background-task policy before any feature relies on it; do not leave rejected promises unobserved.
- **Acceptance:** the local Docker image serves the store; Fly staging passes health and home-page smoke checks; enabled acceptance cases pass against its URL; fingerprinted asset caching survives a release rollover.

### 3.3 Continuous dual-target validation (per D3)
- Keep both runtime adapters and deployment configs in the application branch; do not create target-specific code branches.
- During migration, run Oxygen preview and Fly staging deployment workflows on branch pushes so every platform change exercises both targets.
- Run the portable acceptance suite against deployment URLs when each platform exposes one to the workflow.
- After `v3` merges to `main`, restrict both deployment workflows to `main` and use protected GitHub environments for production credentials and approvals.
- **Acceptance:** the same commit deploys successfully to Oxygen and Fly, and the enabled acceptance cases pass against both URLs.

## Phase 4 — Cutover

Runs only after the Phase 2/3 gate is fully green — expect `v3` to live for a while first.

1. **Freeze** feature PRs on `main` (security fixes only); announce a window.
2. Merge the latest `main` deltas into `v3` (there should be almost none post-Phase 0); do not rewrite the long-lived branch with a rebase.
3. Deploy `v3` to staging on both Oxygen and Fly; run the full gate: acceptance suite, SEO review, analytics verification, Lighthouse/CWV comparison vs. production, manual checkout + refund, cart permalink and discount flows (real money paths).
4. Verify production Oxygen and Fly environment values against `.env.example` before merge.
5. Merge `v3` → `main` (D4 resolved); production deploys via the hardened workflows. Immediately re-run the acceptance suite and SEO checks against production.
6. Monitor for 48h: Oxygen logs, Shopify analytics event volume (sudden drop = consent/analytics regression), Search Console coverage, conversion funnel.
7. **Rollback plan:** revert the merge commit on `main` (auto-redeploys the old stack) — keep the old lockfile/toolchain functional until the monitoring window closes. Shopify-side content is shared by both stacks, so rollback is code-only.
8. Restrict the Oxygen and Fly deployment workflows to `main` (Phase 3.3). Fly may remain a secondary target until the team decides its production role.

## Phase 5 — Post-cutover

- Archive `remix-3-hydrogen` with a pointer to `remix-store` (or keep as a scratchpad — but stop dual-maintaining the app).
- **Upstream tracking:** assign an owner for Remix 3 beta and Hydrogen preview upgrades; upgrade on a cadence with the acceptance suite as the gate. This is the highest ongoing risk — the store runs on prerelease software by design (it is the showcase), so upgrades must be routine, not events.
- Track Hydrogen/Oxygen upstream for an official Vite adapter; replace the vendored `vite/remix-oxygen.ts` when it exists (D5). No extraction/publishing of our own.
- Decide the experimental repo's fate once porting completes (archive with a pointer to `remix-store`); it stops being the reference the moment the last surface ports.
- Reinstate the nightly production acceptance-suite run.
- Backlog from parity plan Tier 3 / intentional non-parity: snow, customer accounts, search — explicitly parked, not lost.

## Risk register

Prerelease software (Remix 3 beta, Hydrogen preview) is an **accepted** risk — the store is the showcase. The register tracks its operational consequences, not the choice itself.

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Hydrogen preview snapshot becomes uninstallable | Medium | Blocks all builds | Verify durable install path in 1.1; coordinate stable preview channel; lockfile committed |
| Remix 3 beta breaking changes mid-migration | Medium | Rework | Pin exact versions; upgrade only at phase boundaries with full suite; long-lived `v3` absorbs this without production exposure |
| Spike-quality reference code carries latent bugs | High (by the author's own assessment) | Subtle production defects | Per-feature ports with the hardening checklist + fresh tests; RR7 app is the behavioral spec, not the spike; no bulk imports |
| SEO regression on cutover (locales, sitemap, meta) | Medium | Organic traffic loss | Portable SEO acceptance cases + pre-cutover review + post-cutover Search Console monitoring |
| Real-money flow regression (checkout, permalinks, discounts) | Low | Customer harm | Manual purchase test in gate; these paths get explicit portable acceptance coverage |
| Analytics/consent silently broken | Medium | Merch data loss | 2.5 live verification + event-volume monitoring post-cutover |
| Vite adapter fragility (source-scanning validation) | Medium | Confusing build failures | 3.1 documentation; adapter changes require build + e2e in CI |
| Node target SFAPI rate limiting (no Cache API) | Medium | Fly target slow/throttled | 3.2 cache adapter + query-volume comparison before Fly serves real traffic |
| Deployment-target drift | Low | Node and Oxygen behavior diverges | Deploy the same branch commit to both targets and run the portable acceptance cases against each |

## Sub-agent task index

Phase 0 (complete in #247): portable acceptance baseline · `/components` removal · concise environment guidance
Phase 1: 1.1 platform skeleton · 1.2 CI + preview deploys · 1.3 native Node + Remix Assets boundary
Phase 2 ports: 2.1 tokens/primitives · 2.2 data layer · 2.3 shell · 2.4 home · 2.5 grid/collections · 2.6 product · 2.7 cart · 2.8 policies · 2.9 errors · 2.10 SEO · 2.11 redirects · 2.12 analytics
Phase 2 builds: 2.13 sale · 2.14 subscribe/back-in-stock · 2.15 locales · 2.16 snow · 2.17 session audit
Phase 3: 3.1 oxygen hardening · 3.2 node/fly target · 3.3 continuous dual-target validation
Phase 4: cutover runbook (single owner, not parallelized)

Rules for every sub-agent task: read `.agents/skills/remix-store/SKILL.md` and the relevant version-matched Hydrogen skill under `node_modules/@shopify/hydrogen/skills/`; follow the parity plan's conversion rules (no Tailwind/Radix/Embla/React-Router idioms); every PR runs build + typecheck + tests + acceptance suite against a preview deploy; no commits or pushes without explicit human sign-off on the PR flow.
