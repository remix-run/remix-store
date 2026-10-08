import * as http from "node:http";

import { object, optional, parse, string } from "remix/data-schema";
import { createRequestListener } from "remix/node-fetch-server";

import { oxygen } from "@shopify/mini-oxygen/vite";
import { createServer, preview } from "vite";

import { remixOxygen } from "../vite/remix-oxygen.ts";
import { createCart } from "../test/cart-fixtures.ts";

const appPort = 44_110;
const storefrontPort = 44_111;
const env = {
  PUBLIC_STORE_DOMAIN: `http://localhost:${storefrontPort}`,
  PRIVATE_STOREFRONT_API_TOKEN: "e2e-token",
};

const storefrontRequestSchema = object({
  query: string(),
  variables: optional(
    object({
      country: optional(string()),
      handle: optional(string()),
      after: optional(string()),
    }),
  ),
});

type StorefrontVariables = {
  after?: string;
  country?: string;
  handle?: string;
};
type StorefrontRequest = { query: string; variables: StorefrontVariables };

const storefrontServer = http.createServer(async (request, response) => {
  let body = "";
  for await (let chunk of request) body += chunk;

  try {
    let { query, variables } = parseStorefrontRequest(body);
    let operation = query.match(
      /\b(?:query|mutation)\s+([A-Za-z_][A-Za-z0-9_]*)/,
    )?.[1];
    let data = storefrontData(operation, variables);
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data }));
  } catch (error) {
    response.writeHead(500, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ errors: [{ message: String(error) }] }));
  }
});

await listen(storefrontServer, storefrontPort);

const runtime = process.env.E2E_RUNTIME ?? "node";
let closeApp: () => Promise<void>;
if (runtime === "node") {
  let { app, closeNodeApp } = await import("../app/node.ts");
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

function parseStorefrontRequest(body: string): StorefrontRequest {
  let { query, variables: parsedVariables } = parse(
    storefrontRequestSchema,
    JSON.parse(body),
  );
  return { query, variables: parsedVariables ?? {} };
}

function storefrontData(
  operation: string | undefined,
  { after, country, handle }: StorefrontVariables,
) {
  switch (operation) {
    case "RemixNavigation":
      return {
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
      };
    case "RemixHomeEditorial":
      return {
        shop: { name: "Remix Store", description: "Racing apparel" },
        hero: null,
        lookbook: null,
      };
    case "RemixCollection":
      if (handle === "apparel") {
        return {
          collection: {
            id: "apparel",
            handle: "apparel",
            title: "Apparel",
            description: "Racing apparel",
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
    case "RemixCanadianSitemapResources":
    case "RemixSitemapResources":
      return {
        sitemap: { resources: { hasNextPage: false, items: [] } },
      };
    case "RemixProductNavigation":
      return { menu: null, shop: null };
    case "RemixProduct":
      return { product: product(country) };
    case "RemixAnalyticsShop":
      return {
        shop: { id: "gid://shopify/Shop/test" },
        localization: {
          country: {
            currency: { isoCode: country === "CA" ? "CAD" : "USD" },
          },
        },
      };
    case "redirects":
      return { urlRedirects: { edges: [] } };
    case "RemixDiscountCartCreate":
      return {
        cartCreate: {
          cart: { id: "gid://shopify/Cart/discount" },
          userErrors: [],
          warnings: [],
        },
      };
    case "CartCreate":
      return {
        cartCreate: { cart: cart(), userErrors: [], warnings: [] },
      };
    case "Cart":
      return { cart: cart() };
    default:
      throw new Error(`Unexpected Storefront operation: ${operation}`);
  }
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

function productCard(country?: string) {
  let currencyCode = country === "CA" ? "CAD" : "USD";
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

function product(country?: string) {
  let currencyCode = country === "CA" ? "CAD" : "USD";
  let selectedVariant = variant(currencyCode);
  return {
    id: "product",
    handle: "test-product",
    title: "Test product",
    description: "A deterministic test product.",
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

function variant(currencyCode = "USD") {
  return {
    availableForSale: true,
    compareAtPrice: null,
    id: "gid://shopify/ProductVariant/111",
    image: null,
    price: { amount: "20.00", currencyCode },
    product: { handle: "test-product", title: "Test product" },
    selectedOptions: [{ name: "Title", value: "Default Title" }],
    title: "Default Title",
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
