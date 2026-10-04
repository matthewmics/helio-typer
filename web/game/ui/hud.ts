import { KUIPER, RUN } from '../config';
import type { Race } from '@heliotyper/engine';
import { ROCKETS, type RocketId } from '../resources';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id} in the HUD markup`);
  return node as T;
}

/**
 * Characters always laid out past the cursor. A few lines' worth at the
 * prompt's widest, so the two lines showing under the one being typed are
 * always full.
 */
const READ_AHEAD = 300;

/** For HUD parts that are allowed to be absent, notably the dev panel. */
function maybe<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

export interface HudCallbacks {
  onRestart: () => void;
  onRocketChange: (id: RocketId) => void;
}

/** What the start overlay says: who the race still waits for, then the count. */
export type StartState =
  | { kind: 'waiting'; joined: number; humans: number }
  | { kind: 'count'; seconds: number }
  | { kind: 'go' }
  | { kind: 'off' };

/**
 * The DOM half of the game.
 *
 * The prompt, stats and dev panel stay as HTML rather than moving into the canvas.
 * Text this size is sharper in DOM, it reflows for free, and it stays selectable
 * and inspectable. Only things attached to the ship itself (its name tag, hull and
 * speed bars) are drawn in the scene, because those have to travel with it.
 */
export class Hud {
  private readonly _prompt = el('promptBox');
  private readonly _promptText = el('promptText');
  /** One span per character of the looped passage, laid out a lap at a time. */
  private _chars: HTMLElement[] = [];
  /** The index the passage was last coloured up to, or -1 for not yet. */
  private _painted = -1;
  /** How far the passage is scrolled: the top of the line being typed. */
  private _lineTop = 0;
  private readonly _stallTimer = el('stallTimer');
  private readonly _statWpm = el('statWpm');
  private readonly _statAcc = el('statAcc');
  private readonly _statDist = el('statDist');
  private readonly _railMarker = el('railMarker');
  private readonly _rail = el('rail');
  private readonly _hint = el('hint');
  private readonly _start = el('startOverlay');
  private readonly _startCount = el('startCount');
  private readonly _startNote = el('startNote');
  /** What the start overlay last showed, so a frame that changes nothing writes nothing. */
  private _startKey = '';

  private readonly _ticks: { at: number; node: HTMLElement }[] = [];
  /** One rail dot per other pilot, keyed by pilot id. */
  private readonly _pilots = new Map<string, HTMLElement>();
  /** Nodes this HUD added to markup it does not own, taken out again by {@link dispose}. */
  private readonly _added: HTMLElement[] = [];
  /** Aborting this detaches every listener the HUD attached. */
  private readonly _listeners = new AbortController();
  private _flashT = 0;

  constructor(
    private readonly _race: Race,
    callbacks: HudCallbacks,
  ) {
    this._buildRail();
    this._bindDevPanel(callbacks);
    this.renderPrompt();
  }

  /** One tick per body, so the run reads as legs rather than one long bar. */
  private _buildRail(): void {
    for (const leg of RUN) {
      const node = document.createElement('div');
      node.className = 'tick';
      node.style.bottom = `${leg.at * 100}%`;
      const label = document.createElement('span');
      label.textContent = leg.body;
      node.appendChild(label);
      this._rail.appendChild(node);
      this._ticks.push({ at: leg.at, node });
      this._added.push(node);
    }

    // The Kuiper belt is a stretch of the run rather than a point on it, so it
    // gets a band beside the rail instead of a tick. It goes in first so the
    // ticks and every marker draw over it.
    const span = KUIPER.to - KUIPER.from;
    const belt = document.createElement('div');
    belt.className = 'belt';
    belt.style.bottom = `${KUIPER.from * 100}%`;
    belt.style.height = `${span * 100}%`;
    const label = document.createElement('span');
    label.textContent = 'kuiper belt';
    label.style.bottom = `${((KUIPER.labelAt - KUIPER.from) / span) * 100}%`;
    belt.appendChild(label);
    this._rail.prepend(belt);
    this._ticks.push({ at: KUIPER.from, node: belt });
    this._added.push(belt);
  }

  /**
   * A dot on the rail for every other pilot.
   *
   * The field draws to the same scale as the scenery, so anyone more than a few
   * percent ahead or behind is off screen, and this is then the only place they
   * show. Hidden until a pilot's first state arrives, like their rocket.
   */
  addPilots(ids: readonly string[]): void {
    for (const id of ids) {
      const node = document.createElement('div');
      node.className = 'pilot';
      node.hidden = true;
      // Ahead of your own marker in the DOM, so yours always draws on top.
      this._rail.insertBefore(node, this._railMarker);
      this._pilots.set(id, node);
      this._added.push(node);
    }
  }

  /** Move a pilot's rail dot, or hide it while nothing has arrived for them. */
  placePilot(id: string, progress: number | null): void {
    const node = this._pilots.get(id);
    if (!node) return;
    node.hidden = progress === null;
    if (progress !== null) node.style.bottom = `${progress * 100}%`;
  }

  /**
   * Wire the dev panel, if this page has one.
   *
   * rules/game-presentation.md is explicit that the tunable physics block is a
   * development affordance and not a shipping feature, so the player-facing page
   * simply omits the markup. Everything here is therefore optional, and the HUD
   * has to work with none of it present.
   */
  private _bindDevPanel(callbacks: HudCallbacks): void {
    const { signal } = this._listeners;

    const select = maybe<HTMLSelectElement>('selRocket');
    if (!select) return;
    for (const rocket of ROCKETS) {
      const option = document.createElement('option');
      option.value = rocket.id;
      option.textContent = rocket.label;
      select.appendChild(option);
      this._added.push(option);
    }
    select.addEventListener('change', () => callbacks.onRocketChange(select.value as RocketId), { signal });

    const slider = (
      inputId: string,
      valueId: string,
      apply: (v: number) => void,
      format: (v: number) => string,
    ) => {
      const input = el<HTMLInputElement>(inputId);
      const readout = el(valueId);
      const handle = () => {
        const v = parseFloat(input.value);
        apply(v);
        readout.textContent = format(v);
      };
      input.addEventListener('input', handle, { signal });
      handle();
    };

    const cfg = this._race.cfg;
    slider('sAccel', 'vAccel', (v) => (cfg.accel = v), (v) => v.toFixed(2));
    slider('sHalf', 'vHalf', (v) => (cfg.halfLife = v), (v) => v.toFixed(1));
    slider('sHull', 'vHull', (v) => this._race.setMaxHull(v), (v) => String(v));
    slider('sStall', 'vStall', (v) => this._race.setStallDuration(v), (v) => v.toFixed(1));
    slider('sDist', 'vDist', (v) => (cfg.raceDistance = v), (v) => String(v));
    slider('sMaxSpeed', 'vMaxSpeed', (v) => this._race.setMaxSpeed(v), (v) => v.toFixed(2));
    slider('sMinSpeed', 'vMinSpeed', (v) => (cfg.minSpeed = v), (v) => v.toFixed(2));

    el('btnRestart').addEventListener('click', callbacks.onRestart, { signal });
  }

  /**
   * Hand the markup back the way it was found.
   *
   * The nodes belong to React and outlive this HUD. A remount builds a new HUD on
   * the very same elements, so anything left behind here would be doubled up: a
   * second set of rail ticks, or a Play again button that also restarts a race
   * that no longer exists.
   */
  dispose(): void {
    this._listeners.abort();
    for (const node of this._added) node.remove();
    this.reset();
    this.showStart({ kind: 'off' });
  }

  // -------------------------------------------------------------------------

  /** Retire the pre-launch instruction once the player has clearly read it. */
  hideHint(): void {
    this._hint.style.display = 'none';
  }

  private _showHint(): void {
    this._hint.style.display = '';
  }

  /** Flash the prompt red for a moment. */
  flash(): void {
    this._flashT = 0.18;
    this._prompt.classList.add('flash');
  }

  renderPrompt(): void {
    const race = this._race;

    if (race.phase === 'stalled') {
      // The passage stays exactly where it was, greyed out. Nothing is rebuilt:
      // the stall calls this every frame to run the countdown, and re-rendering
      // the spans each time would restart the arc animations mid-flicker.
      this._prompt.classList.add('stalled');
      this._stallTimer.textContent = `${Math.max(0, race.stallTimer).toFixed(1)}s`;
      return;
    }

    this._prompt.classList.remove('stalled');

    this._layOut(race.typedIndex);
    this._paint(race.typedIndex);
    this._follow();
  }

  /**
   * Lay the passage out a lap at a time, one span per character, keeping at
   * least {@link READ_AHEAD} characters past the cursor. A run that outlasts
   * the passage carries straight on into the next lap below it, so the lines
   * under the one being typed are never empty and the text never jumps back
   * to the top. Keystrokes in between only recolour what they changed, rather
   * than rebuilding hundreds of spans twenty times a second.
   */
  private _layOut(index: number): void {
    if (this._chars.length > index + READ_AHEAD) return;

    const lap = this._race.lap;
    let html = '';
    let count = this._chars.length;
    while (count <= index + READ_AHEAD) {
      for (const ch of lap) {
        // A real space, not &nbsp;: a non-breaking space gives the browser no
        // valid break point anywhere in the passage, so overflow-wrap:break-word
        // has no choice but to break mid-word once a line fills up.
        html += `<span class="ch pending">${escapeHtml(ch)}</span>`;
      }
      count += lap.length;
    }

    // A fresh HUD replaces whatever an earlier one on this markup left behind.
    if (this._chars.length === 0) this._promptText.innerHTML = html;
    else this._promptText.insertAdjacentHTML('beforeend', html);
    this._chars = [...this._promptText.children] as HTMLElement[];
  }

  /** Colour the text up to `index`, touching only what changed since the last call. */
  private _paint(index: number): void {
    const chars = this._chars;
    if (this._painted < 0 || index < this._painted) {
      // The first paint, or a restart: everything changes.
      chars.forEach((span, i) => {
        span.className = `ch ${i < index ? 'correct' : i === index ? 'current' : 'pending'}`;
      });
    } else {
      for (let i = this._painted; i < index; i++) chars[i].className = 'ch correct';
      if (chars[index]) chars[index].className = 'ch current';
    }
    this._painted = index;
  }

  /**
   * Keep the line being typed at the top of the window, with the next two
   * showing under it. Moves only when the cursor lands on a new line, and then
   * by exactly one line, which the stylesheet eases.
   */
  private _follow(): void {
    const current = this._chars[this._painted];
    if (!current) return;
    const top = current.offsetTop;
    if (top === this._lineTop) return;
    this._lineTop = top;
    this._promptText.style.transform = `translateY(${-top}px)`;
  }

  update(dt: number): void {
    if (this._flashT > 0) {
      this._flashT = Math.max(0, this._flashT - dt);
      if (this._flashT === 0) this._prompt.classList.remove('flash');
    }

    const race = this._race;
    this._statWpm.textContent = String(race.wpm);
    this._statAcc.textContent = `${race.accuracy}%`;
    this._statDist.textContent = `${Math.round(race.progress * 100)}%`;
    this._railMarker.style.bottom = `${race.progress * 100}%`;

    for (const tick of this._ticks) {
      tick.node.classList.toggle('passed', race.progress >= tick.at);
    }
  }

  /** Back to how a fresh run looks. The results themselves are React's, not the HUD's. */
  reset(): void {
    this._prompt.classList.remove('flash', 'stalled');
    this._flashT = 0;
    // A restart goes back to the top of the passage.
    this._painted = -1;
    this._lineTop = 0;
    this._promptText.style.transform = '';
    this._showHint();
  }

  /**
   * The start overlay: how many pilots the race is still waiting for, then
   * 3, 2, 1, GO. Called every frame, so it only touches the DOM on a change.
   */
  showStart(state: StartState): void {
    const key =
      state.kind === 'waiting'
        ? `waiting:${state.joined}/${state.humans}`
        : state.kind === 'count'
          ? `count:${state.seconds}`
          : state.kind;
    if (key === this._startKey) return;
    this._startKey = key;
    this._start.dataset.state = state.kind;

    switch (state.kind) {
      case 'waiting': {
        const missing = Math.max(0, state.humans - state.joined);
        this._startCount.textContent = '';
        this._startNote.textContent =
          missing > 0
            ? `Waiting for ${missing} more pilot${missing === 1 ? '' : 's'} · ` +
              `${state.joined} of ${state.humans} connected`
            : 'Everyone is in';
        return;
      }
      case 'count':
        this._startCount.textContent = String(state.seconds);
        this._startNote.textContent = 'Get ready';
        break;
      case 'go':
        this._startCount.textContent = 'GO';
        this._startNote.textContent = '';
        break;
      case 'off':
        this._startCount.textContent = '';
        this._startNote.textContent = '';
        return;
    }

    // Restart the pop on every new number. Changing the text alone would not
    // replay an animation that has already run.
    this._startCount.classList.remove('pop');
    void this._startCount.offsetWidth;
    this._startCount.classList.add('pop');
  }
}

function escapeHtml(ch: string): string {
  switch (ch) {
    case '&':
      return '&amp;';
    case '<':
      return '&lt;';
    case '>':
      return '&gt;';
    default:
      return ch;
  }
}
