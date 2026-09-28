// Wolki-Texturen je Skin bei Bedarf erzeugen (SVG -> Bild -> Phaser-Textur).
import { ZOOM } from '../view.js';
import { wolkiSvg, SKINS } from '../art.js';

export const PLAYER_SIZE = 104;
export const POSES = ['idle', 'up', 'fall', 'combo', 'happy', 'dead'];

export const skinKey = (skinId, pose) => `wolki_${skinId}_${pose}`;

/** Rastert ein SVG in Welt-Größe w×h mit ZOOM (für scharfe Kanten). */
export function svgToImage(svg, w, h) {
  const sized = svg.replace('<svg ', `<svg width="${Math.round(w * ZOOM)}" height="${Math.round(h * ZOOM)}" `);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`;
  });
}

/** Sorgt dafür, dass die Texturen eines Skins (alle oder einzelne Posen) existieren. */
export async function ensureSkin(scene, skinId, poses = POSES) {
  const skin = SKINS[skinId] ?? SKINS.wolki;
  const missing = poses.filter((p) => !scene.textures.exists(skinKey(skinId, p)));
  const images = await Promise.all(missing.map((p) => svgToImage(wolkiSvg(p, skin), PLAYER_SIZE, PLAYER_SIZE)));
  images.forEach((img, i) => {
    const key = skinKey(skinId, missing[i]);
    if (!scene.textures.exists(key)) scene.textures.addImage(key, img);
  });
}
