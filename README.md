# Remix Store

The storefront behind [shop.remix.run](https://shop.remix.run).

The `v3` branch is migrating the production store to Remix 3 and framework-neutral Hydrogen. The current branch intentionally contains a minimal platform skeleton; shopper-facing features are being ported in focused pull requests. See [`REMIX_STORE_MIGRATION_PLAN.md`](./REMIX_STORE_MIGRATION_PLAN.md) and [`REMIX_STORE_PARITY_PLAN.md`](./REMIX_STORE_PARITY_PLAN.md).

## Requirements

- Node.js 24
- pnpm 10.33.4

## Local development

```sh
pnpm install
cp .env.example .env
pnpm dev
```

The example environment points at the live production store. Purchases create real orders and charge real money.

## Validation

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm preview
```

The build produces a self-contained Oxygen worker at `dist/ssr/index.js` and browser assets in `dist/client/`.

## Skeleton architecture

- `app/routes.ts` defines the typed route contract.
- `app/router.ts` maps routes and composes request middleware.
- `app/middleware/storefront.ts` creates a request-scoped Hydrogen Storefront client.
- `app/middleware/render.tsx` renders Remix UI to streaming HTML.
- `app/entry.server.ts` is the Oxygen Worker entry.
- `app/entry.browser.ts` hydrates browser components.
- `vite/remix-oxygen.ts` owns the temporary Remix 3/Oxygen build integration.

## License

MIT License — see [`LICENSE.md`](./LICENSE.md).
