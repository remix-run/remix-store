import { useRef } from "react";
import { useNavigation, useSearchParams, useSubmit } from "react-router";

export const SORT_KEY = "sort";

export type SortKey =
  | "best-selling"
  | "price-high-to-low"
  | "price-low-to-high"
  | "newest";

/**
 * The available product types for filtering.
 *
 * I have not found a way to get these from the storefront API, so hardcoded here.
 */
export const PRODUCT_TYPES = [
  "apparel",
  "accessories",
  "stationery",
  "stickers",
  "toys",
] as const;

export const SORT_OPTIONS = [
  { value: "best-selling", label: "Best Selling" },
  { value: "price-high-to-low", label: "Price: High To Low" },
  { value: "price-low-to-high", label: "Price: Low To High" },
  { value: "newest", label: "Newest" },
] satisfies { value: SortKey; label: string }[];

export const FILTER = {
  AVAILABLE: "available",
  PRICE_MIN: "price.min",
  PRICE_MAX: "price.max",
  PRODUCT_TYPE: "product-type",
} as const;

export type FilterKey = (typeof FILTER)[keyof typeof FILTER];

type ProductType = (typeof PRODUCT_TYPES)[number];

function usePendingSearchParams() {
  let [searchParams] = useSearchParams();

  const navigation = useNavigation();
  if (navigation.state === "loading") {
    searchParams = new URLSearchParams(navigation.location.search);
  }

  return searchParams;
}

const sortOptionMap = new Map(
  SORT_OPTIONS.map((option) => [option.value, option]),
);
export function useCurrentSort() {
  const searchParams = usePendingSearchParams();
  const { value } = getSort(searchParams);
  const sortOption = value && sortOptionMap.get(value);
  return sortOption ?? SORT_OPTIONS[0];
}

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
  const { value } = getAvailable(searchParams);
  return value === true ? "true" : value === false ? "false" : undefined;
}

export function useCurrentProductTypes() {
  const searchParams = usePendingSearchParams();
  const { value } = getProductTypes(searchParams);
  return new Set(value);
}

// Functions to get and validate values from search params

type GetValueResult<T> = {
  value: T | undefined;
  isValid: boolean;
};

/**
 * Get the sort key from the search params if it exists
 * If the sort key is invalid, returns `{ value: undefined, valid: false }`
 */
export function getSort(
  searchParams: URLSearchParams,
): GetValueResult<SortKey> {
  if (!searchParams.has("sort")) {
    return { value: undefined, isValid: true };
  }
  const sort = searchParams.get("sort");
  if (isValidSort(sort)) {
    return { value: sort, isValid: true };
  }
  return { value: undefined, isValid: false };
}

const sortSet = new Set(SORT_OPTIONS.map((option) => option.value));
function isValidSort(sortKey: string | null): sortKey is SortKey {
  if (sortKey === null) {
    return false;
  }
  return sortSet.has(sortKey);
}

/**
 * Get the available from the search params if it exists
 * If available is invalid, returns `{ value: undefined, isValid: false }`
 */
export function getAvailable(
  searchParams: URLSearchParams,
): GetValueResult<boolean> {
  if (!searchParams.has("available")) {
    return { value: undefined, isValid: true };
  }
  const available = searchParams.get("available");
  if (available === "true" || available === "false") {
    return { value: available === "true", isValid: true };
  }
  return { value: undefined, isValid: false };
}

export function usePrice() {
  const [searchParams] = useSearchParams();
  return {
    min: getPrice(searchParams, "price.min").value,
    max: getPrice(searchParams, "price.max").value,
  };
}

/**
 * Get price from the search params if it exists
 * If price is invalid, returns `{ value: undefined, isValid: false }`
 */
export function getPrice(
  searchParams: URLSearchParams,
  key: "price.min" | "price.max",
): GetValueResult<number> {
  const price = searchParams.get(key);
  if (!price) {
    return { value: undefined, isValid: true };
  }
  const priceNumber = Number(price);
  if (isNaN(priceNumber) || priceNumber < 0) {
    return { value: undefined, isValid: false };
  }
  return { value: priceNumber, isValid: true };
}

/**
 * Get product-type from the search params if it exists
 * If product-type is invalid, returns `{ value: [], isValid: false }`
 */
export function getProductTypes(searchParams: URLSearchParams): {
  value: ProductType[];
  isValid: boolean;
} {
  if (!searchParams.has(FILTER.PRODUCT_TYPE)) {
    return { value: [], isValid: true };
  }
  let isValid = true;
  const productTypes = searchParams.getAll(FILTER.PRODUCT_TYPE);
  const validProductTypes: ProductType[] = [];
  for (const productType of productTypes) {
    if (!isValidProductType(productType)) {
      isValid = false;
    } else {
      validProductTypes.push(productType);
    }
  }

  return { value: validProductTypes, isValid };
}

const productTypesSet = new Set(PRODUCT_TYPES);
function isValidProductType(productType: string): productType is ProductType {
  return productTypesSet.has(productType);
}
