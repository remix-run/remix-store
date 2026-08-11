import { formatMoney } from "@shopify/hydrogen";
import { css, type Handle } from "remix/ui";

import type { ProductData } from "../../data/storefront.ts";
import { routes } from "../../routes.ts";
import { RichText } from "../../ui/rich-text.tsx";
import { Document } from "../../ui/document.tsx";
import { ShopifyImage } from "../../ui/public/shopify-image.tsx";

export function ProductPage(
  handle: Handle<{
    canonicalUrl: string;
    product: ProductData;
    search: string;
  }>,
) {
  return () => {
    let { product } = handle.props;
    let selectedVariant = product.selectedOrFirstAvailableVariant;
    let price = selectedVariant?.price ?? product.priceRange.minVariantPrice;
    let images = orderedImages(product);

    return (
      <Document
        canonicalUrl={handle.props.canonicalUrl}
        title={product.seo.title ?? product.title}
        description={product.seo.description ?? product.description}
        socialImage={images[0]?.url}
      >
        <main>
          {/* TODO(remix-ui): Remove this compatibility wrapper once upstream
              frame reconciliation stops dropping a destination sibling while
              disposing old clientEntry boundaries. */}
          <div mix={productPageStyle}>
            <section aria-label="Product images" mix={galleryStyle}>
              {images.length ? (
                images.map((image, index) => (
                  <div key={image.id} mix={imageFrameStyle}>
                    <ShopifyImage
                      image={image}
                      alt={image.altText ?? `${product.title} product image`}
                      loading={index === 0 ? "eager" : "lazy"}
                      sizes="(min-width: 1024px) 52vw, 100vw"
                    />
                  </div>
                ))
              ) : (
                <div
                  aria-label="Product image unavailable"
                  mix={imageFallbackStyle}
                />
              )}
            </section>

            <section mix={detailsStyle}>
              {product.category?.name ? (
                <p mix={categoryStyle}>{product.category.name}</p>
              ) : null}
              <h1 mix={titleStyle}>{product.title}</h1>
              <p aria-live="polite" mix={priceStyle}>
                {selectedVariant?.compareAtPrice ? (
                  <s>{formatPrice(selectedVariant.compareAtPrice)}</s>
                ) : null}
                <span>{formatPrice(price)}</span>
              </p>

              {productOptions(product, handle.props.search).map((option) => (
                <details key={option.name} mix={optionStyle}>
                  <summary>{option.selectedName ?? option.name}</summary>
                  <div>
                    {option.values.map((value) =>
                      value.exists ? (
                        <a
                          key={value.name}
                          href={value.href}
                          aria-current={value.selected ? "true" : undefined}
                          data-sold-out={!value.available || undefined}
                        >
                          {value.name}
                          {!value.available ? " — Sold out" : ""}
                        </a>
                      ) : (
                        <span key={value.name} aria-disabled="true">
                          {value.name}
                        </span>
                      ),
                    )}
                  </div>
                </details>
              ))}

              {selectedVariant && !selectedVariant.availableForSale ? (
                <p mix={availabilityStyle}>This variant is sold out.</p>
              ) : null}
              {product.requiresSellingPlan ? (
                <p mix={availabilityStyle}>
                  This product requires a selling plan.
                </p>
              ) : null}

              {product.customDescription ? (
                <RichText value={product.customDescription.value} />
              ) : product.description ? (
                <p mix={descriptionStyle}>{product.description}</p>
              ) : null}
              {product.technicalDescription ? (
                <section mix={technicalStyle}>
                  <h2>Technical Description</h2>
                  <RichText value={product.technicalDescription.value} />
                </section>
              ) : null}
            </section>
          </div>
        </main>
      </Document>
    );
  };
}

function formatPrice(
  price: ProductData["priceRange"]["minVariantPrice"],
): string {
  return formatMoney(price, { locale: "en-US" }).toString();
}

function orderedImages(product: ProductData) {
  let selectedImage = product.selectedOrFirstAvailableVariant?.image;
  if (!selectedImage) return product.images.nodes;
  return [
    selectedImage,
    ...product.images.nodes.filter((image) => image.id !== selectedImage.id),
  ];
}

function productOptions(product: ProductData, currentSearch: string) {
  let selectedVariant = product.selectedOrFirstAvailableVariant;
  let variants = [selectedVariant, ...product.adjacentVariants];

  return product.options
    .filter(
      (option) =>
        !(
          option.name.trim().toLowerCase() === "title" &&
          option.optionValues.length === 1 &&
          option.optionValues[0]?.name.trim().toLowerCase() === "default title"
        ),
    )
    .map((option) => {
      let values = option.optionValues.map((value) => {
        let variant =
          value.firstSelectableVariant ??
          variants.find((candidate) =>
            candidate?.selectedOptions.some(
              (selectedOption) =>
                selectedOption.name === option.name &&
                selectedOption.value === value.name,
            ),
          ) ??
          null;
        let selected =
          selectedVariant?.selectedOptions.some(
            (selectedOption) =>
              selectedOption.name === option.name &&
              selectedOption.value === value.name,
          ) ?? false;

        return {
          available: variant?.availableForSale ?? false,
          exists: variant !== null,
          href: variantHref(
            variant?.product.handle ?? product.handle,
            variant?.selectedOptions ?? [],
            product.options,
            currentSearch,
          ),
          name: value.name,
          selected,
        };
      });

      return {
        name: option.name,
        selectedName: values.find((value) => value.selected)?.name,
        values,
      };
    });
}

export function variantHref(
  handle: string,
  selectedOptions: ReadonlyArray<{ name: string; value: string }>,
  options: ReadonlyArray<{ name: string }>,
  currentSearch = "",
): string {
  let search = new URLSearchParams(currentSearch);
  for (let option of options) search.delete(option.name);
  for (let option of selectedOptions) search.set(option.name, option.value);
  let query = search.toString();
  return `${routes.products.show.href({ handle })}${query ? `?${query}` : ""}`;
}

const productPageStyle = css({
  display: "grid",
  gap: "24px",
  marginTop: "var(--header-height)",
  minHeight: "90vh",
  padding: "20px",
  "@media (min-width: 810px)": {
    alignItems: "start",
    gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 36vw)",
    padding: "36px",
  },
});
const galleryStyle = css({ display: "grid", gap: "18px" });
const imageFrameStyle = css({
  aspectRatio: "1",
  background: "var(--color-gray-900)",
  display: "grid",
  placeItems: "center",
  "& img": { height: "100%", objectFit: "contain", width: "100%" },
});
const imageFallbackStyle = css({
  aspectRatio: "1",
  background: "var(--color-gray-900)",
});
const detailsStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "20px",
  position: "sticky",
  top: "calc(var(--header-height) + 20px)",
});
const categoryStyle = css({ color: "var(--color-gray-200)", margin: 0 });
const titleStyle = css({ fontSize: "clamp(2rem, 4vw, 3.5rem)", margin: 0 });
const priceStyle = css({ display: "flex", gap: "10px", margin: 0 });
const optionStyle = css({
  borderBottom: "1px solid var(--color-gray-600)",
  paddingBottom: "12px",
  "& summary": { cursor: "pointer", fontWeight: 700 },
  "& > div": {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    paddingTop: "12px",
  },
  "& a, & span": {
    border: "1px solid var(--color-gray-400)",
    padding: "8px 12px",
  },
  '& a[aria-current="true"]': {
    background: "var(--color-white)",
    color: "var(--color-black)",
  },
  '& a[data-sold-out="true"]': { opacity: 0.6, textDecoration: "line-through" },
  '& span[aria-disabled="true"]': { cursor: "not-allowed", opacity: 0.4 },
});
const availabilityStyle = css({ color: "var(--color-red-brand)", margin: 0 });
const descriptionStyle = css({ margin: 0 });
const technicalStyle = css({
  borderTop: "1px solid var(--color-gray-600)",
  paddingTop: "20px",
  "& h2": { fontSize: "1rem", margin: "0 0 10px" },
});
