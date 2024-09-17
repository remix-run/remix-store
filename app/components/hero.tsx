import { Link } from "@remix-run/react";
import { clsx } from "clsx";
import { Image, Video } from "@shopify/hydrogen";
import type {
  CollectionVideoFragment,
  ProductImageFragment,
} from "storefrontapi.generated";
import { cn } from "~/lib";

// I don't see a good way to get this URL from the GraphQL API, should be fine to hardcode it here
const DEFAULT_IMAGE = {
  url: "https://cdn.shopify.com/s/files/1/0655/4127/5819/files/shirt-close-up.png?v=1726259004",
  width: 1200,
  height: 1200,
  altText: "Close-up of Remix tshirt",
};

type HeroProps = {
  title: string;
  subtitle?: string;
  href?: {
    to: string;
    text: string;
  };
  image?: ProductImageFragment | null;
  video?: CollectionVideoFragment | null;
  className?: string;
};
export function Hero({
  title,
  subtitle,
  video,
  image,
  href,
  className,
}: HeroProps) {
  const heightClasses = "h-[300px] md:h-[480px] xl:h-[540px]";

  return (
    <div
      // a neat trick taken from the Wes Bos: https://x.com/wesbos/status/1834640452865101907
      className={cn(
        "relative grid [&>*]:[grid-area:1/1]",
        heightClasses,
        // Temporary solution until we fix margins in https://github.com/remix-run/remix-store/issues/75
        "-mx-9",
        className,
      )}
    >
      {video ? (
        <>
          <Video
            className={clsx(
              "w-full object-cover motion-reduce:hidden",
              heightClasses,
            )}
            data={video}
            playsInline
            autoPlay
            muted
            loop
            controls={false}
          />
          {/* Kind of annoying to double render this image, but we need it in the event that there's a video and prefers-reduced-motion is enabled */}
          <Image
            className={clsx(
              "w-full object-cover motion-safe:hidden",
              heightClasses,
            )}
            data={image ?? DEFAULT_IMAGE}
            sizes="100vw"
            loading="eager"
          />
        </>
      ) : (
        <Image
          className={clsx("w-full object-cover", heightClasses)}
          data={image ?? DEFAULT_IMAGE}
          sizes="100vw"
          loading="eager"
        />
      )}
      <div className="flex w-full flex-col items-center gap-6 self-end justify-self-center p-6 text-white sm:p-9 md:flex-row md:items-end md:justify-between md:gap-0 md:justify-self-start">
        <div className="flex flex-col items-center gap-[18px] text-center md:items-start">
          {subtitle && (
            <p className="font-mono text-xs font-semibold uppercase leading-none tracking-[0.8px]">
              {subtitle}
            </p>
          )}

          <h1 className="text-4xl font-bold capitalize leading-none md:text-5xl md:tracking-[-1.44px] lg:text-6xl lg:tracking-[-1.92px]">
            {title}
          </h1>
        </div>

        {href && (
          <Link
            className="flex h-12 min-w-fit items-center rounded-xl border-2 border-white p-4 font-bold uppercase tracking-[0.8px] no-underline before:absolute before:inset-0 before:size-full hover:border-blue-brand hover:bg-blue-brand hover:text-white"
            to={href.to}
          >
            {href.text}
          </Link>
        )}
      </div>
    </div>
  );
}
