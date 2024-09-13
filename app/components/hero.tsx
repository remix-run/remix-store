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
  subtitle?: string;
  href?: {
    to: string;
    text: string;
  };
};

export function Hero({ image, title, subtitle, href }: HeroProps) {
  const heightClasses = "h-[300px] md:h-[480px] xl:h-[540px]";

  return (
    <div
      // a neat trick taken from the Wes Bos: https://x.com/wesbos/status/1834640452865101907
      className={clsx("grid [&>*]:[grid-area:1/1]", heightClasses)}
    >
      {image && (
        <Image
          className={clsx("w-full object-cover", heightClasses)}
          data={image}
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
            className="flex h-12 min-w-fit items-center rounded-xl border-2 border-white p-4 font-bold uppercase tracking-[0.8px] no-underline"
            to={href.to}
          >
            {href.text}
          </Link>
        )}
      </div>
    </div>
  );

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
  className,
  style,
}: Partial<Pick<LinkProps, "to" | "children" | "className" | "style">>) {
  return to ? (
    <Link className={className} style={style} to={to}>
      {children}
    </Link>
  ) : (
    <div className={className} style={style}>
      {children}
    </div>
  );
}
