import Phaser from 'phaser';
import { W, VIEW_H, ZOOM, setupCamera, txt, button } from '../view.js';
import { sfx } from '../services/audio.js';
import { skinKey } from '../systems/skinTextures.js';
import { save } from '../services/storage.js';
import { TEST_TOOLS, REVIVE } from '../config.js';
import { tr, num } from '../i18n.js';
import { skinById } from '../systems/progress.js';

function panel(scene, h) {
  scene.add.rectangle(0, 0, W, VIEW_H, 0x10183a, 0.5).setOrigin(0);
  const g = scene.add.graphics();
  const pw = 600;
  const x = (W - pw) / 2;
  const y = (VIEW_H - h) / 2;
  g.fillStyle(0x2d3a5a).fillRoundedRect(x - 7, y - 7, pw + 14, h + 14, 46);
  g.fillStyle(0xffffff).fillRoundedRect(x, y, pw, h, 40);
  g.fillStyle(0xbfe6ff).fillRoundedRect(x, y, pw, 120, { tl: 40, tr: 40, bl: 0, br: 0 });
  return y;
}

export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create() {
    setupCamera(this);
    const y = panel(this, 460);
    txt(this, W / 2, y + 62, tr('Pause', 'Paused'), 64);
    button(this, W / 2, y + 220, tr('Weiter', 'Resume'), () => {
      sfx.click();
      this.resumeGame();
    });
    button(this, W / 2, y + 350, tr('Menü', 'Menu'), () => {
      sfx.click();
      this.scene.stop('Game');
      this.scene.start('Menu');
    }, { fill: 0xbfe6ff });
  }

  resumeGame() {
    this.scene.stop();
    this.scene.resume('Game');
    this.scene.get('Game').resumeWithCountdown(); // Musik startet bei „Los!“
  }
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(data) {
    const { score, floor, combo, coins, isNew, won, angel, perfect, star } = data;
    this.initData = data;
    setupCamera(this);
    const y = panel(this, 760);
    const record = isNew.score;
    const title = won ? tr('Geschafft!', 'You made it!') : record ? tr('Neuer Rekord!', 'New record!') : 'Game Over';
    txt(this, W / 2, y + 62, title, 60, { color: won || record ? '#ffe066' : '#ffffff' });
    if (won) {
      const sub = perfect ? tr('★ Perfekter Aufstieg – ohne Regenschirm ★', '★ Perfect climb – no umbrella ★')
        : record ? tr('Himmelstor erreicht · Neuer Rekord!', 'Heaven Gate reached · New record!') : tr('Himmelstor erreicht', 'Heaven Gate reached');
      txt(this, W / 2, y + 122, sub, 30,
        { color: '#5a6a8a', stroke: '#ffffff', strokeThickness: 0 });
    }
    if (record || won) {
      // Wolki jubelt mit ^^-Gesicht über dem Rekord bzw. dem Ziel
      const wy = y - 6;
      const wolki = this.add.image(W / 2, wy, skinKey(save.get().selectedSkin, 'happy')).setOrigin(0.5, 0.92).setScale(1.5 / ZOOM).setDepth(11);
      this.tweens.add({ targets: wolki, y: wy - 44, duration: 420, ease: 'Quad.out', yoyo: true, repeat: -1 });
      const sparks = this.add.particles(0, 0, 'spark', {
        speed: { min: 160, max: 420 },
        lifespan: 800,
        scale: { start: 1.2 / ZOOM, end: 0 },
        gravityY: 500,
        emitting: false,
      }).setDepth(12);
      sparks.explode(28, W / 2, wy - 80);
    }

    txt(this, W / 2, y + 190, num(score), 96, { color: '#ffd23f', strokeThickness: 12 });
    txt(this, W / 2, y + 262, tr('Punkte', 'Points'), 32, { color: '#5a6a8a', stroke: '#ffffff', strokeThickness: 0 });

    const rows = [
      [tr('Etage', 'Floor'), `${floor}`, isNew.floor],
      [tr('Beste Combo', 'Best combo'), `${combo}`, isNew.combo],
      [tr('Münzen', 'Coins'), `+${num(coins)}`, false],
    ];
    rows.forEach(([label, value, fresh], i) => {
      const ry = y + 340 + i * 62;
      const dark = { color: '#2d3a5a', stroke: '#ffffff', strokeThickness: 0 };
      txt(this, W / 2 - 230, ry, label, 38, { ...dark, ox: 0 });
      txt(this, W / 2 + 230, ry, fresh ? `${value} ★` : value, 38, { ...dark, ox: 1, color: fresh ? '#e08a00' : '#2d3a5a' });
    });

    const unlocked = [...(angel ? [skinById('engel').name] : []), ...(star ? [skinById('sterne').name] : []), ...(isNew.unlocked ?? [])];
    if (unlocked.length) {
      // Neu freigeschaltete Skins unter dem Ergebnis ankündigen
      const t = txt(this, W / 2, y + 760 + 64, tr(`Neuer Skin: ${unlocked.join(', ')}!`, `New skin: ${unlocked.join(', ')}!`), 38,
        { color: '#ffe066', wrap: W - 80 }).setDepth(12);
      this.tweens.add({ targets: t, scale: { from: 0.6, to: 1 }, duration: 400, ease: 'Back.out' });
      sfx.zone();
    }

    button(this, W / 2, y + 560, tr('Nochmal', 'Play again'), () => {
      sfx.click();
      this.scene.stop();
      this.scene.get('Game').scene.restart();
    });
    button(this, W / 2, y + 686, tr('Menü', 'Menu'), () => {
      sfx.click();
      this.scene.stop('Game');
      this.scene.start('Menu');
    }, { fill: 0xbfe6ff, h: 88, size: 38 });

    // Weiterspielen: ein Regenschirm fängt Wolki auf und die Runde geht an derselben
    // Stelle weiter (zum Start gratis, später per belohnter Werbung – siehe REVIVE)
    if (!won) {
      const by = y + 760 + (unlocked.length ? 150 : 84);
      const revives = this.scene.get('Game').revives ?? 0;
      if (revives < REVIVE.max) this.reviveOffer(by, REVIVE.max - revives);
      else txt(this, W / 2, by, tr('Keine Rettung mehr in dieser Runde', 'No more rescues this round'), 28, { color: '#e8f4ff', strokeThickness: 6 }).setDepth(12);
    }
  }

  reviveOffer(by, left) {
    const go = () => {
      this.scene.stop();
      this.scene.get('Game').revive();
    };
    const viaAd = REVIVE.viaAd && TEST_TOOLS; // echte Werbung kommt mit AdMob (Phase 6)
    button(this, W / 2, by, viaAd ? tr('Weiterspielen per Werbung', 'Continue (watch ad)') : tr('Weiterspielen', 'Continue'), () => {
      sfx.click();
      if (viaAd) this.playFakeAd(go); else go();
    }, { w: 520, h: 80, size: 30, fill: 0x9ff0b0 }).setDepth(12);
    this.add.image(W / 2 - 215, by - 2, 'pu_shield').setScale(0.7 / ZOOM).setDepth(13);
    const sub = REVIVE.max > 1 ? tr(`noch ${left}×`, `${left}× left`) : tr('1× pro Runde', 'once per round');
    txt(this, W / 2, by + 62, tr('Ein Regenschirm fängt dich auf', 'An umbrella catches you') + ` · ${sub}${viaAd ? tr(' · Test-Werbung', ' · test ad') : ''}`, 24, { color: '#e8f4ff', strokeThickness: 5 }).setDepth(12);
  }

  /** Platzhalter für eine belohnte Werbung (wird in Phase 6 durch AdMob ersetzt) */
  playFakeAd(onReward) {
    const layer = this.add.container(0, 0).setDepth(50);
    layer.add(this.add.rectangle(0, 0, W, VIEW_H, 0x10183a, 0.94).setOrigin(0).setInteractive());
    const t = txt(this, W / 2, VIEW_H / 2, '', 52, { strokeThickness: 9 });
    layer.add(t);
    let left = REVIVE.fakeAdSeconds;
    const show = () => t.setText(tr(`Werbung (Test)\n${left}`, `Ad (test)\n${left}`));
    show();
    this.time.addEvent({
      delay: 1000,
      repeat: REVIVE.fakeAdSeconds - 1,
      callback: () => {
        left -= 1;
        if (left > 0) { show(); return; }
        sfx.shield();
        layer.destroy();
        onReward();
      },
    });
  }
}
