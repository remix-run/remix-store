import type { LinkProps } from "@remix-run/react";
import { Link } from "@remix-run/react";
import { clsx } from "clsx";
import { Image } from "@shopify/hydrogen";
import type { HydrogenImageProps } from "./Image";
import type { Maybe } from "@shopify/hydrogen/customer-account-api-types";

// TODO: get from Shopify CDN
const ledScreenUrl =
  "https://cdn.shopify.com/s/files/1/0655/4127/5819/files/led-screen.png?v=1723231764";
const miniSkateboardUrl =
  "https://cdn.shopify.com/s/files/1/0655/4127/5819/files/led-screen-mini-skateboard.png?v=1723231764";

type HeroProps = {
  image?: Maybe<HydrogenImageProps>; // TODO - replace with actual image type
  title: string;
  subtitle: string;
  to?: string;
};

export function Hero({ image, title, subtitle, to }: HeroProps) {
  const hasImage = !!image;

  return (
    <Container to={to}>
      <div className="hero-frame h-[240px] w-full rounded-[36px] border-2 border-black p-6 sm:h-[348px]">
        <div
          className={clsx(
            "relative flex h-[192px] w-full overflow-hidden rounded-3xl bg-blue-led sm:h-[300px]",
            !hasImage && "flex justify-center",
          )}
        >
          <Image
            className={clsx(
              "absolute h-full w-full object-cover",
              hasImage && "opacity-50 sm:opacity-100",
            )}
            // TODO: figure out how to get this data from GraphQL
            data={
              hasImage
                ? image
                : {
                    url: ledScreenUrl,
                    width: 1342,
                    height: 310,
                    altText: "",
                  }
            }
            sizes="100vw"
            loading="eager"
          />
          <div className="hero-gradient-mask absolute h-full w-full rounded-3xl" />
          <div
            className={clsx(
              "absolute flex h-full select-none flex-col justify-center gap-2 p-6 text-center",
              hasImage && "sm:pl-9 sm:text-left lg:pl-[100px]",
            )}
          >
            <p className="text-shadow-hero font-mono text-xs font-semibold uppercase tracking-[0.48px] text-black text-opacity-80 sm:tracking-[0.64px] md:text-base">
              {subtitle}
            </p>
            <h1 className="text-shadow-hero font-header max-w-[484px] text-[64px] font-normal capitalize leading-[75%] text-black text-opacity-80 md:text-[84px]">
              {title}
            </h1>
          </div>
        </div>
      </div>
    </Container>
  );
}

function Container({
  to,
  children,
}: {
  to?: LinkProps["to"];
  children: React.ReactNode;
}) {
  const className = "relative mb-8 block";
  return to ? (
    <Link className={className} to={to}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}
