import { SuperHeaders } from "remix/headers";
import { createController } from "remix/router";

import { getCartData } from "../data/cart.server.ts";
import { queryHome } from "../data/storefront.ts";
import { cacheControl } from "../lib/cache-control.ts";
import { marketPath } from "../lib/public/market.ts";
import { isUtcDecember, type Clock } from "../lib/seasonal.ts";
import { routes } from "../routes.ts";
import { CartPage, HomePage } from "./pages.tsx";

export interface RootControllerOptions {
  clock?: Clock;
}

export function createRootController(options: RootControllerOptions = {}) {
  let clock = options.clock ?? (() => new Date());

  return createController(routes, {
    actions: {
      async home({ market, request, render, storefrontClient }) {
        let home = await queryHome(storefrontClient);
        if (!home.ok) throw new Error(home.message, { cause: home.errors });

        return render(
          <HomePage
            canonicalUrl={
              new URL(request.url).origin +
              marketPath(routes.home.href(), market.pathPrefix)
            }
            market={market}
            description={home.data.shop.description}
            hero={home.data.hero}
            lookbookEntries={home.data.lookbookEntries}
            products={home.data.products}
            pageInfo={home.data.pageInfo}
            showSeasonalSnow={isUtcDecember(clock())}
          />,
          {
            headers: new SuperHeaders({ cacheControl: cacheControl.browsing }),
          },
        );
      },
      async cart({ market, render, request, shellData, storefrontClient }) {
        // The page title and server-rendered lines need the cart even when the
        // shell leaves it to the browser store on client navigations.
        let cartInitialData =
          (await shellData).cartInitialData ??
          (await getCartData(request, storefrontClient));
        return render(
          <CartPage
            canonicalUrl={
              new URL(request.url).origin +
              marketPath(routes.cart.href(), market.pathPrefix)
            }
            initialData={cartInitialData}
            market={market}
          />,
        );
      },
    },
  });
}
