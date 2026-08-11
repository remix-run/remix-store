import { createController } from "remix/router";

import { queryHome } from "../data/storefront.ts";
import { routes } from "../routes.ts";
import { CartPage, HomePage } from "./pages.tsx";
function noStoreResponseInit(init?: ResponseInit): ResponseInit {
  let headers = new Headers(init?.headers);
  headers.set("Cache-Control", "private, no-store");
  return { ...init, headers };
}

export default createController(routes, {
  actions: {
    async home({ request, render, storefrontClient }) {
      let home = await queryHome(storefrontClient);
      if (!home.ok) throw new Error(home.message, { cause: home.errors });

      return render(
        <HomePage
          canonicalUrl={new URL(request.url).origin + routes.home.href()}
          shopName={home.data.shop.name}
          description={home.data.shop.description}
          hero={home.data.hero}
          lookbookEntries={home.data.lookbookEntries}
          products={home.data.products}
          pageInfo={home.data.pageInfo}
        />,
      );
    },
    async cart({ cartInitialData, render, request }) {
      return render(
        <CartPage
          canonicalUrl={new URL(request.url).origin + routes.cart.href()}
          initialData={cartInitialData}
        />,
        noStoreResponseInit(),
      );
    },
  },
});
