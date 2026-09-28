// Gefahren in den oberen Zonen: Eine Plattform über Wolki kündigt den Einschlag
// an (sie blinkt), dann wird sie zerstört.
// - Gewitterfront: Blitz von oben (sofort)
// - Asteroidengürtel: Meteor fliegt schräg heran und schlägt ein
import { LIGHTNING, TOWER } from '../config.js';
import { W, VIEW_H, ZOOM } from '../view.js';
import { sfx, vibrate } from '../services/audio.js';
import { save } from '../services/storage.js';

const PAD_TOP = 18; // wie PLATFORM_PAD.top in art.js
const rand = ([a, b]) => a + Math.random() * (b - a);
const WARN = {
  lightning: { tint: 0xfff27a, mark: 0xffd23f },
  meteor: { tint: 0xff8a70, mark: 0xff4d4d },
};

export class Hazards {
  constructor(game) {
    this.game = game;
    this.next = rand(LIGHTNING.every);
    this.target = null;
    this.warnT = 0;
    this.bolt = null; // { pts, t } – sichtbarer Blitz
    this.gfx = game.add.graphics().setDepth(8);
    this.flash = game.add.rectangle(0, 0, W, VIEW_H, 0xffffff, 0).setOrigin(0).setScrollFactor(0).setDepth(19);
  }

  /** kind: 'lightning' | 'meteor' | undefined (keine Gefahr in dieser Zone) */
  update(dt, kind) {
    this.gfx.clear();
    if (this.flash.alpha > 0) this.flash.setAlpha(Math.max(0, this.flash.alpha - dt * 2.5));
    if (this.bolt) this.drawBolt(dt);

    if (!kind) {
      this.cancel();
      return;
    }
    if (this.target) {
      const p = this.target;
      if (p.gone) { this.cancel(); return; }
      if (this.target.incoming) return; // Meteor ist schon unterwegs
      this.warnT += dt;
      const w = WARN[kind];
      const on = Math.floor(this.warnT * 10) % 2 === 0;
      if (on) p.img.setTint(w.tint); else p.img.clearTint();
      this.drawMark(p, kind, on);
      if (this.warnT >= LIGHTNING.warning) {
        if (kind === 'lightning') this.strikeLightning(p);
        else this.launchMeteor(p);
      }
      return;
    }
    this.next -= dt;
    if (this.next <= 0) this.pickTarget();
  }

  drawMark(p, kind, on) {
    const cx = p.x + p.w / 2;
    this.gfx.fillStyle(WARN[kind].mark, on ? 1 : 0.5);
    if (kind === 'lightning') {
      this.gfx.fillTriangle(cx - 6, p.top - 64, cx + 10, p.top - 64, cx - 8, p.top - 30);
      this.gfx.fillTriangle(cx - 2, p.top - 44, cx + 14, p.top - 44, cx - 2, p.top - 12);
    } else {
      // rotes Ausrufezeichen im Kreis
      this.gfx.fillCircle(cx, p.top - 40, 18);
      this.gfx.fillStyle(0xffffff, on ? 1 : 0.6);
      this.gfx.fillRoundedRect(cx - 3, p.top - 52, 6, 16, 3);
      this.gfx.fillCircle(cx, p.top - 30, 3.5);
    }
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

  /** Plattform zerstören (nach Blitz oder Meteor) */
  destroyPlatform(p) {
    const g = this.game;
    p.img.clearTint();
    p.gone = true;
    g.tweens.add({ targets: p.img, alpha: 0, y: p.top - PAD_TOP + 60, duration: 300, ease: 'Quad.in' });
    g.sparks.explode(22, p.x + p.w / 2, p.top);
    if (save.get().settings.vibration) vibrate(40);
    this.target = null;
    this.next = rand(LIGHTNING.every);
  }

  strikeLightning(p) {
    const g = this.game;
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
    sfx.thunder();
    this.destroyPlatform(p);
  }

  launchMeteor(p) {
    const g = this.game;
    p.img.clearTint();
    p.incoming = true;
    const x = p.x + p.w / 2;
    const fromX = x < W / 2 ? W + 80 : -80;
    const m = g.add.image(fromX, g.scrollY - 120, 'meteor').setScale(1 / ZOOM).setDepth(8)
      .setFlipX(fromX < 0);
    sfx.meteor();
    g.tweens.add({
      targets: m, x, y: p.top - 20, duration: 450, ease: 'Quad.in',
      onComplete: () => {
        m.destroy();
        this.flash.setAlpha(0.25);
        sfx.thunder();
        if (!p.gone) this.destroyPlatform(p);
        else { this.target = null; this.next = rand(LIGHTNING.every); }
      },
    });
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
    if (this.target?.incoming) return; // ein fliegender Meteor schlägt noch ein
    this.target?.img.clearTint();
    this.target = null;
  }
}
