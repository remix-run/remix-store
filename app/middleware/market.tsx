import { Renderer } from "remix/middleware/render";
import { createContextKey, type Middleware } from "remix/router";
import { redirect } from "remix/response/redirect";
import { createElement, type RemixNode } from "remix/ui";

import { NotFoundPage } from "../actions/pages.tsx";
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
      // SAFETY: The app's renderer middleware runs before market resolution;
      // Remix's generic Renderer key erases the concrete RemixNode input type.
      let renderPage = context.get(Renderer) as
        | ((node: RemixNode, init?: ResponseInit) => Response)
        | undefined;
      return renderPage
        ? renderPage(createElement(NotFoundPage, {}), { status: 404 })
        : new Response("Not Found", { status: 404 });
    }

    context.set(MarketConfig, resolution.market, marketProperty);
    context.url.pathname = resolution.pathname;
    return next();
  };
}
