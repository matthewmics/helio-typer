import { Race } from '@heliotyper/engine';
import { CloudLayer } from '../actors/CloudLayer';
import { Effects } from '../actors/Effects';
import { Ground } from '../actors/Ground';
import { Heliopause } from '../actors/Heliopause';
import { KuiperBelt } from '../actors/KuiperBelt';
import { PlanetRun } from '../actors/PlanetRun';
import { Rocket } from '../actors/Rocket';
import { drawSky } from '../actors/Sky';
import { Starfield } from '../actors/Starfield';
import type { Atlas } from '../atlas';
import { LANE_GAP } from '../config';
import type { PilotEventKind, RaceNetClient, RacePilotInfo } from '../net';
import { viewOfRace, type PilotView } from '../pilot';
import { type Atlases, DEFAULT_ROCKET, loadRocket, type RocketId } from '../resources';
import { Stage } from '../stage';
import { Hud, type StartState } from '../ui/hud';
import { approach } from '../util';
import { fieldY, makeView, SHIP_BASE_OFFSET, type View } from '../view';

/** Cap the step so a background tab does not teleport the ship on return. */
const MAX_DT = 0.05;

/** How often the local pilot's state goes up, in Hz. Matches the server broadcast. */
const SEND_HZ = 12;

/** How long GO stays up once the count runs out, in ms. */
const GO_MS = 800;

/** How a run went, for the results. */
export interface RunResult {
  /** Crossed the heliopause, rather than the race ending around you. */
  finished: boolean;
  wpm: number;
  accuracy: number;
  mistakes: number;
  progress: number;
  /** Wall-clock ms from the start, stalls included, to the finish or to now. */
  timeMs: number;
}

export interface RaceSceneOptions {
  /** Shared by every pilot in the match, so everyone types the same passage. */
  seed: number;
  /** Callsign on your own name pill. */
  youName: string;
  /** Absent for a solo run, in which case the field is just you. */
  net?: RaceNetClient;
  /** Called the moment you cross the heliopause. */
  onFinish?: (result: RunResult) => void;
}

/**
 * The race: the simulation, every layer of the run, the field of rockets and the
 * DOM HUD, ticked by a {@link Stage}.
 *
 * Constructing one starts it, and {@link dispose} is the only way to stop it. It
 * owns a frame loop and a window key listener, so whoever builds one has to
 * dispose of it: under React the component that does remounts on every save.
 */
export class RaceScene {
  private readonly _net: RaceNetClient | null;
  private readonly _race: Race;
  private readonly _hud: Hud;
  private readonly _stage: Stage;

  private readonly _stars: Starfield;
  private readonly _ground: Ground;
  private readonly _clouds: CloudLayer;
  private readonly _planets: PlanetRun;
  private readonly _belt: KuiperBelt;
  private readonly _heliopause: Heliopause;
  private readonly _effects: Effects;

  /** Your rocket. Always drawn from the local simulation, never from the network. */
  private readonly _you: Rocket;
  /** Everyone else, keyed by pilot id. */
  private readonly _others = new Map<string, Rocket>();
  /** Screen x offset per pilot id, fixed for the race. */
  private readonly _laneX = new Map<string, number>();
  /** Pilots whose own rocket sheet is still on its way. */
  private readonly _shipsLoading = new Set<string>();

  /** Eased toward real speed, so a stall reads as deceleration rather than a cut. */
  private _camSpeed = 0;
  private _worldScroll = 0;
  private _time = 0;
  private _sinceSend = 0;
  private _view: View;
  private _disposed = false;

  private readonly _onFinish: ((result: RunResult) => void) | null;
  /** A solo run starts on its first keystroke, so its clock does too. */
  private _soloStartAt: number | null = null;
  private _finishedAt: number | null = null;

  constructor(canvas: HTMLCanvasElement, art: Atlases, options: RaceSceneOptions) {
    this._net = options.net ?? null;
    this._onFinish = options.onFinish ?? null;
    this._stage = new Stage(canvas);

    this._race = new Race(options.seed, {
      onLaunch: () => {
        if (!this._net) this._soloStartAt = Date.now();
        this._hud.hideHint();
        this._you.playBlastoff();
        this._effects.launch(this._view.cx, this._view.shipY + SHIP_BASE_OFFSET + 4);
        this._stage.shake(7, 550);
        this._net?.sendEvent('launch');
      },
      onMistake: () => {
        this._hud.flash();
        this._effects.mistake(this._view.cx, this._view.shipY);
        this._stage.shake(6, 250);
        this._net?.sendEvent('mistake');
      },
      onBreach: () => {
        this._effects.breach(this._view.cx, this._view.shipY);
        this._stage.shake(10, 600);
        this._net?.sendEvent('breach');
      },
      onRecover: () => this._net?.sendEvent('recover'),
      onFinish: () => {
        this._finishedAt = Date.now();
        this._net?.sendEvent('finish');
        this._onFinish?.(this.result());
      },
      onPrompt: () => this._hud.renderPrompt(),
    });

    this._stars = new Starfield(art.effects);
    this._ground = new Ground(art.environment);
    this._clouds = new CloudLayer(art.environment);
    this._planets = new PlanetRun(art.planets, art.effects);
    this._belt = new KuiperBelt(art.kuiper, art.effects);
    this._heliopause = new Heliopause(art.finish);
    this._effects = new Effects(art.effects);
    this._you = this._buildField(options.youName, art.rocket, art.effects);

    this._hud = new Hud(this._race, {
      onRestart: () => this.restart(),
      onRocketChange: (id) => this.useRocket(id),
    });
    this._hud.addPilots([...this._others.keys()]);

    this._view = makeView(this._stage.width, this._stage.height, this._race, 0, 0);

    // Nothing runs until everything above that could throw has been built.
    window.addEventListener('keydown', this._onKeyDown, { passive: false });
    this._net?.onEvent((id, kind) => this._onRemoteEvent(id, kind));
    this._stage.start((dt) => this._frame(dt));
  }

  /**
   * Stop the loop and let go of the page.
   *
   * The key listener comes off first, so a discarded race never types another
   * key. Under React this runs on every remount, and StrictMode mounts twice on
   * purpose, so anything left attached here would type into a race nobody can see.
   */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    window.removeEventListener('keydown', this._onKeyDown);
    this._stage.dispose();
    this._hud.dispose();
  }

  /** Fetched on first use, so the swap lands a moment after the dev panel asks. */
  useRocket(id: RocketId): void {
    loadRocket(id)
      .then((atlas) => {
        if (!this._disposed) this._you.useRocket(atlas);
      })
      .catch(() => {
        // The sheet did not load. Keep flying the rocket you already have.
      });
  }

  restart(): void {
    // The HUD first: resetting the race re-renders the prompt, and the HUD has
    // to have forgotten how far the old run got by then.
    this._hud.reset();
    this._race.reset();
    this._effects.clear();
    this._camSpeed = 0;
    this._worldScroll = 0;
    this._soloStartAt = null;
    this._finishedAt = null;
  }

  /** Your run so far, or at the finish once you have crossed. */
  result(): RunResult {
    const race = this._race;
    const startAt = this._net ? this._net.startAt : this._soloStartAt;
    const end = this._finishedAt ?? Date.now();
    return {
      finished: race.phase === 'finished',
      wpm: race.wpm,
      accuracy: race.accuracy,
      mistakes: race.mistakes,
      progress: race.progress,
      timeMs: startAt === null ? 0 : Math.max(0, end - startAt),
    };
  }

  /**
   * Keys count once the race has started. A solo run has nobody to wait for;
   * a matched one waits for every pilot and then the countdown, so nobody
   * whose page loaded first gets a head start.
   */
  private _canType(): boolean {
    const net = this._net;
    return !net || (net.startAt !== null && Date.now() >= net.startAt);
  }

  /** What the start overlay should say this frame. */
  private _startState(): StartState {
    const net = this._net;
    if (!net) return { kind: 'off' };
    if (net.startAt === null) return { kind: 'waiting', joined: net.joined, humans: net.humans };
    const left = net.startAt - Date.now();
    if (left > 0) return { kind: 'count', seconds: Math.ceil(left / 1000) };
    return left > -GO_MS ? { kind: 'go' } : { kind: 'off' };
  }

  /**
   * Build one rocket per pilot and give each a fixed lane. Returns yours.
   *
   * You are always drawn in the middle column, whatever lane the server handed
   * out, so the frame reads the same from every seat. Everyone else keeps their
   * server-assigned order around you, which is what stops two pilots landing in
   * the same column.
   */
  private _buildField(youName: string, ship: Atlas, effects: Atlas): Rocket {
    const roster: RacePilotInfo[] = this._net?.pilots ?? [
      { id: 'you', name: youName, lane: 0, ship: DEFAULT_ROCKET, isYou: true },
    ];

    const others = roster.filter((p) => !p.isYou).sort((a, b) => a.lane - b.lane);
    const you = roster.find((p) => p.isYou) ?? roster[0];

    // Slot yourself into the middle of the ordered field.
    const columns = [...others];
    const middle = Math.floor(roster.length / 2);
    columns.splice(middle, 0, you);

    columns.forEach((pilot, index) => {
      this._laneX.set(pilot.id, (index - middle) * LANE_GAP);
    });

    for (const pilot of others) {
      const rocket = new Rocket(ship, effects, pilot.name);
      this._others.set(pilot.id, rocket);
      if (pilot.ship === DEFAULT_ROCKET) continue;

      // Their own sheet, fetched only for the rockets actually in this race.
      // Kept off screen until it lands, so nobody is seen as the default and
      // then swaps; if it never lands, they fly the default instead.
      this._shipsLoading.add(pilot.id);
      loadRocket(pilot.ship)
        .then((atlas) => {
          if (!this._disposed) rocket.useRocket(atlas);
        })
        .catch(() => {
          // Leave them on the default rocket.
        })
        .finally(() => this._shipsLoading.delete(pilot.id));
    }
    return new Rocket(ship, effects, you.name);
  }

  private readonly _onKeyDown = (e: KeyboardEvent): void => {
    // Let browser and OS shortcuts through.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Single printable characters only. Backspace stays unhandled by design.
    if (e.key.length !== 1) return;
    e.preventDefault();
    if (!this._canType()) return;
    // Applied locally with no round trip. At 100+ WPM a key lands every ~120ms,
    // well inside typical latency, so waiting on the server would feel sluggish
    // to exactly the players who notice most.
    this._race.typeKey(e.key);
  };

  private _onRemoteEvent(pilotId: string, kind: PilotEventKind): void {
    // The connection outlives this scene and keeps no way to unsubscribe.
    if (this._disposed) return;
    const rocket = this._others.get(pilotId);
    if (!rocket) return;
    // Only the ignition has a one-shot animation of its own. The rest are already
    // visible through the interpolated state: a mistake shows as the plume dying,
    // a breach as the zap sprite, because both are driven by the same fields.
    if (kind === 'launch') rocket.playBlastoff();
  }

  private _frame(elapsed: number): void {
    const dt = Math.min(elapsed, MAX_DT);
    this._update(dt);
    this._draw(this._stage.ctx);
  }

  private _update(dt: number): void {
    this._time += dt;

    this._race.update(dt);

    // Cosmetic drift: eased toward real speed so decay reads as coasting.
    this._camSpeed = approach(this._camSpeed, this._race.speed, 8, dt);
    this._worldScroll += this._camSpeed * dt * 900;

    const view = makeView(this._stage.width, this._stage.height, this._race, this._worldScroll, this._time);
    this._view = view;

    const mine = viewOfRace(this._race);
    this._you.sync(mine, dt, view.cx + (this._laneX.get(this._youId()) ?? 0), view.shipY);
    this._syncOthers(view, dt);

    this._effects.update(dt);
    this._hud.update(dt);
    this._hud.showStart(this._startState());

    this._pump(dt, mine);
  }

  /**
   * Back to front. The camera never moves, so the order of these calls is the
   * whole depth story.
   *
   * Every rocket goes down between the two halves of the cloud band, which is what
   * sells flying through the weather rather than past a picture of it. The
   * Kuiper belt is split around the rockets the same way. Other pilots go before
   * yours, so a crowded lane never hides your own ship at the moment you most
   * need to see it.
   *
   * The belt goes down after the planets, since Pluto is the furthest thing in
   * it, and before the heliopause, whose glow then lies over it.
   */
  private _draw(ctx: CanvasRenderingContext2D): void {
    const view = this._view;
    drawSky(ctx, view);
    this._stars.draw(ctx, view);
    this._planets.draw(ctx, view);
    this._belt.drawBehind(ctx, view);
    this._heliopause.draw(ctx, view);
    this._ground.draw(ctx, view);
    this._clouds.drawBehind(ctx, view);
    for (const rocket of this._others.values()) rocket.draw(ctx, view);
    this._you.draw(ctx, view);
    this._clouds.drawInFront(ctx, view);
    this._belt.drawInFront(ctx, view);
    this._effects.draw(ctx);
  }

  private _youId(): string {
    return this._net?.youId ?? 'you';
  }

  private _syncOthers(view: View, dt: number): void {
    const net = this._net;
    if (!net) return;

    for (const [id, rocket] of this._others) {
      const state: PilotView | null = net.field.view(id, this._race.cfg.maxHull);
      // Nothing has arrived for this pilot yet, or their ship has not. Better an
      // empty lane than a rocket that jumps, or changes shape, a moment later.
      rocket.visible = state !== null && !this._shipsLoading.has(id);
      this._hud.placePilot(id, state ? state.progress : null);
      if (state) rocket.sync(state, dt, view.cx + (this._laneX.get(id) ?? 0), fieldY(view, state.progress));
    }
  }

  /** Push the local pilot's state up on a fixed cadence, independent of frame rate. */
  private _pump(dt: number, mine: PilotView): void {
    const net = this._net;
    if (!net) return;

    this._sinceSend += dt;
    const interval = 1 / SEND_HZ;
    if (this._sinceSend < interval) return;
    this._sinceSend = Math.min(this._sinceSend - interval, interval);

    net.sendState({
      t: Date.now(),
      progress: mine.progress,
      speed: mine.speed,
      speedRatio: mine.speedRatio,
      tier: mine.tier,
      hull: mine.hull,
      phase: mine.phase,
      launched: mine.launched,
      launchT: mine.launchT,
      wpm: this._race.wpm,
      stallTimer: this._race.stallTimer,
      mistakes: this._race.mistakes,
    });
  }
}
