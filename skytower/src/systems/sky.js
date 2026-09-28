import { ZONES, zoneIndexForFloor } from '../config.js';
import { PLANET_COUNT } from '../art.js';
import { W, VIEW_H, ZOOM } from '../view.js';

const BLEND_FLOORS = 25; // so viele Etagen vor einer neuen Zone beginnt der Farbübergang

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lerp = (a, b, t) => a + (b - a) * t;
function mix(h1, h2, t) {
  const a = hexToRgb(h1);
  const b = hexToRgb(h2);
  return (Math.round(lerp(a[0], b[0], t)) << 16) | (Math.round(lerp(a[1], b[1], t)) << 8) | Math.round(lerp(a[2], b[2], t));
}

// Welche Deko in welcher Zone vorbeizieht: Textur(en) und wie oft (0..1 je Durchlauf)
const DECO_BY_ZONE = {
  city: null,
  balloon: { keys: ['balloon'], chance: 0.7 },
  bird: { keys: ['bird'], chance: 0.7 },
  bolt: null,
  moon: null, // großer Mond, siehe drawEffects
  aurora: null,
  satellite: { keys: ['satellite'], chance: 0.45 },
  planet: { keys: Array.from({ length: PLANET_COUNT }, (_, i) => `planet_${i}`), chance: 0.28 },
  rock: { keys: ['rock'], chance: 0.8 },
  nebula: { keys: Array.from({ length: PLANET_COUNT }, (_, i) => `planet_${i}`), chance: 0.15 },
};

/** Himmel mit Farbverlauf je Zone, Parallax-Wolken, Sternen und Deko. */
export class Sky {
  constructor(scene, { city = false, scrollY = 0 } = {}) {
    this.scene = scene;
    this.g = scene.add.graphics().setScrollFactor(0).setDepth(0);
    this.layers = [];

    for (let i = 0; i < 44; i++) {
      const s = scene.add.image(0, 0, 'spark').setScrollFactor(0.06).setDepth(1);
      s.setScale((0.25 + Math.random() * 0.45) / ZOOM);
      this.layers.push({ obj: s, sf: 0.06, kind: 'star' });
    }
    for (let i = 0; i < 7; i++) {
      const c = scene.add.image(0, 0, 'bgcloud').setScrollFactor(0.22 + i * 0.03).setDepth(1);
      c.setScale((0.6 + Math.random() * 0.8) / ZOOM);
      this.layers.push({ obj: c, sf: 0.22 + i * 0.03, kind: 'cloud' });
    }
    for (let i = 0; i < 3; i++) {
      const d = scene.add.image(0, 0, 'balloon').setScrollFactor(0.4).setDepth(2).setVisible(false);
      this.layers.push({ obj: d, sf: 0.4, kind: 'deco' });
    }
    for (let i = 0; i < 3; i++) {
      const n = scene.add.image(0, 0, `nebula_${i}`).setScrollFactor(0.1).setDepth(1).setAlpha(0);
      n.setScale((1.4 + Math.random()) / ZOOM);
      this.layers.push({ obj: n, sf: 0.1, kind: 'nebula' });
    }
    // Effekte, die fest am Bildschirm hängen: Mond, Erdkrümmung, Nordlichter,
    // Wetterleuchten, Wind, Sternschnuppen
    this.moon = scene.add.image(W * 0.74, VIEW_H * 0.2, 'bigmoon').setScrollFactor(0).setDepth(1).setScale(1 / ZOOM).setAlpha(0);
    this.earth = scene.add.graphics().setScrollFactor(0).setDepth(1);
    this.earth.fillStyle(0x4fa3ff, 0.18).fillCircle(W / 2, VIEW_H + 1500, 1640);
    this.earth.fillStyle(0x2f7fe0, 0.9).fillCircle(W / 2, VIEW_H + 1500, 1600);
    this.earth.fillStyle(0x3fbf7a, 0.9).fillEllipse(W * 0.3, VIEW_H - 40, 260, 60);
    this.earth.fillStyle(0x3fbf7a, 0.9).fillEllipse(W * 0.8, VIEW_H - 20, 200, 40);
    this.earth.setAlpha(0);
    this.wind = 0; // wird vom Spiel gesetzt (-1..1)
    this.streaks = Array.from({ length: 14 }, () => ({ x: Math.random() * W, y: Math.random() * VIEW_H, len: 40 + Math.random() * 80 }));
    this.aurora = scene.add.graphics().setScrollFactor(0).setDepth(1);
    this.fx = scene.add.graphics().setScrollFactor(0).setDepth(1);
    this.flash = scene.add.rectangle(0, 0, W, VIEW_H, 0xffffff, 0).setOrigin(0).setScrollFactor(0).setDepth(1);
    this.time = 0;
    this.nextBolt = 2;
    this.bgBolt = null;
    this.nextShot = 1.5;
    this.shots = [];
    for (const l of this.layers) {
      l.obj.x = Math.random() * W;
      l.obj.y = scrollY * l.sf + Math.random() * VIEW_H;
    }

    if (city) this.drawCity(scrollY);
    this.zoneIdx = -1;
    this.update(scrollY, 0);
  }

  drawCity(scrollY) {
    const layers = [
      { sf: 0.3, color: 0xf9dcc0, win: 0xfff1dc, min: 180, max: 420, bw: [70, 120] },
      { sf: 0.55, color: 0xefb893, win: 0xffe2b8, min: 110, max: 300, bw: [60, 110] },
    ];
    for (const L of layers) {
      const g = this.scene.add.graphics().setScrollFactor(L.sf).setDepth(1);
      const bottom = VIEW_H + scrollY * L.sf + 40;
      let x = -20;
      while (x < W + 20) {
        const bw = L.bw[0] + Math.random() * (L.bw[1] - L.bw[0]);
        const bh = L.min + Math.random() * (L.max - L.min);
        g.fillStyle(L.color).fillRoundedRect(x, bottom - bh, bw - 6, bh + 200, 8);
        g.fillStyle(L.win);
        for (let wy = bottom - bh + 24; wy < bottom - 20; wy += 38) {
          for (let wx = x + 14; wx < x + bw - 26; wx += 26) g.fillRoundedRect(wx, wy, 12, 18, 3);
        }
        if (Math.random() < 0.4) g.fillStyle(L.color).fillRect(x + bw / 2 - 3, bottom - bh - 40, 6, 40);
        x += bw;
      }
    }
  }

  /** scrollY = Kamera-Position, floor = aktuelle Höhe in Etagen (Kommazahl), dt = Sekunden. */
  update(scrollY, floor, dt = 0) {
    this.time += dt;
    const idx = zoneIndexForFloor(Math.floor(floor));
    const z = ZONES[idx];
    const next = ZONES[idx + 1];
    const t = next ? Math.max(0, Math.min(1, (floor - (next.from - BLEND_FLOORS)) / BLEND_FLOORS)) : 0;
    const top = mix(z.skyTop, next ? next.skyTop : z.skyTop, t);
    const bottom = mix(z.skyBottom, next ? next.skyBottom : z.skyBottom, t);
    if (top !== this.lastTop || bottom !== this.lastBottom) {
      this.lastTop = top;
      this.lastBottom = bottom;
      this.g.clear();
      this.g.fillGradientStyle(top, top, bottom, bottom, 1);
      this.g.fillRect(0, 0, W, VIEW_H);
    }

    const starAlpha = Math.max(0, Math.min(1, (floor - 330) / 120));
    const cloudAlpha = idx >= 5 ? 0.1 : idx === 4 ? 0.28 : idx === 3 ? 0.35 : 0.75;
    const cloudTint = idx === 3 ? 0x8f98b5 : idx === 4 ? 0x6a7fc0 : null;
    const deco = DECO_BY_ZONE[z.deco];

    for (const l of this.layers) {
      const o = l.obj;
      const screenY = o.y - scrollY * l.sf;
      if (screenY > VIEW_H + 160) {
        o.y -= VIEW_H + 320 + Math.random() * 200;
        o.x = Math.random() * W;
        if (l.kind === 'deco') {
          o.setVisible(!!deco && Math.random() < deco.chance);
          if (deco) {
            o.setTexture(deco.keys[Math.floor(Math.random() * deco.keys.length)]);
            o.setScale((0.6 + Math.random() * 0.6) / ZOOM).setRotation(deco.keys[0] === 'rock' ? Math.random() * 6 : 0);
          }
        }
      }
      if (l.kind === 'star') o.setAlpha(starAlpha * (0.5 + 0.5 * Math.sin(o.x + scrollY * 0.002)));
      else if (l.kind === 'cloud') o.setAlpha(cloudAlpha);
      else if (l.kind === 'nebula') o.setAlpha(Math.max(zoneWeight(9, floor), 0.35 * zoneWeight(8, floor)));
      if (l.kind === 'cloud' && cloudTint) o.setTint(cloudTint);
      else if (l.kind === 'cloud') o.clearTint();
    }
    this.zoneIdx = idx;
    this.drawEffects(floor, dt);
  }

  drawEffects(floor, dt) {
    const t = this.time;
    // großer Mond in der Mondnacht, Erdkrümmung in der Stratosphäre
    this.moon.setAlpha(zoneWeight(4, floor));
    this.earth.setAlpha(zoneWeight(6, floor));
    // Nordlichter im Polarlicht (und schwach in der Stratosphäre)
    const aw = Math.max(zoneWeight(5, floor), 0.3 * zoneWeight(6, floor));
    this.aurora.clear();
    if (aw > 0.01) {
      [0x7dffb2, 0x5ce1e6, 0xb07bff].forEach((color, k) => {
        const base = VIEW_H * (0.16 + 0.13 * k);
        const col = (x) => ({
          y: base + Math.sin(x * 0.008 + t * 0.6 + k * 2) * 50 + Math.sin(x * 0.021 - t * 0.9) * 18,
          h: 90 + 40 * Math.sin(x * 0.013 + t * 0.8 + k),
        });
        for (let x = -30; x < W + 30; x += 30) {
          const a = col(x);
          const b = col(x + 30);
          this.aurora.fillGradientStyle(color, color, color, color, 0, 0, 0.32 * aw, 0.32 * aw);
          this.aurora.fillTriangle(x, a.y, x + 30, b.y, x + 30, b.y + b.h);
          this.aurora.fillTriangle(x, a.y, x + 30, b.y + b.h, x, a.y + a.h);
        }
      });
    }

    this.fx.clear();
    if (this.flash.alpha > 0) this.flash.setAlpha(Math.max(0, this.flash.alpha - dt * 2));
    // Wetterleuchten in der Gewitterfront
    const sw = zoneWeight(3, floor);
    if (sw > 0.5 && dt > 0) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) {
        this.nextBolt = 2 + Math.random() * 3.5;
        const pts = [];
        let x = 60 + Math.random() * (W - 120);
        for (let y = -10; y < VIEW_H * (0.3 + Math.random() * 0.3); y += 40 + Math.random() * 30) {
          pts.push({ x, y });
          x += (Math.random() - 0.5) * 70;
        }
        this.bgBolt = { pts, life: 0.18 };
        this.flash.setAlpha(0.16);
      }
    }
    if (this.bgBolt) {
      this.bgBolt.life -= dt;
      if (this.bgBolt.life <= 0) this.bgBolt = null;
      else {
        const a = this.bgBolt.life / 0.18;
        this.fx.lineStyle(10, 0xdde6ff, 0.25 * a).strokePoints(this.bgBolt.pts);
        this.fx.lineStyle(3, 0xffffff, 0.8 * a).strokePoints(this.bgBolt.pts);
      }
    }
    // Windstreifen in der Stratosphäre
    const ww = zoneWeight(6, floor);
    if (ww > 0.01 && Math.abs(this.wind) > 0.15) {
      for (const st of this.streaks) {
        st.x += this.wind * 900 * dt;
        if (st.x > W + 100) st.x = -100;
        if (st.x < -100) st.x = W + 100;
        this.fx.lineStyle(3, 0xffffff, 0.3 * ww * Math.abs(this.wind)).lineBetween(st.x, st.y, st.x - Math.sign(this.wind) * st.len, st.y);
      }
    }
    // Sternschnuppen ab der Stratosphäre
    if (floor > 580 && dt > 0) {
      this.nextShot -= dt;
      if (this.nextShot <= 0) {
        this.nextShot = 1.2 + Math.random() * 2.5;
        const dir = Math.random() < 0.5 ? -1 : 1;
        this.shots.push({ x: dir > 0 ? -40 : W + 40, y: Math.random() * VIEW_H * 0.6, vx: dir * (700 + Math.random() * 400), vy: 260 + Math.random() * 160, life: 1.4 });
      }
    }
    this.shots = this.shots.filter((sh) => {
      sh.life -= dt;
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      const a = Math.min(1, sh.life);
      this.fx.lineStyle(3, 0xffffff, 0.85 * a).lineBetween(sh.x, sh.y, sh.x - sh.vx * 0.12, sh.y - sh.vy * 0.12);
      this.fx.fillStyle(0xfff6c2, a).fillCircle(sh.x, sh.y, 3.5);
      return sh.life > 0;
    });
  }
}

/** 0..1: wie stark eine Zone bei dieser Höhe zu sehen ist (mit weichen Übergängen). */
function zoneWeight(i, floor) {
  const from = ZONES[i].from;
  const to = ZONES[i + 1]?.from ?? Infinity;
  const fadeIn = Math.max(0, Math.min(1, (floor - (from - 20)) / 20));
  const fadeOut = Math.max(0, Math.min(1, (to - floor) / 20));
  return Math.min(fadeIn, fadeOut);
}
