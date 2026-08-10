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

`pnpm dev` runs the framework-native Node server with `remix/assets`. Use `pnpm dev:oxygen` when testing the same application under MiniOxygen's Worker runtime.

The example environment points at the live production store. Purchases create real orders and charge real money.

## Validation

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build:oxygen
pnpm preview:oxygen
```

The Oxygen build produces a self-contained Worker at `dist/ssr/index.js` and browser assets in `dist/client/`. The Node server compiles browser modules through `remix/assets` and is the foundation for the later Fly deployment target.

## Skeleton architecture

- `app/routes.ts` defines the typed route contract.
- `app/router.ts` maps routes and composes shared request middleware.
- `app/router.node.ts` adds static files, Remix Assets, and Node rendering.
- `app/router.oxygen.ts` adds Vite asset metadata and Oxygen rendering.
- `app/assets.server.ts` owns the Node browser-asset pipeline.
- `app/middleware/storefront.ts` creates a request-scoped Hydrogen Storefront client.
- `app/middleware/render.tsx` contains runtime-neutral streaming SSR.
- `server.node.ts` is the Node/Fly-compatible server entry.
- `app/entry.server.ts` is the Oxygen Worker entry.
- `app/entry.browser.ts` hydrates browser components on both targets.
- `vite/remix-oxygen.ts` owns the temporary Remix 3/Oxygen build integration.

## License

MIT License — see [`LICENSE.md`](./LICENSE.md).
