import { Suspense } from "react";
import { Await, Link } from "@remix-run/react";
import type {
  FooterQuery,
  HeaderQuery,
  MenuFragment,
} from "storefrontapi.generated";
import clsx from "clsx";

interface FooterProps {
  footer: Promise<FooterQuery | null>;
  header: HeaderQuery;
  publicStoreDomain: string;
}

export function Footer({
  footer: footerPromise,
  header,
  publicStoreDomain,
}: FooterProps) {
  return (
    <>
      <footer className="min-h-24 py-12">
        <Suspense>
          <Await resolve={footerPromise}>
            {(footer) => {
              const primaryDomainUrl = header.shop.primaryDomain.url;
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
                  <FooterMenu
                    menu={footer.remixShop}
                    primaryDomainUrl={primaryDomainUrl}
                    publicStoreDomain={publicStoreDomain}
                  />
                  <FooterMenu
                    menu={footer.remixCommunity}
                    primaryDomainUrl={primaryDomainUrl}
                    publicStoreDomain={publicStoreDomain}
                  />
                  <FooterMenu
                    menu={footer.remixResources}
                    primaryDomainUrl={primaryDomainUrl}
                    publicStoreDomain={publicStoreDomain}
                  />
                  <FooterMenu
                    menu={footer.hydrogenResources}
                    primaryDomainUrl={primaryDomainUrl}
                    publicStoreDomain={publicStoreDomain}
                  />
                </div>
              );
            }}
          </Await>
        </Suspense>
        <CopyrightContent />
      </footer>
    </>
  );
}

function FooterMenu({
  menu,
  primaryDomainUrl,
  publicStoreDomain,
}: {
  menu: MenuFragment | undefined | null;
  primaryDomainUrl: string;
  publicStoreDomain: string;
}) {
  // sometimes GraphQL and all the nullability drives me crazy
  if (!menu) return null;

  return (
    <nav
      className="flex min-w-fit flex-col items-center gap-3 sm:items-start"
      role="navigation"
    >
      <h3 className="font-bold tracking-[-0.32px]">{menu.title}</h3>
      {menu.items.map((item) => {
        if (!item.url) return null;
        // if the url is internal, we strip the domain
        const url =
          item.url.includes("myshopify.com") ||
          item.url.includes(publicStoreDomain) ||
          item.url.includes(primaryDomainUrl)
            ? new URL(item.url).pathname
            : item.url;
        const isExternal = !url.startsWith("/");
        return (
          <Link
            key={item.id}
            prefetch="intent"
            to={url}
            {...(isExternal
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className="text-sm tracking-[-0.28px] text-black no-underline dark:text-white"
          >
            {item.title}
          </Link>
        );
      })}
    </nav>
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
