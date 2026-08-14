# Remix Store

The storefront behind [shop.remix.run](https://shop.remix.run).

The storefront runs on Remix 3 and framework-neutral Hydrogen across native Node/Fly and Oxygen runtimes.

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
supplies `fly-client-ip`. Other Node runtimes use the client address resolved by
Remix's HTTP adapter from the socket or, when explicitly configured behind a
trusted proxy with `TRUST_PROXY=true`, overwritten proxy headers. Never forward
platform buyer-IP headers outside their runtime. `PUBLIC_CHECKOUT_DOMAIN` is not
a runtime input; checkout uses Shopify's
authoritative `cart.checkoutUrl`. The app does not use durable application
sessions or require `SESSION_SECRET`.

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

The end-to-end suite starts the native Node app with a deterministic local Storefront fixture by default. Set `BASE_URL` to run it against an existing Oxygen or Fly deployment.

The Oxygen build produces a self-contained Worker at `dist/ssr/index.js` and browser assets in `dist/client/`. The Node server compiles browser modules through `remix/assets` for Fly.

## Deployments

Oxygen preview deployments use `.github/workflows/oxygen-deployment.yml`. Fly setup, secrets, local image verification, and continuous deployment are documented in [`FLY_DEPLOYMENT.md`](./FLY_DEPLOYMENT.md).

## Architecture

- `app/routes.ts` defines the typed route contract.
- `app/router.ts` owns the shared Fetch app, routes, middleware, and runtime boundary.
- `app/node.ts` composes Node static files, Remix Assets, rendering, and routing.
- `app/middleware/storefront.ts` creates a request-scoped Hydrogen Storefront client.
- `app/middleware/render.tsx` contains runtime-neutral streaming SSR.
- `app/runtime.ts` binds environment, cache, and `waitUntil` values to each request.
- `server.node.ts` owns the Node/Fly-compatible HTTP lifecycle.
- `app/entry.oxygen.ts` composes and serves the Oxygen Worker runtime.
- `app/actions/public/entry.tsx` hydrates browser components on both targets.
- `vite/remix-oxygen.ts` owns the temporary Remix 3/Oxygen build integration.

## License

MIT License — see [`LICENSE.md`](./LICENSE.md).
