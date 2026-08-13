import {
  getShopifyScriptTags,
  type ShopifyScriptTagDescriptor,
  type ShopifyScriptTagDescriptors,
} from "@shopify/hydrogen";
import { css, type Handle, type RemixNode } from "remix/ui";

import { Footer } from "../assets/public/footer.tsx";
import {
  type AnalyticsShop,
  FALLBACK_FOOTER_MENU,
  FALLBACK_NAVIGATION_MENU,
} from "../data/storefront.ts";
import { DocumentAssetsProvider } from "./document-assets.tsx";
import { Navbar } from "./navbar.tsx";
import { ShellDataProvider } from "./shell-data.tsx";

export interface DocumentProps {
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
      canonicalUrl,
      children,
      description: requestedDescription,
      noIndex = false,
      socialImage = "/social-main.jpg",
      socialType = "website",
      title,
    } = handle.props;
    let description =
      requestedDescription?.trim() || "Soft wear for engineers of all kinds";
    let assets = handle.context.get(DocumentAssetsProvider);
    let shellData = handle.context.get(ShellDataProvider) ?? {
      analyticsShop: null,
      cartInitialData: undefined,
      footerMenu: FALLBACK_FOOTER_MENU,
      navigationMenu: FALLBACK_NAVIGATION_MENU,
      storeWideSale: null,
    };
    let socialImageUrl = canonicalUrl
      ? new URL(socialImage, canonicalUrl).href
      : socialImage;
    let shopifyScripts = getShopifyScripts(shellData.analyticsShop);

    return (
      <html lang="en">
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
          <link rel="stylesheet" href="/preflight.css" />
          <meta property="og:type" content={socialType} />
          <meta property="og:title" content={title} />
          <meta property="og:site_name" content="The Remix Store" />
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
          <link
            rel="preload"
            href="/font/inter-roman-latin-var.woff2"
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
          <link
            rel="preload"
            href="/font/inter-italic-latin-var.woff2"
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
          <link
            rel="preload"
            href="/font/jet-brains-mono.woff2"
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
          <link
            rel="preload"
            href="/font/lexend-zetta-black.woff2"
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
          <style innerHTML={globalStyles}></style>
          {assets.css.map((attributes) => (
            <link {...attributes} rel="stylesheet" />
          ))}
          <script src={assets.entry} type="module"></script>
          {assets.js.map((attributes) => (
            <link {...attributes} rel="modulepreload" />
          ))}
          {shopifyScripts.links.map((descriptor) => (
            <ShopifyTag descriptor={descriptor} />
          ))}
          <title>{title}</title>
        </head>
        <body mix={bodyStyle}>
          <Navbar
            cartInitialData={shellData.cartInitialData}
            menu={shellData.navigationMenu}
            storeWideSale={shellData.storeWideSale}
          />
          {children}
          <Footer menu={shellData.footerMenu} />
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
  analyticsShop?: AnalyticsShop | null,
): ShopifyScriptTagDescriptors {
  if (!analyticsShop?.shopId || !analyticsShop.myshopifyDomain) {
    return EMPTY_SHOPIFY_SCRIPT_TAGS;
  }
  return getShopifyScriptTags({
    analytics: { channel: analyticsShop.channel },
    consent: { mode: "default-banner" },
    // The storefront serves a single US/EN market today. If markets land,
    // derive country/language from the same resolved market used for
    // Storefront API requests; Shopify analytics reads them from
    // `window.Shopify.locale` and `window.Shopify.currency.active`.
    i18n: {
      country: "US",
      language: "EN",
      currency: analyticsShop.currency,
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
        innerHTML={descriptor.innerHTML}
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
  "& a:hover": { color: "var(--color-blue-brand)" },
  "& :focus-visible": {
    outline: "3px solid var(--color-yellow-brand)",
    outlineOffset: "4px",
  },
  "& button": { cursor: "pointer" },
});

const globalStyles = `
  @font-face {
    font-family: "Inter";
    font-style: normal;
    font-weight: 100 900;
    font-display: swap;
    src: url("/font/inter-roman-latin-var.woff2") format("woff2");
  }
  @font-face {
    font-family: "Inter";
    font-style: italic;
    font-weight: 100 900;
    font-display: swap;
    src: url("/font/inter-italic-latin-var.woff2") format("woff2");
  }
  @font-face {
    font-family: "JetBrains Mono";
    font-style: normal;
    font-weight: 100 900;
    font-display: swap;
    src: url("/font/jet-brains-mono.woff2") format("woff2");
  }
  @font-face {
    font-family: "Lexend Zetta";
    font-style: normal;
    font-weight: 900;
    font-display: swap;
    src: url("/font/lexend-zetta-black.woff2") format("woff2");
  }
  :root {
    --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
    --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    --font-title: "Lexend Zetta", ui-sans-serif, system-ui, sans-serif;
    --color-blue-400: #54bbff;
    --color-blue-brand: #20aaff;
    --color-blue-600: #367cff;
    --color-green-brand: #80e464;
    --color-yellow-brand: #ffdf5f;
    --color-pink-brand: #ff65db;
    --color-red-brand: #ff5148;
    --color-black: #000000;
    --color-white: #ffffff;
    --color-gray-50: #f7f7f7;
    --color-gray-100: #e3e3e3;
    --color-gray-200: #c8c8c8;
    --color-gray-300: #a4a4a4;
    --color-gray-400: #818181;
    --color-gray-500: #666666;
    --color-gray-600: #515151;
    --color-gray-700: #434343;
    --color-gray-800: #212121;
    --color-gray-900: #111111;
    --ease-snap: cubic-bezier(0.13, 0.74, 0.41, 0.92);
    --header-height: 80px;
    --store-wide-sale-height: 0px;
  }
  body:has([data-store-wide-sale="true"]) {
    --store-wide-sale-height: 48px;
  }
  html {
    background: var(--color-black);
    color-scheme: dark;
  }
  @media (min-width: 810px) {
    :root { --header-height: 136px; }
  }
  @keyframes store-wide-sale-marquee {
    to { transform: translateX(-50%); }
  }
  @keyframes product-image-bounce {
    0%, 100% { transform: translateY(0) scale(1); }
    45% { transform: translateY(-8px) scale(1.018); }
    72% { transform: translateY(2px) scale(.995); }
  }
  @keyframes product-skeleton-pulse {
    0% { opacity: .35; transform: scale(.96); }
    100% { opacity: .8; transform: scale(1); }
  }
  @keyframes runner-brand-background {
    0%, 100% { background-color: var(--color-blue-brand); }
    20% { background-color: var(--color-green-brand); }
    40% { background-color: var(--color-red-brand); }
    60% { background-color: var(--color-pink-brand); }
    80% { background-color: var(--color-yellow-brand); }
  }
  @keyframes footer-gradient-strip {
    0% { transform: scaleY(.25); }
    100% { transform: scaleY(1); }
  }
  @keyframes footer-gradient-strip-shade {
    0% { opacity: .3; }
    100% { opacity: .85; }
  }
  @keyframes footer-runner-spin {
    to { transform: rotate(360deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      scroll-behavior: auto !important;
      transition-duration: 0.01ms !important;
    }
  }
`;
