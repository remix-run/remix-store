import { renderWith } from "remix/middleware/render";
import { createHtmlResponse } from "remix/response/html";
import type { RemixNode } from "remix/ui";
import { renderToStream, type RenderToStreamOptions } from "remix/ui/server";

import {
  FALLBACK_FOOTER_MENU,
  FALLBACK_NAVIGATION_MENU,
  type AnalyticsShop,
  type NavigationMenuData,
} from "../data/storefront.ts";
import type { CartInitialData } from "../data/cart.ts";
import {
  AnalyticsShopConfig,
  CartInitialDataConfig,
  FooterMenuConfig,
  NavigationMenuConfig,
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

export function render(options: RenderOptions) {
  return renderWith((context) => {
    let { request } = context;

    return function renderPage(node: RemixNode, init?: ResponseInit) {
      let navigationMenu =
        (context.get(NavigationMenuConfig) as NavigationMenuData | undefined) ??
        FALLBACK_NAVIGATION_MENU;
      let footerMenu =
        (context.get(FooterMenuConfig) as NavigationMenuData | undefined) ??
        FALLBACK_FOOTER_MENU;
      let cartInitialData = (context.get(CartInitialDataConfig) as
        | CartInitialData
        | undefined) ?? { cart: null };
      let analyticsShop =
        (context.get(AnalyticsShopConfig) as
          | AnalyticsShop
          | null
          | undefined) ?? null;
      let stream = renderToStream(
        <DocumentAssetsProvider {...options.documentAssets}>
          <ShellDataProvider
            analyticsShop={analyticsShop}
            cartInitialData={cartInitialData}
            footerMenu={footerMenu}
            navigationMenu={navigationMenu}
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
