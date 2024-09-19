import { Suspense } from "react";
import { Await, Link } from "@remix-run/react";
import type { FooterQuery, MenuFragment } from "storefrontapi.generated";
import clsx from "clsx";
import { useRelativeUrl } from "~/ui/primitives/utils";

interface FooterProps {
  footer: Promise<FooterQuery | null>;
  className?: string;
}

export function Footer({ footer: footerPromise, className }: FooterProps) {
  return (
    <footer className={clsx("min-h-24 py-12", className)}>
      <Suspense>
        <Await resolve={footerPromise}>
          {(footer) => {
            if (!footer) return null;
            return (
              <div
                className={clsx(
                  "mb-16 flex justify-center",
                  // mobile
                  "flex-col gap-y-[40px]",
                  // tablet
                  "sm:flex-row sm:flex-wrap sm:gap-x-[100px] sm:gap-y-[50px] sm:text-left",
                  // desktop
                  "md:gap-x-[120px]",
                )}
              >
                <FooterMenu menu={footer.remixShop} />
                <FooterMenu menu={footer.remixCommunity} />
                <FooterMenu menu={footer.remixResources} />
                <FooterMenu menu={footer.hydrogenResources} />
              </div>
            );
          }}
        </Await>
      </Suspense>
      <CopyrightContent />
    </footer>
  );
}

function FooterMenu({ menu }: { menu: MenuFragment | undefined | null }) {
  // sometimes GraphQL and all the nullability drives me crazy
  if (!menu) return null;

  return (
    <nav
      className="flex min-w-fit flex-col items-center gap-3 sm:items-start"
      role="navigation"
    >
      <h3 className="font-bold tracking-[-0.32px]">{menu.title}</h3>
      {menu.items.map((item) => {
        const url = item.url;
        if (!url) return null;
        return <FooterLink key={item.id} {...item} url={url} />;
      })}
    </nav>
  );
}

function FooterLink(props: { title: string; url: string }) {
  const { url, isExternal } = useRelativeUrl(props.url);

  return (
    <Link
      prefetch="intent"
      to={url}
      {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="text-sm tracking-[-0.28px] text-black no-underline dark:text-white"
    >
      {props.title}
    </Link>
  );
}

function CopyrightContent() {
  return (
    <div
      className={clsx(
        "flex text-center opacity-50",
        "flex-col items-center gap-3",
        "md:flex-row md:justify-center md:gap-12",
      )}
    >
      <div className="text-sm">The Remix Store was built with Hydrogen</div>
      <div className="min-w-fit text-sm">
        © {new Date().getFullYear()} Shopify, Inc.
      </div>
      <div className="text-sm">
        Hydrogen is an MIT Licensed Open Source project
      </div>
    </div>
  );
}
