# Remix Store v3 migration

Goal: replace the React Router 7 storefront on `main` with the Remix 3 + framework-neutral Hydrogen app on `v3`, then run the same application on Oxygen and Fly.

[`REMIX_STORE_PARITY_PLAN.md`](./REMIX_STORE_PARITY_PLAN.md) remains the design and behavior reference. The official RR7 app is the behavioral spec; [`~/code/remix-3-hydrogen`](../remix-3-hydrogen) is an implementation reference, not trusted source code.

## Current position

- `main` remains the production RR7 storefront.
- `v3` has the Remix 3 platform, native Node/Remix Assets runtime, Oxygen runtime, and continuous Fly/Oxygen deployment foundations.
- Feature ports complete on `v3`: shared primitives and assets, Storefront data, shell, home, collections/load-more, product details/variants, and cart.
- Browser-reachable modules use colocated `app/**/public/**` directories; shared application code remains runtime-neutral.
- Node has a bounded in-memory Storefront cache. Fly has Docker, health checks, graceful shutdown, immutable asset IDs, and deployment smoke checks.
- The remaining work starts with supporting routes and launch behavior; the platform and completed feature history do not need further migration planning.

## Fixed decisions

| Area | Decision |
| --- | --- |
| Scope | Full feature parity before cutover, including sale, subscribe/back-in-stock, and seasonal snow. Unused plumbing may be explicitly retired. |
| Porting | Port one surface at a time and harden it. Do not bulk-import the experimental app. |
| Branches | `v3` is long-lived. Oxygen and Fly deploy the same branch contents; no target-specific application branches. |
| Cutover | Merge `v3` into `main`; rollback by reverting that merge commit. Do not rebase the long-lived branch before cutover. |
| Dependencies | Remix 3 beta and Hydrogen preview are accepted risks. Keep exact versions and gate upgrades on the full suite. |
| Oxygen adapter | Keep `vite/remix-oxygen.ts` vendored until an official adapter replaces it. |

## Remaining feature work

Complete in dependency order unless surfaces are independent. Every feature PR compares the official RR7 behavior and parity plan, adds focused tests, preserves no-JavaScript behavior, and validates both production builds.

| # | Work | Completion criteria |
| ---: | --- | --- |
| 2.8 | Policies and contact | Shopify-backed refund, privacy, shipping, terms, and contact routes; branded layout; explicit merchant-HTML trust/sanitization policy. |
| 2.10 | SEO resources | Add `robots.txt` and sitemap resources; finish route metadata coverage; test canonical, indexing, and social metadata against a deployed origin. Branded 404/500 work is already complete. |
| 2.11 | Shopify compatibility routes | Verify `/cart/:lines`, checkout and `PUBLIC_CHECKOUT_DOMAIN`, AJAX cart, `/admin`, `/discount/:code`, `?discount=`, MyShopify rewrites, and Storefront redirect fallback. Add redirect/permalink acceptance cases and preserve same-origin safety. |
| 2.12 | Analytics and consent | Finish consent-aware page/product/collection/cart events, including the pending `cart_viewed` event; verify live events in Shopify admin from preview deployments. |
| 2.13 | Store-wide sale | Port the active-sale metaobject query and reduced-motion marquee; use the sale title for automatic-discount labels. |
| 2.14 | Subscribe and back-in-stock | Build the Admin API boundary, newsletter route, and sold-out variant form with validation, rate limiting, consent handling, server-only credentials, and no PII logging. |
| 2.15 | Locales/Markets | Get the Shopify business decision below, then either implement locale prefixes/`@inContext`/alternates or permanently redirect locale-prefixed URLs and emit a locale-free sitemap. |
| 2.16 | Seasonal snow | Port the December-only canvas effect with reduced-motion and static fallbacks. |
| 2.17 | Sessions | Determine whether any remaining feature requires durable session state. Implement a signed `SESSION_SECRET` boundary or remove the unused variable and document its retirement. |

## Open decision

**Locale/Markets:** someone with Shopify admin access must confirm active Markets configuration and Canadian merchandising/order volume. If CA is active, keep locale prefixes and `@inContext`; otherwise use fixed EN-US, permanently redirect `/^[a-z]{2}-[a-z]{2}(\/|$)/` paths to unprefixed paths, and remove sitemap alternates.

## Remaining deployment work

- Document `vite/remix-oxygen.ts` in `vite/README.md`: build order, `clientEntry()` transform, manifest inlining, hydration-export validation, and replacement intent.
- Define Node `waitUntil` behavior before analytics or another feature relies on background work; rejected tasks must be observed.
- Run the portable acceptance suite against both deployed targets, not only local fixtures or Fly smoke checks.
- Prove an Oxygen production-environment deployment from a test branch before cutover.
- Verify all consuming environment values on both targets as features land. Keep Admin and session credentials server-only.
- After cutover, restrict both deployment workflows to `main` and protect production credentials/approvals with GitHub environments.

## Port completion standard

For each remaining surface:

- Handle Storefront/Admin failures, malformed merchant content, aborts, and retry-safe behavior.
- Keep personalized HTML and cart responses `private, no-store`; do not place customer data in shared caches or logs.
- Preserve keyboard access, focus visibility, reduced motion, and server-rendered essential controls.
- Use controlled rich-text/HTML rendering and same-origin redirect validation.
- Add the highest-value unit/browser coverage plus deployed acceptance coverage; skipped tests remain disallowed.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build:oxygen`.

## Cutover gate

Do not merge `v3` into `main` until:

- every remaining feature row is complete and the locale/session decisions are resolved;
- the same commit passes CI and deployed acceptance tests on Oxygen and Fly;
- SEO checks and live analytics verification pass;
- a real purchase, cart permalink, and discount flow complete on staging/preview, with the purchase refunded;
- production environment values are verified against `.env.example`; and
- Lighthouse/Core Web Vitals are reviewed against production.

## Cutover and rollback

1. Freeze non-security feature work on `main` and merge its final deltas into `v3`.
2. Deploy the final `v3` commit to Oxygen and Fly staging; run the complete gate.
3. Merge `v3` into `main` and immediately rerun deployed acceptance and SEO checks.
4. Monitor for 48 hours: runtime logs, Shopify analytics event volume, Search Console coverage, and conversion funnel.
5. If needed, revert the merge commit on `main`. Keep the old lockfile/toolchain viable until monitoring ends.
6. Restrict deployment workflows to `main`; decide whether Fly remains a production or secondary target.

## Live risks

| Risk | Mitigation |
| --- | --- |
| Remix/Hydrogen prerelease breakage or unavailable snapshot | Exact versions and lockfile; upgrade only with the full suite; coordinate a durable Hydrogen preview channel before cutover. |
| Vendored Oxygen adapter breaks on source/layout changes | Document it; require Oxygen production builds and deployed acceptance tests for adapter changes; replace with the official adapter when available. |
| SEO or real-money regressions | Explicit deployed SEO, redirect, permalink, discount, checkout, refund, and post-cutover monitoring gates. |
| Admin API leaks PII or permits abuse | Server-only token, strict validation, rate limiting, consent handling, redacted logs, and focused security tests. |
| Oxygen/Fly drift | Deploy the same commit and run the same acceptance cases against both targets. |

After the monitoring window, archive `remix-3-hydrogen` (or clearly mark it as a scratchpad), assign an owner for prerelease upgrades, replace the vendored adapter when an official one exists, and restore nightly production acceptance runs.
