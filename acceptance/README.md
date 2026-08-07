# Acceptance Test Suite

Framework-agnostic end-to-end tests for the Remix Store. These tests validate core user flows and storefront behavior without asserting on implementation details (framework markers, class names, etc.).

## Purpose

This suite serves as the behavioral specification for the storefront. Tests:

- ✅ Run against any deployment (local, staging, production)
- ✅ Use behavioral assertions (what users see, not how it's built)
- ✅ Include no-JavaScript scenarios for progressive enhancement
- ✅ Cover critical flows without submitting real transactions
- ✅ Serve as the acceptance gate for framework migrations

## Running Tests

### Against Production (Default)

```bash
pnpm test:acceptance
```

Runs against `https://shop.remix.run` by default.

### Against Local Development

```bash
BASE_URL=http://localhost:3000 pnpm test:acceptance
```

### Against Staging or Preview

```bash
BASE_URL=https://preview-xyz.trycloudflare.com pnpm test:acceptance
```

### Interactive Mode

```bash
pnpm test:acceptance:ui
```

### Debug Mode

```bash
pnpm test:acceptance:debug
```

## Test Coverage

### Core Flows

- **Home** (`home.spec.ts`): Hero, lookbook, navigation
- **Collections** (`collections.spec.ts`): Product grid, load more, filtering
- **Product** (`product.spec.ts`): Variant selection, images, add to cart
- **Cart** (`cart.spec.ts`): Add, update quantity, remove, discount codes
- **Policies** (`policies.spec.ts`): Privacy, refund, terms, shipping pages
- **SEO** (`seo.spec.ts`): robots.txt, sitemap.xml, meta tags
- **Errors** (`errors.spec.ts`): 404 pages, error handling

### No-JavaScript (`nojs.nojs.spec.ts`)

Tests that essential functionality works without JavaScript:

- Navigation between pages
- Product browsing
- Policy access
- SEO asset delivery

Runs in a separate project with `javaScriptEnabled: false`.

## Safety

These tests **do not**:

- ❌ Submit checkout or payment forms
- ❌ Create real orders
- ❌ Create customer accounts or subscriptions
- ❌ Mutate inventory or product data

Cart operations are safe—they add/remove items in session state only.

### In-Stock Product Discovery

Cart tests use deterministic in-stock product discovery: they check up to 10 products from the collection to find one that's in stock. If no in-stock products are found, tests skip with an explicit message rather than silently failing. This ensures:

- Tests don't hide failures in dynamic skips
- Clear reporting when product availability affects test coverage
- Resilience to inventory changes in production

## Behavioral Assertions

Tests use **semantic queries** based on what users see:

- ✅ `page.getByRole('button', { name: /add to cart/i })`
- ✅ `page.getByText(/\$\d+/)`
- ✅ `expect(page).toHaveURL(/\/products\//)`
- ✅ `page.waitForLoadState('networkidle')` instead of arbitrary timeouts

Avoid framework-specific selectors and brittle patterns:

- ❌ `.class-name` or `[class*="..."]`
- ❌ `[data-remix-...]`
- ❌ `#react-root`
- ❌ `page.waitForTimeout(1000)` (use proper Playwright waiting)
- ❌ Hidden dynamic skips with `test.skip()` (use explicit skip messages)

This ensures tests pass on both the current React Router 7 implementation and the future Remix 3 port.

### No-JS Form Validation

No-JavaScript tests verify **functional behavior**, not just presence:

- Forms have proper `action` attributes for server-side submission
- Buttons are within forms for no-JS functionality
- Navigation works via standard links without JavaScript

This validates true progressive enhancement, not just rendering.

## CI Integration

The suite runs:

1. **Nightly** against production (`https://shop.remix.run`)
2. **On PR** when acceptance tests are modified
3. **On demand** via workflow dispatch with custom BASE_URL

See `.github/workflows/acceptance-tests.yml` for details.

## Debugging

If a test fails against production:

1. Run locally in debug mode to inspect: `pnpm test:acceptance:debug`
2. Check if the behavior changed intentionally (feature update)
3. If the test is now invalid, update it and document the change
4. If production has a regression, file an issue

## Adding Tests

When adding a new test:

1. Use behavioral assertions (no framework markers)
2. Test real user flows, not implementation details
3. Keep tests safe (no real transactions)
4. Add to the appropriate spec file or create a new one
5. Run against production to verify: `pnpm test:acceptance`

## Configuration

See `playwright.config.ts` for:

- BASE_URL override
- Timeout settings
- Browser configuration
- No-JS project settings
