import { DEFAULT_CONFIG, EPS, LAUNCH_DURATION, type RaceConfig } from './config';
import { buildSequence } from './text';

export type Phase = 'racing' | 'stalled' | 'finished';

export interface RaceHooks {
  onLaunch?: () => void;
  onMistake?: () => void;
  onBreach?: () => void;
  onRecover?: () => void;
  onFinish?: () => void;
  onPrompt?: () => void;
}

/**
 * The whole simulation, with no rendering and no DOM in it.
 *
 * Lifted almost unchanged from the single player prototype, which already kept it
 * pure specifically so it could run on a server. This playground is that claim
 * being cashed in: the exact same class drives the browser's local pilot and the
 * server's bot pilots, so there is one physics implementation rather than two that
 * quietly disagree.
 *
 * The one addition for multiplayer is the seeded sentence sequence: every pilot in
 * a race walks the same list, so their WPM is comparable.
 */
export class Race {
  readonly cfg: RaceConfig = { ...DEFAULT_CONFIG };
  readonly hooks: RaceHooks;

  private _sequence: string[] = [];
  private _seqIndex = 0;

  sentence = '';
  typedIndex = 0;
  mistakes = 0;
  correctChars = 0;

  speed = 0;
  progress = 0;
  hull = DEFAULT_CONFIG.maxHull;

  phase: Phase = 'racing';
  stallTimer = 0;

  launched = false;
  launchT = 0;

  elapsed = 0;
  private _started = false;

  constructor(seed: number, hooks: RaceHooks = {}) {
    this.hooks = hooks;
    this._sequence = buildSequence(seed);
    this._clear();
  }

  reset(seed?: number): void {
    if (seed !== undefined) this._sequence = buildSequence(seed);
    this._clear();
    this.hooks.onPrompt?.();
  }

  private _clear(): void {
    this._seqIndex = 0;
    this.sentence = this._sequence[0];
    this.typedIndex = 0;
    this.mistakes = 0;
    this.correctChars = 0;
    this.speed = 0;
    this.progress = 0;
    this.hull = this.cfg.maxHull;
    this.phase = 'racing';
    this.stallTimer = 0;
    this.launched = false;
    this.launchT = 0;
    this.elapsed = 0;
    this._started = false;
  }

  // -------------------------------------------------------------------------
  // Input
  // -------------------------------------------------------------------------

  typeKey(key: string): void {
    if (this.phase !== 'racing') return;

    if (key === this.sentence[this.typedIndex]) {
      if (!this._started) {
        this._started = true;
        this.launched = true;
        this.launchT = LAUNCH_DURATION;
        this.hooks.onLaunch?.();
      }
      this.typedIndex++;
      this.correctChars++;
      this.speed = Math.min(this.cfg.maxSpeed, this.speed + this.cfg.accel);

      if (this.typedIndex >= this.sentence.length) {
        this._seqIndex = (this._seqIndex + 1) % this._sequence.length;
        this.sentence = this._sequence[this._seqIndex];
        this.typedIndex = 0;
      }
      this.hooks.onPrompt?.();
      return;
    }

    this.mistakes++;
    this.hull -= 1;
    this.hooks.onMistake?.();

    if (this.hull <= 0) {
      this.hull = 0;
      this.phase = 'stalled';
      this.stallTimer = this.cfg.stallDuration;
      this.hooks.onBreach?.();
    }
    this.speed = this.speedFloor;
    this.hooks.onPrompt?.();
  }

  // -------------------------------------------------------------------------
  // Simulation
  // -------------------------------------------------------------------------

  update(dt: number): void {
    if (this.phase === 'finished') return;

    if (this._started && this.phase === 'racing') this.elapsed += dt;
    if (this.launchT > 0) this.launchT = Math.max(0, this.launchT - dt);

    if (this.phase === 'stalled') {
      this.stallTimer -= dt;
      this.hooks.onPrompt?.();
      if (this.stallTimer <= 0) {
        this.stallTimer = 0;
        this.hull = this.cfg.maxHull;
        this.phase = 'racing';
        this.speed = this.speedFloor;
        this.hooks.onRecover?.();
        this.hooks.onPrompt?.();
      }
      return;
    }

    const k = Math.LN2 / this.cfg.halfLife;
    this.speed = Math.max(this.speedFloor, this.speed * Math.exp(-k * dt));
    if (this.speed < EPS) this.speed = 0;

    this.progress = Math.min(1, this.progress + (this.speed * dt) / this.cfg.raceDistance);

    if (this.progress >= 1) {
      this.phase = 'finished';
      this.hooks.onFinish?.();
    }
  }

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------

  get speedFloor(): number {
    if (!this.launched || this.phase !== 'racing') return 0;
    return Math.min(this.cfg.minSpeed, this.cfg.maxSpeed);
  }

  get speedRatio(): number {
    return Math.max(0, Math.min(1, this.speed / this.cfg.maxSpeed));
  }

  get tier(): number {
    return Math.min(4, Math.floor(this.speedRatio * 5));
  }

  get ignition(): number {
    return this.launchT > 0 ? this.launchT / LAUNCH_DURATION : 0;
  }

  get wpm(): number {
    const minutes = this.elapsed / 60;
    return minutes > 0.0005 ? Math.round(this.correctChars / 5 / minutes) : 0;
  }

  get accuracy(): number {
    const total = this.correctChars + this.mistakes;
    return total > 0 ? Math.round((this.correctChars / total) * 100) : 100;
  }

  // -------------------------------------------------------------------------
  // Dev panel
  // -------------------------------------------------------------------------

  setMaxHull(n: number): void {
    this.cfg.maxHull = n;
    this.hull = n;
  }

  setMaxSpeed(v: number): void {
    this.cfg.maxSpeed = v;
    if (this.speed > v) this.speed = v;
  }

  setStallDuration(v: number): void {
    this.cfg.stallDuration = v;
    if (this.stallTimer > v) this.stallTimer = v;
  }
}
