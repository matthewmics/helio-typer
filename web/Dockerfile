FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY web/package.json ./web/package.json
COPY api/package.json ./api/package.json
COPY packages/engine/package.json ./packages/engine/package.json
# The ellipsis pulls in workspace dependencies, which is how @heliotyper/engine
# gets installed and linked alongside the web app.
RUN pnpm install --filter web... --frozen-lockfile

COPY packages ./packages
RUN pnpm --filter @heliotyper/engine build

COPY web ./web
WORKDIR /app/web

EXPOSE 3000

# The compose CMD overrides web/package.json's `dev` script, so the asset sync
# that script performs has to be repeated here or the game 404s on its sprites.
CMD ["sh", "-c", "node scripts/sync-game-assets.mjs && pnpm exec next dev --webpack"]
