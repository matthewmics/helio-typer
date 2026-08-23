FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.20.0 --activate

COPY server/package.json ./package.json
RUN pnpm install

COPY server/tsconfig.json server/nest-cli.json server/webpack-hmr.config.js ./
COPY server/src ./src
# The shared sim lands inside src/ rather than being resolved through a path
# alias or a workspace link. Plain relative imports are the one thing that
# behaves identically under tsc, webpack and vite, which matters more here than
# elegance: this exact code has to compile in two different toolchains.
COPY shared ./src/shared

EXPOSE 3000

CMD ["pnpm", "run", "start:dev"]
