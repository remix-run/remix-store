import { SuperHeaders } from "remix/headers";
import { createController } from "remix/router";

import { loadCartDataOrEmpty } from "../data/cart-handlers.ts";
import { queryHome } from "../data/home.ts";
import { cacheControl } from "../lib/cache-control.ts";
import { marketUrl } from "../lib/public/market.ts";
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
      async home({ market, render, storefrontClient, url }) {
        let home = await queryHome(storefrontClient);

        return render(
          <HomePage
            canonicalUrl={marketUrl(url, routes.home.href(), market.pathPrefix)}
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
      async cart({
        market,
        render,
        request,
        shellData,
        storefrontClient,
        url,
      }) {
        // The page title and server-rendered lines need the cart even when the
        // shell leaves it to the browser store on client navigations.
        let cartInitialData =
          (await shellData).cartInitialData ??
          (await loadCartDataOrEmpty(storefrontClient, request));
        return render(
          <CartPage
            canonicalUrl={marketUrl(url, routes.cart.href(), market.pathPrefix)}
            initialData={cartInitialData}
          />,
        );
      },
    },
  });
}
