FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY api/package.json ./api/package.json
COPY web/package.json ./web/package.json
COPY packages/engine/package.json ./packages/engine/package.json
# The ellipsis pulls in workspace dependencies, which is how @heliotyper/engine
# gets installed and linked alongside the api.
RUN pnpm install --filter api... --frozen-lockfile

COPY packages ./packages
RUN pnpm --filter @heliotyper/engine build

COPY api ./api
WORKDIR /app/api

# The generated client is gitignored, so build it into the image. In dev the
# bind mount replaces it with the host's copy, which is fine: Prisma 7 generates
# plain TypeScript, nothing platform specific.
RUN pnpm exec prisma generate

EXPOSE 3000

CMD ["pnpm", "run", "start:dev"]
