import Phaser from 'phaser';
import { ZOOM } from '../view.js';
import {
  wolkiSvg, COIN_SVG, SPARK_SVG, BGCLOUD_SVG, BALLOON_SVG, BIRD_SVG, PLANET_SVG,
} from '../art.js';

export const PLAYER_SIZE = 104;
const POSES = ['idle', 'up', 'fall', 'combo', 'dead'];

// Größe jeweils in Welt-Einheiten; gerastert wird mit ZOOM für scharfe Kanten.
// Im Spiel werden die Bilder deshalb mit setScale(1 / ZOOM) dargestellt.
const TEXTURES = [
  ...POSES.map((p) => ({ key: `wolki_${p}`, svg: wolkiSvg(p), w: PLAYER_SIZE, h: PLAYER_SIZE })),
  { key: 'coin', svg: COIN_SVG, w: 44, h: 44 },
  { key: 'spark', svg: SPARK_SVG, w: 24, h: 24 },
  { key: 'bgcloud', svg: BGCLOUD_SVG, w: 240, h: 110 },
  { key: 'balloon', svg: BALLOON_SVG, w: 80, h: 120 },
  { key: 'bird', svg: BIRD_SVG, w: 60, h: 40 },
  { key: 'planet', svg: PLANET_SVG, w: 160, h: 110 },
];

function svgToImage(svg, w, h) {
  const sized = svg.replace('<svg ', `<svg width="${Math.round(w * ZOOM)}" height="${Math.round(h * ZOOM)}" `);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
  });
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  async create() {
    const fontReady = document.fonts?.load('800 40px "Baloo 2"').catch(() => null);
    const images = await Promise.all(TEXTURES.map((t) => svgToImage(t.svg, t.w, t.h)));
    images.forEach((img, i) => this.textures.addImage(TEXTURES[i].key, img));
    await fontReady;
    this.scene.start('Menu');
  }
}
