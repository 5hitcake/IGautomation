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
import { TEST_TOOLS } from '../config.js';
import { startTilt, tiltAvailable } from '../services/tilt.js';

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
        + (s.perfectCount ? `   ·   ★ ${tr('Perfekt', 'Perfect')}${s.perfectCount > 1 ? ` ×${s.perfectCount}` : ''}` : '')
        + (s.heavenBest ? `\n${tr('Himmelreich-Rekord', 'Heaven record')}: ${s.heavenBest} ${tr('Etagen', 'floors')}` : ''),
    ];
    txt(this, W / 2, VIEW_H * 0.63, stats.join('\n'), 34, { strokeThickness: 7 }).setLineSpacing(6);

    // Himmelreich als eigener Modus, sobald das Himmelstor einmal erreicht wurde
    const heavenUnlocked = (s.gateCount ?? 0) > 0;
    const play = (mode) => () => {
      unlockAudio();
      sfx.click();
      music.start('game');
      this.scene.start('Game', { mode });
    };
    if (heavenUnlocked) {
      button(this, W / 2 - 160, VIEW_H * 0.76, tr('Spielen', 'Play'), play('normal'), { w: 300, h: 116, size: 50 });
      button(this, W / 2 + 160, VIEW_H * 0.76, tr('Himmelreich', 'Heaven'), play('heaven'), { w: 300, h: 116, size: 38, fill: 0xfff3c4 });
    } else {
      button(this, W / 2, VIEW_H * 0.76, tr('Spielen', 'Play'), play('normal'), { w: 420, h: 116, size: 54 });
    }

    // untere Reihe: Skins · Steuerung (Tippen/Neigen) · Ton
    const rowY = VIEW_H * 0.76 + 130;
    const small = { w: 206, h: 84, size: 30 };
    button(this, W / 2 - 218, rowY, 'Skins', () => {
      unlockAudio();
      sfx.click();
      this.scene.start('Shop');
    }, { ...small, fill: 0xffc2e0 });

    if (s.settings.control === 'tilt') startTilt(); // Sensor schon im Menü einschalten
    const controlBtn = button(this, W / 2, rowY, this.controlLabel(), () => {
      unlockAudio();
      save.update((d) => { d.settings.control = d.settings.control === 'tilt' ? 'touch' : 'tilt'; });
      controlBtn.list[1].setText(this.controlLabel());
      sfx.click();
      if (save.get().settings.control === 'tilt') {
        startTilt();
        // kein Lagesensor (z. B. am PC): Hinweis, im Spiel wird dann getippt
        this.time.delayedCall(900, () => { if (!tiltAvailable()) this.toast(tr('Kein Neigungssensor gefunden –\nim Spiel wird getippt', 'No tilt sensor found –\nthe game will use touch')); });
      }
    }, { ...small, size: 24, fill: 0xc9f5c2 });

    const soundBtn = button(this, W / 2 + 218, rowY, this.soundLabel(), () => {
      unlockAudio();
      save.update((d) => { d.settings.sound = !d.settings.sound; });
      setSoundEnabled(save.get().settings.sound);
      soundBtn.list[1].setText(this.soundLabel());
      sfx.click();
    }, { ...small, fill: 0xbfe6ff });

    // Test-Werkzeug (nur Test-Versionen): unendlich Regenschirme zum Durchspielen
    if (TEST_TOOLS) {
      const infLabel = () => `${tr('Test', 'Test')}: ∞ ☂ ${save.get().settings.infiniteUmbrellas ? tr('an', 'on') : tr('aus', 'off')}`;
      const infBtn = button(this, 128, 70, infLabel(), () => {
        save.update((d) => { d.settings.infiniteUmbrellas = !d.settings.infiniteUmbrellas; });
        infBtn.list[1].setText(infLabel());
        sfx.click();
      }, { w: 220, h: 64, size: 24, fill: 0xfff3a0 });
    }

    txt(this, W / 2, VIEW_H - 70, `v${__APP_VERSION__}`, 24, { strokeThickness: 5, color: '#e8f4ff' });
  }

  controlLabel() {
    const tilt = save.get().settings.control === 'tilt';
    return `${tr('Steuerung', 'Controls')}\n${tilt ? tr('Neigen', 'Tilt') : tr('Tippen', 'Touch')}`;
  }

  toast(text) {
    const t = txt(this, W / 2, VIEW_H * 0.76 + 225, text, 26, { strokeThickness: 6, color: '#fff6c2' }).setDepth(20);
    this.tweens.add({ targets: t, alpha: 0, delay: 2600, duration: 500, onComplete: () => t.destroy() });
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
