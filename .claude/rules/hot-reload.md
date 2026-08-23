# Hot reload

Everything here exists because the Windows host bind-mounts source into Linux
containers, and native filesystem events do not reliably cross that boundary.

## api

`api/start:dev` uses NestJS's [webpack HMR recipe](https://docs.nestjs.com/recipes/hot-reload),
not `nest start --watch`. See `api/webpack-hmr.config.js`.

Inside Docker, webpack's file watcher is set to poll (`watchOptions.poll`),
because the container never sees the host's change events.

## web

`web` normally runs on Turbopack (`next dev`, the `web/package.json` `dev`
script) for host-side development. As of Next.js 16, Turbopack has no documented
polling mode, so it never sees changes through the bind mount.

The `web` container's Dockerfile CMD therefore overrides this to
`next dev --webpack` with `WATCHPACK_POLLING=true`: webpack HMR with polling,
the same fix as `api`. This override is Docker-only. Host-side
`pnpm --filter web dev` is unaffected and still uses Turbopack.

## The second half of the web fix

Getting webpack to recompile was only half of it. The browser tab also needs the
dev server to push a message over `/_next/hmr` before it will Fast Refresh, and
Next's dev server blocks that push by default for any origin other than
`localhost`. It fails silently, with only a log line in the container:

> Cross-origin access to Next.js dev resources is blocked by default for safety

Since the app loads at `heliotyper.local` through Traefik, this blocked every
push. Edits compiled fine server-side but never reached the open tab, so it
looked like hot reload was broken until a manual refresh.

Fixed via `allowedDevOrigins: ["heliotyper.local"]` in `web/next.config.ts`.
This requires a dev server restart to take effect, config is not hot-reloaded.

**If hot reload appears broken, check in this order:** is webpack recompiling
(container logs), and is the push reaching the browser (`allowedDevOrigins`).
Those are two separate failures with the same symptom.
