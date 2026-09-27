import { WORLD_W } from './config.js';

// Die Spielwelt ist immer 720 Einheiten breit, die Höhe richtet sich nach dem
// Seitenverhältnis des Handys. Damit alles auf hochauflösenden Displays
// scharf bleibt, läuft die Canvas in echter Pixelauflösung und jede Kamera
// zoomt um ZOOM (siehe setupCamera).

const innerW = window.innerWidth || 390;
const innerH = window.innerHeight || 844;

export const W = WORLD_W;
export const VIEW_H = Math.round(Math.min(1700, Math.max(1100, (W * innerH) / innerW)));

const cssW = Math.min(innerW, (innerH * W) / VIEW_H);
const dpr = window.devicePixelRatio || 1;
export const ZOOM = Math.min(2.5, Math.max(1, (cssW * dpr) / W));

export function setupCamera(scene) {
  scene.cameras.main.setOrigin(0, 0).setZoom(ZOOM);
  return scene.cameras.main;
}

export const FONT = '"Baloo 2", "Arial Rounded MT Bold", system-ui, sans-serif';

/** Text mit dickem Cartoon-Rand, scharf gerendert. */
export function txt(scene, x, y, str, size = 40, opts = {}) {
  const t = scene.add.text(x, y, str, {
    fontFamily: FONT,
    fontStyle: opts.weight ?? '800',
    fontSize: `${size}px`,
    color: opts.color ?? '#ffffff',
    stroke: opts.stroke ?? '#2d3a5a',
    strokeThickness: opts.strokeThickness ?? Math.max(4, Math.round(size / 5)),
    align: opts.align ?? 'center',
    resolution: ZOOM,
    wordWrap: opts.wrap ? { width: opts.wrap } : undefined,
  });
  t.setOrigin(opts.ox ?? 0.5, opts.oy ?? 0.5).setDepth(10);
  return t;
}

/** Runder Cartoon-Button; gibt den Container zurück. */
export function button(scene, x, y, label, onTap, opts = {}) {
  const w = opts.w ?? 380;
  const h = opts.h ?? 104;
  const fill = opts.fill ?? 0xffcf4a;
  const g = scene.add.graphics();
  const draw = (pressed) => {
    g.clear();
    g.fillStyle(0x2d3a5a, 1).fillRoundedRect(-w / 2, -h / 2 + 8, w, h, h / 2);
    g.fillStyle(0x2d3a5a, 1).fillRoundedRect(-w / 2 - 5, -h / 2 - 5 + (pressed ? 6 : 0), w + 10, h + 10, h / 2 + 5);
    g.fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2 + (pressed ? 6 : 0), w, h, h / 2);
    g.fillStyle(0xffffff, 0.35).fillRoundedRect(-w / 2 + 18, -h / 2 + 10 + (pressed ? 6 : 0), w - 36, h * 0.28, h * 0.14);
  };
  draw(false);
  const t = txt(scene, 0, -2, label, opts.size ?? 44, { strokeThickness: 7 });
  const c = scene.add.container(x, y, [g, t]);
  c.setSize(w, h).setDepth(10).setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => { draw(true); t.y = 4; });
  c.on('pointerout', () => { draw(false); t.y = -2; });
  c.on('pointerup', () => { draw(false); t.y = -2; onTap(); });
  return c;
}
