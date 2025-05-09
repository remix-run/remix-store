import { redirect } from "react-router";
import { type CollectionQueryVariables } from "storefrontapi.generated";
import { type ProductFilter } from "@shopify/hydrogen/storefront-api-types";
import {
  type SortKey,
  SORT_KEY,
  FILTER,
  getSort,
  getAvailable,
  getPrice,
  getProductTypes,
} from ".";

/**
 * Parses the search params, redirecting if invalid
 * If the search params are valid, returns filters as query variables for the
 * collection query
 */
export function getFilterQueryVariables(
  searchParams: URLSearchParams,
): Omit<CollectionQueryVariables, "handle"> {
  // Get the valid values from the search params, redirecting if invalid
  let isValid = true;
  let searchParamsCopy = new URLSearchParams(searchParams);
  const sort = getSort(searchParams);
  if (!sort.isValid) {
    isValid = false;
    searchParamsCopy.delete(SORT_KEY);
  }
  const available = getAvailable(searchParams);
  if (!available.isValid) {
    isValid = false;
    searchParamsCopy.delete(FILTER.AVAILABLE);
  }
  const minPrice = getPrice(searchParams, FILTER.PRICE_MIN);
  if (!minPrice.isValid) {
    isValid = false;
    searchParamsCopy.delete(FILTER.PRICE_MIN);
  }
  const maxPrice = getPrice(searchParams, FILTER.PRICE_MAX);
  if (!maxPrice.isValid) {
    isValid = false;
    searchParamsCopy.delete(FILTER.PRICE_MAX);
  }
  const productTypes = getProductTypes(searchParams);
  if (!productTypes.isValid) {
    isValid = false;
    searchParamsCopy.delete(FILTER.PRODUCT_TYPE);
    for (const productType of productTypes.value) {
      searchParamsCopy.append(FILTER.PRODUCT_TYPE, productType);
    }
  }

  if (!isValid) {
    throw redirect(`?${searchParamsCopy.toString()}`);
  }

  // Build the filters object for the collection query

  const filters: ProductFilter[] = [];
  if (typeof available.value === "boolean") {
    filters.push({ available: available.value });
  }

  const price: ProductFilter["price"] = {};
  const min = minPrice.value;
  const max = maxPrice.value;
  if (typeof min === "number" || typeof max === "number") {
    if (typeof min === "number") {
      price.min = min;
    }
    if (typeof max === "number") {
      price.max = max;
    }
    filters.push({ price });
  }

  productTypes.value.forEach((productType) => {
    filters.push({ productType });
  });

  return {
    ...(sort.value ? sortMap.get(sort.value) : {}),
    filters,
  };
}

const sortMap = new Map<
  SortKey,
  Pick<CollectionQueryVariables, "sortKey" | "reverse">
>([
  ["price-high-to-low", { sortKey: "PRICE", reverse: true }],
  ["price-low-to-high", { sortKey: "PRICE", reverse: false }],
  ["newest", { sortKey: "CREATED", reverse: true }],
  ["best-selling", { sortKey: "BEST_SELLING", reverse: false }],
]);
