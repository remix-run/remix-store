import { SuperHeaders, type SuperHeadersPropertyInit } from "remix/headers";

import { cacheControl } from "./cache-control.ts";
import { MARKETS } from "./public/market.ts";

const RESPONSE_HEADERS = {
  cacheControl: cacheControl.publicDay,
  contentType: "text/plain; charset=utf-8",
} satisfies SuperHeadersPropertyInit;

export function robotsResponse(options: {
  origin: string;
  shopId?: string;
  sitemapPath: string;
}): Response {
  return new Response(robotsText(options), {
    headers: new SuperHeaders(RESPONSE_HEADERS),
  });
}

function robotsText({
  origin,
  shopId,
  sitemapPath,
}: {
  origin: string;
  shopId?: string;
  sitemapPath: string;
}): string {
  let numericShopId = shopId?.match(/\/Shop\/([^/]+)$/)?.[1];
  let shopRules = numericShopId
    ? `\nDisallow: /${encodeURIComponent(numericShopId)}/checkouts\nDisallow: /${encodeURIComponent(numericShopId)}/orders`
    : "";
  // Market prefixes serve the same buyer-specific routes. `/*/cart` would also
  // match product handles such as `/products/cart-organizer`, so list each.
  let marketPrefixes = MARKETS.flatMap(({ pathPrefix }) =>
    pathPrefix ? [pathPrefix] : [],
  );
  let marketRules = (paths: string[]) =>
    marketPrefixes
      .flatMap((prefix) => paths.map((path) => `\nDisallow: ${prefix}${path}`))
      .join("");
  let generalRules = `Disallow: /admin
Disallow: /cart
Disallow: /orders
Disallow: /checkouts/
Disallow: /checkout${shopRules}
Disallow: /carts
Disallow: /account
Disallow: /buy/
Disallow: /api/
Disallow: /__shopify${marketRules(["/cart", "/account", "/checkout", "/api/", "/search", "/policies/"])}
Disallow: /collections/*sort_by*
Disallow: /*/collections/*sort_by*
Disallow: /collections/*+*
Disallow: /collections/*%2B*
Disallow: /collections/*%2b*
Disallow: /*/collections/*+*
Disallow: /*/collections/*%2B*
Disallow: /*/collections/*%2b*
Disallow: */collections/*filter*&*filter*
Disallow: /blogs/*+*
Disallow: /blogs/*%2B*
Disallow: /blogs/*%2b*
Disallow: /*/blogs/*+*
Disallow: /*/blogs/*%2B*
Disallow: /*/blogs/*%2b*
Disallow: /*?*oseid=*
Disallow: /*preview_theme_id*
Disallow: /*preview_script_id*
Disallow: /policies/
Disallow: /*/*?*ls=*&ls=*
Disallow: /*/*?*ls%3D*%3Fls%3D*
Disallow: /*/*?*ls%3d*%3fls%3d*
Disallow: /search
Allow: /search/
Disallow: /search/?*
Disallow: /apple-app-site-association
Disallow: /.well-known/shopify/monorail
Sitemap: ${origin}${sitemapPath}`;

  return `User-agent: *
${generalRules}

# Google AdsBot ignores robots.txt unless specifically named.
User-agent: adsbot-google
Disallow: /checkouts/
Disallow: /checkout
Disallow: /cart
Disallow: /carts
Disallow: /account
Disallow: /orders${shopRules}${marketRules(["/cart", "/account", "/checkout"])}
Disallow: /*?*oseid=*
Disallow: /*preview_theme_id*
Disallow: /*preview_script_id*

User-agent: Nutch
Disallow: /

User-agent: AhrefsBot
Crawl-delay: 10
${generalRules}

User-agent: AhrefsSiteAudit
Crawl-delay: 10
${generalRules}

User-agent: MJ12bot
Crawl-delay: 10

User-agent: Pinterest
Crawl-delay: 1`;
}
