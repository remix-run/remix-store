import { useRef } from "react";
import {
  redirect,
  useNavigation,
  useSearchParams,
  useSubmit,
} from "@remix-run/react";
import { type CollectionQueryVariables } from "storefrontapi.generated";
import { type ProductFilter } from "@shopify/hydrogen/storefront-api-types";

// client-side validation of search params

function usePendingSearchParams() {
  let [searchParams] = useSearchParams();

  const navigation = useNavigation();
  if (navigation.state === "loading") {
    searchParams = new URLSearchParams(navigation.location.search);
  }

  return searchParams;
}

export const SORT_KEY = "sort";

type SortKey =
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

const sortOptionMap = new Map(
  SORT_OPTIONS.map((option) => [option.value, option]),
);

export function useCurrentSort() {
  const searchParams = usePendingSearchParams();
  const { sort } = getSort(searchParams);
  const sortOption = sort && sortOptionMap.get(sort);
  return sortOption ?? SORT_OPTIONS[0];
}

/**
 * Get the sort key from the search params if it exists
 * If the sort key is invalid, returns `{ sort: undefined, valid: false }`
 */
function getSort(searchParams: URLSearchParams): {
  sort: SortKey | undefined;
  valid: boolean;
} {
  if (!searchParams.has("sort")) {
    return { sort: undefined, valid: true };
  }
  const sort = searchParams.get("sort");
  if (isValidSort(sort)) {
    return { sort, valid: true };
  }
  return { sort: undefined, valid: false };
}

const sortSet = new Set(SORT_OPTIONS.map((option) => option.value));
function isValidSort(sortKey: string | null): sortKey is SortKey {
  if (sortKey === null) {
    return false;
  }
  return sortSet.has(sortKey);
}

export const FILTER = {
  AVAILABLE: "available",
  PRICE_MIN: "price.min",
  PRICE_MAX: "price.max",
  PRODUCT_TYPE: "product-type",
} as const;

export type FilterKey = (typeof FILTER)[keyof typeof FILTER];

export function useFiltersSubmit() {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = useSubmit();

  const submitForm = () => {
    const formNode = formRef.current;
    if (!formNode) {
      throw new Error("formRef must be attached to a form element");
    }

    const formData = new FormData(formNode);

    const keys = [...formData.keys()];

    for (const key of keys) {
      const value = formData.get(key);
      if (value === "") {
        formData.delete(key);
      }
    }

    submit(formData, {
      preventScrollReset: true,
      replace: true,
      method: "get",
    });
  };

  return [formRef, submitForm] as const;
}

export function useIsFilterApplied() {
  const searchParams = usePendingSearchParams();

  const isFilterApplied = Object.values(FILTER).some((key) =>
    searchParams.has(key),
  );

  return isFilterApplied;
}

export function useIsAvailable(): "true" | "false" | undefined {
  const searchParams = usePendingSearchParams();
  const { available } = getAvailable(searchParams);
  return available === true
    ? "true"
    : available === false
      ? "false"
      : undefined;
}

/**
 * Get the available from the search params if it exists
 * If available is invalid, returns `{ available: undefined, valid: false }`
 */
function getAvailable(searchParams: URLSearchParams): {
  available: boolean | undefined;
  valid: boolean;
} {
  if (!searchParams.has("available")) {
    return { available: undefined, valid: true };
  }
  const available = searchParams.get("available");
  if (available === "true" || available === "false") {
    return { available: available === "true", valid: true };
  }
  return { available: undefined, valid: false };
}

export function usePrice() {
  const [searchParams] = useSearchParams();
  const { min } = getMinPrice(searchParams);
  const { max } = getMaxPrice(searchParams);
  return { min, max };
}

/**
 * Get price.min from the search params if it exists
 * If price.min is invalid, returns `{ min: undefined, valid: false }`
 */
function getMinPrice(searchParams: URLSearchParams): {
  min: number | undefined;
  valid: boolean;
} {
  const min = searchParams.get("price.min");
  if (!min) {
    return { min: undefined, valid: true };
  }
  const minNumber = Number(min);
  if (isNaN(minNumber) || minNumber < 0) {
    return { min: undefined, valid: false };
  }
  return { min: minNumber, valid: true };
}
/**
 * Get price.max from the search params if it exists
 * If price.max is invalid, returns `{ max: undefined, valid: false }`
 */
function getMaxPrice(searchParams: URLSearchParams): {
  max: number | undefined;
  valid: boolean;
} {
  const max = searchParams.get("price.max");
  if (!max) {
    return { max: undefined, valid: true };
  }
  const maxNumber = Number(max);
  if (isNaN(maxNumber) || maxNumber < 0) {
    return { max: undefined, valid: false };
  }
  return { max: maxNumber, valid: true };
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

type ProductType = (typeof PRODUCT_TYPES)[number];

export function useCurrentProductTypes() {
  const searchParams = usePendingSearchParams();
  const { productTypes } = getProductTypes(searchParams);
  return new Set(productTypes);
}

/**
 * Get product-type from the search params if it exists
 * If product-type is invalid, returns `{ productTypes: [], valid: false }`
 */
export function getProductTypes(searchParams: URLSearchParams): {
  productTypes: ProductType[];
  valid: boolean;
} {
  if (!searchParams.has(FILTER.PRODUCT_TYPE)) {
    return { productTypes: [], valid: true };
  }
  let valid = true;
  const productTypes = searchParams.getAll(FILTER.PRODUCT_TYPE);
  const validProductTypes: ProductType[] = [];
  for (const productType of productTypes) {
    if (!isValidProductType(productType)) {
      valid = false;
    } else {
      validProductTypes.push(productType);
    }
  }

  return { productTypes: validProductTypes, valid };
}

const productTypesSet = new Set(PRODUCT_TYPES);
function isValidProductType(productType: string): productType is ProductType {
  return productTypesSet.has(productType);
}

// server-side validation and transformation of search params

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
