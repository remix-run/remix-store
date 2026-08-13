import { createController } from "remix/router";

import { queryProduct, queryProductNavigation } from "../../data/storefront.ts";
import { marketPath } from "../../lib/public/market.ts";
import { routes } from "../../routes.ts";
import { NotFoundPage } from "../pages.tsx";
import { ProductPage } from "./page.tsx";

export default createController(routes.products, {
  actions: {
    async show({ market, params, render, storefrontClient, url }) {
      let [product, productNavigation] = await Promise.all([
        queryProduct(storefrontClient, params.handle, url.searchParams),
        queryProductNavigation(storefrontClient, url.host),
      ]);
      if (!product.ok) {
        throw new Error(product.message, { cause: product.errors });
      }
      if (!product.data) return render(<NotFoundPage />, { status: 404 });

      return render(
        <ProductPage
          canonicalUrl={
            url.origin +
            marketPath(routes.products.show.href(params), market.pathPrefix)
          }
          market={market}
          menu={productNavigation}
          product={product.data}
          search={url.search}
        />,
      );
    },
  },
});
