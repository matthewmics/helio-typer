import { ATMO_END, DEFAULT_CONFIG, EPS, LAUNCH_DURATION, TIER_LEN, type RaceConfig } from './config';
import { pickSentence } from './text';

export type Phase = 'racing' | 'stalled' | 'finished';

/**
 * Hooks for anything that reacts to the run rather than reads it: sound, screen
 * shake, one-shot animations, the DOM prompt.
 */
export interface RaceHooks {
  onLaunch?: () => void;
  onMistake?: () => void;
  onBreach?: () => void;
  onRecover?: () => void;
  onFinish?: () => void;
  /** Fired when the prompt text changed and needs re-rendering. */
  onPrompt?: () => void;
}

/**
 * The whole simulation, with no rendering and no DOM in it.
 *
 * Keeping this pure is the point: protoype.md's next step after the Excalibur port
 * is a server-authoritative loop, and that means this class has to be runnable on
 * a server with nothing but `update(dt)` and `typeKey(key)`.
 */
export class Race {
  readonly cfg: RaceConfig = { ...DEFAULT_CONFIG };
  readonly hooks: RaceHooks;

  sentence = '';
  /** Index within the CURRENT sentence, not the run. */
  typedIndex = 0;
  mistakes = 0;
  correctChars = 0;

  speed = 0;
  /** 0..1 across the whole solar system. */
  progress = 0;
  hull = DEFAULT_CONFIG.maxHull;

  phase: Phase = 'racing';
  stallTimer = 0;

  /** False until the first correct keystroke. The engines are cold until then. */
  launched = false;
  /** Counts down through the blastoff flare. */
  launchT = 0;

  /** Seconds of run time since the first correct keystroke, for WPM. */
  elapsed = 0;
  private _started = false;

  constructor(hooks: RaceHooks = {}) {
    this.hooks = hooks;
    // Deliberately not `reset()`: hooks must not fire during construction, since
    // whatever handles them is generally built from the Race that is still being
    // constructed. Callers render the first prompt themselves.
    this._clear();
  }

  /** Restart the run. Safe to call at any time. */
  reset(): void {
    this._clear();
    this.hooks.onPrompt?.();
  }

  private _clear(): void {
    this.sentence = pickSentence(null);
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

  /**
   * Feed one character. Anything that is not a single printable character is the
   * caller's problem to filter out.
   *
   * Backspace stays unhandled, which is still an open design question rather than
   * an oversight (see protoype.md).
   */
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
        this.sentence = pickSentence(this.sentence);
        this.typedIndex = 0;
      }
      this.hooks.onPrompt?.();
      return;
    }

    // Wrong key: every bit of built-up speed, one hull segment, and the character
    // index does not advance. Speed is the only thing that moves the ship, so this
    // costs real distance rather than just a cosmetic penalty.
    this.mistakes++;
    this.hull -= 1;
    this.hooks.onMistake?.();

    if (this.hull <= 0) {
      this.hull = 0;
      this.phase = 'stalled';
      this.stallTimer = this.cfg.stallDuration;
      this.hooks.onBreach?.();
    }
    // Back to the cruise floor, which the breach above has already dropped to a
    // true zero if this was the segment that took the hull with it.
    this.speed = this.speedFloor;
    this.hooks.onPrompt?.();
  }

  // -------------------------------------------------------------------------
  // Simulation
  // -------------------------------------------------------------------------

  update(dt: number): void {
    if (this.phase === 'finished') return;

    // Stalled time must not count against WPM: input is locked out, so no
    // keystrokes could have landed anyway. Only 'racing' accrues here since
    // 'finished' already returned above.
    if (this._started && this.phase === 'racing') this.elapsed += dt;
    if (this.launchT > 0) this.launchT = Math.max(0, this.launchT - dt);

    if (this.phase === 'stalled') {
      this.stallTimer -= dt;
      this.hooks.onPrompt?.(); // the countdown is live
      if (this.stallTimer <= 0) {
        // Hull zero stalls the ship, it does not destroy it. A five second
        // lockout keeps the pressure on without ending the session, which is
        // what protoype.md found beats an outright loss.
        this.stallTimer = 0;
        this.hull = this.cfg.maxHull;
        this.phase = 'racing';
        // Order matters: the floor is zero while the phase is still 'stalled'.
        this.speed = this.speedFloor;
        this.hooks.onRecover?.();
        this.hooks.onPrompt?.();
      }
      return;
    }

    // Continuous half-life decay down to the cruise floor. The floor is zero
    // before launch, so a cold ship still sits perfectly still on the pad, and
    // EPS is what makes that a real zero rather than an ever-smaller number.
    const k = Math.LN2 / this.cfg.halfLife;
    this.speed = Math.max(this.speedFloor, this.speed * Math.exp(-k * dt));
    if (this.speed < EPS) this.speed = 0;

    // Progress is purely the integral of speed over time. Typing never moves the
    // ship directly: any version where it did made typing feel like it teleported
    // the rocket, which kills the decay mechanic entirely.
    this.progress = Math.min(1, this.progress + (this.speed * dt) / this.cfg.raceDistance);

    if (this.progress >= 1) {
      this.phase = 'finished';
      this.hooks.onFinish?.();
    }
  }

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------

  /** Progress renormalised over the atmosphere window: 0 on the pad, 1 in space. */
  get atmo(): number {
    return Math.max(0, Math.min(1, this.progress / ATMO_END));
  }

  /**
   * The speed decay bottoms out at right now.
   *
   * Zero only in the three states where the ship is meant to be dead in the water:
   * cold on the pad, locked out by a hull breach, and after the finish. Anywhere
   * else it is `minSpeed`, so the run never comes to a complete halt mid-race.
   */
  get speedFloor(): number {
    if (!this.launched || this.phase !== 'racing') return 0;
    return Math.min(this.cfg.minSpeed, this.cfg.maxSpeed);
  }

  get speedRatio(): number {
    return Math.max(0, Math.min(1, this.speed / this.cfg.maxSpeed));
  }

  /** Thruster tier 0..4, mapped from speed. Only meaningful when speed > 0. */
  get tier(): number {
    return Math.min(TIER_LEN.length - 1, Math.floor(this.speedRatio * TIER_LEN.length));
  }

  /** Ignition strength, 1 at the moment of launch decaying to 0. */
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
    // Shortening it mid-stall has to cut the running countdown too, otherwise
    // you sit watching a timer tick down from longer than the setting says.
    if (this.stallTimer > v) this.stallTimer = v;
  }
}
