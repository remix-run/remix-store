import { createController } from "remix/router";

import { queryProduct } from "../../data/storefront.ts";
import { routes } from "../../routes.ts";
import { NotFoundPage } from "../pages.tsx";
import { ProductPage } from "./page.tsx";

export default createController(routes.products, {
  actions: {
    async show({ params, render, storefrontClient, url }) {
      let product = await queryProduct(
        storefrontClient,
        params.handle,
        url.searchParams,
      );
      if (!product.ok) {
        throw new Error(product.message, { cause: product.errors });
      }
      if (!product.data) return render(<NotFoundPage />, { status: 404 });

      return render(
        <ProductPage
          canonicalUrl={url.origin + routes.products.show.href(params)}
          product={product.data}
          search={url.search}
        />,
      );
    },
  },
});
