import { useNonce, getShopAnalytics, Analytics } from "@shopify/hydrogen";
import {
  data,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "@shopify/remix-oxygen";
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
import { AnimatedLinkSpread } from "~/components/ui/animated-link";
import { AsideProvider } from "~/components/ui/aside";
import { Navbar } from "~/components/navbar";
import { Footer } from "~/components/footer";
import { Icon } from "~/components/icon";

/* eslint-disable import/no-unresolved */
import interUrl from "/font/inter-roman-latin-var.woff2?url";
import interItalicUrl from "/font/inter-italic-latin-var.woff2?url";
import jetBrainsMonoUrl from "/font/jet-brains-mono.woff2?url";
import lexendZettaBlackUrl from "/font/lexend-zetta-black.woff2?url";
/* eslint-enable import/no-unresolved */

import "./tailwind.css";
import { MatrixText } from "./components/matrix-text";
import { isProduction } from "./lib/is-production.server";

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
    jetBrainsMonoUrl,
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
  // PRE-LAUNCH CHECK -- don't load any data
  if (isProduction) {
    return { isProduction: true };
  }

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

      {
        // PRE-LAUNCH CHECK -- conditional render of all the extra stuff
        data && "isProduction" in data && data.isProduction ? (
          <body className="min-h-screen overflow-x-hidden bg-[#0A101A] antialiased">
            {children}
          </body>
        ) : (
          <body className="min-h-screen overflow-x-hidden bg-black antialiased">
            {data && "cart" in data ? (
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
        )
      }
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export const meta: MetaFunction = ({ error }) => {
  const title =
    isRouteErrorResponse(error) && error.status === 404
      ? "Not Found"
      : "Something went wrong";
  return [{ title }];
};

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
    <div className="flex h-screen flex-col items-center justify-center pt-[140px] pb-[140px] md:h-min md:pt-[200px] md:pb-[240]">
      <MatrixText text={errorStatus === 404 ? "404" : "500"} />
      <div className="flex flex-col items-center gap-9 md:gap-12">
        <div className="flex flex-col items-center gap-3 md:gap-6">
          <h1 className="font-title text-3xl font-black tracking-[-0.2em] uppercase md:text-5xl md:tracking-[-0.2em]">
            {errorMessage}
          </h1>
          <p className="text-sm tracking-tight md:text-base md:tracking-tight">
            Please check the URL and try again
          </p>
        </div>
        <AnimatedLinkSpread to="/" className="w-60">
          <Icon
            name="fast-forward"
            className="size-8 rotate-180"
            fill="currentColor"
            aria-hidden="true"
          />
          <span>Back Home</span>
        </AnimatedLinkSpread>
      </div>
    </div>
  );
}
