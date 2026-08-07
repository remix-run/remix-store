# Phase 0.1: Framework-Agnostic Acceptance Suite

This document describes the acceptance test suite implementation for the Remix Store migration plan Phase 0.1.

## Overview

The acceptance suite is a **framework-agnostic** Playwright test suite that validates core storefront behavior without asserting on implementation details (CSS classes, framework markers, etc.). It serves as the behavioral contract that must pass on both the current React Router 7 stack and the future Remix 3 implementation.

## Implementation

### Test Coverage

✅ **Home Page** (`acceptance/home.spec.ts`)

- Hero section visibility
- Lookbook/product showcase
- Navigation to products
- Header branding and navigation
- Footer policy links

✅ **Collections & Product Grid** (`acceptance/collections.spec.ts`)

- Collection page display
- Product grid rendering
- Product cards with images and titles
- Navigation to product details
- Load more functionality

✅ **Product Pages** (`acceptance/product.spec.ts`)

- Product information display
- Variant selection (size, color, etc.)
- Add to cart functionality
- Product gallery
- Product description

✅ **Cart Functionality** (`acceptance/cart.spec.ts`)

- Add to cart
- Cart drawer/modal appearance
- Cart page view
- Update item quantity
- Remove items
- Discount code application
- Subtotal display

✅ **Policy Pages** (`acceptance/policies.spec.ts`)

- Privacy Policy
- Refund Policy
- Terms of Service
- Shipping Policy
- Footer navigation to policies

✅ **SEO Assets** (`acceptance/seo.spec.ts`)

- robots.txt accessibility and format
- sitemap.xml accessibility and format
- Home page meta tags (title, description, OG)
- Product page meta tags

✅ **Error Pages** (`acceptance/errors.spec.ts`)

- 404 for non-existent routes
- 404 for non-existent products
- 404 for non-existent collections
- Error page navigation
- Error page accessibility

✅ **No-JavaScript Scenarios** (`acceptance/nojs.nojs.spec.ts`)

- Home page loads without JS
- Navigation works without JS
- Collection browsing without JS
- Product pages load without JS
- Add to cart form exists without JS
- Policy pages load without JS
- Footer links work without JS
- SEO assets accessible without JS

### Configuration

**Playwright Config** (`playwright.config.ts`)

- Configurable via `BASE_URL` environment variable
- Default target: `https://shop.remix.run` (production)
- Two projects:
  - `chromium`: Full JavaScript tests
  - `chromium-no-js`: Progressive enhancement tests with `javaScriptEnabled: false`

### Behavioral Assertions

The suite uses **semantic, user-facing queries** only:

✅ Good (behavioral):

```typescript
page.getByRole("button", { name: /add to cart/i });
page.getByText(/\$\d+/);
expect(page).toHaveURL(/\/products\//);
```

❌ Avoid (implementation-specific):

```typescript
page.locator(".btn-add-to-cart");
page.locator("[data-remix-...]");
page.locator("#react-root");
```

This ensures tests pass regardless of the underlying framework.

### Safety Guarantees

The suite **does not**:

- ❌ Submit checkout forms
- ❌ Create real orders or charges
- ❌ Create customer accounts
- ❌ Create subscriptions
- ❌ Mutate inventory or product data

Cart operations only modify session state (safe to run against production).

## Running Tests

### Against Production (Default)

```bash
pnpm test:acceptance
```

### Against Local Development

```bash
BASE_URL=http://localhost:3000 pnpm test:acceptance
```

### Against Preview Environment

```bash
BASE_URL=https://preview-abc.oxygen.shop pnpm test:acceptance
```

### Interactive Mode

```bash
pnpm test:acceptance:ui
```

### Debug Mode

```bash
pnpm test:acceptance:debug
```

## CI Integration

**Nightly Production Validation** (`.github/workflows/acceptance-tests.yml`)

- Runs daily at 6 AM UTC against `https://shop.remix.run`
- Ensures production behavior matches the spec
- Uploads test reports and screenshots on failure
- Can be triggered manually with custom `BASE_URL`

**PR Validation**

- Runs when acceptance tests are modified
- Prevents test suite regressions

## Phase 0.1 Acceptance Criteria

Per the migration plan:

- ✅ Playwright e2e suite runs against any origin via `BASE_URL`
- ✅ Covers parity plan verification matrix:
  - ✅ Home hero/lookbook
  - ✅ Product grid + load more
  - ✅ Collection pages
  - ✅ Product page variant selection
  - ✅ Add-to-cart
  - ✅ Cart drawer + full page
  - ✅ Quantity/remove
  - ✅ Discount code
  - ✅ Policies
  - ✅ 404/500
  - ✅ robots/sitemap
  - ✅ No-JS form fallbacks (`javaScriptEnabled: false`)
- ✅ No implementation details (class names, framework markers)
- ✅ CI job runs against production nightly
- ✅ Suite green against current production
- ✅ Safe tests (no checkout/payment/subscriptions)
- ✅ Docs and scripts provided

## Usage in Migration

This suite serves as the **cutover gate** for Phase 4:

1. **Phase 1 & 2**: As features port to Remix 3, run this suite against each preview deploy
2. **Phase 3**: Ensure both Oxygen and Fly targets pass
3. **Phase 4 Gate**: Suite must be **100% green** on the `v3` branch before merge to `main`
4. **Post-Cutover**: Nightly runs catch production drift

If the suite fails on the new implementation, it's a **blocker**—the behavior contract must be preserved.

## Adding Tests

When adding new tests:

1. Use behavioral assertions (semantic queries)
2. Test real user flows, not implementation
3. Keep tests safe (no real transactions)
4. Run against production to verify
5. Update this document if coverage changes

## Maintenance

If production behavior legitimately changes:

1. Update the test to match new behavior
2. Document the change in PR description
3. Update behavioral spec if needed
4. Re-verify suite is green

## Files

- `playwright.config.ts` - Playwright configuration
- `acceptance/` - Test files
  - `home.spec.ts`
  - `collections.spec.ts`
  - `product.spec.ts`
  - `cart.spec.ts`
  - `policies.spec.ts`
  - `seo.spec.ts`
  - `errors.spec.ts`
  - `nojs.nojs.spec.ts`
  - `README.md` - Usage guide
- `.github/workflows/acceptance-tests.yml` - CI workflow
- `ACCEPTANCE_SUITE.md` - This document

## Next Steps (Future Phases)

- **Phase 1.2**: Run suite against `v3` preview deploys in CI
- **Phase 2**: Add test cases as features port
- **Phase 4**: Use as cutover gate (must be 100% green)
- **Post-Cutover**: Maintain as production regression detector
