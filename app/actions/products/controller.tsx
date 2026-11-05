import { SuperHeaders } from "remix/headers";
import { createController } from "remix/router";

import { loadProductNavigationOrEmpty } from "../../data/menus.ts";
import { queryProduct } from "../../data/product.ts";
import { cacheControl } from "../../lib/cache-control.ts";
import { marketPath } from "../../lib/public/market.ts";
import { routes } from "../../routes.ts";
import { NotFoundPage } from "../../ui/error-pages.tsx";
import { ProductPage } from "./page.tsx";

export default createController(routes.products, {
  actions: {
    async show({ env, market, params, render, storefrontClient, url }) {
      let [product, productNavigation] = await Promise.all([
        queryProduct(storefrontClient, params.handle, url.searchParams),
        loadProductNavigationOrEmpty(storefrontClient),
      ]);
      if (!product) return render(<NotFoundPage />, { status: 404 });

      return render(
        <ProductPage
          canonicalUrl={
            url.origin +
            marketPath(routes.products.show.href(params), market.pathPrefix)
          }
          market={market}
          menu={productNavigation}
          product={product}
          search={url.search}
          shopPayStoreUrl={
            env.PUBLIC_CHECKOUT_DOMAIN?.trim() || storefrontClient.storeUrl
          }
        />,
        { headers: new SuperHeaders({ cacheControl: cacheControl.browsing }) },
      );
    },
  },
});
