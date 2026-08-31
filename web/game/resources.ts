import { ImageSource, Loader } from 'excalibur';
import { Atlas, type AtlasJson } from './atlas';

// ---------------------------------------------------------------------------
// The only file that differs meaningfully from the prototype.
//
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

const IMAGE_URLS = {
  vanguard: `${BASE}/rockets/vanguard.png`,
  kestrel: `${BASE}/rockets/kestrel.png`,
  marauder: `${BASE}/rockets/marauder.png`,
  planets: `${BASE}/planets/planets.png`,
  finish: `${BASE}/finish/finish.png`,
  effects: `${BASE}/effects/effects.png`,
  environment: `${BASE}/environment/environment.png`,
} as const;

const ATLAS_URLS = {
  vanguard: `${BASE}/rockets/vanguard.json`,
  kestrel: `${BASE}/rockets/kestrel.json`,
  marauder: `${BASE}/rockets/marauder.json`,
  planets: `${BASE}/planets/planets.json`,
  finish: `${BASE}/finish/finish.json`,
  effects: `${BASE}/effects/effects.json`,
  environment: `${BASE}/environment/environment.json`,
} as const;

type AtlasKey = keyof typeof IMAGE_URLS;

/** The roster from assets/rockets/index.json. Empty until {@link loadAtlasData}. */
export let ROCKETS: RocketEntry[] = [];

export interface Atlases {
  rockets: Record<RocketId, Atlas>;
  planets: Atlas;
  finish: Atlas;
  effects: Atlas;
  environment: Atlas;
}

const images = Object.fromEntries(
  Object.entries(IMAGE_URLS).map(([key, url]) => [key, new ImageSource(url)]),
) as Record<AtlasKey, ImageSource>;

let atlasJson: Record<AtlasKey, AtlasJson> | null = null;
let cached: Atlases | null = null;

/**
 * Fetch the atlas JSON and the rocket roster.
 *
 * Must finish before the engine starts. The prototype got this for free by
 * importing the JSON at build time; over HTTP it has to be awaited, and
 * {@link atlases} is called synchronously from inside the scene where there is
 * nowhere left to await.
 */
export async function loadAtlasData(): Promise<void> {
  if (atlasJson) return;

  const keys = Object.keys(ATLAS_URLS) as AtlasKey[];
  const [roster, ...sheets] = await Promise.all([
    fetchJson<{ rockets: RocketEntry[] }>(`${BASE}/rockets/index.json`),
    ...keys.map((key) => fetchJson<AtlasJson>(ATLAS_URLS[key])),
  ]);

  ROCKETS = roster.rockets;
  atlasJson = Object.fromEntries(keys.map((key, i) => [key, sheets[i]])) as Record<
    AtlasKey,
    AtlasJson
  >;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `could not load ${url} (${res.status}). Run \`pnpm --filter web sync:assets\` to refresh web/public/game.`,
    );
  }
  return (await res.json()) as T;
}

/**
 * A fresh loader for the sprite sheets.
 *
 * Not a module-level singleton the way the prototype's was: an Excalibur Loader
 * carries completion state, so reusing one across a remount (which React does in
 * development on every save) hands the new engine a loader that believes it has
 * already finished.
 */
export function createLoader(): Loader {
  return new Loader(Object.values(images));
}

/**
 * Every loaded atlas, keyed the same way as the assets/ folders.
 *
 * Only valid once {@link loadAtlasData} has resolved and the loader has run:
 * {@link Atlas} slices its sheet at construction, which needs the image's real
 * dimensions.
 */
export function atlases(): Atlases {
  if (cached) return cached;
  if (!atlasJson) throw new Error('atlases() called before loadAtlasData() resolved');

  const json = atlasJson;
  const build = (key: AtlasKey) => new Atlas(json[key], images[key]);

  cached = {
    rockets: {
      vanguard: build('vanguard'),
      kestrel: build('kestrel'),
      marauder: build('marauder'),
    },
    planets: build('planets'),
    finish: build('finish'),
    effects: build('effects'),
    environment: build('environment'),
  };
  return cached;
}
