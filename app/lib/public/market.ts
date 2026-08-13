import type { SerializableObject } from "remix/ui";

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
  if (normalized === "en-ca") {
    if (first !== normalized) {
      return {
        kind: "redirect",
        pathname: `/en-ca${suffix === "/" ? "" : suffix}`,
      };
    }
    return { kind: "market", market: CA_MARKET, pathname: suffix };
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

export function marketFromPathname(pathname: string): ActiveMarket {
  let resolution = resolveMarketPath(pathname);
  return resolution.kind === "market" ? resolution.market : US_MARKET;
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
