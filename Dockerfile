# syntax=docker/dockerfile:1

ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable
WORKDIR /app

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# pnpm cannot verify package metadata for the pinned GitHub monorepo subdirectory
# (`packages/remix`) against the repository root package. Keep strict checking
# everywhere else; relax it only for this isolated production dependency install.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --prod --frozen-lockfile --config.strict-store-pkg-content-check=false

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
