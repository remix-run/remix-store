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
# Populate PRIVATE_STOREFRONT_API_TOKEN from the configured Hydrogen environment.
pnpm dev
```

The private Storefront token remains server-only and enables request-aware cart,
checkout, and Shopify redirect handling. Oxygen supplies `oxygen-buyer-ip`; Fly
supplies `fly-client-ip`. Other runtimes must set `Runtime.buyerIp` from a
verified adapter—never forward either public request header. `PUBLIC_CHECKOUT_DOMAIN`
is not a runtime input; checkout uses Shopify's authoritative `cart.checkoutUrl`.

`pnpm dev` runs the framework-native Node server with `remix/assets`. For UI-heavy work, use `pnpm hmr` to preserve browser state while hot-updating client and server modules. Use `pnpm dev:oxygen` when testing the same application under MiniOxygen's Worker runtime.

The example environment points at the live production store. Purchases create real orders and charge real money.

## Validation

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build:oxygen
pnpm preview:oxygen
```

The end-to-end suite starts the native Node app with a deterministic local Storefront fixture by default. Set `BASE_URL` to run it against an existing Oxygen or Fly deployment. Skipped tests are disallowed; acceptance cases should be added as shopper surfaces ship.

The Oxygen build produces a self-contained Worker at `dist/ssr/index.js` and browser assets in `dist/client/`. The Node server compiles browser modules through `remix/assets` for Fly.

## Deployments

Oxygen preview deployments use `.github/workflows/oxygen-deployment.yml`. Fly setup, secrets, local image verification, and continuous deployment are documented in [`FLY_DEPLOYMENT.md`](./FLY_DEPLOYMENT.md).

## Skeleton architecture

- `app/routes.ts` defines the typed route contract.
- `app/router.ts` owns the shared Fetch app, routes, middleware, and runtime boundary.
- `app/node.ts` composes Node static files, Remix Assets, rendering, and routing.
- `app/middleware/storefront.ts` creates a request-scoped Hydrogen Storefront client.
- `app/middleware/render.tsx` contains runtime-neutral streaming SSR.
- `app/runtime.ts` binds environment, cache, and `waitUntil` values to each request.
- `server.node.ts` owns the Node/Fly-compatible HTTP lifecycle.
- `app/entry.oxygen.ts` composes and serves the Oxygen Worker runtime.
- `app/entry.browser.ts` hydrates browser components on both targets.
- `vite/remix-oxygen.ts` owns the temporary Remix 3/Oxygen build integration.

## License

MIT License — see [`LICENSE.md`](./LICENSE.md).
