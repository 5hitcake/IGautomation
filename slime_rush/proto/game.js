// Slime Rush – Prototyp: automatisches Rennen, 3 Runden, Zufall per Seed
const params = new URLSearchParams(location.search);
const REEL = params.get('reel') === '1';   // 9:16-Modus für Instagram-Reels
const W = REEL ? 540 : 960, H = REEL ? 960 : 540, GROUND = REEL ? 640 : 450, SLIME = 66, S = REEL ? 2 : 1, Z = REEL ? 1.5 : 1, VIEW = W / Z;  // Z = Zoom der Spielwelt im Reel
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
cv.width = W * S; cv.height = H * S; if (REEL) cv.style.aspectRatio = '9/16';
const IMG = {};
let loaded = 0; const keys = Object.keys(ASSETS);
keys.forEach(k => { const i = new Image(); i.onload = () => { if (++loaded === keys.length) start(); }; i.src = ASSETS[k]; IMG[k] = i; });

// --- verifizierbarer Zufall (Seed = Datum oder ?seed=...) ---
let SEED = params.get('seed') || new Date().toISOString().slice(0, 10);
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
let rnd;

const BRANDS = [
  ['Pepsy', 'blau'], ['Koka-Kola', 'rot'], ['Sprajt', 'gruen'], ['Fantasia', 'lila'],
  ['Red Bulle', 'blau'], ['Monstar', 'gruen'], ['Burger Kong', 'rot'], ['Milkah', 'lila'],
  ['Nike-ish', 'rot'], ['Adidaz', 'blau'], ['Starbacks', 'gruen'], ['Twitsch', 'lila'],
];
const ROUNDS = [{ name: 'Runde 1 · Ronda 1', len: 3400, qualify: 6 }, { name: 'Runde 2 · Ronda 2', len: 3800, qualify: 3 }, { name: 'FINALE', len: 4200, qualify: 1 }];
if (REEL) ROUNDS.forEach(r => r.len = Math.round(r.len * .62));  // Reel kürzer (~45 s)
const OBST = ['saege', 'hammer', 'stacheln', 'kiste', 'schleim', 'speedpad', 'feder', 'steinblock'];

let racers, obstacles, coins, round, camX, state, timer, finishOrder, particles, banner;

let frame = 0, endFrames = 0;
function start() {
  SEED = String(SEED); newGame();
  if (!REEL || params.get('live') === '1') { requestAnimationFrame(loop); return; }
  // Reel: extern gesteuert, 30 fps Video, 2 Simulationsschritte pro Bild
  window.reelStep = () => { update(); update(); frame++; render(frame * 1000 / 30); if (state === 'champion') endFrames++; return endFrames > 150; };
  window.reelReady = true;
}
function newGame() {
  rnd = mulberry(hash(SEED));
  racers = BRANDS.map(([name, color], i) => ({ name, color, alive: true, lane: i }));
  round = 0; setupRound();
}
function setupRound() {
  const R = ROUNDS[round];
  obstacles = []; coins = [];
  let x = 600;
  while (x < R.len - 300) {
    const type = OBST[Math.floor(rnd() * OBST.length)];
    obstacles.push({ type, x, phase: rnd() * 6.28 });
    x += 260 + rnd() * 220;
  }
  for (let c = 400; c < R.len; c += 350 + rnd() * 300) coins.push({ x: c, y: GROUND - 140 - rnd() * 60, taken: false });
  const alive = racers.filter(r => r.alive);
  alive.forEach((r, i) => Object.assign(r, {
    x: 80 + (i % 4) * 14, y: GROUND, vy: 0, base: 3.1 + rnd() * 0.5, speed: 0, stun: 0, slow: 0, boost: 0,
    pose: 'idle', done: false, passed: new Set(), z: i, squash: 0,
  }));
  finishOrder = []; particles = []; camX = 0; state = 'countdown'; timer = 180;
  banner = R.name;
}

function hitChance(type) { return { saege: .35, hammer: .35, stacheln: .3, kiste: .2, steinblock: .2 }[type] || 0; }

function update() {
  const R = ROUNDS[round];
  if (state === 'countdown') { if (--timer <= 0) state = 'race'; return; }
  if (state === 'result') { if (--timer <= 0) nextRound(); return; }
  if (state === 'champion') return;

  const alive = racers.filter(r => r.alive);
  for (const r of alive) {
    if (r.done) { r.pose = 'idle'; continue; }
    let sp = r.base + (rnd() - .5) * .6;
    if (r.slow > 0) { sp *= .45; r.slow--; }
    if (r.boost > 0) { sp *= 1.8; r.boost--; }
    if (r.stun > 0) { r.stun--; sp = r.stun > 30 ? -2.5 : 0; r.pose = 'hit'; }
    r.x += sp;
    // Schwerkraft
    r.vy += .6; r.y += r.vy;
    if (r.y >= GROUND) { if (r.vy > 4) r.squash = 1; r.y = GROUND; r.vy = 0; }
    r.squash *= .85;
    if (r.stun <= 0) r.pose = r.y < GROUND - 2 ? 'jump' : 'idle';
    // Hindernisse
    for (const o of obstacles) {
      if (r.passed.has(o) || r.x < o.x - 70) continue;
      r.passed.add(o);
      if (o.type === 'schleim') { r.slow = 70; burst(r.x, GROUND, '#7ed321'); continue; }
      if (o.type === 'speedpad') { r.boost = 60; burst(r.x, GROUND, '#ffd400'); continue; }
      if (o.type === 'feder') { r.vy = -17; o.bounce = 1; continue; }
      if (rnd() < hitChance(o.type)) { r.stun = 55; r.vy = -6; burst(r.x, r.y - 30, '#fff'); shake = 8; }
      else r.vy = o.type === 'steinblock' || o.type === 'kiste' ? -14 : -12;
    }
    for (const c of coins) if (!c.taken && Math.abs(c.x - r.x) < 30 && Math.abs(c.y - (r.y - 30)) < 50) { c.taken = true; burst(c.x, c.y, '#ffcc00'); }
    if (r.x >= R.len) { r.done = true; finishOrder.push(r); }
  }
  // Kamera folgt dem Führenden
  const lead = Math.max(...alive.map(r => r.x));
  camX += (Math.min(Math.max(lead - VIEW * .45, 0), R.len - VIEW + 220) - camX) * .08;
  particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .3; p.life--; });
  particles = particles.filter(p => p.life > 0);
  if (shake > 0) shake *= .85;

  if (finishOrder.length >= R.qualify) {
    const ok = new Set(finishOrder.slice(0, R.qualify));
    alive.forEach(r => { if (!ok.has(r)) { r.alive = false; r.pose = 'eliminated'; r.out = round; } });
    state = round === ROUNDS.length - 1 ? 'champion' : 'result';
    timer = 200;
    if (state === 'champion') finishOrder[0].pose = 'victory';
  }
}
function nextRound() { round++; setupRound(); }
let shake = 0;
function burst(x, y, col) { for (let i = 0; i < 12; i++) particles.push({ x, y, vx: (rnd() - .5) * 7, vy: -rnd() * 7, life: 30, col }); }

// --- Zeichnen ---
function drawImg(k, x, y, h, opts = {}) {
  const im = IMG[k]; const w = im.width * h / im.height;
  ctx.save(); ctx.translate(x, y);
  if (opts.rot) ctx.rotate(opts.rot);
  if (opts.sx) ctx.scale(opts.sx, opts.sy || 1);
  ctx.drawImage(im, -w * (opts.ax ?? .5), -h * (opts.ay ?? 1), w, h); ctx.restore();
  return w;
}
function render(t) {
  const R = ROUNDS[round];
  ctx.setTransform(S, 0, 0, S, 0, 0);
  ctx.save();
  if (shake > .5) ctx.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
  // Parallax-Hintergrund (gespiegelt gekachelt)
  const bg = IMG.bg, bh = H, bw = bg.width * bh / bg.height, off = -(camX * .25) % (bw * 2);
  for (let i = -1; i < 4; i++) {
    const x = off + i * bw; ctx.save();
    if (i % 2) { ctx.translate(x + bw, 0); ctx.scale(-1, 1); ctx.drawImage(bg, 0, REEL ? 60 : -40, bw, bh); }
    else ctx.drawImage(bg, x, REEL ? 60 : -40, bw, bh);
    ctx.restore();
  }
  ctx.translate(0, GROUND); ctx.scale(Z, Z); ctx.translate(-camX, -GROUND);
  // Werbeschilder (leer → Logo des Tagessiegers)
  for (let x = 300; x < R.len; x += 1100) {
    drawImg('schild', x, GROUND + 6, 190);
    ctx.fillStyle = '#3b2412'; ctx.font = 'bold 20px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('DEIN LOGO', x + 6, GROUND - 128); ctx.fillText('HIER', x + 6, GROUND - 104);
  }
  // Boden
  ctx.fillStyle = '#7a4a22'; ctx.fillRect(camX - 50, GROUND + 40, W + 100, H);
  const g = IMG.boden_lang, gh = 120, gw = g.width * gh / g.height;
  for (let x = Math.floor(camX / (gw - 30)) * (gw - 30) - gw; x < camX + W + gw; x += gw - 30) ctx.drawImage(g, x, GROUND - 22, gw, gh);
  // Ziel
  drawImg('zielflagge', R.len + 10, GROUND + 4, 170, { ax: .2 });
  for (let y = GROUND - 150; y < GROUND; y += 20) for (let k = 0; k < 2; k++) { ctx.fillStyle = ((y / 20 + k) % 2) ? '#fff' : '#222'; ctx.fillRect(R.len - 20 + k * 10, y, 10, 20); }
  // Münzen
  for (const c of coins) if (!c.taken) drawImg('muenze', c.x, c.y + Math.sin(t / 200 + c.x) * 6, 38, { ay: .5, sx: Math.cos(t / 300 + c.x) });
  // Hindernisse
  for (const o of obstacles) {
    const a = t / 1000;
    if (o.type === 'saege') drawImg('saege', o.x, GROUND - 40, 90, { ay: .5, rot: a * 12 });
    else if (o.type === 'hammer') drawImg('hammer', o.x, GROUND - 150, 130, { ax: .9, ay: .1, rot: Math.sin(a * 3 + o.phase) * .9 - .3 });
    else if (o.type === 'feder') { o.bounce = (o.bounce || 0) * .9; drawImg('feder', o.x, GROUND + 6, 70, { sy: 1 - (o.bounce || 0) * .4 }); }
    else if (o.type === 'schleim') drawImg('schleim', o.x, GROUND + 12, 34);
    else if (o.type === 'speedpad') drawImg('speedpad', o.x, GROUND + 10, 30);
    else if (o.type === 'stacheln') drawImg('stacheln', o.x, GROUND + 6, 60);
    else drawImg(o.type, o.x, GROUND + 6, 62);
  }
  // Slimes
  const list = racers.filter(r => r.alive || (r.out === round));
  for (const r of list.sort((a, b) => a.z - b.z)) {
    const bob = r.pose === 'idle' && !r.done ? Math.abs(Math.sin(t / 90 + r.lane)) * 6 : 0;
    const sq = r.squash || 0;
    const y = r.pose === 'eliminated' ? GROUND : r.y;
    drawImg(`${r.color}_${r.pose}`, r.x, y - bob + 8, SLIME * (1 - sq * .25) * (r.pose === 'victory' ? 1.6 : 1), { sx: 1 + sq * .25 });
    ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center';
    const tw = ctx.measureText(r.name).width + 10;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(r.x - tw / 2, y - SLIME - bob - 18, tw, 18);
    ctx.fillStyle = '#fff'; ctx.fillText(r.name, r.x, y - SLIME - bob - 4);
  }
  particles.forEach(p => { ctx.fillStyle = p.col; ctx.globalAlpha = p.life / 30; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 7); ctx.fill(); });
  ctx.globalAlpha = 1; ctx.restore();
  hud();
}
function txt(s, x, y, size, col = '#fff') {
  ctx.font = `900 ${size}px system-ui`; ctx.textAlign = 'center'; ctx.lineWidth = size / 6; ctx.strokeStyle = '#1a1a2e';
  ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function hud() {
  if (REEL) return hudReel();
  const R = ROUNDS[round];
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(10, 10, 300, 56);
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = 'bold 18px system-ui'; ctx.fillText(`SLIME RUSH · ${R.name}`, 20, 34);
  ctx.font = '13px system-ui'; ctx.fillText(`Im Ziel: ${finishOrder.length}/${R.qualify} · Seed: ${SEED}`, 20, 55);
  if (state === 'countdown') { const n = Math.ceil(timer / 60); txt(banner, W / 2, 180, 46, '#ffd400'); txt(n > 0 ? n : 'GO!', W / 2, 260, 90); }
  if (state === 'result') { txt('QUALIFIZIERT! / ¡CLASIFICADOS!', W / 2, 150, 36, '#7ed321'); txt(finishOrder.map(r => r.name).join(' · '), W / 2, 200, 20); }
  if (state === 'champion') {
    const w = finishOrder[0];
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, H);
    txt('🏆 SIEGER DES TAGES / CAMPEÓN DEL DÍA', W / 2, 120, 32, '#ffd400');
    drawImg(`${w.color}_victory`, W / 2, 380, 210);
    txt(w.name, W / 2, 440, 56);
    txt('24h Top-Werbeplatz · 24h espacio principal', W / 2, 485, 20);
    txt('Klick = neues Rennen / clic = nueva carrera', W / 2, 525, 15, '#ccc');
  }
}
cv.addEventListener('click', () => { if (state === 'champion') { SEED = Math.random().toString(36).slice(2, 8); newGame(); } });
let last = 0, acc = 0;
function loop(t) {
  acc += Math.min(t - last, 100); last = t;
  while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
  render(t); requestAnimationFrame(loop);
}

function standings() {
  const alive = racers.filter(r => r.alive && !finishOrder.includes(r)).sort((a, b) => b.x - a.x);
  return finishOrder.concat(alive);
}
function hudReel() {
  const R = ROUNDS[round];
  // Kopfzeile
  const gr = ctx.createLinearGradient(0, 0, 0, 170); gr.addColorStop(0, '#1a1a2e'); gr.addColorStop(1, 'rgba(26,26,46,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, 170);
  txt('SLIME RUSH', W / 2, 70, 58, '#ffd400');
  txt('Tagesrennen · Carrera del día · ' + SEED, W / 2, 104, 17);
  txt(R.name, W / 2, 142, 26, '#7ed321');
  // Rangliste unten
  if (state !== 'champion') {
  const top = GROUND + 105;
  ctx.fillStyle = 'rgba(26,26,46,.82)'; roundRect(20, top, W - 40, 190, 18); ctx.fill();
  txt(`Im Ziel / En meta: ${finishOrder.length}/${R.qualify}`, W / 2, top + 32, 18, '#ffd400');
  standings().slice(0, 5).forEach((r, i) => {
    const y = top + 64 + i * 26, q = i < R.qualify;
    ctx.textAlign = 'left'; ctx.font = '800 20px system-ui'; ctx.fillStyle = q ? '#fff' : '#ff8a8a';
    ctx.fillText(`${i + 1}. ${r.name}`, 50, y);
    ctx.textAlign = 'right'; ctx.fillStyle = q ? '#7ed321' : '#ff8a8a';
    ctx.fillText(finishOrder.includes(r) ? 'ZIEL ✓' : `${Math.max(0, Math.round((R.len - r.x) / 10))} m`, W - 50, y);
  });
  txt('Deine Marke morgen hier? Link in Bio', W / 2, H - 22, 19, '#fff');
  }
  if (state === 'countdown') { const n = Math.ceil(timer / 60); txt(banner, W / 2, 300, 44, '#ffd400'); txt(n > 0 ? n : 'GO!', W / 2, 400, 110); }
  if (state === 'result') { txt('QUALIFIZIERT!', W / 2, 280, 46, '#7ed321'); txt('¡CLASIFICADOS!', W / 2, 330, 34, '#7ed321');
    finishOrder.forEach((r, i) => txt(r.name, W / 2, 380 + i * 30, 24)); }
  if (state === 'champion') {
    const w = finishOrder[0];
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, W, H);
    txt('SIEGER DES TAGES', W / 2, 230, 46, '#ffd400');
    txt('CAMPEÓN DEL DÍA', W / 2, 280, 36, '#ffd400');
    const pop = Math.min(1, endFrames / 15);
    drawImg(`${w.color}_victory`, W / 2, 600, 280 * (.6 + .4 * pop) * (1 + Math.sin(frame / 5) * .03));
    txt(w.name, W / 2, 690, 64);
    txt('24h Top-Werbeplatz', W / 2, 745, 26, '#7ed321');
    txt('24h espacio principal', W / 2, 780, 22, '#7ed321');
    txt('Morgen neues Rennen · Mañana otra carrera', W / 2, 880, 19);
    txt('Link in Bio', W / 2, 915, 26, '#ffd400');
  }
}
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
