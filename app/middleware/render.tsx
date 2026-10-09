import {
  render as remixRender,
  renderWith,
  Renderer,
  type RenderFunction,
} from "remix/middleware/render";
import { createMiddleware, type RequestContext } from "remix/router";
import type { RemixNode } from "remix/component";

import type { Assets } from "../assets.ts";
import { runtimeDispatch } from "../runtime.ts";

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
  assets: Pick<Assets, "getScriptEntry">;
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
  return createMiddleware(
    runtimeDispatch(),
    remixRender({ assets: options.assets }),
    renderWith((context) => {
      // Capture the upstream renderer before renderWith installs our wrapper.
      let renderNode = context.get(Renderer) as RenderFunction;

      return function renderPage(node: RemixNode, init?: ResponseInit) {
        let navigationMenu =
          getContextValue(context, NavigationMenuConfig) ??
          FALLBACK_NAVIGATION_MENU;
        let footerMenu =
          getContextValue(context, FooterMenuConfig) ?? FALLBACK_FOOTER_MENU;
        let storeWideSale =
          getContextValue(context, StoreWideSaleConfig) ?? null;
        let cartInitialData = getContextValue(
          context,
          CartInitialDataConfig,
        ) ?? {
          cart: null,
        };
        let analyticsShop =
          getContextValue(context, AnalyticsShopConfig) ?? null;
        let market = getContextValue(context, MarketConfig) ?? US_MARKET;
        let headers = new Headers(init?.headers);
        // HTML contains request-scoped Storefront data and must not be cached.
        headers.set("Cache-Control", "private, no-store");
        return renderNode(
          <DocumentAssetsProvider {...options.documentAssets}>
            <ShellDataProvider
              analyticsShop={analyticsShop}
              cartInitialData={cartInitialData}
              currentPath={new URL(context.request.url).pathname}
              footerMenu={footerMenu}
              market={market}
              navigationMenu={navigationMenu}
              storeWideSale={storeWideSale}
            >
              {node}
            </ShellDataProvider>
          </DocumentAssetsProvider>,
          { ...init, headers },
        );
      };
    }),
  );
}
