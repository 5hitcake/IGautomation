import Phaser from 'phaser';
import { W, VIEW_H, ZOOM, setupCamera, txt, button } from '../view.js';
import { Sky } from '../systems/sky.js';
import { drawPlatform } from '../art.js';
import { save } from '../services/storage.js';
import { unlockAudio, setSoundEnabled, sfx, music } from '../services/audio.js';

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

    const title = txt(this, W / 2, VIEW_H * 0.17, 'Sky Tower', 118, { strokeThickness: 16, color: '#ffffff' });
    title.setShadow(0, 10, '#2d3a5a', 0, true, false);
    this.tweens.add({ targets: title, angle: { from: -2, to: 2 }, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    txt(this, W / 2, VIEW_H * 0.17 + 92, 'Hüpf in den Himmel!', 38, { color: '#fff6c2', strokeThickness: 7 });

    // Wolki hüpft auf einer Wolke
    const baseY = VIEW_H * 0.52;
    const pg = this.add.graphics({ x: W / 2 - 110, y: baseY }).setDepth(3);
    drawPlatform(pg, 'cloud', 220);
    const wolki = this.add.image(W / 2, baseY, 'wolki_idle').setOrigin(0.5, 0.96).setScale(1.5 / ZOOM).setDepth(4);
    this.tweens.add({
      targets: wolki,
      y: baseY - 190,
      duration: 480,
      ease: 'Quad.out',
      yoyo: true,
      repeat: -1,
    });

    const stats = [
      `Rekord: ${s.highscore.toLocaleString('de-DE')}`,
      `Beste Etage: ${s.bestFloor}   ·   Beste Combo: ${s.bestCombo}`,
      `Münzen: ${s.coins.toLocaleString('de-DE')}`,
    ];
    txt(this, W / 2, VIEW_H * 0.63, stats.join('\n'), 34, { strokeThickness: 7 }).setLineSpacing(6);

    button(this, W / 2, VIEW_H * 0.76, 'Spielen', () => {
      unlockAudio();
      sfx.click();
      music.start('game');
      this.scene.start('Game');
    }, { w: 420, h: 116, size: 54 });

    const soundBtn = button(this, W / 2, VIEW_H * 0.76 + 130, this.soundLabel(), () => {
      unlockAudio();
      save.update((d) => { d.settings.sound = !d.settings.sound; });
      setSoundEnabled(save.get().settings.sound);
      soundBtn.list[1].setText(this.soundLabel());
      sfx.click();
    }, { w: 260, h: 78, size: 34, fill: 0xbfe6ff });

    txt(this, W / 2, VIEW_H - 70, 'Prototyp v0.2 · Grafiken sind Platzhalter', 24, { strokeThickness: 5, color: '#e8f4ff' });
  }

  soundLabel() {
    return save.get().settings.sound ? 'Ton: an' : 'Ton: aus';
  }

  update() {
    this.sky.update(0, 0);
  }
}
