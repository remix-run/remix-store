const RESPONSE_HEADERS = {
  "Cache-Control": "public, max-age=86400",
  "Content-Type": "text/plain; charset=utf-8",
};

export function robotsResponse(options: {
  origin: string;
  shopId?: string;
  sitemapPath: string;
}): Response {
  return new Response(robotsText(options), { headers: RESPONSE_HEADERS });
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
  let generalRules = `Disallow: /admin
Disallow: /cart
Disallow: /orders
Disallow: /checkouts/
Disallow: /checkout${shopRules}
Disallow: /carts
Disallow: /account
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
Disallow: /carts
Disallow: /orders${shopRules}
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
