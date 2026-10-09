# Fly deployment

| Setting        | Value                                |
| -------------- | ------------------------------------ |
| App            | `remix-store`                        |
| Organization   | `remix`                              |
| Primary region | `dfw`                                |
| Regions        | `dfw`, `ams`, one Machine each       |
| Machine        | 1 shared CPU, 512 MB, always running |
| Strategy       | Blue-green with `/health` gating     |

## One-time setup

The app, Storefront secrets, and app-scoped GitHub deploy token are configured. These are the reproducible setup commands:

```sh
fly apps create remix-store --org remix
grep -E '^(PUBLIC_STORE_DOMAIN|PUBLIC_STOREFRONT_ID|PRIVATE_STOREFRONT_API_TOKEN)=' .env \
  | fly secrets import --app remix-store
fly tokens create deploy --app remix-store --expiry 8760h \
  | gh secret set FLY_API_TOKEN --repo remix-run/remix-store
fly scale count 1 --region ams --app remix-store
```

The domain, storefront ID, and private Storefront token are current inputs. The
private token must remain server-only. On Fly, the Node adapter accepts
`fly-client-ip` only when `FLY_APP_NAME` confirms the runtime. Outside Fly it
uses Remix's HTTP adapter client address, which comes from the socket unless an
operator explicitly enables `TRUST_PROXY=true` behind a trusted proxy that
overwrites forwarding headers. Never proxy a client-supplied buyer-IP header.
`PUBLIC_CHECKOUT_DOMAIN` was retired: checkout
buttons and `/checkout` resolve Shopify's authoritative `cart.checkoutUrl`.
Fly does not need `SESSION_SECRET`. Add the server-only Admin API credentials
only when enabling their consuming subscription features.

## Regions

Fly routes each request, including Fastly's origin requests, to the nearest
region with a Machine. A region exists only while it has a Machine, so regions
are managed with `fly scale count`, not in `fly.toml`; `fly deploy` keeps
every region's Machines and replaces them blue-green. `min_machines_running`
only applies to the primary region, so `auto_stop_machines = "off"` keeps
every region warm instead of cold-starting visitors outside `dfw`. Check
placement with `fly scale show`. To add a region, scale it from zero:

```sh
fly scale count 1 --region <code> --app remix-store
```

## Fastly CDN

`https://remix-store.freetls.fastly.net` is a Fastly CDN (VCL) service in
front of the Fly app.

| Fastly setting       | Value                                   |
| -------------------- | --------------------------------------- |
| Host (origin)        | `remix-store.fly.dev`, port 443, TLS on |
| Override host        | `remix-store.fly.dev`                   |
| SNI / cert hostname  | `remix-store.fly.dev`                   |
| Fallback TTL         | `0`                                     |
| Request header (set) | `X-CDN-Client-IP` = `client.ip`         |
| Request header (set) | `X-CDN-Origin-Secret` = `"<secret>"`    |

Fly routes by `Host`, so the override host is required. Behind Fastly,
`fly-client-ip` is a Fastly address; the app instead trusts `X-CDN-Client-IP`
only when `X-CDN-Origin-Secret` matches the `CDN_ORIGIN_SECRET` Fly secret, then
strips the secret before Shopify proxies can forward it. Both headers must use
Fastly's **set** action so client-supplied values are overwritten. Without the
secret, requests fall back to `fly-client-ip`, so either side can be configured
first.

## Deployment behavior

`.github/workflows/fly-deployment.yml` deploys every branch push, then verifies `/health` and the server-rendered home page. Deployments run one at a time and are never canceled midway, since an interrupted blue-green cutover leaves Machines on different images.

The workflow passes the Git commit SHA as `ASSET_BUILD_ID`, giving each release immutable Remix Asset URLs. After migration, restrict the workflow trigger to `main` and move the deploy token into a protected GitHub environment.

## Local image verification

```sh
docker build --build-arg ASSET_BUILD_ID=local-test -t remix-store-fly .
docker run --rm --env-file .env -p 44100:44100 remix-store-fly
```

Verify `http://localhost:44100/health` and `http://localhost:44100/`.
