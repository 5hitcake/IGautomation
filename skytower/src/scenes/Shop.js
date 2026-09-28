import Phaser from 'phaser';
import { W, VIEW_H, ZOOM, setupCamera, txt, button } from '../view.js';
import { Sky } from '../systems/sky.js';
import { save } from '../services/storage.js';
import { sfx, vibrate } from '../services/audio.js';
import { ensureSkin, skinKey } from '../systems/skinTextures.js';
import {
  SKIN_LIST, GOAL_TEXT, skinById, skinState, buySkin, selectSkin, goalProgress,
} from '../systems/progress.js';
import { drawTrailPreview } from '../systems/trail.js';
import { TEST_TOOLS } from '../config.js';

const INK = '#2d3a5a';
const COLS = 3;
const GAP = 16;
const TOP = 150;
const PANEL_H = 250;

const STATUS = {
  selected: ['Ausgewählt', '#2f9e44'],
  owned: ['Gehört dir', '#5a6a8a'],
  goal: ['Erfolg', '#b35c00'],
  premium: ['Premium', '#9c36b5'],
  secret: ['Geheim', '#b35c00'],
};

export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  async create({ focus } = {}) {
    setupCamera(this);
    const data = save.get();
    this.focus = focus ?? data.selectedSkin;
    this.sky = new Sky(this, { scrollY: 0 });

    // Kopfzeile
    const back = this.add.graphics().setDepth(10);
    back.fillStyle(0x2d3a5a).fillCircle(58, 74, 40);
    back.fillStyle(0xffffff).fillCircle(58, 74, 34);
    txt(this, 56, 70, '‹', 64, { color: INK, strokeThickness: 0 });
    this.add.zone(58, 74, 110, 110).setInteractive().on('pointerup', () => this.leave());
    txt(this, W / 2, 74, 'Skins', 64);
    this.add.image(W - 58, 74, 'coin').setScale(0.9 / ZOOM).setDepth(10);
    txt(this, W - 90, 74, data.coins.toLocaleString('de-DE'), 40, { ox: 1, color: '#ffe680' });
    if (TEST_TOOLS) {
      // Test-Werkzeuge: 5× schnell tippen
      this.multiTap(W - 110, 74, 200, 100, () => { save.addTestCoins(); sfx.coin(); });
      this.multiTap(W / 2, 74, 220, 100, () => { save.unlockAllSkins(); sfx.zone(); });
    }

    // Vorschaubilder aller Skins (je nur die ^^-Pose)
    await Promise.all(SKIN_LIST.map((s) => ensureSkin(this, s.id, ['happy'])));
    if (!this.sys.isActive()) return; // Szene wurde inzwischen verlassen
    const gridBottom = this.buildGrid(data);
    this.buildPanel(data, Math.min(VIEW_H - PANEL_H - 24, gridBottom + 28));
  }

  update() {
    this.sky.update(0, 0);
  }

  /** Löst `action` aus, wenn die Fläche 5× innerhalb von 2 Sekunden angetippt wird. */
  multiTap(x, y, w, h, action) {
    let taps = [];
    this.add.zone(x, y, w, h).setInteractive().on('pointerup', () => {
      const now = this.time.now;
      taps = [...taps.filter((t) => now - t < 2000), now];
      if (taps.length >= 5) {
        taps = [];
        action();
        this.scene.restart({ focus: this.focus });
      }
    });
  }

  leave() {
    sfx.click();
    this.scene.start('Menu');
  }

  /** Baut das Skin-Raster und gibt dessen Unterkante zurück. */
  buildGrid(data) {
    const panelY = VIEW_H - PANEL_H - 24;
    const rows = Math.ceil(SKIN_LIST.length / COLS);
    const cw = (W - 2 * 40 - (COLS - 1) * GAP) / COLS;
    const ch = Math.min(230, (panelY - 16 - TOP - (rows - 1) * GAP) / rows);
    const imgScale = Math.min(1.2, (ch - 70) / 104);

    SKIN_LIST.forEach((skin, i) => {
      // eine unvollständige letzte Reihe wird mittig gesetzt
      const row = Math.floor(i / COLS);
      const inRow = Math.min(COLS, SKIN_LIST.length - row * COLS);
      const x = 40 + ((COLS - inRow) / 2 + (i % COLS)) * (cw + GAP);
      const y = TOP + row * (ch + GAP);
      const state = skinState(data, skin);
      const focused = skin.id === this.focus;
      const secret = state === 'secret';
      const locked = secret || state === 'goal' || state === 'premium' || state === 'tooExpensive' || state === 'buyable';

      const g = this.add.graphics().setDepth(5);
      g.fillStyle(0x2d3a5a).fillRoundedRect(x - 4, y - 4, cw + 8, ch + 8, 26);
      g.fillStyle(focused ? 0xfff6c2 : 0xffffff).fillRoundedRect(x, y, cw, ch, 22);
      if (state === 'selected') g.lineStyle(6, 0x2f9e44).strokeRoundedRect(x + 3, y + 3, cw - 6, ch - 6, 20);
      else if (focused) g.lineStyle(6, 0xffcf4a).strokeRoundedRect(x + 3, y + 3, cw - 6, ch - 6, 20);

      const img = this.add.image(x + cw / 2, y + (ch - 56) / 2 + 6, skinKey(skin.id, 'happy'))
        .setScale(imgScale / ZOOM).setDepth(6);
      if (locked) img.setAlpha(0.5);
      if (secret) img.setTint(0x2d3a5a).setAlpha(0.7);
      if (skin.trail && !secret) {
        drawTrailPreview(this, skin.trail, img.x - 30 * imgScale, img.y + 4, cw * 0.36, 5.5).setAlpha(locked ? 0.5 : 1);
      }

      txt(this, x + cw / 2, y + ch - 48, secret ? '???' : skin.short ?? skin.name, 22, { color: INK, strokeThickness: 0 }).setDepth(7);
      this.statusLabel(x + cw / 2, y + ch - 20, skin, state);
      if (locked && !skin.price) this.lockBadge(x + cw - 28, y + 28);

      this.add.zone(x + cw / 2, y + ch / 2, cw, ch).setInteractive().on('pointerup', () => {
        sfx.click();
        this.scene.restart({ focus: skin.id });
      });
    });
    return TOP + rows * ch + (rows - 1) * GAP;
  }

  statusLabel(x, y, skin, state) {
    if (skin.price && (state === 'buyable' || state === 'tooExpensive')) {
      const color = state === 'buyable' ? '#b35c00' : '#8a93ad';
      const t = txt(this, x + 14, y, skin.price.toLocaleString('de-DE'), 22, { color, strokeThickness: 0 }).setDepth(7);
      this.add.image(x - t.width / 2 - 6, y, 'coin').setScale(0.5 / ZOOM).setDepth(7);
      return;
    }
    const [label, color] = STATUS[state];
    txt(this, x, y, label, 22, { color, strokeThickness: 0 }).setDepth(7);
  }

  lockBadge(x, y) {
    const g = this.add.graphics().setDepth(8);
    g.fillStyle(0x2d3a5a).fillCircle(x, y, 18);
    g.lineStyle(4, 0xffffff).strokeCircle(x, y - 6, 6);
    g.fillStyle(0xffffff).fillRoundedRect(x - 9, y - 4, 18, 14, 3);
  }

  buildPanel(data, y) {
    const skin = skinById(this.focus);
    const state = skinState(data, skin);
    const g = this.add.graphics().setDepth(5);
    g.fillStyle(0x2d3a5a).fillRoundedRect(32, y - 6, W - 64, PANEL_H + 12, 34);
    g.fillStyle(0xffffff).fillRoundedRect(38, y, W - 76, PANEL_H, 30);

    const secret = state === 'secret';
    const preview = this.add.image(140, y + PANEL_H / 2, skinKey(skin.id, 'happy')).setScale(1.7 / ZOOM).setDepth(6)
      .setAlpha(state === 'goal' || state === 'premium' ? 0.55 : 1);
    if (secret) preview.setTint(0x2d3a5a).setAlpha(0.7);
    if (skin.trail && !secret) drawTrailPreview(this, skin.trail, 100, y + PANEL_H / 2 + 6, 60, 5.5);
    const tx = 250;
    txt(this, tx, y + 50, secret ? '???' : skin.name, 38, { color: INK, strokeThickness: 0, ox: 0 }).setDepth(7);

    const line = (s, yy, color = '#5a6a8a', size = 26) =>
      txt(this, tx, yy, s, size, { color, strokeThickness: 0, ox: 0, align: 'left', wrap: W - tx - 60 }).setDepth(7);
    const actionY = y + PANEL_H - 62;
    const act = (label, onTap, fill) => button(this, tx + 170, actionY, label, onTap, { w: 340, h: 88, size: 36, fill });

    if (state === 'selected') {
      line('Diesen Skin trägt Wolki gerade.', y + 100);
      this.disabledButton(tx + 170, actionY, 'Ausgewählt ✓');
    } else if (state === 'owned') {
      line('Gehört dir.', y + 100);
      act('Auswählen', () => this.choose(skin.id), 0x8ce99a);
    } else if (state === 'buyable') {
      line(`Kostet ${skin.price.toLocaleString('de-DE')} Münzen.`, y + 100);
      act(`Kaufen · ${skin.price.toLocaleString('de-DE')}`, () => this.buy(skin.id));
    } else if (state === 'tooExpensive') {
      line(`Kostet ${skin.price.toLocaleString('de-DE')} Münzen.`, y + 100);
      this.disabledButton(tx + 170, actionY, `Noch ${(skin.price - data.coins).toLocaleString('de-DE')} Münzen`);
    } else if (secret) {
      line('Geheimer Skin. Er wird nur am Himmelstor (Etage 1.000) freigeschaltet.', y + 100, INK, 26);
    } else {
      if (skin.premium) line('Premium-Skin: kommt mit dem Shop für In-App-Käufe.', y + 96, '#9c36b5', 24);
      const p = goalProgress(data, skin);
      if (p) {
        const prefix = skin.premium ? 'Oder: ' : '';
        line(`${prefix}${GOAL_TEXT[skin.goal.type](p.target)}`, y + (skin.premium ? 150 : 100), INK, 26);
        this.progressBar(tx, actionY + 6, W - tx - 70, p.current / p.target,
          `${Math.min(p.current, p.target).toLocaleString('de-DE')} / ${p.target.toLocaleString('de-DE')}`);
      }
    }
  }

  disabledButton(x, y, label) {
    const g = this.add.graphics().setDepth(9);
    g.fillStyle(0xd5dbe8).fillRoundedRect(x - 170, y - 44, 340, 88, 44);
    txt(this, x, y - 2, label, 30, { color: '#6b7390', strokeThickness: 0 }).setDepth(10);
  }

  progressBar(x, y, w, f, label) {
    const g = this.add.graphics().setDepth(8);
    g.fillStyle(0x2d3a5a).fillRoundedRect(x, y - 16, w, 32, 16);
    g.fillStyle(0xe8eef8).fillRoundedRect(x + 4, y - 12, w - 8, 24, 12);
    g.fillStyle(0xffcf4a).fillRoundedRect(x + 4, y - 12, Math.max(24, (w - 8) * Math.min(1, f)), 24, 12);
    txt(this, x + w / 2, y - 1, label, 20, { color: INK, strokeThickness: 0 }).setDepth(9);
  }

  async choose(id) {
    sfx.click();
    save.update((d) => selectSkin(d, id));
    await ensureSkin(this, id);
    this.scene.restart({ focus: id });
  }

  async buy(id) {
    let ok = false;
    save.update((d) => { ok = buySkin(d, id) && selectSkin(d, id); });
    if (!ok) return;
    sfx.coin();
    if (save.get().settings.vibration) vibrate(30);
    await ensureSkin(this, id);
    this.scene.restart({ focus: id });
  }
}
