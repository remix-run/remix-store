# syntax=docker/dockerfile:1

ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable
WORKDIR /app

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# Bump the cache id to discard a poisoned store. Builds made while the Remix
# git dependency resolved without `path:` cached the whole monorepo tarball
# under this key, so pnpm now reads `remix-the-web@undefined` where it expects
# `remix@3.0.0-beta.5` and fails with ERR_PNPM_UNEXPECTED_PKG_CONTENT_IN_STORE.
# BuildKit cache mounts survive `--no-cache`, so the id must change.
RUN --mount=type=cache,id=pnpm-v2,target=/pnpm/store \
  pnpm install --prod --frozen-lockfile

FROM base AS runtime

ARG ASSET_BUILD_ID
ENV ASSET_BUILD_ID="${ASSET_BUILD_ID}"
ENV NODE_ENV="production"
ENV PORT="44100"

COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.json ./
COPY --chown=node:node app ./app
COPY --chown=node:node public ./public
COPY --chown=node:node server.node.ts ./server.node.ts

USER node
EXPOSE 44100
STOPSIGNAL SIGTERM

CMD ["node", "--import", "remix/node-tsx", "server.node.ts"]
