import { RUN } from '../config';
import type { Race } from '../race';
import { ROCKETS, type RocketId } from '../resources';

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id} in index.html`);
  return node as T;
}

export interface HudCallbacks {
  onRestart: () => void;
  onRocketChange: (id: RocketId) => void;
}

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
  private readonly _stallTimer = el('stallTimer');
  private readonly _statWpm = el('statWpm');
  private readonly _statAcc = el('statAcc');
  private readonly _statDist = el('statDist');
  private readonly _railMarker = el('railMarker');
  private readonly _rail = el('rail');
  private readonly _endScreen = el('endScreen');
  private readonly _endTitle = el('endTitle');
  private readonly _endStats = el('endStats');
  private readonly _hint = el('hint');

  private readonly _ticks: { at: number; node: HTMLElement }[] = [];
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
    }
  }

  private _bindDevPanel(callbacks: HudCallbacks): void {
    const select = el<HTMLSelectElement>('selRocket');
    for (const rocket of ROCKETS) {
      const option = document.createElement('option');
      option.value = rocket.id;
      option.textContent = rocket.label;
      select.appendChild(option);
    }
    select.addEventListener('change', () => callbacks.onRocketChange(select.value as RocketId));

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
      input.addEventListener('input', handle);
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

    el('btnRestart').addEventListener('click', callbacks.onRestart);
    el('btnPlayAgain').addEventListener('click', callbacks.onRestart);
  }

  // -------------------------------------------------------------------------

  /**
   * Retire the pre-launch instruction once the player has clearly read it.
   * It also sits where a two-line sentence wants to go, so it has to leave.
   */
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
      // The sentence stays exactly where it was, greyed out. Nothing is rebuilt:
      // the stall calls this every frame to run the countdown, and re-rendering
      // the spans each time would restart the arc animations mid-flicker.
      this._prompt.classList.add('stalled');
      this._stallTimer.textContent = `${Math.max(0, race.stallTimer).toFixed(1)}s`;
      return;
    }

    this._prompt.classList.remove('stalled');

    const sentence = race.sentence;
    let html = '';
    for (let i = 0; i < sentence.length; i++) {
      const cls = i < race.typedIndex ? 'correct' : i === race.typedIndex ? 'current' : 'pending';
      // A real space, not &nbsp;: a non-breaking space gives the browser no
      // valid break point anywhere in the sentence, so overflow-wrap:break-word
      // has no choice but to break mid-word once a line fills up.
      html += `<span class="ch ${cls}">${escapeHtml(sentence[i])}</span>`;
    }
    this._promptText.innerHTML = html;
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

  showEnd(): void {
    const race = this._race;
    this._endTitle.textContent = 'You crossed the heliopause';
    this._endStats.innerHTML =
      `Hull remaining: ${race.hull}/${race.cfg.maxHull} &nbsp;•&nbsp; ` +
      `WPM: ${race.wpm} &nbsp;•&nbsp; Accuracy: ${race.accuracy}% &nbsp;•&nbsp; ` +
      `Time: ${race.elapsed.toFixed(1)}s`;
    this._endScreen.classList.add('show');
  }

  hideEnd(): void {
    this._endScreen.classList.remove('show');
    this._prompt.classList.remove('flash', 'stalled');
    this._flashT = 0;
    this._showHint();
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
