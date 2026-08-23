# Local development

## Workspace

Run `pnpm install` at the repo root, never inside an individual package. This is
a pnpm workspace and installing inside a package breaks hoisting.

## Hosts file

Add these entries (already present on the primary dev machine):

```
127.0.0.1 heliotyper.local
127.0.0.1 admin.heliotyper.local
127.0.0.1 pgadmin.heliotyper.local
127.0.0.1 api.heliotyper.local
127.0.0.1 mail.heliotyper.local
```

`admin.heliotyper.local` is reserved for a future admin project that does not
exist yet. It is not dockerized and not routed, so do not expect it to resolve to
anything.

## Docker

Copy `.env.example` to `.env` before the first run, then `docker compose up -d`.

Services and their routing are defined in `docker-compose.yml`. The parts worth
knowing that are not obvious from reading it:

- `traefik` is what resolves the `*.heliotyper.local` hostnames to containers.
  Its dashboard is on `localhost:8080`. If a hostname stops resolving, check
  Traefik before suspecting the service.
- `api` and `web` bind-mount source for hot reload, which has real caveats. See
  [hot-reload.md](hot-reload.md).
- `postgres` and `redis` are internal only but also published on host ports 5432
  and 6379, which is what lets host-side CLI tooling (notably Prisma) reach them.
- `mailpit` catches SMTP locally at `mail.heliotyper.local`, SMTP on host port
  1025. Nothing sends real mail in dev.

## Multiplayer playground

[_prototypes/multiplayer/](../../_prototypes/multiplayer/) has its own
`docker-compose.yml` on shifted ports (client 3100, server 3101) specifically so
it can run at the same time as the root stack. Bring it up separately.
