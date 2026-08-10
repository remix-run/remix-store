import { type Handle, type RemixNode } from "remix/ui";

import type { NavigationMenuData } from "../data/storefront.ts";

interface ShellDataProviderProps {
  children?: RemixNode;
  footerMenu: NavigationMenuData;
  navigationMenu: NavigationMenuData;
}

interface ShellData {
  footerMenu: NavigationMenuData;
  navigationMenu: NavigationMenuData;
}

export function ShellDataProvider(
  handle: Handle<ShellDataProviderProps, ShellData>,
) {
  handle.context.set({
    footerMenu: handle.props.footerMenu,
    navigationMenu: handle.props.navigationMenu,
  });
  return () => <>{handle.props.children}</>;
}
