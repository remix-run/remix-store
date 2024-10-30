import { redirect } from "@remix-run/react";
import { type CollectionQueryVariables } from "storefrontapi.generated";
import { type ProductFilter } from "@shopify/hydrogen/storefront-api-types";
import {
  type SortKey,
  SORT_KEY,
  FILTER,
  getSort,
  getAvailable,
  getMinPrice,
  getMaxPrice,
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
  let valid = true;
  let searchParamsCopy = new URLSearchParams(searchParams);
  const parsedSort = getSort(searchParams);
  if (!parsedSort.valid) {
    valid = false;
    searchParamsCopy.delete(SORT_KEY);
  }
  const parsedAvailable = getAvailable(searchParams);
  if (!parsedAvailable.valid) {
    valid = false;
    searchParamsCopy.delete(FILTER.AVAILABLE);
  }
  const parsedMinPrice = getMinPrice(searchParams);
  if (!parsedMinPrice.valid) {
    valid = false;
    searchParamsCopy.delete(FILTER.PRICE_MIN);
  }
  const parsedMaxPrice = getMaxPrice(searchParams);
  if (!parsedMaxPrice.valid) {
    valid = false;
    searchParamsCopy.delete(FILTER.PRICE_MAX);
  }
  const parsedProductTypes = getProductTypes(searchParams);
  if (!parsedProductTypes.valid) {
    valid = false;
    searchParamsCopy.delete(FILTER.PRODUCT_TYPE);
    for (const productType of parsedProductTypes.productTypes) {
      searchParamsCopy.append(FILTER.PRODUCT_TYPE, productType);
    }
  }

  if (!valid) {
    throw redirect(`?${searchParamsCopy.toString()}`);
  }

  const filters: ProductFilter[] = [];
  if (typeof parsedAvailable.available === "boolean") {
    filters.push({ available: parsedAvailable.available });
  }

  const price: ProductFilter["price"] = {};
  const min = parsedMinPrice.min;
  const max = parsedMaxPrice.max;
  if (typeof min === "number" || typeof max === "number") {
    if (typeof min === "number") {
      price.min = min;
    }
    if (typeof max === "number") {
      price.max = max;
    }
    filters.push({ price });
  }

  parsedProductTypes.productTypes.forEach((productType) => {
    filters.push({ productType });
  });

  return {
    ...(parsedSort.sort ? sortMap.get(parsedSort.sort) : {}),
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
