import { createShopifyRouteTemplates } from "@shopify/hydrogen";

// Product and collection pages use Shopify's standard paths. Collection-scoped
// product URLs canonicalize to the app's single product-detail route. This same
// manifest is shared by browser-side Shopify scripts and server redirects.
export const routeTemplates = createShopifyRouteTemplates({
  productInCollection: "/products/:productHandle",
});
