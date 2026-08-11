import { get, route } from "remix/routes";

export const routes = route({
  home: get("/"),
  collections: {
    index: get("/collections"),
    show: get("/collections/:handle"),
  },
  products: {
    show: get("/products/:handle"),
  },
});
