import { Await, href, Link } from "react-router";
import type { FooterQuery } from "storefrontapi.generated";
import { useRelativeUrl } from "~/lib/use-relative-url";
import { Icon } from "~/components/icon";
import { Suspense, useRef, useState } from "react";
import { useLayoutEffect, usePrefersReducedMotion } from "~/lib/hooks";
import { clsx } from "clsx";
import { RemixRunner } from "~/components/remix-runner";

let footerGradientStripCount = 33;
let footerGradientStaggerMs = 80;

interface FooterProps {
  footer: Promise<FooterQuery | null>;
}

let socials = [
  {
    href: "https://github.com/remix-run",
    name: "github",
    label: "GitHub",
  },
  {
    href: "https://x.com/remix_run",
    name: "x-logo",
    label: "X",
  },
  {
    href: "https://www.youtube.com/c/Remix-Run",
    name: "youtube",
    label: "YouTube",
  },
  { href: "https://rmx.as/discord", name: "discord", label: "Discord" },
] as const;

export function Footer({ footer: footerPromise }: FooterProps) {
  let footerRef = useRef<HTMLDivElement>(null);
  let [visibleState, setVisibleState] = useState<
    "initializing" | "visible" | "hidden"
  >("initializing");
  let prefersReducedMotion = usePrefersReducedMotion();

  useLayoutEffect(() => {
    let footerEl = footerRef.current;
    if (!footerEl || prefersReducedMotion) return;

    let observer = new window.IntersectionObserver(
      ([entry]) => {
        setVisibleState(entry.intersectionRatio >= 0.35 ? "visible" : "hidden");
      },
      { threshold: [0, 0.35, 1] },
    );
    observer.observe(footerEl);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  // Show the footer when:
  // - users prefer reduced motion
  // - JS has not finished loading
  // - JS has loaded and the intersection observer has been triggered
  let isVisible = prefersReducedMotion || visibleState !== "hidden";

  return (
    <footer className="relative isolate overflow-hidden bg-black">
      <FooterGradientStrips animate={isVisible && !prefersReducedMotion} />
      <div
        className={clsx(
          "relative z-10 px-2 py-32 pb-16 font-mono text-xs/tight text-white uppercase transition-opacity duration-300",
          isVisible ? "opacity-100" : "opacity-30",
        )}
      >
        <div
          ref={footerRef}
          className="mx-auto flex max-w-fit flex-col gap-9 lg:gap-12"
        >
          <div className="flex flex-col items-center gap-1">
            <FooterLink
              to={href("/:locale?/collections/:handle", { handle: "all" })}
            >
              Remix Soft Wear Catalog V.1.4
            </FooterLink>
            <p>Designed in USA</p>
          </div>

          <div className="flex flex-col items-center gap-5 md:gap-6 lg:flex-row">
            {/* Animated load runner */}

            <Icon
              name="remix-logo"
              aria-label="Remix Logo"
              className="h-auto w-[168px] text-white md:w-[216px] lg:w-[260px]"
            />

            <div className="flex items-center gap-1">
              <div className="relative size-[55px] md:size-[70px]">
                <div
                  className={clsx(
                    "absolute inset-0 box-border rounded-full border-2 border-dotted border-white transition-[border] duration-150",
                    isVisible &&
                      "motion-safe:animate-spin motion-safe:border-4",
                  )}
                />
                <RemixRunner
                  alt=""
                  aria-hidden={true}
                  animate={isVisible}
                  loading="eager"
                  className="relative left-1/2 top-1/2 size-3/4 -translate-x-1/2 -translate-y-1/2 object-contain object-center"
                />
              </div>

              <Icon
                name="remix-glyphs"
                aria-hidden={true}
                className="h-[55px] w-[115px] md:h-[70px] md:w-[146px]"
              />
            </div>
          </div>

          <div className="flex items-start gap-9">
            <div className="flex flex-col items-end gap-2 text-right">
              <p>Remix is for everyone</p>
              <p>Remix is an engineering team</p>
              <p>Remix builds tools for a better web</p>

              <nav className="flex items-center gap-4 py-1.5">
                <a
                  href="https://www.remix.run"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-3xl border border-white px-2 py-1 transition-colors duration-300 hover:bg-white hover:text-black"
                >
                  remix.run
                </a>

                {socials.map(({ href, name, label }) => (
                  <a
                    key={name}
                    href={href}
                    aria-label={label}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={clsx(
                      "transition-opacity duration-300",
                      isVisible
                        ? "opacity-50 hover:opacity-100"
                        : "opacity-100",
                    )}
                  >
                    <span className="sr-only">{label}</span>
                    <Icon
                      name={name}
                      className="size-4 fill-white text-white"
                    />
                  </a>
                ))}
              </nav>
            </div>

            <nav className="flex flex-col items-start gap-2">
              <Suspense fallback={null}>
                <Await resolve={footerPromise}>
                  {(footer) => {
                    return footer?.menu?.items.map((item) => {
                      if (!item.url) return null;

                      return (
                        <FooterLink key={item.id} to={item.url}>
                          {item.title}
                        </FooterLink>
                      );
                    });
                  }}
                </Await>
              </Suspense>
            </nav>
          </div>

          <div className="flex flex-col items-center gap-1">
            <p>Docs and Examples licensed under MIT</p>
            <p className="flex items-start gap-1">
              <span className="text-base/none">©</span>
              <span>{new Date().getFullYear()} Shopify, Inc.</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterGradientStrips({ animate }: { animate: boolean }) {
  let centerIndex = Math.floor(footerGradientStripCount / 2);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0"
    >
      <div className="absolute inset-0 bg-black" />
      <div className="absolute inset-x-0 top-0 z-10 h-48 bg-linear-to-b from-black via-black/90 to-transparent" />
      <div className="absolute inset-x-[-18%] top-12 bottom-[-18%]">
        <div className="relative flex h-full justify-center">
          {Array.from({ length: footerGradientStripCount }).map((_, index) => {
            let distanceFromCenter = Math.abs(index - centerIndex);

            return (
              <span
                // eslint-disable-next-line react/no-array-index-key -- decorative staggered strips
                key={index}
                className={clsx(
                  "relative z-0 block h-full min-h-[260px] w-[clamp(18px,4vw,72px)] origin-bottom scale-y-100 self-end rounded-none [background:linear-gradient(0deg,hsl(3_100%_61%)_8%,hsl(313_88%_62%)_22%,hsl(48_94%_62%)_38%,hsl(104_68%_60%)_56%,hsl(202_94%_60%)_78%,var(--color-black)_100%)] motion-reduce:scale-y-100",
                  animate && "footer-gradient-strip-animated",
                )}
                style={
                  {
                    "--strip-delay": `${
                      distanceFromCenter * footerGradientStaggerMs
                    }ms`,
                  } as React.CSSProperties
                }
              />
            );
          })}
          <div
            className={clsx(
              "pointer-events-none absolute inset-0 z-[1] opacity-[0.85] [background:linear-gradient(180deg,rgb(0_0_0_/_1)_0%,rgb(0_0_0_/_0.82)_100%)] motion-reduce:opacity-[0.58]",
              animate && "footer-gradient-strip-shade-animated",
            )}
          />
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-black/30 to-transparent" />
    </div>
  );
}

function FooterLink({
  children,
  to,
  className,
}: {
  children: React.ReactNode;
  to: string;
  className?: string;
}) {
  const { url, isExternal } = useRelativeUrl(to);

  return (
    <Link
      prefetch="intent"
      to={url}
      {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={className}
    >
      {children}
    </Link>
  );
}
