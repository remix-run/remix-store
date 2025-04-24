import { useNonce, getShopAnalytics, Analytics } from "@shopify/hydrogen";
import { data, type LoaderFunctionArgs } from "@shopify/remix-oxygen";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  useRouteError,
  useRouteLoaderData,
  ScrollRestoration,
  isRouteErrorResponse,
  type ShouldRevalidateFunction,
  Link,
} from "@remix-run/react";
import { FOOTER_QUERY, HEADER_QUERY } from "~/lib/fragments";
import { parseColorScheme } from "~/lib/color-scheme.server";
import { clsx } from "clsx";
import { ColorSchemeScript, useColorScheme } from "~/lib/color-scheme";
import { Button } from "~/components/ui/button";
import { AsideProvider } from "~/components/ui/aside";
import { Navbar } from "~/components/navbar";
import { Footer } from "~/components/footer";

/* eslint-disable import/no-unresolved */
import interUrl from "/font/inter-roman-latin-var.woff2?url";
import interItalicUrl from "/font/inter-italic-latin-var.woff2?url";
import sourceCodeProUrl from "/font/source-code-pro-roman-var.woff2?url";
import sourceCodeProItalicUrl from "/font/source-code-pro-italic-var.woff2?url";
import lexendZettaBlackUrl from "/font/lexend-zetta-black.woff2?url";
/* eslint-enable import/no-unresolved */

import "./tailwind.css";

export type RootLoader = typeof loader;

/**
 * This is important to avoid re-fetching root queries on sub-navigations
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({
  formMethod,
  currentUrl,
  nextUrl,
}) => {
  // revalidate when a mutation is performed e.g add to cart, login...
  if (formMethod && formMethod !== "GET") {
    return true;
  }

  // revalidate when manually revalidating via useRevalidator
  if (currentUrl.toString() === nextUrl.toString()) {
    return true;
  }

  return false;
};

export function links() {
  const preconnects = [
    { href: "https://cdn.shopify.com", crossOrigin: "true" },
    { href: "https://shop.app" },
  ];

  const localFonts = [
    interUrl,
    interItalicUrl,
    sourceCodeProUrl,
    sourceCodeProItalicUrl,
    lexendZettaBlackUrl,
  ];

  return [
    ...preconnects.map((preconnect) => ({ rel: "preconnect", ...preconnect })),
    ...localFonts.map((href) => ({
      rel: "preload",
      as: "font",
      href,
      crossOrigin: "anonymous",
    })),
    {
      rel: "icon",
      type: "image/svg+xml",
      href: "/favicon.svg",
      media: "(prefers-color-scheme: light)",
    },
    {
      rel: "icon",
      type: "image/svg+xml",
      href: "/favicon-dark.svg",
      media: "(prefers-color-scheme: dark)",
    },
    { rel: "shortcut icon", type: "image/x-icon", href: "/favicon.ico" },
    {
      rel: "shortcut icon",
      type: "image/x-icon",
      href: "/favicon-dark.ico",
      media: "(prefers-color-scheme: dark)",
    },
  ];
}

export async function loader(args: LoaderFunctionArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  const { storefront, env } = args.context;

  let requestUrl = new URL(args.request.url);
  let siteUrl = requestUrl.protocol + "//" + requestUrl.host;

  return data(
    {
      ...deferredData,
      ...criticalData,
      publicStoreDomain: env.PUBLIC_STORE_DOMAIN,
      siteUrl,
      shop: getShopAnalytics({
        storefront,
        publicStorefrontId: env.PUBLIC_STOREFRONT_ID,
      }),
      consent: {
        checkoutDomain: env.PUBLIC_CHECKOUT_DOMAIN,
        storefrontAccessToken: env.PUBLIC_STOREFRONT_API_TOKEN,
      },
    },
    {
      headers: {
        "Set-Cookie": await args.context.session.commit(),
      },
    },
  );
}

async function loadCriticalData({ context, request }: LoaderFunctionArgs) {
  const { storefront, cart } = context;

  const [header, colorScheme, cartData] = await Promise.all([
    storefront.query(HEADER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        headerMenuHandle: "main-menu",
      },
    }),
    parseColorScheme(request),
    cart.get(),
  ]);

  return {
    cart: cartData,
    header,
    colorScheme,
  };
}

function loadDeferredData({ context }: LoaderFunctionArgs) {
  const { storefront, customerAccount } = context;
  // defer the footer query (below the fold)
  const footer = storefront
    .query(FOOTER_QUERY, {
      cache: storefront.CacheLong(),
    })
    .catch((error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return null;
    });
  return {
    isLoggedIn: customerAccount.isLoggedIn(),
    footer,
  };
}

export function Layout({ children }: { children?: React.ReactNode }) {
  const nonce = useNonce();
  const data = useRouteLoaderData<RootLoader>("root");
  const colorScheme = useColorScheme();

  return (
    <html
      lang="en"
      className={clsx({ dark: colorScheme === "dark" })}
      suppressHydrationWarning
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <ColorSchemeScript nonce={nonce} />
        <Meta />
        <Links />
      </head>
      <body className="min-h-screen overflow-x-hidden bg-black antialiased">
        {data ? (
          <Analytics.Provider
            cart={data.cart}
            shop={data.shop}
            consent={data.consent}
          >
            <AsideProvider>
              {data.header.menu && (
                <Navbar menu={data.header.menu} cart={data.cart} />
              )}
              <main>{children}</main>
              <Footer footer={data.footer} />
            </AsideProvider>
          </Analytics.Provider>
        ) : (
          children
        )}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  let errorMessage = "Unknown error";
  let errorStatus = 500;

  if (isRouteErrorResponse(error)) {
    errorMessage = error?.data?.message ?? error.data;
    errorStatus = error.status;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <div className="my-[100px] flex flex-col items-center gap-6">
      <p className="text-xl">
        Please check to see if you have typed the URL correctly.
      </p>
      <div className="w-[340px]">
        <Button size="lg" asChild>
          <Link to="/collections/all">Back to shop</Link>
        </Button>
      </div>
    </div>
  );
}
