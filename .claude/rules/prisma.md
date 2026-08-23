# Prisma (v7, `api/` only)

`PrismaModule` is `@Global()`, so injecting `PrismaService` anywhere needs no
extra module import.

v7-specific behavior that will waste your time if you assume v6 habits:

- **No Rust query engine.** Connections go through a driver adapter
  (`@prisma/adapter-pg`), constructed in `api/src/prisma/prisma.service.ts`.
- **The CLI no longer auto-loads `.env`.** `api/prisma.config.ts` does it with
  `import 'dotenv/config'`, reading `api/.env` (copy `api/.env.example` first).
  That file points at `localhost:5432` for host-side CLI runs. In the container,
  `docker-compose.yml` already sets `DATABASE_URL` to the `postgres` service, and
  dotenv does not override an existing value.
- **The client is generated into `api/src/generated/prisma`** (gitignored) rather
  than `node_modules`, so it must be built before the API compiles:
  `pnpm --filter api prisma:generate`, and again after every schema change.
  `api/Dockerfile` runs it too, so a fresh image works even though the dev bind
  mount then shadows it with the host copy. Output is plain TypeScript with no
  platform-specific artifacts, so host-generated files run fine in the Linux
  container.
- **The generator is pinned to `moduleFormat = "cjs"` with
  `importFileExtension = ""`.** Left to infer from `tsconfig.json`'s
  `module: nodenext` it emits ESM using `import.meta.url` and `.js` specifiers,
  which neither `nest build` (CJS) nor the webpack dev build can resolve. Do not
  unpin these.
- **`prisma.config.ts` sits at the package root and is excluded in
  `api/tsconfig.build.json`.** Without that exclusion tsc widens `rootDir` to the
  package root and emits `dist/src/main.js`, breaking `start:prod`.

Migrations: `pnpm --filter api prisma:migrate --name <name>` from the host, or
`docker compose exec api pnpm prisma:migrate --name <name>`.
