import { Suspense } from "react";
import { defer, type LoaderFunctionArgs } from "@shopify/remix-oxygen";
import {
  Await,
  Link,
  useLoaderData,
  type MetaFunction,
  type FetcherWithComponents,
  useSearchParams,
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
} from "@shopify/hydrogen";
import type { SelectedOption } from "@shopify/hydrogen/storefront-api-types";
import { useAside } from "~/components/ui/aside";
import {
  PRODUCT_DETAIL_FRAGMENT,
  PRODUCT_VARIANT_FRAGMENT,
} from "~/lib/fragments";
import { Button, ButtonWithWellText } from "~/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "~/components/ui/dropdown-menu";
import Icon from "~/components/icon";
import ProductImages from "~/components/product-images";

/** The default vendor, which we hide because nobody cares */
const DEFAULT_VENDOR = "Remix Swag Store";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [{ title: `The Remix Store | ${data?.product.title ?? ""}` }];
};

export async function loader(args: LoaderFunctionArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return defer({ ...deferredData, ...criticalData });
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({
  context,
  params,
  request,
}: LoaderFunctionArgs) {
  const { handle } = params;
  const { storefront, env } = context;

  if (!handle) {
    throw new Error("Expected product handle to be defined");
  }

  const { product } = await storefront.query(PRODUCT_QUERY, {
    variables: {
      handle,
      selectedOptions: getSelectedProductOptions(request),
    },
  });

  if (!product?.id) {
    throw new Response("Product not found", { status: 404 });
  }

  const firstVariant = product.variants.nodes[0];
  const firstVariantIsDefault = Boolean(
    firstVariant.selectedOptions.find(
      (option: SelectedOption) =>
        option.name === "Title" && option.value === "Default Title",
    ),
  );

  if (firstVariantIsDefault) {
    product.selectedVariant = firstVariant;
  }

  return {
    checkoutDomain: env.PUBLIC_CHECKOUT_DOMAIN,
    product,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({ context, params }: LoaderFunctionArgs) {
  // In order to show which variants are available in the UI, we need to query
  // all of them. But there might be a *lot*, so instead separate the variants
  // into it's own separate query that is deferred. So there's a brief moment
  // where variant options might show as available when they're not, but after
  // this deferred query resolves, the UI will update.
  const variants = context.storefront
    .query(VARIANTS_QUERY, {
      variables: { handle: params.handle! },
    })
    .catch((error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return null;
    });

  return {
    variants,
  };
}

export default function Product() {
  const { product, variants, checkoutDomain } = useLoaderData<typeof loader>();
  let { selectedVariant } = product;

  // If a variant isn't selected, use the first variant for price, analytics, etc
  if (!selectedVariant) {
    selectedVariant = product.variants.nodes[0];
  }

  return (
    <div className="mx-auto max-w-[theme(screens.xl)] md:flex md:justify-center md:gap-[18px]">
      <ProductImages
        images={product?.images.nodes}
        gradientColors={product.gradientColors}
      />
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

function ProductMain({
  selectedVariant,
  product,
  variants,
  checkoutDomain,
}: {
  product: ProductFragment;
  selectedVariant: ProductFragment["selectedVariant"];
  variants: Promise<ProductVariantsQuery | null>;
  checkoutDomain: string;
}) {
  const { title, vendor, description, specs, fullDescription } = product;

  const cardCss =
    "flex flex-col gap-6 md:gap-8 rounded-3xl bg-neutral-100 py-7 px-[24px] lg:p-9 dark:bg-neutral-700";

  return (
    <div>
      <div className="sticky top-[var(--header-height)] flex flex-col gap-[18px]">
        <div className={cardCss}>
          <div className="flex flex-col gap-6">
            <ProductHeader
              title={title}
              vendor={vendor}
              selectedVariant={selectedVariant}
            />
          </div>

          <p>{description}</p>

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
        </div>

        <div className={cardCss}>
          <Accordion type="multiple" className="-m-4 md:-m-6">
            {fullDescription ? (
              <AccordionItem value="description">
                <AccordionTrigger>Description</AccordionTrigger>
                <AccordionContent>
                  <RichText data={fullDescription.value} />
                </AccordionContent>
              </AccordionItem>
            ) : null}
            {specs ? (
              <AccordionItem value="specs">
                <AccordionTrigger>Specs</AccordionTrigger>
                <AccordionContent>
                  <RichText
                    data={specs.value}
                    // Should this be set globally?
                    className="[&_ul]:list-inside [&_ul]:list-disc [&_ul]:pl-2"
                  />
                </AccordionContent>
              </AccordionItem>
            ) : null}
            <AccordionItem value="shipping" className="pb-0">
              <AccordionTrigger>Shipping</AccordionTrigger>
              <AccordionContent className="pb-9">
                {/* Not sure if this should be coming from the data or just be standard for all products */}
                See a full list of countries we ship to{" "}
                <Link to="/help">here</Link>.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>
  );
}

function ProductHeader({
  title,
  vendor,
  selectedVariant,
}: {
  title: string;
  vendor?: string;
  selectedVariant: ProductFragment["selectedVariant"];
}) {
  const displayVendor = vendor !== DEFAULT_VENDOR;
  const price = Number(selectedVariant?.price.amount || 0);
  const compareAtPrice = Number(selectedVariant?.compareAtPrice?.amount || 0);
  const isOnSale = price < compareAtPrice;
  const percentageOff = isOnSale
    ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-4 md:gap-[18px]">
      {(displayVendor || isOnSale) && (
        <div className="flex justify-between text-base leading-4 md:text-2xl/6">
          {displayVendor && <div>{vendor}</div>}
        </div>
      )}
      <h1 className="min-w-max font-sans text-2xl font-bold leading-6 tracking-[-0.32px] md:text-4xl md:leading-[1.875rem]">
        {title}
      </h1>

      <div className="flex gap-3 font-mono text-base leading-4 tracking-[-0.48px] md:text-2xl/6 md:leading-6">
        <Money data={selectedVariant?.price!} withoutTrailingZeros />
        {isOnSale && (
          <>
            <s className="line-through opacity-50">
              <Money
                data={selectedVariant?.compareAtPrice!}
                withoutTrailingZeros
              />
            </s>
            <span className="text-red-brand">{percentageOff}% Off</span>
          </>
        )}
      </div>
    </div>
  );
}

function ProductForm({
  product,
  selectedVariant,
  variants,
  checkoutDomain,
}: {
  product: ProductFragment;
  selectedVariant: ProductFragment["selectedVariant"];
  variants: Array<ProductVariantFragment>;
  checkoutDomain: string;
}) {
  const { open } = useAside();
  const { publish, shop, cart, prevCart } = useAnalytics();
  const isAvailable = !!selectedVariant?.availableForSale;
  const [searchParams] = useSearchParams();
  const { options } = product;
  let addToCartText = "Add to cart";

  // If the product has options (like size, color, etc), check whether each option has been selected
  if (variants.length > 1) {
    for (const option of options) {
      const selectedOption = searchParams.get(option.name);
      if (!selectedOption) {
        addToCartText = `Select a ${option.name.toLowerCase()}`;
        break;
      }
    }
  }

  return (
    <>
      <VariantSelector
        handle={product.handle}
        options={product.options.filter((option) => option.values.length > 1)}
        variants={variants}
      >
        {({ option }) => <ProductOptions key={option.name} option={option} />}
      </VariantSelector>
      <div className="flex flex-col gap-2 md:gap-3">
        <AddToCartButton
          disabled={!selectedVariant || !isAvailable}
          onClick={() => {
            open("cart");
            publish("cart_viewed", {
              cart,
              prevCart,
              shop,
              url: window.location.href || "",
            } as CartViewPayload);
          }}
          lines={
            selectedVariant
              ? [
                  {
                    merchandiseId: selectedVariant.id,
                    quantity: 1,
                    // Add entire product to selected variant so we can determine gradient colours in an optimistic cart
                    selectedVariant: { ...selectedVariant, product },
                  },
                ]
              : []
          }
        >
          {product.availableForSale ? addToCartText : "Sold out"}
        </AddToCartButton>

        {isAvailable ? (
          <ShopPayButton
            selectedVariant={selectedVariant}
            checkoutDomain={checkoutDomain}
          />
        ) : null}
      </div>
    </>
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
        className="flex justify-center bg-shop-pay py-6 [--yamaha-shadow-color:theme(colors.shop-pay)]"
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
      <div className="grid grid-cols-[repeat(auto-fit,minmax(theme(spacing.12),1fr))] gap-2 lg:gap-4">
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

  // Al other otions should render a dropdown
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
                  {isActive ? <Icon name="check" /> : null}
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
  return (
    <CartForm
      route="/cart"
      inputs={{ lines }}
      action={CartForm.ACTIONS.LinesAdd}
    >
      {(fetcher: FetcherWithComponents<any>) => (
        <>
          <input
            name="analytics"
            type="hidden"
            value={JSON.stringify(analytics)}
          />
          <Button
            size="lg"
            type="submit"
            onClick={onClick}
            disabled={disabled ?? fetcher.state !== "idle"}
          >
            {children}
          </Button>
        </>
      )}
    </CartForm>
  );
}

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_DETAIL_FRAGMENT}
` as const;

const PRODUCT_VARIANTS_FRAGMENT = `#graphql
  fragment ProductVariants on Product {
    variants(first: 250) {
      nodes {
        ...ProductVariant
      }
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

const VARIANTS_QUERY = `#graphql
  query ProductVariants(
    $country: CountryCode
    $language: LanguageCode
    $handle: String!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...ProductVariants
    }
  }
  ${PRODUCT_VARIANTS_FRAGMENT}
` as const;
