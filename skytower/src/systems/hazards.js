// Gefahren in den oberen Zonen. Gewitterfront: Blitze kündigen sich an einer
// Plattform über Wolki an (sie blinkt gelb) und zerstören sie dann.
import { LIGHTNING, TOWER } from '../config.js';
import { W, VIEW_H } from '../view.js';
import { sfx, vibrate } from '../services/audio.js';
import { save } from '../services/storage.js';

const PAD_TOP = 18; // wie PLATFORM_PAD.top in art.js
const rand = ([a, b]) => a + Math.random() * (b - a);

export class Lightning {
  constructor(game) {
    this.game = game;
    this.next = rand(LIGHTNING.every);
    this.target = null;
    this.warnT = 0;
    this.bolt = null; // { pts, t } – sichtbarer Blitz
    this.gfx = game.add.graphics().setDepth(8);
    this.flash = game.add.rectangle(0, 0, W, VIEW_H, 0xffffff, 0).setOrigin(0).setScrollFactor(0).setDepth(19);
  }

  update(dt, active) {
    this.gfx.clear();
    if (this.flash.alpha > 0) this.flash.setAlpha(Math.max(0, this.flash.alpha - dt * 2.5));
    if (this.bolt) this.drawBolt(dt);

    if (!active) {
      this.cancel();
      return;
    }
    if (this.target) {
      const p = this.target;
      this.warnT += dt;
      if (p.gone) { this.cancel(); return; }
      const on = Math.floor(this.warnT * 10) % 2 === 0;
      if (on) p.img.setTint(0xfff27a); else p.img.clearTint();
      // kleiner Warn-Blitz über der Plattform
      this.gfx.fillStyle(0xffd23f, on ? 1 : 0.5);
      const cx = p.x + p.w / 2;
      this.gfx.fillTriangle(cx - 6, p.top - 64, cx + 10, p.top - 64, cx - 8, p.top - 30);
      this.gfx.fillTriangle(cx - 2, p.top - 44, cx + 14, p.top - 44, cx - 2, p.top - 12);
      if (this.warnT >= LIGHTNING.warning) this.strike(p);
      return;
    }
    this.next -= dt;
    if (this.next <= 0) this.pickTarget();
  }

  pickTarget() {
    const g = this.game;
    const minFloor = g.floorUnderPlayer() + LIGHTNING.minFloorsAbove;
    const candidates = g.platforms.filter((p) => !p.gone && p.floor >= minFloor && p.floor % TOWER.milestoneEvery !== 0
      && p.top > g.scrollY + 140 && p.top < g.scrollY + VIEW_H - 100);
    if (!candidates.length) { this.next = 0.5; return; }
    this.target = candidates[Math.floor(Math.random() * candidates.length)];
    this.warnT = 0;
  }

  strike(p) {
    const g = this.game;
    p.img.clearTint();
    p.gone = true;
    g.tweens.add({ targets: p.img, alpha: 0, y: p.top - PAD_TOP + 60, duration: 300, ease: 'Quad.in' });
    // Zickzack von oberhalb des Bildschirms bis zur Plattform
    const x = p.x + p.w / 2;
    const pts = [];
    let y = g.scrollY - 20;
    let bx = x + (Math.random() - 0.5) * 120;
    while (y < p.top) {
      pts.push({ x: bx, y });
      y += 50 + Math.random() * 40;
      bx = x + (bx - x) * 0.6 + (Math.random() - 0.5) * 60;
    }
    pts.push({ x, y: p.top + 10 });
    this.bolt = { pts, t: 0.22 };
    this.flash.setAlpha(0.45);
    g.sparks.explode(22, x, p.top);
    sfx.thunder();
    if (save.get().settings.vibration) vibrate(40);
    this.target = null;
    this.next = rand(LIGHTNING.every);
  }

  drawBolt(dt) {
    const b = this.bolt;
    b.t -= dt;
    if (b.t <= 0) { this.bolt = null; return; }
    const a = Math.min(1, b.t / 0.12);
    this.gfx.lineStyle(14, 0xfff27a, 0.35 * a).strokePoints(b.pts);
    this.gfx.lineStyle(5, 0xffffff, a).strokePoints(b.pts);
  }

  cancel() {
    this.target?.img.clearTint();
    this.target = null;
  }
}
