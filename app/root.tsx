// All PRE-LAUNCH CHECK comments indicate code that should be removed once we launch

import { useNonce, getShopAnalytics, Analytics } from "@shopify/hydrogen";
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
  type MetaFunction,
  Link,
  type LoaderFunctionArgs,
  redirect,
  data,
} from "react-router";
import { FOOTER_QUERY, HEADER_QUERY } from "~/lib/fragments";
import { clsx } from "clsx";
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

import tailwindCssSrc from "./tailwind.css?url";
import { MatrixText } from "./components/matrix-text";
import { isMagicHidden, getShowAllTheMagic } from "./lib/show-the-magic";
import { Splash } from "./components/splash";

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

export async function loader(args: LoaderFunctionArgs) {
  let requestUrl = new URL(args.request.url);
  let siteUrl = requestUrl.protocol + "//" + requestUrl.host;

  // PRE-LAUNCH CHECK -- don't load any data and redirect to home if not there
  if (!getShowAllTheMagic(args.context)) {
    let url = new URL(args.request.url);
    if (url.pathname !== "/") {
      return redirect("/");
    }
    return { hideTheMagic: true, siteUrl };
  }

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

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>

      {
        // PRE-LAUNCH CHECK -- conditional render of all the extra stuff
        isMagicHidden(data) ? (
          <Splash />
        ) : (
          <body className="min-h-dvh overflow-x-hidden bg-black antialiased">
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

export const meta: MetaFunction<typeof loader> = ({ data, error }) => {
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

  // PRE-LAUNCH CHECK -- temporary error page
  return (
    <main className="flex h-screen w-full flex-col items-center justify-center gap-1 bg-[#0A101A]">
      <h1 className="font-mono text-base text-white uppercase">
        {errorStatus}
      </h1>
      <p className="font-mono text-sm text-white uppercase">
        {errorStatus === 404 ? "Not Found" : "An unexpected error occurred"}
      </p>
    </main>
  );

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
