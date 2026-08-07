# Shopify Content Model Contract

**Version:** Phase 0.4 – 2025-01-30

This document defines the complete Shopify-side content contract for the Remix Store. Both the current React Router 7 implementation and the planned Remix 3 migration must satisfy this contract.

**Critical:** All queries assume an active Shopify storefront with proper permissions. Missing content triggers 404/500 responses unless noted otherwise.

---

## Metaobject Definitions

### Hero (`hero` type)

**Handle:** `remix-3-drop-playground`

| Field | Type | Required | Consumers | Evidence |
|---|---|---|---|---|
| `asset_images` | List reference → `MediaImage` | Yes | Home page hero animation | `app/lib/data/hero.server.ts` (official)<br>`app/data/storefront.server.ts` (experimental) |
| `collection` | Single reference → `Collection` | Yes | Hero CTA link target | Same |

**Data transformation:**
- Images resized to 1600×900 crop=center via URL params (official only)
- Experimental app uses raw image URLs

**Fallback:** Throws `Response("Hero data not found", {status: 404})` if missing or malformed

**GraphQL access:** `metaobject(handle: {handle: "remix-3-drop-playground", type: "hero"})`

**Discrepancies:**
- ✅ Both repos query identical structure
- ⚠️ Official applies URL transform; experimental does not (no visual impact)

---

### Lookbook (`lookbook` type)

**Handle:** `lookbook-remix-racing`

| Field | Type | Required | Consumers | Evidence |
|---|---|---|---|---|
| `lookbook` | List reference → `Metaobject` | Yes | Home page lookbook sections | `app/lib/data/lookbook.server.ts` (official)<br>`app/data/storefront.server.ts` (experimental) |

**Nested lookbook entry metaobject fields:**

| Field | Type | Required | Purpose | Notes |
|---|---|---|---|---|
| (image reference) | `MediaImage` | Yes | Section background | First field with `__typename: "MediaImage"` |
| (product reference) | `Product` | No | Optional product link | First field with `__typename: "Product"` |

**Data transformation:**
- Official: extracts focal point from `presentation.asJson` → `{x, y}` normalized 0–1
- Experimental: same

**Fallback:**
- Missing lookbook → throws 404
- Empty `entries` → returns `[]`, home page renders without lookbook panels
- Missing image in entry → throws 500
- Missing product → renders "Coming Soon" pill (experimental only; official requires product)

**GraphQL access:** `metaobject(handle: {handle: "lookbook-remix-racing", type: "lookbook"})`

**Discrepancies:**
- ⚠️ Official throws 500 on missing product in lookbook entry; experimental renders "Coming Soon" → **Port experimental graceful fallback** (Phase 2.4 task)

---

### Store-Wide Sale (`storewide_sale` metaobject, accessed via Shop metafield)

**Metafield namespace/key:** `custom.storewide_sale` on `Shop`

| Field | Type | Required | Purpose | Evidence |
|---|---|---|---|---|
| `title` | String | Yes | Sale marquee heading | `app/lib/data/header.server.ts` (official) |
| `description` | String | Yes | Sale marquee body text | Same |
| `end_date_and_time` | DateTime string | No | Sale expiry; hidden after end | Same |

**Validation:**
- Sale shown only if `end_date_and_time` is missing OR `Date.now() < new Date(endDateTime).getTime()`
- Returns `undefined` if expired or metafield reference missing

**Consumer:** Header marquee (desktop/mobile)

**Fallback:** Marquee hidden if metafield missing or sale expired

**GraphQL access:**
```graphql
shop {
  storeWideSale: metafield(namespace: "custom", key: "storewide_sale") {
    reference {
      ... on Metaobject {
        title: field(key: "title") { value }
        description: field(key: "description") { value }
        endDateTime: field(key: "end_date_and_time") { value }
      }
    }
  }
}
```

**Discrepancies:**
- ❌ **Experimental app does not implement store-wide sale** → Phase 2.13 build task

---

## Menus

### Main Navigation (`main-menu`)

**Handle:** `main-menu`

**Structure:** Flat list (no nested items used)

**Consumer:** Desktop navbar, mobile menu

**Fields used:**
- `id`, `title`, `url` (per `MenuItem`)

**Fallback:** Navbar renders empty if menu missing (no error thrown)

**GraphQL access:** `menu(handle: "main-menu")`

**Evidence:** `app/lib/data/header.server.ts`, `app/components/navbar.tsx`, `app/components/mobile-menu.tsx`

**Discrepancies:** ✅ Both repos use identical structure

---

### Footer Menu (`footer`)

**Handle:** `footer`

**Structure:** Flat list

**Consumer:** Footer links

**Fields used:**
- `id`, `title`, `url`

**Fallback:** Footer renders without menu links if missing

**GraphQL access:** `menu(handle: "footer")`

**Evidence:** `app/lib/fragments.ts` `FOOTER_QUERY`, `app/components/footer.tsx`

**Discrepancies:** ✅ Both repos use identical structure

---

### Product Sidebar Menu (`product-sidebar-menu`)

**Handle:** `product-sidebar-menu`

**Structure:** Flat list

**Consumer:** Product page sidebar navigation

**Fields used:**
- `title`, `url`

**Fallback:** Sidebar renders empty if menu missing

**GraphQL access:** `menu(handle: "product-sidebar-menu")`

**Evidence:** `app/lib/fragments.ts` `PRODUCT_SIDEBAR_MENU_QUERY`, `app/lib/data/product.server.ts`

**Discrepancies:** ✅ Both repos use identical structure

---

## Product Metafields

### `custom.description`

**Type:** String (rich text / HTML)

**Required:** No

**Consumer:** Product page description section

**Fallback:** Uses standard `product.description` if metafield missing

**GraphQL access:** `metafield(key: "description", namespace: "custom")`

**Evidence:** `app/lib/data/product.server.ts`

**Discrepancies:** ✅ Both repos query this field

---

### `custom.technical_description`

**Type:** String (rich text / HTML)

**Required:** No

**Consumer:** Product page technical details section

**Fallback:** Section hidden if metafield missing

**GraphQL access:** `metafield(key: "technical_description", namespace: "custom")`

**Evidence:** `app/lib/data/product.server.ts`

**Discrepancies:** ✅ Both repos query this field

---

### `custom.subscribe_if_back_in_stock`

**Type:** String (`"true"` | `"false"`)

**Required:** No

**Consumer:** Product page back-in-stock subscription form (when variant unavailable)

**Fallback:** Form hidden if metafield missing or not `"true"`

**GraphQL access:** `metafield(key: "subscribe_if_back_in_stock", namespace: "custom")`

**Evidence:** `app/lib/data/product.server.ts`

**Discrepancies:**
- ✅ Both repos query this field
- ⚠️ **Experimental app queries field but does not render form UI** → Phase 2.14 build task

---

## Pages

### Contact Page

**Handle:** `contact`

**Fields used:**
- `body`, `id`, `title`, `onlineStoreUrl`

**Consumer:** `/policies/contact-information` route (mapped from `contact-information` handle)

**Fallback:** Throws 404 if page missing

**GraphQL access:** `page(handle: "contact")`

**Evidence:** `app/lib/data/policy.server.ts` `CONTACT_PAGE_QUERY`

**Discrepancies:** ✅ Both repos query this page

---

## Shop Policies

All policies accessed via `shop.{policyKey}` where `policyKey` ∈ `{privacyPolicy, shippingPolicy, termsOfService, refundPolicy}`

**Fields used (per `ShopPolicy`):**
- `body`, `handle`, `id`, `title`, `url`

**Consumer:** `/policies/:handle` routes

**Mapping:** Kebab-case URL handle → camelCase policy key
- `privacy-policy` → `privacyPolicy`
- `shipping-policy` → `shippingPolicy`
- `terms-of-service` → `termsOfService`
- `refund-policy` → `refundPolicy`

**Fallback:** Throws 404 if policy missing

**GraphQL access:** Conditional inclusion via `@include(if: $policyKey)`

**Evidence:** `app/lib/data/policy.server.ts`

**Discrepancies:** ✅ Both repos query policies identically

---

## Collections

### Special Collection: `all`

**Handle:** `all`

**Required:** Yes (implicit Shopify collection containing all products)

**Consumers:**
- Home page product grid
- Collections index
- Hero CTA fallback

**Fallback:** N/A (Shopify built-in)

**Evidence:**
- `app/routes/pages/($locale).collections._index.tsx`
- `app/actions/home/page.tsx` (experimental)

**Discrepancies:** ✅ Both repos use `all` collection

---

### User Collections

**Access pattern:** By handle via `collection(handle: $handle)`

**Required fields:**
- `id`, `handle`, `title`, `description`, `seo.title`
- `products(...)` with pagination

**Consumer:** `/collections/:handle` route

**Fallback:** Throws 404 if collection missing

**Evidence:** `app/lib/data/collection.server.ts`

**Discrepancies:** ✅ Both repos query collections identically

---

## Cart & Checkout

### Free Shipping Threshold

**Value:** `$75.00 USD`

**Type:** Hardcoded constant (not from Shopify API)

**Consumer:** Cart drawer and full-page cart progress bar

**Evidence:** `app/components/cart.tsx` line 73: `threshold = 75`

**Discrepancies:**
- ⚠️ **Value is hardcoded, not configurable** → Consider moving to env var or metafield in future (not blocking)

---

### Checkout Domain

**Env var:** `PUBLIC_CHECKOUT_DOMAIN`

**Default:** Falls back to shop's primary domain if not set

**Consumer:** Checkout button redirect

**Evidence:** Phase 0.5 env mapping, `app/root.tsx` loader

**Discrepancies:** ✅ Both repos handle checkout URL

---

## Shop-Level Data

### Shop Identity

**Fields used:**
- `id`, `name`, `description`, `primaryDomain.url`
- `brand.logo.image.url` (optional)

**Consumer:**
- SEO meta tags
- Analytics
- Header branding

**Fallback:** Name/description default to empty string if missing

**GraphQL access:** `shop { ...Shop }`

**Evidence:** `app/lib/data/header.server.ts`

**Discrepancies:** ✅ Both repos query shop identity

---

## Analytics & Tracking

### Storefront ID

**Env var:** `PUBLIC_STOREFRONT_ID`

**Required:** Yes

**Consumer:** Shopify analytics via `@shopify/hydrogen`

**Evidence:** Phase 0.5 env mapping

**Discrepancies:** ✅ Both repos require this var

---

### Shopify Inbox

**Env var:** `PUBLIC_SHOPIFY_INBOX_ENABLED` (experimental only)

**Type:** `"true"` | `undefined`

**Consumer:** Inbox widget toggle

**Evidence:** `app/data/storefront.server.ts` (experimental)

**Discrepancies:**
- ❌ **Official repo does not implement Shopify Inbox** → Not in Phase 2 scope (Tier 3 backlog)

---

## Validation Summary

### Content Dependencies (Must Exist in Shopify Admin)

| Resource | Handle/Key | Missing Behavior | Port Status |
|---|---|---|---|
| Metaobject: `hero` | `remix-3-drop-playground` | 404 | ✅ Both |
| Metaobject: `lookbook` | `lookbook-remix-racing` | 404 | ✅ Both |
| Shop metafield: `custom.storewide_sale` | — | Hidden (graceful) | ❌ Official only |
| Menu: `main-menu` | `main-menu` | Empty navbar | ✅ Both |
| Menu: `footer` | `footer` | Empty footer | ✅ Both |
| Menu: `product-sidebar-menu` | `product-sidebar-menu` | Empty sidebar | ✅ Both |
| Page: `contact` | `contact` | 404 | ✅ Both |
| Policies | (4 types) | 404 per policy | ✅ Both |
| Collection: `all` | `all` | 404 | ✅ Both |

---

### Metafield Dependencies (Optional Fields)

| Metafield | Namespace/Key | Missing Behavior | Port Status |
|---|---|---|---|
| Product description | `custom.description` | Falls back to `product.description` | ✅ Both |
| Product tech specs | `custom.technical_description` | Section hidden | ✅ Both |
| Back-in-stock opt-in | `custom.subscribe_if_back_in_stock` | Form hidden | ⚠️ Queried (both), rendered (official only) |

---

## Migration Discrepancies

Issues requiring resolution in Phase 2:

| # | Discrepancy | Impact | Phase 2 Task |
|---|---|---|---|
| 1 | Store-wide sale not implemented in experimental | Missing feature | 2.13 |
| 2 | Back-in-stock form UI not rendered in experimental | Missing feature UI | 2.14 |
| 3 | Lookbook missing-product fallback differs | UX inconsistency | 2.4 |
| 4 | Hero image URL transform differs | No visual impact | 2.4 (decide) |
| 5 | Free shipping threshold hardcoded | Not configurable | Future (Tier 3) |
| 6 | Shopify Inbox not in official app | Missing feature | Backlog (Tier 3) |

---

## Verification Checklist

Before cutover (Phase 4 gate):

- [ ] All metaobjects exist in production Shopify admin
- [ ] All menus exist and have valid URLs
- [ ] Contact page exists
- [ ] All 4 policies exist
- [ ] `all` collection resolves
- [ ] Store-wide sale metafield structure validated (if active sale exists)
- [ ] Product metafields spot-checked on representative products
- [ ] Free shipping threshold value confirmed with merchandising team
- [ ] Checkout domain env var set correctly for production

---

## Notes

**Repository Evidence:**
- Official: `/Users/brookslybrand/code/remix-store` (React Router 7)
- Experimental: `/Users/brookslybrand/code/remix-3-hydrogen` (Remix 3)

**No Invented Claims:** All data sourced from direct code inspection as of 2025-01-30.

**Cache Strategies (Official):**
- Hero, lookbook, menus: `CacheLong()`
- Store-wide sale: `CacheLong()`
- Policies: `CacheLong()`
- Collections/products: per-query (varies)

**Experimental Cache:** Uses `Cache.long()` and `Cache.short()` from `@shopify/hydrogen`

**Encoding/Format:**
- Rich text fields (descriptions) rendered via controlled rich-text component (security: no raw `innerHTML`)
- Image URLs: HTTPS only, Shopify CDN
- DateTime: ISO 8601 strings

**Admin Access Required:** Validation steps require Shopify admin access to confirm metaobject/menu/page existence. Coordinate with store owner before cutover.
