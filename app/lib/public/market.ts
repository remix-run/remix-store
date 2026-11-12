import { defineShopifyI18n, matchLocale } from "@shopify/hydrogen";
import type { SerializableObject } from "remix/component";

export type MarketCountry = "US" | "CA";
export type MarketLocale = "en-US" | "en-CA";
export type MarketPathPrefix = "" | "/en-ca";

export type ActiveMarket = SerializableObject & {
  country: MarketCountry;
  language: "EN";
  locale: MarketLocale;
  pathPrefix: MarketPathPrefix;
};

export const US_MARKET: ActiveMarket = {
  country: "US",
  language: "EN",
  locale: "en-US",
  pathPrefix: "",
};

export const CA_MARKET: ActiveMarket = {
  country: "CA",
  language: "EN",
  locale: "en-CA",
  pathPrefix: "/en-ca",
};

export const MARKETS: readonly ActiveMarket[] = [US_MARKET, CA_MARKET];

/**
 * The locales Hydrogen resolves for Storefront API context. Pathname routing
 * derives each prefix from the locale (`EN` + `CA` serves `/en-ca`), which
 * must match the market's `pathPrefix`.
 */
export const i18n = defineShopifyI18n({
  defaultLocale: { language: "EN", country: "US" },
  routing: {
    type: "pathname",
    locales: [{ language: "EN", country: "CA" }],
  },
});

const APP_PATH_PREFIXES = new Set([
  "account",
  "admin",
  "api",
  "apps",
  "assets",
  "blogs",
  "cart",
  "checkout",
  "collections",
  "discount",
  "localization",
  "pages",
  "policies",
  "products",
  "recommendations",
  "robots.txt",
  "search",
  "sitemap",
  "sitemap.xml",
  "subscribe",
  "wallets",
]);
const BCP47ISH_PREFIX = /^[a-z]{2,3}(?:-[a-z]{4})?(?:-[a-z]{2}|-\d{3})?$/i;

export type MarketPathResolution =
  | { kind: "market"; market: ActiveMarket; pathname: string }
  | { kind: "redirect"; pathname: string }
  | { kind: "unsupported" };

/** Resolves the fixed market contract without silently accepting locale-like paths. */
export function resolveMarketPath(pathname: string): MarketPathResolution {
  let [first = "", ...rest] = pathname.split("/").filter(Boolean);
  if (!first) return { kind: "market", market: US_MARKET, pathname: "/" };

  let normalized = first.toLowerCase();
  let suffix = rest.length ? `/${rest.join("/")}` : "/";
  if (normalized === "en-us") return { kind: "redirect", pathname: suffix };
  if (normalized === "fr-ca") {
    return {
      kind: "redirect",
      pathname: `/en-ca${suffix === "/" ? "" : suffix}`,
    };
  }
  let { pathPrefix } = matchLocale(pathname, i18n);
  let market = MARKETS.find((candidate) => candidate.pathPrefix === pathPrefix);
  if (pathPrefix && market) {
    if (first !== normalized) {
      return {
        kind: "redirect",
        pathname: `${pathPrefix}${suffix === "/" ? "" : suffix}`,
      };
    }
    return { kind: "market", market, pathname: suffix };
  }
  if (!APP_PATH_PREFIXES.has(normalized) && BCP47ISH_PREFIX.test(first)) {
    return { kind: "unsupported" };
  }
  return { kind: "market", market: US_MARKET, pathname };
}

/** Prefixes an app-owned absolute path exactly once. External URLs are unchanged. */
export function marketPath(
  value: string,
  pathPrefix: MarketPathPrefix,
): string {
  if (!pathPrefix || !value.startsWith("/") || value.startsWith("//")) {
    return value;
  }
  if (value === pathPrefix || value.startsWith(`${pathPrefix}/`)) return value;
  return value === "/" ? `${pathPrefix}/` : `${pathPrefix}${value}`;
}

export function cartApiPath(pathPrefix: MarketPathPrefix): string {
  return marketPath("/api/cart", pathPrefix);
}

export function localizeInternalUrl(
  value: string,
  pathPrefix: MarketPathPrefix,
): string {
  if (!pathPrefix || !value.startsWith("/") || value.startsWith("//")) {
    return value;
  }
  let hashIndex = value.indexOf("#");
  let queryIndex = value.indexOf("?");
  let end = [hashIndex, queryIndex]
    .filter((index) => index >= 0)
    .reduce((smallest, index) => Math.min(smallest, index), value.length);
  return marketPath(value.slice(0, end), pathPrefix) + value.slice(end);
}
