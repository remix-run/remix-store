import * as http from "node:http";

import { object, optional, parse, string } from "remix/data-schema";
import { createRequestListener } from "remix/node-fetch-server";

import { oxygen } from "@shopify/mini-oxygen/vite";
import { createServer, preview } from "vite";

import type { ProductData } from "../app/data/product.ts";
import { createNodeApp } from "../app/node.ts";
import { createCart } from "../app/testing/cart-fixtures.ts";
import {
  createStorefrontFetch,
  type StorefrontHandlers,
  type StorefrontOperations,
  type StorefrontRequestBody,
} from "../app/testing/storefront.ts";
import { remixOxygen } from "../vite/remix-oxygen.ts";

const appPort = 44_110;
const storefrontPort = 44_111;
const env = {
  PUBLIC_STORE_DOMAIN: `http://localhost:${storefrontPort}`,
  PRIVATE_STOREFRONT_API_TOKEN: "e2e-token",
};
const storefrontUrl = `${env.PUBLIC_STORE_DOMAIN}/api/graphql.json`;

const storefrontVariablesSchema = object({
  country: optional(string()),
  handle: optional(string()),
  after: optional(string()),
});

const storefrontFetch = createStorefrontFetch(storefrontHandlers());

const storefrontServer = http.createServer(async (request, response) => {
  let body = "";
  for await (let chunk of request) body += chunk;

  let fixture: Response;
  try {
    fixture = await storefrontFetch(storefrontUrl, { method: "POST", body });
  } catch (error) {
    fixture = Response.json(
      { errors: [{ message: String(error) }] },
      { status: 500 },
    );
  }
  response.writeHead(fixture.status, Object.fromEntries(fixture.headers));
  response.end(await fixture.text());
});

await listen(storefrontServer, storefrontPort);

const runtime = process.env.E2E_RUNTIME ?? "node";
let closeApp: () => Promise<void>;
if (runtime === "node") {
  let { app, close: closeNodeApp } = await createNodeApp();
  let appServer = http.createServer(
    createRequestListener((request) =>
      app.fetch(request, { buyerIp: "127.0.0.1", env }),
    ),
  );
  await listen(appServer, appPort);
  closeApp = async () => {
    await close(appServer);
    await closeNodeApp();
  };
} else if (runtime === "oxygen-preview" || runtime === "oxygen-dev") {
  let config = {
    configFile: false as const,
    plugins: [
      oxygen({
        entry: "./app/entry.oxygen.ts",
        env,
      }),
      remixOxygen({ compatibilityDate: "2026-04-01" }),
    ],
    server: { host: "localhost", port: appPort, strictPort: true },
    preview: { host: "localhost", port: appPort, strictPort: true },
  };
  if (runtime === "oxygen-dev") {
    let server = await createServer(config);
    await server.listen();
    closeApp = () => server.close();
  } else {
    let server = await preview(config);
    closeApp = () =>
      new Promise<void>((resolve, reject) => {
        server.httpServer.close((error) => (error ? reject(error) : resolve()));
      });
  }
} else {
  throw new Error(`Unknown E2E_RUNTIME: ${runtime}`);
}
console.log(`E2E fixture server listening on http://localhost:${appPort}`);

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  await Promise.all([closeApp(), close(storefrontServer)]);
}

process.on("SIGINT", () => void shutdown().then(() => process.exit(0)));
process.on("SIGTERM", () => void shutdown().then(() => process.exit(0)));

function variablesOf({ variables }: StorefrontRequestBody) {
  return parse(storefrontVariablesSchema, variables);
}

function storefrontHandlers(): StorefrontHandlers {
  return {
    RemixNavigation: () => ({
      menu: {
        items: [
          {
            id: "all",
            title: "All Products",
            url: "http://localhost:44110/collections/all",
          },
          {
            id: "apparel",
            title: "Apparel",
            url: "http://localhost:44110/collections/apparel",
          },
        ],
      },
      footerMenu: { items: [] },
      shop: {
        primaryDomain: { url: "http://localhost:44110" },
        storeWideSale: {
          reference: {
            __typename: "Metaobject",
            title: { value: "Sale" },
            description: { value: "Now" },
            endDateTime: { value: "2099-06-02T12:00:00Z" },
          },
        },
      },
    }),
    RemixHomeEditorial: () => ({
      shop: { name: "Remix Store", description: "Racing apparel" },
      hero: null,
      lookbook: null,
    }),
    RemixCollection: (body) => {
      let { after, country, handle } = variablesOf(body);
      if (handle === "apparel") {
        return {
          collection: {
            id: "apparel",
            handle: "apparel",
            title: "Apparel",
            description: "Racing apparel",
            seo: { title: null },
            products: {
              nodes: [
                {
                  ...productCard(country),
                  id: "apparel-product",
                  handle: "apparel-product",
                  title: "Apparel product",
                },
              ],
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        };
      }
      return {
        collection: {
          id: "collection",
          handle: "all",
          title: "All products",
          description: "The complete catalog",
          seo: { title: "Shop All" },
          products:
            after === "next-page"
              ? {
                  nodes: [
                    {
                      ...productCard(country),
                      id: "second-page-product",
                      handle: "second-page-product",
                      title: "Second page product",
                    },
                  ],
                  pageInfo: { hasNextPage: false, endCursor: null },
                }
              : {
                  nodes: [productCard(country)],
                  pageInfo: { hasNextPage: true, endCursor: "next-page" },
                },
        },
      };
    },
    RemixSitemapResources: () => ({
      sitemap: { resources: { hasNextPage: false, items: [] } },
    }),
    RemixProductNavigation: () => ({
      menu: null,
      shop: { primaryDomain: { url: "http://localhost:44110" } },
    }),
    RemixProduct: (body) => {
      let { country, handle } = variablesOf(body);
      return {
        product:
          handle === "sized-product" ? sizedProduct(country) : product(country),
      };
    },
    RemixAnalyticsShop: (body) => ({
      shop: { id: "gid://shopify/Shop/test" },
      localization: {
        country: {
          currency: { isoCode: currencyFor(variablesOf(body).country) },
        },
      },
    }),
    RemixDiscountCartCreate: () => ({
      cartCreate: {
        cart: { id: "gid://shopify/Cart/discount" },
        userErrors: [],
        warnings: [],
      },
    }),
    CartCreate: () => ({
      cartCreate: { cart: cart(), userErrors: [], warnings: [] },
    }),
    Cart: () => ({ cart: cart() }),
  };
}

function cart() {
  let value = createCart();
  let line = value.lines.nodes[0];
  if (line?.merchandise) {
    line.merchandise.id = "gid://shopify/ProductVariant/111";
    line.merchandise.product.title = "Test product";
    line.discountAllocations = [
      {
        __typename: "CartAutomaticDiscountAllocation",
        discountedAmount: { amount: "2", currencyCode: "USD" },
      },
    ];
    value.cost.totalAmount.amount = "8";
  }
  return value;
}

type ProductVariant = NonNullable<
  ProductData["selectedOrFirstAvailableVariant"]
>;
type CollectionProductCard = NonNullable<
  StorefrontOperations["RemixCollection"]["collection"]
>["products"]["nodes"][number];
type CurrencyCode = ProductVariant["price"]["currencyCode"];

function currencyFor(country?: string): CurrencyCode {
  return country === "CA" ? "CAD" : "USD";
}

function productCard(country?: string): CollectionProductCard {
  let currencyCode = currencyFor(country);
  return {
    id: "product",
    handle: "test-product",
    title: "Test product",
    images: {
      nodes: [
        {
          id: "product-image",
          url: "http://localhost:44110/social-main.jpg",
          altText: "Test product",
          width: 1200,
          height: 630,
        },
      ],
    },
    selectedOrFirstAvailableVariant: {
      price: { amount: "20.00", currencyCode },
      compareAtPrice: null,
    },
    priceRange: {
      maxVariantPrice: { amount: "20.00", currencyCode },
    },
  };
}

function product(country?: string): ProductData {
  let currencyCode = currencyFor(country);
  let selectedVariant = variant(currencyCode);
  return {
    id: "product",
    handle: "test-product",
    title: "Test product",
    description: "A deterministic test product.",
    vendor: "Remix",
    subscribeIfBackInStock: null,
    requiresSellingPlan: false,
    category: { name: "Test category" },
    seo: { title: "Test product", description: "A test product" },
    customDescription: richTextList("This water bottle"),
    technicalDescription: richTextList("Nalgene 32 oz."),
    priceRange: {
      minVariantPrice: { amount: "20.00", currencyCode },
    },
    encodedVariantExistence: "v1_0",
    encodedVariantAvailability: "v1_0",
    options: [
      {
        name: "Title",
        optionValues: [
          { name: "Default Title", firstSelectableVariant: selectedVariant },
        ],
      },
    ],
    selectedOrFirstAvailableVariant: selectedVariant,
    adjacentVariants: [],
    images: { nodes: [] },
  };
}

/** A product with a real option and several images. */
function sizedProduct(country?: string): ProductData {
  let currencyCode = currencyFor(country);
  let sizeVariant = (id: string, size: string): ProductVariant => ({
    ...variant(currencyCode),
    id: `gid://shopify/ProductVariant/${id}`,
    product: { handle: "sized-product", title: "Sized product" },
    selectedOptions: [{ name: "Size", value: size }],
    title: size,
  });
  let small = sizeVariant("201", "Small");
  let medium = sizeVariant("202", "Medium");
  return {
    ...product(country),
    id: "sized-product",
    handle: "sized-product",
    title: "Sized product",
    seo: { title: "Sized product", description: "A sized product" },
    encodedVariantExistence: "v1_0-1",
    encodedVariantAvailability: "v1_0-1",
    options: [
      {
        name: "Size",
        optionValues: [
          { name: "Small", firstSelectableVariant: small },
          { name: "Medium", firstSelectableVariant: medium },
        ],
      },
    ],
    selectedOrFirstAvailableVariant: small,
    adjacentVariants: [small, medium],
    images: {
      nodes: ["social-main", "social-collections"].map((name) => ({
        id: `gid://shopify/ProductImage/${name}`,
        url: `http://localhost:${appPort}/${name}.jpg`,
        altText: "Sized product",
        width: 1200,
        height: 630,
      })),
    },
  };
}

function variant(currencyCode: CurrencyCode = "USD"): ProductVariant {
  return {
    availableForSale: true,
    compareAtPrice: null,
    id: "gid://shopify/ProductVariant/111",
    image: null,
    price: { amount: "20.00", currencyCode },
    product: { handle: "test-product", title: "Test product" },
    selectedOptions: [{ name: "Title", value: "Default Title" }],
    title: "Default Title",
    sku: null,
  };
}

function richTextList(value: string) {
  return {
    value: JSON.stringify({
      type: "root",
      children: [
        {
          type: "unordered-list",
          children: [
            { type: "list-item", children: [{ type: "text", value }] },
          ],
        },
      ],
    }),
  };
}

function listen(server: http.Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections();
  });
}
