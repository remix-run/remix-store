import {
  SHOP_PAY_BUTTON_TAG_NAME,
  canAddToCart,
  createProductFormRegister,
  createProductFormStore,
  formatMoney,
  getShopPayButtonAttributes,
  getShopPayButtonStyleProperties,
  loadShopJs,
  type ProductFormStoreState,
  type SelectedOption,
  type ShopPayButtonOptions,
} from "@shopify/hydrogen";
import {
  clientEntry,
  createElement,
  css,
  navigate,
  on,
  ref,
  type Handle,
} from "remix/ui";

import type {
  ImageData,
  NavigationMenuData,
  ProductData,
} from "../../data/storefront.ts";
import { CART_API_PATH } from "../../lib/public/cart-routes.ts";
import { productSubscriptionsEnabled } from "../../lib/public/subscription.ts";
import { RichText } from "../../ui/public/rich-text.tsx";
import {
  ShopifyImage,
  shopifyImageUrl,
} from "../../ui/public/shopify-image.tsx";
import { getBrowserCartStore } from "./cart-store.ts";
import { SubscribeForm } from "./subscribe-form.tsx";

type ProductDetailsProps = {
  menu?: NavigationMenuData;
  product: ProductData;
  search: string;
  shopPayStoreUrl: string;
};

type ProductState = ProductFormStoreState<
  NonNullable<ProductData["selectedOrFirstAvailableVariant"]>,
  ProductData["options"][number]["optionValues"][number]
>;

export const ProductDetails = clientEntry(
  import.meta.url,
  function ProductDetails(handle: Handle<ProductDetailsProps>) {
    let cartStore = getBrowserCartStore();
    let store = cartStore
      ? createProductFormStore(handle.props.product, cartStore)
      : undefined;
    let state = store?.getState() as ProductState | undefined;
    let hydrated = false;
    let hydratedIdentity = productIdentity(handle.props.product);
    let queuedIdentity: string | undefined;
    let pending = false;
    let submission = 0;
    let submissionError = "";
    let mobileImageIndex = 0;
    let mobileGallery: HTMLElement | undefined;

    if (store) {
      let unsubscribe = store.subscribe((nextState) => {
        state = nextState as ProductState;
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
        state = store.getState() as ProductState;
        handle.update();
      });
    }

    function moveMobileGallery(direction: number) {
      if (!mobileGallery) return;
      let slides = mobileGallery.querySelectorAll<HTMLElement>(
        "[data-mobile-slide]",
      );
      let nextIndex = Math.max(
        0,
        Math.min(slides.length - 1, mobileImageIndex + direction),
      );
      mobileGallery.scrollTo({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        left: nextIndex * mobileGallery.clientWidth,
      });
    }

    return () => {
      let { menu, product, search } = handle.props;
      let nextIdentity = productIdentity(product);

      if (
        store &&
        nextIdentity !== hydratedIdentity &&
        nextIdentity !== queuedIdentity
      ) {
        queuedIdentity = nextIdentity;
        handle.queueTask((signal) => {
          if (
            signal.aborted ||
            productIdentity(handle.props.product) !== nextIdentity
          ) {
            if (queuedIdentity === nextIdentity) queuedIdentity = undefined;
            return;
          }
          hydratedIdentity = nextIdentity;
          queuedIdentity = undefined;
          store.hydrate(handle.props.product);
        });
      }

      let activeState =
        hydrated && nextIdentity === hydratedIdentity ? state : undefined;
      let selectedVariant = activeState
        ? activeState.selectedVariant
        : product.selectedOrFirstAvailableVariant;
      let options = (
        activeState?.options ?? serverProductOptions(product)
      ).filter((option) => !isDefaultTitleOption(option));
      if (options.every((option) => option.values.length <= 1)) options = [];
      let register = createProductFormRegister(
        selectedVariant,
        (name, value) => {
          if (!store) return;
          let result = store.selectOption(name, value);
          if (result.status === "invalid") return;

          mobileImageIndex = 0;
          navigate(
            variantHref(
              product.handle,
              result.selectedOptions,
              product.options,
              search,
            ),
            { history: "replace", resetScroll: false },
          );
        },
      );
      let addEnabled = activeState
        ? canAddToCart(product, activeState.options)
        : canAddServerVariant(product);
      let price = selectedVariant?.price ?? product.priceRange.minVariantPrice;
      let images = orderedProductImages(
        product.images.nodes,
        selectedVariant?.image,
      );
      let errors = [
        ...new Set(
          [
            submissionError,
            ...(activeState && submission > 0
              ? productErrorMessages(activeState)
              : []),
          ].filter(Boolean),
        ),
      ];

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

          <div mix={galleryColumnStyle}>
            <div
              mix={[
                desktopGalleryStyle,
                ref((element, signal) => {
                  let animationFrame = 0;
                  let reducedMotion = matchMedia(
                    "(prefers-reduced-motion: reduce)",
                  );

                  function updateOpacities() {
                    animationFrame = 0;
                    let imageFrames = element.querySelectorAll<HTMLElement>(
                      "[data-product-image]",
                    );
                    if (reducedMotion.matches) {
                      imageFrames.forEach(
                        (frame) => (frame.style.opacity = "1"),
                      );
                      return;
                    }

                    let headerHeight =
                      Number.parseInt(
                        getComputedStyle(
                          document.documentElement,
                        ).getPropertyValue("--header-height"),
                      ) || 136;
                    let saleHeight =
                      Number.parseInt(
                        getComputedStyle(document.body).getPropertyValue(
                          "--store-wide-sale-height",
                        ),
                      ) || 0;
                    let fadeRange = window.innerHeight * 0.4;
                    imageFrames.forEach((frame) => {
                      let distance = Math.abs(
                        frame.getBoundingClientRect().top -
                          headerHeight -
                          saleHeight,
                      );
                      let normalized = Math.min(1, distance / fadeRange);
                      frame.style.opacity = String(
                        Math.max(0.2, 1 - normalized * normalized),
                      );
                    });
                  }

                  function requestUpdate() {
                    if (!animationFrame)
                      animationFrame = requestAnimationFrame(updateOpacities);
                  }

                  updateOpacities();
                  window.addEventListener("scroll", requestUpdate, {
                    passive: true,
                  });
                  window.addEventListener("resize", requestUpdate);
                  reducedMotion.addEventListener("change", requestUpdate);
                  signal.addEventListener("abort", () => {
                    window.removeEventListener("scroll", requestUpdate);
                    window.removeEventListener("resize", requestUpdate);
                    reducedMotion.removeEventListener("change", requestUpdate);
                    if (animationFrame) cancelAnimationFrame(animationFrame);
                  });
                }),
              ]}
            >
              {images.length ? (
                images.map((image, index) => (
                  <ProductImageFrame
                    image={image}
                    index={index}
                    key={image.id || image.url}
                  />
                ))
              ) : (
                <ProductImageFallback />
              )}
            </div>

            <section aria-label="Product images" mix={mobileGalleryShellStyle}>
              <div
                mix={[
                  mobileGalleryStyle,
                  ref((element, signal) => {
                    mobileGallery = element;
                    let animationFrame = 0;
                    function updateIndex() {
                      animationFrame = 0;
                      let nextIndex = Math.round(
                        element.scrollLeft / Math.max(1, element.clientWidth),
                      );
                      if (nextIndex === mobileImageIndex) return;
                      mobileImageIndex = nextIndex;
                      handle.update();
                    }
                    function requestUpdate() {
                      if (!animationFrame)
                        animationFrame = requestAnimationFrame(updateIndex);
                    }
                    element.addEventListener("scroll", requestUpdate, {
                      passive: true,
                    });
                    signal.addEventListener("abort", () => {
                      element.removeEventListener("scroll", requestUpdate);
                      if (mobileGallery === element) mobileGallery = undefined;
                      if (animationFrame) cancelAnimationFrame(animationFrame);
                    });
                  }),
                ]}
              >
                {images.length ? (
                  images.map((image, index) => (
                    <div data-mobile-slide="true" key={image.id || image.url}>
                      <ProductImageFrame image={image} index={index} mobile />
                    </div>
                  ))
                ) : (
                  <div data-mobile-slide="true">
                    <ProductImageFallback />
                  </div>
                )}
              </div>
              {hydrated && images.length > 1 ? (
                <div mix={galleryControlsStyle}>
                  <button
                    type="button"
                    aria-label="Previous image"
                    disabled={mobileImageIndex === 0}
                    mix={on("click", () => moveMobileGallery(-1))}
                  >
                    <Icon name="chevron-left" />
                  </button>
                  <div
                    aria-label={`Image ${mobileImageIndex + 1} of ${images.length}`}
                  >
                    {images.map((image, index) => (
                      <span
                        key={image.id || image.url}
                        data-active={index === mobileImageIndex || undefined}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    aria-label="Next image"
                    disabled={mobileImageIndex === images.length - 1}
                    mix={on("click", () => moveMobileGallery(1))}
                  >
                    <Icon name="chevron-right" />
                  </button>
                </div>
              ) : null}
            </section>
          </div>

          <section mix={detailsStyle}>
            <div mix={headingStyle}>
              {product.category?.name ? (
                <p data-category="true">{product.category.name}</p>
              ) : null}
              <h1>{product.title}</h1>
              <p mix={priceStyle} aria-live="polite">
                {selectedVariant?.compareAtPrice ? (
                  <s>
                    {formatMoney(selectedVariant.compareAtPrice, {
                      locale: "en-US",
                    }).toString()}
                  </s>
                ) : null}
                <span
                  data-sale={
                    selectedVariant?.compareAtPrice ? "true" : undefined
                  }
                >
                  {formatMoney(price, { locale: "en-US" }).toString()}
                </span>
              </p>
            </div>

            <div mix={purchaseGroupStyle}>
              <div mix={purchaseStyle}>
                {options.length ? (
                  <div mix={optionsStyle}>
                    {options.map((option) => {
                      let selectedName = option.values.find(
                        (value) => value.selected,
                      )?.name;
                      return (
                        <details
                          key={option.name}
                          mix={[optionMenuStyle, productOptionMenuBehavior()]}
                        >
                          <summary>
                            <span>
                              <span mix={visuallyHiddenStyle}>
                                {option.name}:{" "}
                              </span>
                              {selectedName ?? option.name}
                            </span>
                            <Icon name="chevron-down" />
                          </summary>
                          <div>
                            {option.values.map((value) => {
                              let href = variantHref(
                                value.handle,
                                value.selectedOptions,
                                product.options,
                                search,
                              );
                              let label = value.available
                                ? value.name
                                : `${value.name} — Sold out`;

                              if (!value.exists) {
                                return (
                                  <button
                                    key={value.name}
                                    type="button"
                                    disabled
                                  >
                                    {value.name}
                                  </button>
                                );
                              }

                              if (
                                !activeState ||
                                value.handle !== product.handle
                              ) {
                                return (
                                  <a
                                    key={value.name}
                                    href={href}
                                    aria-current={
                                      value.selected ? "true" : undefined
                                    }
                                  >
                                    <span>{label}</span>
                                    {value.selected ? (
                                      <Icon name="check" />
                                    ) : null}
                                  </a>
                                );
                              }

                              let optionRegistration = register("optionValue", {
                                optionName: option.name,
                                value: value.name,
                              });

                              return (
                                <a
                                  key={value.name}
                                  href={href}
                                  aria-current={
                                    value.selected ? "true" : undefined
                                  }
                                  mix={on("click", (event) => {
                                    event.preventDefault();
                                    (event.currentTarget as HTMLElement)
                                      .closest("details")
                                      ?.removeAttribute("open");
                                    optionRegistration.onClick();
                                  })}
                                >
                                  <span>{label}</span>
                                  {value.selected ? (
                                    <Icon name="check" />
                                  ) : null}
                                </a>
                              );
                            })}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                ) : null}

                <div
                  mix={[
                    buyActionsStyle,
                    options.length ? undefined : buyActionsOnlyStyle,
                  ]}
                >
                  <form
                    action={CART_API_PATH}
                    method="post"
                    aria-busy={pending ? "true" : undefined}
                    mix={[
                      addFormStyle,
                      pending ? addPendingStyle : undefined,
                      on("submit", async (event) => {
                        event.preventDefault();
                        if (!store || !cartStore || !addEnabled) return;

                        let currentSubmission = ++submission;
                        submissionError = "";
                        pending = true;
                        handle.update();
                        let startedAt = Date.now();

                        try {
                          await store.handleFormSubmit(event);
                        } catch (error) {
                          if (currentSubmission === submission) {
                            submissionError =
                              error instanceof Error
                                ? error.message
                                : "The item could not be added.";
                          }
                        } finally {
                          if (currentSubmission === submission) {
                            await waitForAddToCartCheck(startedAt);
                            pending = false;
                            handle.update();
                          }
                        }
                      }),
                    ]}
                  >
                    <input type="hidden" {...register("merchandiseId", {})} />
                    <input
                      type="hidden"
                      {...register("quantity", { value: 1 })}
                    />
                    <button
                      {...register("addToCart", {})}
                      disabled={!addEnabled || pending}
                      aria-label={pending ? "Adding to cart" : undefined}
                    >
                      {pending ? (
                        <Icon name="check" />
                      ) : (
                        addToCartLabel(product, selectedVariant)
                      )}
                    </button>
                    {errors.length ? (
                      <div role="alert" mix={errorStyle}>
                        {errors.map((message) => (
                          <p key={message}>{message}</p>
                        ))}
                      </div>
                    ) : null}
                  </form>
                  {selectedVariant && addEnabled ? (
                    <ExpressShopPayButton
                      disabled={pending}
                      pending={pending}
                      storeUrl={handle.props.shopPayStoreUrl}
                      variantId={selectedVariant.id}
                    />
                  ) : null}
                </div>
              </div>
              {selectedVariant &&
              !selectedVariant.availableForSale &&
              productSubscriptionsEnabled(product) ? (
                <SubscribeForm
                  action="/subscribe"
                  mode="back-in-stock"
                  productHandle={product.handle}
                  variantId={selectedVariant.id}
                />
              ) : null}
            </div>

            {product.customDescription ? (
              <RichText
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
                  value={product.technicalDescription.value}
                  variant="product-description"
                />
              </div>
            ) : null}
          </section>
        </div>
      );
    };
  },
);

function productOptionMenuBehavior() {
  return ref((element: HTMLDetailsElement, signal) => {
    function close(restoreFocus = false) {
      if (!element.open) return;
      element.open = false;
      if (restoreFocus) element.querySelector("summary")?.focus();
    }
    function onPointerDown(event: PointerEvent) {
      if (!element.contains(event.target as Node)) close();
    }
    function onFocusIn(event: FocusEvent) {
      if (!element.contains(event.target as Node)) close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close(true);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("keydown", onKeyDown);
    signal.addEventListener("abort", () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("keydown", onKeyDown);
    });
  });
}

function ProductImageFallback() {
  return () => (
    <div aria-label="Product image unavailable" mix={imageFallbackStyle} />
  );
}

function ProductImageFrame(
  handle: Handle<{ image: ImageData; index: number; mobile?: boolean }>,
) {
  return () => {
    let { image, index, mobile } = handle.props;
    return (
      <div
        data-product-image={mobile ? undefined : image.id || image.url}
        mix={[
          productImageFrameStyle,
          ref((element, signal) => {
            let imageElement = element.querySelector<HTMLImageElement>(
              "img:not([data-preview-image])",
            );
            if (!imageElement) return;
            if (imageElement.complete) {
              element.dataset.loaded = "true";
              return;
            }
            let settle = () => {
              element.dataset.loaded = "true";
            };
            imageElement.addEventListener("load", settle, { once: true });
            imageElement.addEventListener("error", settle, { once: true });
            signal.addEventListener("abort", () => {
              imageElement.removeEventListener("load", settle);
              imageElement.removeEventListener("error", settle);
            });
          }),
        ]}
      >
        {/* Blurred low-res preview shown while the full image loads */}
        <img
          src={shopifyImageUrl(image.url, 32)}
          alt=""
          aria-hidden="true"
          draggable={false}
          data-preview-image="true"
        />
        <ShopifyImage
          image={image}
          alt={image.altText ?? "Product image"}
          sizes={mobile ? "100vw" : "(min-width: 1400px) 50vw, 60vw"}
          loading={index === 0 ? "eager" : "lazy"}
        />
      </div>
    );
  };
}

function Icon(handle: Handle<{ name: string }>) {
  return () => (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <use href={`/sprites.svg#${handle.props.name}`} />
    </svg>
  );
}

function orderedProductImages(
  images: ImageData[],
  selectedImage: ImageData | null | undefined,
): ImageData[] {
  if (!selectedImage) return images;
  return [
    selectedImage,
    ...images.filter((image) =>
      selectedImage.id
        ? image.id !== selectedImage.id
        : image.url !== selectedImage.url,
    ),
  ];
}

function productIdentity(product: ProductData): string {
  return `${product.id}:${product.selectedOrFirstAvailableVariant?.id ?? ""}`;
}

function isDefaultTitleOption(option: {
  name: string;
  values: ReadonlyArray<{ name: string }>;
}): boolean {
  return (
    option.name.trim().toLowerCase() === "title" &&
    option.values.length === 1 &&
    option.values[0]?.name.trim().toLowerCase() === "default title"
  );
}

function serverProductOptions(product: ProductData) {
  let selectedVariant = product.selectedOrFirstAvailableVariant;

  return product.options.map((option) => ({
    name: option.name,
    values: option.optionValues.map((value) => {
      let variant =
        value.firstSelectableVariant ??
        [
          product.selectedOrFirstAvailableVariant,
          ...product.adjacentVariants,
        ].find((candidate) =>
          candidate?.selectedOptions.some(
            (selectedOption) =>
              selectedOption.name === option.name &&
              selectedOption.value === value.name,
          ),
        ) ??
        null;
      return {
        name: value.name,
        selected:
          selectedVariant?.selectedOptions.some(
            (selectedOption) =>
              selectedOption.name === option.name &&
              selectedOption.value === value.name,
          ) ?? false,
        exists: variant !== null,
        available: variant?.availableForSale ?? false,
        selectedOptions: variant?.selectedOptions ?? [],
        handle: variant?.product?.handle ?? product.handle,
      };
    }),
  }));
}

export function variantHref(
  handle: string,
  selectedOptions: ReadonlyArray<SelectedOption>,
  options: ReadonlyArray<{ name: string }>,
  currentSearch = "",
): string {
  let search = new URLSearchParams(currentSearch);
  for (let option of options) search.delete(option.name);
  for (let option of selectedOptions) search.set(option.name, option.value);
  let query = search.toString();
  return `/products/${encodeURIComponent(handle)}${query ? `?${query}` : ""}`;
}

function ExpressShopPayButton(
  handle: Handle<{
    disabled: boolean;
    pending: boolean;
    storeUrl: string;
    variantId: string;
  }>,
) {
  return () => {
    let options: ShopPayButtonOptions = {
      checkoutUrl: handle.props.storeUrl,
      variants: [{ id: handle.props.variantId, quantity: 1 }],
      channel: "hydrogen",
      disabled: handle.props.disabled,
      width: "100%",
      borderRadius: "54px",
    };
    let attributes = getShopPayButtonAttributes(options);
    let style = getShopPayButtonStyleProperties(options);

    return (
      <div
        role="group"
        aria-label="Express checkout"
        aria-busy={handle.props.pending ? "true" : undefined}
        mix={[
          shopPayStyle,
          ref((element, signal) => {
            let active = true;
            let syncFocusVisible = () => {
              queueMicrotask(() => {
                if (signal.aborted) return;
                let shopPayButton = element.querySelector(
                  SHOP_PAY_BUTTON_TAG_NAME,
                );
                let focusedControl = shopPayButton?.shadowRoot?.activeElement;
                element.toggleAttribute(
                  "data-focus-visible",
                  Boolean(
                    element.matches(":focus-within") &&
                    focusedControl?.matches(":focus-visible"),
                  ),
                );
              });
            };

            void loadShopJs().catch((error) => {
              if (active)
                console.error("[hydrogen] Shop Pay failed to load", error);
            });
            element.addEventListener("focusin", syncFocusVisible);
            element.addEventListener("focusout", syncFocusVisible);
            signal.addEventListener("abort", () => {
              active = false;
              element.removeEventListener("focusin", syncFocusVisible);
              element.removeEventListener("focusout", syncFocusVisible);
            });
          }),
        ]}
      >
        {createElement(SHOP_PAY_BUTTON_TAG_NAME, { ...attributes, style })}
      </div>
    );
  };
}

function canAddServerVariant(product: ProductData): boolean {
  return Boolean(
    product.selectedOrFirstAvailableVariant?.availableForSale &&
    !product.requiresSellingPlan,
  );
}

const ADD_TO_CART_CHECK_MS = 600;

function waitForAddToCartCheck(startedAt: number) {
  if (
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }
  let remaining = ADD_TO_CART_CHECK_MS - (Date.now() - startedAt);
  if (remaining <= 0) return;
  return new Promise<void>((resolve) => {
    setTimeout(resolve, remaining);
  });
}

function addToCartLabel(
  product: ProductData,
  variant: ProductData["selectedOrFirstAvailableVariant"],
): string {
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

const visuallyHiddenStyle = css({
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: "1px",
  overflow: "hidden",
  position: "absolute",
  whiteSpace: "nowrap",
  width: "1px",
});
const productPageStyle = css({
  display: "grid",
  gap: "16px",
  marginTop: "calc(var(--header-height) + var(--store-wide-sale-height))",
  minHeight: "90vh",
  overflowX: "clip",
  paddingBottom: "64px",
  "@media (min-width: 810px)": {
    alignItems: "start",
    gap: "32px",
    gridTemplateColumns: "minmax(0, 1fr) clamp(330px, 36vw, 480px)",
    padding: "0 16px 80px",
  },
  "@media (min-width: 1400px)": {
    gridTemplateColumns: "152px minmax(0, 1fr) clamp(360px, 33.333vw, 576px)",
    paddingLeft: "36px",
    paddingRight: "36px",
  },
});

const sidebarStyle = css({
  display: "none",
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
  "& a:hover": { color: "var(--color-blue-brand)" },
  "@media (min-width: 1400px)": { display: "block" },
});

const galleryColumnStyle = css({ minWidth: 0 });
const desktopGalleryStyle = css({
  display: "none",
  flexDirection: "column",
  gap: "18px",
  marginInline: "auto",
  maxWidth: "1200px",
  width: "100%",
  "& > [data-product-image] + [data-product-image]": { opacity: 0.2 },
  "@media (min-width: 810px)": { display: "flex" },
  "@media (prefers-reduced-motion: reduce)": {
    "& > [data-product-image]": { opacity: 1 },
  },
});
const imageFallbackStyle = css({
  aspectRatio: "1",
  background: "var(--color-gray-900)",
  width: "100%",
  "@media (min-width: 810px)": { borderRadius: "24px" },
});
const productImageFrameStyle = css({
  aspectRatio: "1",
  backgroundColor: "var(--color-black)",
  overflow: "hidden",
  position: "relative",
  transition: "opacity 180ms ease",
  "& [data-preview-image]": {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter: "blur(20px)",
    // Scale up so the blur does not reveal transparent edges.
    transform: "scale(1.1)",
    opacity: 1,
    transition: "opacity 750ms ease",
  },
  "& img:not([data-preview-image])": {
    height: "100%",
    objectFit: "contain",
    position: "relative",
    width: "100%",
    filter: "blur(20px)",
    transition: "filter 750ms ease",
  },
  "&[data-loaded] [data-preview-image]": { opacity: 0 },
  "&[data-loaded] img:not([data-preview-image])": { filter: "blur(0)" },
  "@media (min-width: 810px)": { borderRadius: "24px" },
  "@media (prefers-reduced-motion: reduce)": {
    transition: "none",
    "& [data-preview-image]": { transition: "none" },
    "& img:not([data-preview-image])": { transition: "none" },
  },
});
const mobileGalleryShellStyle = css({
  marginInline: "-16px",
  position: "relative",
  "@media (min-width: 810px)": { display: "none" },
});
const mobileGalleryStyle = css({
  display: "flex",
  overflowX: "auto",
  overscrollBehaviorX: "contain",
  scrollSnapType: "x mandatory",
  scrollbarWidth: "none",
  "&::-webkit-scrollbar": { display: "none" },
  "& > div": { flex: "0 0 100%", scrollSnapAlign: "start", width: "100%" },
});
const galleryControlsStyle = css({
  alignItems: "center",
  background: "linear-gradient(0deg, rgba(0,0,0,.45), transparent)",
  bottom: 0,
  display: "flex",
  justifyContent: "space-between",
  left: 0,
  padding: "48px 16px 18px",
  pointerEvents: "none",
  position: "absolute",
  right: 0,
  "& button": {
    background: "transparent",
    border: 0,
    color: "white",
    padding: 0,
    pointerEvents: "auto",
  },
  "& button:disabled": { opacity: 0.25 },
  "& svg": { height: "24px", width: "24px" },
  "& div": { display: "flex", gap: "16px" },
  "& div span": {
    background: "rgba(255,255,255,.5)",
    borderRadius: "999px",
    height: "8px",
    width: "8px",
  },
  "& div span[data-active]": { background: "white" },
});

const detailsStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "24px",
  margin: "0 16px",
  minWidth: 0,
  "@media (min-width: 810px)": {
    gap: "36px",
    margin: 0,
    position: "sticky",
    top: "calc(var(--header-height) + var(--store-wide-sale-height))",
  },
  "@media (min-width: 1400px)": { paddingTop: "128px" },
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
  fontSize: "1rem",
  margin: 0,
  display: "flex",
  flexDirection: "row !important",
  gap: "10px !important",
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
  "& > div > a, & > div > button, & > div > span": {
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
  "& > div > a:hover, & > div > button:hover": {
    background: "rgba(255,255,255,.08)",
    color: "white",
  },
  "& > div > button:disabled, & > div > span[aria-disabled]": {
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
const shopPayStyle = css({
  borderRadius: "54px",
  height: "64px",
  minHeight: "64px",
  width: "100%",
  "& shop-pay-button": {
    borderRadius: "inherit",
    display: "flex",
    height: "100%",
    overflow: "hidden",
    width: "100%",
  },
  "&:focus-within[data-focus-visible]": {
    outline: "3px solid var(--color-yellow-brand)",
    outlineOffset: "4px",
  },
  "@media (min-width: 1400px)": {
    gridColumn: "1 / -1",
    height: "66px",
    minHeight: "66px",
  },
});
const pendingStyle = css({ opacity: 0.65, transition: "opacity 150ms ease" });
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
