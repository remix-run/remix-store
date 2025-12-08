import { useState, useEffect, memo, useRef } from "react";
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
import { SnowField } from "~/components/snow-field";
import type { Route } from "./+types/($locale)._index";

export let FEATURED_COLLECTION_HANDLE = "remix-logo-apparel";

export function meta({ matches }: Route.MetaArgs) {
  const { siteUrl } = matches[0].data;
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

  return data({
    hero,
    lookbookEntries,
    expectedNumberOfProducts,
    products,
    collectionHandle,
    productsPageInfo,
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
  } = loaderData;

  let [firstEntry, ...restEntries] = lookbookEntries;

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-20">
        <SnowField />
      </div>
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

let heroHeight = 1600;

function Hero({ masthead, assetImages, product }: HeroDataProps) {
  const heroRef = useRef<HTMLDivElement>(null);
  let scrollPercentage = useScrollPercentage(heroRef);

  let translateY = Math.floor(
    (heroRef.current?.offsetHeight || 0) * scrollPercentage * 0.5,
  );
  let opacity = Math.max(0, 1 - scrollPercentage * 4);

  let highlightSwitch = scrollPercentage > 0.3;

  // Calculate which frame to show based on scroll percentage
  let frameIndex = Math.min(
    Math.floor(scrollPercentage * 1.5 * assetImages.length),
    assetImages.length - 1,
  );

  return (
    <div
      ref={heroRef}
      className="relative h-screen max-h-[1200px] overflow-hidden bg-linear-[180deg,var(--color-black),#27273B] pt-24 md:top-7 md:h-[1200px] lg:h-[1600px] lg:max-h-[1600px] 2xl:h-[1800px] 2xl:max-h-[1800px]"
    >
      <div
        className="fixed w-full"
        style={{
          height: `${heroRef.current?.offsetHeight || heroHeight}px`,
          transform: `translate3d(0, -${translateY}px, 0)`,
        }}
      >
        <HydrogenImage
          sizes="100vw lg:86vw"
          className="relative left-1/2 h-auto min-w-[140%] -translate-x-1/2 object-cover object-center md:min-w-[120%] lg:max-w-[86%] lg:min-w-[86%]"
          loading="eager"
          data={masthead}
          style={{
            opacity,
          }}
        />

        <h1 className="3xl:mt-80 mt-48 flex max-h-min w-full flex-nowrap items-start justify-center gap-8 px-4 text-2xl font-extrabold text-white md:mt-[250px] md:gap-64 md:px-9 md:text-5xl lg:mt-[330px] lg:gap-64 lg:text-8xl xl:mt-72 xl:gap-80 xl:text-8xl 2xl:mt-80 2xl:gap-96">
          <span className="sr-only">Remix</span>
          <HeroText highlight={!highlightSwitch}>
            software
            <br />
            for
            <br />
            better
            <br />
            websites
          </HeroText>
          <HeroText highlight={highlightSwitch}>
            soft wear
            <br />
            for
            <br />
            engineers
            <br />
            of all kinds
          </HeroText>
        </h1>

        <RotatingProduct
          product={product}
          assetImages={assetImages}
          frameIndex={frameIndex}
        />
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

    return (
      <Link
        to={href("/:locale?/products/:handle", { handle: product.handle })}
        className="3xl:scale-130 3xl:hover:scale-135 3xl:translate-y-56 absolute top-0 w-full translate-y-14 scale-125 transition-transform duration-200 select-none hover:scale-130 md:translate-y-12 lg:translate-y-20 lg:scale-100 lg:hover:scale-105 xl:scale-100 xl:hover:scale-105 2xl:translate-y-32 2xl:scale-110 2xl:hover:scale-115"
      >
        <span className="sr-only">{product.title}</span>
        {assetImages.map((asset, index) => (
          <img
            key={asset.image.url}
            className="absolute inset-0 mx-auto object-cover object-center"
            src={asset.image.url}
            alt=""
            aria-disabled={"true"}
            style={{
              visibility: index === frameIndex ? "visible" : "hidden",
            }}
          />
        ))}
      </Link>
    );
  },
);

function HeroText({
  children,
  highlight,
}: {
  children: React.ReactNode;
  highlight: boolean;
}) {
  return (
    <span
      className={clsx(
        "text-nowrap uppercase transition-opacity duration-200",
        highlight ? "opacity-100" : "opacity-10",
      )}
    >
      {children}
    </span>
  );
}

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
          to="https://rmx.as/newsletter"
          className={animatedLinkCss}
        >
          Coming Soon
        </AnimatedLink>
      )}
    </div>
  );
}

// not sure if this is something we should be loading from the storefront
let loadRunnerImage = {
  altText: "Silhouette of a runner made of white circles",
  height: 1081,
  width: 1081,
  url: "https://cdn.shopify.com/s/files/1/0655/4127/5819/files/load_runner.gif?v=1739987429",
};

function LoadRunner() {
  return (
    <div className="flex h-[390px] items-center justify-center gap-4 bg-[#1E1EC4] md:h-[480px] lg:h-[800px]">
      <div className="3xl:w-[50%] w-[65%] xl:w-[60%] 2xl:w-[55%]">
        <HydrogenImage
          className="relative left-1/2 h-full w-full max-w-[90%] -translate-x-1/2"
          sizes="65vw"
          data={loadRunnerImage}
        />
      </div>
    </div>
  );
}
