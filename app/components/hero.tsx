import type { LinkProps } from "@remix-run/react";
import { Link } from "@remix-run/react";
import { clsx } from "clsx";

import ledScreen from "~/assets/led-screen.png";
import ledMiniSkateboard from "~/assets/led-screen-mini-skateboard.png";

type HeroProps = {
  image?: boolean; // TODO - replace with actual image type
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
            "hero-led-background relative flex h-[192px] w-full overflow-hidden rounded-3xl bg-blue-led sm:h-[300px]",
            !hasImage && "flex justify-center",
          )}
        >
          <div
            className={clsx(
              "hero-image absolute h-full w-full",
              hasImage && "opacity-50 sm:opacity-100",
            )}
            // TODO: get from Shopify CDN
            style={{
              // @ts-expect-error -- you can use css vars, it's fine
              "--hero-bg-image": `url(${hasImage ? ledMiniSkateboard : ledScreen})`,
            }}
          />
          {/* {image && (
            <Image
              className="absolute top-1/2 -translate-y-1/2"
              data={image}
              sizes="100vw"
              alt=""
            />
          )} */}
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
  const className = "relative mb-8 block bg-neutral-200 dark:bg-neutral-800";
  return to ? (
    <Link className={className} to={to}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}
