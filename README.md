# Remix Store

Welcome to the Remix Store built with Shopify, React Router, and Hydrogen!

This is the codebase behind **[shop.remix.run](https://shop.remix.run)**. Run it locally to explore how to build a production headless Shopify store with modern web technologies.

## Getting Started

### Install dependencies

```sh
pnpm install
```

## Local development

### Environment setup

Copy the example environment file to create your local environment:

```bash
cp .env.example .env
```

⚠️ **Important:** This connects to the live production store. Any purchases will charge real money and ship actual Remix merch.

```bash
pnpm dev
```

You'll have a local version of the Remix Store running with real product data, inventory, and checkout functionality.

## Building for production

```bash
pnpm build
```

## Testing

```bash
pnpm test
pnpm test:e2e
```

The end-to-end suite starts the local storefront and covers the catalog, product, cart, SEO resources, 404 handling, and the no-JavaScript add-to-cart flow. It creates Shopify carts but never enters checkout. Set `BASE_URL` to test an existing deployment instead of starting the local server.

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

## Shopify Admin data

The GraphQL queries are the source of truth for Shopify-side contracts. This table records the identifiers that must also be configured in Shopify Admin.

| Surface         | Shopify configuration                                                                                                                        | Source                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Home hero       | Metaobject type `hero`, handle `remix-3-drop-playground`; `asset_images` media references and a `collection` reference                       | [`hero.server.ts`](app/lib/data/hero.server.ts)                    |
| Lookbook        | Metaobject type `lookbook`, handle `lookbook-remix-racing`; `lookbook` entries with a media image and optional product                       | [`lookbook.server.ts`](app/lib/data/lookbook.server.ts)            |
| Navigation      | Menus named `main-menu`, `footer`, and `product-sidebar-menu`                                                                                | [`root.tsx`](app/root.tsx), [`fragments.ts`](app/lib/fragments.ts) |
| Product content | `custom.description`, `custom.technical_description`, and `custom.subscribe_if_back_in_stock` metafields                                     | [`product.server.ts`](app/lib/data/product.server.ts)              |
| Store-wide sale | `custom.storewide_sale` shop metafield referencing `title`, `description`, and `end_date_and_time`; paired with a Shopify automatic discount | [`header.server.ts`](app/lib/data/header.server.ts)                |

## Contributing

This is the production codebase for shop.remix.run. We welcome feedback and bug reports via GitHub issues.

See an issue you'd like to fix? Please open a PR!

## License

MIT License - see [LICENSE.md](LICENSE.md) for details.

## Related Resources

- [Hydrogen Documentation](https://shopify.dev/docs/api/hydrogen)
- [React Router Documentation](https://reactrouter.com/)

---

Built with ❤️ by the [Remix](https://remix.run) team
