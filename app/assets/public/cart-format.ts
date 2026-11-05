import { formatMoney, type MoneyV2 } from "@shopify/hydrogen";
import { css } from "remix/component";

import type { MarketLocale } from "../../lib/public/market.ts";

export function money(value: MoneyV2, locale: MarketLocale): string {
  return formatMoney(value, { locale }).toString();
}

/** Dims a price or total while a cart update that may change it is pending. */
export const pendingValueStyle = css({
  opacity: 0.5,
});
