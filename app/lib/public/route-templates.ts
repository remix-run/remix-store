import { createShopifyRouteTemplates } from "@shopify/hydrogen";

// Product and collection pages use Shopify's standard paths. Collection-scoped
// product URLs canonicalize to the app's single product-detail route.
// TODO(2.11): pass this to handleShopifyRedirects once the 404 fallback lands.
export const routeTemplates = createShopifyRouteTemplates({
  productInCollection: "/products/:productHandle",
});
