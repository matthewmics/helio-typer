<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>UI Prototype — Typing Race</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#070912;
  --bg-2:#0d1122;
  --surface:#131832;
  --surface-2:#1a2043;
  --line:#262e58;
  --line-bright:#3a4580;
  --cyan:#4fd8ff;
  --cyan-dim:#1d5f77;
  --amber:#ffb84d;
  --pink:#ff4d84;
  --green:#4dffb4;
  --violet:#a678ff;
  --text:#e6e9f7;
  --text-dim:#828cb5;
  --text-dimmer:#5a6390;
}
*{box-sizing:border-box;}
html,body{margin:0;height:100%;}
body{
  background:var(--bg);
  color:var(--text);
  font-family:'JetBrains Mono',monospace;
  font-size:14px;
  overflow:hidden;
}
.d{font-family:'Chakra Petch',sans-serif;}

/* animated star backdrop */
#backdrop{position:fixed;inset:0;z-index:0;overflow:hidden;
  background:radial-gradient(ellipse at 50% 120%,#161d45 0%,var(--bg) 65%);}
.bstar{position:absolute;background:#fff;border-radius:50%;}
@keyframes twinkle{0%,100%{opacity:.15}50%{opacity:.7}}

#shell{position:relative;z-index:1;height:100vh;display:flex;flex-direction:column;}

/* ============ TOP BAR ============ */
#topbar{
  display:flex;align-items:center;gap:28px;
  padding:0 24px;height:60px;flex-shrink:0;
  border-bottom:1px solid var(--line);
  background:rgba(9,12,26,.86);backdrop-filter:blur(10px);
}
#brand{display:flex;align-items:center;gap:10px;cursor:pointer;}
#brand svg{width:22px;height:22px;}
#brand b{font-family:'Chakra Petch',sans-serif;font-size:1.05rem;letter-spacing:.16em;font-weight:700;}
#brand small{font-size:.55rem;color:var(--text-dimmer);letter-spacing:.2em;display:block;margin-top:-3px;}

nav{display:flex;gap:2px;margin-left:6px;}
nav button{
  background:none;border:none;color:var(--text-dim);cursor:pointer;
  font-family:'Chakra Petch',sans-serif;font-size:.78rem;font-weight:600;
  letter-spacing:.1em;text-transform:uppercase;padding:8px 14px;border-radius:6px;
  transition:.15s;
}
nav button:hover{color:var(--text);background:var(--surface);}
nav button.on{color:var(--cyan);background:rgba(79,216,255,.09);}

#topright{margin-left:auto;display:flex;align-items:center;gap:16px;}
.currency{display:flex;align-items:center;gap:6px;font-size:.8rem;font-weight:700;
  font-family:'Chakra Petch',sans-serif;padding:5px 11px;border-radius:20px;
  background:var(--surface);border:1px solid var(--line);}
.currency i{width:7px;height:7px;border-radius:50%;background:var(--amber);
  box-shadow:0 0 7px var(--amber);}
#avatar{display:flex;align-items:center;gap:9px;cursor:pointer;}
#avatar .pic{width:32px;height:32px;border-radius:8px;
  background:linear-gradient(135deg,var(--cyan),var(--violet));
  display:grid;place-items:center;font-weight:700;font-size:.8rem;color:#06121a;
  font-family:'Chakra Petch',sans-serif;}
#avatar .meta b{display:block;font-size:.76rem;font-family:'Chakra Petch',sans-serif;}
#avatar .meta span{font-size:.62rem;color:var(--text-dim);}

/* ============ VIEWS ============ */
main{flex:1;overflow-y:auto;padding:30px 24px 50px;}
.view{display:none;max-width:1180px;margin:0 auto;}
.view.on{display:block;animation:fade .3s ease;}
@keyframes fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

.eyebrow{font-family:'Chakra Petch',sans-serif;font-size:.64rem;letter-spacing:.2em;
  text-transform:uppercase;color:var(--cyan);margin:0 0 7px;font-weight:600;}
h1.page{font-family:'Chakra Petch',sans-serif;font-size:1.9rem;margin:0 0 6px;font-weight:700;letter-spacing:.01em;}
p.page-sub{color:var(--text-dim);margin:0 0 26px;font-size:.82rem;}

.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:22px;}
.card h3{font-family:'Chakra Petch',sans-serif;font-size:.72rem;letter-spacing:.14em;
  text-transform:uppercase;color:var(--text-dim);margin:0 0 16px;font-weight:600;}

/* ---- HOME ---- */
#home-grid{display:grid;grid-template-columns:1.55fr 1fr;gap:20px;align-items:start;}
@media(max-width:940px){#home-grid{grid-template-columns:1fr;}}

#hero{
  position:relative;overflow:hidden;border-radius:16px;
  border:1px solid var(--line-bright);padding:32px;
  background:
    radial-gradient(circle at 82% 18%,rgba(79,216,255,.18) 0%,transparent 48%),
    linear-gradient(150deg,var(--surface-2),var(--surface));
}
#hero h2{font-family:'Chakra Petch',sans-serif;font-size:2.1rem;margin:0 0 8px;
  line-height:1.1;font-weight:700;max-width:15ch;}
#hero p{color:var(--text-dim);margin:0 0 24px;font-size:.84rem;max-width:44ch;line-height:1.65;}
#hero .rocket-deco{position:absolute;right:26px;bottom:-14px;width:118px;opacity:.5;
  animation:float 5s ease-in-out infinite;}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-13px)}}

.btn{
  font-family:'Chakra Petch',sans-serif;font-weight:700;font-size:.85rem;letter-spacing:.05em;
  border:none;border-radius:9px;padding:14px 26px;cursor:pointer;transition:.14s;
  display:inline-flex;align-items:center;gap:9px;text-transform:uppercase;
}
.btn:active{transform:scale(.975);}
.btn-primary{background:var(--cyan);color:#04202a;box-shadow:0 4px 18px rgba(79,216,255,.28);}
.btn-primary:hover{filter:brightness(1.12);box-shadow:0 6px 24px rgba(79,216,255,.4);}
.btn-ghost{background:var(--surface-2);color:var(--text);border:1px solid var(--line-bright);}
.btn-ghost:hover{background:var(--line);}
.btn-sm{padding:9px 15px;font-size:.72rem;border-radius:7px;}
.btn-row{display:flex;gap:11px;flex-wrap:wrap;}

.mode-list{display:flex;flex-direction:column;gap:9px;}
.mode{
  display:flex;align-items:center;gap:14px;padding:14px 15px;border-radius:11px;
  background:var(--surface-2);border:1px solid var(--line);cursor:pointer;transition:.15s;
}
.mode:hover{border-color:var(--line-bright);transform:translateX(3px);}
.mode.sel{border-color:var(--cyan);background:rgba(79,216,255,.07);}
.mode .ico{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;flex-shrink:0;
  background:var(--surface);border:1px solid var(--line);font-size:.95rem;}
.mode b{font-family:'Chakra Petch',sans-serif;font-size:.85rem;display:block;margin-bottom:2px;}
.mode span{font-size:.68rem;color:var(--text-dim);line-height:1.4;}
.mode .tag{margin-left:auto;font-size:.58rem;padding:3px 8px;border-radius:20px;
  letter-spacing:.09em;text-transform:uppercase;font-weight:700;flex-shrink:0;
  font-family:'Chakra Petch',sans-serif;}
.tag-live{background:rgba(77,255,180,.14);color:var(--green);}
.tag-solo{background:rgba(166,120,255,.14);color:var(--violet);}
.tag-new{background:rgba(255,184,77,.14);color:var(--amber);}

.online-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--green);
  box-shadow:0 0 7px var(--green);margin-right:7px;animation:twinkle 2.4s infinite;}

/* quick stats strip */
#quickstats{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-top:20px;}
@media(max-width:640px){#quickstats{grid-template-columns:repeat(2,1fr);}}
.qs{background:var(--surface);border:1px solid var(--line);border-radius:11px;padding:14px 15px;}
.qs b{font-family:'Chakra Petch',sans-serif;font-size:1.5rem;display:block;line-height:1;margin-bottom:5px;}
.qs span{font-size:.62rem;color:var(--text-dim);letter-spacing:.09em;text-transform:uppercase;}
.qs.up b{color:var(--green);}

/* ---- HANGAR ---- */
#hangar-grid{display:grid;grid-template-columns:1fr 330px;gap:20px;align-items:start;}
@media(max-width:940px){#hangar-grid{grid-template-columns:1fr;}}
#ship-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:13px;}
.ship{
  position:relative;background:var(--surface);border:1px solid var(--line);
  border-radius:13px;padding:16px 13px 13px;cursor:pointer;transition:.16s;text-align:center;
}
.ship:hover{transform:translateY(-3px);border-color:var(--line-bright);}
.ship.sel{border-color:var(--cyan);background:rgba(79,216,255,.06);
  box-shadow:0 0 0 1px var(--cyan),0 8px 26px rgba(79,216,255,.16);}
.ship.locked{opacity:.5;}
.ship.locked:hover{transform:none;}
.ship svg{width:52px;height:78px;display:block;margin:0 auto 11px;}
.ship b{font-family:'Chakra Petch',sans-serif;font-size:.8rem;display:block;margin-bottom:3px;}
.ship .rar{font-size:.56rem;letter-spacing:.13em;text-transform:uppercase;font-weight:700;
  font-family:'Chakra Petch',sans-serif;}
.r-common{color:var(--text-dim);} .r-rare{color:var(--cyan);}
.r-epic{color:var(--violet);} .r-legend{color:var(--amber);}
.ship .lock{position:absolute;inset:0;display:grid;place-items:center;
  background:rgba(7,9,18,.72);border-radius:13px;font-size:1.3rem;}
.ship .equipped{position:absolute;top:8px;right:8px;font-size:.52rem;background:var(--cyan);
  color:#04202a;padding:2.5px 7px;border-radius:20px;font-weight:700;letter-spacing:.07em;
  font-family:'Chakra Petch',sans-serif;}

#ship-detail .preview{
  height:180px;border-radius:11px;margin-bottom:17px;display:grid;place-items:center;
  background:radial-gradient(ellipse at 50% 78%,rgba(79,216,255,.15),transparent 68%),var(--bg-2);
  border:1px solid var(--line);
}
#ship-detail .preview svg{width:78px;animation:float 4s ease-in-out infinite;}
.stat-line{margin-bottom:13px;}
.stat-line .lab{display:flex;justify-content:space-between;font-size:.68rem;
  color:var(--text-dim);margin-bottom:5px;}
.stat-line .lab b{color:var(--text);font-family:'Chakra Petch',sans-serif;}
.bar{height:6px;border-radius:3px;background:var(--bg-2);overflow:hidden;border:1px solid var(--line);}
.bar i{display:block;height:100%;border-radius:3px;}
.perk{background:var(--surface-2);border:1px solid var(--line);border-radius:9px;
  padding:11px 13px;font-size:.7rem;color:var(--text-dim);line-height:1.55;margin-top:15px;}
.perk b{color:var(--cyan);display:block;margin-bottom:3px;font-size:.72rem;
  font-family:'Chakra Petch',sans-serif;letter-spacing:.04em;}

/* ---- RANKINGS ---- */
.tabs{display:flex;gap:5px;margin-bottom:19px;flex-wrap:wrap;}
.tabs button{background:var(--surface);border:1px solid var(--line);color:var(--text-dim);
  padding:8px 16px;border-radius:8px;cursor:pointer;font-size:.72rem;transition:.15s;
  font-family:'Chakra Petch',sans-serif;font-weight:600;letter-spacing:.07em;text-transform:uppercase;}
.tabs button:hover{color:var(--text);}
.tabs button.on{background:rgba(79,216,255,.1);border-color:var(--cyan);color:var(--cyan);}

#podium{display:grid;grid-template-columns:repeat(3,1fr);gap:13px;margin-bottom:20px;}
@media(max-width:700px){#podium{grid-template-columns:1fr;}}
.pod{background:var(--surface);border:1px solid var(--line);border-radius:14px;
  padding:22px 16px;text-align:center;position:relative;overflow:hidden;}
.pod.p1{border-color:var(--amber);background:
  radial-gradient(circle at 50% 0%,rgba(255,184,77,.14),transparent 62%),var(--surface);}
.pod.p2{border-color:#8fa0c8;}
.pod.p3{border-color:#c98b5e;}
.pod .rank{font-family:'Chakra Petch',sans-serif;font-size:1.9rem;font-weight:700;
  line-height:1;margin-bottom:9px;}
.pod.p1 .rank{color:var(--amber);} .pod.p2 .rank{color:#8fa0c8;} .pod.p3 .rank{color:#c98b5e;}
.pod .av{width:46px;height:46px;border-radius:11px;margin:0 auto 10px;display:grid;
  place-items:center;font-weight:700;font-family:'Chakra Petch',sans-serif;color:#06121a;}
.pod b{display:block;font-family:'Chakra Petch',sans-serif;font-size:.9rem;margin-bottom:3px;}
.pod .wpm{font-size:1.25rem;font-weight:700;font-family:'Chakra Petch',sans-serif;color:var(--cyan);}
.pod .sub{font-size:.62rem;color:var(--text-dim);margin-top:3px;}

table{width:100%;border-collapse:collapse;}
thead th{font-size:.6rem;letter-spacing:.13em;text-transform:uppercase;color:var(--text-dimmer);
  text-align:left;padding:0 13px 11px;font-weight:600;font-family:'Chakra Petch',sans-serif;}
tbody tr{background:var(--surface);border:1px solid var(--line);transition:.14s;}
tbody tr:hover{background:var(--surface-2);}
tbody tr.me{background:rgba(79,216,255,.07);border-color:var(--cyan);}
tbody td{padding:13px;font-size:.78rem;border-top:1px solid var(--line);border-bottom:1px solid var(--line);}
tbody td:first-child{border-left:1px solid var(--line);border-radius:9px 0 0 9px;}
tbody td:last-child{border-right:1px solid var(--line);border-radius:0 9px 9px 0;}
tbody tr.me td{border-color:var(--cyan);}
tbody tr td:first-child{font-family:'Chakra Petch',sans-serif;font-weight:700;color:var(--text-dim);width:52px;}
.player-cell{display:flex;align-items:center;gap:10px;}
.player-cell .av{width:29px;height:29px;border-radius:8px;display:grid;place-items:center;
  font-size:.7rem;font-weight:700;color:#06121a;font-family:'Chakra Petch',sans-serif;flex-shrink:0;}
.mono-num{font-family:'Chakra Petch',sans-serif;font-weight:700;}
.delta-up{color:var(--green);font-size:.68rem;}
.delta-dn{color:var(--pink);font-size:.68rem;}
tr.sep-row{background:none!important;border:none!important;}
tr.sep-row td{border:none!important;text-align:center;color:var(--text-dimmer);
  font-size:.9rem;letter-spacing:.3em;padding:7px;}

/* ---- LOBBY ---- */
#lobby-grid{display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start;}
@media(max-width:940px){#lobby-grid{grid-template-columns:1fr;}}
.slot{display:flex;align-items:center;gap:13px;padding:13px 15px;border-radius:11px;
  background:var(--surface-2);border:1px solid var(--line);margin-bottom:9px;}
.slot .av{width:36px;height:36px;border-radius:9px;display:grid;place-items:center;
  font-weight:700;font-size:.78rem;color:#06121a;font-family:'Chakra Petch',sans-serif;flex-shrink:0;}
.slot b{font-family:'Chakra Petch',sans-serif;font-size:.83rem;display:block;}
.slot span{font-size:.65rem;color:var(--text-dim);}
.slot .ready{margin-left:auto;font-size:.6rem;padding:4px 10px;border-radius:20px;font-weight:700;
  letter-spacing:.08em;text-transform:uppercase;font-family:'Chakra Petch',sans-serif;}
.ready-y{background:rgba(77,255,180,.14);color:var(--green);}
.ready-n{background:rgba(255,184,77,.13);color:var(--amber);}
.slot.empty{border-style:dashed;opacity:.45;justify-content:center;font-size:.72rem;
  color:var(--text-dim);padding:19px;}
#countdown{text-align:center;padding:26px 0 6px;}
#countdown .num{font-family:'Chakra Petch',sans-serif;font-size:3.4rem;font-weight:700;
  color:var(--cyan);line-height:1;text-shadow:0 0 26px rgba(79,216,255,.45);}
#countdown .lab{font-size:.66rem;color:var(--text-dim);letter-spacing:.16em;
  text-transform:uppercase;margin-top:7px;}
.room-code{display:flex;align-items:center;gap:11px;background:var(--bg-2);
  border:1px dashed var(--line-bright);border-radius:10px;padding:13px 15px;margin-bottom:17px;}
.room-code b{font-family:'Chakra Petch',sans-serif;font-size:1.15rem;letter-spacing:.22em;color:var(--cyan);}
.room-code span{font-size:.6rem;color:var(--text-dim);letter-spacing:.11em;text-transform:uppercase;display:block;}

/* ---- PROFILE ---- */
#prof-grid{display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start;}
@media(max-width:940px){#prof-grid{grid-template-columns:1fr;}}
#spark{width:100%;height:130px;}
.hist-row{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--line);font-size:.75rem;}
.hist-row:last-child{border-bottom:none;}
.hist-row .pos{width:30px;font-family:'Chakra Petch',sans-serif;font-weight:700;}
.pos-1{color:var(--amber);} .pos-x{color:var(--pink);}
.hist-row .fill{flex:1;color:var(--text-dim);font-size:.7rem;}
.ach{display:flex;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line);}
.ach:last-child{border-bottom:none;}
.ach .ico{width:36px;height:36px;border-radius:9px;display:grid;place-items:center;
  background:var(--surface-2);border:1px solid var(--line);font-size:1rem;flex-shrink:0;}
.ach.done .ico{background:rgba(255,184,77,.13);border-color:var(--amber);}
.ach b{font-size:.76rem;font-family:'Chakra Petch',sans-serif;display:block;margin-bottom:2px;}
.ach span{font-size:.65rem;color:var(--text-dim);}
.ach.locked{opacity:.45;}

.note{margin-top:34px;padding:15px 17px;border-radius:11px;background:rgba(166,120,255,.07);
  border:1px solid rgba(166,120,255,.28);font-size:.7rem;color:var(--text-dim);line-height:1.65;}
.note b{color:var(--violet);}
.stack{display:flex;flex-direction:column;gap:20px;}
</style>
</head>
<body>

<div id="backdrop"></div>

<div id="shell">
  <div id="topbar">
    <div id="brand" onclick="go('home')">
      <svg viewBox="0 0 60 100"><path d="M30 4C42 18 46 40 46 62v16H14V62C14 40 18 18 30 4Z" fill="#e6e9f7"/><path d="M14 62c-8 4-10 16-8 26l8-10Z" fill="#4fd8ff"/><path d="M46 62c8 4 10 16 8 26l-8-10Z" fill="#2a9fc2"/><circle cx="30" cy="40" r="8" fill="#131832"/><circle cx="30" cy="40" r="4.5" fill="#4fd8ff"/></svg>
      <div><b class="d">ALTITYPE</b><small>working title</small></div>
    </div>
    <nav>
      <button data-v="home" class="on" onclick="go('home')">Home</button>
      <button data-v="hangar" onclick="go('hangar')">Hangar</button>
      <button data-v="ranks" onclick="go('ranks')">Rankings</button>
      <button data-v="lobby" onclick="go('lobby')">Lobby</button>
      <button data-v="profile" onclick="go('profile')">Profile</button>
    </nav>
    <div id="topright">
      <div class="currency"><i></i>2,480</div>
      <div id="avatar" onclick="go('profile')">
        <div class="pic">JD</div>
        <div class="meta"><b>jaydee</b><span>Lv 14 · 87 WPM</span></div>
      </div>
    </div>
  </div>

  <main>

    <!-- ================= HOME ================= -->
    <section class="view on" id="v-home">
      <div id="home-grid">
        <div class="stack">
          <div id="hero">
            <svg class="rocket-deco" viewBox="0 0 60 100"><path d="M30 4C42 18 46 40 46 62v16H14V62C14 40 18 18 30 4Z" fill="#e6e9f7"/><path d="M30 4C42 18 46 40 46 62v16H30Z" fill="#b9c0dd"/><path d="M14 62c-8 4-10 16-8 26l8-10Z" fill="#4fd8ff"/><path d="M46 62c8 4 10 16 8 26l-8-10Z" fill="#2a9fc2"/><circle cx="30" cy="40" r="8" fill="#131832"/><circle cx="30" cy="40" r="4.5" fill="#4fd8ff"/></svg>
            <p class="eyebrow">Season 1 · Week 3</p>
            <h2 class="d">Accuracy is altitude.</h2>
            <p>Every correct keystroke builds thrust. Thrust bleeds away the moment you hesitate. One mistake drops you to zero and cracks the hull.</p>
            <div class="btn-row">
              <button class="btn btn-primary" onclick="go('lobby')">▲ Find match</button>
              <button class="btn btn-ghost" onclick="go('lobby')">Create room</button>
            </div>
            <div style="margin-top:19px;font-size:.68rem;color:var(--text-dim);">
              <span class="online-dot"></span>1,204 pilots online · avg queue 6s
            </div>
          </div>

          <div id="quickstats">
            <div class="qs"><b>87</b><span>Your WPM</span></div>
            <div class="qs up"><b>96.4%</b><span>Accuracy</span></div>
            <div class="qs"><b>#412</b><span>Global rank</span></div>
            <div class="qs"><b>34</b><span>Races won</span></div>
          </div>

          <div class="card">
            <h3>Daily contract</h3>
            <div style="display:flex;align-items:center;gap:15px;">
              <div style="width:44px;height:44px;border-radius:11px;background:rgba(255,184,77,.13);
                border:1px solid var(--amber);display:grid;place-items:center;font-size:1.2rem;flex-shrink:0;">◎</div>
              <div style="flex:1;">
                <b class="d" style="font-size:.86rem;">Finish 3 races without losing a hull segment</b>
                <div style="height:6px;border-radius:3px;background:var(--bg-2);margin-top:9px;
                  border:1px solid var(--line);overflow:hidden;">
                  <i style="display:block;height:100%;width:66%;background:linear-gradient(90deg,var(--amber),#ffd88a);"></i>
                </div>
                <span style="font-size:.65rem;color:var(--text-dim);margin-top:6px;display:block;">2 of 3 complete · reward 400 ◈</span>
              </div>
            </div>
          </div>
        </div>

        <div class="stack">
          <div class="card">
            <h3>Game modes</h3>
            <div class="mode-list">
              <div class="mode sel" onclick="pickMode(this)">
                <div class="ico">⚡</div>
                <div><b class="d">Quick match</b><span>Up to 5 pilots, random paragraph</span></div>
                <div class="tag tag-live">Live</div>
              </div>
              <div class="mode" onclick="pickMode(this)">
                <div class="ico">◈</div>
                <div><b class="d">Ranked ascent</b><span>Placement affects your global rank</span></div>
                <div class="tag tag-live">Live</div>
              </div>
              <div class="mode" onclick="pickMode(this)">
                <div class="ico">◐</div>
                <div><b class="d">Time trial</b><span>Solo run, chase your own best</span></div>
                <div class="tag tag-solo">Solo</div>
              </div>
              <div class="mode" onclick="pickMode(this)">
                <div class="ico">☠</div>
                <div><b class="d">Sudden death</b><span>One mistake and you are gone</span></div>
                <div class="tag tag-new">New</div>
              </div>
              <div class="mode" onclick="pickMode(this)">
                <div class="ico">⌸</div>
                <div><b class="d">Private room</b><span>Invite friends with a room code</span></div>
              </div>
            </div>
          </div>

          <div class="card">
            <h3>Recent races</h3>
            <div class="hist-row"><span class="pos pos-1">1st</span><span class="fill">Quick match · 5 pilots</span><span class="mono-num">94 wpm</span></div>
            <div class="hist-row"><span class="pos">3rd</span><span class="fill">Ranked · 5 pilots</span><span class="mono-num">81 wpm</span></div>
            <div class="hist-row"><span class="pos pos-x">DNF</span><span class="fill">Sudden death · hull breach</span><span class="mono-num">62%</span></div>
            <div class="hist-row"><span class="pos">2nd</span><span class="fill">Quick match · 4 pilots</span><span class="mono-num">88 wpm</span></div>
          </div>
        </div>
      </div>

      <div class="note">
        <b>Prototype note.</b> Everything here is static mock data with no backend. Nav, ship selection, mode selection, and the lobby countdown are wired up so you can click through the flow, but nothing persists on reload.
      </div>
    </section>

    <!-- ================= HANGAR ================= -->
    <section class="view" id="v-hangar">
      <p class="eyebrow">Loadout</p>
      <h1 class="page d">Hangar</h1>
      <p class="page-sub">Ships change how the run feels, not how fast you can type. Each one trades something away.</p>

      <div id="hangar-grid">
        <div id="ship-grid"></div>
        <div class="card" id="ship-detail"></div>
      </div>

      <div class="note">
        <b>Balance thought.</b> Keep ship effects small and sideways rather than straight upgrades, so a new player on the starter ship is never simply outgunned. Cosmetic-only is also a defensible option, and it sidesteps the balance problem entirely for a portfolio build.
      </div>
    </section>

    <!-- ================= RANKINGS ================= -->
    <section class="view" id="v-ranks">
      <p class="eyebrow">Season 1</p>
      <h1 class="page d">Rankings</h1>
      <p class="page-sub">Ranked by average WPM across your last 20 races, with accuracy as the tiebreaker.</p>

      <div class="tabs">
        <button class="on" onclick="tab(this)">Global</button>
        <button onclick="tab(this)">This week</button>
        <button onclick="tab(this)">Friends</button>
        <button onclick="tab(this)">Country</button>
      </div>

      <div id="podium"></div>

      <table>
        <thead><tr><th>#</th><th>Pilot</th><th>Avg WPM</th><th>Accuracy</th><th>Races</th><th>Trend</th></tr></thead>
        <tbody id="rank-body"></tbody>
      </table>

      <div class="note">
        <b>Design thought.</b> Averaging the last 20 races instead of showing an all-time peak keeps the board about current form and makes a single lucky run much harder to camp on. Worth storing every race result server side regardless, so the ranking formula can change later without losing history.
      </div>
    </section>

    <!-- ================= LOBBY ================= -->
    <section class="view" id="v-lobby">
      <p class="eyebrow">Quick match</p>
      <h1 class="page d">Launch bay</h1>
      <p class="page-sub">Waiting for pilots. Race starts when everyone is ready or the timer runs out.</p>

      <div id="lobby-grid">
        <div class="card">
          <h3>Pilots · 4 of 5</h3>
          <div id="slots"></div>
          <div id="countdown">
            <div class="num d" id="cd-num">8</div>
            <div class="lab">Launching in</div>
          </div>
          <div class="btn-row" style="justify-content:center;margin-top:19px;">
            <button class="btn btn-primary" id="ready-btn" onclick="toggleReady()">Ready up</button>
            <button class="btn btn-ghost" onclick="go('home')">Leave</button>
          </div>
        </div>

        <div class="stack">
          <div class="card">
            <h3>Room</h3>
            <div class="room-code">
              <div><span>Room code</span><b class="d">VEGA-7B</b></div>
              <button class="btn btn-ghost btn-sm" style="margin-left:auto;">Copy</button>
            </div>
            <div class="stat-line"><div class="lab"><span>Hull segments</span><b>5</b></div></div>
            <div class="stat-line"><div class="lab"><span>Paragraph length</span><b>Medium · 240ch</b></div></div>
            <div class="stat-line"><div class="lab"><span>Difficulty</span><b>Standard</b></div></div>
            <div class="stat-line"><div class="lab"><span>Punctuation</span><b>On</b></div></div>
          </div>

          <div class="card">
            <h3>Your loadout</h3>
            <div style="display:flex;align-items:center;gap:14px;">
              <svg viewBox="0 0 60 100" style="width:40px;flex-shrink:0;"><path d="M30 4C42 18 46 40 46 62v16H14V62C14 40 18 18 30 4Z" fill="#e6e9f7"/><path d="M14 62c-8 4-10 16-8 26l8-10Z" fill="#4fd8ff"/><path d="M46 62c8 4 10 16 8 26l-8-10Z" fill="#2a9fc2"/><circle cx="30" cy="40" r="8" fill="#131832"/><circle cx="30" cy="40" r="4.5" fill="#4fd8ff"/></svg>
              <div><b class="d" style="display:block;font-size:.88rem;">Vanguard</b>
              <span style="font-size:.66rem;color:var(--text-dim);">Balanced · starter ship</span></div>
              <button class="btn btn-ghost btn-sm" style="margin-left:auto;" onclick="go('hangar')">Swap</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ================= PROFILE ================= -->
    <section class="view" id="v-profile">
      <p class="eyebrow">Pilot record</p>
      <h1 class="page d">jaydee</h1>
      <p class="page-sub">Level 14 · joined March 2026 · 218 races flown</p>

      <div id="prof-grid">
        <div class="stack">
          <div class="card">
            <h3>WPM over last 20 races</h3>
            <svg id="spark" viewBox="0 0 600 130" preserveAspectRatio="none"></svg>
            <div style="display:flex;justify-content:space-between;font-size:.63rem;color:var(--text-dim);margin-top:7px;">
              <span>20 races ago</span><span>Best 103 · Avg 87</span><span>Latest</span>
            </div>
          </div>

          <div id="quickstats" style="margin-top:0;">
            <div class="qs"><b>103</b><span>Peak WPM</span></div>
            <div class="qs"><b>96.4%</b><span>Avg accuracy</span></div>
            <div class="qs"><b>34</b><span>Wins</span></div>
            <div class="qs"><b>12</b><span>Hull breaches</span></div>
          </div>

          <div class="card">
            <h3>Race history</h3>
            <div class="hist-row"><span class="pos pos-1">1st</span><span class="fill">Quick match · 5 pilots · 4h ago</span><span class="mono-num">94 wpm</span></div>
            <div class="hist-row"><span class="pos">3rd</span><span class="fill">Ranked · 5 pilots · 5h ago</span><span class="mono-num">81 wpm</span></div>
            <div class="hist-row"><span class="pos pos-x">DNF</span><span class="fill">Sudden death · hull breach at 62%</span><span class="mono-num">62%</span></div>
            <div class="hist-row"><span class="pos">2nd</span><span class="fill">Quick match · 4 pilots · yesterday</span><span class="mono-num">88 wpm</span></div>
            <div class="hist-row"><span class="pos">1st</span><span class="fill">Private room · 3 pilots · yesterday</span><span class="mono-num">91 wpm</span></div>
          </div>
        </div>

        <div class="stack">
          <div class="card">
            <h3>Achievements</h3>
            <div class="ach done"><div class="ico">◎</div><div><b class="d">Clean ascent</b><span>Win without losing a hull segment</span></div></div>
            <div class="ach done"><div class="ico">▲</div><div><b class="d">Century club</b><span>Break 100 WPM in a ranked race</span></div></div>
            <div class="ach done"><div class="ico">✦</div><div><b class="d">Full throttle</b><span>Hold max thrust for 15 seconds</span></div></div>
            <div class="ach locked"><div class="ico">☠</div><div><b class="d">Untouchable</b><span>Win 5 sudden death races in a row</span></div></div>
            <div class="ach locked"><div class="ico">◈</div><div><b class="d">Top hundred</b><span>Reach global rank 100</span></div></div>
          </div>

          <div class="card">
            <h3>Keyboard heatmap</h3>
            <p style="font-size:.68rem;color:var(--text-dim);line-height:1.6;margin:0 0 13px;">Which keys cost you the most hull.</p>
            <div id="heat"></div>
          </div>
        </div>
      </div>

      <div class="note">
        <b>Why the heatmap.</b> Per-key error tracking gives players a reason to come back and makes the stats page feel diagnostic rather than decorative. It also falls out almost for free, since the server already sees every keystroke for anti-cheat.
      </div>
    </section>

  </main>
</div>

<script>
// ---------- backdrop ----------
(function(){
  const bd=document.getElementById('backdrop');
  for(let i=0;i<120;i++){
    const s=document.createElement('div');s.className='bstar';
    const z=Math.random()*2+0.5;
    s.style.width=z+'px';s.style.height=z+'px';
    s.style.left=Math.random()*100+'%';s.style.top=Math.random()*100+'%';
    s.style.opacity=(Math.random()*.5+.12).toFixed(2);
    s.style.animation=`twinkle ${(2+Math.random()*4).toFixed(1)}s ease-in-out ${(-Math.random()*5).toFixed(1)}s infinite`;
    bd.appendChild(s);
  }
})();

// ---------- nav ----------
function go(v){
  document.querySelectorAll('.view').forEach(e=>e.classList.remove('on'));
  document.getElementById('v-'+v).classList.add('on');
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.v===v));
  document.querySelector('main').scrollTop=0;
}
function pickMode(el){
  document.querySelectorAll('.mode').forEach(m=>m.classList.remove('sel'));
  el.classList.add('sel');
}
function tab(el){
  el.parentNode.querySelectorAll('button').forEach(b=>b.classList.remove('on'));
  el.classList.add('on');
}

// ---------- ships ----------
const SHIPS=[
  {id:'vanguard',name:'Vanguard',rar:'common',hull:'#e6e9f7',fin:'#4fd8ff',fin2:'#2a9fc2',
   stats:{Thrust:60,'Decay resist':60,Hull:60},owned:true,
   perk:'Balanced starter',perkText:'No bonuses and no penalties. The baseline every other ship is measured against.'},
  {id:'needle',name:'Needle',rar:'rare',hull:'#dfe6ff',fin:'#a678ff',fin2:'#6f4fc4',
   stats:{Thrust:88,'Decay resist':30,Hull:45},owned:true,
   perk:'Glass cannon',perkText:'Builds thrust noticeably faster, but it bleeds away faster too. Rewards sustained rhythm and punishes any pause.'},
  {id:'bulwark',name:'Bulwark',rar:'rare',hull:'#f2e9d8',fin:'#4dffb4',fin2:'#22a06b',
   stats:{Thrust:42,'Decay resist':70,Hull:95},owned:true,
   perk:'Extra plating',perkText:'One additional hull segment. Slower to get moving, but survives the mistakes that end other runs.'},
  {id:'ember',name:'Ember',rar:'epic',hull:'#ffe3d1',fin:'#ff8a4d',fin2:'#c9451f',
   stats:{Thrust:72,'Decay resist':78,Hull:50},owned:true,
   perk:'Afterburn',perkText:'After 20 consecutive correct characters, decay pauses briefly. Combo chasing becomes the main play.'},
  {id:'phantom',name:'Phantom',rar:'epic',hull:'#d5dcf0',fin:'#4fd8ff',fin2:'#1d5f77',
   stats:{Thrust:65,'Decay resist':65,Hull:55},owned:false,cost:1800,
   perk:'Soft landing',perkText:'A mistake cuts thrust by 60 percent instead of dropping it to zero. Less punishing, but never reaches top speed as easily.'},
  {id:'halcyon',name:'Halcyon',rar:'legend',hull:'#fff4d6',fin:'#ffb84d',fin2:'#c98b1f',
   stats:{Thrust:80,'Decay resist':82,Hull:70},owned:false,cost:5000,
   perk:'Second wind',perkText:'Once per race, the first hull segment lost is restored after 10 clean seconds. Rewards recovering instead of tilting.'}
];
let selShip='vanguard', equipped='vanguard';

function shipSVG(s,w){
  return `<svg viewBox="0 0 60 100" style="${w?`width:${w}px`:''}">
    <ellipse cx="30" cy="88" rx="7" ry="12" fill="${s.fin}" opacity=".35"/>
    <path d="M30 4C42 18 46 40 46 62v16H14V62C14 40 18 18 30 4Z" fill="${s.hull}"/>
    <path d="M30 4C42 18 46 40 46 62v16H30Z" fill="rgba(0,0,0,.14)"/>
    <path d="M14 62c-8 4-10 16-8 26l8-10Z" fill="${s.fin}"/>
    <path d="M46 62c8 4 10 16 8 26l-8-10Z" fill="${s.fin2}"/>
    <circle cx="30" cy="40" r="8" fill="#131832"/>
    <circle cx="30" cy="40" r="4.5" fill="${s.fin}"/>
    <rect x="14" y="76" width="32" height="5" fill="rgba(0,0,0,.22)"/>
  </svg>`;
}

function renderShips(){
  document.getElementById('ship-grid').innerHTML=SHIPS.map(s=>`
    <div class="ship ${s.id===selShip?'sel':''} ${s.owned?'':'locked'}" onclick="selectShip('${s.id}')">
      ${s.id===equipped?'<span class="equipped">Equipped</span>':''}
      ${shipSVG(s)}
      <b class="d">${s.name}</b>
      <span class="rar r-${s.rar}">${s.rar}</span>
      ${s.owned?'':`<div class="lock">🔒</div>`}
    </div>`).join('');
  renderDetail();
}

function renderDetail(){
  const s=SHIPS.find(x=>x.id===selShip);
  const colors={Thrust:'var(--cyan)','Decay resist':'var(--violet)',Hull:'var(--green)'};
  document.getElementById('ship-detail').innerHTML=`
    <div class="preview">${shipSVG(s,78)}</div>
    <b class="d" style="font-size:1.1rem;display:block;">${s.name}</b>
    <span class="rar r-${s.rar}" style="display:block;margin-bottom:17px;">${s.rar}</span>
    ${Object.entries(s.stats).map(([k,v])=>`
      <div class="stat-line">
        <div class="lab"><span>${k}</span><b>${v}</b></div>
        <div class="bar"><i style="width:${v}%;background:${colors[k]}"></i></div>
      </div>`).join('')}
    <div class="perk"><b>${s.perk}</b>${s.perkText}</div>
    <div style="margin-top:17px;">
      ${s.owned
        ? (s.id===equipped
            ? `<button class="btn btn-ghost" style="width:100%;" disabled>Equipped</button>`
            : `<button class="btn btn-primary" style="width:100%;" onclick="equip('${s.id}')">Equip</button>`)
        : `<button class="btn btn-ghost" style="width:100%;">Unlock · ${s.cost.toLocaleString()} ◈</button>`}
    </div>`;
}
function selectShip(id){selShip=id;renderShips();}
function equip(id){equipped=id;renderShips();}
renderShips();

// ---------- rankings ----------
const GRAD=['linear-gradient(135deg,#4fd8ff,#a678ff)','linear-gradient(135deg,#ffb84d,#ff4d84)',
  'linear-gradient(135deg,#4dffb4,#4fd8ff)','linear-gradient(135deg,#a678ff,#ff4d84)',
  'linear-gradient(135deg,#ff8a4d,#ffb84d)','linear-gradient(135deg,#4fd8ff,#4dffb4)'];
const PLAYERS=[
  {n:'kernelpanic',w:142,a:'99.1%',r:412,d:2},
  {n:'orbital_ash',w:138,a:'98.4%',r:388,d:-1},
  {n:'mizuchi',w:134,a:'98.9%',r:501,d:1},
  {n:'quietstorm',w:129,a:'97.6%',r:277,d:3},
  {n:'delta_vee',w:127,a:'98.2%',r:344,d:0},
  {n:'nullpointer',w:124,a:'97.1%',r:190,d:-2},
  {n:'sable',w:121,a:'98.7%',r:455,d:1},
];
function initials(n){return n.slice(0,2).toUpperCase();}
function renderRanks(){
  document.getElementById('podium').innerHTML=[1,0,2].map(i=>{
    const p=PLAYERS[i],pos=i+1;
    return `<div class="pod p${pos}">
      <div class="rank d">${pos}</div>
      <div class="av" style="background:${GRAD[i]}">${initials(p.n)}</div>
      <b class="d">${p.n}</b>
      <div class="wpm d">${p.w}</div>
      <div class="sub">${p.a} accuracy · ${p.r} races</div>
    </div>`;
  }).join('');

  let rows=PLAYERS.map((p,i)=>`
    <tr>
      <td>${i+1}</td>
      <td><div class="player-cell"><div class="av" style="background:${GRAD[i%6]}">${initials(p.n)}</div>${p.n}</div></td>
      <td class="mono-num">${p.w}</td>
      <td>${p.a}</td>
      <td>${p.r}</td>
      <td>${p.d>0?`<span class="delta-up">▲ ${p.d}</span>`:p.d<0?`<span class="delta-dn">▼ ${-p.d}</span>`:'<span style="color:var(--text-dimmer);font-size:.68rem;">—</span>'}</td>
    </tr>`).join('');
  rows+=`<tr class="sep-row"><td colspan="6">· · ·</td></tr>
    <tr class="me">
      <td>412</td>
      <td><div class="player-cell"><div class="av" style="background:linear-gradient(135deg,#4fd8ff,#a678ff)">JD</div>jaydee <span style="color:var(--cyan);font-size:.62rem;">(you)</span></div></td>
      <td class="mono-num">87</td><td>96.4%</td><td>218</td>
      <td><span class="delta-up">▲ 14</span></td>
    </tr>`;
  document.getElementById('rank-body').innerHTML=rows;
}
renderRanks();

// ---------- lobby ----------
const LOBBY=[
  {n:'jaydee',me:true,lv:'Lv 14 · 87 wpm',ready:false},
  {n:'orbital_ash',lv:'Lv 31 · 138 wpm',ready:true},
  {n:'sable',lv:'Lv 22 · 121 wpm',ready:true},
  {n:'quietstorm',lv:'Lv 27 · 129 wpm',ready:false},
];
function renderLobby(){
  let h=LOBBY.map((p,i)=>`
    <div class="slot">
      <div class="av" style="background:${GRAD[i%6]}">${initials(p.n)}</div>
      <div><b class="d">${p.n}${p.me?' <span style="color:var(--cyan);font-size:.62rem;">(you)</span>':''}</b><span>${p.lv}</span></div>
      <div class="ready ${p.ready?'ready-y':'ready-n'}">${p.ready?'Ready':'Waiting'}</div>
    </div>`).join('');
  h+=`<div class="slot empty">Waiting for one more pilot…</div>`;
  document.getElementById('slots').innerHTML=h;
}
renderLobby();
function toggleReady(){
  LOBBY[0].ready=!LOBBY[0].ready;
  const b=document.getElementById('ready-btn');
  b.textContent=LOBBY[0].ready?'Cancel ready':'Ready up';
  b.className=LOBBY[0].ready?'btn btn-ghost':'btn btn-primary';
  renderLobby();
}
let cd=8;
setInterval(()=>{cd=cd<=1?8:cd-1;document.getElementById('cd-num').textContent=cd;},1000);

// ---------- sparkline ----------
(function(){
  const d=[72,78,75,83,80,88,85,79,91,87,94,89,96,88,103,92,86,95,90,87];
  const w=600,h=130,max=110,min=60;
  const pts=d.map((v,i)=>[i*(w/(d.length-1)),h-((v-min)/(max-min))*(h-18)-9]);
  const line=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const area=line+` L${w} ${h} L0 ${h} Z`;
  document.getElementById('spark').innerHTML=`
    <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4fd8ff" stop-opacity=".38"/>
      <stop offset="100%" stop-color="#4fd8ff" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#sg)"/>
    <path d="${line}" fill="none" stroke="#4fd8ff" stroke-width="2" stroke-linejoin="round"/>
    ${pts.map((p,i)=>d[i]===103?`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="#ffb84d"/>`:'').join('')}`;
})();

// ---------- key heatmap ----------
(function(){
  const rows=[['Q','W','E','R','T','Y','U','I','O','P'],['A','S','D','F','G','H','J','K','L'],['Z','X','C','V','B','N','M']];
  const hot={'P':.9,'Q':.75,'Z':.7,'X':.62,'B':.55,'Y':.5,'M':.42,'V':.38,'W':.3,'K':.28};
  document.getElementById('heat').innerHTML=rows.map((r,ri)=>
    `<div style="display:flex;gap:4px;margin-bottom:4px;padding-left:${ri*11}px;">`+
    r.map(k=>{
      const v=hot[k]||.06;
      return `<div style="flex:1;aspect-ratio:1;border-radius:5px;display:grid;place-items:center;
        font-size:.6rem;font-weight:700;font-family:'Chakra Petch',sans-serif;
        background:rgba(255,77,132,${(v*.72).toFixed(2)});
        border:1px solid ${v>.3?'rgba(255,77,132,.55)':'var(--line)'};
        color:${v>.4?'#fff':'var(--text-dim)'};">${k}</div>`;
    }).join('')+`</div>`).join('');
})();
</script>
</body>
</html>