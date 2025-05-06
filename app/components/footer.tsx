import { Await, Link } from "@remix-run/react";
import type { FooterQuery } from "storefrontapi.generated";
import { useRelativeUrl } from "~/lib/use-relative-url";
import { RemixLogo } from "~/components/remix-logo";
import { Icon } from "~/components/icon";
import { cn } from "~/lib/cn";
import { Suspense } from "react";

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
    name: "twitter",
    label: "Twitter",
  },
  {
    href: "https://www.youtube.com/c/Remix-Run",
    name: "youtube",
    label: "YouTube",
  },
  { href: "https://rmx.as/discord", name: "discord", label: "Discord" },
] as const;

export function Footer({ footer: footerPromise }: FooterProps) {
  return (
    <footer className="group bg-black px-2 py-16 font-mono text-xs leading-tight text-white uppercase opacity-30 transition-opacity duration-300 focus-within:opacity-100 hover:opacity-100">
      <div className="mx-auto flex max-w-fit flex-col gap-9 lg:gap-12">
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
              <div className="absolute inset-0 box-border rounded-full border-2 border-dotted border-white transition-[border] duration-150 group-hover:animate-spin group-hover:border-4" />
              <img
                alt=""
                aria-hidden={true}
                src={loadRunner1}
                className="relative size-full object-cover object-center group-hover:hidden"
              />
              <img
                alt=""
                aria-hidden={true}
                src={loadRunnerGif}
                loading="eager"
                className="relative hidden size-full object-cover object-center group-hover:block"
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
                  className="opacity-100 transition-opacity duration-300 group-hover:opacity-50 hover:opacity-100"
                >
                  <span className="sr-only">{label}</span>
                  <Icon name={name} className="size-4 fill-white" />
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
      className={cn(
        "hover:text-blue-brand no-underline transition-colors duration-300 hover:font-bold",
        className,
      )}
    >
      {children}
    </Link>
  );
}
