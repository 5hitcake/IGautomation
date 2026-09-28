import Phaser from 'phaser';
import {
  COIN_SVG, SPARK_SVG, BGCLOUD_SVG, BALLOON_SVG, BIRD_SVG, PLANET_SVG,
  COIN_SILVER_SVG, COIN_GOLD_SVG, DIAMOND_SVG, ROCKET_SVG, UMBRELLA_SVG, MAGNET_SVG, WARP_SVG,
  NEBULA_SVG, GATE_SVG,
} from '../art.js';
import { ensureSkin, svgToImage } from '../systems/skinTextures.js';
import { save } from '../services/storage.js';

// Größe jeweils in Welt-Einheiten; gerastert wird mit ZOOM für scharfe Kanten.
// Im Spiel werden die Bilder deshalb mit setScale(1 / ZOOM) dargestellt.
const TEXTURES = [
  { key: 'coin', svg: COIN_SVG, w: 44, h: 44 },
  { key: 'spark', svg: SPARK_SVG, w: 24, h: 24 },
  { key: 'bgcloud', svg: BGCLOUD_SVG, w: 240, h: 110 },
  { key: 'balloon', svg: BALLOON_SVG, w: 80, h: 120 },
  { key: 'bird', svg: BIRD_SVG, w: 60, h: 40 },
  { key: 'planet', svg: PLANET_SVG, w: 160, h: 110 },
  { key: 'coin_silver', svg: COIN_SILVER_SVG, w: 46, h: 46 },
  { key: 'coin_gold', svg: COIN_GOLD_SVG, w: 54, h: 54 },
  { key: 'diamond', svg: DIAMOND_SVG, w: 50, h: 50 },
  { key: 'pu_rocket', svg: ROCKET_SVG, w: 64, h: 64 },
  { key: 'pu_shield', svg: UMBRELLA_SVG, w: 64, h: 64 },
  { key: 'pu_magnet', svg: MAGNET_SVG, w: 60, h: 60 },
  { key: 'pu_warp', svg: WARP_SVG, w: 64, h: 64 },
  { key: 'nebula_0', svg: NEBULA_SVG('#ff7ad9', '#8e5cff'), w: 300, h: 220 },
  { key: 'nebula_1', svg: NEBULA_SVG('#6fe3ff', '#3f5bff'), w: 300, h: 220 },
  { key: 'nebula_2', svg: NEBULA_SVG('#ffd27a', '#ff5c8a'), w: 300, h: 220 },
  { key: 'gate', svg: GATE_SVG, w: 620, h: 407 },
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  async create() {
    const fontReady = document.fonts?.load('800 40px "Baloo 2"').catch(() => null);
    const images = await Promise.all(TEXTURES.map((t) => svgToImage(t.svg, t.w, t.h)));
    images.forEach((img, i) => this.textures.addImage(TEXTURES[i].key, img));
    await ensureSkin(this, save.get().selectedSkin);
    await fontReady;
    this.scene.start('Menu');
  }
}
