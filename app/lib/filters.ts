// client-side validation of search params

import { useNavigation, useSearchParams, useSubmit } from "@remix-run/react";

export const SORT_KEY = "sort";

export type SortKey =
  | "best-selling"
  | "price-high-to-low"
  | "price-low-to-high"
  | "newest";

export const SORT_OPTIONS = [
  { value: "best-selling", label: "Best Selling" },
  { value: "price-high-to-low", label: "Price: High To Low" },
  { value: "price-low-to-high", label: "Price: Low To High" },
  { value: "newest", label: "Newest" },
] satisfies { value: SortKey; label: string }[];

function usePendingSearchParams() {
  let [searchParams] = useSearchParams();

  const navigation = useNavigation();
  if (navigation.state === "loading") {
    searchParams = new URLSearchParams(navigation.location.search);
  }

  return searchParams;
}

export function useCurrentSort() {
  const searchParams = usePendingSearchParams();

  const sortKey = searchParams.get("sort");
  let sortOption;

  if (sortKey) {
    sortOption = SORT_OPTIONS.find((option) => option.value === sortKey);
  }
  return sortOption || SORT_OPTIONS[0];
}

export const FILTER = {
  AVAILABLE: "available",
  PRICE_MIN: "price.min",
  PRICE_MAX: "price.max",
  PRODUCT_TYPE: "product-type",
} as const;

export type FilterKey = (typeof FILTER)[keyof typeof FILTER];

/**
 * A submit function for filters form that automatically removes filters
 * with no values
 */
export function useFiltersSubmit() {
  const submit = useSubmit();

  return (e: React.FormEvent<HTMLFormElement>) => {
    const formData = new FormData(e.currentTarget);
    for (const key of formData.keys()) {
      if (formData.get(key) === "") {
        formData.delete(key);
      }
    }

    submit(formData, {
      preventScrollReset: true,
      replace: true,
      method: "get",
    });
  };
}

export function useIsFilterApplied() {
  const searchParams = usePendingSearchParams();

  const isFilterApplied = Object.values(FILTER).some((key) =>
    searchParams.has(key),
  );

  return isFilterApplied;
}

export function useIsAvailable() {
  const searchParams = usePendingSearchParams();

  let available: string | undefined =
    searchParams.get("available") || undefined;
  if (available !== "true" && available !== "false") {
    available = undefined;
  }

  return available;
}

export function usePrice() {
  const [searchParams] = useSearchParams();
  const min = searchParams.get("price.min") || undefined;
  const max = searchParams.get("price.max") || undefined;

  return { min, max };
}

/**
 * The available product types for filtering.
 *
 * I have not found a way to get these from the storefront API, so hardcoded here.
 */
export const PRODUCT_TYPES = [
  "apparel",
  "accessories",
  "stationary",
  "stickers",
  "toys",
] as const;

export function useCurrentProductTypes() {
  const searchParams = usePendingSearchParams();

  const productTypes = validateProductTypes(searchParams);

  return new Set(productTypes);
}

const productTypesSet = new Set(PRODUCT_TYPES);
export function validateProductTypes(searchParams: URLSearchParams) {
  const productTypes = searchParams.getAll(FILTER.PRODUCT_TYPE);
  return productTypes.filter((productType) => productTypesSet.has(productType));
}

// server-side validation and transformation of search params

// Next up:
// - Validate filters/sort server-side (remove invalid filter values)
// - Add the ability to deselect availability
// - Debounce min/max price change
