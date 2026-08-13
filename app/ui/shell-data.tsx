import { type Handle, type RemixNode } from "remix/ui";

import type { CartInitialData } from "../data/cart.ts";
import type {
  AnalyticsShop,
  NavigationMenuData,
  StoreWideSaleData,
} from "../data/storefront.ts";

interface ShellDataProviderProps {
  analyticsShop?: AnalyticsShop | null;
  cartInitialData?: CartInitialData;
  children?: RemixNode;
  footerMenu: NavigationMenuData;
  navigationMenu: NavigationMenuData;
  storeWideSale: StoreWideSaleData | null;
}

export interface ShellData {
  analyticsShop?: AnalyticsShop | null;
  cartInitialData?: CartInitialData;
  footerMenu: NavigationMenuData;
  navigationMenu: NavigationMenuData;
  storeWideSale: StoreWideSaleData | null;
}

export function ShellDataProvider(
  handle: Handle<ShellDataProviderProps, ShellData>,
) {
  handle.context.set({
    analyticsShop: handle.props.analyticsShop,
    cartInitialData: handle.props.cartInitialData,
    footerMenu: handle.props.footerMenu,
    navigationMenu: handle.props.navigationMenu,
    storeWideSale: handle.props.storeWideSale,
  });
  return () => <>{handle.props.children}</>;
}
