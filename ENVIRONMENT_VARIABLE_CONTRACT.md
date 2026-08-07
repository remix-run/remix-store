# Environment Variable Contract

**Version:** Phase 0.5 – 2025-01-30

Defines the environment variable contract for migrating from React Router 7 + Hydrogen 2026.4.4 to Remix 3 + Hydrogen preview. Establishes deployment configuration for both Oxygen (Cloudflare Workers) and Fly (Node.js).

---

## Migration Mapping

| Current (RR7)                 | Final (Remix 3)                | Classification | Change                                                |
| ----------------------------- | ------------------------------ | -------------- | ----------------------------------------------------- |
| `PUBLIC_STOREFRONT_API_TOKEN` | `PUBLIC_STOREFRONT_API_TOKEN`  | Public         | **Preserved**: Used for client-side consent/analytics |
| —                             | `PRIVATE_STOREFRONT_API_TOKEN` | Private        | **New**: Server-only token for GraphQL queries        |
| `PUBLIC_STORE_DOMAIN`         | `PUBLIC_STORE_DOMAIN`          | Public         | No change                                             |
| `PUBLIC_STOREFRONT_ID`        | `PUBLIC_STOREFRONT_ID`         | Public         | No change                                             |
| `PUBLIC_CHECKOUT_DOMAIN`      | `PUBLIC_CHECKOUT_DOMAIN`       | Public         | No change (optional)                                  |
| `SESSION_SECRET`              | —                              | Private        | **Legacy**: Phase 2.17 audit required                 |
| —                             | `SHOP_ID`                      | Public         | **Optional**: robots.txt only (queryable via API)     |

**Key decision:** PUBLIC_STOREFRONT_API_TOKEN and PRIVATE_STOREFRONT_API_TOKEN are **distinct credentials** for different purposes (client consent vs server queries), not a rename. Both may be required depending on analytics implementation.

---

## Final Contract

### Required Variables

#### `PUBLIC_STORE_DOMAIN`

**Purpose:** Shopify store domain for API requests and CSP configuration

**Example:** `example.myshopify.com`

**Public/Private:** Public (safe client-side)

**Configuration:**

- **Oxygen:** Storefront environment variables
- **Fly:** `fly secrets set PUBLIC_STORE_DOMAIN=...`

**Evidence:**

- Current: `app/root.tsx` L110, `app/entry.server.tsx` L23
- Experimental: `app/data/storefront.server.ts` L17

---

#### `PRIVATE_STOREFRONT_API_TOKEN`

**Purpose:** Server-only Storefront API token for GraphQL queries

**Public/Private:** **Private (server-only)**

**Security:** Must never be exposed client-side. Enables:

- Server-side GraphQL queries via `createStorefrontClient({ type: 'private' })`
- Access to rate-limited query execution
- Metafields, navigation menus, and token-gated features

Per [Shopify docs](https://shopify.dev/docs/api/storefront/latest#authentication):

- **Private access**: "Used to query the API from a server or other private context, like a Hydrogen backend"
- Distinct from public token used for client-side operations

**Required by:** `createStorefrontClient` (private type)

**Configuration:**

- **Oxygen:** Secure environment variables
- **Fly:** `fly secrets set PRIVATE_STOREFRONT_API_TOKEN=...`

**Evidence:**

- Experimental: `app/data/storefront.server.ts` L23, `app/middleware/storefront.ts` L85
- Hydrogen docs: Both `publicStorefrontToken` and `privateStorefrontToken` shown

---

#### `PUBLIC_STOREFRONT_API_TOKEN`

**Purpose:** Client-safe Storefront API token for consent and analytics configuration

**Public/Private:** Public (intentionally client-usable)

**Current usage:** Passed to Shopify Analytics consent config (`root.tsx` L118: `consent.storefrontAccessToken`)

**Required by:** `@shopify/hydrogen` analytics consent (if used)

**Configuration:**

- **Oxygen:** Environment variables
- **Fly:** `fly secrets set PUBLIC_STOREFRONT_API_TOKEN=...`

**Migration decision:** Preserve if experimental analytics uses consent config; mark legacy/retired if analytics does not require it. Audit experimental `@shopify/hydrogen` analytics usage in Phase 1.1.

**Evidence:**

- Current: `app/root.tsx` L118 (consent config)
- Shopify docs: "Public access: Used to query the API from a browser or mobile app"

---

#### `PUBLIC_STOREFRONT_ID`

**Purpose:** Storefront ID for Shopify Analytics tracking

**Example:** `1000020043` (numeric string)

**Public/Private:** Public (required client-side)

**Configuration:**

- **Oxygen:** Environment variables
- **Fly:** `fly secrets set PUBLIC_STOREFRONT_ID=...`

**Default:** `'0'` in experimental if not set

**Evidence:**

- Current: `app/root.tsx` L113 (`getShopAnalytics`)
- Experimental: `app/data/storefront.server.ts` L30

---

### Optional Variables

#### `PUBLIC_CHECKOUT_DOMAIN`

**Purpose:** Custom checkout domain for CSP and consent configuration

**Example:** `checkout.remix.run`

**Public/Private:** Public

**Usage:** Content Security Policy (`entry.server.tsx` L31) and Shopify Analytics consent config (`root.tsx` L117)

**Not used for:** Checkout URL construction (Shopify generates checkout URLs)

**Default:** Falls back to shop's primary domain

**Configuration:**

- **Oxygen:** Environment variables (if custom checkout domain configured)
- **Fly:** `fly secrets set PUBLIC_CHECKOUT_DOMAIN=...`

**Evidence:**

- Current: `app/root.tsx` L117, `app/entry.server.tsx` L31
- Shopify Hydrogen docs: Used in consent/CSP config

---

#### `SHOP_ID`

**Purpose:** Shopify shop GID for robots.txt checkout path blocking

**Example:** `12345678` (parsed from `gid://shopify/Shop/12345678`)

**Public/Private:** Public

**Default:** Robots.txt omits `/{shopId}/checkouts` rule if not set

**Alternative:** Query `shop { id }` via Storefront API (current implementation in `app/routes/pages/[robots.txt].tsx` L6) and parse GID

**Configuration:**

- **Oxygen:** Environment variables (optional)
- **Fly:** `fly secrets set SHOP_ID=...` (optional)

**Evidence:**

- Current: `app/routes/pages/[robots.txt].tsx` L8 (queries `shop.id`, parses GID)
- Experimental: `app/data/storefront.server.ts` L27 (optional env fallback)

**Migration decision:** Keep queryable in Phase 1.1; consider env var fallback for robots.txt route only

---

### Legacy Variables (Phase 2.17 Audit Required)

#### `SESSION_SECRET`

**Purpose:** Secret key for signing cookie session storage (cart, discount codes)

**Public/Private:** **Private (server-only)**

**Current usage:**

- Signs session cookies via `createCookieSessionStorage` (`app/lib/session.ts` L20)
- Receives **one secret** (not comma-separated): `[env.SESSION_SECRET]` (`app/lib/context.ts` L18)
- Used for cart and discount code session storage

**Experimental usage:**

- No `SESSION_SECRET` found in experimental repo
- Uses unsigned Hydrogen cart cookies via `createCartCookie` (`app/data/cart.server.ts`)
- No `createCookieSessionStorage` implementation

**Migration decision:**

- Classify as **legacy/pending Phase 2.17**
- Not final-required (experimental does not use it)
- Phase 2.17 task: Audit session requirements and document migration path

**Security note:** Used for signing (not encryption) via React Router's `createCookieSessionStorage` which signs with `secrets` array (first active, rest for validation during rotation)

**Evidence:**

- Current: `app/lib/context.ts` L11-18, `app/lib/session.ts` L19-28
- Experimental: No usage found (grep confirms no SESSION_SECRET)

---

## Variable Summary

| Variable                       | Public/Private | Required    | Phase | Notes                                                 |
| ------------------------------ | -------------- | ----------- | ----- | ----------------------------------------------------- |
| `PUBLIC_STORE_DOMAIN`          | Public         | ✓           | Now   | Store domain                                          |
| `PRIVATE_STOREFRONT_API_TOKEN` | Private        | ✓           | Now   | Server queries                                        |
| `PUBLIC_STOREFRONT_API_TOKEN`  | Public         | Conditional | Now   | Consent config (if analytics uses it)                 |
| `PUBLIC_STOREFRONT_ID`         | Public         | ✓           | Now   | Analytics tracking                                    |
| `PUBLIC_CHECKOUT_DOMAIN`       | Public         | Optional    | Now   | CSP/consent config                                    |
| `SHOP_ID`                      | Public         | Optional    | Now   | robots.txt (queryable via API)                        |
| `SESSION_SECRET`               | Private        | Legacy      | 2.17  | Current only; experimental uses unsigned cart cookies |

---

## Oxygen vs. Fly Configuration

### Oxygen (Cloudflare Workers)

**Environment access:** Via `env` parameter in fetch handler

**Secure variables:**

- `PRIVATE_STOREFRONT_API_TOKEN`

**Public variables:** All others (still configured via env vars, not hardcoded)

**Runtime:**

- Detected via `workerEnv` presence (`app/runtime.ts`)
- Cache API: `caches.open('hydrogen')`
- `waitUntil`: Execution context

---

### Fly (Node.js)

**Environment access:** Via `process.env` (fallback in `app/runtime.ts` L27)

**Configuration:** `fly secrets set KEY=value` for all variables

**Runtime:**

- Falls back to `process.env` when `workerEnv` undefined
- No native Cache API → Phase 3.2 in-memory adapter
- `waitUntil`: Fire-and-forget (`void promise`)

---

## Security Requirements

1. **Never expose private variables client-side:** `PRIVATE_STOREFRONT_API_TOKEN`
2. **Never commit `.env` file** (git-ignored)
3. **Never log variable values** in errors/observability
4. **Token rotation:** Update Oxygen/Fly environments atomically

---

## Open Questions (Phase 1.1)

1. **PUBLIC_STOREFRONT_API_TOKEN requirement:** Audit experimental analytics consent usage. If analytics does not use `consent.storefrontAccessToken`, mark legacy/retired.

2. **SESSION_SECRET experimental equivalent:** Phase 2.17 must confirm cart session strategy (unsigned cookies vs signed sessions).

3. **SHOP_ID source:** Prefer runtime query (`shop { id }`) over env var? Current queries it; experimental env fallback.

4. **PUBLIC_CHECKOUT_DOMAIN requirement:** Verify Oxygen production config (auto-detected or explicit?).

---

## References

- Shopify Storefront API auth: https://shopify.dev/docs/api/storefront/latest#authentication
- Hydrogen docs: https://shopify.dev/docs/api/hydrogen/latest
- Current: `app/root.tsx`, `app/lib/context.ts`, `app/lib/session.ts`
- Experimental: `app/data/storefront.server.ts`, `app/middleware/storefront.ts`, `app/data/cart.server.ts`
