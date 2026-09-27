import { ZONES, zoneIndexForFloor } from '../config.js';
import { W, VIEW_H, ZOOM } from '../view.js';

const BLEND_FLOORS = 25; // so viele Etagen vor einer neuen Zone beginnt der Farbübergang

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lerp = (a, b, t) => a + (b - a) * t;
function mix(h1, h2, t) {
  const a = hexToRgb(h1);
  const b = hexToRgb(h2);
  return (Math.round(lerp(a[0], b[0], t)) << 16) | (Math.round(lerp(a[1], b[1], t)) << 8) | Math.round(lerp(a[2], b[2], t));
}

// Welche Deko in welcher Zone vorbeizieht (Texturname)
const DECO_BY_ZONE = {
  city: null,
  balloon: 'balloon',
  bird: 'bird',
  bolt: 'bird',
  aurora: null,
  planet: 'planet',
  nebula: 'planet',
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

  /** scrollY = Kamera-Position, floor = aktuelle Höhe in Etagen (Kommazahl). */
  update(scrollY, floor) {
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

    const space = idx >= 4;
    const starAlpha = Math.max(0, Math.min(1, (floor - 330) / 120));
    const cloudAlpha = space ? 0.12 : idx === 3 ? 0.35 : 0.75;
    const decoKey = DECO_BY_ZONE[z.deco];

    for (const l of this.layers) {
      const o = l.obj;
      const screenY = o.y - scrollY * l.sf;
      if (screenY > VIEW_H + 160) {
        o.y -= VIEW_H + 320 + Math.random() * 200;
        o.x = Math.random() * W;
        if (l.kind === 'deco') {
          o.setVisible(!!decoKey && Math.random() < 0.7);
          if (decoKey) o.setTexture(decoKey).setScale((0.7 + Math.random() * 0.5) / ZOOM);
        }
      }
      if (l.kind === 'star') o.setAlpha(starAlpha * (0.5 + 0.5 * Math.sin(o.x + scrollY * 0.002)));
      else if (l.kind === 'cloud') o.setAlpha(cloudAlpha);
      if (l.kind === 'cloud' && idx === 3) o.setTint(0x8f98b5);
      else if (l.kind === 'cloud') o.clearTint();
    }
    this.zoneIdx = idx;
  }
}
