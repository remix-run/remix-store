import { createController } from "remix/router";

import { queryShop } from "../data/storefront.server.ts";
import { routes } from "../routes.ts";
import { HomePage } from "./pages.tsx";

export default createController(routes, {
  actions: {
    async home({ render, storefrontClient }) {
      let shop = await queryShop(storefrontClient);
      return render(
        <HomePage shopName={shop.name} description={shop.description} />,
      );
    },
  },
});
