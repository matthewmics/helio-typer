import type { Net } from '../net';
import type { Race } from '../shared/race';

interface Knob {
  label: string;
  min: number;
  max: number;
  step: number;
  get: () => number;
  set: (v: number) => void;
  fmt?: (v: number) => string;
}

/**
 * The dev panel, in two halves.
 *
 * The physics half mirrors the single player prototype's panel. The netcode half
 * is the reason this playground exists: latency, jitter, loss, snapshot rate and
 * interpolation are all live, so the claims in section 4.9 of the rating doc can
 * be checked rather than believed.
 *
 * The most instructive sequence, and worth putting in front of anyone evaluating
 * this: set latency to 150ms, then toggle interpolation off. Your own rocket does
 * not change at all, because local input never touches the network. Every other
 * rocket starts teleporting.
 */
export class DevPanel {
  private _root: HTMLElement;
  private _net: Net;
  private _race: Race;
  private _readout: HTMLElement;

  constructor(net: Net, race: Race) {
    this._net = net;
    this._race = race;
    this._root = document.getElementById('dev')!;
    this._readout = document.createElement('div');
    this._readout.className = 'readout';
    this._build();
  }

  private _build(): void {
    this._root.appendChild(this._section('Network', [
      {
        label: 'Latency', min: 0, max: 400, step: 5,
        get: () => this._net.net.latencyMs,
        set: (v) => this._net.tune({ net: { latencyMs: v } }),
        fmt: (v) => `${v} ms`,
      },
      {
        label: 'Jitter', min: 0, max: 150, step: 5,
        get: () => this._net.net.jitterMs,
        set: (v) => this._net.tune({ net: { jitterMs: v } }),
        fmt: (v) => `+/- ${v} ms`,
      },
      {
        label: 'Packet loss', min: 0, max: 0.3, step: 0.01,
        get: () => this._net.net.packetLoss,
        set: (v) => this._net.tune({ net: { packetLoss: v } }),
        fmt: (v) => `${Math.round(v * 100)}%`,
      },
      {
        label: 'Snapshot rate', min: 2, max: 60, step: 1,
        get: () => this._net.net.snapshotHz,
        set: (v) => this._net.tune({ net: { snapshotHz: v } }),
        fmt: (v) => `${v} Hz`,
      },
      {
        label: 'Client send rate', min: 2, max: 60, step: 1,
        get: () => this._net.net.clientSendHz,
        set: (v) => this._net.tune({ net: { clientSendHz: v } }),
        fmt: (v) => `${v} Hz`,
      },
      {
        label: 'Interp delay', min: 0, max: 400, step: 5,
        get: () => this._net.net.interpDelayMs,
        set: (v) => this._net.tune({ net: { interpDelayMs: v } }),
        fmt: (v) => `${v} ms`,
      },
    ]));

    const toggle = document.createElement('label');
    toggle.className = 'toggle';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = this._net.net.interpolate;
    cb.onchange = () => this._net.tune({ net: { interpolate: cb.checked } });
    toggle.appendChild(cb);
    toggle.appendChild(document.createTextNode('Interpolate remote pilots'));
    this._root.appendChild(toggle);

    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Try latency 150ms with this off. Your rocket is unaffected, everyone else teleports.';
    this._root.appendChild(hint);

    this._root.appendChild(this._section('Bots', [
      {
        label: 'Bot count', min: 0, max: 5, step: 1,
        get: () => 4,
        set: (v) => this._net.tune({ bots: { count: v } }),
        fmt: (v) => String(v),
      },
      {
        label: 'Bot WPM min', min: 10, max: 150, step: 5,
        get: () => 35,
        set: (v) => this._net.tune({ bots: { wpmMin: v } }),
      },
      {
        label: 'Bot WPM max', min: 10, max: 200, step: 5,
        get: () => 95,
        set: (v) => this._net.tune({ bots: { wpmMax: v } }),
      },
      {
        label: 'Bot error rate', min: 0, max: 0.15, step: 0.005,
        get: () => 0.02,
        set: (v) => this._net.tune({ bots: { errorRate: v } }),
        fmt: (v) => `${(v * 100).toFixed(1)}%`,
      },
    ]));

    this._root.appendChild(this._section('Physics', [
      {
        label: 'Accel', min: 0.01, max: 0.3, step: 0.01,
        get: () => this._race.cfg.accel,
        set: (v) => { this._race.cfg.accel = v; this._net.tune({ config: { accel: v } }); },
        fmt: (v) => v.toFixed(2),
      },
      {
        label: 'Half life', min: 0.3, max: 5, step: 0.1,
        get: () => this._race.cfg.halfLife,
        set: (v) => { this._race.cfg.halfLife = v; this._net.tune({ config: { halfLife: v } }); },
        fmt: (v) => `${v.toFixed(1)} s`,
      },
      {
        label: 'Hull', min: 1, max: 10, step: 1,
        get: () => this._race.cfg.maxHull,
        set: (v) => { this._race.setMaxHull(v); this._net.tune({ config: { maxHull: v } }); },
      },
      {
        label: 'Stall', min: 1, max: 12, step: 0.5,
        get: () => this._race.cfg.stallDuration,
        set: (v) => { this._race.setStallDuration(v); this._net.tune({ config: { stallDuration: v } }); },
        fmt: (v) => `${v.toFixed(1)} s`,
      },
      {
        label: 'Race distance', min: 4, max: 60, step: 1,
        get: () => this._race.cfg.raceDistance,
        set: (v) => { this._race.cfg.raceDistance = v; this._net.tune({ config: { raceDistance: v } }); },
      },
      {
        label: 'Max speed', min: 0.3, max: 3, step: 0.05,
        get: () => this._race.cfg.maxSpeed,
        set: (v) => { this._race.setMaxSpeed(v); this._net.tune({ config: { maxSpeed: v } }); },
        fmt: (v) => v.toFixed(2),
      },
      {
        label: 'Min speed', min: 0, max: 0.6, step: 0.01,
        get: () => this._race.cfg.minSpeed,
        set: (v) => { this._race.cfg.minSpeed = v; this._net.tune({ config: { minSpeed: v } }); },
        fmt: (v) => v.toFixed(2),
      },
    ]));

    const btns = document.createElement('div');
    btns.className = 'btns';
    const restart = document.createElement('button');
    restart.textContent = 'End race + show results';
    restart.onclick = () => this._net.restart();
    btns.appendChild(restart);
    this._root.appendChild(btns);

    this._root.appendChild(this._readout);
  }

  private _section(title: string, knobs: Knob[]): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'section';
    const h = document.createElement('h4');
    h.textContent = title;
    wrap.appendChild(h);

    for (const k of knobs) {
      const row = document.createElement('div');
      row.className = 'knob';
      const lab = document.createElement('label');
      const val = document.createElement('b');
      const fmt = k.fmt ?? ((v: number) => String(v));
      lab.textContent = k.label;
      val.textContent = fmt(k.get());

      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(k.min);
      input.max = String(k.max);
      input.step = String(k.step);
      input.value = String(k.get());
      input.oninput = () => {
        const v = parseFloat(input.value);
        k.set(v);
        val.textContent = fmt(v);
      };

      const head = document.createElement('div');
      head.className = 'knob-head';
      head.appendChild(lab);
      head.appendChild(val);
      row.appendChild(head);
      row.appendChild(input);
      wrap.appendChild(row);
    }
    return wrap;
  }

  /** Live stats, so the effect of a knob is visible without reading the code. */
  update(): void {
    const remote = [...this._net.tracks.keys()].filter((id) => id !== this._net.playerId);
    const depth = remote.length ? this._net.bufferDepth(remote[0]) : 0;
    this._readout.innerHTML = `
      <div><span>Simulated ping</span><b>${Math.round(this._net.pingMs)} ms</b></div>
      <div><span>Snapshot buffer</span><b>${depth}</b></div>
      <div><span>Your WPM (local)</span><b>${this._race.wpm}</b></div>
      <div><span>Pilots</span><b>${this._net.tracks.size}</b></div>`;
  }
}
