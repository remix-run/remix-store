import {
  buildProductSelectionSearchParams,
  canAddToCart,
  createProductFormRegister,
  createProductFormStore,
  formatMoney,
  type ProductFormRegister,
  type ProductFormStore,
  type ProductFormStoreState,
  type SelectedOption,
} from "@shopify/hydrogen";
import { clientEntry, css, navigate, on, type Handle } from "remix/component";

import type { NavigationMenuData, ProductData } from "../../data/storefront.ts";
import { getCartApiPath } from "../../lib/public/cart-routes.ts";
import {
  marketPath,
  US_MARKET,
  type ActiveMarket,
} from "../../lib/public/market.ts";
import { productSubscriptionsEnabled } from "../../lib/public/subscription.ts";
import { dismissibleDetails } from "../../ui/public/dismissible-details.tsx";
import { Icon } from "../../ui/public/icon.tsx";
import { RichText } from "../../ui/public/rich-text.tsx";
import { getBrowserCartStore } from "./cart-store.ts";
import { ProductGallery } from "./product-gallery.tsx";
import { ExpressShopPayButton } from "./shop-pay-button.tsx";
import { SubscribeForm } from "./subscribe-form.tsx";

type ProductDetailsProps = {
  market?: ActiveMarket;
  menu?: NavigationMenuData;
  product: ProductData;
  search: string;
  shopPayStoreUrl: string;
};

type ProductVariant = ProductData["selectedOrFirstAvailableVariant"];

type ProductState = ProductFormStoreState<
  NonNullable<ProductVariant>,
  ProductData["options"][number]["optionValues"][number]
>;

/** The option fields shared by the store's state and the server fallback. */
type ProductOption = {
  name: string;
  values: Array<
    Pick<
      ProductState["options"][number]["values"][number],
      | "available"
      | "exists"
      | "handle"
      | "name"
      | "selected"
      | "selectedOptions"
    >
  >;
};

export const ProductDetails = clientEntry(
  import.meta.url,
  function ProductDetails(handle: Handle<ProductDetailsProps>) {
    let market = handle.props.market ?? US_MARKET;
    let cartStore = getBrowserCartStore(undefined, market.pathPrefix);
    let store = cartStore
      ? createProductFormStore(handle.props.product, cartStore)
      : undefined;
    let state: ProductState | undefined = store?.getState();
    let hydrated = false;
    // The product the store holds, and one queued to replace it after render.
    let storeIdentity = productIdentity(handle.props.product);
    let queuedIdentity: string | undefined;

    if (store) {
      let unsubscribe = store.subscribe((nextState) => {
        state = nextState;
        if (hydrated) handle.update();
      });
      handle.signal.addEventListener(
        "abort",
        () => {
          unsubscribe();
          store.destroy();
        },
        { once: true },
      );
      handle.queueTask((signal) => {
        if (signal.aborted) return;
        hydrated = true;
        state = store.getState();
        handle.update();
        showSelectedVariantInUrl();
      });
    }

    /** Client navigation brings new product props; load them into the store. */
    function syncStore(product: ProductData) {
      let identity = productIdentity(product);
      if (!store || identity === storeIdentity || identity === queuedIdentity) {
        return;
      }
      queuedIdentity = identity;
      handle.queueTask((signal) => {
        if (queuedIdentity === identity) queuedIdentity = undefined;
        let current = handle.props.product;
        if (signal.aborted || productIdentity(current) !== identity) return;
        storeIdentity = identity;
        store.hydrate(current);
        showSelectedVariantInUrl();
      });
    }

    /** The store's state once it holds the rendered product. */
    function activeState(product: ProductData) {
      return hydrated && productIdentity(product) === storeIdentity
        ? state
        : undefined;
    }

    // Like production, a bare product URL gains the selected variant's
    // options so it can be shared. This replaces the entry without navigating.
    function showSelectedVariantInUrl() {
      if (location.search) return;
      let { product } = handle.props;
      let variant = product.selectedOrFirstAvailableVariant;
      if (
        !variant ||
        !selectableOptions(serverProductOptions(product)).length
      ) {
        return;
      }
      let href = variantHref(
        product.handle,
        variant.selectedOptions,
        product.options,
        "",
        market.pathPrefix,
      );
      if (href !== location.pathname) {
        history.replaceState(history.state, "", href);
      }
    }

    return () => {
      market = handle.props.market ?? US_MARKET;
      let { menu, product, search, shopPayStoreUrl } = handle.props;
      syncStore(product);

      let current = activeState(product);
      let selectedVariant = current
        ? current.selectedVariant
        : product.selectedOrFirstAvailableVariant;
      let options = selectableOptions(
        current?.options ?? serverProductOptions(product),
      );
      let addEnabled = current
        ? canAddToCart(product, current.options)
        : canAddServerVariant(product);
      let register = createProductFormRegister(
        selectedVariant,
        (name, value) => {
          let result = store?.selectOption(name, value);
          if (!result || result.status === "invalid") return;
          navigate(
            variantHref(
              product.handle,
              result.selectedOptions,
              product.options,
              search,
              market.pathPrefix,
            ),
            { history: "replace", resetScroll: false },
          );
        },
      );

      return (
        <div mix={productPageStyle}>
          <nav aria-label="Product collections" mix={sidebarStyle}>
            <ul>
              {(menu?.items ?? []).map((item) => (
                <li key={item.id}>
                  <a href={item.url}>{item.title}</a>
                </li>
              ))}
            </ul>
          </nav>

          <ProductGallery
            controls={hydrated}
            images={product.images.nodes}
            selectedImage={selectedVariant?.image}
          />

          <section mix={detailsStyle}>
            <ProductHeading
              locale={market.locale}
              product={product}
              variant={selectedVariant}
            />

            <div mix={purchaseGroupStyle}>
              <div mix={purchaseStyle}>
                {options.length ? (
                  <div mix={optionsStyle}>
                    {options.map((option) => (
                      <OptionMenu
                        key={option.name}
                        option={option}
                        pathPrefix={market.pathPrefix}
                        product={product}
                        register={current ? register : undefined}
                        search={search}
                      />
                    ))}
                  </div>
                ) : null}

                <div
                  mix={[
                    buyActionsStyle,
                    options.length ? undefined : buyActionsOnlyStyle,
                  ]}
                >
                  <AddToCartForm
                    action={getCartApiPath(market.pathPrefix)}
                    enabled={addEnabled}
                    label={addToCartLabel(product, selectedVariant)}
                    register={register}
                    storeErrors={current ? productErrorMessages(current) : []}
                    submit={store && ((event) => store.handleFormSubmit(event))}
                  />
                  {selectedVariant && addEnabled ? (
                    <ExpressShopPayButton
                      storeUrl={shopPayStoreUrl}
                      variantId={selectedVariant.id}
                    />
                  ) : null}
                </div>
              </div>
              {selectedVariant &&
              !selectedVariant.availableForSale &&
              productSubscriptionsEnabled(product) ? (
                <SubscribeForm
                  action={marketPath("/subscribe", market.pathPrefix)}
                  mode="back-in-stock"
                  productHandle={product.handle}
                  variantId={selectedVariant.id}
                />
              ) : null}
            </div>

            <ProductDescriptions
              pathPrefix={market.pathPrefix}
              product={product}
            />
          </section>
        </div>
      );
    };
  },
);

function ProductHeading(
  handle: Handle<{
    locale: ActiveMarket["locale"];
    product: ProductData;
    variant: ProductVariant;
  }>,
) {
  return () => {
    let { locale, product, variant } = handle.props;
    let price = variant?.price ?? product.priceRange.minVariantPrice;
    let compareAtPrice = variant?.compareAtPrice;
    return (
      <div mix={headingStyle}>
        {product.category?.name ? (
          <p data-category="true">{product.category.name}</p>
        ) : null}
        <h1>{product.title}</h1>
        <p mix={priceStyle} aria-live="polite">
          {compareAtPrice ? (
            <s>{formatMoney(compareAtPrice, { locale }).toString()}</s>
          ) : null}
          <span data-sale={compareAtPrice ? "true" : undefined}>
            {formatMoney(price, { locale }).toString()}
          </span>
        </p>
      </div>
    );
  };
}

/**
 * One option as a dropdown of variant links. Without scripts, or for values
 * that lead to another product, the links navigate; otherwise selecting one
 * goes through the product store.
 */
function OptionMenu(
  handle: Handle<{
    option: ProductOption;
    pathPrefix: ActiveMarket["pathPrefix"];
    product: ProductData;
    register?: ProductFormRegister;
    search: string;
  }>,
) {
  return () => {
    let { option, pathPrefix, product, register, search } = handle.props;
    let selectedName = option.values.find((value) => value.selected)?.name;

    return (
      <details mix={[optionMenuStyle, dismissibleDetails()]}>
        <summary>
          <span>
            <span mix={visuallyHiddenStyle}>{option.name}: </span>
            {selectedName ?? option.name}
          </span>
          <Icon name="chevron-down" />
        </summary>
        <div>
          {option.values.map((value) => {
            if (!value.exists) {
              return (
                <button key={value.name} type="button" disabled>
                  {value.name}
                </button>
              );
            }

            let selection =
              register && value.handle === product.handle
                ? register("optionValue", {
                    optionName: option.name,
                    value: value.name,
                  })
                : undefined;

            return (
              <a
                key={value.name}
                href={variantHref(
                  value.handle,
                  value.selectedOptions,
                  product.options,
                  search,
                  pathPrefix,
                )}
                aria-current={value.selected ? "true" : undefined}
                mix={
                  selection
                    ? on("click", (event) => {
                        event.preventDefault();
                        selection.onClick();
                      })
                    : undefined
                }
              >
                <span>
                  {value.available ? value.name : `${value.name} — Sold out`}
                </span>
                {value.selected ? <Icon name="check" /> : null}
              </a>
            );
          })}
        </div>
      </details>
    );
  };
}

// The green check is the only confirmation that the item was added.
const ADD_TO_CART_CHECK_MS = 2000;

/**
 * Posts to the cart route without scripts. With them, it adds through the
 * product store and shows a green check for at least two seconds.
 */
function AddToCartForm(
  handle: Handle<{
    action: string;
    enabled: boolean;
    label: string;
    register: ProductFormRegister;
    storeErrors: string[];
    submit?: ProductFormStore["handleFormSubmit"];
  }>,
) {
  let pending = false;
  let added = false;
  let submission = 0;
  let submissionError = "";

  async function addToCart(event: SubmitEvent) {
    event.preventDefault();
    let { enabled, submit } = handle.props;
    if (!submit || !enabled) return;

    let currentSubmission = ++submission;
    let isCurrent = () => currentSubmission === submission;
    submissionError = "";
    pending = true;
    handle.update();
    let startedAt = Date.now();

    try {
      await submit(event);
      if (isCurrent()) {
        added = true;
        handle.update();
        await delay(ADD_TO_CART_CHECK_MS - (Date.now() - startedAt));
      }
    } catch (error) {
      if (isCurrent()) {
        submissionError =
          error instanceof Error
            ? error.message
            : "The item could not be added.";
      }
    } finally {
      if (isCurrent()) {
        pending = false;
        added = false;
        handle.update();
      }
    }
  }

  return () => {
    let { action, enabled, label, register, storeErrors } = handle.props;
    let errors = [
      ...new Set(
        [submissionError, ...(submission > 0 ? storeErrors : [])].filter(
          Boolean,
        ),
      ),
    ];

    return (
      <form
        action={action}
        method="post"
        aria-busy={pending ? "true" : undefined}
        mix={[
          addFormStyle,
          pending ? addPendingStyle : undefined,
          on("submit", (event) => addToCart(event)),
        ]}
      >
        <input type="hidden" {...register("merchandiseId", {})} />
        <input type="hidden" {...register("quantity", { value: 1 })} />
        <button
          {...register("addToCart", {})}
          disabled={!enabled || pending}
          aria-label={
            added ? "Added to cart" : pending ? "Adding to cart" : undefined
          }
        >
          {pending ? <Icon name="check" /> : label}
        </button>
        {errors.length ? (
          <div role="alert" mix={errorStyle}>
            {errors.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        ) : null}
      </form>
    );
  };
}

function ProductDescriptions(
  handle: Handle<{
    pathPrefix: ActiveMarket["pathPrefix"];
    product: ProductData;
  }>,
) {
  return () => {
    let { pathPrefix, product } = handle.props;
    return (
      <>
        {product.customDescription ? (
          <RichText
            pathPrefix={pathPrefix}
            value={product.customDescription.value}
            variant="product-description"
          />
        ) : product.description ? (
          <p mix={descriptionStyle}>{product.description}</p>
        ) : null}

        {product.technicalDescription ? (
          <div mix={technicalStyle}>
            <h2>Technical Description</h2>
            <RichText
              pathPrefix={pathPrefix}
              value={product.technicalDescription.value}
              variant="product-description"
            />
          </div>
        ) : null}
      </>
    );
  };
}

export function variantHref(
  handle: string,
  selectedOptions: ReadonlyArray<SelectedOption>,
  options: ReadonlyArray<{ name: string }>,
  currentSearch = "",
  pathPrefix: ActiveMarket["pathPrefix"] = "",
): string {
  let search = buildProductSelectionSearchParams({
    selectedOptions,
    optionNames: options.map((option) => option.name),
    base: new URLSearchParams(currentSearch),
  });
  let query = search.toString();
  return marketPath(
    `/products/${encodeURIComponent(handle)}${query ? `?${query}` : ""}`,
    pathPrefix,
  );
}

function productIdentity(product: ProductData): string {
  return `${product.id}:${product.selectedOrFirstAvailableVariant?.id ?? ""}`;
}

/** Drops Shopify's lone "Default Title", and options when nothing can vary. */
function selectableOptions(options: ProductOption[]): ProductOption[] {
  let visible = options.filter((option) => !isDefaultTitleOption(option));
  return visible.some((option) => option.values.length > 1) ? visible : [];
}

function isDefaultTitleOption(option: ProductOption): boolean {
  return (
    option.name.trim().toLowerCase() === "title" &&
    option.values.length === 1 &&
    option.values[0]?.name.trim().toLowerCase() === "default title"
  );
}

/** Option state from server data, used until the store hydrates. */
function serverProductOptions(product: ProductData): ProductOption[] {
  let selectedVariant = product.selectedOrFirstAvailableVariant;
  let knownVariants = [selectedVariant, ...product.adjacentVariants];

  return product.options.map((option) => ({
    name: option.name,
    values: option.optionValues.map((value) => {
      let variant =
        value.firstSelectableVariant ??
        knownVariants.find((candidate) =>
          hasOption(candidate, option.name, value.name),
        ) ??
        null;
      return {
        name: value.name,
        selected: hasOption(selectedVariant, option.name, value.name),
        exists: variant !== null,
        available: variant?.availableForSale ?? false,
        selectedOptions: variant?.selectedOptions ?? [],
        handle: variant?.product?.handle ?? product.handle,
      };
    }),
  }));
}

function hasOption(
  variant: ProductVariant | undefined,
  name: string,
  value: string,
): boolean {
  return (
    variant?.selectedOptions.some(
      (option) => option.name === name && option.value === value,
    ) ?? false
  );
}

function canAddServerVariant(product: ProductData): boolean {
  return Boolean(
    product.selectedOrFirstAvailableVariant?.availableForSale &&
    !product.requiresSellingPlan,
  );
}

function addToCartLabel(product: ProductData, variant: ProductVariant): string {
  if (product.requiresSellingPlan) return "Selling plan required";
  if (!variant) return "Select options";
  return variant.availableForSale ? "Add to cart" : "Sold out";
}

function productErrorMessages(state: ProductState): string[] {
  // Cart-level discount/shipping warnings ride along on the shared cart
  // store. The product form only surfaces add-to-cart failures.
  return [
    ...new Set(
      [
        ...state.errors.userErrors.map((error) => error.message),
        ...state.errors.networkErrors.map((entry) => entry.message),
      ].filter((message) => !/discount code/i.test(message)),
    ),
  ];
}

function delay(milliseconds: number): Promise<void> | undefined {
  if (milliseconds <= 0) return;
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const visuallyHiddenStyle = css({
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: "1px",
  overflow: "hidden",
  position: "absolute",
  whiteSpace: "nowrap",
  width: "1px",
});
// A flex row like production: the gallery takes all the room it can (up to
// 1200px) and the details column shrinks to its minimum width before the
// gallery gives up more.
const productPageStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  marginTop: "calc(var(--header-height) + var(--store-wide-sale-height))",
  minHeight: "90vh",
  overflowX: "clip",
  "@media (min-width: 810px)": {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: "32px",
    justifyContent: "space-between",
    padding: "0 16px",
  },
  "@media (min-width: 1400px)": { padding: "0 36px" },
});
const sidebarStyle = css({
  display: "none",
  flexShrink: 0,
  paddingTop: "128px",
  position: "sticky",
  top: "calc(var(--header-height) + var(--store-wide-sale-height))",
  "& ul": {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  "& a": {
    color: "rgba(255,255,255,.9)",
    fontSize: "1rem",
    lineHeight: 1.5,
    textDecoration: "none",
    whiteSpace: "nowrap",
  },
  "@media (hover: hover)": {
    "& a:hover": { color: "var(--color-blue-brand)" },
  },
  "@media (min-width: 1400px)": { display: "block" },
});
const detailsStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  margin: "0 16px",
  minWidth: 0,
  "@media (min-width: 810px)": {
    flexBasis: "33.333%",
    margin: 0,
    maxWidth: "576px",
    minWidth: "330px",
    position: "sticky",
    top: "calc(var(--header-height) + var(--store-wide-sale-height))",
  },
  "@media (min-width: 1400px)": {
    gap: "36px",
    minWidth: "480px",
    paddingTop: "128px",
  },
});
const headingStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  "& [data-category]": { fontSize: ".75rem", lineHeight: 1.333, margin: 0 },
  "& h1": {
    fontSize: "1.5rem",
    fontWeight: 700,
    lineHeight: "2rem",
    margin: 0,
  },
  "@media (min-width: 1400px)": {
    "& [data-category]": { fontSize: "1rem", lineHeight: 1.4 },
    "& h1": { fontSize: "2.25rem", lineHeight: "2.5rem" },
  },
});
const priceStyle = css({
  alignItems: "baseline",
  display: "flex",
  fontSize: "1rem",
  gap: "10px",
  margin: 0,
  "& s": { color: "rgba(255,255,255,.55)" },
  "& [data-sale]": { color: "var(--color-red-brand)" },
});
const purchaseGroupStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  minWidth: 0,
});
const purchaseStyle = css({
  display: "grid",
  gap: "16px",
  "@media (min-width: 1400px)": {
    gap: "12px",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  },
});
const optionsStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  "@media (min-width: 1400px)": { gridColumn: "span 2" },
});
const optionMenuStyle = css({
  position: "relative",
  "& summary": {
    alignItems: "center",
    border: "3px solid white",
    borderRadius: "54px",
    cursor: "pointer",
    display: "flex",
    fontSize: "1.25rem",
    fontWeight: 600,
    justifyContent: "space-between",
    lineHeight: "1.75rem",
    listStyle: "none",
    minHeight: "66px",
    padding: "16px 24px",
  },
  "& summary::-webkit-details-marker": { display: "none" },
  "& summary svg": {
    height: "24px",
    transition: "transform 200ms ease",
    width: "24px",
  },
  "&[open] summary svg": { transform: "rotate(180deg)" },
  "& > div": {
    background: "var(--color-gray-900)",
    border: "1px solid var(--color-gray-700)",
    borderRadius: "24px",
    boxShadow: "0 16px 42px rgba(0,0,0,.45)",
    display: "flex",
    flexDirection: "column",
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: "calc(100% + 8px)",
    zIndex: 5,
  },
  "& > div > a, & > div > button": {
    alignItems: "center",
    background: "transparent",
    border: 0,
    color: "white",
    display: "flex",
    fontSize: "1.25rem",
    fontWeight: 400,
    justifyContent: "space-between",
    lineHeight: "1.75rem",
    minHeight: "52px",
    padding: "20px",
    textAlign: "left",
    textDecoration: "none",
    width: "100%",
  },
  "@media (hover: hover)": {
    "& > div > a:hover, & > div > button:hover": {
      background: "rgba(255,255,255,.08)",
      color: "white",
    },
  },
  "& > div > button:disabled": {
    color: "rgba(255,255,255,.3)",
    cursor: "not-allowed",
  },
  "& > div svg": { height: "20px", width: "20px" },
});
const buyActionsStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  minWidth: 0,
  "@media (min-width: 1400px)": { display: "contents" },
});
const buyActionsOnlyStyle = css({
  "@media (min-width: 1400px)": { "& form": { gridColumn: "1 / -1" } },
});
const addFormStyle = css({
  '& button[name="add-to-cart"]': {
    alignItems: "center",
    background: "white",
    border: 0,
    borderRadius: "54px",
    color: "black",
    display: "flex",
    fontSize: "1.25rem",
    fontWeight: 600,
    height: "64px",
    justifyContent: "center",
    minHeight: "64px",
    overflow: "hidden",
    padding: 0,
    position: "relative",
    whiteSpace: "nowrap",
    width: "100%",
  },
  "@media (min-width: 1400px)": {
    '& button[name="add-to-cart"]': { height: "66px", minHeight: "66px" },
  },
  '& button[name="add-to-cart"]:disabled': {
    background: "rgba(255,255,255,.2)",
    color: "rgba(255,255,255,.8)",
    cursor: "not-allowed",
  },
});
const addPendingStyle = css({
  '& button[name="add-to-cart"], & button[name="add-to-cart"]:disabled': {
    background: "var(--color-green-brand)",
    color: "var(--color-white)",
    cursor: "default",
    transition: "background-color 300ms ease, color 300ms ease",
  },
  '& button[name="add-to-cart"] svg': {
    animation: "add-to-cart-check 400ms var(--ease-snap) 200ms both",
    display: "block",
    flex: "none",
    height: "32px",
    width: "32px",
  },
  "@media (prefers-reduced-motion: reduce)": {
    '& button[name="add-to-cart"] svg': {
      animation: "none",
      transform: "none",
    },
  },
});
const errorStyle = css({
  color: "var(--color-red-brand)",
  gridColumn: "1 / -1",
  "& p": { margin: "8px 0 0" },
});
const descriptionStyle = css({
  fontSize: ".75rem",
  lineHeight: "16px",
  margin: 0,
  maxWidth: "60ch",
  whiteSpace: "pre-wrap",
  "@media (min-width: 1400px)": { fontSize: "1rem", lineHeight: 1.4 },
});
const technicalStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  "& > h2": { fontSize: ".875rem", lineHeight: "20px", margin: 0 },
  "@media (min-width: 1400px)": {
    gap: "36px",
    "& > h2": { fontSize: "1rem", lineHeight: 1.4 },
  },
});
