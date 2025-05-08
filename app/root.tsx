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
import error500Src from "~/assets/images/error-500.png";

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

interface GlitchData {
  originalString: string;
  displayString: string;
  /** Flat indices relative to originalString (without newlines) */
  activeCharIndices: number[];
}

function GlitchyText() {
  const [bgImageDataUrl, setBgImageDataUrl] = useState("");
  const [glitchData, setGlitchData] = useState<GlitchData | null>(null);
  const [scale, setScale] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = error404Src;
    let targetCanvasWidth: number;
    let targetCanvasHeight: number;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      targetCanvasWidth = img.naturalWidth;
      targetCanvasHeight = img.naturalHeight;

      if (targetCanvasWidth === 0 || targetCanvasHeight === 0) {
        console.error("Image loaded with zero dimensions. Cannot process.");
        return;
      }

      canvas.width = targetCanvasWidth;
      canvas.height = targetCanvasHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("Failed to get 2D context from canvas");
        return;
      }
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
      let generatedOriginalString = "";
      const tempActiveIndices: number[] = [];
      let flatCharIndex = 0;

      for (let i = 0; i < pixelData.length; i += 4) {
        const r = pixelData[i];
        const g = pixelData[i + 1];
        const b = pixelData[i + 2];

        const char = getHexCharForPixelBrightness(r, g, b);
        generatedOriginalString += char;

        if (char !== " ") {
          tempActiveIndices.push(flatCharIndex);
        }
        flatCharIndex++;

        const currentPixelIndexInFlatArray = i / 4;
        if ((currentPixelIndexInFlatArray + 1) % targetCanvasWidth === 0) {
          if (
            currentPixelIndexInFlatArray <
            targetCanvasWidth * targetCanvasHeight - 1
          ) {
            generatedOriginalString += "\n";
          }
        }
      }
      setGlitchData({
        originalString: generatedOriginalString,
        displayString: generatedOriginalString, // Initially same as original
        activeCharIndices: tempActiveIndices,
      });
      handleResize();
    };

    img.onerror = (err) => {
      console.error("Failed to load image for GlitchyText:", err);
    };

    const handleResize = () => {
      if (!targetCanvasWidth) return;

      // Each character is 6px wide
      setScale(window.innerWidth / (targetCanvasWidth * 6));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // RAF Glitching Effect with setTimeout throttling
  useEffect(() => {
    if (!glitchData?.activeCharIndices?.length) {
      // No active characters or data, ensure any pending timeouts are cleared.
      // (No specific timeoutId to clear here as it's managed within the running loop's scope)
      return;
    }

    let timeoutId: NodeJS.Timeout | null = null;
    let animationFrameId: number | null = null; // To cancel RAF if timeout gets cleared first

    const glitchAmountPercent = 0.08;
    const minCharsToGlitch = 1;
    const glitchInterval = 80; // ms
    const numActiveChars = glitchData?.activeCharIndices.length;
    const numToGlitch = Math.max(
      minCharsToGlitch,
      Math.floor(numActiveChars * glitchAmountPercent),
    );

    const animate = () => {
      setGlitchData((prevGlitchData) => {
        if (!prevGlitchData) return null;

        const { originalString, activeCharIndices } = prevGlitchData;
        const chars = originalString.split("");

        for (let k = 0; k < numToGlitch; k++) {
          if (numActiveChars === 0) break;
          const randomActiveIndex = Math.floor(Math.random() * numActiveChars);
          const flatIndexToGlitch = activeCharIndices[randomActiveIndex];

          let currentFlatIdx = 0;
          let actualStringIdx = -1;
          for (let j = 0; j < originalString.length; j++) {
            if (originalString[j] === "\n") continue;
            if (currentFlatIdx === flatIndexToGlitch) {
              actualStringIdx = j;
              break;
            }
            currentFlatIdx++;
          }

          if (
            actualStringIdx !== -1 &&
            chars[actualStringIdx] !== " " &&
            chars[actualStringIdx] !== "\n"
          ) {
            const currentHex = chars[actualStringIdx];
            const intValue = parseInt(currentHex, 16);
            if (!isNaN(intValue)) {
              const newValue = (intValue + 1) % 16;
              chars[actualStringIdx] = newValue.toString(16).toUpperCase();
            }
          }
        }
        return { ...prevGlitchData, displayString: chars.join("") };
      });

      // Schedule the next animation frame after the interval
      timeoutId = setTimeout(() => {
        animationFrameId = requestAnimationFrame(animate);
      }, glitchInterval);
    };

    // Start the first animation frame immediately
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      // Cleanup: clear the timeout and cancel the animation frame
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [glitchData?.activeCharIndices]); // Re-run if originalString or active indices change

  return (
    <div
      className="relative aspect-[3/1] w-full overflow-hidden text-center font-mono text-[10px] leading-none font-medium tracking-normal text-transparent select-none"
      ref={containerRef}
    >
      <div
        className="absolute top-1/2 left-1/2 bg-size-[100%_100%] bg-clip-text bg-no-repeat whitespace-pre blur-xl"
        style={{
          transform: `translate(-50%, -50%) scale(${scale})`,
          imageRendering: "pixelated",
          backgroundImage: `url(${bgImageDataUrl})`,
        }}
      >
        {glitchData?.originalString}
      </div>
      <div
        className="absolute top-1/2 left-1/2 bg-size-[100%_100%] bg-clip-text bg-no-repeat whitespace-pre"
        style={{
          transform: `translate(-50%, -50%) scale(${scale})`,
          imageRendering: "pixelated",
          backgroundImage: `url(${bgImageDataUrl})`,
        }}
      >
        {glitchData?.displayString}
      </div>
    </div>
  );
}
