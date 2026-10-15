import { type Handle, type RemixNode } from "remix/component";

import type { CartInitialData } from "../data/cart.ts";
import type { ActiveMarket } from "../lib/public/market.ts";
import type {
  AnalyticsShop,
  NavigationMenuData,
  StoreWideSaleData,
} from "../data/storefront.ts";

type ShellDataProviderProps = ShellData & { children?: RemixNode };

export interface ShellData {
  analyticsShop?: AnalyticsShop | null;
  /**
   * Seeds the browser cart store on document requests. Undefined on client
   * navigations, where the hydrated cart store already owns the cart.
   */
  cartInitialData?: CartInitialData;
  /** The requested pathname, including any market prefix. */
  currentPath: string;
  footerMenu: NavigationMenuData;
  market: ActiveMarket;
  navigationMenu: NavigationMenuData;
  storeWideSale: StoreWideSaleData | null;
}

export function ShellDataProvider(
  handle: Handle<ShellDataProviderProps, ShellData>,
) {
  handle.context.set({
    analyticsShop: handle.props.analyticsShop,
    cartInitialData: handle.props.cartInitialData,
    currentPath: handle.props.currentPath,
    footerMenu: handle.props.footerMenu,
    market: handle.props.market,
    navigationMenu: handle.props.navigationMenu,
    storeWideSale: handle.props.storeWideSale,
  });
  return () => <>{handle.props.children}</>;
}
