import { type Engine, Scene } from 'excalibur';
import { CloudLayer } from '../actors/CloudLayer';
import { Effects } from '../actors/Effects';
import { Ground } from '../actors/Ground';
import { Heliopause } from '../actors/Heliopause';
import { PlanetRun } from '../actors/PlanetRun';
import { Rocket } from '../actors/Rocket';
import { Sky } from '../actors/Sky';
import { Starfield } from '../actors/Starfield';
import { Race } from '../race';
import { atlases, type RocketId } from '../resources';
import { Hud } from '../ui/hud';
import { approach } from '../util';
import { makeView, SHIP_BASE_OFFSET, type View } from '../view';

/** Cap the step so a background tab does not teleport the ship on return. */
const MAX_DT = 0.05;

export class RaceScene extends Scene {
  private _race!: Race;
  private _hud!: Hud;

  private _sky!: Sky;
  private _stars!: Starfield;
  private _ground!: Ground;
  private _clouds!: CloudLayer;
  private _planets!: PlanetRun;
  private _heliopause!: Heliopause;
  private _rocket!: Rocket;
  private _effects!: Effects;

  /** Eased toward real speed, so a stall reads as deceleration rather than a cut. */
  private _camSpeed = 0;
  private _worldScroll = 0;
  private _time = 0;
  private _view!: View;

  override onInitialize(engine: Engine): void {
    const art = atlases();

    this._race = new Race({
      onLaunch: () => {
        this._hud.hideHint();
        this._rocket.playBlastoff();
        this._effects.launch(this._view.cx, this._view.shipY + SHIP_BASE_OFFSET + 4);
        this.camera.shake(7, 7, 550);
      },
      onMistake: () => {
        this._hud.flash();
        this._effects.mistake(this._view.cx, this._view.shipY);
        this.camera.shake(6, 6, 250);
      },
      onBreach: () => {
        this._effects.breach(this._view.cx, this._view.shipY);
        this.camera.shake(10, 10, 600);
      },
      onFinish: () => this._hud.showEnd(),
      onPrompt: () => this._hud.renderPrompt(),
    });

    this._sky = new Sky();
    this.add(this._sky);

    this._stars = new Starfield(this, art.effects);
    this._ground = new Ground(this, art.environment);
    this._clouds = new CloudLayer(this, art.environment);
    this._planets = new PlanetRun(this, art.planets, art.effects);
    this._heliopause = new Heliopause(this, art.finish);
    this._effects = new Effects(this, art.effects);

    this._rocket = new Rocket(art.rockets.vanguard);
    this._rocket.useDamageSmoke(art.effects);
    this.add(this._rocket);

    this._hud = new Hud(this._race, {
      onRestart: () => this.restart(),
      onRocketChange: (id) => this.useRocket(id),
    });

    // The camera is locked for the whole race, so world space is screen space.
    // Nothing here follows the ship: the ship travelling across a fixed frame is
    // the entire read.
    this._lockCamera(engine);
    engine.screen.events.on('resize', () => this._lockCamera(engine));

    this._view = makeView(engine, this._race, 0, 0);
    this._stars.layout(this._view.w, this._view.h);

    this._bindTyping();
  }

  private _lockCamera(engine: Engine): void {
    this.camera.pos.setTo(engine.screen.drawWidth / 2, engine.screen.drawHeight / 2);
    this.camera.zoom = 1;
  }

  private _bindTyping(): void {
    window.addEventListener(
      'keydown',
      (e) => {
        // Let browser and OS shortcuts through.
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        // Single printable characters only. Backspace stays unhandled by design.
        if (e.key.length !== 1) return;
        e.preventDefault();
        this._race.typeKey(e.key);
      },
      { passive: false },
    );
  }

  useRocket(id: RocketId): void {
    this._rocket.useRocket(atlases().rockets[id]);
  }

  restart(): void {
    this._race.reset();
    this._effects.clear();
    this._camSpeed = 0;
    this._worldScroll = 0;
    this._hud.hideEnd();
  }

  override onPreUpdate(engine: Engine, elapsedMs: number): void {
    const dt = Math.min(elapsedMs / 1000, MAX_DT);
    this._time += dt;

    this._race.update(dt);

    // Cosmetic drift: eased toward real speed so decay reads as coasting.
    this._camSpeed = approach(this._camSpeed, this._race.speed, 8, dt);
    this._worldScroll += this._camSpeed * dt * 900;

    const view = makeView(engine, this._race, this._worldScroll, this._time);
    this._view = view;

    this._sky.sync(view);
    this._stars.sync(view);
    this._ground.sync(view);
    this._clouds.sync(view);
    this._planets.sync(view);
    this._heliopause.sync(view);
    this._rocket.sync(view, this._race, dt);
    this._effects.update(dt);
    this._hud.update(dt);
  }
}
