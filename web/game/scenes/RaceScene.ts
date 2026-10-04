import { Race } from '@heliotyper/engine';
import { CloudLayer } from '../actors/CloudLayer';
import { Effects } from '../actors/Effects';
import { Ground } from '../actors/Ground';
import { Heliopause } from '../actors/Heliopause';
import { PlanetRun } from '../actors/PlanetRun';
import { Rocket } from '../actors/Rocket';
import { drawSky } from '../actors/Sky';
import { Starfield } from '../actors/Starfield';
import type { Atlas } from '../atlas';
import { LANE_GAP } from '../config';
import type { PilotEventKind, RaceNetClient, RacePilotInfo } from '../net';
import { viewOfRace, type PilotView } from '../pilot';
import { type Atlases, loadRocket, type RocketId } from '../resources';
import { Stage } from '../stage';
import { Hud } from '../ui/hud';
import { approach } from '../util';
import { fieldY, makeView, SHIP_BASE_OFFSET, type View } from '../view';

/** Cap the step so a background tab does not teleport the ship on return. */
const MAX_DT = 0.05;

/** How often the local pilot's state goes up, in Hz. Matches the server broadcast. */
const SEND_HZ = 12;

export interface RaceSceneOptions {
  /** Shared by every pilot in the match, so everyone types the same sentences. */
  seed: number;
  /** Callsign on your own name pill. */
  youName: string;
  /** Absent for a solo run, in which case the field is just you. */
  net?: RaceNetClient;
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
  private readonly _heliopause: Heliopause;
  private readonly _effects: Effects;

  /** Your rocket. Always drawn from the local simulation, never from the network. */
  private readonly _you: Rocket;
  /** Everyone else, keyed by pilot id. */
  private readonly _others = new Map<string, Rocket>();
  /** Screen x offset per pilot id, fixed for the race. */
  private readonly _laneX = new Map<string, number>();

  /** Eased toward real speed, so a stall reads as deceleration rather than a cut. */
  private _camSpeed = 0;
  private _worldScroll = 0;
  private _time = 0;
  private _sinceSend = 0;
  private _view: View;
  private _disposed = false;

  constructor(canvas: HTMLCanvasElement, art: Atlases, options: RaceSceneOptions) {
    this._net = options.net ?? null;
    this._stage = new Stage(canvas);

    this._race = new Race(options.seed, {
      onLaunch: () => {
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
        this._hud.showEnd();
        this._net?.sendEvent('finish');
      },
      onPrompt: () => this._hud.renderPrompt(),
    });

    this._stars = new Starfield(art.effects);
    this._ground = new Ground(art.environment);
    this._clouds = new CloudLayer(art.environment);
    this._planets = new PlanetRun(art.planets, art.effects);
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
    this._race.reset();
    this._effects.clear();
    this._camSpeed = 0;
    this._worldScroll = 0;
    this._hud.hideEnd();
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
      { id: 'you', name: youName, lane: 0, isYou: true },
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
      this._others.set(pilot.id, new Rocket(ship, effects, pilot.name));
    }
    return new Rocket(ship, effects, you.name);
  }

  private readonly _onKeyDown = (e: KeyboardEvent): void => {
    // Let browser and OS shortcuts through.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Single printable characters only. Backspace stays unhandled by design.
    if (e.key.length !== 1) return;
    e.preventDefault();
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

    this._pump(dt, mine);
  }

  /**
   * Back to front. The camera never moves, so the order of these calls is the
   * whole depth story.
   *
   * Every rocket goes down between the two halves of the cloud band, which is what
   * sells flying through the weather rather than past a picture of it. Other
   * pilots go before yours, so a crowded lane never hides your own ship at the
   * moment you most need to see it.
   */
  private _draw(ctx: CanvasRenderingContext2D): void {
    const view = this._view;
    drawSky(ctx, view);
    this._stars.draw(ctx, view);
    this._planets.draw(ctx, view);
    this._heliopause.draw(ctx, view);
    this._ground.draw(ctx, view);
    this._clouds.drawBehind(ctx, view);
    for (const rocket of this._others.values()) rocket.draw(ctx, view);
    this._you.draw(ctx, view);
    this._clouds.drawInFront(ctx, view);
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
      // Nothing has arrived for this pilot yet. Better an empty lane than a
      // rocket parked on the pad that jumps once the first snapshot lands.
      rocket.visible = state !== null;
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
    });
  }
}
