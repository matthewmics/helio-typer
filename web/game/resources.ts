import { Atlas, type AtlasJson } from './atlas';

// ---------------------------------------------------------------------------
// The prototype reached straight into the repo's assets/ folder using Vite's
// `?url` imports. Next has no equivalent, and importing across the workspace
// boundary out of web/ is worse than it looks, so here every asset is fetched
// over HTTP from /game instead.
//
// web/public/game is a copy, not a second source of truth. `web/scripts/sync-game-assets.mjs`
// refreshes it from assets/ before dev and before build, and the copy is
// gitignored so it can never be edited into disagreeing with the generators.
// assets/README.md stays authoritative for the art itself.
// ---------------------------------------------------------------------------

const BASE = '/game';

export type RocketId = 'vanguard' | 'kestrel' | 'marauder';

export interface RocketEntry {
  id: RocketId;
  label: string;
}

/** Each sheet's path under /game, minus the extension: its `.json` and `.png` sit side by side. */
const SHEETS = {
  vanguard: 'rockets/vanguard',
  kestrel: 'rockets/kestrel',
  marauder: 'rockets/marauder',
  planets: 'planets/planets',
  finish: 'finish/finish',
  effects: 'effects/effects',
  environment: 'environment/environment',
} as const;

type SheetKey = keyof typeof SHEETS;

/** The roster from assets/rockets/index.json. Empty until {@link loadArt} resolves. */
export let ROCKETS: RocketEntry[] = [];

export interface Atlases {
  rockets: Record<RocketId, Atlas>;
  planets: Atlas;
  finish: Atlas;
  effects: Atlas;
  environment: Atlas;
}

let loading: Promise<Atlases> | null = null;

/**
 * Every sheet and atlas, fetched, decoded and ready to draw.
 *
 * This is the whole of loading, with no loader screen in front of it. The art is
 * a few MB from the same origin and is usually in hand within a frame or two.
 *
 * Shared across mounts. React remounts the game on every save in development and
 * StrictMode mounts it twice on purpose, and neither should fetch the art again.
 * A failure is not kept, so the next mount retries rather than replaying it.
 */
export function loadArt(): Promise<Atlases> {
  loading ??= fetchArt().catch((err: unknown) => {
    loading = null;
    throw err;
  });
  return loading;
}

async function fetchArt(): Promise<Atlases> {
  const keys = Object.keys(SHEETS) as SheetKey[];
  const [roster, ...sheets] = await Promise.all([
    fetchJson<{ rockets: RocketEntry[] }>(`${BASE}/rockets/index.json`),
    ...keys.map((key) => loadSheet(SHEETS[key])),
  ]);

  ROCKETS = roster.rockets;
  const sheet = Object.fromEntries(keys.map((key, i) => [key, sheets[i]])) as Record<SheetKey, Atlas>;

  return {
    rockets: {
      vanguard: sheet.vanguard,
      kestrel: sheet.kestrel,
      marauder: sheet.marauder,
    },
    planets: sheet.planets,
    finish: sheet.finish,
    effects: sheet.effects,
    environment: sheet.environment,
  };
}

async function loadSheet(path: string): Promise<Atlas> {
  const [json, image] = await Promise.all([
    fetchJson<AtlasJson>(`${BASE}/${path}.json`),
    loadImage(`${BASE}/${path}.png`),
  ]);
  return new Atlas(json, image);
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(couldNotLoad(url, String(res.status)));
  return (await res.json()) as T;
}

/**
 * Load an image and decode it.
 *
 * `decode()` rather than waiting on `load`, so the decode cost lands here and not
 * as a hitch on the first frame that draws the sheet.
 */
async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    throw new Error(couldNotLoad(url, 'missing or not an image'));
  }
  return image;
}

function couldNotLoad(url: string, why: string): string {
  return `could not load ${url} (${why}). Run \`pnpm --filter web sync:assets\` to refresh web/public/game.`;
}
