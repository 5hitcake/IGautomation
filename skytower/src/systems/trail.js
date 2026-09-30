// Schweife hinter Wolki: Regenbogen (6 Farbbänder, leicht wellig),
// Sternschnuppe (leuchtende Spur mit funkelnden Sternchen) und Engel
// (breite goldene Lichtspur mit goldenem Funkeln) und Sternenstaub (zarte goldene
// Spur, aus der feiner Glitzerstaub rieselt – für die Stern-Wolki).
//
// Gezeichnet wird jedes Band als durchgehender Streifen aus Dreiecken (statt
// aus einzelnen Linienstücken), mit stufenlos auslaufender Transparenz – so
// gibt es keine Kanten, Kerben oder doppelt dunklen Übergänge.
import { ZOOM } from '../view.js';

export const RAINBOW = [0xff4d4d, 0xff9f1a, 0xffe23d, 0x4cd964, 0x3fa9ff, 0x8e5cff];
const BAND = 7; // Breite eines Farbbands
const LIFE = 0.42; // so lange (s) bleibt ein Punkt des Schweifs sichtbar

/** Senkrechte zur Bewegungsrichtung je Punkt, geglättet gegen Knicke. */
function normalsFor(pts, flat) {
  if (flat) return pts.map(() => [0, 1]);
  let nx = 0;
  let ny = 1;
  const raw = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len > 0.5) { nx = -dy / len; ny = dx / len; }
    return [nx, ny];
  });
  return raw.map((n, i) => {
    const p = raw[Math.max(0, i - 1)];
    const q = raw[Math.min(raw.length - 1, i + 1)];
    const sx = p[0] + 2 * n[0] + q[0];
    const sy = p[1] + 2 * n[1] + q[1];
    const len = Math.hypot(sx, sy) || 1;
    return [sx / len, sy / len];
  });
}

/**
 * Füllt einen Streifen entlang `pts` zwischen den Abständen `o1` und `o2` von
 * der Mittellinie. `alpha(i)` gibt die Deckkraft am Punkt i an.
 */
function fillStrip(g, pts, normals, o1, o2, color, alpha, wave) {
  const at = (i, off) => {
    const o = off + (wave ? wave[i] : 0);
    return [pts[i].x + normals[i][0] * o, pts[i].y + normals[i][1] * o];
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = at(i, o1);
    const [bx, by] = at(i, o2);
    const [cx, cy] = at(i + 1, o2);
    const [dx, dy] = at(i + 1, o1);
    g.fillStyle(color, (alpha(i) + alpha(i + 1)) / 2);
    g.fillTriangle(ax, ay, bx, by, cx, cy);
    g.fillTriangle(ax, ay, cx, cy, dx, dy);
  }
}

function drawRainbow(g, pts, normals, alpha, wave, band = BAND) {
  RAINBOW.forEach((color, b) => {
    const o1 = (b - 3) * band;
    fillStrip(g, pts, normals, o1, o1 + band, color, alpha, wave);
  });
}

const STREAK = {
  stars: { glow: 0xfff3a0, core: 0xffffff, w: 11, cw: 4.5, ga: 0.25 },
  angel: { glow: 0xffd23f, core: 0xfffbe6, w: 16, cw: 6, ga: 0.35 },
  stardust: { glow: 0xffb300, core: 0xffe680, w: 12, cw: 3.5, ga: 0.3, ca: 0.7 },
};

function drawStreak(g, pts, normals, alpha, scale = 1, kind = 'stars') {
  const c = STREAK[kind];
  fillStrip(g, pts, normals, -c.w * scale, c.w * scale, c.glow, (i) => alpha(i) * c.ga);
  fillStrip(g, pts, normals, -c.cw * scale, c.cw * scale, c.core, (i) => alpha(i) * (c.ca ?? 0.8));
}

const SPARK_TINTS = {
  stars: [0xffffff, 0xfff3a0, 0xffd23f],
  angel: [0xffd23f, 0xffe680, 0xffffff],
  stardust: [0xffc21a, 0xffa800, 0xffe066, 0xffd23f, 0xffffff],
};

export class Trail {
  /**
   * @param kind 'rainbow' | 'stars' | 'angel' | 'stardust' | undefined (kein Schweif)
   * @param drift Punkte wandern mit dieser Geschwindigkeit (px/s) nach links,
   *              z. B. im Menü, damit der Schweif "fliegt", obwohl Wolki auf der Stelle hüpft
   * @param flat  Farbbänder immer waagerecht übereinander (Nyan-Look im Menü)
   */
  constructor(scene, kind, { depth = 6, drift = 0, flat = false, life = LIFE } = {}) {
    this.kind = kind;
    this.life = kind === 'stardust' && life === LIFE ? 0.6 : life; // Sternenstaub bleibt etwas länger
    this.drift = drift;
    this.flat = flat;
    this.pts = [];
    this.time = 0;
    if (!kind) return;
    this.g = scene.add.graphics().setDepth(depth);
    if (kind === 'stardust') {
      // feiner Glitzerstaub, der langsam nach unten rieselt ...
      // im Menü (drift) weht der Staub mit dem Schweif nach hinten
      const motion = drift
        ? { speedX: { min: drift * 0.8, max: drift * 1.2 }, speedY: { min: -12, max: 12 } }
        : { speed: { min: 5, max: 35 } };
      this.sparks = scene.add.particles(0, 0, 'spark', {
        ...motion,
        lifespan: { min: 800, max: 1300 },
        scale: { min: 0.55 / ZOOM, max: 1.0 / ZOOM },
        alpha: { start: 1, end: 0 },
        gravityY: 70,
        rotate: { min: 0, max: 360 },
        tint: SPARK_TINTS.stardust,
        emitting: false,
      }).setDepth(depth);
      // ... und ab und zu ein größeres, aufblitzendes Sternchen
      this.twinkles = scene.add.particles(0, 0, 'spark', {
        speed: { min: 0, max: 15 },
        lifespan: 550,
        scale: { start: 0.3 / ZOOM, end: 1.6 / ZOOM, ease: 'Sine.out' },
        alpha: { start: 1, end: 0 },
        tint: [0xffffff, 0xffe066],
        emitting: false,
      }).setDepth(depth);
    } else if (kind === 'stars' || kind === 'angel') {
      this.sparks = scene.add.particles(0, 0, 'spark', {
        speed: { min: 10, max: 70 },
        lifespan: 750,
        scale: { start: 0.95 / ZOOM, end: 0 },
        alpha: { start: 1, end: 0 },
        rotate: { min: 0, max: 360 },
        tint: SPARK_TINTS[kind],
        emitting: false,
      }).setDepth(depth);
    }
  }

  /** Jedes Frame mit der aktuellen Position aufrufen. */
  update(x, y, dt) {
    if (!this.kind) return;
    this.time += dt;
    if (this.drift) for (const p of this.pts) p.x += this.drift * dt;
    const last = this.pts[this.pts.length - 1];
    if (this.kind === 'stardust' && last) this.sprinkle(last.x, last.y, x, y);
    if (!last || Math.abs(last.x - x) + Math.abs(last.y - y) > 2) this.pts.push({ x, y, t: this.time });
    while (this.pts.length && this.time - this.pts[0].t > this.life) this.pts.shift();
    if (this.kind === 'stardust') {
      // nichts – der Staub wird in sprinkle() entlang der Strecke verteilt
    } else if (this.sparks && this.pts.length > 1 && Math.random() < 0.7) {
      this.sparks.emitParticleAt(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30, 1);
    }
    this.draw();
  }

  /** Sternenstaub gleichmäßig entlang der Strecke streuen (unabhängig von der Bildrate). */
  sprinkle(x1, y1, x2, y2) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    // auch im Stillstand ein wenig Glitzer, sonst etwa ein Staubkorn je 7 px
    this.dust = (this.dust ?? 0) + Math.max(dist / 7, 0.4);
    const n = Math.min(24, Math.floor(this.dust));
    this.dust -= n;
    for (let i = 0; i < n; i++) {
      const f = Math.random();
      const px = x1 + (x2 - x1) * f + (Math.random() - 0.5) * 30;
      const py = y1 + (y2 - y1) * f + (Math.random() - 0.5) * 30;
      this.sparks.emitParticleAt(px, py, 1);
      if (Math.random() < 0.06) this.twinkles.emitParticleAt(px + (Math.random() - 0.5) * 30, py, 1);
    }
  }

  clear() {
    this.pts = [];
    this.g?.clear();
  }

  draw() {
    const g = this.g;
    g.clear();
    const pts = this.pts;
    const n = pts.length;
    if (n < 2) return;
    const normals = normalsFor(pts, this.flat);
    // stufenlos: ältester Punkt durchsichtig, Kopf voll deckend
    const alpha = (i) => (i / (n - 1)) ** 0.8;
    if (this.kind === 'rainbow') {
      // Welle aus der Position statt aus dem Punkt-Index: gleich bei jeder Bildrate
      const wave = pts.map((p) => Math.sin(this.time * 14 - (p.x + p.y) * 0.06) * 3);
      drawRainbow(g, pts, normals, alpha, wave);
    } else {
      drawStreak(g, pts, normals, alpha, 1, this.kind);
    }
  }

  destroy() {
    this.g?.destroy();
    this.sparks?.destroy();
    this.twinkles?.destroy();
  }
}

/** Kleine, feste Vorschau eines Schweifs (für den Shop), endet bei (x, y). */
export function drawTrailPreview(scene, kind, x, y, len, depth = 6) {
  const g = scene.add.graphics().setDepth(depth);
  const pts = [];
  for (let i = 0; i <= 12; i++) pts.push({ x: x - len + (len * i) / 12, y });
  const normals = pts.map(() => [0, 1]);
  const alpha = (i) => 0.35 + 0.65 * (i / 12);
  if (kind === 'rainbow') {
    const wave = pts.map((_, i) => Math.sin(i * 0.9) * 2.5);
    drawRainbow(g, pts, normals, alpha, wave, 5);
  } else if (kind === 'stardust') {
    drawStreak(g, pts, normals, alpha, 0.8, kind);
    [[0.15, -9, 0.5], [0.3, 7, 0.7], [0.45, -3, 0.45], [0.6, 11, 0.6], [0.72, -11, 0.9], [0.88, 5, 0.5]].forEach(([f, dy, sc]) => {
      scene.add.image(x - len * f, y + dy, 'spark').setScale(sc / ZOOM).setDepth(depth).setTint(0xffe680);
    });
  } else if (kind === 'stars' || kind === 'angel') {
    drawStreak(g, pts, normals, alpha, 0.6, kind);
    [[0.3, -10], [0.6, 12], [0.85, -4]].forEach(([f, dy]) => {
      scene.add.image(x - len * f, y + dy, 'spark').setScale(0.9 / ZOOM).setDepth(depth).setTint(0xffe680);
    });
  }
  return g;
}
