import { createController } from "remix/router";

import { queryShop } from "../data/storefront.ts";
import { routes } from "../routes.ts";
import { HomePage } from "./pages.tsx";

export default createController(routes, {
  actions: {
    async home({ render, storefrontClient }) {
      let shop = await queryShop(storefrontClient);
      if (!shop.ok) throw new Error(shop.message, { cause: shop.errors });

      return render(
        <HomePage
          shopName={shop.data.name}
          description={shop.data.description}
        />,
      );
    },
  },
});
