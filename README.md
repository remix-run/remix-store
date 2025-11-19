# Remix Store

Welcome to the Remix Store built on Hydrogen!

## Getting Started

### Install dependencies

```sh
pnpm install
```

## Local development

TODO: make this work without needing access to the Shopify

```bash
pnpm run dev
```

## Building for production

```bash
pnpm run build
```

### Connecting to the Shopify Store

If you've never setup the Hydrogen CLI, run the following command

```sh
npx shopify hydrogen shortcut
```

If you have access to the Shopify store, go ahead and link via hydrogen

```sh
h2 link
```

```sh
h2 pull
```

## Shopify Admin

Eventually these docs might make it somewhere else, but just trying to capture some quirks about how Shopify Admin feeds into this project

### Hero

The hero component uses data from the Hero metaobject, which as 3 fields:

1. Masthead
2. Asset Images (the frames that drive the animation)
3. A product to link to

See [product.server.ts](app/lib/data/product.server.ts) for more details on the product query.

### Lookbook

The lookbook uses several "Lookbook Entry" metaobjects. Each entry has the following fields:

1. Image
2. Product (optional)

There is a maximum number of entries to try to fetch. If we ever want more we need to both add more entries in Shopify Admin and update the graphql query.

See [lookbook.server.ts](app/lib/data/lookbook.server.ts) for more details on the lookbook query.

### Product description

There are 2 description fields for a product, both optional, both under "Product metafields":

1. Description
2. Technical Description

The reason we don't use the main "Description" is because when querying with GraphQL, you don't receive rich text data for some reason.

### Store-wide sale

The store-wide sales require 2 things in Shopify Admin:

1. A metaobject with the following fields:
   1. Title
   2. Description
   3. End date

2. An automatic discount

The data is fetched in [header.server.ts](app/lib/data/header.server.ts) and accessed via `useCartDiscounts` defined in [cart](app/components/cart.tsx).
