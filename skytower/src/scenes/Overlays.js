import Phaser from 'phaser';
import { W, VIEW_H, ZOOM, setupCamera, txt, button } from '../view.js';
import { sfx } from '../services/audio.js';
import { music } from '../services/music.js';

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
    txt(this, W / 2, y + 62, 'Pause', 64);
    button(this, W / 2, y + 220, 'Weiter', () => {
      sfx.click();
      this.resumeGame();
    });
    button(this, W / 2, y + 350, 'Menü', () => {
      sfx.click();
      this.scene.stop('Game');
      this.scene.start('Menu');
    }, { fill: 0xbfe6ff });
  }

  resumeGame() {
    this.scene.stop();
    this.scene.resume('Game');
    music.start('game', this.scene.get('Game').camLevel);
  }
}

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create({ score, floor, combo, coins, isNew }) {
    setupCamera(this);
    const y = panel(this, 760);
    const record = isNew.score;
    txt(this, W / 2, y + 62, record ? 'Neuer Rekord!' : 'Game Over', 60, { color: record ? '#ffe066' : '#ffffff' });
    if (record) {
      // Wolki jubelt mit ^^-Gesicht über dem Rekord
      const wy = y - 6;
      const wolki = this.add.image(W / 2, wy, 'wolki_happy').setOrigin(0.5, 0.92).setScale(1.5 / ZOOM).setDepth(11);
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

    txt(this, W / 2, y + 190, score.toLocaleString('de-DE'), 96, { color: '#ffd23f', strokeThickness: 12 });
    txt(this, W / 2, y + 262, 'Punkte', 32, { color: '#5a6a8a', stroke: '#ffffff', strokeThickness: 0 });

    const rows = [
      ['Etage', `${floor}`, isNew.floor],
      ['Beste Combo', `${combo}`, isNew.combo],
      ['Münzen', `+${coins}`, false],
    ];
    rows.forEach(([label, value, fresh], i) => {
      const ry = y + 340 + i * 62;
      const dark = { color: '#2d3a5a', stroke: '#ffffff', strokeThickness: 0 };
      txt(this, W / 2 - 230, ry, label, 38, { ...dark, ox: 0 });
      txt(this, W / 2 + 230, ry, fresh ? `${value} ★` : value, 38, { ...dark, ox: 1, color: fresh ? '#e08a00' : '#2d3a5a' });
    });

    button(this, W / 2, y + 560, 'Nochmal', () => {
      sfx.click();
      this.scene.stop();
      this.scene.get('Game').scene.restart();
    });
    button(this, W / 2, y + 686, 'Menü', () => {
      sfx.click();
      this.scene.stop('Game');
      this.scene.start('Menu');
    }, { fill: 0xbfe6ff, h: 88, size: 38 });
  }
}
