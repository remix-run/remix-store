import type { LinkProps } from "@remix-run/react";
import { Link } from "@remix-run/react";
import { clsx } from "clsx";
import { Image } from "@shopify/hydrogen";
import type { ProductImageFragment } from "storefrontapi.generated";

// I don't see a good way to get this URL from the GraphQL API, should be fine to hardcode it here
const DEFAULT_IMAGE = {
  url: "https://cdn.shopify.com/s/files/1/0655/4127/5819/files/led-screen.png?v=1723231764",
  width: 1342,
  height: 310,
  altText: "",
};

type HeroProps = {
  image?: ProductImageFragment | null;
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
            data={image ?? DEFAULT_IMAGE}
            sizes="100vw"
            loading="eager"
          />
          <div className="hero-gradient-mask absolute h-full w-full rounded-3xl" />
          <div
            className={clsx(
              "absolute flex h-full w-full select-none flex-col justify-center gap-2 p-6 text-center",
              hasImage ? "sm:pl-9 sm:text-left lg:pl-[100px]" : "items-center",
            )}
          >
            <p className="text-shadow-hero font-mono text-xs font-semibold uppercase tracking-[0.48px] text-black text-opacity-80 sm:tracking-[0.64px] md:text-base">
              {subtitle}
            </p>
            <h1
              className={clsx(
                "text-shadow-hero max-w-[484px] font-sans text-6xl font-normal capitalize leading-[0.75] text-black text-opacity-80",
                "md:text-8xl md:leading-[0.75]",
              )}
            >
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
