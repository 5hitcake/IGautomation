import Phaser from 'phaser';
import { PHYSICS, TOWER, CAMERA, COMBO, ZONES, zoneIndexForFloor } from '../config.js';
import { W, VIEW_H, ZOOM, setupCamera, txt } from '../view.js';
import { platformTexture, PLATFORM_H, PLATFORM_PAD } from '../art.js';
import { Sky } from '../systems/sky.js';
import { ComboTracker } from '../systems/combo.js';
import { save } from '../services/storage.js';
import { sfx, vibrate } from '../services/audio.js';
import { music } from '../services/music.js';
import { skinKey } from '../systems/skinTextures.js';

const R = PHYSICS.playerRadius;
const FH = TOWER.floorHeight;
const WALL = TOWER.wallWidth;
const HUD_Y = 74;
const PAD = PLATFORM_PAD;
const STEP = 1 / 120; // Physik-Schritt in Sekunden
const WIDTH_STEP = 16; // Plattformbreiten in 16er-Schritten (weniger Texturen)
const PREPARE_FLOORS = 30; // so viele Etagen vor einer neuen Zone Grafiken vorbereiten
const PAUSE_BTN = { x: 58, y: HUD_Y, r: 40 };

const TUTORIAL = [
  'Halte links oder rechts gedrückt,\num zu laufen',
  'Mehr Anlauf = höhere Sprünge!',
  'Überspringe 2+ Etagen\nfür Combos!',
];

export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.cam = setupCamera(this);
    this.state = 'play';
    this.skin = save.get().selectedSkin;
    this.time0 = 0;

    // Spieler (Mittelpunkt px/py, Füße bei py + R)
    this.px = W / 2;
    this.py = -R;
    this.vx = 0;
    this.vy = 0;
    this.squash = 0;
    this.happyUntil = 0; // bis dahin zeigt Wolki das ^^-Gesicht
    this.acc = 0;
    this.texQueue = [];
    this.warmedZones = new Set();
    this.spin = { angle: 0 };
    this.lastWallBounce = -1;

    this.scrollY = -(VIEW_H - 260);
    this.cam.scrollY = this.scrollY;
    this.camStarted = false;
    this.camLevel = 0;
    this.levelTimer = 0;
    this.coinsRun = 0;
    this.zoneShown = 0;

    this.sky = new Sky(this, { city: true, scrollY: this.scrollY });
    this.drawWalls();

    this.platforms = [];
    this.nextFloor = 0;
    this.generate();
    this.prepareZone(0);

    this.player = this.add.image(this.px, this.py, skinKey(this.skin, 'up')).setOrigin(0.5, 0.55).setScale(1 / ZOOM).setDepth(7);
    this.sparks = this.add.particles(0, 0, 'spark', {
      speed: { min: 180, max: 520 },
      lifespan: 650,
      scale: { start: 1.1 / ZOOM, end: 0 },
      rotate: { min: 0, max: 360 },
      gravityY: 600,
      emitting: false,
    }).setDepth(8);

    this.combo = new ComboTracker((r) => this.onComboEnd(r));
    this.createHud();
    this.createInput();

    if (!save.get().tutorialSeen) this.showTutorial();
    music.start('game', 0);

    this.game.events.on('hidden', this.autoPause, this);
    this.events.once('shutdown', () => this.game.events.off('hidden', this.autoPause, this));
  }

  // --------------------------------------------------------------------------
  // Aufbau

  drawWalls() {
    const g = this.add.graphics().setScrollFactor(0).setDepth(9);
    for (const x of [0, W - WALL]) {
      g.fillStyle(0xffffff, 0.28).fillRect(x, 0, WALL, VIEW_H);
      g.fillStyle(0x2d3a5a, 0.35).fillRect(x === 0 ? WALL - 4 : x, 0, 4, VIEW_H);
    }
  }

  createHud() {
    const d = 20;
    this.hud = {};
    const pg = this.add.graphics().setScrollFactor(0).setDepth(d);
    pg.fillStyle(0x2d3a5a).fillCircle(PAUSE_BTN.x, PAUSE_BTN.y, PAUSE_BTN.r);
    pg.fillStyle(0xffffff).fillCircle(PAUSE_BTN.x, PAUSE_BTN.y, PAUSE_BTN.r - 6);
    pg.fillStyle(0x2d3a5a).fillRoundedRect(PAUSE_BTN.x - 14, PAUSE_BTN.y - 15, 9, 30, 3);
    pg.fillStyle(0x2d3a5a).fillRoundedRect(PAUSE_BTN.x + 5, PAUSE_BTN.y - 15, 9, 30, 3);

    const hudText = (x, y, s, size, o) => txt(this, x, y, s, size, o).setScrollFactor(0).setDepth(d);
    this.hud.floor = hudText(118, HUD_Y, 'Etage 0', 44, { ox: 0 });
    this.hud.score = hudText(W - 44, HUD_Y, '0', 48, { ox: 1 });
    this.add.image(W - 58, HUD_Y + 58, 'coin').setScrollFactor(0).setDepth(d).setScale(0.8 / ZOOM);
    this.hud.coins = hudText(W - 88, HUD_Y + 58, '0', 34, { ox: 1, color: '#ffe680' });

    this.hud.combo = hudText(W / 2, HUD_Y + 118, '', 46, { color: '#ffe066' }).setVisible(false);
    this.hud.bar = this.add.graphics().setScrollFactor(0).setDepth(d);
    this.hud.center = hudText(W / 2, VIEW_H * 0.36, '', 76, { strokeThickness: 12 }).setAlpha(0);
    this.hud.sub = hudText(W / 2, VIEW_H * 0.36 + 76, '', 38, { color: '#fff6c2' }).setAlpha(0);
  }

  createInput() {
    this.input.addPointer(2);
    this.keys = this.input.keyboard?.addKeys('LEFT,RIGHT,A,D,P,ESC');
    this.input.on('pointerdown', (p) => {
      if (this.state === 'play' && this.onPauseButton(p)) this.pauseGame();
    });
    this.input.keyboard?.on('keydown-P', () => this.pauseGame());
    this.input.keyboard?.on('keydown-ESC', () => this.pauseGame());
  }

  onPauseButton(p) {
    const dx = p.downX / ZOOM - PAUSE_BTN.x;
    const dy = p.downY / ZOOM - PAUSE_BTN.y;
    return dx * dx + dy * dy < (PAUSE_BTN.r + 20) ** 2;
  }

  readInput() {
    let left = false;
    let right = false;
    for (const p of this.input.manager.pointers) {
      if (!p.isDown || this.onPauseButton(p)) continue;
      if (p.x < this.scale.width / 2) left = true;
      else right = true;
    }
    const k = this.keys;
    if (k) {
      if (k.LEFT.isDown || k.A.isDown) left = true;
      if (k.RIGHT.isDown || k.D.isDown) right = true;
    }
    return (right ? 1 : 0) - (left ? 1 : 0);
  }

  // --------------------------------------------------------------------------
  // Turm

  spawnPlatform(floor) {
    const inner = W - 2 * WALL;
    const zone = ZONES[zoneIndexForFloor(floor)];
    let style = zone.platform;
    let type = 'normal';
    let x = WALL;
    let w = inner;

    if (floor === 0) {
      style = 'roof';
    } else if (floor % TOWER.milestoneEvery === 0) {
      style = 'milestone';
    } else {
      const f = Math.min(1, floor / TOWER.shrinkUntilFloor);
      w = TOWER.startWidth * (1 - f * (1 - TOWER.minWidthFactor)) * (0.85 + Math.random() * 0.3);
      w = Math.round(w / WIDTH_STEP) * WIDTH_STEP; // Breiten bündeln, damit Texturen wiederverwendet werden
      x = WALL + Math.random() * (inner - w);
      if (floor >= TOWER.crumbleFromFloor && Math.random() < TOWER.crumbleChance) {
        type = 'crumble';
        style = 'rain';
      } else if (floor >= TOWER.movingFromFloor && Math.random() < TOWER.movingChance) {
        type = 'moving';
      }
    }

    const top = -floor * FH;
    const key = platformTexture(this, style, w, type === 'moving', ZOOM);
    const img = this.add.image(x - PAD.x, top - PAD.top, key).setOrigin(0).setScale(1 / ZOOM).setDepth(5);
    const p = { floor, x, w, top, type, img, gone: false, crumbleT: -1, vx: 0 };
    if (type === 'moving') p.vx = (Math.random() < 0.5 ? -1 : 1) * TOWER.movingSpeed * (0.8 + Math.random() * 0.4);
    if (style === 'milestone') {
      p.label = txt(this, x + w / 2, top + PLATFORM_H / 2, `${floor}`, 34, { color: '#5a3a00', stroke: '#fff0a8', strokeThickness: 6 }).setDepth(6);
    }
    if (floor > 0 && style !== 'milestone' && Math.random() < TOWER.coinChance) {
      p.coin = this.add.image(x + w / 2, top - 58, 'coin').setScale(1 / ZOOM).setDepth(6);
      p.coinBaseY = top - 58;
    }
    this.platforms.push(p);
  }

  generate() {
    const topFloor = Math.ceil(-(this.scrollY - 400) / FH);
    while (this.nextFloor <= topFloor) this.spawnPlatform(this.nextFloor++);

    const bottomY = this.scrollY + VIEW_H + 240;
    this.platforms = this.platforms.filter((p) => {
      if (p.top <= bottomY) return true;
      p.img.destroy();
      p.label?.destroy();
      p.coin?.destroy();
      return false;
    });
  }

  updatePlatforms(dt) {
    for (const p of this.platforms) {
      if (p.type === 'moving' && !p.gone) {
        p.x += p.vx * dt;
        if (p.x < WALL) { p.x = WALL; p.vx *= -1; }
        if (p.x + p.w > W - WALL) { p.x = W - WALL - p.w; p.vx *= -1; }
        p.img.x = p.x - PAD.x;
        if (p.coin) p.coin.x = p.x + p.w / 2;
      }
      if (p.crumbleT >= 0 && !p.gone) {
        p.crumbleT += dt;
        p.img.x = p.x - PAD.x + Math.sin(p.crumbleT * 70) * 3;
        if (p.crumbleT >= TOWER.crumbleDelay) {
          p.gone = true;
          this.tweens.add({ targets: p.img, alpha: 0, y: p.top - PAD.top + 80, duration: 350, ease: 'Quad.in' });
        }
      }
      if (p.coin) {
        p.coin.y = p.coinBaseY + Math.sin(this.time0 * 4 + p.floor) * 6;
        const dx = p.coin.x - this.px;
        const dy = p.coin.y - this.py;
        if (dx * dx + dy * dy < (R + 26) ** 2) this.collectCoin(p);
      }
    }
  }

  collectCoin(p) {
    const c = p.coin;
    p.coin = null;
    this.coinsRun += 1;
    this.hud.coins.setText(`${this.coinsRun}`);
    sfx.coin();
    this.tweens.add({ targets: c, y: c.y - 60, alpha: 0, scale: 1.6 / ZOOM, duration: 260, onComplete: () => c.destroy() });
  }

  // --------------------------------------------------------------------------
  // Spielschleife

  update(_t, deltaMs) {
    // Physik in festen Schritten: bei kurzen Rucklern holt das Spiel die Zeit
    // nach, statt in Zeitlupe zu laufen (max. 0,1 s pro Frame).
    const frame = Math.min(deltaMs / 1000, 0.1);
    this.acc += frame;
    while (this.acc >= STEP) {
      this.tick(STEP);
      this.acc -= STEP;
    }

    this.warmNextTexture();
    this.cam.scrollY = this.scrollY;
    this.sky.update(this.scrollY, Math.max(0, -(this.scrollY + VIEW_H / 2) / FH));
    this.renderPlayer(frame);
    this.renderHud();
  }

  tick(dt) {
    this.time0 += dt;
    if (this.state !== 'play') return;
    this.updatePlayer(dt);
    this.combo.update(dt);
    this.updateCamera(dt);
    this.updatePlatforms(dt);
    this.generate();
    if (this.py - R > this.scrollY + VIEW_H + 40) this.gameOver();
  }

  // --------------------------------------------------------------------------
  // Plattform-Grafiken vorab erzeugen und alte Zonen freigeben

  /** Alle Texturen, die Plattformen einer Zone brauchen können. */
  zoneTextures(zi) {
    const z = ZONES[zi];
    const to = (ZONES[zi + 1]?.from ?? z.from + 500) - 1;
    const widthAt = (floor) => TOWER.startWidth * (1 - Math.min(1, floor / TOWER.shrinkUntilFloor) * (1 - TOWER.minWidthFactor));
    const lo = Math.round((widthAt(to) * 0.85) / WIDTH_STEP) * WIDTH_STEP;
    const hi = Math.round((widthAt(z.from) * 1.15) / WIDTH_STEP) * WIDTH_STEP;
    const list = [];
    for (let w = lo; w <= hi; w += WIDTH_STEP) {
      list.push([z.platform, w, false]);
      if (to >= TOWER.movingFromFloor) list.push([z.platform, w, true]);
      if (to >= TOWER.crumbleFromFloor) list.push(['rain', w, false]);
    }
    return list;
  }

  warmNextTexture() {
    const job = this.texQueue.shift();
    if (job) platformTexture(this, job[0], job[1], job[2], ZOOM);
  }

  prepareZone(zi) {
    if (zi >= ZONES.length || this.warmedZones.has(zi)) return;
    this.warmedZones.add(zi);
    this.texQueue.push(...this.zoneTextures(zi));
  }

  releaseZone(zi) {
    if (zi < 0) return;
    const prefix = `plat_${ZONES[zi].platform}_`;
    for (const key of this.textures.getTextureKeys()) {
      if (key.startsWith(prefix)) this.textures.remove(key);
    }
  }

  updatePlayer(dt) {
    const P = PHYSICS;
    const dir = this.readInput();
    if (dir !== 0) {
      const turning = this.vx !== 0 && Math.sign(this.vx) !== dir;
      this.vx += dir * (turning ? P.turnAccel : P.accel) * dt;
    } else {
      const d = P.friction * dt;
      this.vx = Math.abs(this.vx) <= d ? 0 : this.vx - Math.sign(this.vx) * d;
    }
    this.vx = Phaser.Math.Clamp(this.vx, -P.maxRunSpeed, P.maxRunSpeed);

    this.px += this.vx * dt;
    const minX = WALL + R;
    const maxX = W - WALL - R;
    if (this.px < minX) { this.px = minX; this.hitWall(1); }
    else if (this.px > maxX) { this.px = maxX; this.hitWall(-1); }

    const prevFeet = this.py + R;
    this.vy = Math.min(this.vy + P.gravity * dt, 2400);
    this.py += this.vy * dt;
    const feet = this.py + R;

    if (this.vy > 0) {
      let hit = null;
      for (const p of this.platforms) {
        if (p.gone || p.top < prevFeet - 1 || p.top > feet) continue;
        if (this.px + R * 0.6 < p.x || this.px - R * 0.6 > p.x + p.w) continue;
        if (!hit || p.top < hit.top) hit = p;
      }
      if (hit) this.land(hit);
    }
  }

  hitWall(side) {
    const P = PHYSICS;
    if (Math.abs(this.vx) >= P.wallBounceMinSpeed && this.time0 - this.lastWallBounce > 0.15) {
      this.vx = side * Math.abs(this.vx) * P.wallBounceKeep;
      this.vy -= P.wallBounceBoost;
      this.lastWallBounce = this.time0;
      this.squash = -0.15;
      sfx.wall();
      this.sparks.explode(6, this.px - side * R, this.py);
    } else {
      this.vx = 0;
    }
  }

  land(p) {
    const P = PHYSICS;
    this.py = p.top - R;
    const speed = Math.abs(this.vx);
    const power = speed / P.maxRunSpeed;
    this.vy = -(P.jumpBase + P.jumpSpeedFactor * speed);
    this.squash = 0.22;
    sfx.jump(power);

    const before = this.combo.maxFloor;
    this.combo.land(p.floor);
    if (this.combo.active) {
      sfx.comboStep(this.combo.jumps);
      if (power > 0.55 && this.spin.angle === 0) {
        this.tweens.add({
          targets: this.spin, angle: 360 * (this.vx >= 0 ? 1 : -1), duration: 620, ease: 'Sine.inOut',
          onComplete: () => { this.spin.angle = 0; },
        });
      }
    }
    if (p.type === 'crumble' && p.crumbleT < 0) p.crumbleT = 0;
    if (this.combo.maxFloor > before) this.onNewFloor(this.combo.maxFloor);
  }

  onNewFloor(floor) {
    if (!this.camStarted && floor >= CAMERA.startFloor) this.camStarted = true;
    const zi = zoneIndexForFloor(floor);
    const next = ZONES[zi + 1];
    if (next && floor >= next.from - PREPARE_FLOORS) this.prepareZone(zi + 1);
    if (zi > this.zoneShown) {
      this.zoneShown = zi;
      this.releaseZone(zi - 2);
      this.popup(ZONES[zi].name, `Etage ${ZONES[zi].from}`, '#bfe6ff');
      sfx.zone();
      this.celebrate();
    }
  }

  updateCamera(dt) {
    if (!this.camStarted && this.time0 >= CAMERA.startAfter) this.camStarted = true;
    if (this.camStarted) {
      this.levelTimer += dt;
      if (this.levelTimer >= CAMERA.levelEvery && this.camLevel < CAMERA.maxLevel) {
        this.levelTimer = 0;
        this.camLevel += 1;
        music.setLevel(this.camLevel);
        this.popup('Schneller!', null, '#ff8a5c');
        sfx.hurry();
      }
      this.scrollY -= (CAMERA.baseSpeed + this.camLevel * CAMERA.speedPerLevel) * dt;
    }
    const followY = this.py - VIEW_H * CAMERA.followZone;
    if (followY < this.scrollY) this.scrollY += (followY - this.scrollY) * Math.min(1, dt * 8);
  }

  onComboEnd(r) {
    if (!r.counted) return;
    sfx.comboEnd(r.floors);
    if (r.callout) {
      this.popup(r.callout, `${r.floors} Etagen · +${r.points.toLocaleString('de-DE')}`, '#ffe066');
      this.sparks.explode(Math.min(40, 10 + r.floors), this.px, this.py);
      if (save.get().settings.vibration) vibrate(r.floors >= 25 ? 60 : 25);
    }
    if (r.floors >= COMBO.celebrateFrom) this.celebrate();
  }

  celebrate() {
    this.happyUntil = this.time0 + COMBO.celebrateTime;
  }

  popup(text, sub, color) {
    const { center, sub: subT } = this.hud;
    this.tweens.killTweensOf([center, subT]);
    center.setText(text).setColor(color).setAlpha(1).setScale(0.3).setY(VIEW_H * 0.36);
    subT.setText(sub ?? '').setAlpha(sub ? 1 : 0).setY(VIEW_H * 0.36 + 76);
    this.tweens.add({ targets: center, scale: 1, duration: 260, ease: 'Back.out' });
    this.tweens.add({ targets: [center, subT], alpha: 0, y: '-=50', delay: 1000, duration: 450 });
  }

  showTutorial() {
    const t = txt(this, W / 2, VIEW_H - 190, '', 40, { strokeThickness: 8 }).setScrollFactor(0).setDepth(20).setAlpha(0);
    this.tweens.chain({
      targets: t,
      tweens: TUTORIAL.flatMap((line) => [
        { alpha: 1, duration: 300, onStart: () => t.setText(line) },
        { alpha: 0, duration: 300, delay: 2800 },
      ]),
      onComplete: () => t.destroy(),
    });
  }

  // --------------------------------------------------------------------------
  // Darstellung

  renderPlayer(dt) {
    let pose = 'up';
    if (this.state === 'dead') pose = 'dead';
    else if (this.time0 < this.happyUntil) pose = 'happy';
    else if (this.vy > 150) pose = 'fall';
    else if (this.combo.active) pose = 'combo';
    const key = skinKey(this.skin, pose);
    if (this.player.texture.key !== key) this.player.setTexture(key);

    this.squash *= Math.exp(-12 * dt);
    const s = 1 / ZOOM;
    this.player.setScale(s * (1 + this.squash), s * (1 - this.squash));
    this.player.setPosition(this.px, this.py - 7);
    const tilt = (this.vx / PHYSICS.maxRunSpeed) * 0.18;
    this.player.setRotation(Phaser.Math.DegToRad(this.spin.angle) + tilt);
  }

  renderHud() {
    const c = this.combo;
    this.hud.floor.setText(`Etage ${c.maxFloor}`);
    this.hud.score.setText(c.score.toLocaleString('de-DE'));
    const bar = this.hud.bar;
    bar.clear();
    if (c.active) {
      this.hud.combo.setVisible(true).setText(`Combo ${c.floors}`);
      const bw = 300;
      const bx = W / 2 - bw / 2;
      const by = HUD_Y + 156;
      bar.fillStyle(0x2d3a5a).fillRoundedRect(bx - 5, by - 5, bw + 10, 26, 13);
      bar.fillStyle(0xffffff, 0.5).fillRoundedRect(bx, by, bw, 16, 8);
      const f = Math.max(0, c.timeLeft / COMBO.timer);
      bar.fillStyle(f > 0.35 ? 0xffd23f : 0xff6b6b).fillRoundedRect(bx, by, Math.max(16, bw * f), 16, 8);
    } else {
      this.hud.combo.setVisible(false);
    }
  }

  // --------------------------------------------------------------------------
  // Pause & Ende

  autoPause() {
    if (this.state === 'play') this.pauseGame();
  }

  pauseGame() {
    if (this.state !== 'play' || this.scene.isPaused()) return;
    this.scene.pause();
    music.stop();
    this.scene.launch('Pause');
  }

  gameOver() {
    this.state = 'dead';
    this.combo.end();
    music.stop();
    sfx.gameOver();
    if (save.get().settings.vibration) vibrate(180);

    const result = {
      score: this.combo.score,
      floor: this.combo.maxFloor,
      combo: this.combo.bestCombo,
      coins: this.coinsRun,
    };
    const isNew = save.recordRun(result);
    if (!save.get().tutorialSeen) save.update((d) => { d.tutorialSeen = true; });

    // Wolki hüpft noch einmal traurig ins Bild und fällt dann heraus
    this.py = this.scrollY + VIEW_H - 40;
    this.tweens.add({
      targets: this, py: this.scrollY + VIEW_H - 260, duration: 380, ease: 'Quad.out', yoyo: true,
      onComplete: () => this.scene.launch('GameOver', { ...result, isNew }),
    });
  }
}
