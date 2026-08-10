# Remix Store Migration Plan: Hydrogen 3 + Remix 3

Goal: make [`~/code/remix-store`](../remix-store) (github.com/remix-run/remix-store, deployed at shop.remix.run) the official Hydrogen 3 + Remix 3 storefront, using [`~/code/remix-3-hydrogen`](.) as the source implementation.

Companion document: [`REMIX_STORE_PARITY_PLAN.md`](./REMIX_STORE_PARITY_PLAN.md) — the design/feature parity spec. That document defines *what the storefront looks like and does*; this document defines *how the platform swap lands in the official repo and ships*.

## Current state

| | `remix-store` (official) | `remix-3-hydrogen` (experimental) |
|---|---|---|
| Framework | React Router 7 + `@shopify/hydrogen` 2026.4.4 (React components) | Remix 3 (`^3.0.0-beta.5`) + framework-neutral Hydrogen preview (`0.0.0-preview-116d5d7-20260730141607`) |
| Styling | Tailwind 4, Radix, Embla, CVA | Remix `css()`/`mix`, native controls, no UI deps |
| Build | Shopify CLI (`shopify hydrogen build`) + `@react-router/dev` | Vite 8 + app-owned adapter `vite/remix-oxygen.ts` (wraps `@hiogawa/vite-plugin-fullstack`) + MiniOxygen |
| Server entry | `server.ts` worker via `@shopify/hydrogen/oxygen` | `app/entry.server.ts` fetch handler; `app/runtime.ts` abstracts env/waitUntil/cache with `process.env` fallback |
| Deploy | GitHub Actions → Oxygen on every push (storefront `1000020043`); `staging` branch exists | `shopify hydrogen deploy --preview` (manual) |
| CI | format, lint, test, oxygen-deployment workflows | None |
| Tests | Vitest + Testing Library | `remix test` (unit + browser), Playwright e2e |
| Features beyond parity plan scope | `($locale)` prefix, `/subscribe`, back-in-stock, store-wide sale, snow, `/cart/:lines` permalink | Deferred per parity plan: locales, subscribe, back-in-stock, sale marquee, snow |

Design parity (Tiers 1–2 of the parity plan) is essentially complete in the experimental app — but it was built as a **"let's see if we can get it working" spike, not correctness-focused**. It proves feasibility and serves as the porting reference; it is not trusted code. The remaining work is **feature-by-feature porting with hardening, gap closure, deployment architecture, and cutover** — not visual conversion.

## Strategy

**Do not attempt a per-route strangler migration inside `remix-store`.** The two framework stacks have incompatible Vite build pipelines (Shopify CLI + `@react-router/dev` vs. the fullstack plugin + custom adapter), and interleaving them would ship two React runtimes, two CSS systems, and a duplicated shell for months.

**Do not bulk-import the experimental app either.** It is a spike — built as "let's see if we can get it working," not correctness-focused. Bulk-copying it would launder untested code through one unreviewable mega-commit. Instead:

1. **Phase 0 work ships on `remix-store` `main` today** — cutover acceptance tooling, behavior snapshots, feature retirements (`/components`, possibly locales), and the definitive gap audit. Every item is valuable even if the migration slips.
2. **A long-lived `v3` branch in `remix-store` starts from a minimal platform skeleton**, then features port over **one at a time** — each PR ports one surface from the experimental reference, passes a hardening checklist, gets fresh tests, and deploys to an Oxygen preview environment. The experimental repo is the *reference implementation*; the official RR7 app is the *behavioral spec*; correctness is established during the port, not assumed from the spike.
3. **Both deployment targets live in `main` after cutover**; the two deployment branches stay thin (CI + config only), so per-target drift is structurally impossible.

```
remix-store main ── Phase 0 PRs (ship now) ──────────────────┐ freeze ─ merge v3 ─ main (v3 code)
                 \                                           │              │
                  v3 ─ skeleton ─ feature ports + hardening ─┘              ├─ deploy/oxygen
                       (reference: remix-3-hydrogen · spec: old RR7 app)    └─ deploy/fly
```

## Decisions

### Resolved

| # | Decision | Resolution |
|---|---|---|
| D1 | Feature scope | **Full feature parity.** Port subscribe, back-in-stock, store-wide sale, and seasonal snow. Only unused plumbing may be dropped (see the locale finding below and the gap audit). Cutover does not happen until the gap list is empty. |
| D3 | Deployment-branch model | **Thin branches.** Adapters/configs for both targets live in `main`; `deploy/oxygen` and `deploy/fly` add only CI workflow + target config. `app/runtime.ts` already abstracts the runtime. |
| — | Prerelease dependencies | **Accepted risk.** The store will ship on Remix 3 beta + Hydrogen preview builds by design. Pin exact versions; upgrades gated by the acceptance suite. |
| — | Timeline posture | **`v3` is a long-lived branch.** No pressure to cut over early; cutover happens when full parity is verified, not before. |
| D6 | `/components` styleguide route | **Drop — and drop it on `main` now** (Phase 0.3). The feature is no longer used. Remove `components.tsx` + `components.animated-link.tsx` and any components/deps orphaned by the removal; re-capture snapshots. |
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
| Locale/Markets check | Someone with Shopify admin access confirms Markets config and CA order volume → finalizes drop-vs-keep for locale plumbing | Phase 0.3 |

## Definitive feature-gap audit (seed list)

What the official store has that the experimental app lacks today. Phase 0.3 turns this into the canonical tracked checklist; **cutover gate = every row verified closed or explicitly dropped-with-redirects.**

| Gap | Official source | Experimental status | Disposition |
|---|---|---|---|
| Subscribe route (`/subscribe`) + Admin API customer create/update, tag merge, email-marketing consent | `($locale).subscribe.tsx`, `subscribe.server.ts` | Missing (deferred in parity plan) | **Build** (2.14) |
| Back-in-stock form on sold-out variants (`custom.subscribe_if_back_in_stock`) | `products.$handle.tsx` + `subscribe.server.ts` | Missing (deferred) | **Build** (2.14, same Admin API boundary) |
| Store-wide sale marquee + automatic-discount label in cart | `header.server.ts`, `store-wide-sale.tsx` | Missing (deferred) | **Build** (2.13) |
| Seasonal snow (December canvas, reduced-motion) | `snow-field.tsx` | Missing (deferred) | **Build** (2.16) |
| Locale path prefix + `@inContext` + sitemap alternates (EN-US/EN-CA/FR-CA) | `lib/i18n.ts`, `($locale)` routes, sitemap route | Missing (fixed EN-US) | **Drop with redirects** per locale finding, pending Markets check (2.15) |
| Cart permalink `/cart/:lines`, checkout redirect, AJAX cart, `/admin` | `cart.$lines.tsx`, Hydrogen handlers | Present via `handleShopifyRoutes()` in `middleware/storefront.ts` | **Verify during port** (2.11) |
| Catch-all `$` → Shopify storefront-redirect fallback on 404 | `($locale).$.tsx` + `storefrontRedirect` in `server.ts` | Present per parity plan (checkout compat) | **Verify during port** (2.11) |
| `/components` internal styleguide | `components.tsx`, `components.animated-link.tsx` | Missing | **Drop on `main` now** (D6, Phase 0.3) |
| Session-secret-backed session (`SESSION_SECRET`) | `lib/session.ts` | Unclear | **Audit** (2.17) |
| `PUBLIC_CHECKOUT_DOMAIN` handling (checkout.remix.run) | env + checkout redirect | Unclear | Fold into 0.5 env mapping + 2.11 verification |

The audit (0.3) must also do a route-by-route and component-by-component sweep of the official app (~96 files) to catch anything not already named by the parity plan — the table above is a seed, not proof of completeness.

## Phase 0 — Ship on `remix-store` `main` now (incremental, no migration dependency)

Each task is an independent PR to `main`. All are valuable regardless of migration timing.

### 0.1 Framework-agnostic acceptance suite
- Playwright e2e suite that runs against any origin via a `BASE_URL` env var (local dev, Oxygen preview, staging, production).
- Cover the parity plan's verification matrix: home hero/lookbook, product grid + load more, collection pages, product page variant selection, add-to-cart, cart drawer + full page, quantity/remove, discount code, policies, 404/500, robots/sitemap, no-JS form fallbacks (`javaScriptEnabled: false` projects).
- Explicitly **do not** assert implementation details (class names, framework markers) — this suite must pass on both stacks.
- CI job on `remix-store` runs it against production nightly so drift is caught before it corrupts the baseline.
- **Acceptance:** suite green against current production.

### 0.2 Production behavior snapshot (SEO/contract fixtures)
- Script that captures and commits fixtures from https://shop.remix.run: `sitemap.xml` (+ per-type pages), `robots.txt`, per-route `<title>`/meta/OG/Twitter tags, canonical URLs, response headers (cache-control, CSP if any), and the full redirect inventory (`/discount/:code`, `?discount=`, `/cart/:lines`, checkout/admin/Shopify-standard redirects, MyShopify-domain rewrites).
- Include the locale URL inventory (`/en-ca/...` etc.) — required input for D1.
- **Acceptance:** committed fixtures + a diff script that compares any origin against them.

### 0.3 Definitive feature-gap audit
- Turn the seed gap list (above) into the canonical tracked checklist: route-by-route and component-by-component sweep of the official app, each row marked port / verify / drop-with-redirects, with an owner task in Phase 2.
- Confirm the locale finding: check Shopify admin Markets config and CA order volume; finalize drop-vs-keep for locale plumbing.
- **Drop `/components` on `main` now** (D6 resolved): remove `components.tsx`, `components.animated-link.tsx`, and anything orphaned by the removal (check `ui/dropdown-menu.tsx` and friends for remaining consumers before deleting).
- If locales are dropped: ship the redirect + sitemap change **on `main` now** in its own PR, so snapshots (0.2) and the acceptance suite (0.1) converge on target behavior before the platform swap. Locales and `/components` are the only "retire on main" items — everything else ports.
- **Acceptance:** gap checklist reviewed and agreed as the cutover gate; every row maps to a Phase 2 port/build task.

### 0.4 Shopify content-model contract doc
- Document every Shopify-side dependency both stacks read: metaobject types/handles/fields (`hero` / `remix-3-drop-playground`, `lookbook` / `lookbook-remix-racing`, `storewide_sale`), menus (`main-menu`, `footer`, `product-sidebar-menu`), metafields (`custom.description`, `custom.technical_description`, `custom.subscribe_if_back_in_stock`), policy/page handles, collection handles, free-shipping threshold.
- Lives in `remix-store` repo; is the shared contract the `v3` branch builds against.
- **Acceptance:** doc reviewed; experimental app verified to match it (no code changes, discrepancies filed as Phase 2 tasks).

### 0.5 Env var mapping
- Map the env contracts: official (`PUBLIC_STOREFRONT_ID`, `PUBLIC_STOREFRONT_API_TOKEN`, `PUBLIC_STORE_DOMAIN`, `PUBLIC_CHECKOUT_DOMAIN`, `SESSION_SECRET`) ↔ experimental (`PUBLIC_STORE_DOMAIN`, `PRIVATE_STOREFRONT_API_TOKEN`, `PUBLIC_STOREFRONT_ID`, `SHOP_ID`, `PUBLIC_SHOPIFY_INBOX_ENABLED`). Decide the final contract, document each var's purpose and privacy level, and note which must be configured in Oxygen admin vs. Fly secrets.
- **Acceptance:** one table in the repo; final `.env.example` agreed.

## Phase 1 — Platform skeleton on `remix-store` `v3` branch

Sequential; single owner recommended.

### 1.1 Skeleton
- Create `v3` from `main` (D2: no history import). One reviewable change that removes the RR7 app (app/, server.ts, react-router config, Tailwind/Radix/Embla deps, Shopify CLI build scripts, codegen artifacts) and adds only the **platform**, ported from the experimental reference with a real review pass:
  - `vite/remix-oxygen.ts` — **line-by-line review**; it is load-bearing spike code (build order, `clientEntry()` transform, manifest inlining, hydration-export validation). Document it as part of the port (see 3.1).
  - `app/runtime.ts`, `app/entry.server.ts`, `app/entry.browser.ts`
  - `app/routes.ts` / `app/router.ts` scaffolding + render and error-page middleware
  - Storefront client middleware (`app/middleware/storefront.ts` + `app/data/storefront-*.server.ts`) — this is 2.2's surface, but the skeleton needs a working SFAPI query; land it minimal here, harden it in 2.2
  - A minimal document shell and placeholder home route proving **SSR + hydration + one live SFAPI query** end-to-end
- Keep from the official repo: `.github/` (adapted in 1.2), `.env.example` (per 0.5), `LICENSE.md`, `README.md` (rewritten), prettier/editor config as desired.
- Pin **exact** versions of `remix` and `@shopify/hydrogen` (no ranges). Verify the Hydrogen preview snapshot is durably installable from the committed lockfile; if it is a temporary tag, coordinate with the Hydrogen team on a stable preview channel before cutover.
- **Acceptance:** `pnpm i && pnpm dev`, `pnpm build`, `pnpm test`, `pnpm typecheck` all work in `remix-store` on `v3` against the real store env; the skeleton page renders live store data on a preview deploy.

### 1.2 CI + preview deploys on `v3`
- Adapt the four workflows (format, lint, test, oxygen-deployment) to the new toolchain. The experimental repo has no lint/format setup — add a minimal one (prettier + typescript; skip the heavy ESLint stack unless the team wants it).
- Oxygen deployment: confirm `shopify hydrogen deploy` works with the custom Vite build output (`dist/ssr/index.js` worker + `dist/client` assets) for storefront `1000020043` **preview environments** on `v3` pushes. Production env deploys remain bound to `main`.
- Wire the Phase 0.1 acceptance suite to run against each `v3` preview deploy in CI, scoped to ported surfaces (the unported remainder is the allowlist; it must shrink to zero by the Phase 4 gate).
- **Acceptance:** push to `v3` → green CI → live preview URL → scoped acceptance suite passes.

### 1.3 Native Node + Remix Assets boundary
- Make `remix/node-fetch-server` + `remix/assets` the default local development runtime so application code does not accumulate Vite-specific asset assumptions.
- Keep shared routes, actions, UI, Storefront middleware, and streaming SSR runtime-neutral. Put Node asset resolution and Oxygen/Vite manifest resolution behind target-specific router composition.
- Keep `pnpm dev:oxygen`, `pnpm build:oxygen`, and `pnpm preview:oxygen` as explicit Worker-runtime validation paths.
- Add only the Node/Fly-compatible server foundation here; defer Docker, Fly configuration, production cache, compression, health checks, and deployment workflows to Phase 3.2.
- **Acceptance:** the same server-rendered page and browser component work under native Node/Remix Assets and built Oxygen preview; both targets retain focused tests.

## Phase 2 — Feature-by-feature port with hardening (PRs into `v3`)

The experimental app is the **reference**, the official RR7 app is the **behavioral spec**, and the parity plan is the design spec. Every port is one PR that:

1. Ports one surface from the reference — no bulk-copying of multiple surfaces.
2. Passes the hardening checklist below (the spike was not correctness-focused; this is where correctness is established).
3. Ships fresh tests: unit/browser tests in-repo plus new cases in the 0.1 acceptance suite.
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
| 2.2 | Storefront data layer: client, cache strategies, error handling (hardens the 1.1 minimal version) | `app/data/storefront-*.server.ts`, `middleware/storefront.ts` | `lib/context.ts`, `fragments.ts` | request scoping, cache key hygiene, SFAPI error surfaces |
| 2.3 | Shell: document, header/navbar, footer, preconnects/favicons/meta plumbing | `app/ui/document`, `ui/navbar`, `assets/navbar`, `assets/footer` | `navbar.tsx`, `footer.tsx`, `mobile-menu.tsx`, `meta.ts` | menu-data fallbacks, mobile menu a11y, scroll effects + reduced motion |
| 2.4 | Home: hero, lookbook, runner, catalog transition | `app/actions/home`, `assets/home-hero` | `hero.server.ts`, `lookbook.server.ts` | metaobject validation/fallbacks, frame preload failure, scroll scrubbing |
| 2.5 | Product grid + collections + load more | `app/actions/collections`, `ui/product-grid`, `ui/product-card` | `collection.server.ts`, `load-more-products.tsx` | cursor dedupe, GET fallback, back/forward, empty collection |
| 2.6 | Product page: variant store, gallery, rich text | `app/actions/products`, `assets/product-form`, `ui/rich-text` | `product.server.ts`, `product-images.tsx` | combined listings, impossible combos, sold-out states, renderer safety |
| 2.7 | Cart: store, drawer, full page, mutations, summary, empty state | `app/data/cart*`, `assets/cart*` | `cart.tsx`, `($locale).cart.tsx` | optimistic rollback, rapid updates, scoped errors, checkout gating, dialog a11y |
| 2.8 | Policies/contact | `app/actions/policies` | `policy.server.ts` | merchant-HTML trust policy |
| 2.9 | Errors: 404/500/matrix art + branded empty states | `actions/pages`, `assets/matrix-text` | `matrix-text.tsx`, root error boundary | SSR of error states, reduced motion |
| 2.10 | SEO: meta, robots, sitemap | `actions/robots`, `actions/sitemap` | `meta.ts`, sitemap routes | 0.2 fixture diff driven to zero |
| 2.11 | Redirects/permalinks/discounts/checkout compat: `/discount/:code`, `?discount=`, `/cart/:lines`, checkout (`PUBLIC_CHECKOUT_DOMAIN`), `/admin`, storefront-redirect 404 fallback, MyShopify-domain rewrites | `actions/discounts`, `middleware/storefront.ts` (`handleShopifyRoutes`) | `discount.$code.tsx`, `cart.$lines.tsx`, `server.ts` | verify the full 0.2 redirect inventory; same-origin safety |
| 2.12 | Analytics + consent | `app/assets/analytics`, `data/analytics` | analytics wiring | live event verification in Shopify admin against a preview deploy |

### Net-new builds (no experimental reference — build from the official implementation + parity plan)

| # | Feature | Spec |
|---|---|---|
| 2.13 | Store-wide sale marquee + automatic-discount label in cart | parity plan §Store-wide sale; `header.server.ts`, `store-wide-sale.tsx` |
| 2.14 | Subscribe + back-in-stock — Admin API boundary with validation, rate limiting, consent handling, no PII logging; `ADMIN_ACCESS_TOKEN` server-only | parity plan §Subscribe; `subscribe.server.ts` |
| 2.15 | Locale disposition: drop-with-redirects + locale-free sitemap, or port the prefix + `@inContext` wiring (per the Markets check) | locale finding; `lib/i18n.ts`; `hydrogen-markets` skill |
| 2.16 | Seasonal snow (December-only, reduced-motion fallback) | `snow-field.tsx` |
| 2.17 | Session/secret audit: what does `SESSION_SECRET` protect in the new stack; carry over or document retirement | `lib/session.ts` |

**Gate to Phase 4:** the 0.3 gap checklist fully closed; acceptance-suite allowlist (1.2) empty; SEO diff clean; analytics verified; one real end-to-end purchase completed and refunded on a preview/staging deploy. `v3` is long-lived — this gate has no deadline and cutover waits for it.

## Phase 3 — Deployment architecture (parallel with Phase 2)

### 3.1 Oxygen target (exists — harden it)
- Keep `app/entry.server.ts` + `vite/remix-oxygen.ts` + MiniOxygen dev/preview vendored (D5). The line-by-line review happens in 1.1; this task adds the durable artifacts.
- Add a short `vite/README` documenting the adapter's responsibilities (build order, `clientEntry()` transform, manifest inlining, hydration-export validation) — it is load-bearing and its source-scanning validation is fragile to refactors. Note the intent to replace it with an official Hydrogen/Oxygen adapter when one ships.
- **Acceptance:** production-environment deploy from a test branch to Oxygen succeeds and passes the acceptance suite.

### 3.2 Node/Fly target (harden and deploy the 1.3 foundation)
- Keep `server.node.ts` + `remix/node-fetch-server` + `remix/assets` as the canonical Node path. Add compression without moving browser compilation into Vite; serve `public/` before application routes and retain immutable fingerprinted Remix Asset URLs in production.
- Runtime gaps to close in `app/runtime.ts` consumers:
  - **Cache:** Node has no `caches` API. Verify Storefront queries degrade gracefully, then add an in-memory TTL cache adapter honoring the same cache-control strategies (watch SFAPI rate limits and TTFB without it). Redis is a later option, not a launch requirement.
  - **Env:** Node request runtime uses `process.env`. ✓
  - **waitUntil:** add a deliberate Node background-task policy before any feature relies on it; do not leave rejected promises unobserved.
- Add an explicit release-derived `ASSET_BUILD_ID`, plus `Dockerfile` (Node 24 + pnpm, production install → run) and `fly.toml` (region, health check hitting a cheap route, min machines ≥ 1 to avoid cold-start TTFB, secrets via `fly secrets`).
- **Acceptance:** `docker run` locally serves the store; Fly staging app passes the acceptance suite; SFAPI query volume is compared against Oxygen (cache adapter working); fingerprinted asset caching survives a release rollover.

### 3.3 Branch wiring (per D3)
- `main`: both entrypoints + both configs, no production CI deploy ambiguity.
- `deploy/oxygen`: `main` + the oxygen-deployment workflow bound to the production environment.
- `deploy/fly`: `main` + a fly-deploy workflow (`flyctl deploy` on push).
- Document the release flow: merge `main` → each deploy branch (fast-forward expected; any conflict is a smell that code leaked into a deploy branch).
- **Acceptance:** a no-op merge from `main` to each branch triggers a correct deploy.

## Phase 4 — Cutover

Runs only after the Phase 2/3 gate is fully green — expect `v3` to live for a while first.

1. **Freeze** feature PRs on `main` (security fixes only); announce a window.
2. Rebase/merge latest `main` deltas into `v3` (there should be almost none post-Phase 0).
3. Deploy `v3` to the **staging** Oxygen environment (existing `staging` branch convention); run the full gate: acceptance suite, SEO diff, analytics verification, Lighthouse/CWV comparison vs. production, manual checkout + refund, cart permalink and discount flows (real money paths).
4. Configure production Oxygen env vars per 0.5 before merge.
5. Merge `v3` → `main` (D4 resolved); production deploys via existing workflow. Immediately re-run the acceptance suite + SEO diff against production.
6. Monitor for 48h: Oxygen logs, Shopify analytics event volume (sudden drop = consent/analytics regression), Search Console coverage, conversion funnel.
7. **Rollback plan:** revert the merge commit on `main` (auto-redeploys the old stack) — keep the old lockfile/toolchain functional until the monitoring window closes. Shopify-side content is shared by both stacks, so rollback is code-only.
8. Create `deploy/oxygen` and `deploy/fly` from post-cutover `main` (Phase 3.3). Fly runs as a secondary target (e.g., fly-staging domain) until the team decides its production role.

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
| SEO regression on cutover (locales, sitemap, meta) | Medium | Organic traffic loss | 0.2 fixtures + 2.6 zero-diff gate + post-cutover Search Console monitoring |
| Real-money flow regression (checkout, permalinks, discounts) | Low | Customer harm | Manual purchase test in gate; these paths get explicit e2e coverage in 0.1 |
| Analytics/consent silently broken | Medium | Merch data loss | 2.5 live verification + event-volume monitoring post-cutover |
| Vite adapter fragility (source-scanning validation) | Medium | Confusing build failures | 3.1 documentation; adapter changes require build + e2e in CI |
| Node target SFAPI rate limiting (no Cache API) | Medium | Fly target slow/throttled | 3.2 cache adapter + query-volume comparison before Fly serves real traffic |
| Deploy-branch drift | Low (with D3=a) | Divergent prod behavior | Thin branches; conflict-on-merge treated as a defect |

## Sub-agent task index

Phase 0: 0.1 acceptance suite · 0.2 behavior snapshot · 0.3 gap audit + `/components` drop (+ locale drop if confirmed) · 0.4 content-model doc · 0.5 env mapping
Phase 1: 1.1 platform skeleton · 1.2 CI + preview deploys · 1.3 native Node + Remix Assets boundary
Phase 2 ports: 2.1 tokens/primitives · 2.2 data layer · 2.3 shell · 2.4 home · 2.5 grid/collections · 2.6 product · 2.7 cart · 2.8 policies · 2.9 errors · 2.10 SEO · 2.11 redirects · 2.12 analytics
Phase 2 builds: 2.13 sale · 2.14 subscribe/back-in-stock · 2.15 locales · 2.16 snow · 2.17 session audit
Phase 3: 3.1 oxygen hardening · 3.2 node/fly target · 3.3 branch wiring
Phase 4: cutover runbook (single owner, not parallelized)

Rules for every sub-agent task: read `.agents/skills/remix/SKILL.md` and the relevant hydrogen skills first; follow the parity plan's conversion rules (no Tailwind/Radix/Embla/React-Router idioms); every PR runs build + typecheck + tests + acceptance suite against a preview deploy; no commits or pushes without explicit human sign-off on the PR flow.
