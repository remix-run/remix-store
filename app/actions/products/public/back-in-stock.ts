export interface SubscriptionEnabledProduct {
  subscribeIfBackInStock?: { value: string } | null;
}

/** Browser-safe predicate for the public product hydration graph. */
export function productSubscriptionsEnabled(
  product: SubscriptionEnabledProduct,
): boolean {
  return product.subscribeIfBackInStock?.value.trim().toLowerCase() === "true";
}
