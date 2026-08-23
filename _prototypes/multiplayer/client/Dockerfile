FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

COPY client/package.json ./package.json
RUN pnpm install

COPY client/tsconfig.json client/vite.config.ts client/index.html ./
COPY client/src ./src
COPY shared ./src/shared

EXPOSE 3000

CMD ["pnpm", "run", "dev"]
