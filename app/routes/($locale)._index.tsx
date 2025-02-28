import { useState, useEffect, memo } from "react";
import type { LoaderFunctionArgs } from "@shopify/remix-oxygen";
import { data } from "@shopify/remix-oxygen";
import { Link, useLoaderData, type MetaFunction } from "@remix-run/react";
import { FiltersAside, FiltersToolbar } from "~/components/filters";
import { COLLECTION_VIDEO_FRAGMENT } from "~/lib/fragments";
import { CollectionGrid } from "~/components/collection-grid";
import { Button } from "~/components/ui/button";
import { COLLECTION_QUERY } from "~/lib/queries";
import { getFilterQueryVariables } from "~/lib/filters/query-variables.server";
import { Image as HydrogenImage } from "@shopify/hydrogen";
import {
  getLookbookEntries,
  type LookbookEntry as LookbookEntryProps,
} from "~/lib/lookbook.server";
import { getHeroData, type HeroData as HeroDataProps } from "~/lib/hero.server";
import Icon from "~/components/icon";
import type { IconName } from "~/components/icon/types.generated";
import { clsx } from "clsx";
import { usePrefersReducedMotion } from "~/lib/hooks";
import { useLayoutEffect } from "~/lib/use-layout-effect";
export let FEATURED_COLLECTION_HANDLE = "remix-logo-apparel";

export let meta: MetaFunction = () => {
  return [{ title: "The Remix Store | Home" }];
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  let { storefront } = context;
  let featuredQuery = storefront.query(FEATURED_COLLECTION_QUERY, {
    variables: {
      handle: FEATURED_COLLECTION_HANDLE,
    },
  });

  let url = new URL(request.url);
  let { searchParams } = url;
  let variables = {
    handle: "all",
    first: 8,
    ...getFilterQueryVariables(searchParams),
  };

  let top8Query = storefront.query(COLLECTION_QUERY, { variables });

  let lookbookEntriesQuery = getLookbookEntries(storefront);
  let heroQuery = getHeroData(storefront);
  let [hero, lookbookEntries, { featuredCollection }, { collection }] =
    await Promise.all([
      heroQuery,
      lookbookEntriesQuery,
      featuredQuery,
      top8Query,
    ]);

  let products = collection?.products;
  if (!products) {
    throw new Response("Something went wrong", { status: 500 });
  }

  return data({
    hero,
    lookbookEntries,
    featuredCollection,
    products,
  });
}

export default function Homepage() {
  let { hero, lookbookEntries, featuredCollection, products } =
    useLoaderData<typeof loader>();

  let [firstEntry, ...restEntries] = lookbookEntries;

  return (
    <>
      {/* {featuredCollection ? (
        <Hero
          video={
            featuredCollection.video?.reference?.__typename === "Video"
              ? featuredCollection.video?.reference
              : undefined
          }
          image={featuredCollection.image}
          title={featuredCollection.title}
          subtitle={featuredCollection.featuredDescription?.value}
          href={{
            text: "shop collection",
            to: `/collections/${featuredCollection.handle}`,
          }}
        />
      ) : null} */}
      <Hero {...hero} />
      {firstEntry && (
        <LookbookEntry key={firstEntry.image.id} {...firstEntry} />
      )}
      <LoadRunner />
      {restEntries.map((entry) => (
        <LookbookEntry key={entry.image.id} {...entry} />
      ))}
      {/* <FiltersAside>
        <FiltersToolbar itemCount={products.nodes.length} />
      </FiltersAside>
      <CollectionGrid products={products.nodes} />
      <div className="mx-auto mt-20 mb-12 w-[340px]">
        <Button size="lg" asChild>
          <Link to="/collections/all">Shop all items</Link>
        </Button>
      </div> */}
    </>
  );
}

let heroHeight = 1600;

function Hero({ masthead, assetImages, product }: HeroDataProps) {
  let scrollPercentage = useScrollPercentage(heroHeight);

  let translateY = Math.floor(heroHeight * scrollPercentage * 0.5);
  let opacity = Math.max(0, 1 - scrollPercentage * 4);

  let highlightSwitch = scrollPercentage > 0.6;

  // Calculate which frame to show based on scroll percentage
  let frameIndex = Math.min(
    Math.floor(scrollPercentage * 1.5 * assetImages.length),
    assetImages.length - 1,
  );

  return (
    <div className="relative overflow-hidden bg-linear-[180deg,var(--color-black),#27273B] pt-[116px]">
      <div
        style={{
          height: `${heroHeight}px`,
          transform: `translate3d(0, ${translateY}px, 0)`,
        }}
      >
        <HydrogenImage
          sizes="86vw"
          className="mx-auto h-auto max-w-[86%] object-cover object-center"
          data={masthead}
          style={{
            opacity,
          }}
        />

        {/* TODO: add better mobile support */}
        <h1 className="mt-48 flex max-h-min w-full flex-nowrap items-start justify-between px-4 text-2xl font-extrabold text-white sm:px-9 sm:text-4xl md:mt-[300px] md:justify-center md:gap-52 md:text-5xl lg:text-7xl xl:text-8xl">
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
        to={`/products/${product.handle}`}
        className="absolute top-0 w-full translate-y-10 scale-120 transition-transform duration-200 select-none hover:scale-125 md:translate-y-18 lg:scale-100 lg:hover:scale-105 xl:scale-90 xl:hover:scale-95 2xl:translate-y-24 2xl:scale-80 2xl:hover:scale-85"
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

/**
 * Simplified hook that calculates what percentage of an element at the top of the page has been scrolled past
 * Respects prefers-reduced-motion setting
 * @param height - The height of the element (default: 1600)
 * @returns A number between 0 and 1 representing the percentage scrolled past
 */
function useScrollPercentage(height = 1600) {
  let [scrollPercentage, setScrollPercentage] = useState(0);
  let prefersReducedMotion = usePrefersReducedMotion();

  useLayoutEffect(() => {
    // If user prefers reduced motion, don't update scroll percentage
    if (prefersReducedMotion) return;

    let rafId: number;

    let calculateVisibility = () => {
      rafId = requestAnimationFrame(() => {
        let scrollY = window.scrollY;

        // If we've scrolled past the element, it's 0% visible
        if (scrollY >= height) {
          return;
        }

        let percentage =
          1 - Math.max(0, Math.min(1, (height - scrollY) / height));
        setScrollPercentage(percentage);
      });
    };

    // Calculate initial visibility
    calculateVisibility();

    // Set up scroll listener
    window.addEventListener("scroll", calculateVisibility, { passive: true });
    // Only need resize if window height affects calculations
    window.addEventListener("resize", calculateVisibility);

    return () => {
      window.removeEventListener("scroll", calculateVisibility);
      window.removeEventListener("resize", calculateVisibility);
      cancelAnimationFrame(rafId);
    };
  }, [height, prefersReducedMotion]);

  return scrollPercentage;
}

function LookbookEntry({ image, product }: LookbookEntryProps) {
  return (
    <div className="relative h-[90vh]">
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
        <IconLink iconName="fast-forward" to={`/products/${product.handle}`}>
          <span>Shop</span>
          <span className="text-[28px]">·</span>
          <span>${Math.floor(Number(product.price.amount))}</span>
        </IconLink>
      ) : (
        <IconLink
          iconName="mail"
          // TODO: Add proper signup link
          to="https://rmx.as/newsletter"
        >
          Coming Soon
        </IconLink>
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
    <div className="flex h-[800px] items-center justify-center gap-4 bg-[#1E1EC4]">
      <div className="w-[65%]">
        <HydrogenImage
          className="h-full w-full"
          sizes="65vw"
          data={loadRunnerImage}
        />
      </div>
    </div>
  );
}

type IconLinkProps = {
  to: string;
  iconName: IconName;
  children: React.ReactNode;
};

function IconLink({ to, iconName, children }: IconLinkProps) {
  return (
    <Link
      className="group absolute bottom-9 left-9 flex h-16 items-center justify-center gap-2.5 rounded-[54px] bg-white px-6 py-4 text-center text-xl font-semibold text-black no-underline"
      to={to}
    >
      <Icon
        name={iconName}
        className="icon-animation -ml-2.5 size-8 max-w-0 scale-75 opacity-0 group-hover:ml-0 group-hover:max-w-[32px] group-hover:scale-100 group-hover:opacity-100"
        aria-hidden="true"
      />
      {children}
    </Link>
  );
}

export let FEATURED_COLLECTION_QUERY = `#graphql
  ${COLLECTION_VIDEO_FRAGMENT}
  query FeaturedCollection($handle: String!, $country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    featuredCollection: collection(handle: $handle) {
      title
      handle
      image {
        ...ProductImage
      }
      video: metafield(key: "featured_video", namespace: "custom") {
        id
        reference {
          __typename
          ... on Video {
            ...CollectionVideo
          }
        }
      }
      featuredDescription: metafield(key: "featured_description", namespace:  "custom") {
        value
      }
    }
  }
` as const;
