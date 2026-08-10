---
name: remix-store
description: >
  Work on this Remix Store v3 application. Use for any app architecture, route,
  controller, middleware, Remix UI, browser hydration, Shopify Storefront API,
  Hydrogen, Node, Oxygen, Vite, testing, or deployment task in this repository.
---

# Remix Store v3

This repository uses **Remix 3 beta**, not React Router framework mode, and the
**framework-agnostic `@shopify/hydrogen` preview**, not Hydrogen React. Preserve
those choices.

## Do not introduce the old stack

- Do not add `react-router`, `@react-router/dev`, `@shopify/hydrogen-react`, or
  `@shopify/remix-oxygen` patterns.
- Do not create React Router route modules, loaders, actions, `<Form>`, fetchers,
  or generated `+types` files.
- Do not use generic Hydrogen validators that require the legacy React Router
  dependency graph. This app validates GraphQL with its installed Hydrogen CLI.
- Do not run `hydrogen setup` blindly; it can replace this app-specific skill
  with generic skills.
- Keep the exact prerelease versions in `package.json` unless the user requests
  an upgrade.

## Sources of truth

Use sources in this order:

1. Existing app patterns and tests.
2. Installed Remix declarations under `node_modules/remix/dist/` and the
   `remix/package.json` exports map. Remix 3 is a beta; do not substitute Remix
   2 or React Router knowledge.
3. `node_modules/@shopify/hydrogen/README.md`, package declarations, and the
   task-specific installed skill below. These files match the pinned Hydrogen
   preview.
4. External documentation only when the installed packages do not answer the
   question; verify that examples target the framework-agnostic API.

Read the relevant installed Hydrogen skill before changing that surface:

| Surface | Installed skill |
| --- | --- |
| Storefront client, `gql`, errors, caching | `hydrogen-storefront-client/SKILL.md` |
| Oxygen/MiniOxygen | `hydrogen-oxygen/SKILL.md` |
| Shopify route templates and redirects | `hydrogen-routing/SKILL.md` |
| Request handlers | `hydrogen-request-handlers/SKILL.md` |
| Cart UI or drawer | `hydrogen-cart-ui/SKILL.md`, `hydrogen-cart-drawer/SKILL.md` |
| Markets | `hydrogen-markets/SKILL.md` |
| Analytics | `hydrogen-analytics/SKILL.md` |
| Images, money, Shop Pay, variants | Matching `hydrogen-*` skill |
| End-to-end Hydrogen verification | `hydrogen-smoke-test/SKILL.md` |

Resolve these under `node_modules/@shopify/hydrogen/skills/`. Follow references
linked by a selected skill, but adapt framework examples to this app's Remix 3
router and UI primitives.

## Architecture

| File | Responsibility |
| --- | --- |
| `app/routes.ts` | Typed route contract built with `remix/routes` |
| `app/actions/controller.tsx` | Maps route identities to server actions with `createController` |
| `app/router.ts` | Shared Fetch app, router, middleware, and runtime boundary |
| `app/middleware/storefront.ts` | Request-scoped Shopify context and Storefront client |
| `app/middleware/render.tsx` | Runtime-neutral streaming HTML renderer |
| `app/runtime.ts` | Request-scoped env, cache, and `waitUntil`; outer error boundary |
| `app/node.server.ts` | Node static files, Remix Assets, rendering, and router composition |
| `server.node.ts` | Node HTTP listener and shutdown lifecycle |
| `app/entry.server.ts` | Oxygen assets, router composition, and Worker fetch handler |
| `app/entry.browser.ts` | Browser hydration module loader |
| `vite/remix-oxygen.ts` | Temporary, load-bearing Oxygen build adapter |

Keep business routes, controllers, data, UI, and middleware runtime-neutral.
Node-only imports belong behind `app/node.server.ts` or build tooling. Oxygen
runtime code uses Web APIs and receives bindings through the request runtime.
Do not replace the explicit target composition with `typeof process` branches;
bundlers still traverse Node imports.

The two asset pipelines are intentional:

- Node resolves browser modules with `remix/assets`.
- Oxygen resolves browser modules from Vite's fullstack asset manifests.

Keep `server.node.ts` separate from `app/node.server.ts` so tests can import the
Node app without starting an HTTP listener. Runtime adapters call the app's
`fetch(request, runtime)` boundary rather than the internal router directly.
Treat `vite/remix-oxygen.ts` as
vendored infrastructure: review changes carefully and always run an Oxygen
production build.

## Remix 3 patterns

- Declare routes in `app/routes.ts`; map them in a controller rather than adding
  filesystem route modules.
- Use `RemixNode`, `Handle`, `css`, `mix`, and event helpers from `remix/ui`.
  JSX uses the `remix/ui` JSX runtime configured in `tsconfig.json`.
- Put hydratable browser components under `app/assets/` and export them with
  `clientEntry(import.meta.url, component)`. Keep the `import.meta.url` shape;
  both asset pipelines transform or resolve it.
- Keep server-only data in `*.server.ts` modules and out of the browser import
  graph.
- Add request values through typed router context keys and middleware; avoid
  module-global request state.
- Preserve abort signals, response status/headers, branded error pages, and
  no-JavaScript behavior.
- Use explicit `.ts`/`.tsx` extensions for relative imports.

## Hydrogen patterns

- Create `createShopifyRequestContext()` and `createStorefrontClient()` per
  request in middleware. Use one request context for Shopify clients in that
  request.
- Obtain environment, cache, and `waitUntil` through `app/runtime.ts`. Never
  read Worker secrets from `process.env`; never expose private tokens to browser
  modules.
- Author static Storefront documents with `gql()` in server modules. Pass user
  input through variables.
- Treat transport failures as thrown errors and GraphQL errors as returned
  data. Validate required data before rendering.
- Apply Shopify request-context response headers at the final middleware
  boundary. Preserve immutable-header handling.
- Keep personalized HTML `private, no-store`. Review catalog caching separately;
  Node does not currently provide Oxygen's Cache API.

## Tests and validation

Use Remix's test APIs (`remix/test`, `remix/assert`) and existing tests as the
model. Inject Storefront `fetch` and environment values rather than contacting
Shopify in unit tests.

Run the checks relevant to the change; before handing off a complete app change,
run all four:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build:oxygen
```

`pnpm typecheck` includes `hydrogen gql check --fail-on-warn`. For runtime
changes, also exercise the affected request path under native Node and use
`pnpm dev:oxygen` or `pnpm preview:oxygen` when Worker behavior changed. A
successful server start alone is not request-path validation.

The `.env.example` values target the live production store. Never automate a
purchase or mutation that can charge money without explicit approval. Do not
run deploy, commit, push, or destructive git commands unless explicitly asked.
