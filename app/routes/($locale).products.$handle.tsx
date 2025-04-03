import { Suspense, useState, useEffect, useRef } from "react";
import { data, type LoaderFunctionArgs } from "@shopify/remix-oxygen";
import {
  Await,
  Link,
  useLoaderData,
  useSearchParams,
  type MetaArgs,
  useFetcher,
} from "@remix-run/react";
import type {
  ProductFragment,
  ProductVariantsQuery,
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
  type CartViewPayload,
  useAnalytics,
  RichText,
  useOptimisticCart,
} from "@shopify/hydrogen";
import { useAside } from "~/components/ui/aside";
import { FOOTER_QUERY } from "~/lib/fragments";
import { Button, ButtonWithWellText } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "~/components/ui/dropdown-menu";
import { Icon } from "~/components/icon";
import { ProductImages } from "~/components/product-images";
import { generateMeta } from "~/lib/meta";
import type { RootLoader } from "~/root";
import { getProductData, getProductVariants } from "~/lib/data/product.server";
import { useRelativeUrl } from "~/lib/use-relative-url";
import { cva } from "class-variance-authority";
import { cn } from "~/lib/cn";

/** The default vendor, which we hide because nobody cares */
const DEFAULT_VENDOR = "Remix Swag Store";

export function meta({
  data,
  matches,
}: MetaArgs<typeof loader, { root: RootLoader }>) {
  if (!data) return generateMeta();

  const { product } = data;
  const { siteUrl } = matches[0].data;

  // Use product image if available
  const image = product.images?.nodes[0]?.url
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
  let { storefront, env } = context;
  let { handle } = params;

  if (!handle) {
    throw new Error("Expected product handle to be defined");
  }

  let variants = getProductVariants(storefront, {
    variables: { handle },
  }).catch((error) => {
    console.error(error);
    return null;
  });

  // Not sure if this will always be the same as the footer menu
  const menuPromise = storefront
    .query(FOOTER_QUERY, {
      cache: storefront.CacheLong(),
    })
    .then((data) => {
      let menu: MenuItem[] = [];
      if (!data.menu) {
        return menu;
      }
      for (const item of data.menu.items) {
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

  let [menu, product] = await Promise.all([menuPromise, productPromise]);

  return data({
    checkoutDomain: env.PUBLIC_CHECKOUT_DOMAIN,
    menu,
    product,
    variants,
  });
}

export default function Product() {
  const { menu, product, variants, checkoutDomain } =
    useLoaderData<typeof loader>();
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
        checkoutDomain={checkoutDomain}
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
  const { url } = useRelativeUrl(to);
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
  checkoutDomain,
}: {
  product: ProductFragment;
  selectedVariant: NonNullable<ProductFragment["selectedVariant"]>;
  variants: Promise<ProductVariantsQuery | null>;
  checkoutDomain: string;
}) {
  const { title, category, description, technicalDescription } = product;

  const price = Number(selectedVariant.price.amount || 0);
  const compareAtPrice = Number(selectedVariant.compareAtPrice?.amount || 0);
  const isOnSale = price < compareAtPrice;
  const percentageOff = isOnSale
    ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
    : 0;

  return (
    <div className="static top-(--header-height) mx-4 flex max-h-fit flex-col gap-6 text-white md:sticky md:mx-0 md:min-w-fit md:basis-1/3 lg:gap-9 lg:pt-32">
      <div className="flex flex-col gap-4">
        {category ? (
          <p className="text-xs lg:text-base">{category?.name}</p>
        ) : null}
        <h1 className="min-w-fit font-sans text-2xl font-bold lg:text-4xl">
          {title}
        </h1>
        <div className="flex gap-3">
          <Money data={selectedVariant.price} withoutTrailingZeros />
          {selectedVariant.compareAtPrice && isOnSale && (
            <>
              <s className="line-through opacity-50">
                <Money
                  data={selectedVariant.compareAtPrice}
                  withoutTrailingZeros
                />
              </s>
              <span className="text-red-brand">{percentageOff}% Off</span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-[18px] md:gap-8">
        <Suspense
          fallback={
            <ProductForm
              product={product}
              selectedVariant={selectedVariant}
              variants={[]}
              checkoutDomain={checkoutDomain}
            />
          }
        >
          <Await
            errorElement="There was a problem loading product variants"
            resolve={variants}
          >
            {(data) => (
              <ProductForm
                product={product}
                selectedVariant={selectedVariant}
                variants={data?.product?.variants.nodes || []}
                checkoutDomain={checkoutDomain}
              />
            )}
          </Await>
        </Suspense>
      </div>

      {description ? (
        <RichText
          className="rich-text text-xs lg:text-base"
          data={description.value}
        />
      ) : null}
      <h3 className="text-sm font-bold lg:text-base">Technical Description</h3>
      {technicalDescription ? (
        <RichText
          className="rich-text text-xs lg:text-base"
          data={technicalDescription.value}
        />
      ) : null}
    </div>
  );
}

// TODO: get back to variants

function ProductForm({
  product,
  selectedVariant,
  variants,
  checkoutDomain,
}: {
  product: ProductFragment;
  selectedVariant: NonNullable<ProductFragment["selectedVariant"]>;
  variants: Array<ProductVariantFragment>;
  checkoutDomain: string;
}) {
  const { open } = useAside();
  const { publish, shop, cart, prevCart } = useAnalytics();
  const isAvailable = !!selectedVariant?.availableForSale;
  const [searchParams] = useSearchParams();
  const { options } = product;

  // If the product has options (like size, color, etc), check whether each option has been selected
  // if (variants.length > 1) {
  //   for (const option of options) {
  //     const selectedOption = searchParams.get(option.name);
  //     if (!selectedOption) {
  //       addToCartText = `Select a ${option.name.toLowerCase()}`;
  //       break;
  //     }
  //   }
  // }

  return (
    <>
      {/* <VariantSelector
        handle={product.handle}
        options={product.options.filter(
          (option) => option.optionValues.length > 1,
        )}
        variants={variants}
      >
        {({ option }) => <ProductOptions key={option.name} option={option} />}
      </VariantSelector> */}
      <div className="flex flex-col gap-2 md:gap-3 lg:flex-row">
        <div className="flex items-center justify-start rounded-[54px] border-[3px] border-white px-6 py-4 text-xl font-semibold transition-all duration-300 lg:flex-2">
          <span>Medium</span>
        </div>
        <AddToCartButton
          disabled={!selectedVariant || !isAvailable}
          // onClick={() => {
          //   publish("cart_viewed", {
          //     cart,
          //     prevCart,
          //     shop,
          //     url: window.location.href || "",
          //   } as CartViewPayload);
          // }}
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
        >
          {isAvailable ? "Add to cart" : "Sold out"}
        </AddToCartButton>
      </div>
    </>
  );
}

const addToCartButtonVariants = cva(
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

function AddToCartButton({
  analytics,
  children,
  disabled,
  lines,
  onClick,
}: {
  analytics?: unknown;
  children: React.ReactNode;
  disabled?: boolean;
  lines: Array<OptimisticCartLineInput>;
  onClick?: () => void;
}) {
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
      className={cn(addToCartButtonVariants({ pending, disabled }))}
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
        {pending ? <Icon name="check" className="size-8" /> : children}
      </button>
    </fetcher.Form>
  );
}

// ShopPayButton -- if reused pull out into a component
export function ShopPayButton({
  selectedVariant,
  checkoutDomain,
}: {
  selectedVariant: ProductFragment["selectedVariant"];
  checkoutDomain: string;
}) {
  return (
    <Link
      to={`https://${checkoutDomain}/cart/${selectedVariant?.id.split("ProductVariant/")[1]}:1?payment=shop_pay&channel=hydrogen`}
    >
      <Button
        className="bg-shop-pay flex justify-center py-6 [--yamaha-shadow-color:var(--color-shop-pay)]"
        intent="primary"
        size="lg"
      >
        <Icon name="shop-pay" className="h-6 w-auto max-w-full" />
      </Button>
    </Link>
  );
}

function ProductOptions({ option }: { option: VariantOption }) {
  const [searchParams] = useSearchParams();
  const selectedOption = searchParams.get(option.name);

  // Size (XS, S, M, L, etc) should render buttons
  if (option.name.toLowerCase() === "size") {
    return (
      <div className="grid grid-cols-[repeat(auto-fit,minmax(--spacing(12),1fr))] gap-2 lg:gap-4">
        {option.values.map(({ value, isAvailable, isActive, to }) => (
          <Button
            asChild
            key={option.name + value}
            size="sm"
            type="submit"
            intent={isActive ? "primary" : "secondary"}
            disabled={!isAvailable}
            className="px-0 text-center"
          >
            {isAvailable ? (
              <Link prefetch="intent" preventScrollReset replace to={to}>
                {value}
              </Link>
            ) : (
              <span>{value}</span>
            )}
          </Button>
        ))}
      </div>
    );
  }

  // All other options should render a dropdown
  return (
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ButtonWithWellText
            size="icon"
            wellPrefix={selectedOption ? selectedOption : `${option.name}`}
          >
            <Icon name="chevron-down" />
          </ButtonWithWellText>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-fit md:w-[280px]">
          {option.values.map(({ value, isAvailable, isActive, to }) => (
            <DropdownMenuItem
              asChild
              className="justify-between"
              key={option.name + value}
            >
              {isAvailable ? (
                <Link
                  prefetch="intent"
                  preventScrollReset
                  replace
                  to={to}
                  className="cursor-pointer no-underline"
                >
                  {value}
                  {isActive ? <Icon name="circle-check" /> : null}
                </Link>
              ) : (
                <span className="cursor-not-allowed opacity-35">
                  {value} (Sold Out)
                </span>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
