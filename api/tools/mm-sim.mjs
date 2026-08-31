// Matchmaking simulation harness. Drives real socket.io clients against one or
// two running api instances and prints every event with a timestamp.
import { io } from 'socket.io-client';

const T0 = Date.now();
const ts = () => `${String(((Date.now() - T0) / 1000).toFixed(1)).padStart(5)}s`;

function pilot(label, url, behaviour) {
  const sock = io(url, { transports: ['websocket'] });
  const log = (...a) => console.log(`${ts()} [${label}]`, ...a);
  const state = { label, sock, log, identity: null, matchId: null, events: [] };

  sock.on('connect', () => log(`connected to ${url}`));
  sock.on('guest:identity', (m) => {
    state.identity = m;
    state.events.push('identity');
    log(`identity: ${m.name} (${m.guestId.slice(0, 8)})`);
  });
  sock.on('queue:status', (m) => {
    if (m.state === 'queued' && !state.queuedLogged) {
      state.queuedLogged = true;
      log(`queued, position ${m.position} of ${m.waiting}`);
    }
  });
  sock.on('match:found', (m) => {
    state.matchId = m.matchId;
    state.events.push('found');
    const bots = m.pilots.filter((p) => p.bot).length;
    log(
      `MATCH FOUND ${m.matchId.slice(0, 8)}: ${m.pilots.length - bots} guests + ${bots} bots, ` +
        `${m.accepted}/${m.total} accepted, ${((m.deadline - m.now) / 1000).toFixed(0)}s to answer`,
    );
    log(`  roster: ${m.pilots.map((p) => `${p.name}${p.bot ? '(bot)' : ''}`).join(', ')}`);
    behaviour(state, m);
  });
  sock.on('match:progress', (m) => {
    state.events.push('progress');
    log(`progress ${m.accepted}/${m.total} accepted`);
  });
  sock.on('match:confirmed', (m) => {
    state.events.push('confirmed');
    log(`CONFIRMED ${m.matchId.slice(0, 8)}, seed ${m.seed}, ${m.pilots.length} pilots`);
  });
  sock.on('match:failed', (m) => {
    state.events.push(`failed:${m.reason}`);
    log(`FAILED ${m.matchId.slice(0, 8)} reason=${m.reason} requeued=${m.requeued}`);
  });

  return state;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const accept = (s, m) => setTimeout(() => s.sock.emit('ready:accept', { matchId: m.matchId }), 300);
const decline = (s, m) => setTimeout(() => s.sock.emit('ready:decline', { matchId: m.matchId }), 300);
const ignore = () => {};

// Defaults to the dockerised api behind Traefik, which is how this project runs
// normally, so the common scenarios need no configuration at all.
const A = process.env.A ?? 'http://api.heliotyper.local';
const B = process.env.B ?? 'http://localhost:3001';
const scenario = process.argv[2];

async function run() {
  if (scenario === 'solo') {
    console.log('=== solo guest: expect bots to fill after 10s, then confirm ===');
    const p = pilot('guest1', A, accept);
    await sleep(500);
    p.sock.emit('queue:join');
    await sleep(14000);
    p.sock.close();
    return p.events;
  }

  if (scenario === 'decline') {
    console.log('=== two guests, one declines: expect the other to be requeued ===');
    const p1 = pilot('accepter', A, accept);
    const p2 = pilot('decliner', A, decline);
    await sleep(500);
    p1.sock.emit('queue:join');
    p2.sock.emit('queue:join');
    await sleep(14000);
    p1.sock.close();
    p2.sock.close();
    return [...p1.events, ...p2.events];
  }

  if (scenario === 'timeout') {
    console.log('=== guest ignores the prompt: expect timeout after 15s, not requeued ===');
    const p = pilot('afk', A, ignore);
    await sleep(500);
    p.sock.emit('queue:join');
    await sleep(29000);
    p.sock.close();
    return p.events;
  }

  if (scenario === 'cluster') {
    console.log('=== two guests on two instances: expect one shared match ===');
    const p1 = pilot('on-3000', A, accept);
    const p2 = pilot('on-3001', B, accept);
    await sleep(500);
    p1.sock.emit('queue:join');
    p2.sock.emit('queue:join');
    await sleep(14000);
    p1.sock.close();
    p2.sock.close();
    return [...p1.events, ...p2.events];
  }

  throw new Error(`unknown scenario: ${scenario}`);
}

run().then(
  (events) => {
    console.log(`${ts()} events: ${JSON.stringify(events)}`);
    process.exit(0);
  },
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
