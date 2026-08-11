import type { SerializableObject } from "remix/ui";

export type SerializedMoney = SerializableObject & {
  amount: string;
  currencyCode: string;
};

export type SerializedCartImage = SerializableObject & {
  altText?: string | null;
  height?: number | null;
  id?: string | null;
  url: string;
  width?: number | null;
};

export type SerializedCartMerchandise = SerializableObject & {
  id: string;
  image?: SerializedCartImage | null;
  product: SerializableObject & {
    handle?: string;
    id: string;
    productType?: string;
    title: string;
    vendor: string;
  };
  selectedOptions?: Array<
    SerializableObject & {
      name: string;
      value: string;
    }
  >;
  sku?: string | null;
  title?: string;
};

export type SerializedCartLine = SerializableObject & {
  cost: SerializableObject & {
    amountPerQuantity: SerializedMoney;
    compareAtAmountPerQuantity: SerializedMoney | null;
    subtotalAmount: SerializedMoney;
    totalAmount: SerializedMoney;
  };
  discountAllocations: Array<
    SerializableObject & {
      code?: string;
      discountedAmount: SerializedMoney;
      title?: string;
    }
  >;
  id: string;
  merchandise?: SerializedCartMerchandise;
  quantity: number;
};

export type SerializedCartData = SerializableObject & {
  checkoutUrl: string | null;
  cost: SerializableObject & {
    checkoutChargeAmount: SerializedMoney;
    subtotalAmount: SerializedMoney;
    totalAmount: SerializedMoney;
  };
  discountCodes: Array<
    SerializableObject & {
      applicable: boolean;
      code: string;
    }
  >;
  id: string;
  lines: SerializableObject & {
    nodes: SerializedCartLine[];
  };
  note: string | null;
  totalQuantity: number;
  updatedAt: string;
};

export type CartInitialData = SerializableObject & {
  cart: SerializedCartData | null;
  errors?: Array<SerializableObject & { message: string }>;
};
