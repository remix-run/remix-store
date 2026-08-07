# Environment Variable Contract

**Version:** Phase 0.5 – 2025-01-30

This document defines the complete environment variable contract for the Remix Store migration from React Router 7 + Hydrogen 2026.4.4 to Remix 3 + framework-neutral Hydrogen preview.

**Purpose:** Establish the final, unified environment variable contract that both deployment targets (Oxygen and Fly) will use post-migration, with explicit migration mapping from current variables.

---

## Migration Mapping

| Current (RR7 + Hydrogen) | Migrated (Remix 3 + Hydrogen) | Change Reason |
|---|---|---|
| `PUBLIC_STOREFRONT_API_TOKEN` | `PRIVATE_STOREFRONT_API_TOKEN` | **Rename for correctness**: Storefront API tokens must be server-only despite "public" in Shopify's naming convention. New name reflects actual security requirement. |
| `PUBLIC_STOREFRONT_ID` | `PUBLIC_STOREFRONT_ID` | ✓ No change |
| `PUBLIC_STORE_DOMAIN` | `PUBLIC_STORE_DOMAIN` | ✓ No change |
| `PUBLIC_CHECKOUT_DOMAIN` | `PUBLIC_CHECKOUT_DOMAIN` | ✓ No change (remains optional) |
| `SESSION_SECRET` | `SESSION_SECRET` | ✓ No change (server-only) |
| — | `SHOP_ID` | **New (optional)**: For Shopify checkout path in robots.txt |
| — | `PUBLIC_SHOPIFY_INBOX_ENABLED` | **New (optional)**: Enables Shopify Inbox widget (Tier 3 feature, not Phase 2 scope) |
| — | `ADMIN_ACCESS_TOKEN` | **New (Phase 2.14)**: Required for subscribe/back-in-stock Admin API calls (server-only) |

---

## Final Contract

### Required Variables

#### `PUBLIC_STORE_DOMAIN`

**Purpose:** Shopify store domain for Storefront API requests

**Type:** String (domain without protocol)

**Example:** `example.myshopify.com`

**Public/Private:** Public (safe to expose client-side)

**Required by:** Storefront API client, SEO meta tags, analytics

**Configuration:**
- **Local dev:** `.env` file
- **Oxygen:** Environment variables in Shopify admin (storefront settings)
- **Fly:** `fly secrets set PUBLIC_STORE_DOMAIN=...`

**Validation:** Must be a valid Shopify domain (ends with `.myshopify.com` or custom domain)

**Evidence:**
- Official: `app/middleware/storefront.ts` L32
- Experimental: `app/data/storefront.server.ts` L20

---

#### `PRIVATE_STOREFRONT_API_TOKEN`

**Purpose:** Storefront API access token for GraphQL queries

**Type:** String (Shopify Storefront API token)

**Public/Private:** **Private (server-only)**

**Security:** Despite Shopify's "public Storefront API" terminology, tokens must never be exposed client-side. They enable:
- Unrestricted query execution (rate limits apply)
- Access to unpublished products/collections during development
- Potential abuse if exposed

**Required by:** Storefront API client (`createStorefrontClient`)

**Configuration:**
- **Local dev:** `.env` file (never commit)
- **Oxygen:** Secure environment variables in Shopify admin
- **Fly:** `fly secrets set PRIVATE_STOREFRONT_API_TOKEN=...`

**Migration note:** Renamed from `PUBLIC_STOREFRONT_API_TOKEN` (current) to correct misleading public/private classification.

**Evidence:**
- Official: `app/middleware/storefront.ts` L33 (as `PUBLIC_STOREFRONT_API_TOKEN`)
- Experimental: `app/data/storefront.server.ts` L23 (as `PRIVATE_STOREFRONT_API_TOKEN`)

---

#### `PUBLIC_STOREFRONT_ID`

**Purpose:** Shopify storefront ID for analytics tracking

**Type:** String (numeric storefront ID)

**Example:** `1000020043`

**Public/Private:** Public (required client-side for Shopify Analytics)

**Required by:** `@shopify/hydrogen` analytics (`getShopAnalytics`)

**Default:** `'0'` if not set (experimental implementation); required in official implementation

**Configuration:**
- **Local dev:** `.env` file
- **Oxygen:** Environment variables in Shopify admin
- **Fly:** `fly secrets set PUBLIC_STOREFRONT_ID=...` (not actually secret, but centralized config)

**Evidence:**
- Official: `app/root.tsx` L109 (loader)
- Experimental: `app/data/storefront.server.ts` L30

---

#### `SESSION_SECRET`

**Purpose:** Secret key(s) for cookie session storage encryption

**Type:** String or array of strings (for key rotation)

**Example:** `s3cr3tk3y` (production: long random string)

**Public/Private:** **Private (server-only)**

**Security:** Used to sign and encrypt session cookies. Compromise allows:
- Session hijacking
- Cart takeover
- Forged authentication state (if customer accounts added)

**Required by:** `createCookieSessionStorage` (React Router session)

**Configuration:**
- **Local dev:** `.env` file (can use placeholder value)
- **Oxygen:** Secure environment variables in Shopify admin
- **Fly:** `fly secrets set SESSION_SECRET=...`

**Key rotation:** React Router's `createCookieSessionStorage` accepts an array of secrets; first is used for signing, rest for validation (allows rotation without invalidating existing sessions).

**Evidence:**
- Official: `app/lib/context.ts` L12, `app/lib/session.ts` L19
- Experimental: Phase 2.17 audit task (currently unclear usage)

---

### Optional Variables

#### `PUBLIC_CHECKOUT_DOMAIN`

**Purpose:** Custom checkout domain (e.g., `checkout.remix.run`) for checkout redirects

**Type:** String (domain without protocol)

**Example:** `checkout.remix.run`

**Public/Private:** Public (used in consent/analytics config)

**Default:** Falls back to shop's primary domain if not set

**Required by:** Checkout button redirects, Shopify Analytics consent configuration

**Configuration:**
- **Local dev:** `.env` file (optional)
- **Oxygen:** Environment variables in Shopify admin (if custom checkout domain configured)
- **Fly:** `fly secrets set PUBLIC_CHECKOUT_DOMAIN=...` (if needed)

**Evidence:**
- Official: `app/root.tsx` L117 (consent config)
- Experimental: Phase 2.11 verification task
- Docs: `SHOPIFY_CONTENT_MODEL_CONTRACT.md` L354

---

#### `SHOP_ID`

**Purpose:** Shopify shop ID for constructing checkout paths in robots.txt

**Type:** String (numeric shop ID)

**Example:** `12345678`

**Public/Private:** Public

**Default:** If not set, robots.txt omits the `/{shopId}/checkouts` disallow rule

**Required by:** `robots.txt` route to block shop-specific checkout URLs

**Configuration:**
- **Local dev:** `.env` file (optional)
- **Oxygen:** Environment variables
- **Fly:** `fly secrets set SHOP_ID=...` (optional)

**Evidence:**
- Official: `app/routes/pages/[robots.txt].tsx` L33, L73
- Experimental: `app/data/storefront.server.ts` L27

---

#### `PUBLIC_SHOPIFY_INBOX_ENABLED`

**Purpose:** Feature flag to enable/disable Shopify Inbox chat widget

**Type:** String (`"true"` | `undefined`)

**Example:** `true`

**Public/Private:** Public (feature flag)

**Default:** `false` (widget disabled if not set or set to any value except `"true"`)

**Required by:** Shopify Inbox widget conditional rendering

**Status:** **Not in Phase 2 scope** (Tier 3 backlog feature). Experimental repo has plumbing; official repo does not implement Shopify Inbox.

**Configuration:**
- **Local dev:** `.env` file (optional)
- **Oxygen:** Environment variables
- **Fly:** `fly secrets set PUBLIC_SHOPIFY_INBOX_ENABLED=true`

**Evidence:**
- Experimental: `app/data/storefront.server.ts` L33
- Migration plan: `SHOPIFY_CONTENT_MODEL_CONTRACT.md` L415

---

### Phase 2.14 Variables (Subscribe/Back-in-Stock)

#### `ADMIN_ACCESS_TOKEN`

**Purpose:** Shopify Admin API access token for customer creation, tagging, and email marketing consent (subscribe + back-in-stock forms)

**Type:** String (Shopify Admin API access token)

**Public/Private:** **Private (server-only, highest sensitivity)**

**Security:** Admin API tokens grant write access to store data. Must:
- Never be logged
- Never be exposed client-side
- Be scoped to minimum required permissions (customer read/write, email marketing)
- Include request rate limiting to prevent abuse
- Avoid logging customer PII in error paths

**Required by:** Phase 2.14 implementation (subscribe route, back-in-stock form)

**Scopes required:**
- `write_customers` (create/update customer records)
- `read_customers` (check existing customers)

**Configuration:**
- **Local dev:** `.env` file (never commit; use development store token)
- **Oxygen:** Secure environment variables in Shopify admin
- **Fly:** `fly secrets set ADMIN_ACCESS_TOKEN=...`

**Not yet configured:** This variable will be added in Phase 2.14. Included in this contract for completeness.

**Evidence:**
- Migration plan: Phase 2.14, L184
- Parity plan: `REMIX_STORE_PARITY_PLAN.md` L276

---

## Variable Classification Summary

| Variable | Public/Private | Required/Optional | Phase | Configure Where |
|---|---|---|---|---|
| `PUBLIC_STORE_DOMAIN` | Public | Required | Now | Oxygen env, Fly secrets, `.env` |
| `PRIVATE_STOREFRONT_API_TOKEN` | Private | Required | Now | Oxygen secure env, Fly secrets, `.env` |
| `PUBLIC_STOREFRONT_ID` | Public | Required | Now | Oxygen env, Fly secrets, `.env` |
| `SESSION_SECRET` | Private | Required | Now | Oxygen secure env, Fly secrets, `.env` |
| `PUBLIC_CHECKOUT_DOMAIN` | Public | Optional | Now | Oxygen env, Fly secrets, `.env` |
| `SHOP_ID` | Public | Optional | Now | Oxygen env, Fly secrets, `.env` |
| `PUBLIC_SHOPIFY_INBOX_ENABLED` | Public | Optional | Not Phase 2 | Oxygen env, Fly secrets, `.env` |
| `ADMIN_ACCESS_TOKEN` | Private | Required (2.14) | Phase 2.14 | Oxygen secure env, Fly secrets, `.env` |

---

## Oxygen vs. Fly Configuration

### Oxygen (Cloudflare Workers runtime)

**Environment access:** Via `env` parameter in fetch handler (`server.ts` L11)

**Configuration location:** Shopify admin → Hydrogen storefront settings → Environment variables

**Secure variables:**
- `PRIVATE_STOREFRONT_API_TOKEN`
- `SESSION_SECRET`
- `ADMIN_ACCESS_TOKEN` (Phase 2.14)

**Public variables:** All others (still configured via Oxygen env vars, not hardcoded)

**Runtime behavior:**
- `app/runtime.ts` detects Worker runtime via `workerEnv` presence
- Cache API available (`caches.open('hydrogen')`)
- `waitUntil` available via execution context

---

### Fly (Node.js runtime)

**Environment access:** Via `process.env` (fallback in `app/runtime.ts` L27)

**Configuration location:** `fly secrets set KEY=value` for all variables

**Secure variables:** Same as Oxygen (Fly encrypts all secrets)

**Runtime behavior:**
- `app/runtime.ts` falls back to `process.env` when `workerEnv` undefined
- No native Cache API → Phase 3.2 implements in-memory TTL cache adapter
- `waitUntil` fallback: `void promise` (background tasks fire-and-forget)

---

## Local Development

**`.env` file:**

```bash
# Required
PUBLIC_STORE_DOMAIN=example.myshopify.com
PRIVATE_STOREFRONT_API_TOKEN=your-storefront-token
PUBLIC_STOREFRONT_ID=1000020043
SESSION_SECRET=local-dev-secret

# Optional
PUBLIC_CHECKOUT_DOMAIN=checkout.example.com
SHOP_ID=12345678
PUBLIC_SHOPIFY_INBOX_ENABLED=true

# Phase 2.14 only
# ADMIN_ACCESS_TOKEN=your-admin-token
```

**Never commit `.env`** — it is git-ignored. `.env.example` contains placeholder values and documentation.

---

## Migration Checklist

Phase 1.1 (Platform skeleton):

- [x] Map environment variable contracts (this document)
- [x] Update `.env.example` with final contract + inline docs
- [ ] Rename `PUBLIC_STOREFRONT_API_TOKEN` → `PRIVATE_STOREFRONT_API_TOKEN` in codebase
- [ ] Update `app/runtime.ts` documentation with env var access patterns
- [ ] Configure Oxygen preview environment with new variable names
- [ ] Validate `SESSION_SECRET` usage in experimental stack (Phase 2.17 audit task)

Phase 2.14 (Subscribe/back-in-stock):

- [ ] Add `ADMIN_ACCESS_TOKEN` to secure environment configs
- [ ] Implement Admin API client with rate limiting
- [ ] Validate no PII logging in error paths

Phase 3.2 (Fly target):

- [ ] Configure all environment variables via `fly secrets set`
- [ ] Validate `process.env` fallback in `app/runtime.ts` works correctly
- [ ] Test cache adapter behavior without Cache API

Phase 4 (Cutover):

- [ ] Update production Oxygen environment with new variable names
- [ ] Rollback plan: keep old variable names as aliases during monitoring window
- [ ] Post-cutover: remove old variable name aliases after 48h monitoring

---

## Security Requirements

1. **Never expose private variables client-side:**
   - `PRIVATE_STOREFRONT_API_TOKEN`
   - `SESSION_SECRET`
   - `ADMIN_ACCESS_TOKEN`

2. **Never commit `.env` file** (git-ignored)

3. **Never log variable values** in error messages or observability (scrub them)

4. **Key rotation:**
   - `SESSION_SECRET`: Use array of secrets for rotation without session invalidation
   - `PRIVATE_STOREFRONT_API_TOKEN`: Rotate via Shopify admin; update all environments atomically
   - `ADMIN_ACCESS_TOKEN`: Rotate quarterly; coordinate with Phase 2.14 implementation

5. **Validate on startup:**
   - Required variables present
   - Domains valid format (no protocol, valid TLD)
   - Tokens non-empty (don't validate format — Shopify API will fail gracefully)

---

## Open Questions (to resolve before Phase 1.1)

1. **SESSION_SECRET experimental usage:** Phase 2.17 audit must confirm whether experimental stack uses session storage, and if so, how. Current status: "Unclear" per migration plan L83.

   **Resolution path:** Audit experimental `app/` for `createCookieSessionStorage` or equivalent; if absent, document retirement; if present, validate compatibility with official implementation.

2. **PUBLIC_CHECKOUT_DOMAIN requirement level:** Currently marked optional with fallback. Verify whether production Oxygen deployment requires explicit value for `checkout.remix.run` or if it auto-detects.

   **Resolution path:** Phase 2.11 verification task; check current Oxygen production config.

3. **SHOP_ID source:** Is this available via Storefront API query or must it be manually configured? If queryable, should it be runtime-fetched vs. env var?

   **Resolution path:** Check Shopify Storefront API `shop { id }` field; if available, consider removing env var in favor of runtime query (cached).

---

## References

- Migration plan: `REMIX_STORE_MIGRATION_PLAN.md` §Phase 0.5 (L120)
- Content model contract: `SHOPIFY_CONTENT_MODEL_CONTRACT.md` §Analytics & Tracking (L397)
- Official implementation: `app/lib/context.ts`, `app/lib/session.ts`, `app/middleware/storefront.ts`
- Experimental implementation: `app/runtime.ts`, `app/data/storefront.server.ts`
- Security: Parity plan §Subscribe (L276), Migration plan §Phase 2.14 (L184)
