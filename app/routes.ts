import { get, route } from "remix/routes";

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
});
