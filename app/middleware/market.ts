import { createContextKey, type Middleware } from "remix/router";
import { redirect } from "remix/response/redirect";
import { createElement } from "remix/component";

import { NotFoundPage } from "../ui/error-pages.tsx";
import { getPageRenderer } from "./page-renderer.ts";
import {
  resolveMarketPath,
  US_MARKET,
  type ActiveMarket,
} from "../lib/public/market.ts";

export const MarketConfig = createContextKey<ActiveMarket>(US_MARKET);
const marketProperty = { property: "market" } as const;

export function market(): Middleware<{
  key: typeof MarketConfig;
  value: ActiveMarket;
  property: "market";
}> {
  return async (context, next) => {
    let resolution = resolveMarketPath(context.url.pathname);

    if (resolution.kind === "redirect") {
      let location = `${resolution.pathname}${context.url.search}${context.url.hash}`;
      return redirect(location, 308);
    }

    if (resolution.kind === "unsupported") {
      context.set(MarketConfig, US_MARKET, marketProperty);
      if (context.method !== "GET" && context.method !== "HEAD") {
        return new Response("Not Found", { status: 404 });
      }
      return getPageRenderer(context)(createElement(NotFoundPage, {}), {
        status: 404,
      });
    }

    context.set(MarketConfig, resolution.market, marketProperty);
    context.url.pathname = resolution.pathname;
    return next();
  };
}
