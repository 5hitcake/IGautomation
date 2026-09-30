import Phaser from 'phaser';
import { W, VIEW_H, ZOOM, setupCamera, txt, button } from '../view.js';
import { Sky } from '../systems/sky.js';
import { drawPlatform } from '../art.js';
import { save } from '../services/storage.js';
import { unlockAudio, setSoundEnabled, sfx } from '../services/audio.js';
import { music } from '../services/music.js';
import { skinKey } from '../systems/skinTextures.js';
import { Trail } from '../systems/trail.js';
import { skinById } from '../systems/progress.js';
import { tr, num } from '../i18n.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    setupCamera(this);
    const s = save.get();
    setSoundEnabled(s.settings.sound);
    this.sky = new Sky(this, { city: true });
    // Musik darf erst nach der ersten Berührung starten (Browser-Regel)
    music.start('menu');
    this.input.once('pointerdown', () => {
      unlockAudio();
      music.start('menu');
    });

    txt(this, W / 2, VIEW_H * 0.17 - 88, 'Wolki', 60, { strokeThickness: 10, color: '#ffe066' });
    const title = txt(this, W / 2, VIEW_H * 0.17, 'Sky Climber', 104, { strokeThickness: 16, color: '#ffffff' });
    title.setShadow(0, 10, '#2d3a5a', 0, true, false);
    this.tweens.add({ targets: title, angle: { from: -2, to: 2 }, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    txt(this, W / 2, VIEW_H * 0.17 + 100, tr('Hüpf in den Himmel!', 'Hop into the sky!'), 38, { color: '#fff6c2', strokeThickness: 7 });

    // Wolki hüpft auf einer Wolke – oder fliegt mit ihrem Schweif (Nyan-Stil)
    const baseY = VIEW_H * 0.52;
    const trailKind = skinById(s.selectedSkin).trail;
    this.trail = new Trail(this, trailKind, { depth: 3.5, drift: -360, flat: true, life: 0.6 });
    const wolki = this.add.image(W / 2, baseY, skinKey(s.selectedSkin, 'happy'))
      .setOrigin(0.5, 0.96).setScale(1.5 / ZOOM).setDepth(4);
    this.wolki = wolki;
    if (trailKind) {
      wolki.setPosition(W / 2 + 60, baseY - 90);
      this.tweens.add({ targets: wolki, y: baseY - 118, duration: 420, ease: 'Sine.inOut', yoyo: true, repeat: -1 });
    } else {
      const pg = this.add.graphics({ x: W / 2 - 110, y: baseY }).setDepth(3);
      drawPlatform(pg, 'cloud', 220);
      this.tweens.add({ targets: wolki, y: baseY - 190, duration: 480, ease: 'Quad.out', yoyo: true, repeat: -1 });
    }

    const stats = [
      `${tr('Rekord', 'Best score')}: ${num(s.highscore)}`,
      `${tr('Beste Etage', 'Best floor')}: ${s.bestFloor}   ·   ${tr('Beste Combo', 'Best combo')}: ${s.bestCombo}`,
      `${tr('Münzen', 'Coins')}: ${num(s.coins)}`
        + (s.umbrellas ? `   ·   ${tr('Regenschirme', 'Umbrellas')}: ${s.umbrellas}` : '')
        + (s.gateCount ? `\n${tr('Himmelstor erreicht', 'Heaven Gate reached')}${s.gateCount > 1 ? ` ×${s.gateCount}` : ''}` : '')
        + (s.perfectCount ? `   ·   ★ ${tr('Perfekt', 'Perfect')}${s.perfectCount > 1 ? ` ×${s.perfectCount}` : ''}` : ''),
    ];
    txt(this, W / 2, VIEW_H * 0.63, stats.join('\n'), 34, { strokeThickness: 7 }).setLineSpacing(6);

    button(this, W / 2, VIEW_H * 0.76, tr('Spielen', 'Play'), () => {
      unlockAudio();
      sfx.click();
      music.start('game');
      this.scene.start('Game');
    }, { w: 420, h: 116, size: 54 });

    button(this, W / 2 - 145, VIEW_H * 0.76 + 130, 'Skins', () => {
      unlockAudio();
      sfx.click();
      this.scene.start('Shop');
    }, { w: 260, h: 78, size: 34, fill: 0xffc2e0 });

    const soundBtn = button(this, W / 2 + 145, VIEW_H * 0.76 + 130, this.soundLabel(), () => {
      unlockAudio();
      save.update((d) => { d.settings.sound = !d.settings.sound; });
      setSoundEnabled(save.get().settings.sound);
      soundBtn.list[1].setText(this.soundLabel());
      sfx.click();
    }, { w: 260, h: 78, size: 34, fill: 0xbfe6ff });

    txt(this, W / 2, VIEW_H - 70, `v${__APP_VERSION__}`, 24, { strokeThickness: 5, color: '#e8f4ff' });
  }

  soundLabel() {
    return save.get().settings.sound ? tr('Ton: an', 'Sound: on') : tr('Ton: aus', 'Sound: off');
  }

  update(_t, deltaMs) {
    this.sky.update(0, 0);
    // Schweif "fliegt" nach links, während Wolki auf der Stelle schwebt
    this.trail.update(this.wolki.x - 40, this.wolki.y - 64, Math.min(deltaMs / 1000, 0.1));
  }
}
