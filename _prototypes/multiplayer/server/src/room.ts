import { BotPilot } from './bot';
import { DEFAULT_BOTS, DEFAULT_CONFIG, DEFAULT_NET, MAX_PLAYERS, type BotConfig, type NetConfig, type RaceConfig } from './shared/config';
import { makeRng } from './shared/text';
import type { KeyEvent, PilotInfo, PilotStateMsg, ResultRow, SnapshotMsg } from './shared/protocol';

interface HumanPilot {
  id: string;
  name: string;
  lane: number;
  /** Latest state from flow 1. Cosmetic, relayed to everyone, never scored. */
  state: PilotStateMsg | null;
  /** Accumulated flow 3 log. This is what gets replayed for the result. */
  keys: KeyEvent[];
  finishedAt: number | null;
  joinedAt: number;
}

/**
 * One race: the humans in it, the bots filling it out, and the broadcast loop.
 *
 * The server holds a `Race` per bot but deliberately does NOT hold one per human.
 * Humans simulate locally (that is the whole point of section 4.9: input cannot
 * wait on a round trip) and report their state up. The server's job for a human is
 * to relay their cosmetic state to everyone else, and to bank their keystroke log
 * for the end-of-race replay.
 */
export class Room {
  readonly id = 'playground';
  seed = Math.floor(Math.random() * 1e9);

  config: RaceConfig = { ...DEFAULT_CONFIG };
  net: NetConfig = { ...DEFAULT_NET };
  botCfg: BotConfig = { ...DEFAULT_BOTS };

  humans = new Map<string, HumanPilot>();
  bots: BotPilot[] = [];

  startedAt: number | null = null;
  private _rng = makeRng(this.seed);

  // -------------------------------------------------------------------------
  // Membership
  // -------------------------------------------------------------------------

  addHuman(id: string, name: string): HumanPilot {
    const pilot: HumanPilot = {
      id,
      name,
      lane: 0,
      state: null,
      keys: [],
      finishedAt: null,
      joinedAt: Date.now(),
    };
    this.humans.set(id, pilot);
    this._relane();
    return pilot;
  }

  removeHuman(id: string): void {
    this.humans.delete(id);
    this._relane();
  }

  /**
   * Rebuild the bot roster so the lobby always totals MAX_PLAYERS.
   *
   * Called whenever a human joins or leaves, or the bot count is tuned, so the
   * field stays full without a human ever being pushed out.
   */
  syncBots(): void {
    const room = MAX_PLAYERS - this.humans.size;
    const want = Math.max(0, Math.min(this.botCfg.count, room));
    if (this.bots.length === want) return;

    if (this.bots.length > want) {
      this.bots.length = want;
    } else {
      const names = ['kernelpanic', 'orbital_ash', 'mizuchi', 'quietstorm', 'delta_vee', 'nullpointer', 'sable'];
      while (this.bots.length < want) {
        const n = this.bots.length;
        this.bots.push(new BotPilot(`bot-${n}`, names[n % names.length], this.seed, this.botCfg, this._rng));
      }
    }
    this._relane();
  }

  private _relane(): void {
    let lane = 0;
    for (const h of [...this.humans.values()].sort((a, b) => a.joinedAt - b.joinedAt)) h.lane = lane++;
  }

  roster(forId: string): PilotInfo[] {
    const out: PilotInfo[] = [];
    for (const h of this.humans.values()) {
      out.push({ id: h.id, name: h.name, isBot: false, isYou: h.id === forId, lane: h.lane });
    }
    this.bots.forEach((b, i) => {
      out.push({ id: b.id, name: b.name, isBot: true, isYou: false, lane: this.humans.size + i });
    });
    return out;
  }

  // -------------------------------------------------------------------------
  // Race lifecycle
  // -------------------------------------------------------------------------

  restart(): void {
    this.seed = Math.floor(Math.random() * 1e9);
    this._rng = makeRng(this.seed);
    this.startedAt = Date.now();
    for (const h of this.humans.values()) {
      h.state = null;
      h.keys = [];
      h.finishedAt = null;
    }
    // Rebuild bots from scratch so they pick up the new seed and any tuned
    // speed range, rather than continuing on the finished race's sequence.
    this.bots = [];
    this.syncBots();
  }

  /**
   * Advance every bot. Humans advance themselves, in their own browser.
   *
   * Idles while nobody is connected. Without this the bots race from the moment
   * the server boots, so the first human to open a tab joins a field that already
   * crossed the heliopause minutes ago, which is a confusing first impression and
   * not a state a real lobby could ever be in.
   */
  tick(dt: number): void {
    if (this.humans.size === 0) return;
    for (const b of this.bots) {
      // Bots must run the same physics the humans do, so config changes from the
      // dev panel have to reach their Race instances too.
      Object.assign(b.race.cfg, this.config);
      b.update(dt);
    }
  }

  snapshot(): SnapshotMsg {
    const pilots: Record<string, PilotStateMsg> = {};
    const t = Date.now();
    for (const h of this.humans.values()) if (h.state) pilots[h.id] = h.state;
    for (const b of this.bots) {
      pilots[b.id] = {
        t,
        progress: b.race.progress,
        speed: b.race.speed,
        tier: b.race.tier,
        hull: b.race.hull,
        phase: b.race.phase,
        wpm: b.race.wpm,
        stallTimer: b.race.stallTimer,
      };
    }
    return { t, pilots };
  }

  // -------------------------------------------------------------------------
  // Results
  // -------------------------------------------------------------------------

  /**
   * Derive the result from each pilot's keystroke log, not from the WPM their
   * client was showing.
   *
   * This is the payoff of flow 3 and the concrete meaning of "server-authoritative"
   * in the roadmap: the client is never asked "what was your WPM", it is asked
   * "what did you type and when", and the arithmetic happens here. The prototype
   * reports both numbers side by side so the difference is visible rather than
   * asserted.
   *
   * What this does NOT do is detect a fabricated log, which is exactly the gap
   * parked as out of scope in the rating doc's 4.7.
   */
  results(): ResultRow[] {
    const rows: ResultRow[] = [];

    for (const h of this.humans.values()) {
      const correct = h.keys.filter((k) => k.expected === k.got).length;
      const wrong = h.keys.length - correct;
      const span = h.keys.length > 1 ? h.keys[h.keys.length - 1].t - h.keys[0].t : 0;
      const minutes = span / 60000;
      rows.push({
        id: h.id,
        name: h.name,
        isBot: false,
        placement: 0,
        clientWpm: h.state?.wpm ?? 0,
        serverWpm: minutes > 0.0005 ? Math.round(correct / 5 / minutes) : 0,
        completionMs: h.finishedAt && this.startedAt ? h.finishedAt - this.startedAt : null,
        accuracy: h.keys.length ? Math.round((correct / h.keys.length) * 100) : 100,
        progress: h.state?.progress ?? 0,
        hullBreaches: wrong,
        dnf: h.finishedAt === null,
      });
    }

    for (const b of this.bots) {
      rows.push({
        id: b.id,
        name: b.name,
        isBot: true,
        placement: 0,
        clientWpm: b.race.wpm,
        serverWpm: b.race.wpm,
        // Wall clock, stalls included, not race.elapsed. See BotPilot.wallElapsed.
        completionMs: b.race.phase === 'finished' ? Math.round(b.wallElapsed * 1000) : null,
        accuracy: b.race.accuracy,
        progress: b.race.progress,
        hullBreaches: b.race.mistakes,
        dnf: b.race.phase !== 'finished',
      });
    }

    // Finishers by time, then everyone else. A DNF always sorts last, per the
    // rating doc: quitting is never a way to avoid a placement. Among DNFs,
    // distance covered breaks the tie, otherwise a pilot who never typed a
    // character outranks one who stalled out just short of the heliopause.
    rows.sort((a, b) => {
      if (a.dnf !== b.dnf) return a.dnf ? 1 : -1;
      if (a.dnf) return b.progress - a.progress;
      return (a.completionMs ?? Infinity) - (b.completionMs ?? Infinity);
    });
    rows.forEach((r, i) => (r.placement = i + 1));
    return rows;
  }
}
