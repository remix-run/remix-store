import type { CartDataFromHandlers, CartGetData } from "@shopify/hydrogen";
import type { SerializableObject, SerializablePrimitive } from "remix/ui";

import type { cartHandlers } from "./cart.server.ts";

type SerializableCartValue<Value> = Value extends SerializablePrimitive
  ? Value
  : Value extends readonly (infer Item)[]
    ? SerializableCartValue<Item>[]
    : Value extends object
      ? SerializableObject & {
          [Key in keyof Value as string extends Key
            ? never
            : number extends Key
              ? never
              : Key]: SerializableCartValue<Value[Key]>;
        }
      : never;

type HydrogenCartData = CartDataFromHandlers<typeof cartHandlers>;

export type SerializedCartData = SerializableCartValue<HydrogenCartData>;
export type CartInitialData = SerializableCartValue<
  CartGetData<HydrogenCartData>
>;
