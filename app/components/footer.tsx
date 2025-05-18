import { Await, Link } from "react-router";
import type { FooterQuery } from "storefrontapi.generated";
import { useRelativeUrl } from "~/lib/use-relative-url";
import { Icon } from "~/components/icon";
import { Suspense, useRef, useState } from "react";
import { useLayoutEffect, usePrefersReducedMotion } from "~/lib/hooks";
import { clsx } from "clsx";

import loadRunner1 from "~/assets/images/load-runner-1.webp";
import loadRunnerGif from "~/assets/images/load-runner.gif";

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
    <footer className="relative bg-black">
      <div
        className={clsx(
          "px-2 pb-16 py-32 font-mono text-xs leading-tight text-white uppercase transition-opacity duration-300",
          isVisible ? "opacity-100" : "opacity-30",
        )}
      >
        <div
          ref={footerRef}
          className="mx-auto flex max-w-fit flex-col gap-9 lg:gap-12"
        >
          <div className="flex flex-col items-center gap-1">
            <FooterLink to="collection/all">
              Remix Soft Wear Catalog V.1
            </FooterLink>
            <p>Designed in USA</p>
          </div>

          <div className="flex flex-col items-center gap-5 md:gap-6 lg:flex-row">
            {/* Animated load runner */}

            <Icon
              name="remix-logo"
              aria-label="Remix Logo"
              className="h-[42px] w-[168px] md:h-[54px] md:w-[216px] lg:h-[65px] lg:w-[260px]"
            />

            <div className="flex items-center gap-1">
              <div className="relative size-[70px]">
                <div
                  className={clsx(
                    "absolute inset-0 box-border rounded-full border-2 border-dotted border-white transition-[border] duration-150",
                    isVisible &&
                      "motion-safe:animate-spin motion-safe:border-4",
                  )}
                />
                <img
                  alt=""
                  aria-hidden={true}
                  src={loadRunner1}
                  className={clsx(
                    "relative size-full object-cover object-center",
                    isVisible ? "motion-safe:hidden" : "block",
                  )}
                />
                <img
                  alt=""
                  aria-hidden={true}
                  src={loadRunnerGif}
                  loading="eager"
                  className={clsx(
                    "relative size-full object-cover object-center",
                    isVisible
                      ? "motion-safe:block motion-reduce:hidden"
                      : "hidden",
                  )}
                />
              </div>

              <Icon
                name="remix-glyphs"
                aria-hidden={true}
                className="h-[70px] w-[146px]"
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
                  className="rounded-3xl border border-white px-1.5 py-1 transition-colors duration-300 hover:bg-white hover:text-black"
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
              <span className="text-base leading-none">©</span>
              <span>{new Date().getFullYear()} Shopify, Inc.</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
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
