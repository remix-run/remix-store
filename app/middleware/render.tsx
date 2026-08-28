import { renderWith } from "remix/middleware/render";
import type { RequestContext } from "remix/router";
import { createHtmlResponse } from "remix/response/html";
import type { RemixNode } from "remix/ui";
import { renderToStream, type RenderToStreamOptions } from "remix/ui/server";

import {
  FALLBACK_FOOTER_MENU,
  FALLBACK_NAVIGATION_MENU,
} from "../data/storefront.ts";
import { US_MARKET } from "../lib/public/market.ts";
import { MarketConfig } from "./market.tsx";
import {
  AnalyticsShopConfig,
  CartInitialDataConfig,
  FooterMenuConfig,
  NavigationMenuConfig,
  StoreWideSaleConfig,
} from "./storefront.ts";
import {
  DocumentAssetsProvider,
  type DocumentAssets,
} from "../ui/document-assets.tsx";
import { ShellDataProvider } from "../ui/shell-data.tsx";

export interface RenderOptions {
  documentAssets: DocumentAssets;
  resolveClientEntry: NonNullable<RenderToStreamOptions["resolveClientEntry"]>;
}

interface ContextValueKey<Value> {
  defaultValue?: Value;
}

function getContextValue<Value>(
  context: RequestContext,
  key: ContextValueKey<Value>,
): Value | undefined {
  return context.get(key);
}

export function render(options: RenderOptions) {
  return renderWith((context) => {
    let { request } = context;

    return function renderPage(node: RemixNode, init?: ResponseInit) {
      let navigationMenu =
        getContextValue(context, NavigationMenuConfig) ??
        FALLBACK_NAVIGATION_MENU;
      let footerMenu =
        getContextValue(context, FooterMenuConfig) ?? FALLBACK_FOOTER_MENU;
      let storeWideSale = getContextValue(context, StoreWideSaleConfig) ?? null;
      let cartInitialData = getContextValue(context, CartInitialDataConfig) ?? {
        cart: null,
      };
      let analyticsShop = getContextValue(context, AnalyticsShopConfig) ?? null;
      let market = getContextValue(context, MarketConfig) ?? US_MARKET;
      let stream = renderToStream(
        <DocumentAssetsProvider {...options.documentAssets}>
          <ShellDataProvider
            analyticsShop={analyticsShop}
            cartInitialData={cartInitialData}
            footerMenu={footerMenu}
            market={market}
            navigationMenu={navigationMenu}
            storeWideSale={storeWideSale}
          >
            {node}
          </ShellDataProvider>
        </DocumentAssetsProvider>,
        {
          frameSrc: request.url,
          signal: request.signal,
          resolveClientEntry: options.resolveClientEntry,
        },
      );

      let headers = new Headers(init?.headers);
      // HTML contains request-scoped Storefront data and must not be cached.
      headers.set("Cache-Control", "private, no-store");
      return createHtmlResponse(stream, { ...init, headers });
    };
  });
}
