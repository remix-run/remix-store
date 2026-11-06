import {
  marketPath,
  type MarketPathPrefix,
} from "../../../lib/public/market.ts";

/** Hydrogen's cart API endpoint, served by `handleShopifyRoutes`. */
export const CART_API_PATH = "/api/cart";

/** The cart API endpoint for a market, e.g. `/en-ca/api/cart`. */
export function cartApiPath(pathPrefix: MarketPathPrefix = ""): string {
  return marketPath(CART_API_PATH, pathPrefix);
}
