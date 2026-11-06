import type { SerializableObject } from "remix/component";

// View-model shapes the server maps Storefront API data into and the browser
// islands render. They live under public/ because browser modules import them.

export type ImageData = SerializableObject & {
  altText?: string | null;
  height?: number | null;
  id?: string | null;
  url: string;
  width?: number | null;
};

export type ProductMoney = SerializableObject & {
  amount: string;
  currencyCode: string;
};

export type ProductCardData = SerializableObject & {
  compareAtPrice?: string | null;
  handle: string;
  id: string;
  images: ImageData[];
  isOnSale: boolean;
  price: string;
  title: string;
};

export type ProductPageInfoData = SerializableObject & {
  endCursor?: string | null;
  hasNextPage: boolean;
};

export type NavigationMenuItemData = SerializableObject & {
  id: string;
  /** Whether the link may be prefetched on intent. Set by the navbar. */
  prefetch?: boolean;
  title: string;
  url: string;
};

export type NavigationMenuData = SerializableObject & {
  items: NavigationMenuItemData[];
};

export type StoreWideSaleData = SerializableObject & {
  description: string;
  endDateTime?: string;
  title: string;
};
