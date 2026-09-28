// Schweife hinter Wolki: Regenbogen (6 Farbbänder, leicht wellig) und
// Sternschnuppe (leuchtende Spur mit funkelnden Sternchen).
import { ZOOM } from '../view.js';

export const RAINBOW = [0xff4d4d, 0xff9f1a, 0xffe23d, 0x4cd964, 0x3fa9ff, 0x8e5cff];
const BAND = 7; // Breite eines Farbbands
const LIFE = 0.42; // so lange (s) bleibt ein Punkt des Schweifs sichtbar

export class Trail {
  /**
   * @param kind 'rainbow' | 'stars' | undefined (kein Schweif)
   * @param drift Punkte wandern mit dieser Geschwindigkeit (px/s) nach links,
   *              z. B. im Menü, damit der Schweif "fliegt", obwohl Wolki auf der Stelle hüpft
   * @param flat  Farbbänder immer waagerecht übereinander (Nyan-Look im Menü)
   */
  constructor(scene, kind, { depth = 6, drift = 0, flat = false, life = LIFE } = {}) {
    this.kind = kind;
    this.life = life;
    this.drift = drift;
    this.flat = flat;
    this.pts = [];
    this.time = 0;
    if (!kind) return;
    this.g = scene.add.graphics().setDepth(depth);
    if (kind === 'stars') {
      this.sparks = scene.add.particles(0, 0, 'spark', {
        speed: { min: 10, max: 70 },
        lifespan: 750,
        scale: { start: 0.95 / ZOOM, end: 0 },
        alpha: { start: 1, end: 0 },
        rotate: { min: 0, max: 360 },
        tint: [0xffffff, 0xfff3a0, 0xffd23f],
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
    if (!last || Math.abs(last.x - x) + Math.abs(last.y - y) > 2) this.pts.push({ x, y, t: this.time });
    while (this.pts.length && this.time - this.pts[0].t > this.life) this.pts.shift();
    if (this.kind === 'stars' && this.pts.length > 1 && Math.random() < 0.7) {
      this.sparks.emitParticleAt(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30, 1);
    }
    this.draw();
  }

  clear() {
    this.pts = [];
    this.g?.clear();
  }

  draw() {
    const g = this.g;
    g.clear();
    const pts = this.pts;
    if (pts.length < 2) return;
    // Senkrechte zur Bewegungsrichtung je Punkt (für die Farbbänder)
    let nx = 0;
    let ny = 1;
    const normals = pts.map((p, i) => {
      if (this.flat) return [0, 1];
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len > 0.5) { nx = -dy / len; ny = dx / len; }
      return [nx, ny];
    });
    // In drei Stücken zeichnen: je älter, desto durchsichtiger
    const pieces = [[0, 0.3], [Math.floor(pts.length / 3), 0.6], [Math.floor((pts.length * 2) / 3), 1]];
    pieces.forEach(([from, alpha], k) => {
      const to = k < 2 ? pieces[k + 1][0] + 1 : pts.length;
      if (to - from < 2) return;
      if (this.kind === 'rainbow') {
        RAINBOW.forEach((color, b) => {
          const off = (b - 2.5) * BAND;
          const line = [];
          for (let i = from; i < to; i++) {
            // Welle aus der Position statt aus dem Punkt-Index: gleich bei jeder Bildrate
            const wave = Math.sin(this.time * 14 - (pts[i].x + pts[i].y) * 0.06) * 3;
            line.push({ x: pts[i].x + normals[i][0] * (off + wave), y: pts[i].y + normals[i][1] * (off + wave) });
          }
          g.lineStyle(BAND + 1, color, alpha).strokePoints(line);
        });
      } else {
        const line = pts.slice(from, to);
        g.lineStyle(22, 0xfff3a0, alpha * 0.25).strokePoints(line);
        g.lineStyle(9, 0xffffff, alpha * 0.7).strokePoints(line);
      }
    });
  }

  destroy() {
    this.g?.destroy();
    this.sparks?.destroy();
  }
}

/** Kleine, feste Vorschau eines Schweifs (für den Shop), endet bei (x, y). */
export function drawTrailPreview(scene, kind, x, y, len, depth = 6) {
  const g = scene.add.graphics().setDepth(depth);
  if (kind === 'rainbow') {
    RAINBOW.forEach((color, b) => {
      const off = (b - 2.5) * 5;
      const line = [];
      for (let i = 0; i <= 8; i++) line.push({ x: x - (len * i) / 8, y: y + off + (i % 2 ? 3 : -3) });
      g.lineStyle(6, color, 1).strokePoints(line);
    });
  } else if (kind === 'stars') {
    g.lineStyle(12, 0xfff3a0, 0.35).lineBetween(x - len, y + 4, x, y);
    g.lineStyle(5, 0xffffff, 0.8).lineBetween(x - len, y + 4, x, y);
    [[0.3, -10], [0.6, 12], [0.85, -4]].forEach(([f, dy]) => {
      scene.add.image(x - len * f, y + dy, 'spark').setScale(0.9 / ZOOM).setDepth(depth).setTint(0xffe680);
    });
  }
  return g;
}
