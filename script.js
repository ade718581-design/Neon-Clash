(() => {
'use strict';
const cv = document.getElementById('game'), ctx = cv.getContext('2d'), W = 960, H = 600;
const $ = id => document.getElementById(id);
const K = new Set();
const S = { sound: true, arena: 0, diff: 1 };
const ARENAS = ['Random', 'Core', 'Grid', 'Maze'], DIFFS = [['Easy', .7], ['Normal', 1], ['Hard', 1.4]];
let diffI = 1, mode = null, state = 'menu', walls = [], movers = [], fields = [], P = [], E = [], B = [], FX = [];
let PO = [], shake = 0, prev = 'play', endDelay = 0;
const STARS = Array.from({ length: 70 }, () => ({ x: Math.random() * 960, y: Math.random() * 600, s: Math.random() * 2 + 1, v: .1 + Math.random() * .4 }));
let wave = 0, score = 0, queue = [], spawnT = 0, clearT = 0, banner = 0, last = 0, time = 0, mt = 0, cT = 0, layout = 0;

// ---------- Sound ----------
let AC = null;
function snd(f, d, t = 'square', v = .04, to = 0) {
  if (!S.sound) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain(), n = AC.currentTime;
    o.type = t; o.frequency.setValueAtTime(f, n);
    if (to) o.frequency.exponentialRampToValueAtTime(to, n + d);
    g.gain.setValueAtTime(v, n); g.gain.exponentialRampToValueAtTime(.001, n + d);
    o.connect(g); g.connect(AC.destination); o.start(); o.stop(n + d);
  } catch (e) {}
}

const jingle = a => a.forEach((f, i) => setTimeout(() => snd(f, .2, 'triangle', .05), i * 130));

// ---------- Arena layouts: walls [x,y,w,h]; movers; energy fields [x,y,w,h] ----------
const LAY = [
  { w: [[450,260,60,80],[200,120,20,120],[740,360,20,120],[200,360,20,120],[740,120,20,120]],
    m: [{cx:480,cy:180,w:90,h:16,dx:1,dy:0,r:180,s:.02},{cx:480,cy:420,w:90,h:16,dx:1,dy:0,r:180,s:.02}],
    f: [[420,40,120,50],[420,510,120,50]] },
  { w: [[250,150,80,60],[630,150,80,60],[250,390,80,60],[630,390,80,60],[440,270,80,60]],
    m: [{cx:120,cy:300,w:16,h:90,dx:0,dy:1,r:200,s:.02},{cx:840,cy:300,w:16,h:90,dx:0,dy:1,r:200,s:.02}],
    f: [[400,30,160,50],[400,520,160,50]] },
  { w: [[300,100,20,200],[640,300,20,200],[460,200,40,200]],
    m: [{cx:200,cy:450,w:80,h:16,dx:1,dy:0,r:100,s:.025},{cx:760,cy:150,w:80,h:16,dx:1,dy:0,r:100,s:.025}],
    f: [[680,500,160,60],[120,60,100,60]] }
];
function loadLayout(i) {
  const L = LAY[i];
  walls = L.w.map(a => ({ x: a[0], y: a[1], w: a[2], h: a[3] }));
  movers = L.m.map(m => Object.assign({ x: 0, y: 0 }, m));
  fields = L.f.map(a => ({ x: a[0], y: a[1], w: a[2], h: a[3] }));
  mt = 0; moveMovers();
}
function moveMovers() {
  movers.forEach(m => {
    const v = Math.sin(mt * m.s);
    m.x = m.cx + m.dx * v * m.r - m.w / 2; m.y = m.cy + m.dy * v * m.r - m.h / 2;
  });
}

// ---------- Entities ----------
const ENEMY = {
  mini:   { hp: 30,  sh: 0,  sp: 1.3, r: 12, c: '#ff2a55', pts: 10 },
  speed:  { hp: 20,  sh: 0,  sp: 2.6, r: 10, c: '#ff9a2a', pts: 20 },
  shield: { hp: 40,  sh: 40, sp: 1,   r: 15, c: '#b44dff', pts: 30, fire: 140 },
  boss:   { hp: 350, sh: 0,  sp: .8,  r: 30, c: '#ff1a8c', pts: 200, fire: 70 }
};
const KEY1 = { u: 'KeyW', d: 'KeyS', l: 'KeyA', r: 'KeyD', s: 'KeyF' };
const KEY2 = { u: 'ArrowUp', d: 'ArrowDown', l: 'ArrowLeft', r: 'ArrowRight', s: 'Enter' };
const KEYSP = { u: 'ArrowUp', d: 'ArrowDown', l: 'ArrowLeft', r: 'ArrowRight', s: 'Space' };
const mkP = (id, x, y, c, k, fx, fy) => ({ kind: 'p', id, x, y, r: 14, hp: 100, c, k, fx, fy, cd: 0, hit: 0, inv: 0 });

function start(m) {
  mode = m; score = 0; wave = 0; E = []; B = []; FX = []; queue = []; clearT = 0; banner = 0;
  if (m === 'sp') {
    P = [mkP(1, 480, 470, '#00e5ff', KEYSP, 0, -1)];
    startWave();
  } else {
    layout = S.arena ? S.arena - 1 : Math.floor(Math.random() * 3);
    loadLayout(layout);
    P = [mkP(1, 90, 300, '#00b7ff', KEY1, 1, 0), mkP(2, 870, 300, '#ff2a55', KEY2, -1, 0)];
  }
  state = 'count'; cT = 180; endDelay = 0; PO = []; shake = 0; lastCount = 0; show(null); $('bPause').textContent = 'Pause'; $('bar').classList.add('on');
}
function startWave() {
  wave++; layout = (wave - 1) % 3; loadLayout(layout); B = [];
  const q = [];
  const add = (t, n) => { for (let i = 0; i < n; i++) q.push(t); };
  add('mini', 3 + wave * 2);
  if (wave >= 2) add('speed', wave - 1);
  if (wave >= 3) add('shield', wave - 2);
  if (wave >= 4) add('boss', wave - 3);
  q.sort(() => Math.random() - .5);
  queue = q; spawnT = 60; banner = 120;
}
function spawnEnemy() {
  const t = queue.pop(), d = ENEMY[t], c = [[40,40],[920,40],[40,560],[920,560]];
  const s = c[Math.floor(Math.random() * 4)];
  E.push({ kind: 'e', t, hp: d.hp, sh: d.sh, sp: d.sp * (.8 + .2 * S.diff), r: d.r, c: d.c, pts: d.pts, fire: d.fire,
    x: s[0] + Math.random() * 30, y: s[1] + Math.random() * 30, cd: 90, hit: 0, ph: Math.random() * 6 });
}

// ---------- Helpers ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function push(e, w) {
  const cx = clamp(e.x, w.x, w.x + w.w), cy = clamp(e.y, w.y, w.y + w.h);
  let dx = e.x - cx, dy = e.y - cy, d = Math.hypot(dx, dy);
  if (d >= e.r) return;
  if (d > 0) { e.x += dx / d * (e.r - d); e.y += dy / d * (e.r - d); return; }
  const o = [[e.x - w.x, -1, 0], [w.x + w.w - e.x, 1, 0], [e.y - w.y, 0, -1], [w.y + w.h - e.y, 0, 1]].sort((a, b) => a[0] - b[0])[0];
  e.x += o[1] * (o[0] + e.r); e.y += o[2] * (o[0] + e.r);
}
function spark(x, y, c, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, s = 1 + Math.random() * 3;
    FX.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 20 + Math.random() * 20, c });
  }
  if (FX.length > 400) FX.splice(0, FX.length - 400);
}
function shoot(o, a, sp, d, r, c) {
  B.push({ x: o.x + Math.cos(a) * (o.r + 4), y: o.y + Math.sin(a) * (o.r + 4), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r, o, d, c });
}
function hurt(t, d) {
  if (t.kind === 'p') { t.hp = Math.max(0, t.hp - d); t.hit = 8; shake = Math.max(shake, 7); snd(160, .15, 'sawtooth', .05, 60); return; }
  if (t.sh > 0) t.sh -= d; else t.hp -= d;
  t.hit = 6;
  if (t.hp <= 0 && !t.dead) { t.dead = true; score += t.pts; PO.push({ x: t.x, y: t.y, t: '+' + t.pts, l: 45, c: t.c }); if (t.t === 'boss') shake = 16; spark(t.x, t.y, t.c, t.t === 'boss' ? 60 : 20); snd(300, .3, 'sawtooth', .06, 40); }
}

// ---------- Update ----------
function update(dt) {
  mt += dt; moveMovers();
  const sol = walls.concat(movers);
  P.forEach(p => {
    const k = p.k;
    let dx = (K.has(k.r) ? 1 : 0) - (K.has(k.l) ? 1 : 0), dy = (K.has(k.d) ? 1 : 0) - (K.has(k.u) ? 1 : 0);
    if (dx || dy) { const m = Math.hypot(dx, dy); dx /= m; dy /= m; p.fx = dx; p.fy = dy; p.x += dx * 3.4 * dt; p.y += dy * 3.4 * dt; if (Math.random() < .5) FX.push({ x: p.x - dx * 10, y: p.y - dy * 10, vx: -dx * .5, vy: -dy * .5, l: 14, c: p.c }); }
    sol.forEach(w => push(p, w));
    p.x = clamp(p.x, p.r, W - p.r); p.y = clamp(p.y, p.r, H - p.r);
    p.cd -= dt; p.hit -= dt; p.inv -= dt;
    if (K.has(k.s) && p.cd <= 0) {
      p.cd = 14; shoot(p, Math.atan2(p.fy, p.fx), 9, mode === 'mp' ? 10 : 15, 4, p.c); spark(p.x + p.fx * 20, p.y + p.fy * 20, p.c, 3); snd(900, .1, 'square', .03, 300);
    }
    fields.forEach(f => { if (p.x > f.x && p.x < f.x + f.w && p.y > f.y && p.y < f.y + f.h) { p.hp = Math.max(0, p.hp - .12 * dt); p.hit = 2; } });
  });

  if (mode === 'sp') {
    banner -= dt;
    if (queue.length && E.length < 12 && (spawnT -= dt) <= 0) { spawnT = 40; spawnEnemy(); }
    E.forEach(e => {
      const p = P[0], a = Math.atan2(p.y - e.y, p.x - e.x) + Math.sin(time * .05 + e.ph) * (e.t === 'mini' ? .35 : .15);
      e.x += Math.cos(a) * e.sp * dt; e.y += Math.sin(a) * e.sp * dt; e.hit -= dt;
      E.forEach(o => {
        if (o === e) return;
        const ddx = e.x - o.x, ddy = e.y - o.y, d = Math.hypot(ddx, ddy), m = e.r + o.r;
        if (d > 0 && d < m) { e.x += ddx / d * (m - d) / 2; e.y += ddy / d * (m - d) / 2; }
      });
      sol.forEach(w => push(e, w));
      e.x = clamp(e.x, e.r, W - e.r); e.y = clamp(e.y, e.r, H - e.r);
      if (Math.hypot(p.x - e.x, p.y - e.y) < p.r + e.r && p.inv <= 0) { hurt(p, (e.t === 'boss' ? 15 : 8) * S.diff); p.inv = 40; }
      if (e.fire && (e.cd -= dt) <= 0) {
        e.cd = e.fire; snd(220, .08, 'sawtooth', .02, 110); const aa = Math.atan2(p.y - e.y, p.x - e.x);
        (e.t === 'boss' ? [-.25, 0, .25] : [0]).forEach(o => shoot(e, aa + o, 4.5, 8 * S.diff, 5, e.c));
      }
    });
  }

  B = B.filter(b => {
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) return false;
    for (const w of sol) if (b.x > w.x && b.x < w.x + w.w && b.y > w.y && b.y < w.y + w.h) { spark(b.x, b.y, b.c, 4); snd(120, .05, 'square', .015); return false; }
    const ts = b.o.kind === 'e' ? P : (mode === 'mp' ? P.filter(p => p !== b.o) : E);
    for (const t of ts) if (!t.dead && Math.hypot(t.x - b.x, t.y - b.y) < t.r + b.r) { hurt(t, b.d); spark(b.x, b.y, b.c, 6); return false; }
    return true;
  });
  E = E.filter(e => !e.dead);
  fxStep(dt);

  if (mode === 'sp') {
    if (P[0].hp <= 0) return endGame(false);
    if (!queue.length && !E.length) {
      if (!clearT) { clearT = 90; score += 100; if (wave >= 5) return endGame(true); jingle([523, 659, 784]); }
      if ((clearT -= dt) <= 0) { clearT = 0; P[0].x = 480; P[0].y = 470; P[0].hp = Math.min(100, P[0].hp + 25); startWave(); }
    }
  } else if (P[0].hp <= 0 || P[1].hp <= 0) endGame(true);
}
function fxStep(dt) {
  FX.forEach(f => { f.x += f.vx * dt; f.y += f.vy * dt; f.l -= dt; });
  FX = FX.filter(f => f.l > 0); shake *= .9;
}
function endGame(win) {
  state = 'over';
  const t = $('endT'), s = $('endS');
  if (mode === 'sp') {
    t.textContent = win ? 'VICTORY!' : 'GAME OVER'; t.style.color = win ? '#00e5ff' : '#ff2a55';
    s.textContent = 'Score: ' + score + '  |  Wave ' + wave + ' / 5';
  } else {
    const d1 = P[0].hp <= 0, d2 = P[1].hp <= 0;
    t.textContent = d1 && d2 ? 'DRAW!' : (d2 ? 'PLAYER 1 WINS!' : 'PLAYER 2 WINS!');
    t.style.color = d1 && d2 ? '#b44dff' : (d2 ? '#00b7ff' : '#ff2a55');
    s.textContent = 'Victory in the Neon Arena';
  }
  jingle(win ? [523, 659, 784, 1047] : [392, 330, 262, 196]);
  endDelay = 40;
}

// ---------- Drawing ----------
const glow = (c, b) => { ctx.shadowColor = c; ctx.shadowBlur = b; };
function bar(x, y, w, v, c, label) {
  ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x, y, w, 14);
  glow(c, 10); ctx.fillStyle = c; ctx.fillRect(x, y, w * clamp(v, 0, 1), 14);
  ctx.shadowBlur = 0; ctx.strokeStyle = c; ctx.strokeRect(x, y, w, 14);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(label, x, y - 4);
}
function rectNeon(r, fill, stroke) {
  glow(stroke, 12); ctx.fillStyle = fill; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.strokeRect(r.x, r.y, r.w, r.h);
}
function draw() {
  ctx.shadowBlur = 0;
  const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#07031a'); g.addColorStop(1, '#14062e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(0,150,255,.12)'; ctx.lineWidth = 1; ctx.beginPath();
  const o = (time * .3) % 40;
  for (let x = o; x <= W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = o; y <= H; y += 40) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  ctx.fillStyle = '#8cf';
  STARS.forEach(s => { s.y += s.v; if (s.y > H) s.y = 0; ctx.globalAlpha = .25 + .5 * Math.abs(Math.sin(time * .02 + s.x)); ctx.fillRect(s.x, s.y, s.s, s.s); });
  ctx.globalAlpha = 1;
  if (!mode || state === 'menu') return;
  ctx.save();
  if (shake > .5) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
  ctx.strokeStyle = 'rgba(160,43,255,.25)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 110 + 8 * Math.sin(time * .03), 0, 6.283); ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 60, 0, 6.283); ctx.stroke();
  ctx.fillStyle = 'rgba(180,140,255,.5)'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ARENA: ' + ['CORE', 'GRID', 'MAZE'][layout], W / 2, H - 10);
  glow('#a02bff', 15); ctx.strokeStyle = '#a02bff'; ctx.lineWidth = 3; ctx.strokeRect(1, 1, W - 2, H - 2);

  fields.forEach(f => {
    ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,40,120,' + (.15 + .1 * Math.sin(time * .1)) + ')'; ctx.fillRect(f.x, f.y, f.w, f.h);
    glow('#ff2a55', 10); ctx.strokeStyle = '#ff2a55'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -time; ctx.strokeRect(f.x, f.y, f.w, f.h); ctx.setLineDash([]);
  });
  walls.forEach(w => rectNeon(w, '#0b1030', '#00b7ff'));
  movers.forEach(m => rectNeon(m, '#1a0838', '#b44dff'));

  B.forEach(b => { ctx.strokeStyle = b.c; ctx.globalAlpha = .5; ctx.lineWidth = b.r * 1.2; glow(b.c, 10); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 2.5, b.y - b.vy * 2.5); ctx.stroke(); ctx.globalAlpha = 1; glow(b.c, 14); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fill(); ctx.strokeStyle = b.c; ctx.lineWidth = 2; ctx.stroke(); });
  E.forEach(e => {
    glow(e.c, 16); ctx.fillStyle = e.hit > 0 ? '#fff' : '#12051f'; ctx.strokeStyle = e.c; ctx.lineWidth = e.t === 'boss' ? 4 : 2.5;
    ctx.beginPath();
    if (e.t === 'speed') { const a = Math.atan2(P[0].y - e.y, P[0].x - e.x); for (let i = 0; i < 3; i++) { const q = a + i * 2.094; ctx.lineTo(e.x + Math.cos(q) * e.r * 1.3, e.y + Math.sin(q) * e.r * 1.3); } ctx.closePath(); }
    else if (e.t === 'boss') { for (let i = 0; i < 6; i++) { const q = time * .02 + i * 1.047; ctx.lineTo(e.x + Math.cos(q) * e.r, e.y + Math.sin(q) * e.r); } ctx.closePath(); }
    else ctx.arc(e.x, e.y, e.r, 0, 6.283);
    ctx.fill(); ctx.stroke();
    if (e.sh > 0) { ctx.strokeStyle = '#00e5ff'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 6, 0, 6.283); ctx.stroke(); }
    if (e.t === 'boss') { const m = ENEMY.boss.hp; ctx.shadowBlur = 0; ctx.fillStyle = '#400'; ctx.fillRect(e.x - 30, e.y - e.r - 12, 60, 5); ctx.fillStyle = '#ff1a8c'; ctx.fillRect(e.x - 30, e.y - e.r - 12, 60 * e.hp / m, 5); }
  });
  E.forEach(e => { if (e.t !== 'boss' && e.hp < ENEMY[e.t].hp) { ctx.shadowBlur = 0; ctx.fillStyle = '#400'; ctx.fillRect(e.x - 12, e.y - e.r - 9, 24, 3); ctx.fillStyle = e.c; ctx.fillRect(e.x - 12, e.y - e.r - 9, 24 * e.hp / ENEMY[e.t].hp, 3); } });
  P.forEach(p => {
    glow(p.c, 18); ctx.fillStyle = p.hit > 0 ? '#fff' : '#06101f'; ctx.strokeStyle = p.c; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.fx * (p.r + 8), p.y + p.fy * (p.r + 8)); ctx.stroke();
    if (mode === 'mp') {
      ctx.shadowBlur = 0; ctx.fillStyle = p.c; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('P' + p.id, p.x, p.y - 26);
      ctx.beginPath(); ctx.moveTo(p.x - 5, p.y - 22); ctx.lineTo(p.x + 5, p.y - 22); ctx.lineTo(p.x, p.y - 17); ctx.fill();
    }
  });
  FX.forEach(f => { ctx.globalAlpha = clamp(f.l / 30, 0, 1); ctx.fillStyle = f.c; ctx.fillRect(f.x, f.y, 3, 3); });
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  PO.forEach(p => { p.y -= .6; p.l--; ctx.globalAlpha = clamp(p.l / 20, 0, 1); ctx.fillStyle = p.c; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(p.t, p.x, p.y); });
  PO = PO.filter(p => p.l > 0); ctx.globalAlpha = 1;
  ctx.restore();
  if (P.some(p => p.hp < 30 && p.hp > 0)) {
    const v = ctx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .8);
    v.addColorStop(0, 'rgba(255,0,60,0)'); v.addColorStop(1, 'rgba(255,0,60,' + (.25 + .15 * Math.sin(time * .2)) + ')');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  if (mode === 'sp') {
    bar(16, 26, 220, P[0].hp / 100, '#00e5ff', 'HEALTH');
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'right'; ctx.fillText('SCORE ' + score, W - 16, 30);
    ctx.textAlign = 'center'; ctx.fillText('WAVE ' + wave + ' / 5', W / 2, 30);
    if (banner > 0 && state === 'play') { glow('#b44dff', 20); ctx.fillStyle = '#b44dff'; ctx.font = 'bold 54px sans-serif'; ctx.fillText('WAVE ' + wave, W / 2, 130); }
    if (clearT > 0) { glow('#00e5ff', 20); ctx.fillStyle = '#00e5ff'; ctx.font = 'bold 44px sans-serif'; ctx.fillText('WAVE CLEARED', W / 2, 130); }
  } else {
    bar(16, 26, 250, P[0].hp / 100, '#00b7ff', 'PLAYER 1');
    bar(W - 266, 26, 250, P[1].hp / 100, '#ff2a55', 'PLAYER 2');
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('FIRST TO DEFEAT THE OPPONENT WINS', W / 2, 38);
  }
  if (state === 'count') {
    const n = Math.ceil(cT / 60); glow('#00e5ff', 30); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'bold 120px sans-serif';
    ctx.fillText(n > 0 ? n : 'GO!', W / 2, H / 2 + 40); ctx.shadowBlur = 0;
  }
}

// ---------- Loop / UI ----------
let lastCount = 0;
function loop(ts) {
  const dt = Math.min((ts - last) / 16.667, 3); last = ts; time += dt;
  if (state === 'count') {
    cT -= dt; const n = Math.ceil(cT / 60);
    if (n !== lastCount) { lastCount = n; if (n > 0) snd(440, .15, 'sine', .05); }
    if (cT <= 0) { state = 'play'; snd(880, .35, 'sawtooth', .05, 1400); }
  } else if (state === 'play') update(dt);
  else if (state === 'over') { fxStep(dt); if (endDelay > 0 && (endDelay -= dt) <= 0) show('end'); }
  draw();
  requestAnimationFrame(loop);
}
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  if (id) $(id).classList.add('active');
}
function toMenu() { endDelay = 0; $('bPause').textContent = 'Pause'; state = 'menu'; mode = null; show('menu'); $('bar').classList.remove('on'); }
function pause() {
  if (state === 'play' || state === 'count') { prev = state; state = 'pause'; show('pauseS'); }
  else if (state === 'pause') { state = prev; show(null); }
  $('bPause').textContent = state === 'pause' ? 'Resume' : 'Pause';
}
function labels() {
  $('bSnd').textContent = 'Sound: ' + (S.sound ? 'On' : 'Off');
  $('bArena').textContent = 'Multiplayer Arena: ' + ARENAS[S.arena];
  $('bDiff').textContent = 'Difficulty: ' + DIFFS[diffI][0];
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a; b.blur(); snd(660, .08, 'sine', .04);
  if (a === 'sp' || a === 'mp') start(a);
  else if (a === 'help') show('help');
  else if (a === 'set') { labels(); show('set'); }
  else if (a === 'back' || a === 'menu') toMenu();
  else if (a === 'pause' || a === 'resume') pause();
  else if (a === 'restart') { if (mode) start(mode); }
  else if (a === 'snd') S.sound = !S.sound;
  else if (a === 'arena') S.arena = (S.arena + 1) % 4;
  else if (a === 'diff') { diffI = (diffI + 1) % 3; S.diff = DIFFS[diffI][1]; }
  labels();
});
const GAMEKEYS = ['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
addEventListener('keydown', e => {
  if (state !== 'menu' && state !== 'over' && GAMEKEYS.includes(e.code)) e.preventDefault();
  if (e.repeat) { K.add(e.code); return; }
  K.add(e.code);
  if (e.code === 'KeyP' || e.code === 'Escape') pause();
});
addEventListener('keyup', e => K.delete(e.code));
addEventListener('blur', () => { K.clear(); if (state === 'play') pause(); });
labels();
requestAnimationFrame(t => { last = t; loop(t); });
})();
