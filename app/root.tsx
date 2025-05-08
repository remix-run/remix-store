import { useNonce, getShopAnalytics, Analytics } from "@shopify/hydrogen";
import { data, type LoaderFunctionArgs } from "@shopify/remix-oxygen";
import React, { useEffect, useRef, useState } from "react";
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

import error404Src from "~/assets/images/error-404.png";

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
    <div className="flex h-screen flex-col items-center justify-center pt-[140px] pb-[140px] md:h-min md:pt-[200px] md:pb-[240]">
      <GlitchyText />
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
          <>
            <Icon
              name="fast-forward"
              className="size-8 rotate-180"
              fill="currentColor"
              aria-hidden="true"
            />
            <span>Back Home</span>
          </>
        </AnimatedLinkSpread>
      </div>
    </div>
  );
}

const HEX_CHARS = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
];

/**
 * Maps pixel brightness to a hexadecimal character or a space.
 * @param r Red component (0-255)
 * @param g Green component (0-255)
 * @param b Blue component (0-255)
 * @returns A character ('0'-'F' or ' ')
 */
function getHexCharForPixelBrightness(r: number, g: number, b: number): string {
  const averageBrightness = (r + g + b) / 3;

  const numSteps = HEX_CHARS.length; // 16 steps
  // stepSize determines how much of the 0-255 brightness range corresponds to one hex character step.
  const stepSizeForFullRange = 255 / numSteps;

  // Invert the brightness score: (255 - averageBrightness)
  // - If averageBrightness is high (e.g., 255 for white), invertedScore is low (0).
  // - If averageBrightness is low (e.g., 0 for black), invertedScore is high (255).
  const invertedBrightnessScore = 255 - averageBrightness;

  // Map this inverted score to an index for HEX_CHARS.
  let charIndex = Math.floor(invertedBrightnessScore / stepSizeForFullRange);

  if (charIndex > 11) {
    return " ";
  }

  // Ensure charIndex is within the valid bounds [0, numSteps - 1]
  charIndex = Math.max(0, Math.min(numSteps - 1, charIndex) - 3);

  return HEX_CHARS[charIndex];
}

function GlitchyText() {
  const [bgImageDataUrl, setBgImageDataUrl] = useState("");
  const [hexString, setHexString] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = error404Src;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const targetCanvasWidth = 140;
      const targetCanvasHeight = 66;

      canvas.width = targetCanvasWidth;
      canvas.height = targetCanvasHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("Failed to get 2D context from canvas");
        return;
      }
      // Draw the source image, stretching/squashing it into the 140x66 canvas
      ctx.drawImage(img, 0, 0, targetCanvasWidth, targetCanvasHeight);

      const dataUrl = canvas.toDataURL();
      setBgImageDataUrl(dataUrl);

      const imageData = ctx.getImageData(
        0,
        0,
        targetCanvasWidth,
        targetCanvasHeight,
      );
      const pixelData = imageData.data;
      let generatedString = "";
      const step = 4; // Process RGBA for each pixel

      for (let i = 0; i < pixelData.length; i += step) {
        const r = pixelData[i];
        const g = pixelData[i + 1];
        const b = pixelData[i + 2];

        // Replace custom logic with call to the new function
        generatedString += getHexCharForPixelBrightness(r, g, b);

        const currentPixelIndexInFlatArray = i / step;
        if ((currentPixelIndexInFlatArray + 1) % targetCanvasWidth === 0) {
          if (
            currentPixelIndexInFlatArray <
            targetCanvasWidth * targetCanvasHeight - 1
          ) {
            generatedString += "\n";
          }
        }
      }
      setHexString(generatedString.toUpperCase()); // No .trim() to preserve line lengths
    };

    img.onerror = (err) => {
      console.error("Failed to load image for GlitchyText:", err);
    };
  }, []);

  return (
    <div className="relative aspect-[3/1] w-full" ref={containerRef}>
      <div className="relative size-full overflow-hidden bg-transparent">
        <div
          className="absolute top-1/2 left-1/2 h-fit w-fit text-center font-mono whitespace-pre text-transparent select-none"
          style={{
            transformOrigin: "center center",
            fontVariantNumeric: "tabular-nums",
            transform: "translate(-50%, -50%) scale(1.3369)",
            backgroundRepeat: "no-repeat",
            backgroundSize: "100% 100%",
            imageRendering: "pixelated",
            backgroundClip: "text",
            fontSize: "10px",
            fontStyle: "normal",
            fontWeight: "500",
            letterSpacing: "0em",
            lineHeight: "1em",
            backgroundImage: `url(${bgImageDataUrl})`,
            // backgroundImage: `url("data:image/png;base64,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")`,
          }}
        >
          {hexString}
        </div>
      </div>
    </div>
  );
}
