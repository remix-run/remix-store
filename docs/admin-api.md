# Shopify Admin subscription contract

| Contract            | Pinned value                                                          |
| ------------------- | --------------------------------------------------------------------- |
| API version         | `2026-07` stable                                                      |
| Verified            | 2026-08-13 through `publicApiVersions`; response header was `2026-07` |
| Schema              | `admin-2026-07.schema.json`                                           |
| Required scopes     | `read_customers`, `write_customers`                                   |
| Additional approval | Shopify protected customer data                                       |

`pnpm typecheck` runs `scripts/check-admin-graphql.mjs`. It parses the four Admin documents in `app/data/admin.server.ts`, checks the exact expected operation set, and validates each document against the pinned Admin schema. This is separate from Hydrogen's Storefront/Customer Account `gql.tada` setup, so Admin types cannot contaminate Storefront `gql()` validation.

The validated operations are `RemixCustomerByEmail`, `RemixCustomerCreate`, `RemixCustomerTagsAdd`, and `RemixCustomerConsentUpdate`. Runtime tests additionally verify endpoint, headers, variables, safe response handling, and no customer data in errors.

## Abuse protection

The app enforces an atomic, bounded fixed-window quota per trusted buyer IP and one-way email digest. That limiter is local to each Fly process or Oxygen isolate so the application remains runtime-neutral. **Before enabling `ADMIN_ACCESS_TOKEN` in production, configure and verify a shared edge/WAF quota for `POST /subscribe` on both deployed origins.** The app also supports injecting a shared transactional `RateLimiter` if storage is standardized later.

**Remaining live check:** before deployment, confirm the target store returns `X-Shopify-API-Version: 2026-07` and that the app installation still has both scopes and protected-customer-data approval. Keep this read-only/version check separate from deterministic CI; do not run customer mutations against production as validation.
