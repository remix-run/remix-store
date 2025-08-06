# Remix Store

Welcome to the Remix Store built with Shopify, React Router, and Hydrogen!

This is the codebase behind **[shop.remix.run](https://shop.remix.run)**. Run it locally to explore how to build a production headless Shopify store with modern web technologies.

## Getting Started

### Install dependencies

```sh
npm install
```

## Local development

### Environment setup

Copy the example environment file to create your local environment:

```bash
cp .env.example .env
```

⚠️ **Important:** This connects to the live production store. Any purchases will charge real money and ship actual Remix merch.

```bash
npm run dev
```

You'll have a local version of the Remix Store running with real product data, inventory, and checkout functionality.

## Building for production

```bash
npm run build
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

## Data Structures in Shopify Admin

Eventually these docs might make it somewhere else, but just trying to capture some quirks about how
Shopify Admin feeds into this project.

### Hero

The hero component uses data from the Hero metaobject with 3 fields:

1. Masthead
2. Asset Images (frames for animation)
3. Product link

See [hero.server.ts](app/lib/data/hero.server.ts) for the GraphQL query.

### Lookbook

Uses "Lookbook Entry" metaobjects with:

1. Image
2. Product (optional)

See [lookbook.server.ts](app/lib/data/lookbook.server.ts) for implementation.

### Product Metafields

Products use custom metafields under "Product metafields":

1. Description
2. Technical Description

We use metafields instead of the default description to access rich text data via GraphQL.

## Contributing

This is the production codebase for shop.remix.run. We welcome feedback and bug reports via GitHub issues.

See an issue you'd like to fix? Please open a PR!

## License

MIT License - see [LICENSE.md](LICENSE.md) for details.

## Related Resources

- [Hydrogen Documentation](https://shopify.dev/docs/api/hydrogen)
- [React Router Documentation](https://reactrouter.com/)

### Store-wide sale

The store-wide sales require 2 things in Shopify Admin:

1. A metaobject with the following fields:
   1. Title
   2. Description
   3. End date

2. An automatic discount

The data is fetched in [header.server.ts](app/lib/data/header.server.ts) and accessed via `useCartDiscounts` defined in [cart](app/components/cart.tsx).

Note: there is a 1 hour cache on the header data, so updates will not be live without a redeploy.

---

Built with ❤️ by the [Remix](https://remix.run) team
