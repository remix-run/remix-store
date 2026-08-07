# Phase 0.2: Production Behavior Snapshots

This directory contains captured production fixtures from shop.remix.run that serve as the behavioral contract baseline for the Hydrogen 3 + Remix 3 migration (Phase 0.2 of the migration plan).

## Purpose

These snapshots capture the SEO, HTTP, and redirect behavior of the current production site to ensure:

1. **Zero regression** during the platform migration
2. **Verifiable parity** at every step
3. **Searchable baseline** for contract questions

## What's Captured

The snapshot captures the following from `https://shop.remix.run` (or any arbitrary `BASE_URL`):

### SEO Artifacts

- **robots.txt**: Complete robots.txt content
- **Sitemap Index**: Main sitemap.xml structure
- **Per-Type Sitemaps**: All discovered sitemap pages (products, collections, pages, etc.)
  - URL inventory per type
  - lastmod, changefreq, priority metadata

### Route Metadata (Representative Routes)

For key route types, we capture:

- `<title>` tag
- Standard `<meta>` tags (description, keywords, etc.)
- Open Graph tags (`og:title`, `og:description`, `og:image`, etc.)
- Twitter Card tags (`twitter:card`, `twitter:title`, etc.)
- Canonical URL
- Alternate links (language/locale variants)

**Representative routes captured:**

- Home: `/`
- Collections index: `/collections`
- Sample product: `/products/remix-racing-jacket`
- Sample collection: `/collections/apparel`
- Cart: `/cart`
- Sample policy: `/policies/privacy-policy`
- 404 page: `/this-route-does-not-exist-404-test`

### Response Headers

HTTP response headers for:

- Home page
- Collections page
- Product page
- Cart page
- Static assets (favicon)

**Headers captured:**

- `cache-control`
- `content-type`
- `content-security-policy`
- `x-frame-options`
- `strict-transport-security`
- `x-content-type-options`
- `referrer-policy`
- `permissions-policy`
- `vary`
- `etag`
- `age`

### Redirect Inventory

Full redirect chains for:

- **Discount codes**: `/discount/:code` → cart with discount applied
- **Discount query params**: `?discount=` handling
- **Cart permalinks**: `/cart/:lines` → cart with pre-filled items
- **Checkout routes**: Shopify checkout domain redirects
- **Admin routes**: `/admin` → MyShopify admin
- **MyShopify domain rewrites**: Canonical domain enforcement
- **Locale redirects**: Behavior of locale-prefixed URLs (`/en-ca/`, `/fr-ca/`, etc.)

### Locale URL Inventory

- Discovered locale prefixes from sitemaps
- Full path inventory for locale-prefixed URLs
- Sitemap alternate URL mappings

## Usage

### Capture Production Snapshot

To capture (or update) the production baseline:

```bash
pnpm capture-snapshot
```

This will:

1. Fetch all fixtures from `https://shop.remix.run`
2. Save to `phase0-snapshots/production-snapshot.json`
3. Commit to version control

### Compare Against Baseline

To verify a deployment (staging, preview, or local dev) matches production:

```bash
# Compare staging
pnpm diff-snapshot --url https://staging.example.com

# Compare local dev
pnpm diff-snapshot --url http://localhost:5173

# Compare Oxygen preview
pnpm diff-snapshot --url https://preview-abc123.oxygen.shopifyapps.com
```

The diff will:

- Exit 0 if snapshots match (✅ clean)
- Exit 1 if differences found (⚠️ with detailed output)

### Capture from Arbitrary URL

To capture a snapshot from any URL (useful for debugging):

```bash
pnpm capture-snapshot --url https://staging.example.com
```

This overwrites the baseline, so only do this when intentionally updating the contract.

## CI Integration

The snapshot diff should run:

1. **Before cutover**: Against all preview deployments to ensure v3 branch maintains contract
2. **After cutover**: Nightly against production to catch drift
3. **In PRs**: When changes might affect SEO/redirects/metadata

Example CI workflow:

```yaml
- name: Verify production contract
  run: pnpm diff-snapshot --url ${{ env.PREVIEW_URL }}
```

## Files

- `production-snapshot.json`: The committed baseline fixture
- `README.md`: This file

## Notes

### Time-Sensitive Data

The snapshot intentionally:

- **Does NOT** diff specific meta content values that change frequently (e.g., og:image URLs with cache busters)
- **Does** diff the presence/structure of meta tags
- **Does** diff sitemap entry counts (allows for product inventory changes)
- **Does** diff exact robots.txt content

This balances contract verification with practical operational changes (adding/removing products is expected; changing the robots.txt policy is not).

### Safe Redirects Only

Redirect testing avoids:

- Real checkout flows that could create draft orders
- Discount codes that might have side effects
- Any mutations that touch customer data or inventory

We test redirect mechanics only, using test codes that are expected to fail gracefully.

### Locale Inventory

The snapshot captures the current locale URL structure to inform the locale disposition decision (see migration plan Phase 0.3). This includes:

- Which locale prefixes appear in sitemaps
- Whether they redirect or serve content
- Sitemap alternate link structure

## Related

- **Migration Plan Phase 0.2**: [REMIX_STORE_MIGRATION_PLAN.md](../REMIX_STORE_MIGRATION_PLAN.md#02-production-behavior-snapshot-seocontract-fixtures)
- **Gap Audit (Phase 0.3)**: Will use this snapshot to verify locale behavior
- **Acceptance Suite (Phase 0.1)**: Playwright e2e suite (separate, framework-agnostic behavioral tests)
- **Script**: `scripts/capture-production-snapshot.ts`
