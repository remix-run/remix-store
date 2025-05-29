import { useNonce, getShopAnalytics, Analytics } from "@shopify/hydrogen";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  useRouteLoaderData,
  ScrollRestoration,
  isRouteErrorResponse,
  type ShouldRevalidateFunction,
  data,
} from "react-router";
import { FOOTER_QUERY, HEADER_QUERY } from "~/lib/fragments";
import { AnimatedLinkSpread } from "~/components/ui/animated-link";
import { Navbar } from "~/components/navbar";
import { Footer } from "~/components/footer";
import { Icon } from "~/components/icon";

/* eslint-disable import/no-unresolved */
import interUrl from "/font/inter-roman-latin-var.woff2?url";
import interItalicUrl from "/font/inter-italic-latin-var.woff2?url";
import jetBrainsMonoUrl from "/font/jet-brains-mono.woff2?url";
import lexendZettaBlackUrl from "/font/lexend-zetta-black.woff2?url";
/* eslint-enable import/no-unresolved */

import tailwindCssSrc from "./tailwind.css?url";
import { MatrixText } from "./components/matrix-text";

import type { Route } from "./+types/root";

export type RootLoader = Route.ComponentProps["loaderData"];

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
    { rel: "stylesheet", href: tailwindCssSrc },
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

export async function loader(args: Route.LoaderArgs) {
  let requestUrl = new URL(args.request.url);
  let siteUrl = requestUrl.protocol + "//" + requestUrl.host;

  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  const { storefront, env } = args.context;

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
        withPrivacyBanner: true,
      },
    },
    {
      headers: {
        "Set-Cookie": await args.context.session.commit(),
      },
    },
  );
}

async function loadCriticalData({ context }: Route.LoaderArgs) {
  const { storefront, cart } = context;

  const [header, cartData] = await Promise.all([
    storefront.query(HEADER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        headerMenuHandle: "main-menu",
      },
    }),
    cart.get(),
  ]);

  return {
    cart: cartData,
    header,
  };
}

function loadDeferredData({ context }: Route.LoaderArgs) {
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

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="min-h-dvh overflow-x-hidden bg-black antialiased">
        {data ? (
          <Analytics.Provider
            cart={data.cart}
            shop={data.shop}
            consent={data.consent}
          >
            {data.header.menu && (
              <Navbar menu={data.header.menu} cart={data.cart} />
            )}
            <main>{children}</main>
            <Footer footer={data.footer} />
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

export const meta: Route.MetaFunction = ({ error }) => {
  const title =
    isRouteErrorResponse(error) && error.status === 404
      ? "Not Found"
      : "Something went wrong";
  return [{ title }];
};

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
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
