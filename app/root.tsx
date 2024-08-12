import { useNonce, getShopAnalytics, Analytics } from "@shopify/hydrogen";
import { defer, type LoaderFunctionArgs } from "@shopify/remix-oxygen";
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
import { PageLayout } from "~/components/PageLayout";
import { FOOTER_QUERY, HEADER_QUERY } from "~/lib/fragments";
import { parseColorScheme } from "./lib/color-scheme.server";
import clsx from "clsx";
import { ColorSchemeScript, useColorScheme } from "~/lib/color-scheme";
import { useAside } from "~/components/Aside";

import "~/styles/app.css"; // TODO: remove when finished with tailwind
import "./tailwind.css";
import { Hero } from "./components/hero";
import { Button } from "./components/ui/button";

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
    { href: "https://fonts.googleapis.com" },
    { href: "https://fonts.gstatic.com", crossOrigin: "true" },
    { href: "https://cdn.shopify.com", crossOrigin: "true" },
    { href: "https://shop.app" },
  ];

  const fonts = [
    "https://fonts.googleapis.com/css2?family=Sometype+Mono:ital,wght@0,400..700;1,400..700&display=swap",
    "https://fonts.googleapis.com/css2?family=Inter:wght@300..800&display=swap",
  ];

  return [
    // Preload Jersey 10, earliest, since it's a blocking font
    { rel: "preload", as: "font", href: "/font/jersey-10/latin-ext.woff2" },
    { rel: "preload", as: "font", href: "/font/jersey-10/latin.woff2" },
    ...preconnects.map((preconnect) => ({ rel: "preconnect", ...preconnect })),
    ...fonts.map((href) => ({ rel: "preload", as: "style", href })),
    ...fonts.map((href) => ({ rel: "stylesheet", href })),
    { rel: "icon", href: "/favicon-32.png", sizes: "32x32" },
    { rel: "icon", href: "/favicon-128.png", sizes: "128x128" },
    { rel: "icon", href: "/favicon-180.png", sizes: "180x180" },
    { rel: "icon", href: "/favicon-192.png", sizes: "192x192" },
    { rel: "apple-touch-icon", href: "/favicon-180.png", sizes: "180x180" },
  ];
}

export async function loader(args: LoaderFunctionArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  const { storefront, env } = args.context;

  return defer(
    {
      ...deferredData,
      ...criticalData,
      publicStoreDomain: env.PUBLIC_STORE_DOMAIN,
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

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({ context, request }: LoaderFunctionArgs) {
  const { storefront } = context;

  const [header, colorScheme] = await Promise.all([
    storefront.query(HEADER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        headerMenuHandle: "main-menu", // Adjust to your header menu handle
      },
    }),
    parseColorScheme(request),
    // Add other queries here, so that they are loaded in parallel
  ]);

  return {
    header,
    colorScheme,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({ context }: LoaderFunctionArgs) {
  const { storefront, customerAccount, cart } = context;
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
    cart: cart.get(),
    isLoggedIn: customerAccount.isLoggedIn(),
    footer,
  };
}

export function Layout({ children }: { children?: React.ReactNode }) {
  const nonce = useNonce();
  const data = useRouteLoaderData<RootLoader>("root");
  const colorScheme = useColorScheme();
  const { isOpen } = useAside();

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
      <body
        className={clsx(
          "font-sans min-h-screen overflow-x-hidden antialiased",
          isOpen && "overflow-hidden",
        )}
      >
        {data ? (
          <Analytics.Provider
            cart={data.cart}
            shop={data.shop}
            consent={data.consent}
          >
            <PageLayout {...data}>{children}</PageLayout>
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
    <div className="px-9">
      <Hero subtitle={errorMessage} title={`error ${errorStatus}`} />
      <div className="my-[100px] flex flex-col items-center gap-6">
        <p className="text-xl">
          Please check to see if you have typed the URL correctly.
        </p>
        <div className="w-[340px]">
          <Button size="fw" asChild>
            <Link className="text-center" to="/">
              Back to shop
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
