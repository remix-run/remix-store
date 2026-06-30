import { useState, useEffect, memo, useRef, lazy, Suspense } from "react";
import { Link, data, href } from "react-router";
import { getCollectionQuery } from "~/lib/data/collection.server";
import { Image as HydrogenImage } from "@shopify/hydrogen";
import {
  getLookbookEntries,
  type LookbookEntry as LookbookEntryProps,
} from "~/lib/data/lookbook.server";
import {
  getHeroData,
  type HeroData as HeroDataProps,
} from "~/lib/data/hero.server";
import { clsx } from "clsx";
import { usePrefersReducedMotion, useScrollPercentage } from "~/lib/hooks";
import { AnimatedLink } from "~/components/ui/animated-link";
import { generateMeta } from "~/lib/meta";
import { ProductGrid } from "~/components/product-grid";
import { RemixRunner } from "~/components/remix-runner";
const SnowField = lazy(() => import("~/components/snow-field"));
import type { Route } from "./+types/($locale)._index";

export let FEATURED_COLLECTION_HANDLE = "remix-logo-apparel";

export function meta({ matches }: Route.MetaArgs) {
  const { siteUrl } = matches[0].loaderData;
  return generateMeta({
    title: "Home",
    url: siteUrl,
  });
}

export async function loader({ context }: Route.LoaderArgs) {
  let { storefront } = context;

  let collectionHandle = "all";
  let expectedNumberOfProducts = 15;
  let { products, productsPageInfo } = await getCollectionQuery(storefront, {
    variables: {
      handle: collectionHandle,
      first: expectedNumberOfProducts,
    },
  });

  let lookbookEntriesQuery = getLookbookEntries(storefront);
  let heroQuery = getHeroData(storefront);
  let [hero, lookbookEntries] = await Promise.all([
    heroQuery,
    lookbookEntriesQuery,
  ]);

  let isDecember = new Date().getMonth() === 11;

  return data({
    hero,
    lookbookEntries,
    expectedNumberOfProducts,
    products,
    collectionHandle,
    productsPageInfo,
    isDecember,
  });
}

export default function Homepage({ loaderData }: Route.ComponentProps) {
  let {
    hero,
    lookbookEntries,
    expectedNumberOfProducts,
    products: initialProducts,
    collectionHandle,
    productsPageInfo,
    isDecember,
  } = loaderData;

  let [firstEntry, ...restEntries] = lookbookEntries;

  return (
    <>
      {isDecember ? (
        <div className="pointer-events-none fixed inset-0 z-20">
          <Suspense fallback={null}>
            <SnowField />
          </Suspense>
        </div>
      ) : null}
      <Hero {...hero} />
      <div className="relative">
        {firstEntry && (
          <LookbookEntry key={firstEntry.image.id} {...firstEntry} />
        )}
        <LoadRunner />
        {restEntries.map((entry) => (
          <LookbookEntry key={entry.image.id} {...entry} />
        ))}
        <div className="bg-linear-[180deg,#2d2d38,var(--color-black)] py-9 md:py-12 lg:py-16">
          <ProductGrid
            products={initialProducts}
            loadingProductCount={expectedNumberOfProducts}
            loadMoreProducts={{
              collectionHandle,
              hasNextPage: productsPageInfo.hasNextPage,
              endCursor: productsPageInfo.endCursor ?? undefined,
              numberOfProducts: expectedNumberOfProducts,
            }}
          />
        </div>
      </div>
    </>
  );
}

let productFrameScrollSpeed = 1.5;

function Hero({ assetImages, product }: HeroDataProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  let scrollPercentage = useScrollPercentage(heroRef);

  // Calculate which frame to show based on scroll percentage
  let frameIndex = Math.min(
    Math.floor(scrollPercentage * productFrameScrollSpeed * assetImages.length),
    assetImages.length - 1,
  );

  return (
    <div ref={heroRef} className="relative h-[200vh] bg-black">
      <div className="sticky top-0 h-screen overflow-hidden">
        <RotatingProduct
          product={product}
          assetImages={assetImages}
          frameIndex={frameIndex}
        />
        <div className="absolute bottom-8 left-5 z-10 flex max-w-[min(720px,calc(100vw-40px))] flex-col items-start gap-5 md:bottom-12 md:left-9 md:gap-7 lg:bottom-16">
          <h1 className="font-sans pr-[0.02em] text-4xl leading-none font-black tracking-[-0.02em] text-white md:text-6xl lg:text-7xl">
            Remix 3 Racing Team Collection
          </h1>
          <AnimatedLink
            animationType="icon"
            iconName="fast-forward"
            reloadDocument
            to="https://checkout.remix.run/collections/remix-racing"
          >
            Shop New Items
          </AnimatedLink>
        </div>
      </div>
    </div>
  );
}

type RotatingProductProps = Pick<HeroDataProps, "product" | "assetImages"> & {
  frameIndex: number;
};

type LoadingState = "idle" | "pending" | "loaded" | "error";

let RotatingProduct = memo(
  ({ product, assetImages, frameIndex }: RotatingProductProps) => {
    let [imagesLoaded, setImagesLoaded] = useState<LoadingState>("idle");
    let prefersReducedMotion = usePrefersReducedMotion();

    // If the images haven't finished loading, just show the first frame
    if (prefersReducedMotion || imagesLoaded !== "loaded") {
      frameIndex = 0;
    }

    useEffect(() => {
      if (prefersReducedMotion) return;

      if (imagesLoaded !== "idle") return;

      setImagesLoaded("pending");

      // Preload all images -- fire and forget
      // we probably could handle canceling loading if the user navigates
      // however they are probably going to see the home page eventually, even
      // if they navigate away quickly, so probably still worth loading the all
      // the images
      let imagePromises = assetImages.map((asset) => {
        return new Promise((resolve, reject) => {
          let img = new Image();
          img.addEventListener("load", () => resolve(img.src), { once: true });
          img.addEventListener("error", () => reject(img.src), { once: true });
          img.src = asset.image.url;
        });
      });

      Promise.all(imagePromises)
        .then(() => setImagesLoaded("loaded"))
        .catch(() => setImagesLoaded("error"));
    }, [assetImages, imagesLoaded, prefersReducedMotion]);

    let images = assetImages.map((asset, index) => (
      <img
        key={asset.image.url}
        className="absolute inset-0 h-full w-full object-cover object-center"
        src={asset.image.url}
        alt=""
        aria-disabled={"true"}
        style={{
          visibility: index === frameIndex ? "visible" : "hidden",
        }}
      />
    ));

    if (!product) {
      return (
        <div className="absolute inset-0 h-full w-full select-none">
          {images}
        </div>
      );
    }

    return (
      <Link
        to={href("/:locale?/products/:handle", { handle: product.handle })}
        className="absolute inset-0 block h-full w-full select-none"
      >
        <span className="sr-only">{product.title}</span>
        {images}
      </Link>
    );
  },
);

function LookbookEntry({ image, product }: LookbookEntryProps) {
  // This component makes heavy use of custom properties to ensure the
  // the whole lookbook entry is clickable as a link

  const animatedLinkCss = clsx(
    "[--offset:--spacing(5)] md:[--offset:--spacing(9)]",
    "absolute bottom-[var(--offset)] left-[var(--offset)]",
  );
  return (
    <div
      className={clsx(
        "[--lookbook-entry-height:640px] md:[--lookbook-entry-height:800px]",
        "relative h-(--lookbook-entry-height) bg-black",
      )}
    >
      {/* Visual content */}
      <div className="absolute inset-0">
        <HydrogenImage
          sizes="100vw"
          className="h-full w-full object-cover"
          style={{
            objectPosition: image.focalPoint
              ? `${100 * image.focalPoint.x}% ${100 * image.focalPoint.y}%`
              : "center",
          }}
          data={image}
        />
      </div>

      {product ? (
        <AnimatedLink
          prefetch="intent"
          animationType="icon"
          iconName="fast-forward"
          to={href("/:locale?/products/:handle", {
            handle: product.handle,
          })}
          className={animatedLinkCss}
        >
          <span className="absolute -bottom-(--offset) -left-(--offset) h-(--lookbook-entry-height) w-lvw" />
          <span>{product.title}</span>
          <span className="text-[28px]">·</span>
          <span>${Math.floor(Number(product.price.amount))}</span>
        </AnimatedLink>
      ) : (
        <AnimatedLink
          prefetch="intent"
          animationType="icon"
          iconName="mail"
          to={href("/:locale?/subscribe")}
          className={animatedLinkCss}
        >
          Coming Soon
        </AnimatedLink>
      )}
    </div>
  );
}

function LoadRunner() {
  return (
    <div className="runner-brand-background flex h-[390px] items-center justify-center gap-4 md:h-[480px] lg:h-[800px]">
      <div className="3xl:w-[50%] w-[65%] xl:w-[60%] 2xl:w-[55%]">
        <RemixRunner
          alt="Silhouette of a runner made of white circles"
          className="relative left-1/2 h-full w-full max-w-[90%] -translate-x-1/2 object-contain"
        />
      </div>
    </div>
  );
}
