# Fly deployment

`fly.toml` runs the native Node + Remix Assets target on one always-available 512 MB Machine in `ord`. The app name stays outside the repository so the same config can target staging now and production later.

## One-time setup

Choose the Fly organization, app name, and primary region before running these commands:

```sh
export FLY_APP_NAME=<app-name>
export FLY_ORG=<organization-slug>

fly apps create "$FLY_APP_NAME" --org "$FLY_ORG"
grep -E '^(PUBLIC_STORE_DOMAIN|PUBLIC_STOREFRONT_API_TOKEN)=' .env \
  | fly secrets import --app "$FLY_APP_NAME"
fly tokens create deploy --app "$FLY_APP_NAME" --expiry 8760h \
  | gh secret set FLY_API_TOKEN
gh variable set FLY_APP_NAME --body "$FLY_APP_NAME"
gh variable set FLY_DEPLOY_ENABLED --body true
```

Only the domain and public Storefront token are imported because they are the current server's required inputs. `PUBLIC_STOREFRONT_ID`, `PUBLIC_CHECKOUT_DOMAIN`, sessions, and Admin API credentials follow when their consuming features land.

`FLY_DEPLOY_ENABLED` is the safety switch. Until it equals `true`, the Fly workflow is skipped. Add future feature secrets only when their consuming code lands.

## Deployment behavior

`.github/workflows/fly-deployment.yml` currently reacts to every branch push, deploys that commit to the single staging app, and verifies `/health` plus the server-rendered home page. Global concurrency cancels an older in-progress deployment when a newer push arrives.

The workflow passes the Git commit SHA as `ASSET_BUILD_ID`, giving each release immutable Remix Asset URLs. After migration, restrict the workflow trigger to `main` and move credentials into a protected GitHub environment.

## Local image verification

```sh
docker build --build-arg ASSET_BUILD_ID=local-test -t remix-store-fly .
docker run --rm --env-file .env -p 44100:44100 remix-store-fly
```

Verify `http://localhost:44100/health` and `http://localhost:44100/` before enabling deployment.
