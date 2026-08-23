import { ImageSource, Loader } from 'excalibur';
import { Atlas, type AtlasJson } from './atlas';

// ---------------------------------------------------------------------------
// The only file that reaches outside the prototype.
//
// Art is read straight from the repo's assets/ folder rather than copied in.
// assets/README.md is explicit that the generators are the source of truth and
// the PNGs should not be hand-edited, so duplicating them here would create a
// second copy that silently goes stale the next time a gen-*.mjs is rerun.
//
// Atlas JSON is imported (it is a few KB and wanted synchronously at build time);
// the PNGs come in as URLs and go through Excalibur's Loader.
// ---------------------------------------------------------------------------

import rocketRoster from '../../../assets/rockets/index.json';
import vanguardAtlasJson from '../../../assets/rockets/vanguard.json';
import kestrelAtlasJson from '../../../assets/rockets/kestrel.json';
import marauderAtlasJson from '../../../assets/rockets/marauder.json';
import planetsAtlasJson from '../../../assets/planets/planets.json';
import finishAtlasJson from '../../../assets/finish/finish.json';
import effectsAtlasJson from '../../../assets/effects/effects.json';
import environmentAtlasJson from '../../../assets/environment/environment.json';

import vanguardPng from '../../../assets/rockets/vanguard.png?url';
import kestrelPng from '../../../assets/rockets/kestrel.png?url';
import marauderPng from '../../../assets/rockets/marauder.png?url';
import planetsPng from '../../../assets/planets/planets.png?url';
import finishPng from '../../../assets/finish/finish.png?url';
import effectsPng from '../../../assets/effects/effects.png?url';
import environmentPng from '../../../assets/environment/environment.png?url';

export type RocketId = 'vanguard' | 'kestrel' | 'marauder';

export interface RocketEntry {
  id: RocketId;
  label: string;
}

/** The roster, straight from assets/rockets/index.json. */
export const ROCKETS = rocketRoster.rockets as RocketEntry[];

const images = {
  vanguard: new ImageSource(vanguardPng),
  kestrel: new ImageSource(kestrelPng),
  marauder: new ImageSource(marauderPng),
  planets: new ImageSource(planetsPng),
  finish: new ImageSource(finishPng),
  effects: new ImageSource(effectsPng),
  environment: new ImageSource(environmentPng),
};

const atlasJson = {
  vanguard: vanguardAtlasJson as unknown as AtlasJson,
  kestrel: kestrelAtlasJson as unknown as AtlasJson,
  marauder: marauderAtlasJson as unknown as AtlasJson,
  planets: planetsAtlasJson as unknown as AtlasJson,
  finish: finishAtlasJson as unknown as AtlasJson,
  effects: effectsAtlasJson as unknown as AtlasJson,
  environment: environmentAtlasJson as unknown as AtlasJson,
};

type AtlasKey = keyof typeof images;

/**
 * Every loaded atlas, keyed the same way as the assets/ folders.
 *
 * Only valid after {@link loader} has finished: {@link Atlas} slices its sprite
 * sheet at construction, which needs the image's real dimensions.
 */
export interface Atlases {
  rockets: Record<RocketId, Atlas>;
  planets: Atlas;
  finish: Atlas;
  effects: Atlas;
  environment: Atlas;
}

/**
 * A race only needs the sheets for the rockets actually in it, which is the whole
 * reason assets/rockets ships one file per rocket. The prototype is single player
 * with a live rocket picker, so it takes all three: ~1.4MB, and it means swapping
 * ships in the dev panel is instant.
 */
export const loader = new Loader(Object.values(images));

let cached: Atlases | null = null;

export function atlases(): Atlases {
  if (cached) return cached;

  const build = (key: AtlasKey) => new Atlas(atlasJson[key], images[key]);

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
