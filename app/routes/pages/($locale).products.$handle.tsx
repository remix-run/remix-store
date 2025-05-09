import { useState, useEffect, useRef } from "react";
import { useLayoutEffect } from "~/lib/hooks";
import { data, type LoaderFunctionArgs } from "@shopify/remix-oxygen";
import { Link, useLoaderData, type MetaArgs, useFetcher } from "react-router";
import type { ProductFragment } from "storefrontapi.generated";
import {
  type OptimisticCartLineInput,
  type MappedProductOptions,
  getSelectedProductOptions,
  CartForm,
  Analytics,
  RichText,
  useOptimisticVariant,
  getAdjacentAndFirstAvailableVariants,
  mapSelectedProductOptionToObject,
  getProductOptions,
} from "@shopify/hydrogen";
import { FOOTER_QUERY } from "~/lib/fragments";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "~/components/ui/dropdown-menu";
import { Icon } from "~/components/icon";
import { ProductImages } from "~/components/product-images";
import { ProductPrice } from "~/components/product-grid";
import { generateMeta } from "~/lib/meta";
import { getProductData } from "~/lib/data/product.server";
import { useRelativeUrl } from "~/lib/use-relative-url";
import { cva } from "class-variance-authority";
import { cn } from "~/lib/cn";
import type { RootLoader } from "~/root";

export function meta({
  data,
  matches,
}: MetaArgs<typeof loader, { root: RootLoader }>) {
  if (!data) return generateMeta();

  let { product } = data;
  let { siteUrl } = matches[0].data;

  // Use product image if available
  let image = product.images?.nodes[0]?.url
    ? product.images.nodes[0].url
    : "/og_image.jpg";

  return generateMeta({
    // I think there's a better way to get seo data using some Hydrogen helpers
    title: product.seo?.title || product.title,
    description: product.seo?.description ?? undefined,
    image,
    url: siteUrl,
  });
}

export async function loader(args: LoaderFunctionArgs) {
  let { request, params, context } = args;
  let { storefront } = context;
  let { handle } = params;

  if (!handle) {
    throw new Error("Expected product handle to be defined");
  }

  let productPromise = getProductData(storefront, {
    variables: {
      handle,
      selectedOptions: getSelectedProductOptions(request),
    },
  });

  // Not sure if this will always be the same as the footer menu
  let menuPromise = storefront
    .query(FOOTER_QUERY, {
      cache: storefront.CacheLong(),
    })
    .then((data) => {
      let menu: MenuItem[] = [];
      if (!data.menu) {
        return menu;
      }
      for (let item of data.menu.items) {
        if (!item.url) continue;
        menu.push({
          label: item.title,
          to: item.url,
        });
      }
      return menu;
    });

  let [menu, product] = await Promise.all([menuPromise, productPromise]);

  return data({
    menu,
    product,
  });
}

export default function Product() {
  let { menu, product } = useLoaderData<typeof loader>();

  // Optimistically selects a variant with given available variant information
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );

  // Sets the search param to the selected variant without navigation
  // only when no search params are set in the url
  useLayoutEffect(() => {
    if (window.location.search !== "") return;

    const searchParams = new URLSearchParams(
      mapSelectedProductOptionToObject(selectedVariant.selectedOptions || []),
    );

    if (searchParams.toString() === "") return;

    window.history.replaceState(
      {},
      "",
      `${location.pathname}?${searchParams.toString()}`,
    );
  }, [selectedVariant.selectedOptions]);

  // Get the product options array
  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  return (
    <div className="relative mt-(--header-height) flex min-h-[90vh] flex-col gap-4 overflow-x-clip md:flex-row md:justify-between md:gap-8 md:px-4 lg:px-9">
      <CollectionsMenu menu={menu} />

      <ProductImages images={product?.images.nodes} />

      <ProductMain
        selectedVariant={selectedVariant}
        product={product}
        productOptions={productOptions}
      />

      <Analytics.ProductView
        data={{
          products: [
            {
              id: product.id,
              title: product.title,
              price: selectedVariant?.price.amount || "0",
              vendor: product.vendor,
              variantId: selectedVariant?.id || "",
              variantTitle: selectedVariant?.title || "",
              quantity: 1,
            },
          ],
        }}
      />
    </div>
  );
}

type MenuItem = {
  label: string;
  to: string;
};

function CollectionsMenu({ menu }: { menu: MenuItem[] }) {
  return (
    <nav className="sticky top-(--header-height) hidden h-fit min-w-fit md:block lg:pt-32">
      <ul className="flex flex-col gap-1">
        {menu.map((item) => {
          if (!item.to) return null;
          return (
            <li key={item.to}>
              <MenuLink to={item.to}>{item.label}</MenuLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function MenuLink({ to, children }: { to: string; children: React.ReactNode }) {
  let { url } = useRelativeUrl(to);
  return (
    <Link
      className="text-xs leading-5 text-white/90 transition-[color] hover:text-white lg:text-base lg:leading-6"
      to={url}
      prefetch="intent"
    >
      {children}
    </Link>
  );
}

function ProductMain({
  selectedVariant,
  product,
  productOptions,
}: {
  product: ProductFragment;
  selectedVariant: NonNullable<
    ProductFragment["selectedOrFirstAvailableVariant"]
  >;
  productOptions: MappedProductOptions[];
}) {
  let { title, category, technicalDescription } = product;
  const mainDescription = product.customDescription?.value;

  return (
    <div className="static top-(--header-height) mx-4 flex max-h-fit flex-col gap-6 text-white md:sticky md:mx-0 md:max-w-xl md:basis-1/3 lg:gap-9 lg:pt-32">
      <div className="flex flex-col gap-4">
        {category ? (
          <p className="text-xs lg:text-base">{category?.name}</p>
        ) : null}
        <h1 className="min-w-max font-sans text-2xl font-bold lg:text-4xl">
          {title}
        </h1>
        <ProductPrice
          price={selectedVariant.price}
          compareAtPrice={selectedVariant.compareAtPrice}
        />
      </div>

      <ProductForm
        productOptions={productOptions}
        selectedVariant={selectedVariant}
      />

      {mainDescription ? (
        <RichText
          className="rich-text text-xs lg:text-base"
          data={mainDescription}
        />
      ) : null}
      {technicalDescription ? (
        <>
          <h3 className="text-sm font-bold lg:text-base">
            Technical Description
          </h3>

          <RichText
            className="rich-text text-xs lg:text-base"
            data={technicalDescription.value}
          />
        </>
      ) : null}
    </div>
  );
}

function ProductForm({
  productOptions,
  selectedVariant,
}: {
  productOptions: MappedProductOptions[];
  selectedVariant: ProductFragment["selectedOrFirstAvailableVariant"];
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-3">
      <div className="flex flex-col gap-4 lg:flex-auto">
        {productOptions.map((option) => (
          <ProductOptions key={option.name} option={option} />
        ))}
      </div>

      <AddToCartButton
        disabled={!selectedVariant || !selectedVariant.availableForSale}
        lines={
          selectedVariant
            ? [
                {
                  merchandiseId: selectedVariant.id,
                  quantity: 1,
                  selectedVariant,
                },
              ]
            : []
        }
      >
        {selectedVariant?.availableForSale ? "Add to cart" : "Sold out"}
      </AddToCartButton>
    </div>
  );
}

function ProductOptions({ option }: { option: MappedProductOptions }) {
  const selectedValueName = option.optionValues.find((ov) => ov.selected)?.name;

  return (
    <div className="relative w-full lg:flex-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="focus-visible:ring-blue-brand flex w-full items-center justify-between rounded-[54px] border-[3px] border-white px-6 py-4 text-xl font-semibold outline-none focus-visible:ring-2 data-[state=open]:[&_svg]:-rotate-180">
            <span>{selectedValueName || option.name}</span>
            <Icon
              name="chevron-down"
              className="ml-2 size-6 transition-transform duration-200 ease-in"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="center"
          className="w-[var(--radix-dropdown-menu-trigger-width)] rounded-4xl border border-[#222222] bg-[#111111] p-0"
          sideOffset={10}
        >
          {option.optionValues.map((valueOption) => {
            const { name, variantUriQuery, selected, available } = valueOption;

            return (
              <DropdownMenuItem
                key={option.name + name}
                asChild
                disabled={!available}
                className={cn(
                  "rounded-4xl px-5 py-5 text-lg",
                  "data-[highlighted]:bg-white/5",
                  available
                    ? "text-white data-[highlighted]:text-white"
                    : "cursor-not-allowed text-white/30 data-[highlighted]:text-white/30",
                )}
              >
                <Link
                  prefetch="intent"
                  preventScrollReset
                  replace
                  to={{ search: variantUriQuery }}
                  className={cn(
                    "flex w-full items-center justify-between text-xl hover:text-white",
                    !available && "text-white/30",
                  )}
                  onClick={(e) => {
                    if (!available) e.preventDefault();
                  }}
                  tabIndex={!available ? -1 : undefined}
                  aria-disabled={!available}
                >
                  {name}
                  {selected && <Icon name="check" className="size-5" />}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

let addToCartButtonVariants = cva(
  [
    "relative flex min-h-16 items-center justify-center overflow-hidden rounded-[54px] px-6 py-4 text-xl font-semibold whitespace-nowrap duration-300",
    "lg:min-w-20 lg:transition-[flex]",
  ],
  {
    variants: {
      pending: {
        false: "bg-white text-black lg:flex-1",
        true: "bg-[#6EDE49] text-white lg:flex-0",
      },
      disabled: {
        false: "transition-color duration-300 lg:min-w-20 lg:transition-[flex]",
        true: "bg-white/20 text-white/80",
      },
    },
    defaultVariants: {
      pending: false,
      disabled: false,
    },
  },
);

type AddToCartButtonProps = {
  analytics?: unknown;
  children: React.ReactNode;
  disabled?: boolean;
  lines: Array<OptimisticCartLineInput>;
  onClick?: () => void;
  className?: string;
};

function AddToCartButton({
  analytics,
  children,
  disabled,
  lines,
  onClick,
  className,
}: AddToCartButtonProps) {
  let fetcher = useFetcher();
  let [pending, setPending] = useState(false);
  let loadStartTime = useRef<number | null>(null);

  let fetcherPending = fetcher.state !== "idle";

  // Delays the resolving of the pending state to be a min of 2 seconds
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    if (fetcherPending) {
      // Start loading - record the start time
      loadStartTime.current = Date.now();
      setPending(true);
    } else if (loadStartTime.current !== null) {
      // Finished loading - calculate how long to wait
      let elapsedTime = Date.now() - loadStartTime.current;
      let remainingTime = Math.max(2000 - elapsedTime, 0);

      // Clear any existing timeout
      if (timeoutId) clearTimeout(timeoutId);

      // Set timeout for remaining time (if any)
      timeoutId = setTimeout(() => {
        setPending(false);
        loadStartTime.current = null;
      }, remainingTime);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [fetcherPending]);

  return (
    <fetcher.Form
      method="post"
      action="/cart"
      className={cn(addToCartButtonVariants({ pending, disabled }), className)}
    >
      <input
        type="hidden"
        name={CartForm.INPUT_NAME}
        value={JSON.stringify({
          action: CartForm.ACTIONS.LinesAdd,
          inputs: { lines },
        })}
      />
      <input name="analytics" type="hidden" value={JSON.stringify(analytics)} />
      <button
        className="not-disabled:cursor-pointer"
        type="submit"
        onClick={onClick}
        disabled={disabled ?? pending}
      >
        <span className="absolute inset-0" />
        {pending ? (
          <Icon name="check" className="add-to-cart-icon size-8" />
        ) : (
          children
        )}
      </button>
    </fetcher.Form>
  );
}
