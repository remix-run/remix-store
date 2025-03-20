import { Suspense } from "react";
import { data, type LoaderFunctionArgs } from "@shopify/remix-oxygen";
import {
  Await,
  Link,
  useLoaderData,
  type FetcherWithComponents,
  useSearchParams,
  type MetaArgs,
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
import { FOOTER_QUERY } from "~/lib/fragments";
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
import { generateMeta } from "~/lib/meta";
import type { RootLoader } from "~/root";
import { getProductData, getProductVariants } from "~/lib/data/product.server";

/** The default vendor, which we hide because nobody cares */
const DEFAULT_VENDOR = "Remix Swag Store";

export function meta({
  data,
  matches,
}: MetaArgs<typeof loader, { root: RootLoader }>) {
  if (!data) return generateMeta();

  const { product } = data;
  const { siteUrl } = matches[0].data;

  const title = `The Remix Store | ${product.title}`;
  const description = product.seo?.description || product.description;

  // Use product image if available
  const image = product.images?.nodes[0]?.url
    ? product.images.nodes[0].url
    : "/og_image.jpg";

  return generateMeta({
    title,
    description,
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
  const menuPromise = storefront.query(FOOTER_QUERY, {
    cache: storefront.CacheLong(),
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
  const { product, variants, checkoutDomain } = useLoaderData<typeof loader>();
  let { selectedVariant } = product;

  // If a variant isn't selected, use the first variant for price, analytics, etc
  if (!selectedVariant) {
    selectedVariant = product.variants.nodes[0];
  }

  return (
    <div className="mx-auto max-w-(--breakpoint-xl) md:flex md:justify-center md:gap-[18px]">
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
      <h1 className="min-w-max font-sans text-2xl leading-6 font-bold tracking-[-0.32px] md:text-4xl md:leading-[1.875rem]">
        {title}
      </h1>

      <div className="flex gap-3 font-mono text-base leading-4 tracking-[-0.48px] md:text-2xl/6 md:leading-6">
        <Money
          // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
          data={selectedVariant?.price!}
          withoutTrailingZeros
        />
        {isOnSale && (
          <>
            <s className="line-through opacity-50">
              <Money
                // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
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
        options={product.options.filter(
          (option) => option.optionValues.length > 1,
        )}
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
