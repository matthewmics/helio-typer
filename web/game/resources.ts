import { DEFAULT_ROCKET, type RocketId } from '@heliotyper/engine';
import { Atlas, type AtlasJson } from './atlas';

// The rocket names live in the engine, the one package the server imports too,
// since it picks the bots' ships from the same list the browser draws them from.
export { DEFAULT_ROCKET, ROCKET_IDS, type RocketId } from '@heliotyper/engine';

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

export interface RocketEntry {
  id: RocketId;
  label: string;
}

/**
 * Each sheet's path under /game, minus the extension: its `.json` and `.png`
 * sit side by side. Rockets are not listed: see {@link loadRocket}.
 */
const SHEETS = {
  planets: 'planets/planets',
  kuiper: 'kuiper/kuiper',
  finish: 'finish/finish',
  effects: 'effects/effects',
  environment: 'environment/environment',
} as const;

type SheetKey = keyof typeof SHEETS;

/** The roster from assets/rockets/index.json. Empty until {@link loadArt} resolves. */
export let ROCKETS: RocketEntry[] = [];

export interface Atlases {
  /** {@link DEFAULT_ROCKET}, loaded up front with the scenery. */
  rocket: Atlas;
  planets: Atlas;
  kuiper: Atlas;
  finish: Atlas;
  effects: Atlas;
  environment: Atlas;
}

const rockets = new Map<RocketId, Promise<Atlas>>();

/**
 * One rocket's sheet, fetched on first use and shared after that.
 *
 * Rockets load one at a time rather than all at once with the scenery. There
 * are a dozen of them at about half a megabyte each, and a race only draws the
 * ones its pilots fly, so loading every sheet would have every race download
 * skins nobody in it is using. A failure is not kept, so asking again retries.
 */
export function loadRocket(id: RocketId): Promise<Atlas> {
  let sheet = rockets.get(id);
  if (!sheet) {
    sheet = loadSheet(`rockets/${id}`);
    sheet.catch(() => rockets.delete(id));
    rockets.set(id, sheet);
  }
  return sheet;
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
  const [roster, rocket, ...sheets] = await Promise.all([
    fetchJson<{ rockets: RocketEntry[] }>(`${BASE}/rockets/index.json`),
    loadRocket(DEFAULT_ROCKET),
    ...keys.map((key) => loadSheet(SHEETS[key])),
  ]);

  ROCKETS = roster.rockets;
  const sheet = Object.fromEntries(keys.map((key, i) => [key, sheets[i]])) as Record<SheetKey, Atlas>;

  return {
    rocket,
    planets: sheet.planets,
    kuiper: sheet.kuiper,
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
