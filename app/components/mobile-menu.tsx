import { NavLink } from "react-router";
import type { NavLinkProps } from "react-router";
import type { HeaderQuery } from "storefrontapi.generated";
import { Icon } from "~/components/icon";
import { DetailsMenu } from "~/components/ui/details-menu";
import { cn } from "~/lib/cn";
import { useRelativeUrl } from "~/lib/use-relative-url";

interface MobileMenuProps {
  menu: NonNullable<HeaderQuery["menu"]>;
}

export function MobileMenu({ menu }: MobileMenuProps) {
  return (
    <DetailsMenu className="group relative flex md:hidden">
      <summary className="flex h-12 cursor-pointer list-none items-center justify-center rounded-[54px] border-2 border-transparent bg-white px-5 py-2 text-black transition-colors select-none [&::-webkit-details-marker]:hidden hover:bg-gray-100 focus-visible:border-blue-brand focus-visible:bg-gray-100 focus-visible:outline-none md:h-16 md:px-6 md:py-4">
        <span className="sr-only">Navigation menu</span>
        <Icon name="menu" className="size-6 md:size-8" />
      </summary>
      <nav className="absolute top-[calc(100%+0.75rem)] right-0 z-50 min-w-[220px] rounded-3xl bg-black/90 p-2 shadow-2xl ring-1 ring-white/10 backdrop-blur">
        <ul className="flex flex-col gap-1">
          {menu.items.map((item) => {
            if (!item.url) return null;
            return (
              <li key={item.url}>
                <MobileMenuLink
                  title={item.title}
                  url={item.url}
                  className="block w-full rounded-2xl border border-transparent px-4 py-3 text-lg transition-colors hover:bg-white/5 hover:text-blue-brand focus-visible:border-blue-brand focus-visible:bg-white/5 focus-visible:text-blue-brand focus-visible:outline-none"
                />
              </li>
            );
          })}
        </ul>
      </nav>
    </DetailsMenu>
  );
}

type MobileMenuLinkProps = {
  title: string;
  url: string;
  className?: string;
} & Omit<NavLinkProps, "children" | "className" | "to">;

function MobileMenuLink(props: MobileMenuLinkProps) {
  let { title, url: itemUrl, className, ...navLinkProps } = props;
  let { url } = useRelativeUrl(itemUrl);

  return (
    <NavLink
      className={cn("text-base/tight font-semibold no-underline", className)}
      to={url}
      prefetch="intent"
      {...navLinkProps}
    >
      {title}
    </NavLink>
  );
}
