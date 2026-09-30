import { form, get, route } from "remix/routes";

export { CART_API_PATH } from "./lib/public/cart-routes.ts";

export const routes = route({
  home: get("/"),
  cart: get("/cart"),
  collections: {
    index: get("/collections"),
    show: get("/collections/:handle"),
  },
  products: {
    show: get("/products/:handle"),
  },
  subscribe: form("/subscribe"),
  policies: {
    show: get("/policies/:handle"),
  },
  seo: {
    robots: get("/robots.txt"),
    sitemapIndex: get("/sitemap.xml"),
    sitemapStatic: get("/sitemap/static.xml"),
    sitemapResource: get("/sitemap/:type/:page.xml"),
  },
});
