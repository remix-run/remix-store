import {
  getShopifyScriptTags,
  type ShopifyScriptTagDescriptor,
  type ShopifyScriptTagDescriptors,
} from "@shopify/hydrogen";
import { css, unsafeHTML, type Handle, type RemixNode } from "remix/component";
import { ImportMap } from "remix/component/server";

import { Footer } from "../assets/public/footer.tsx";
import {
  type AnalyticsShop,
  FALLBACK_FOOTER_MENU,
  FALLBACK_NAVIGATION_MENU,
} from "../data/storefront.ts";
import { US_MARKET, type ActiveMarket } from "../lib/public/market.ts";
import { DocumentAssetsProvider } from "./document-assets.tsx";
import { Navbar } from "./navbar.tsx";
import { ShellDataProvider } from "./shell-data.tsx";
import { spritesSvg } from "./sprites.ts";

const SITE_NAME = "The Remix Store";

export interface DocumentProps {
  appendSiteName?: boolean;
  canonicalUrl?: string;
  children?: RemixNode;
  description?: string;
  noIndex?: boolean;
  socialImage?: string;
  socialType?: "product" | "website";
  title: string;
}

export function Document(handle: Handle<DocumentProps>) {
  return () => {
    let {
      appendSiteName = true,
      canonicalUrl,
      children,
      description: requestedDescription,
      noIndex = false,
      socialImage = "/social-main.jpg",
      socialType = "website",
      title,
    } = handle.props;
    let documentTitle = appendSiteName ? `${title} | ${SITE_NAME}` : title;
    let description =
      requestedDescription?.trim() || "Soft wear for engineers of all kinds";
    let assets = handle.context.get(DocumentAssetsProvider);
    let shellData = handle.context.get(ShellDataProvider) ?? {
      analyticsShop: null,
      cartInitialData: undefined,
      currentPath: "",
      footerMenu: FALLBACK_FOOTER_MENU,
      market: US_MARKET,
      navigationMenu: FALLBACK_NAVIGATION_MENU,
      storeWideSale: null,
    };
    // Italic and mono text is rare or below the fold, so those fonts load on
    // use. The sale banner sets mono above the fold while a sale runs.
    let preloadedFonts = [
      assets.fonts.interRoman,
      assets.fonts.lexendZetta,
      ...(shellData.storeWideSale ? [assets.fonts.jetBrainsMono] : []),
    ];
    let socialImageUrl = canonicalUrl
      ? new URL(socialImage, canonicalUrl).href
      : socialImage;
    let shopifyScripts = getShopifyScripts(
      shellData.analyticsShop,
      shellData.market,
    );

    return (
      <html
        lang={shellData.market.locale}
        data-market-prefix={shellData.market.pathPrefix || undefined}
      >
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="description" content={description} />
          <meta
            name="robots"
            content={noIndex ? "noindex, nofollow" : "index, follow"}
          />
          <meta name="theme-color" content="#000000" />
          <meta name="color-scheme" content="dark" />
          {assets.stylesheets.map((href) => (
            <link href={href} rel="stylesheet" />
          ))}
          <meta property="og:type" content={socialType} />
          <meta property="og:title" content={title} />
          <meta property="og:site_name" content={SITE_NAME} />
          <meta property="og:description" content={description} />
          <meta property="og:image" content={socialImageUrl} />
          {canonicalUrl ? (
            <meta property="og:url" content={canonicalUrl} />
          ) : null}
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={title} />
          <meta name="twitter:description" content={description} />
          <meta name="twitter:image" content={socialImageUrl} />
          {canonicalUrl ? <link rel="canonical" href={canonicalUrl} /> : null}
          <link
            rel="preconnect"
            href="https://cdn.shopify.com"
            crossOrigin="anonymous"
          />
          <link rel="dns-prefetch" href="https://cdn.shopify.com" />
          <link rel="preconnect" href="https://shop.app" />
          <link
            rel="icon"
            type="image/png"
            sizes="32x32"
            href="/remix-favicon-32.png"
          />
          <link rel="icon" type="image/svg+xml" href="/remix-favicon.svg" />
          <link
            rel="apple-touch-icon"
            sizes="180x180"
            href="/remix-apple-touch-icon.png"
          />
          {preloadedFonts.map((href) => (
            <link
              rel="preload"
              href={href}
              as="font"
              type="font/woff2"
              crossOrigin="anonymous"
            />
          ))}
          <ImportMap value={assets.scriptEntry.importMap} />
          {assets.scriptEntry.preloads.map((href) => (
            <link href={href} rel="modulepreload" />
          ))}
          <script src={assets.scriptEntry.href} type="module"></script>
          {shopifyScripts.links.map((descriptor) => (
            <ShopifyTag descriptor={descriptor} />
          ))}
          <title>{documentTitle}</title>
        </head>
        <body mix={bodyStyle}>
          {/* Inline once so every `<use href="#name">` resolves without a request. */}
          <div hidden innerHTML={unsafeHTML(spritesSvg)} />
          <Navbar
            cartInitialData={shellData.cartInitialData}
            currentPath={shellData.currentPath}
            market={shellData.market}
            menu={shellData.navigationMenu}
            storeWideSale={shellData.storeWideSale}
          />
          {children}
          <Footer
            menu={shellData.footerMenu}
            pathPrefix={shellData.market.pathPrefix}
          />
          {shopifyScripts.scripts.map((descriptor) => (
            <ShopifyTag descriptor={descriptor} />
          ))}
        </body>
      </html>
    );
  };
}

const EMPTY_SHOPIFY_SCRIPT_TAGS: ShopifyScriptTagDescriptors = {
  links: [],
  scripts: [],
  tags: [],
};

function getShopifyScripts(
  analyticsShop: AnalyticsShop | null | undefined,
  market: ActiveMarket,
): ShopifyScriptTagDescriptors {
  if (!analyticsShop?.shopId || !analyticsShop.myshopifyDomain) {
    return EMPTY_SHOPIFY_SCRIPT_TAGS;
  }
  return getShopifyScriptTags({
    analytics: { channel: analyticsShop.channel },
    consent: { mode: "default-banner" },
    i18n: {
      country: market.country,
      language: market.language,
      currency: analyticsShop.currency,
      pathPrefix: market.pathPrefix,
    },
    shop: {
      myshopifyDomain: analyticsShop.myshopifyDomain,
      shopId: analyticsShop.shopId,
      storefrontId: analyticsShop.storefrontId,
    },
  });
}

function ShopifyTag(
  handle: Handle<{ descriptor: ShopifyScriptTagDescriptor }>,
) {
  return () => {
    let descriptor = handle.props.descriptor;
    if (descriptor.tagName === "link") {
      let { crossorigin, ...attributes } = descriptor.attributes;
      return <link {...attributes} crossOrigin={crossorigin || undefined} />;
    }
    let { crossorigin, ...attributes } = descriptor.attributes ?? {};
    return (
      <script
        {...attributes}
        crossOrigin={crossorigin || undefined}
        innerHTML={
          descriptor.innerHTML === undefined
            ? undefined
            : unsafeHTML(descriptor.innerHTML)
        }
      />
    );
  };
}

const bodyStyle = css({
  background: "var(--color-black)",
  color: "var(--color-white)",
  colorScheme: "dark",
  overflowX: "hidden",
  "&:has(dialog#cart-drawer[open])": { overflow: "hidden" },
  "& a": { color: "inherit", transition: "color 180ms ease" },
  "@media (hover: hover)": {
    "& a:hover": { color: "var(--color-blue-brand)" },
  },
  "& :focus-visible": {
    outline: "3px solid var(--color-yellow-brand)",
    outlineOffset: "4px",
  },
  "& button": { cursor: "pointer" },
});
