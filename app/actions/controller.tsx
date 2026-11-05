import { SuperHeaders } from "remix/headers";
import { createController } from "remix/router";

import { getCartData } from "../data/cart-handlers.ts";
import { queryHome } from "../data/home.ts";
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

        return render(
          <HomePage
            canonicalUrl={
              new URL(request.url).origin +
              marketPath(routes.home.href(), market.pathPrefix)
            }
            market={market}
            description={home.shop.description}
            hero={home.hero}
            lookbookEntries={home.lookbookEntries}
            products={home.products}
            pageInfo={home.pageInfo}
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
