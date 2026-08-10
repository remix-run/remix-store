# Fly deployment

| Setting        | Value                                   |
| -------------- | --------------------------------------- |
| App            | `remix-store`                           |
| Organization   | `remix`                                 |
| Primary region | `dfw`                                   |
| Machine        | 1 shared CPU, 512 MB, minimum 1 running |
| Strategy       | Blue-green with `/health` gating        |

## One-time setup

The app, Storefront secrets, and app-scoped GitHub deploy token are configured. These are the reproducible setup commands:

```sh
fly apps create remix-store --org remix
grep -E '^(PUBLIC_STORE_DOMAIN|PUBLIC_STOREFRONT_API_TOKEN)=' .env \
  | fly secrets import --app remix-store
fly tokens create deploy --app remix-store --expiry 8760h \
  | gh secret set FLY_API_TOKEN --repo remix-run/remix-store
```

Only the domain and public Storefront token are current server inputs. Add `PUBLIC_STOREFRONT_ID`, `PUBLIC_CHECKOUT_DOMAIN`, sessions, and Admin API credentials when their consuming features land.

## Deployment behavior

`.github/workflows/fly-deployment.yml` deploys every branch push, then verifies `/health` and the server-rendered home page. Global concurrency cancels an older in-progress deployment when a newer push arrives.

The workflow passes the Git commit SHA as `ASSET_BUILD_ID`, giving each release immutable Remix Asset URLs. After migration, restrict the workflow trigger to `main` and move the deploy token into a protected GitHub environment.

## Local image verification

```sh
docker build --build-arg ASSET_BUILD_ID=local-test -t remix-store-fly .
docker run --rm --env-file .env -p 44100:44100 remix-store-fly
```

Verify `http://localhost:44100/health` and `http://localhost:44100/`.
