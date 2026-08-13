import { cartApiPath, type MarketPathPrefix } from "./market.ts";

export const CART_API_PATH = "/api/cart";

export function getCartApiPath(pathPrefix: MarketPathPrefix = ""): string {
  return cartApiPath(pathPrefix);
}
