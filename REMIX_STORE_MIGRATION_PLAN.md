# Remix Store v3 migration

Goal: replace the React Router 7 storefront on `main` with the Remix 3 + framework-neutral Hydrogen app on `v3`, then run the same application on Oxygen and Fly.

[`REMIX_STORE_PARITY_PLAN.md`](./REMIX_STORE_PARITY_PLAN.md) remains the design and behavior reference. The official RR7 app is the behavioral spec; [`~/code/remix-3-hydrogen`](../remix-3-hydrogen) is an implementation reference, not trusted source code.

## Current position

- `main` remains the production RR7 storefront.
- `v3` has the Remix 3 platform, native Node/Remix Assets runtime, Oxygen runtime, and continuous Fly/Oxygen deployment foundations.
- Feature ports complete on `v3`: shared primitives and assets, Storefront data, shell, home, collections/load-more, product details/variants, cart, consent-aware analytics, Shopify-backed policies/contact, SEO resources/metadata, and Shopify compatibility redirects/permalinks/discounts.
- Browser-reachable modules use colocated `app/**/public/**` directories; shared application code remains runtime-neutral.
- Node has a bounded in-memory Storefront cache. Fly has Docker, health checks, graceful shutdown, immutable asset IDs, and deployment smoke checks.
- Shopify requests use a server-only private Storefront token; target-specific adapters resolve trusted Oxygen/Fly buyer IPs. `PUBLIC_CHECKOUT_DOMAIN` is retired; checkout uses `cart.checkoutUrl`.
- The remaining feature work starts with the store-wide sale; the platform and completed feature history do not need further migration planning.

## Fixed decisions

| Area | Decision |
| --- | --- |
| Scope | Full feature parity before cutover, including sale, subscribe/back-in-stock, and seasonal snow. Unused plumbing may be explicitly retired. |
| Porting | Port one surface at a time and harden it. Do not bulk-import the experimental app. |
| Branches | `v3` is long-lived. Oxygen and Fly deploy the same branch contents; no target-specific application branches. |
| Cutover | Merge `v3` into `main`; rollback by reverting that merge commit. Do not rebase the long-lived branch before cutover. |
| Dependencies | Remix 3 beta and Hydrogen preview are accepted risks. Keep exact versions and gate upgrades on the full suite. |
| Locales/Markets | Preserve English US/Canada market context without promising translations: unprefixed URLs use EN-US; `/en-ca` uses English/Canada and `@inContext`; `/en-us` redirects to unprefixed; `/fr-ca` redirects to `/en-ca`; sitemap alternates include only `en-US` and `en-CA`. |
| Oxygen adapter | Keep `vite/remix-oxygen.ts` vendored until an official adapter replaces it. |

## Remaining feature work

Complete in dependency order unless surfaces are independent. Every feature PR compares the official RR7 behavior and parity plan, adds focused tests, preserves no-JavaScript behavior, and validates both production builds.

| # | Work | Completion criteria |
| ---: | --- | --- |
| 2.13 | Store-wide sale | Port the active-sale metaobject query and reduced-motion marquee; use the sale title for automatic-discount labels. |
| 2.14 | Subscribe and back-in-stock | Build the Admin API boundary, newsletter route, and sold-out variant form with validation, rate limiting, consent handling, server-only credentials, and no PII logging. |
| 2.15 | Locales/Markets | Implement the fixed English US/Canada decision: preserve paths and query strings across redirects, carry market context through internal navigation, use `@inContext`, and emit only accurate `en-US`/`en-CA` sitemap alternates. Unsupported locale prefixes must not create duplicate or mislabeled localized pages. |
| 2.16 | Seasonal snow | Port the December-only canvas effect with reduced-motion and static fallbacks. |
| 2.17 | Sessions | Determine whether any remaining feature requires durable session state. Implement a signed `SESSION_SECRET` boundary or remove the unused variable and document its retirement. |

## Remaining deployment work

- Verify the hosted privacy banner and consent-denied destination gating from a protected region, then confirm page, product, collection, cart-view, and cart-delta events in Shopify Admin from Fly and Oxygen previews.
- Document `vite/remix-oxygen.ts` in `vite/README.md`: build order, `clientEntry()` transform, manifest inlining, hydration-export validation, and replacement intent.
- Define Node `waitUntil` behavior before analytics or another feature relies on background work; rejected tasks must be observed.
- Run the portable acceptance suite against both deployed targets, not only local fixtures or Fly smoke checks.
- Verify canonical, indexing, social metadata, `robots.txt`, and sitemap resources against each deployed origin; deterministic request-origin coverage is complete, but live SEO verification remains a cutover gate.
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

- every remaining feature row is complete and the session decision is resolved;
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
