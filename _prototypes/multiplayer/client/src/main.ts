import { Color, DisplayMode, Engine } from 'excalibur';
import { Net } from './net';
import { Race } from './shared/race';
import { RaceScene } from './scenes/RaceScene';
import { DevPanel } from './ui/devpanel';
import type { ResultsMsg } from './shared/protocol';

const name = new URLSearchParams(location.search).get('name') ?? `pilot-${Math.floor(Math.random() * 900 + 100)}`;
const url = import.meta.env.VITE_SERVER_URL ?? `http://${location.hostname}:3001`;

const net = new Net(url, name);
// Seeded from 0 until `welcome` lands with the server's seed. The race is
// unplayable for that first moment anyway, since the lobby has not been drawn.
const race = new Race(0, {
  onLaunch: () => net.sendEvent('launch'),
  onMistake: () => net.sendEvent('mistake'),
  onBreach: () => net.sendEvent('breach'),
  onRecover: () => net.sendEvent('recover'),
  onFinish: () => net.sendEvent('finish'),
  onPrompt: () => renderPrompt(),
});

const engine = new Engine({
  canvasElementId: 'game',
  resolution: { width: 1280, height: 720 },
  displayMode: DisplayMode.FitContainer,
  backgroundColor: Color.fromHex('#05060a'),
  antialiasing: true,
  suppressPlayButton: true,
  suppressConsoleBootMessage: true,
});

const scene = new RaceScene(net, race, renderPrompt);
engine.addScene('race', scene);

const panel = new DevPanel(net, race);
const promptEl = document.getElementById('prompt')!;
const resultsEl = document.getElementById('results')!;

// ---------------------------------------------------------------------------
// Input: local first, always
// ---------------------------------------------------------------------------

/**
 * The keystroke path, and the single most important thing in this prototype.
 *
 * `race.typeKey` runs synchronously, right here, on the keydown event. The
 * character is coloured, hull is decremented, speed changes, and the frame that
 * follows already reflects it. Only after that does anything go near the socket,
 * and what goes is a queued log entry that nothing is waiting on.
 *
 * At 100+ WPM a key lands roughly every 120ms. A round trip on a real connection
 * is 30-80ms. Putting the network in this path would be felt immediately by
 * exactly the players most likely to notice.
 */
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
  e.preventDefault();

  const i = race.typedIndex;
  const expected = race.sentence[i] ?? '';
  race.typeKey(e.key);
  net.queueKey({ i, expected, got: e.key, t: Date.now() });
});

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function renderPrompt(): void {
  if (race.phase === 'stalled') {
    promptEl.className = 'stalled';
    promptEl.innerHTML =
      `<div class="stall-chip">HULL BREACH &middot; ${race.stallTimer.toFixed(1)}s</div>` +
      `<span class="dead">${escapeHtml(race.sentence)}</span>`;
    return;
  }
  promptEl.className = '';
  const s = race.sentence;
  promptEl.innerHTML =
    `<span class="done">${escapeHtml(s.slice(0, race.typedIndex))}</span>` +
    `<span class="cur">${escapeHtml(s[race.typedIndex] ?? '')}</span>` +
    `<span class="todo">${escapeHtml(s.slice(race.typedIndex + 1))}</span>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

net.onResults = (r: ResultsMsg) => {
  resultsEl.style.display = 'block';
  resultsEl.innerHTML =
    `<h3>Results</h3><p class="sub">Server WPM is derived by replaying each pilot's keystroke log. Client WPM is what their browser was displaying. They should agree, and the point is that the server never had to trust the second one.</p>` +
    `<table><thead><tr><th>#</th><th>Pilot</th><th>Time</th><th>Server WPM</th><th>Client WPM</th><th>Acc</th></tr></thead><tbody>` +
    r.rows
      .map(
        (row) => `<tr class="${row.id === net.playerId ? 'me' : ''}">
        <td>${row.dnf ? 'DNF' : row.placement}</td>
        <td>${escapeHtml(row.name)}${row.isBot ? ' <i>bot</i>' : ''}</td>
        <td>${row.completionMs === null ? `<i>${Math.round(row.progress * 100)}% of the way</i>` : (row.completionMs / 1000).toFixed(1) + 's'}</td>
        <td><b>${row.serverWpm}</b></td>
        <td>${row.clientWpm}</td>
        <td>${row.accuracy}%</td>
      </tr>`,
      )
      .join('') +
    `</tbody></table>`;
};

net.onStart = (seed) => {
  resultsEl.style.display = 'none';
  race.reset(seed);
  renderPrompt();
};

// Remote pilots' one-shot events feed the scene's flash effects.
const origLobby = net.onLobby;
net.onLobby = (pilots) => {
  origLobby?.(pilots);
  document.getElementById('you')!.textContent = name;
};

// ---------------------------------------------------------------------------
// Frame loop for the non-Excalibur pieces
// ---------------------------------------------------------------------------

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;

  // The local pilot's own physics. Deliberately driven here and not by anything
  // the server sends: this simulation is the source of truth for what the player
  // sees, and the server is told about it afterwards.
  race.update(dt);

  net.update(dt, () => ({
    t: Date.now(),
    progress: race.progress,
    speed: race.speed,
    tier: race.tier,
    hull: race.hull,
    phase: race.phase,
    wpm: race.wpm,
    stallTimer: race.stallTimer,
  }));

  for (const [id, track] of net.tracks) {
    if (track.flash) {
      scene.flash(id, track.flash.kind);
      track.flash = null;
    }
  }

  panel.update();
  requestAnimationFrame(frame);
}

void engine.start('race').then(() => {
  renderPrompt();
  requestAnimationFrame(frame);
});
