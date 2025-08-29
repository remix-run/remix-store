import { useRouteLoaderData } from "react-router";
import type { RootLoader } from "~/root";

export function useStoreWideSale() {
  const data = useRouteLoaderData<RootLoader>("root");

  return data?.header.storeWideSale;
}
