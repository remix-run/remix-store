import { Await, Link } from "@remix-run/react";
import type { FooterQuery } from "storefrontapi.generated";
import { clsx } from "clsx";
import { useRelativeUrl } from "~/lib/use-relative-url";
import { RemixLogo } from "~/components/remix-logo";
import { Icon } from "~/components/icon";
import { cn } from "~/lib/cn";
import { Suspense } from "react";

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
    <footer className="bg-black text-white">
      <div className="mx-auto max-w-7xl px-9 pt-16 pb-36 lg:px-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Logo and Social Links */}
          <div className="flex flex-col space-y-6">
            <a
              href="https://www.remix.run"
              target="_blank"
              rel="noopener noreferrer"
            >
              <RemixLogo />
            </a>
            <div className="flex space-x-4">
              {socials.map(({ href, name, label }) => (
                <a
                  key={name}
                  href={href}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="sr-only">{label}</span>
                  <Icon name={name} className="h-6 w-6 fill-white" />
                </a>
              ))}
            </div>
            <div className="text-sm">Docs and examples licensed under MIT</div>
            <div className="text-sm">© Shopify, Inc.</div>
          </div>

          {/* Navigation Menus */}
          <div className="col-span-2 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Suspense fallback={<ul className="space-y-2" />}>
                <Await resolve={footerPromise}>
                  {(footer) => {
                    if (!footer?.menu) return null;

                    return (
                      <ul className="space-y-2">
                        {footer.menu.items.map((item, i) => {
                          if (!item.url) return null;
                          return (
                            <li key={item.id}>
                              <FooterLink
                                className={clsx({
                                  "font-bold text-[#a1a1a1] hover:text-white":
                                    i === 0,
                                })}
                                title={item.title}
                                to={item.url}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    );
                  }}
                </Await>
              </Suspense>
            </div>

            <div className="lg:col-span-2">
              <h3 className="mb-4 text-base font-extrabold">About Remix</h3>
              <p className="text-sm">
                Remix is a full stack web framework that lets you focus on the
                user interface and work back through web standards to deliver a
                fast, slick, and resilient user experience.
              </p>
              <p className="mt-4 text-sm">
                This store is a way to celebrate the brand.
              </p>
            </div>
          </div>
        </div>
      </div>

      <RemixRainbow />
    </footer>
  );
}

function FooterLink({
  title,
  to,
  className,
}: {
  title: string;
  to: string;
  className: string;
}) {
  const { url, isExternal } = useRelativeUrl(to);

  return (
    <Link
      prefetch="intent"
      to={url}
      {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn("no-underline hover:font-bold hover:text-white", className)}
    >
      {title}
    </Link>
  );
}

function RemixRainbow() {
  return (
    <div className="flex aspect-[1600/36] h-auto w-full">
      <div className="flex-1 bg-[#0089ce]"></div>
      <div className="flex-1 bg-[#64c146]"></div>
      <div className="flex-1 bg-[#ffc100]"></div>
      <div className="flex-1 bg-[#ff71e4]"></div>
      <div className="flex-1 bg-[#f30]"></div>
    </div>
  );
}
