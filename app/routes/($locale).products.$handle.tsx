import { useState, useEffect, useRef } from "react";
import { data, type LoaderFunctionArgs } from "@shopify/remix-oxygen";
import {
  Link,
  useLoaderData,
  useSearchParams,
  type MetaArgs,
  useFetcher,
} from "@remix-run/react";
import type {
  ProductFragment,
  ProductVariantFragment,
} from "storefrontapi.generated";
import {
  type OptimisticCartLineInput,
  Money,
  VariantSelector,
  type VariantOption,
  getSelectedProductOptions,
  CartForm,
  Analytics,
  useAnalytics,
  RichText,
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
import type { RootLoader } from "~/root";
import { getProductData, getProductVariants } from "~/lib/data/product.server";
import { useRelativeUrl } from "~/lib/use-relative-url";
import { cva } from "class-variance-authority";
import { cn } from "~/lib/cn";
import { clsx } from "clsx";

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

  let variantsPromise = getProductVariants(storefront, {
    variables: { handle },
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

  let productPromise = getProductData(storefront, {
    variables: {
      handle,
      selectedOptions: getSelectedProductOptions(request),
    },
  });

  let [menu, product, variants] = await Promise.all([
    menuPromise,
    productPromise,
    variantsPromise,
  ]);

  return data({
    menu,
    product,
    variants,
  });
}

export default function Product() {
  let { menu, product, variants } = useLoaderData<typeof loader>();
  let { selectedVariant } = product;

  // If a variant isn't selected, use the first variant for price, analytics, etc
  if (!selectedVariant) {
    selectedVariant = product.variants.nodes[0];
  }

  return (
    <div className="relative mt-(--header-height) flex min-h-[90vh] flex-col gap-4 overflow-x-clip md:flex-row md:justify-between md:gap-8 md:px-4 lg:px-9">
      <CollectionsMenu menu={menu} />

      <ProductImages images={product?.images.nodes} />

      <ProductMain
        selectedVariant={selectedVariant}
        product={product}
        variants={variants}
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
    >
      {children}
    </Link>
  );
}

function ProductMain({
  selectedVariant,
  product,
  variants,
}: {
  product: ProductFragment;
  selectedVariant: NonNullable<ProductFragment["selectedVariant"]>;
  variants: Array<ProductVariantFragment>;
}) {
  let { title, category, description, technicalDescription } = product;

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
        product={product}
        selectedVariant={selectedVariant}
        variants={variants}
      />

      {description ? (
        <RichText
          className="rich-text text-xs lg:text-base"
          data={description.value}
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
  product,
  selectedVariant,
  variants,
}: {
  product: ProductFragment;
  selectedVariant: NonNullable<ProductFragment["selectedVariant"]>;
  variants: Array<ProductVariantFragment>;
}) {
  let { publish, shop, cart, prevCart } = useAnalytics();
  let isAvailable = !!selectedVariant?.availableForSale;

  return (
    <div className="flex flex-col gap-[18px] md:gap-8">
      <div className="flex flex-col gap-2 md:gap-3 lg:flex-row">
        <VariantSelector
          handle={product.handle}
          options={product.options}
          variants={variants}
        >
          {({ option }) => <ProductOptions key={option.name} option={option} />}
        </VariantSelector>
        <AddToCartButton
          disabled={!selectedVariant || !isAvailable}
          lines={
            selectedVariant
              ? [
                  {
                    merchandiseId: selectedVariant.id,
                    quantity: 1,
                    selectedVariant: { ...selectedVariant, product },
                  },
                ]
              : []
          }
          // This handles overriding the animation on larger screens if there's
          // not a variant selector
          className={clsx({ "lg:flex-1": product.options.length === 0 })}
        >
          {isAvailable ? "Add to cart" : "Sold out"}
        </AddToCartButton>
      </div>
    </div>
  );
}

function ProductOptions({ option }: { option: VariantOption }) {
  let [searchParams] = useSearchParams();
  let selectedOption = searchParams.get(option.name);

  return (
    <div className="relative w-full lg:flex-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex w-full items-center justify-between rounded-[54px] border-[3px] border-white px-6 py-4 text-xl font-semibold data-[state=open]:[&_svg]:-rotate-180">
            <span>{selectedOption || option.name}</span>
            <Icon
              name="chevron-down"
              className="ml-2 size-6 transition-transform duration-200 ease-in"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="center"
          className="w-[var(--radix-dropdown-menu-trigger-width)] rounded-4xl border border-[#222222] bg-[#111111]"
          sideOffset={10}
        >
          {option.values.map(({ value, isAvailable, isActive, to }) => (
            <DropdownMenuItem
              key={option.name + value}
              asChild
              // disabled={!isAvailable}
              className="rounded-4xl px-5 py-4 text-lg text-white data-[highlighted]:bg-white/5 data-[highlighted]:text-white"
            >
              <Link
                prefetch="intent"
                preventScrollReset
                replace
                to={to}
                className={cn(
                  "flex w-full items-center justify-between text-xl hover:text-white",
                  // isActive && "text-white",
                  // !isActive && "text-white/80",
                  !isAvailable && "text-white/30",
                )}
              >
                {value}
                {isActive && <Icon name="check" className="size-5" />}
              </Link>
            </DropdownMenuItem>
          ))}
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
