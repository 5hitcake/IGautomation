// Slime Rush – Reel-Engine 9:16 (1080x1920)
// Ablauf: Intro → 3 zufällige Minispiele → Finale (Kronenjagd) → Podest
// Alles Spielrelevante kommt aus einem Seed (Datum) → nachprüfbar, nicht manipuliert.
const W = 540, H = 960, S = 2, GY = 700;
const params = new URLSearchParams(location.search);
const SEED = params.get('seed') || new Date().toISOString().slice(0, 10);
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
cv.width = W * S; cv.height = H * S;
const IMG = {}; let loaded = 0; const keys = Object.keys(ASSETS);
keys.forEach(k => { const i = new Image(); i.onload = () => { if (++loaded === keys.length) boot(); }; i.src = ASSETS[k]; IMG[k] = i; });

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
const rnd = mulberry(hash(SEED));          // entscheidet das Spiel
const vr = mulberry(hash(SEED + '#fx'));    // nur Optik
const R = (a, b) => a + rnd() * (b - a), V = (a, b) => a + vr() * (b - a);
const pick = a => a[Math.floor(rnd() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sign = v => v < 0 ? -1 : 1;

const CASTX = typeof CAST !== 'undefined' ? CAST : null;  // optionale andere Besetzung (reel/cast_*.js)
const BRANDS = CASTX ? CASTX.brands : [
  ['Pepsy', 'blau'], ['Koka-Kola', 'rot'], ['Sprajt', 'gruen'], ['Fantasia', 'lila'],
  ['Red Bulle', 'blau'], ['Monstar', 'gruen'], ['Burger Kong', 'rot'], ['Milkah', 'lila'],
  ['Nike-ish', 'rot'], ['Adidaz', 'blau'], ['Starbacks', 'gruen'], ['Twitsch', 'lila'],
];
const HEX = { rot: '#e8413c', blau: '#3d8bff', gruen: '#4cbb2c', lila: '#9b59d6', ...(CASTX ? CASTX.hex : {}) };
// Bildname für Figur + Pose (Besetzungen mit eigenen Posen, z. B. Lauf-Animation)
function poseKey(color, pose, r) {
  if (!CASTX) return `${color}_${pose}`;
  if (pose === 'idle' && r && r.alive && r.vx > .5 && r.y >= GY - 2) return `${color}_run${Math.floor((step + r.i * 3) / 7) % 2 + 1}`;
  return `${color}_${CASTX.pose[pose] || pose}`;
}
const racers = BRANDS.map(([name, color], i) => ({ name, color, i, alive: true, x: 0, y: GY, vx: 0, vy: 0, pose: 'idle', sq: 0, size: 60 }));
const alive = (list = racers) => list.filter(r => r.alive);

// ---------- Ereignisse, Effekte, Ton ----------
let step = 0, frame = 0, shake = 0, punch = 0, slowmo = 0, finished = false, sceneIdx = 0;
const EVENTS = [], lastSfx = {}, fx = [], parts = [], callouts = [];
function sfx(t, gap = 4) { if (frame - (lastSfx[t] ?? -99) < gap) return; lastSfx[t] = frame; EVENTS.push([frame, t]); }
function callout(text, sub, col = '#ff5a4f') { callouts.push({ text, sub, col, t: 0 }); if (callouts.length > 3) callouts.shift(); }
function sprite(k, x, y, h, life = 40, o = {}) { fx.push({ k, x, y, h, life, max: life, ...o }); }
function burst(x, y, cols, n = 14, o = {}) {
  for (let i = 0; i < n; i++) parts.push({ x, y, vx: V(-5, 5) * (o.spread || 1), vy: V(-8, -1) * (o.up || 1), life: V(25, 45), col: cols[i % cols.length], size: V(3, 6), rot: V(0, 6), conf: o.conf });
}
function eliminate(r, how = 'RAUS! · ¡AFUERA!', silent) {
  r.alive = false; r.pose = 'eliminated'; r.outScene = sceneIdx; if (!silent) callout(r.name, how); sfx('elim', 8); punch = .05;
}
function killSome(cands, pool, keep, how) {
  const room = alive(pool).length - keep;
  cands.slice(0, Math.max(0, room)).forEach(r => eliminate(r, how));
  return cands.slice(Math.max(0, room));
}
function phys(r, gy) {
  r.vy += .6; r.y += r.vy; r.x += r.vx;
  if (r.y >= gy && r.vy >= 0) { if (r.vy > 5) { r.sq = 1; if (r.vy > 9) sprite('staub', r.x, gy + 4, 34, 22, { grow: .5 }); } r.y = gy; r.vy = 0; }
  r.sq *= .85;
}
function updateFx() {
  for (const f of fx) f.life--;
  for (let i = fx.length - 1; i >= 0; i--) if (fx[i].life <= 0) fx.splice(i, 1);
  for (const p of parts) { p.x += p.vx; p.y += p.vy; p.vy += p.conf ? .12 : .35; if (p.conf) p.vx *= .97; p.rot += .2; p.life--; }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].life <= 0) parts.splice(i, 1);
}

// ---------- Zeichnen ----------
function drawImg(k, x, y, h, o = {}) {
  const im = IMG[k]; const w = im.width * h / im.height;
  ctx.save(); ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  if (o.sx || o.sy) ctx.scale(o.sx || 1, o.sy || 1);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.drawImage(im, -w * (o.ax ?? .5), -h * (o.ay ?? 1), w, h); ctx.restore();
  return w;
}
function drawBg(k, pan = 0, dark = 0, h = H) {
  const im = IMG[k], w = im.width * h / im.height;
  let x0 = (W - w) / 2 - pan;
  const span = 2 * w; x0 = ((x0 % span) + span) % span - span;
  for (let i = 0; i < 4; i++) {
    const x = x0 + i * w; ctx.save();
    if (i % 2) { ctx.translate(x + w, 0); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, w, h); } else ctx.drawImage(im, x, 0, w, h);
    ctx.restore();
  }
  if (dark) { ctx.fillStyle = `rgba(10,10,30,${dark})`; ctx.fillRect(0, 0, W, H); }
}
function txt(s, x, y, size, col = '#fff', align = 'center') {
  ctx.font = `900 ${size}px system-ui, sans-serif`; ctx.textAlign = align; ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = '#1a1a2e'; ctx.strokeText(s, x, y);
  ctx.fillStyle = col; ctx.fillText(s, x, y);
}
function pill(x, y, w, h, col) { ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fillStyle = col; ctx.fill(); }
function drawSlime(r, o = {}) {
  const h = o.h || r.size, x = o.x ?? r.x, y = o.y ?? r.y, gy = o.gy ?? r.gy ?? GY;
  if (o.shadow !== false && y <= gy + 5) {
    const air = Math.max(0, gy - y), k = Math.max(.35, 1 - air / 220);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(x, gy + 3, h * .36 * k, h * .08 * k, 0, 0, 7); ctx.fill();
  }
  const sq = r.sq || 0, bob = r.pose === 'idle' && r.alive && !o.still ? Math.abs(Math.sin(step / 8 + r.i * 1.7)) * h * .05 : 0;
  drawImg(poseKey(r.color, r.pose, r), x, y + h * .05 - bob, h * (1 - sq * .22), { sx: 1 + sq * .22, rot: o.rot, alpha: o.alpha });
  if (o.tag !== false) {
    ctx.font = '800 12px system-ui, sans-serif'; const tw = ctx.measureText(r.name).width + 12, ty = y - h * .98 - bob;
    ctx.globalAlpha = o.alpha ?? 1; pill(x - tw / 2, ty - 13, tw, 17, HEX[r.color]);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(r.name, x, ty); ctx.globalAlpha = 1;
  }
}
function drawFx() {
  for (const f of fx) {
    const p = 1 - f.life / f.max;
    drawImg(f.k, f.x, f.y, f.h * (1 + (f.grow || 0) * p), { ay: f.ay ?? .7, alpha: Math.min(1, f.life / (f.max * .35)), rot: f.rot });
  }
  for (const p of parts) {
    ctx.globalAlpha = Math.min(1, p.life / 15); ctx.fillStyle = p.col;
    if (p.conf) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size); ctx.restore(); }
    else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}
function groundRow(k, y, h, overlap = 6, x0 = -40, x1 = W + 40) {
  const im = IMG[k], w = im.width * h / im.height;
  for (let x = x0; x < x1; x += w - overlap) ctx.drawImage(im, x, y, w, h);
}

// ---------- HUD ----------
let HUD = { title: '', sub: '' };
function hudTop(title, sub, n) {
  const g = ctx.createLinearGradient(0, 0, 0, 160); g.addColorStop(0, 'rgba(20,18,40,.95)'); g.addColorStop(1, 'rgba(20,18,40,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 160);
  txt(CASTX?.title || 'SLIME RUSH', W / 2, 46, 34, '#ffd400');
  txt(title, W / 2, 88, 26);
  if (sub) txt(sub, W / 2, 118, 16, '#9fe870');
}
function hudBottom() {
  const y0 = 800;
  ctx.fillStyle = 'rgba(20,18,40,.88)'; ctx.beginPath(); ctx.roundRect(12, y0, W - 24, 148, 18); ctx.fill();
  const n = alive().length;
  txt(`Noch ${n} · Quedan ${n}`, W / 2, y0 + 26, 17, '#ffd400');
  racers.forEach((r, i) => {
    const cx = 30 + (i % 4) * 124, cy = y0 + 52 + Math.floor(i / 4) * 32;
    ctx.globalAlpha = r.alive ? 1 : .35;
    drawImg(poseKey(r.color, r.alive ? 'idle' : 'eliminated'), cx + 10, cy + 12, CASTX ? 30 : 26);
    ctx.font = '800 13px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = r.alive ? '#fff' : '#ff8a8a';
    ctx.fillText(r.name, cx + 26, cy + 5);
    if (!r.alive) { ctx.strokeStyle = '#ff5a4f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + 24, cy); ctx.lineTo(cx + 26 + ctx.measureText(r.name).width, cy); ctx.stroke(); }
    ctx.globalAlpha = 1;
  });
}
function drawCallouts() {
  callouts.forEach((c, i) => {
    const t = c.t, s = t < 6 ? .4 + t * .14 : t < 10 ? 1.24 - (t - 6) * .06 : 1;
    const a = c.t > 60 ? 1 - (c.t - 60) / 15 : 1;
    ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(W / 2, 205 + i * 62); ctx.scale(s, s);
    txt(c.text, 0, 0, 30, '#fff'); if (c.sub) txt(c.sub, 0, 26, 18, c.col);
    ctx.restore();
  });
}

// ---------- Minispiele ----------
const OBST = ['saege', 'hammer', 'stacheln', 'kiste', 'schleim', 'speedpad', 'feder', 'steinblock'];
const GAMES = {
  // Leichtathletik-Hindernislauf im Stadion: 6 Bahnen, Hürden, Wassergraben, Pfützen, Hütchen, Banane
  track: {
    name: 'HINDERNISLAUF', short: 'LAUF', es: 'CARRERA DE OBSTÁCULOS', rule: 'Hürden, Pfützen & Wassergraben!', ruleEs: '¡Vallas, charcos y foso de agua!', icon: 'huerde', bg: 'bg_stadion',
    LANE: 21,
    setup(keep) {
      this.keep = keep; this.rs = alive(); this.len = CASTX?.len || 4600; this.Z = 1.45; this.cam = 0; this.fin = []; this.photo = false;
      const n = this.rs.length, all = () => Array(n).fill(true), some = k => { const a = Array(n).fill(false); for (let i = 0; i < k; i++) a[Math.floor(rnd() * n)] = true; return a; };
      this.obs = [];
      for (let x = 420; x < this.len - 260; x += R(210, 320)) {
        const type = pick(['huerde', 'huerde', 'huerde', 'balken', 'wassergraben', 'pfuetze', 'huetchen', 'banane']);
        const lanes = type === 'pfuetze' ? some(3) : type === 'huetchen' ? some(2) : type === 'banane' ? some(1) : all();
        this.obs.push({ type, x, lanes, down: Array(n).fill(false) });
        if (type === 'wassergraben') x += 120;
      }
      this.rs.forEach((r, i) => Object.assign(r, { lane: i, x: 70, y: GY, vx: 0, vy: 0, base: R(3.0, 3.5), stun: 0, slow: 0, boost: 0, done: false, passed: new Set(), size: CASTX?.size || 68, pose: 'idle' }));
    },
    off(l) { return (l - (this.rs.length - 1) / 2) * this.LANE; },
    update() {
      const view = W / this.Z;
      for (const r of alive(this.rs)) {
        if (r.done) { r.pose = 'idle'; r.vx = 0; phys(r, GY); continue; }
        let sp = r.base + (rnd() - .5) * .6;
        if (r.slow > 0) { sp *= .5; r.slow--; }
        if (r.stun > 0) { r.stun--; sp = r.stun > 25 ? -1.5 : .5; }
        r.vx = sp; phys(r, GY);
        r.pose = r.stun > 0 ? 'hit' : r.y < GY - 2 ? 'jump' : 'idle';
        const vis = r.x > this.cam - 40 && r.x < this.cam + view + 40, ly = GY + this.off(r.lane);
        for (const o of this.obs) {
          if (!o.lanes[r.lane] || r.passed.has(o) || r.x < o.x - 45) continue;
          r.passed.add(o);
          const fall = (stun, s) => { r.stun = stun; r.vy = -5; sprite('staub', r.x, ly, 46, 24, { grow: .6 }); burst(r.x, ly - 30, ['#fff', '#ffd400'], 10); if (vis) { sfx(s); shake = 6; } };
          if (o.type === 'huerde') { if (rnd() < .2) { o.down[r.lane] = true; fall(40, 'bonk'); } else r.vy = -11; }
          else if (o.type === 'balken') { if (rnd() < .15) fall(55, 'hit'); else r.vy = -12.5; }
          else if (o.type === 'wassergraben') { r.vy = -12; if (rnd() < .4) { r.slow = 80; r.wet = 40; } }
          else if (o.type === 'pfuetze') { r.slow = 45; burst(r.x, ly - 4, ['#5cc8ff', '#bfeaff', '#fff'], 12); if (vis) sfx('splash'); }
          else if (o.type === 'huetchen') { if (rnd() < .3) { o.down[r.lane] = true; fall(25, 'bonk'); } else r.vy = -9; }
          else if (o.type === 'banane') { if (rnd() < .6) { fall(60, 'slip'); if (vis) callout(r.name, 'AUSGERUTSCHT! · ¡SE RESBALÓ!', '#ffd400'); } else r.vy = -9; }
        }
        if (r.wet > 0 && --r.wet === 0) { burst(r.x, ly - 6, ['#5cc8ff', '#bfeaff', '#fff'], 18); if (vis) { sfx('splash'); callout(r.name, 'PLATSCH! · ¡SPLASH!', '#5cc8ff'); } }
        if (r.x >= this.len) {
          r.done = true; this.fin.push(r); sfx('ding', 2);
          if (this.fin.length === 1) { callout(r.name, '1. IM ZIEL! · ¡PRIMERO!', '#9fe870'); burst(this.len, GY - 60, ['#ffd400', '#fff', '#ff5a4f'], 24, { conf: true }); }
        }
      }
      if (!this.photo && this.fin.length === this.keep - 1 && alive(this.rs).some(r => !r.done && this.len - r.x < 60)) { this.photo = true; slowmo = 45; callout('FOTOFINISH!', '¡PHOTO FINISH!', '#ffd400'); }
      const lead = Math.max(...alive(this.rs).map(r => r.x));
      this.cam += (clamp(lead - view * .45, 0, this.len - view + 160) - this.cam) * .08;
      if (this.fin.length >= this.keep) { const out = alive(this.rs).filter(r => !r.done); out.forEach(r => eliminate(r, '', true)); callout(`${out.length} RAUS!`, 'ZU LANGSAM · ¡MUY LENTOS!'); return true; }
    },
    draw() {
      const Z = this.Z, n = this.rs.length, L = this.LANE, top = GY - (n / 2 + .6) * L, bot = GY + (n / 2 + .4) * L;
      drawBg(this.bg, this.cam * .3, 0, GY + (top - GY) * Z + 4);
      ctx.save(); ctx.translate(0, GY); ctx.scale(Z, Z); ctx.translate(-this.cam, -GY);
      const x0 = this.cam - 80, x1 = this.cam + W / Z + 80;
      // Tartanbahn mit Bahnlinien
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x0, top - 3, x1 - x0, 3);
      ctx.fillStyle = '#d4553d'; ctx.fillRect(x0, top, x1 - x0, bot - top + 2);
      ctx.fillStyle = '#4caf3a'; ctx.fillRect(x0, bot + 2, x1 - x0, 400);
      ctx.fillStyle = '#3d9a2e'; for (let x = Math.floor(x0 / 80) * 80; x < x1; x += 160) ctx.fillRect(x, bot + 2, 80, 400);
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (let k = 0; k <= n; k++) ctx.fillRect(x0, GY + (k - n / 2) * L + 2, x1 - x0, 1.2);
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      for (let x = 0; x <= this.len; x += 500) if (x > 0 && x < this.len) { ctx.font = '900 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`${x / 10} m`, x, bot - 2); }
      // Ziellinie (Schachbrett über alle Bahnen)
      for (let y = top; y < bot; y += 5) for (let k = 0; k < 2; k++) { ctx.fillStyle = (Math.round((y - top) / 5) + k) % 2 ? '#fff' : '#222'; ctx.fillRect(this.len - 5 + k * 5, y, 5, 5); }
      drawImg('zielflagge', this.len + 14, top + 2, 120, { ax: .2 });
      if (!this.fin.length) drawImg('zielband', this.len, top + 10, 70);
      // Bahn für Bahn von hinten nach vorne: Startblock, Hindernisse, Läufer
      for (let l = 0; l < n; l++) {
        const ly = GY + this.off(l);
        drawImg('startblock', 52, ly + 3, 16);
        for (const o of this.obs) {
          if (!o.lanes[l] || o.x < x0 - 100 || o.x > x1 + 100) continue;
          const d = o.down[l];
          if (o.type === 'huerde') drawImg('huerde', o.x, ly + 3, d ? 24 : 48, { rot: d ? .9 : 0, ay: d ? .6 : 1 });
          else if (o.type === 'balken') drawImg('balken', o.x, ly + 3, 46);
          else if (o.type === 'wassergraben') { drawImg('pfuetze', o.x + 75, ly + 6, 16, { sx: 1.6 }); drawImg('balken', o.x, ly + 3, 46); }
          else if (o.type === 'pfuetze') drawImg('pfuetze', o.x, ly + 6, 15);
          else if (o.type === 'huetchen') drawImg('huetchen', o.x + (d ? 14 : 0), ly + 3, d ? 20 : 34, { rot: d ? 1.4 : 0, ay: d ? .5 : 1 });
          else if (o.type === 'banane') drawImg('banane', o.x, ly + 3, 18);
        }
        alive(this.rs).concat(this.rs.filter(r => !r.alive)).filter(r => r.lane === l).forEach(r => drawSlime(r, { y: r.y + this.off(l), gy: ly }));
      }
      drawFx(); ctx.restore();
    },
  },
  race: {
    name: 'HINDERNISRENNEN', short: 'RENNEN', es: 'CARRERA DE OBSTÁCULOS', rule: 'Die Schnellsten kommen weiter', ruleEs: 'Pasan los más rápidos', icon: 'saege', bg: 'bg',
    setup(keep) {
      this.keep = keep; this.rs = alive(); this.len = CASTX?.len || 3600; this.Z = 1.6; this.cam = 0; this.fin = []; this.photo = false;
      this.obs = []; for (let x = 520; x < this.len - 250; x += R(250, 420)) this.obs.push({ type: pick(OBST), x, ph: rnd() * 6.28 });
      this.coins = []; for (let x = 420; x < this.len; x += R(300, 600)) this.coins.push({ x, y: GY - R(110, 170), got: false });
      this.rs.forEach((r, i) => Object.assign(r, { x: 60 + (i % 6) * 14, y: GY, vx: 0, vy: 0, base: R(3.0, 3.5), stun: 0, slow: 0, boost: 0, done: false, passed: new Set(), size: CASTX?.size || 56, pose: 'idle' }));
    },
    update() {
      const view = W / this.Z;
      for (const r of alive(this.rs)) {
        if (r.done) { r.pose = 'idle'; r.vx = 0; phys(r, GY); continue; }
        let sp = r.base + (rnd() - .5) * .6;
        if (r.slow > 0) { sp *= .45; r.slow--; }
        if (r.boost > 0) { sp *= 1.8; r.boost--; }
        if (r.stun > 0) { r.stun--; sp = r.stun > 30 ? -2.5 : 0; }
        r.vx = sp; phys(r, GY);
        r.pose = r.stun > 0 ? 'hit' : r.y < GY - 2 ? 'jump' : 'idle';
        const vis = r.x > this.cam - 40 && r.x < this.cam + view + 40;
        for (const o of this.obs) {
          if (r.passed.has(o) || r.x < o.x - 60) continue;
          r.passed.add(o);
          if (o.type === 'schleim') { r.slow = 70; burst(r.x, GY, ['#7ed321', '#5cb515'], 8); if (vis) sfx('splat'); continue; }
          if (o.type === 'speedpad') { r.boost = 60; burst(r.x, GY, ['#ffd400'], 8); if (vis) sfx('zoom'); continue; }
          if (o.type === 'feder') { r.vy = -17; o.bounce = 1; if (vis) sfx('boing'); continue; }
          const hit = { saege: .33, hammer: .33, stacheln: .28, kiste: .18, steinblock: .18 }[o.type];
          if (rnd() < hit) { r.stun = 55; r.vy = -6; sprite('staub', r.x, GY, 50, 26, { grow: .6 }); burst(r.x, r.y - 30, ['#fff', '#ffd400'], 10); if (vis) { sfx('hit'); shake = 7; } }
          else r.vy = o.type === 'steinblock' || o.type === 'kiste' ? -14 : -12;
        }
        for (const c of this.coins) if (!c.got && Math.abs(c.x - r.x) < 30 && Math.abs(c.y - (r.y - 30)) < 55) { c.got = true; burst(c.x, c.y, ['#ffcc00', '#fff4a0'], 10); if (vis) sfx('coin'); }
        if (r.x >= this.len) {
          r.done = true; this.fin.push(r); sfx('ding', 2);
          if (this.fin.length === 1) callout(r.name, '1. IM ZIEL! · ¡PRIMERO!', '#9fe870');
        }
      }
      // Fotofinish: knapper Kampf um den letzten Platz
      if (!this.photo && this.fin.length === this.keep - 1 && alive(this.rs).some(r => !r.done && this.len - r.x < 60)) { this.photo = true; slowmo = 45; callout('FOTOFINISH!', '¡PHOTO FINISH!', '#ffd400'); }
      const lead = Math.max(...alive(this.rs).map(r => r.x));
      this.cam += (clamp(lead - view * .45, 0, this.len - view + 160) - this.cam) * .08;
      if (this.fin.length >= this.keep) { const out = alive(this.rs).filter(r => !r.done); out.forEach(r => eliminate(r, '', true)); callout(`${out.length} RAUS!`, 'ZU LANGSAM · ¡MUY LENTOS!'); return true; }
    },
    draw() {
      drawBg(this.bg, this.cam * .3);
      ctx.save(); ctx.translate(0, GY); ctx.scale(this.Z, this.Z); ctx.translate(-this.cam, -GY);
      for (let x = 300; x < this.len; x += 1300) { drawImg('schild', x, GY + 6, 200); txt('DEIN LOGO', x + 6, GY - 136, 20, '#fff'); txt('HIER', x + 6, GY - 112, 20, '#fff'); }
      ctx.fillStyle = '#6b3f1d'; ctx.fillRect(this.cam - 60, GY + 40, W, 400);
      groundRow('boden_lang', GY - 22, 120, 30, Math.floor(this.cam / 500) * 500 - 600, this.cam + W + 200);
      drawImg('zielflagge', this.len + 12, GY + 4, 170, { ax: .2 });
      for (let y = GY - 150; y < GY; y += 15) for (let k = 0; k < 2; k++) { ctx.fillStyle = ((y / 15 + k) % 2) ? '#fff' : '#222'; ctx.fillRect(this.len - 16 + k * 8, y, 8, 15); }
      const t = step / 60;
      for (const c of this.coins) if (!c.got) drawImg('muenze', c.x, c.y + Math.sin(t * 3 + c.x) * 6, 36, { ay: .5, sx: Math.max(.15, Math.abs(Math.cos(t * 2.5 + c.x))) });
      for (const o of this.obs) {
        if (o.type === 'saege') drawImg('saege', o.x, GY - 40, 90, { ay: .5, rot: t * 12 });
        else if (o.type === 'hammer') drawImg('hammer', o.x, GY - 150, 130, { ax: .9, ay: .1, rot: Math.sin(t * 3 + o.ph) * .9 - .3 });
        else if (o.type === 'feder') { o.bounce = (o.bounce || 0) * .9; drawImg('feder', o.x, GY + 6, 70, { sy: 1 - (o.bounce || 0) * .4 }); }
        else if (o.type === 'schleim') drawImg('schleim', o.x, GY + 12, 34);
        else if (o.type === 'speedpad') drawImg('speedpad', o.x, GY + 10, 30);
        else if (o.type === 'stacheln') drawImg('stacheln', o.x, GY + 6, 60);
        else drawImg(o.type, o.x, GY + 6, 62);
      }
      if (CASTX) { const lane = r => ((r.i * 5) % 6 - 2.5) * 9;  // leichte Tiefenstaffelung, damit sich die Figuren nicht verdecken
        [...this.rs].sort((a, b) => lane(a) - lane(b) || a.x - b.x).forEach(r => drawSlime(r, { y: r.y + lane(r), gy: GY + lane(r) }));
      } else [...this.rs].sort((a, b) => a.x - b.x).forEach(r => drawSlime(r));
      drawFx(); ctx.restore();
    },
  },

  meteor: {
    name: 'METEORITENREGEN', short: 'METEORE', es: 'LLUVIA DE METEORITOS', rule: 'Nicht getroffen werden!', ruleEs: '¡Que no te pegue!', icon: 'meteor', bg: 'bg_lava',
    setup(keep) {
      this.keep = keep; this.rs = alive(); const n = this.rs.length; this.ms = []; this.t = 0; this.next = 90;
      this.rs.forEach((r, i) => Object.assign(r, { x: 40 + (i + .5) * (W - 80) / n, y: GY, vx: 0, vy: 0, tx: 0, ag: R(.05, .1), size: n > 8 ? 58 : 70, pose: 'idle' }));
      this.rs.forEach(r => r.tx = r.x);
    },
    update() {
      this.t++;
      if (--this.next <= 0) {
        const tgt = rnd() < .55 ? pick(alive(this.rs)).x + R(-25, 25) : R(40, W - 40);
        this.ms.push({ x: clamp(tgt, 30, W - 30), t: 0, warn: 75 }); this.next = Math.max(24, 85 - this.t / 30);
      }
      for (const m of this.ms) {
        m.t++;
        if (m.t === Math.round(m.warn * .5)) sfx('whoosh', 6);
        if (m.t === m.warn) {
          sprite('explosion', m.x, GY + 10, 130, 30, { grow: .4 }); burst(m.x, GY - 10, ['#ff7a00', '#ffd400', '#5a3a2a'], 18);
          shake = 12; sfx('boom', 3);
          const hits = alive(this.rs).filter(r => Math.abs(r.x - m.x) < 38 && r.y > GY - 40).sort((a, b) => Math.abs(a.x - m.x) - Math.abs(b.x - m.x));
          const saved = killSome(hits, this.rs, this.keep, 'GETROFFEN! · ¡LE DIO!');
          hits.filter(r => !r.alive).forEach(r => { r.vy = -13; r.vx = sign(r.x - m.x) * R(2, 5); r.fly = true; });
          saved.forEach(r => { callout(r.name, 'KNAPP! · ¡POR POCO!', '#ffd400'); });
          alive(this.rs).forEach(r => { const d = r.x - m.x; if (Math.abs(d) < 95) { r.vx = sign(d) * 6; r.vy = -7; } });
        }
      }
      this.ms = this.ms.filter(m => m.t < m.warn);
      for (const r of this.rs) {
        if (!r.alive) { if (r.fly) { r.vy += .5; r.x += r.vx; r.y += r.vy; } continue; }
        const d = this.ms.find(m => Math.abs(m.x - r.x) < 55);
        if (d && rnd() < r.ag) r.tx = clamp(r.x + (r.x < d.x ? -1 : 1) * R(70, 150), 30, W - 30);
        else if (rnd() < .006) r.tx = R(40, W - 40);
        if (r.y >= GY && Math.abs(r.tx - r.x) > 10 && rnd() < .12) { r.vy = -7; r.vx = sign(r.tx - r.x) * R(2.5, 3.8); }
        if (r.y >= GY) r.vx *= .7;
        phys(r, GY); r.x = clamp(r.x, 20, W - 20);
        r.pose = r.y < GY - 2 ? 'jump' : d ? 'hit' : 'idle';
      }
      return alive(this.rs).length <= this.keep;
    },
    draw() {
      drawBg(this.bg, 0);
      ctx.fillStyle = '#2a1a14'; ctx.fillRect(0, GY + 30, W, H);
      groundRow('steinblock', GY - 6, 72, 4);
      for (const m of this.ms) {
        const p = m.t / m.warn, pul = .5 + .5 * Math.sin(m.t / 3);
        ctx.fillStyle = `rgba(255,40,20,${.25 + .35 * p * pul})`; ctx.beginPath(); ctx.ellipse(m.x, GY + 4, 20 + 22 * p, 7 + 6 * p, 0, 0, 7); ctx.fill();
        if (p > .4) { const q = (p - .4) / .6; drawImg('meteor', m.x + 260 * (1 - q), GY - 10 - 640 * (1 - q), 92, { ax: .3, ay: .72 }); }
      }
      this.rs.filter(r => r.alive || (r.outScene === sceneIdx && r.y < H + 100)).forEach(r => drawSlime(r, { rot: r.fly ? r.y / 30 : 0, shadow: r.alive }));
      drawFx();
    },
  },

  ice: {
    name: 'DÜNNES EIS', short: 'EIS', es: 'HIELO FINO', rule: 'Schollen brechen – rechtzeitig springen!', ruleEs: '¡Saltá antes de que se rompa!', icon: 'eisblock', bg: 'bg_eis',
    setup(keep) {
      this.keep = keep; this.rs = alive(); const n = this.rs.length; this.t = 0; this.next = 90; this.WY = GY + 70;
      this.tiles = [...Array(6)].map((_, i) => ({ x: (i + .5) * W / 6, y: GY, st: 'ok', t: 0, vy: 0 }));
      this.rs.forEach((r, i) => { const k = i % 6, nOn = Math.floor(i / 6); Object.assign(r, { tile: k, x: this.tiles[k].x + (n > 6 ? (nOn ? 17 : -17) : 0), y: GY, vx: 0, vy: 0, ag: R(.025, .07), size: n > 8 ? 54 : 66, pose: 'idle', sink: false }); });
    },
    hop(r) {
      const ok = this.tiles.map((t, i) => ({ t, i })).filter(o => o.t.st === 'ok');
      if (!ok.length) return;
      ok.sort((a, b) => Math.abs(a.t.x - r.x) - Math.abs(b.t.x - r.x));
      const o = ok[Math.min(ok.length - 1, rnd() < .7 ? 0 : 1)];
      r.tile = o.i; const tx = o.t.x + R(-18, 18); r.vy = -10; r.vx = (tx - r.x) / 33; sfx('jump', 3);
    },
    update() {
      this.t++;
      const intact = this.tiles.filter(t => t.st === 'ok');
      if (--this.next <= 0 && intact.length > 1) {
        const occ = intact.filter(t => alive(this.rs).some(r => this.tiles[r.tile] === t));
        const t = (occ.length && rnd() < .75) ? pick(occ) : pick(intact);
        t.st = 'crack'; t.t = 0; sfx('crack', 2); this.next = Math.max(40, 105 - this.t / 18);
      }
      for (const t of this.tiles) {
        t.t++;
        if (t.st === 'crack' && t.t >= 65) { t.st = 'fall'; t.vy = 0; }
        if (t.st === 'fall') {
          t.vy += .45; t.y += t.vy;
          if (t.y > this.WY - 20 && !t.splashed) { t.splashed = true; burst(t.x, this.WY, ['#bfefff', '#ffffff', '#7fd3ff'], 16); sfx('splash', 3); }
          if (t.y > H) { t.st = 'gone'; t.splashed = false; }
        }
        if (t.st === 'rise') { t.y += (GY - t.y) * .08; if (Math.abs(t.y - GY) < 1) { t.y = GY; t.st = 'ok'; } }
      }
      if (this.tiles.filter(t => t.st === 'ok' || t.st === 'rise').length < 2) {
        const g = this.tiles.find(t => t.st === 'gone'); if (g) { g.st = 'rise'; g.y = GY + 160; callout('NEUE SCHOLLE!', '¡NUEVO HIELO!', '#7fd3ff'); }
      }
      for (const r of this.rs) {
        if (!r.alive) { if (r.sink) { r.vy += .4; r.y += r.vy; } continue; }
        const t = this.tiles[r.tile];
        if (t.st === 'crack' && r.y >= t.y - 1 && rnd() < r.ag) this.hop(r);
        if (t.st === 'fall' && r.y >= t.y - 30 && r.vy >= 0 && Math.abs(r.x - t.x) < 50) {
          const saved = killSome([r], this.rs, this.keep, 'EINGEBROCHEN! · ¡AL AGUA!');
          if (saved.length) { this.hop(r); callout(r.name, 'GERETTET! · ¡SE SALVÓ!', '#9fe870'); } else { r.sink = true; continue; }
        }
        const gt = this.tiles[r.tile], gy = (gt.st === 'ok' || gt.st === 'crack') ? gt.y : H + 200;
        if (r.y < gy || r.vy < 0) { r.vy += .6; r.y += r.vy; r.x += r.vx; if (r.y >= gy && r.vy > 0) { r.y = gy; r.vy = 0; r.vx = 0; r.sq = 1; } }
        r.sq *= .85;
        if (gt.st === 'crack' && r.y >= gt.y - 1) r.y = gt.y + Math.sin(this.t) * 1.5;
        r.pose = r.vy !== 0 ? 'jump' : gt.st === 'crack' ? 'hit' : 'idle';
      }
      return alive(this.rs).length <= this.keep;
    },
    draw() {
      drawBg(this.bg, 0);
      const g = ctx.createLinearGradient(0, this.WY, 0, H); g.addColorStop(0, '#5fc8f0'); g.addColorStop(1, '#13507a');
      ctx.fillStyle = g; ctx.fillRect(0, this.WY, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); for (let x = 0; x <= W; x += 10) ctx.lineTo(x, this.WY + 12 + i * 22 + Math.sin(x / 30 + step / 15 + i) * 3); ctx.stroke(); }
      for (const t of this.tiles) {
        if (t.st === 'gone') continue;
        const jit = t.st === 'crack' ? Math.sin(t.t * 1.3) * 3 : 0;
        drawImg('eisblock', t.x + jit, t.y - 10, 72, { ay: 0, alpha: t.st === 'crack' ? .8 + .2 * Math.sin(t.t / 2) : 1 });
      }
      this.rs.filter(r => r.alive || (r.outScene === sceneIdx && r.y < this.WY + 40)).forEach(r => drawSlime(r, { shadow: false, alpha: r.alive ? 1 : clamp((this.WY + 40 - r.y) / 60, 0, 1) }));
      drawFx();
    },
  },

  sumo: {
    name: 'SUMO-INSEL', short: 'SUMO', es: 'ISLA SUMO', rule: 'Wer runterfällt, ist raus', ruleEs: 'El que se cae, queda afuera', icon: 'insel', bg: 'bg',
    setup(keep) {
      this.keep = keep; this.rs = alive(); const n = this.rs.length; this.t = 0; this.cx = W / 2; this.SY = 600; this.Rad = 215;
      this.rs.forEach((r, i) => Object.assign(r, { x: this.cx - 180 + (i + .5) * 360 / n, y: this.SY, vx: 0, vy: 0, str: R(.75, 1.25), size: n > 8 ? 56 : 68, pose: 'idle', falling: false, saveUsed: false, gy: this.SY }));
    },
    update() {
      this.t++; this.Rad = Math.max(85, 215 - Math.max(0, this.t - 300) * .06);
      const al = alive(this.rs);
      for (const r of al) {
        const on = Math.abs(r.x - this.cx) <= this.Rad + 8;
        const grounded = r.y >= this.SY - .5 && on;
        if (grounded && rnd() < .014) { const o = pick(al); if (o !== r) { r.vx += sign(o.x - r.x) * R(2, 4.5) * r.str; r.vy = -R(3, 7); } }
        if (grounded) r.vx *= .9;
        r.vy += .6; r.y += r.vy; r.x += r.vx;
        if (on && r.y >= this.SY && r.y - r.vy <= this.SY + 1) { if (r.vy > 5) r.sq = 1; r.y = this.SY; r.vy = 0; }
        r.sq *= .85;
        if (!on && r.y >= this.SY - 2) {
          if (!r.saveUsed && rnd() < .5) { r.saveUsed = true; r.vx = -sign(r.x - this.cx) * 6; r.vy = -9; callout(r.name, 'GERETTET! · ¡SE SALVÓ!', '#9fe870'); sfx('boing'); }
          else if (killSome([r], this.rs, this.keep, 'RUNTERGEFALLEN! · ¡SE CAYÓ!').length === 0) { r.falling = true; sfx('whoosh', 3); }
          else { r.vx = -sign(r.x - this.cx) * 6; r.vy = -9; }
        }
        r.pose = r.vy < -1 ? 'jump' : Math.abs(r.vx) > 4 ? 'hit' : 'idle';
      }
      for (let i = 0; i < al.length; i++) for (let j = i + 1; j < al.length; j++) {
        const a = al[i], b = al[j], d = b.x - a.x;
        if (Math.abs(d) < 27 && Math.abs(a.y - b.y) < 30 && a.alive && b.alive && !(a.cd > 0) && !(b.cd > 0)) {
          a.cd = b.cd = 25;
          const p = R(2, 4.5), s = sign(d);
          a.vx = -s * p * b.str * .6; b.vx = s * p * a.str * .6; a.vy = Math.min(a.vy, -3); b.vy = Math.min(b.vy, -3);
          a.x -= s * 4; b.x += s * 4; sfx('bonk', 3); burst((a.x + b.x) / 2, a.y - 25, ['#fff', '#ffd400'], 6);
        }
      }
      for (const r of al) r.cd = (r.cd || 0) - 1;
      for (const r of this.rs) if (!r.alive && r.falling) { r.vy += .5; r.y += r.vy; r.x += r.vx; }
      return alive(this.rs).length <= this.keep;
    },
    draw() {
      drawBg(this.bg, 0);
      const w = 2 * this.Rad + 70, h = w * IMG.insel.height / IMG.insel.width;
      drawImg('insel', this.cx, this.SY - h * .09 + Math.sin(step / 40) * 2, h, { ay: 0, sx: 1 });
      this.rs.filter(r => r.alive || (r.outScene === sceneIdx && r.y < H + 80)).forEach(r => drawSlime(r, { gy: this.SY, shadow: r.alive && Math.abs(r.x - this.cx) < this.Rad }));
      drawFx();
    },
  },

  bomb: {
    name: 'HEISSE BOMBE', short: 'BOMBE', es: 'BOMBA CALIENTE', rule: 'Wer sie beim Knall hält, fliegt raus', ruleEs: 'Al que le explota, queda afuera', icon: 'bombe', bg: 'bg_eis',
    setup(keep) {
      this.keep = keep; this.rs = alive(); this.fly = null; this.pause = 0; this.end = false;
      this.place(true); this.holder = pick(this.rs); this.fuse = Math.round(R(160, 280)); this.pass = R(30, 60);
    },
    place(instant) {
      const al = alive(this.rs), n = al.length;
      al.forEach((r, i) => { r.tx = 40 + (i + .5) * (W - 80) / n; r.size = n > 8 ? 52 : 66; if (instant) Object.assign(r, { x: r.tx, y: GY, vx: 0, vy: 0, pose: 'idle' }); });
    },
    update() {
      const al = alive(this.rs);
      if (this.pause > 0) {
        if (--this.pause === 0) { if (al.length <= this.keep) return true; this.place(false); this.holder = pick(al); this.fuse = Math.round(R(140, 270)); this.pass = R(40, 70); sfx('catch'); }
      } else if (this.fly) {
        if (++this.fly.t >= 26) { this.holder = this.fly.to; this.fly = null; sfx('catch', 2); }
      } else {
        this.fuse--; this.pass--;
        if (this.fuse % (this.fuse > 90 ? 30 : 10) === 0) sfx('tick', 1);
        if (this.fuse <= 0) {
          const h = this.holder; sprite('explosion', h.x, GY + 10, 160, 34, { grow: .5 }); burst(h.x, GY - 30, ['#ff7a00', '#ffd400', '#333'], 22);
          shake = 15; sfx('boom', 2); eliminate(h, 'BUMM! · ¡BUM!'); h.vy = -15; h.vx = R(-3, 3); h.fly = true; this.pause = 75; this.holder = null;
        } else if (this.pass <= 0) {
          const others = al.filter(r => r !== this.holder); const to = pick(others);
          this.fly = { from: this.holder, to, t: 0 }; this.holder = null; this.pass = R(25, 70) * (this.fuse < 80 ? .5 : 1); sfx('throw', 2);
        }
      }
      for (const r of this.rs) {
        if (!r.alive) { if (r.fly) { r.vy += .5; r.x += r.vx; r.y += r.vy; } continue; }
        if (r.y >= GY && Math.abs(r.tx - r.x) > 6 && rnd() < .15) { r.vy = -6; r.vx = (r.tx - r.x) / 22; }
        if (r.y >= GY) r.vx = 0;
        phys(r, GY);
        r.pose = r === this.holder ? (this.fuse < 70 ? 'hit' : 'jump') : r.y < GY - 2 ? 'jump' : 'idle';
        if (r === this.holder) r.y = Math.min(r.y, GY - Math.abs(Math.sin(step / 3)) * 6);
      }
    },
    bombPos() {
      if (this.holder) return [this.holder.x, this.holder.y - this.holder.size * 1.05];
      if (this.fly) { const p = this.fly.t / 26, a = this.fly.from, b = this.fly.to; return [a.x + (b.x - a.x) * p, (a.y - a.size) + ((b.y - b.size) - (a.y - a.size)) * p - Math.sin(p * Math.PI) * 120]; }
      return null;
    },
    draw() {
      drawBg(this.bg, 0);
      ctx.fillStyle = '#cfe9f5'; ctx.fillRect(0, GY + 40, W, H);
      groundRow('eisboden', GY - 18, 95, 10);
      this.rs.filter(r => r.alive || (r.outScene === sceneIdx && r.y < H + 80)).forEach(r => drawSlime(r, { rot: r.fly ? r.y / 40 : 0, shadow: r.alive }));
      const b = this.bombPos();
      if (b) {
        const hot = this.fuse < 70 && Math.floor(step / 4) % 2;
        drawImg('bombe', b[0], b[1], 46 * (hot ? 1.12 : 1), { ay: .6, rot: this.fly ? this.fly.t / 4 : 0 });
        if (vr() < .6) parts.push({ x: b[0] + 12, y: b[1] - 34, vx: V(-1.5, 1.5), vy: V(-3, -1), life: 12, col: '#ffd400', size: 2.5 });
        if (this.fuse < 90) txt(String(Math.ceil(this.fuse / 30)), b[0], b[1] - 50, 22, '#ff5a4f');
      }
      drawFx();
    },
  },
};

// ---------- Finale: Kronenjagd ----------
const FINALE = {
  name: 'FINALE: KRONENJAGD', es: 'FINAL: CAZA DE LA CORONA', rule: 'Wer zuerst die Krone hat, gewinnt', ruleEs: 'El primero en agarrar la corona gana', icon: 'krone', bg: 'bg_lava',
  setup() {
    this.rs = alive(); this.top = 210; this.base = 770; this.win = null; this.t = 0; this.after = 0;
    const xs = [W / 2 - 92, W / 2, W / 2 + 92].sort(() => rnd() - .5);
    this.rs.forEach((r, i) => Object.assign(r, { x: xs[i % 3], y: this.base, vx: 0, vy: 0, sp: R(.55, .72), slide: 0, size: 82, pose: 'idle' }));
  },
  update() {
    this.t++;
    if (this.win) {
      const w = this.win; this.after++;
      if (this.after % 25 === 1) burst(V(80, W - 80), V(200, 400), ['#ff5a4f', '#ffd400', '#3d8bff', '#4cbb2c', '#9b59d6'], 24, { conf: true, spread: 1.5 });
      return this.after > 200;
    }
    for (const r of this.rs) {
      if (r.slide > 0) { r.y += 4.5; r.slide -= 4.5; r.pose = 'hit'; if (r.y > this.base) { r.y = this.base; r.slide = 0; } continue; }
      if (this.t > 30 && r.y < this.base - 80 && rnd() < .0026) { r.slide = R(60, 140); callout(r.name, 'RUTSCHT AB! · ¡SE RESBALA!', '#ffd400'); sfx('slip', 6); sprite('staub', r.x, r.y, 40, 24, { grow: .5 }); continue; }
      r.y -= r.sp * (1 + .35 * Math.sin(step / 7 + r.i));
      r.pose = Math.floor((step + r.i * 5) / 12) % 2 ? 'jump' : 'idle';
      if (r.y <= this.top) {
        r.y = this.top; this.win = r; r.pose = 'victory'; slowmo = 60; shake = 10; sfx('fanfare', 1); sfx('cheer', 1);
        burst(r.x, r.y - 60, ['#ff5a4f', '#ffd400', '#3d8bff', '#4cbb2c', '#9b59d6'], 40, { conf: true, spread: 1.6, up: 1.3 });
        sprite('konfetti', r.x, r.y - 30, 160, 50, { grow: .4 });
        callout(r.name, 'HAT DIE KRONE! · ¡TIENE LA CORONA!', '#ffd400');
        this.rank = [r, ...this.rs.filter(o => o !== r).sort((a, b) => a.y - b.y)];
        this.rank.slice(1).forEach(o => { o.pose = 'idle'; });
      }
    }
  },
  draw() {
    drawBg(this.bg, 0);
    drawImg('turm', W / 2, 800, 640);
    const w = this.win, cx = w ? w.x : W / 2, cy = w ? w.y - 70 + Math.sin(step / 6) * 2 : 150 + Math.sin(step / 20) * 8;
    if (!w) { ctx.fillStyle = 'rgba(255,220,80,.25)'; ctx.beginPath(); ctx.arc(cx, cy - 20, 50 + Math.sin(step / 10) * 6, 0, 7); ctx.fill(); }
    this.rs.forEach(r => drawSlime(r, { shadow: false, h: r === w ? 100 : 82 }));
    drawImg('krone', cx, w ? cy - 18 : cy, w ? 50 : 64, { ay: .7 });
    if (!w) {
      // Höhenanzeige
      this.rs.forEach((r, i) => { const p = clamp((this.base - r.y) / (this.base - this.top), 0, 1); txt(`${Math.round(p * 100)}%`, r.x, r.y + 22, 15, HEX[r.color]); });
    }
    drawFx();
  },
};

// ---------- Szenen ----------
const POOL = ['race', 'meteor', 'ice', 'sumo', 'bomb'];
const picked = []; if (CASTX) picked.push(CASTX.game || 'race'); else { const p = [...POOL]; while (picked.length < 3) picked.push(p.splice(Math.floor(rnd() * p.length), 1)[0]); }
const KEEP = [8, 5, 3];
let podiumRank = null;

function introScene() {
  let t = 0;
  return {
    update() {
      t++; const k = Math.floor((t - 40) / 7);
      if (t >= 40 && (t - 40) % 7 === 0 && k < racers.length) sfx('pop', 1);
      return t > 360;
    },
    draw() {
      drawBg(CASTX?.bg || 'bg', t * .4, .45);
      txt(CASTX?.title || 'SLIME RUSH', W / 2, 100, 58, '#ffd400');
      txt(`Tagesrennen · Carrera del día · ${SEED}`, W / 2, 134, 16, '#ddd');
      const s = t < 10 ? .5 + t * .06 : 1;
      ctx.save(); ctx.translate(W / 2, 215); ctx.scale(s, s);
      const N = racers.length; txt(`${N} ${CASTX ? 'LÄUFER' : 'MARKEN'}`, 0, 0, 56, '#fff'); txt('NUR 1 GEWINNT', 0, 46, 38, '#ff5a4f'); txt(`${N} ${CASTX ? 'CORREDORES' : 'MARCAS'} · SOLO 1 GANA`, 0, 80, 22, '#ffd400');
      ctx.restore();
      racers.forEach((r, i) => {
        const at = 40 + i * 7; if (t < at) return;
        const p = Math.min(1, (t - at) / 10), sc = p < 1 ? .3 + p * .9 : 1 + Math.max(0, .2 - (t - at - 10) * .04);
        const cols = CASTX ? 3 : 4, x = CASTX ? 100 + (i % 3) * 170 : 78 + (i % 4) * 128, y = CASTX ? 470 + Math.floor(i / 3) * 175 : 420 + Math.floor(i / 4) * 125;
        drawSlime(r, { x, y, h: (CASTX ? 130 : 78) * sc, gy: y, tag: true });
      });
      if (t > 150) {
        const a = Math.min(1, (t - 150) / 15); ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(20,18,40,.85)'; ctx.beginPath(); ctx.roundRect(24, 790, W - 48, 150, 18); ctx.fill();
        txt('HEUTE · HOY', W / 2, 822, 18, '#9fe870');
        (CASTX ? [GAMES[CASTX.game || 'race']] : [...picked.map(g => GAMES[g]), FINALE]).forEach((g, i) => {
          const x = CASTX ? W / 2 : 78 + i * 128; drawImg(g.icon, x, 890, 52, { ay: .6 }); txt(i < 3 ? g.short : 'FINALE', x, 928, 13, i < 3 ? '#fff' : '#ffd400');
        });
        ctx.globalAlpha = 1;
      }
    },
  };
}
function gameScene(def, keep, idx, finale) {
  let phase = 'title', t = 0;
  const total = 4, label = CASTX ? CASTX.label : `SPIEL ${idx + 1}/${total} · JUEGO ${idx + 1}/${total}`;
  return {
    start() { def.setup(keep); sfx('swoosh', 1); },
    update() {
      t++;
      if (phase === 'title' && t > 170) { phase = 'count'; t = 0; }
      else if (phase === 'count') { if (t === 1 || t === 41 || t === 81) sfx('beep', 1); if (t >= 121) { phase = 'play'; t = 0; sfx('go', 1); } }
      else if (phase === 'play') { if (def.update()) { phase = 'result'; t = 0; if (!finale) sfx('cheer', 1); } }
      else if (phase === 'result') { if (finale) { podiumRank = def.rank; return true; } if (t === 60) callouts.length = 0; if (t > 250) return true; }
      if (phase !== 'play' && phase !== 'result') for (const r of alive(def.rs)) { r.sq *= .85; }
      return false;
    },
    draw() {
      def.draw();
      hudTop(def.name, finale ? 'FINALE · 3 → 1' : `${label}  ·  ${alive(def.rs).length} → ${keep}`);
      hudBottom();
      if (phase === 'title') {
        const a = Math.min(1, t / 12), out = t > 155 ? (t - 155) / 15 : 0;
        ctx.globalAlpha = 1 - out; ctx.fillStyle = `rgba(10,10,30,${.6 * a})`; ctx.fillRect(0, 0, W, H);
        const s = t < 12 ? .3 + t * .065 : 1;
        ctx.save(); ctx.translate(W / 2, 300); ctx.scale(s, s);
        txt(finale ? 'FINALE' : label, 0, -90, 22, '#9fe870');
        drawImg(def.icon, 0, 60, 130, { rot: Math.sin(step / 12) * .08 });
        txt(def.name, 0, 120, 40, '#ffd400'); txt(def.es, 0, 156, 26, '#fff');
        txt(def.rule, 0, 210, 20, '#fff'); txt(def.ruleEs, 0, 238, 18, '#ccc');
        if (!finale) txt(`${keep} kommen weiter · pasan ${keep}`, 0, 290, 22, '#9fe870');
        ctx.restore(); ctx.globalAlpha = 1;
      }
      if (phase === 'count') { const n = 3 - Math.floor((t - 1) / 40), lt = (t - 1) % 40, s = 1.6 - Math.min(.6, lt * .04); ctx.save(); ctx.translate(W / 2, 420); ctx.scale(s, s); txt(String(n), 0, 0, 110, '#fff'); ctx.restore(); }
      if (phase === 'play' && t < 30) { const s = 1 + t * .03; ctx.save(); ctx.translate(W / 2, 420); ctx.scale(s, s); ctx.globalAlpha = 1 - t / 30; txt('GO!', 0, 0, 110, '#9fe870'); ctx.restore(); ctx.globalAlpha = 1; }
      if (phase === 'result' && !finale && t > 60) {
        const a = Math.min(1, (t - 60) / 10); ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(10,10,30,.55)'; ctx.fillRect(0, 150, W, 640);
        txt(CASTX ? 'IM ZIEL!' : 'WEITER!', W / 2, 245, 48, '#9fe870'); txt(CASTX ? '¡EN LA META!' : '¡SIGUEN!', W / 2, 285, 30, '#9fe870');
        (CASTX ? def.fin : alive(def.rs)).forEach((r, i) => { const x = CASTX ? W / 2 : W / 2 + ((i % 2) ? 110 : -110), y = CASTX ? 330 + i * 120 : 360 + Math.floor(i / 2) * 82;
          if (CASTX) { txt(`${i + 1}.`, x - 110, y + 40, 40, '#ffd400'); drawSlime(r, { x, y: y + 60, h: 105, gy: y + 60, shadow: false, tag: false, still: true }); txt(r.name, x + 120, y + 40, 26, '#fff'); return; } drawSlime(r, { x, y: y + 30, h: 56, gy: y + 30, shadow: false, tag: false, still: true }); txt(r.name, x, y + 52, 17, '#fff'); });
        ctx.globalAlpha = 1;
      }
    },
  };
}
function podiumScene() {
  let t = 0;
  return {
    start() { racers.forEach(r => { r.sq = 0; r.vx = 0; }); if (!podiumRank) podiumRank = GAMES[CASTX.game || 'race'].fin.slice(0, 3); },
    update() {
      t++;
      if (t % 18 === 1) burst(V(40, W - 40), V(120, 300), ['#ff5a4f', '#ffd400', '#3d8bff', '#4cbb2c', '#9b59d6'], 22, { conf: true, spread: 1.4 });
      if (t === 2) { sfx('fanfare', 1); sfx('cheer', 1); }
      return t > 480;
    },
    draw() {
      drawBg(CASTX?.bg || 'bg', 0, .35);
      const [w, s2, s3] = podiumRank;
      const ph = 230, pw = ph * IMG.podest.width / IMG.podest.height, py = 770;
      drawImg('podest', W / 2, py, ph);
      const top = py - ph;
      const rise = Math.min(1, t / 25);
      drawSlime(s2, { x: W / 2 - pw * .33, y: top + ph * .27, h: 118, shadow: false, still: true });
      drawSlime(s3, { x: W / 2 + pw * .33, y: top + ph * .36, h: 118, shadow: false, still: true });
      const wy = top + ph * .03, bounce = Math.abs(Math.sin(t / 10)) * 10;
      w.pose = 'victory'; drawSlime(w, { x: W / 2, y: wy - bounce, h: 165 * (.5 + .5 * rise), shadow: false, still: true });
      drawImg('krone', W / 2, wy - bounce - 150 * (.5 + .5 * rise), 56, { ay: .6 });
      drawImg('pokal', 70, 520, 90 * rise, { rot: Math.sin(t / 15) * .1 });
      drawImg('pokal', W - 70, 520, 90 * rise, { rot: -Math.sin(t / 15) * .1 });
      const s = t < 15 ? .3 + t * .047 : 1;
      ctx.save(); ctx.translate(W / 2, 150); ctx.scale(s, s);
      txt('SIEGER DES TAGES', 0, 0, 44, '#ffd400'); txt('CAMPEÓN DEL DÍA', 0, 40, 32, '#ffd400');
      txt(w.name, 0, 112, 64, '#fff');
      ctx.restore();
      ctx.fillStyle = 'rgba(20,18,40,.9)'; ctx.beginPath(); ctx.roundRect(24, 800, W - 48, 140, 18); ctx.fill();
      txt('24h Top-Werbeplatz', W / 2, 838, 24, '#9fe870'); txt('24h espacio principal', W / 2, 868, 20, '#9fe870');
      txt('Deine Marke morgen hier? · Link in Bio', W / 2, 912, 18, '#ffd400');
      drawFx();
    },
  };
}
const scenes = CASTX ? [introScene(), gameScene(GAMES[CASTX.game || 'race'], CASTX.keep, 0), podiumScene()]
  : [introScene(), ...picked.map((g, i) => gameScene(GAMES[g], KEEP[i], i)), gameScene(FINALE, 1, 3, true), podiumScene()];
let scene = scenes[0];

// ---------- Ablauf ----------
function simStep() {
  if (finished) return;
  step++;
  if (scene.update()) {
    sceneIdx++;
    if (sceneIdx >= scenes.length) { finished = true; return; }
    scene = scenes[sceneIdx]; fx.length = 0; parts.length = 0; callouts.length = 0; scene.start?.();
  }
  updateFx();
}
function render() {
  ctx.setTransform(S, 0, 0, S, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (punch > .002) { ctx.translate(W / 2, H / 2); ctx.scale(1 + punch, 1 + punch); ctx.translate(-W / 2, -H / 2); }
  if (shake > .5) ctx.translate(V(-1, 1) * shake, V(-1, 1) * shake);
  scene.draw();
  ctx.restore();
  drawCallouts();
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
}
function frameStep() {
  const n = slowmo > 0 ? 1 : 2;
  for (let i = 0; i < n; i++) simStep();
  if (slowmo > 0) slowmo--;
  shake *= .85; punch *= .85;
  callouts.forEach(c => c.t++); for (let i = callouts.length - 1; i >= 0; i--) if (callouts[i].t > 75) callouts.splice(i, 1);
  frame++; render();
  return finished;
}
function boot() {
  scene.start?.();
  window.REEL_INFO = { seed: SEED, games: picked };
  if (params.get('live') === '1') { let last = 0; const loop = t => { if (t - last >= 33) { last = t; if (!frameStep()) { } } requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  window.reelStep = frameStep; window.reelReady = true;
}
