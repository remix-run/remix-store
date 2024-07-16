import { Suspense } from "react";
import { Await, Link } from "@remix-run/react";
import type { FooterQuery, HeaderQuery } from "storefrontapi.generated";

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
    <Suspense>
      <Await resolve={footerPromise}>
        {(footer) => (
          <footer className="inline-flex w-full justify-center gap-4 border-t-[1px] border-neutral-400 border-opacity-20 bg-neutral-200 dark:bg-neutral-800 md:gap-20 lg:gap-28 xl:gap-32">
            {footer?.col1 && header.shop.primaryDomain?.url && (
              <FooterMenu
                menu={footer.col1}
                primaryDomainUrl={header.shop.primaryDomain.url}
                publicStoreDomain={publicStoreDomain}
              />
            )}
            {footer?.col2 && header.shop.primaryDomain?.url && (
              <FooterMenu
                menu={footer.col2}
                primaryDomainUrl={header.shop.primaryDomain.url}
                publicStoreDomain={publicStoreDomain}
              />
            )}
            {footer?.col3 && header.shop.primaryDomain?.url && (
              <FooterMenu
                menu={footer.col3}
                primaryDomainUrl={header.shop.primaryDomain.url}
                publicStoreDomain={publicStoreDomain}
              />
            )}
            {footer?.col4 && header.shop.primaryDomain?.url && (
              <FooterMenu
                menu={footer.col4}
                primaryDomainUrl={header.shop.primaryDomain.url}
                publicStoreDomain={publicStoreDomain}
              />
            )}
          </footer>
        )}
      </Await>
      <CopyrightContent />
    </Suspense>
  );
}

function FooterMenu({
  menu,
  primaryDomainUrl,
  publicStoreDomain,
}: {
  menu: FooterQuery["col1"];
  primaryDomainUrl: FooterProps["header"]["shop"]["primaryDomain"]["url"];
  publicStoreDomain: string;
}) {
  return (
    <nav
      className="flex-col items-start justify-start gap-y-2 py-10"
      role="navigation"
    >
      <h3 className="dark-text-white justify-start py-1 font-body text-xs font-bold tracking-tight">
        {menu?.title}
      </h3>
      {(menu || FALLBACK_FOOTER_MENU).items.map((item) => {
        if (!item.url) return null;
        // if the url is internal, we strip the domain
        const url =
          item.url.includes("myshopify.com") ||
          item.url.includes(publicStoreDomain) ||
          item.url.includes(primaryDomainUrl)
            ? new URL(item.url).pathname
            : item.url;
        const isExternal = !url.startsWith("/");
        return isExternal ? (
          <a
            href={url}
            key={item.id}
            rel="noopener noreferrer"
            target="_blank"
            className="flex items-center gap-1 py-1 text-xs font-thin"
          >
            {item.title}
          </a>
        ) : (
          <Link
            key={item.id}
            prefetch="intent"
            to={url}
            className="flex items-start gap-1 py-1 text-xs font-thin"
          >
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}

const FALLBACK_FOOTER_MENU = {
  id: "gid://shopify/Menu/199655620664",
  items: [
    {
      id: "gid://shopify/MenuItem/461633060920",
      resourceId: "gid://shopify/ShopPolicy/23358046264",
      tags: [],
      title: "Privacy Policy",
      type: "SHOP_POLICY",
      url: "/policies/privacy-policy",
      items: [],
    },
    {
      id: "gid://shopify/MenuItem/461633093688",
      resourceId: "gid://shopify/ShopPolicy/23358013496",
      tags: [],
      title: "Refund Policy",
      type: "SHOP_POLICY",
      url: "/policies/refund-policy",
      items: [],
    },
    {
      id: "gid://shopify/MenuItem/461633126456",
      resourceId: "gid://shopify/ShopPolicy/23358111800",
      tags: [],
      title: "Shipping Policy",
      type: "SHOP_POLICY",
      url: "/policies/shipping-policy",
      items: [],
    },
    {
      id: "gid://shopify/MenuItem/461633159224",
      resourceId: "gid://shopify/ShopPolicy/23358079032",
      tags: [],
      title: "Terms of Service",
      type: "SHOP_POLICY",
      url: "/policies/terms-of-service",
      items: [],
    },
  ],
};

function CopyrightContent() {
  return (
    <div className="flex justify-center bg-neutral-200 pb-6 text-xs text-neutral-400 dark:bg-neutral-800">
      <div className="mx-6">The Remix Store was built with Hydrogen</div>
      <div className="mx-6">© {new Date().getFullYear()} Shopify, Inc.</div>
      <div className="mx-6">
        Hydrogen is an MIT Licensed Open Source project
      </div>
    </div>
  );
}
