import type { Storefront } from "@shopify/hydrogen";
import type { HeaderQuery, ShopFragment } from "storefrontapi.generated";
import { MENU_FRAGMENT } from "../fragments";

export type StoreWideSaleData = {
  title: string;
  description: string;
};

export type HeaderData = {
  shop: ShopFragment;
  menu: HeaderQuery["menu"];
  storeWideSale?: StoreWideSaleData;
};

export async function getHeaderData(
  storefront: Storefront,
  variables: { headerMenuHandle: string },
): Promise<HeaderData> {
  const { shop, menu, errors } = await storefront.query(HEADER_QUERY, {
    cache: storefront.CacheLong(),
    variables,
  });

  if (errors) {
    console.error(errors);
    throw new Error("Failed to fetch header data");
  }

  if (!shop) {
    throw new Response("Shop data not found", { status: 404 });
  }

  // Parse and validate store wide sale data
  let storeWideSale: StoreWideSaleData | undefined = undefined;

  if (shop.storeWideSale?.reference) {
    let { title, description, endDateTime } = shop.storeWideSale.reference;

    // Check if the sale is still active
    if (
      !endDateTime?.value ||
      Date.now() < new Date(endDateTime.value).getTime()
    ) {
      storeWideSale = {
        title: title?.value ?? "",
        description: description?.value ?? "",
      };
    }
  }

  return {
    shop: {
      id: shop.id,
      name: shop.name,
      description: shop.description,
      primaryDomain: shop.primaryDomain,
      brand: shop.brand,
    },
    menu,
    storeWideSale,
  };
}

const HEADER_QUERY = `#graphql
  fragment Shop on Shop {
    id
    name
    description
    primaryDomain {
      url
    }
    brand {
      logo {
        image {
          url
        }
      }
    }
  }

  query Header(
    $country: CountryCode
    $headerMenuHandle: String!
    $language: LanguageCode
  ) @inContext(language: $language, country: $country) {
    shop {
      ...Shop
      # Metafield is a custom field that is used to store info about a storewide sale.
      storeWideSale: metafield(namespace: "custom", key: "storewide_sale") {
        reference {
          ... on Metaobject {
            title: field(key: "title") {
              value
            }
            description: field(key: "description") {
              value
            }
            endDateTime: field(key: "end_date_and_time") {
              value
            }
          }
        }
      }
    }
    menu(handle: $headerMenuHandle) {
      ...Menu
    }
  }
  ${MENU_FRAGMENT}
` as const;
