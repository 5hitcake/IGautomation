// Power-ups, die weiter oben im Turm auftauchen:
// - Raketen-Wolke: schießt Wolki ~30 Etagen nach oben (zählt als Combo-Sprung)
// - Regenschirm: kommt in den Vorrat (max. 3, auch per Werbung) und fängt
//   Wolki automatisch auf, wenn sie aus dem Bild fällt
// - Magnet: zieht eine Weile alle Münzen in der Nähe an
// - Warp-Stern (nur Galaxie): teleportiert ein paar Etagen nach oben
import { POWERUPS, PHYSICS, TOWER, GATE } from '../config.js';
import { ZOOM, txt } from '../view.js';
import { sfx, vibrate } from '../services/audio.js';
import { save } from '../services/storage.js';

const R = PHYSICS.playerRadius;
const FH = TOWER.floorHeight;
const LABEL = { rocket: 'Raketen-Wolke!', shield: 'Regenschirm +1', magnet: 'Münz-Magnet!', warp: 'Warp!' };

/** Regenschirme im Vorrat (gespeichert, gilt über Runden hinweg) */
export const umbrellaStock = () => save.get().umbrellas ?? 0;

function pickWeighted(weights) {
  const entries = Object.entries(weights);
  let r = Math.random() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k;
  }
  return entries[0][0];
}

export class Powerups {
  constructor(game) {
    this.game = game;
    this.magnetUntil = -1;
    this.rocketUntil = -1;
    this.lastItemFloor = -Infinity;
    this.rocketSpeed = 0;

    // Anzeige direkt an Wolki
    this.shieldIcon = game.add.image(0, 0, 'pu_shield').setScale(0.9 / ZOOM).setDepth(8).setVisible(false);
    this.magnetIcon = game.add.image(0, 0, 'pu_magnet').setScale(0.7 / ZOOM).setDepth(8).setVisible(false);
    this.rocketIcon = game.add.image(0, 0, 'pu_rocket').setScale(1.35 / ZOOM).setDepth(6.5).setVisible(false);
    this.flames = game.add.particles(0, 0, 'spark', {
      speed: { min: 60, max: 180 },
      angle: { min: 70, max: 110 },
      lifespan: 380,
      scale: { start: 1.3 / ZOOM, end: 0 },
      tint: [0xffe23d, 0xff9f1a, 0xff4d4d],
      emitting: false,
    }).setDepth(6);
  }

  get rocketActive() {
    return this.game.time0 < this.rocketUntil;
  }

  get magnetActive() {
    return this.game.time0 < this.magnetUntil;
  }

  /** Legt evtl. ein Power-up über Plattform p. Gibt true zurück, wenn ja. */
  maybeSpawn(p, rules) {
    if (p.floor < POWERUPS.fromFloor) return false;
    let kind = null;
    if (rules?.warp && Math.random() < POWERUPS.warp.chance) kind = 'warp';
    else if (p.floor - this.lastItemFloor >= POWERUPS.minGap && Math.random() < POWERUPS.chance) {
      kind = pickWeighted(POWERUPS.weights);
      if (kind === 'shield' && umbrellaStock() >= POWERUPS.shieldMax) kind = null; // Vorrat voll
      if (kind) this.lastItemFloor = p.floor;
    }
    if (!kind) return false;
    const y = p.top - 70;
    const halo = this.game.add.graphics().setDepth(6);
    halo.fillStyle(0xffffff, 0.35).fillCircle(0, 0, 40);
    halo.lineStyle(4, 0xffffff, 0.9).strokeCircle(0, 0, 40);
    halo.setPosition(p.x + p.w / 2, y);
    const img = this.game.add.image(p.x + p.w / 2, y, `pu_${kind}`).setScale(0.85 / ZOOM).setDepth(6);
    p.item = { kind, img, halo, baseY: y };
    return true;
  }

  destroyItem(p) {
    p.item?.img.destroy();
    p.item?.halo.destroy();
    p.item = null;
  }

  /** Jeden Physik-Schritt: Power-ups einsammeln, Wirkungen weiterführen. */
  update(dt) {
    const g = this.game;
    for (const p of g.platforms) {
      const it = p.item;
      if (!it) continue;
      const x = p.x + p.w / 2;
      const y = it.baseY + Math.sin(g.time0 * 3 + p.floor) * 8;
      it.img.setPosition(x, y).setRotation(Math.sin(g.time0 * 2 + p.floor) * 0.15);
      it.halo.setPosition(x, y).setScale(1 + Math.sin(g.time0 * 5) * 0.06);
      const dx = x - g.px;
      const dy = y - g.py;
      if (dx * dx + dy * dy < (R + 38) ** 2) this.collect(p);
    }

    // Über dem Himmelstor gibt es nichts mehr: Rakete brennt dort sofort aus
    if (this.rocketActive && g.floorUnderPlayer() >= GATE.floor) this.rocketUntil = g.time0;
    if (this.rocketActive) {
      g.vy = -this.rocketSpeed;
      if (Math.random() < 0.8) this.flames.emitParticleAt(g.px + (Math.random() - 0.5) * 16, g.py + 100, 1);
    } else if (this.rocketUntil > 0) {
      // Rakete ist gerade ausgebrannt
      this.rocketUntil = -1;
      g.vy = -900;
      g.reachFloor(g.floorUnderPlayer());
    }
  }

  /** Anzeigen jedes Frame an Wolkis Position ausrichten. */
  render() {
    const g = this.game;
    const bob = Math.sin(g.time0 * 4) * 4;
    this.shieldIcon.setVisible(umbrellaStock() > 0).setPosition(g.px, g.py - 78 + bob);
    const magnetLeft = this.magnetUntil - g.time0;
    this.magnetIcon.setVisible(magnetLeft > 0 && (magnetLeft > 2 || Math.floor(g.time0 * 6) % 2 === 0))
      .setPosition(g.px + 50, g.py - 44 + bob);
    this.rocketIcon.setVisible(this.rocketActive).setPosition(g.px, g.py + 58);
  }

  collect(p) {
    const g = this.game;
    const { kind } = p.item;
    const x = p.item.img.x;
    const y = p.item.img.y;
    this.destroyItem(p);
    sfx.powerup();
    if (save.get().settings.vibration) vibrate(30);
    g.sparks.explode(18, x, y);
    this.floatText(x, y, LABEL[kind]);

    if (kind === 'rocket') {
      this.rocketSpeed = (POWERUPS.rocket.floors * FH) / POWERUPS.rocket.duration;
      this.rocketUntil = g.time0 + POWERUPS.rocket.duration;
      sfx.rocket();
    } else if (kind === 'shield') {
      save.update((d) => { d.umbrellas = Math.min(POWERUPS.shieldMax, (d.umbrellas ?? 0) + 1); });
      g.renderUmbrellas?.();
    } else if (kind === 'magnet') {
      this.magnetUntil = g.time0 + POWERUPS.magnet.duration;
    } else if (kind === 'warp') {
      g.warp(POWERUPS.warp.floors);
    }
  }

  /** Regenschirm aus dem Vorrat verbrauchen, falls vorhanden (Rettung vor dem Game Over). */
  useShield() {
    if (umbrellaStock() <= 0) return false;
    save.update((d) => { d.umbrellas -= 1; });
    this.game.renderUmbrellas?.();
    sfx.shield();
    return true;
  }

  floatText(x, y, s) {
    const t = txt(this.game, x, y - 30, s, 34, { color: '#fff6c2', strokeThickness: 7 }).setDepth(12);
    this.game.tweens.add({ targets: t, y: y - 110, alpha: 0, duration: 900, ease: 'Quad.out', onComplete: () => t.destroy() });
  }
}
