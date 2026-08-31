// Copy the generated sprite art from assets/ into web/public/game/.
//
// The game loads its art over HTTP, so the files have to sit under public/. They
// are copied rather than committed there because assets/README.md makes the
// generators the source of truth: a second committed copy would go stale the
// next time a gen-*.mjs is rerun, and nothing would notice. public/game is
// gitignored so it cannot be edited into disagreeing with assets/.
//
// Runs before `dev` and before `build`, and again in the web container's start
// command, which is why it has to be cheap and idempotent. It skips files whose
// size and mtime already match, so the common case copies nothing.

import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');

// ../assets resolves to the repo's assets/ on a host checkout and to the
// read-only bind mount at /app/assets inside the container. Same path, both.
const source = resolve(webRoot, '..', 'assets');
const target = join(webRoot, 'public', 'game');

const GROUPS = ['rockets', 'planets', 'finish', 'effects', 'environment'];

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function unchanged(from, to) {
  try {
    const [a, b] = await Promise.all([stat(from), stat(to)]);
    return a.size === b.size && Math.abs(a.mtimeMs - b.mtimeMs) < 1000;
  } catch {
    return false;
  }
}

if (!(await exists(source))) {
  console.error(`sync-game-assets: no assets folder at ${source}`);
  console.error('The game will 404 on its sprite sheets without it.');
  process.exit(1);
}

let copied = 0;
for (const group of GROUPS) {
  const from = join(source, group);
  const to = join(target, group);
  if (!(await exists(from))) {
    console.error(`sync-game-assets: missing asset group ${group}`);
    process.exit(1);
  }

  await mkdir(to, { recursive: true });
  for (const name of await readdir(from)) {
    if (!name.endsWith('.png') && !name.endsWith('.json')) continue;
    const src = join(from, name);
    const dst = join(to, name);
    if (await unchanged(src, dst)) continue;
    await cp(src, dst, { preserveTimestamps: true });
    copied++;
  }
}

console.log(
  copied === 0
    ? 'sync-game-assets: public/game already up to date'
    : `sync-game-assets: copied ${copied} file(s) into public/game`,
);
