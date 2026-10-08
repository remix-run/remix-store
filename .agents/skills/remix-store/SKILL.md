---
name: remix-store
description: >
  Builds, reviews, and refactors this Remix Store v3 app using Remix 3,
  framework-agnostic Hydrogen, Node, Oxygen, Vite, and remix/* imports. Use for
  app structure, routing, middleware, data, UI, browser interaction, tests, and
  deployment; not for implementing Remix framework packages.
---

# Build and Review Remix Store

This repository uses **stable Remix 3**, not React Router framework mode, and the
**framework-agnostic `@shopify/hydrogen` preview**, not Hydrogen React. Preserve
those choices.

## Find Context and Documentation

Read the relevant installed documentation before using unfamiliar Remix APIs:

1. Read this skill, `package.json`, and `tsconfig.json`, then inspect the code
   that owns the behavior being changed.
2. Search `node_modules/remix/INDEX.md` by task, export, or keyword, for example
   `grep -i 'session' node_modules/remix/INDEX.md`.
3. Follow the index to the relevant guide for the workflow, then the package
   README for exact imports, options, behavior, and examples. If there is no
   relevant guide, use the API README and existing app patterns.

Treat the installed documentation as canonical, including when it differs from
this skill. Do not rely on remembered Remix 2 patterns or online APIs from a
newer version. If the installation has no index, inspect its `package.json`
exports and matching installed READMEs, source, and types.

For Hydrogen work, read the relevant synced skill under `.agents/skills/`:

| Surface | Synced skill |
| --- | --- |
| Storefront client, `gql`, errors, caching | `hydrogen-storefront-client/SKILL.md` |
| Request handlers and Shopify compatibility routes | `hydrogen-request-handlers/SKILL.md`, `hydrogen-routing/SKILL.md` |
| Cart state, drawer, and metafields | `hydrogen-cart-ui/SKILL.md`, `hydrogen-cart-drawer/SKILL.md`, `hydrogen-cart-metafields/SKILL.md` |
| Product variants and add-to-cart forms | `hydrogen-variant-form/SKILL.md` |
| Collections and predictive search | `hydrogen-collection-browser/SKILL.md`, `hydrogen-predictive-search/SKILL.md` |
| Markets and customer accounts | `hydrogen-markets/SKILL.md`, `hydrogen-customer-account/SKILL.md` |
| Analytics, images, money, and Shop Pay | Matching `hydrogen-*` skill |
| Oxygen and local HTTPS | `hydrogen-oxygen/SKILL.md`, `hydrogen-local-https/SKILL.md` |
| End-to-end Hydrogen verification | `hydrogen-smoke-test/SKILL.md` |

These files must match the exact installed Hydrogen version. After every
Hydrogen upgrade, run `pnpm exec hydrogen skills sync`, then remove the
`.claude` mirror when it is not used; this repository tracks only
`.agents/skills`. Follow references linked by the selected skill, adapting
framework examples to this app's Remix 3 router and UI primitives.

## Remix Mental Model

Remix builds on Web APIs such as `Request`, `Response`, `URL`, and `FormData`.
Its APIs compose explicitly at runtime; do not assume file-based routing,
generated route types, or a mandatory build step.

### Routes, Router, and Controllers

Remix apps generally separate routing into three parts:

- **Routes** define the URL and method contract, including typed URL generation
  (`app/routes.ts`).
- **The router** connects routes, middleware, and controllers (`app/router.ts`).
- **Controllers** implement the actions that handle matched routes
  (`app/actions/`).

This organization applies to server apps and browser apps using the SPA router.
Remix's pieces are composable and replaceable; using one does not require
adopting the others. Follow this app's existing choices.

A minimal server route can return a plain Web `Response`:

```ts
// app/routes.ts
import { get, route } from 'remix/routes'

export const routes = route({
  hello: get('/hello/:name'),
})
```

```ts
// app/actions/controller.ts
import { createController } from 'remix/router'

import { routes } from '../routes.ts'

export default createController(routes, {
  actions: {
    hello(context) {
      return new Response(`Hello, ${context.params.name}!`)
    },
  },
})
```

```ts
// app/router.ts
import { createRouter } from 'remix/router'

import controller from './actions/controller.ts'
import { routes } from './routes.ts'

export const router = createRouter()
router.map(routes, controller)
```

The runtime adapter passes requests to `router.fetch(request)`. Generate URLs
from the same route contract: `routes.hello.href({ name: 'Remix' })` produces
`/hello/Remix`.

### Components

Remix UI uses JSX, but it is not React. A component's setup function runs once
per instance and returns a render function. Local variables in setup preserve
state between renders; event handlers change that state and call
`handle.update()` to request another render:

```tsx
import { on } from 'remix/component'
import type { Handle } from 'remix/component'

function Counter(handle: Handle) {
  let count = 0

  return () => (
    <button
      type="button"
      mix={on('click', () => {
        count++
        handle.update()
      })}
    >
      Count: {count}
    </button>
  )
}
```

Read changing props from `handle.props` during render rather than capturing
their initial values in setup. Do not apply React hooks or lifecycle
assumptions.

Event handlers run only when the component is mounted or hydrated in the
browser; server-rendered HTML alone is not interactive. Follow the installed
interactivity guide and this app's browser-entry setup.

## Store Architecture

| File | Responsibility |
| --- | --- |
| `app/routes.ts` | Typed route contract built with `remix/routes` |
| `app/actions/controller.tsx` | Maps route identities to server actions with `createController` |
| `app/router.ts` | Shared Fetch app, router, middleware, and runtime boundary |
| `app/middleware/storefront.ts` | Request-scoped Shopify context and Storefront client |
| `app/middleware/render.tsx` | Runtime-neutral streaming HTML renderer |
| `app/runtime.ts` | Request-scoped env, cache, and `waitUntil`; outer error boundary |
| `app/node.ts` | Node static files, Remix Assets, rendering, and router composition |
| `server.node.ts` | Node HTTP listener and shutdown lifecycle |
| `app/entry.oxygen.ts` | Oxygen assets, router composition, and Worker fetch handler |
| `app/actions/public/entry.tsx` | Browser hydration module loader |
| `vite/remix-oxygen.ts` | Pitlane's Remix Vite plugin, finished into one Oxygen Worker |

Keep business routes, controllers, data, UI, and middleware runtime-neutral.
Node-only imports belong behind `app/node.ts` or in build tooling. Oxygen code
uses Web APIs and receives bindings through the request runtime. Do not replace
explicit target composition with `typeof process` branches; bundlers still
traverse Node imports.

The two asset pipelines are intentional:

- Node resolves browser modules with `remix/assets`.
- Oxygen resolves browser modules from the asset manifest that
  `@pitlane/vite-plugin-remix` produces, read through `@pitlane/assets`.

Pitlane discovers browser entries from literal `getScriptEntry()`/`getHref()`
calls on its resolver and from `clientEntry()` exports. Document assets are
read through a function parameter, so `vite/remix-oxygen.ts` registers
`documentAssetSources` from `app/assets.ts` explicitly; add new document assets
there. Oxygen uploads only `index.js` and `oxygen.json` from `dist/server`, so
`vite/remix-oxygen.ts` bundles Pitlane's separate manifest file into the
Worker. After changing it or upgrading Pitlane, run an Oxygen production build
and `pnpm test:e2e:oxygen`.

Keep `server.node.ts` separate from `app/node.ts` so tests can import the Node
app without starting an HTTP listener. Runtime adapters call the app's
`fetch(request, runtime)` boundary rather than the internal router directly.

## Work Within the App

- Preserve the package manager, scripts, runtime, middleware order, import
  conventions, explicit `.ts`/`.tsx` relative extensions, abort signals,
  response status and headers, branded errors, and no-JavaScript behavior.
- Do not add `react-router`, `@react-router/dev`, `@shopify/hydrogen-react`, or
  `@shopify/remix-oxygen` patterns. Do not create React Router route modules,
  loaders, actions, `<Form>`, fetchers, or generated `+types` files.
- Keep exact versions in `package.json` unless the user requests an
  upgrade. Do not run `hydrogen setup` on this existing app; use
  `hydrogen skills sync` when only the packaged skills need updating.
- Put hydratable browser components under `app/assets/` and export them with
  `clientEntry(import.meta.url, component)`. Keep that `import.meta.url` shape;
  both asset pipelines resolve it.
- Treat browser-reachable modules as public. Keep secrets and trusted server
  logic outside that graph; the Node asset server's explicit allow list, not a
  filename suffix, defines the boundary.
- Add request values through typed router context keys and middleware; avoid
  module-global request state.
- Prefer Web APIs, native links, buttons, and forms over custom abstractions.
  The runtime lives in `remix/component`; headless primitives and animations
  require the separate, unstable `@remix-run/ui` package, which this app does
  not currently use.
- Raw HTML rendered by JSX must be explicitly authorized with `unsafeHTML()`.
  Sanitize untrusted HTML first; `unsafeHTML()` preserves input and does not
  sanitize it. Direct DOM properties such as `template.innerHTML` are not JSX
  and remain ordinary browser APIs.

## Hydrogen Integration

- Create `createShopifyRequestContext()` and `createStorefrontClient()` per
  request in middleware. Use one Shopify request context per request.
- Obtain environment, cache, and `waitUntil` through `app/runtime.ts`. Never
  read Worker secrets from `process.env` or expose private tokens to browser
  modules.
- Author static Storefront documents with `gql()` in server modules and pass
  user input through variables.
- Treat transport failures as thrown errors and GraphQL errors as returned
  data. Validate required data before rendering.
- Apply Shopify request-context response headers at the final middleware
  boundary and preserve immutable-header handling.
- Keep personalized HTML `private, no-store`. Review catalog caching
  separately; Node does not currently provide Oxygen's Cache API.
- Validate GraphQL with the installed Hydrogen CLI; do not add generic
  validators that require the legacy React Router dependency graph.

## Verify the Behavior

Use Remix's test APIs (`remix/test`, `remix/assert`) and existing tests as the
model. Load the project `testing-practices` skill when writing, reviewing, or
refactoring tests. Inject Storefront `fetch` and environment values rather than
contacting Shopify in unit tests.

Run relevant focused checks while developing. Before handing off a complete app
change, run:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build:oxygen
```

Run `remix doctor` after structural or configuration changes; review findings
before applying fixes. Do not rewrite configuration merely to make diagnostics
pass.

For runtime changes, exercise the affected request path under native Node and
use `pnpm dev:oxygen` or `pnpm preview:oxygen` when Worker behavior changes. A
successful server start alone is not request-path validation. For UI changes,
exercise browser interaction, not only rendered appearance; check both ordinary
document behavior and the enhanced path.

The `.env.example` values target the live production store. Never automate a
purchase or mutation that can charge money without explicit approval. Do not
run deploy, commit, push, or destructive git commands unless explicitly asked.
