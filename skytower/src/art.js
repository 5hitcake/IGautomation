// Alle Grafiken des Prototyps, im Code gezeichnet (kostenlos, frei nutzbar).
// Figuren/Objekte sind SVG-Strings, die beim Start in Texturen umgewandelt
// werden; Plattformen und Kulissen zeichnet Phaser direkt als Vektorgrafik.
// Später können hier einfach eigene PNGs an ihre Stelle treten.

export const SKINS = {
  wolki: { body: '#ffffff', shade: '#dce8ff', outline: '#2d3a5a', cheek: '#ff9eb5', shoe: '#5cc3ff', sole: '#ffffff' },
  regen: { body: '#c9d6ea', shade: '#a8b8d4', outline: '#2d3a5a', cheek: '#8fb2ff', shoe: '#ffd23f', sole: '#ffffff' },
  sonne: { body: '#ffe36b', shade: '#ffc53d', outline: '#6b3a12', cheek: '#ff8a5c', shoe: '#ff6b6b', sole: '#ffffff' },
};

const BODY = [
  [60, 66, 30],
  [34, 72, 20],
  [86, 72, 20],
  [44, 48, 19],
  [74, 46, 22],
  [60, 84, 24],
];

const ARMS = {
  idle: [[20, 84, 30], [100, 84, -30]],
  up: [[22, 42, -35], [98, 42, 35]],
  fall: [[18, 60, -65], [102, 60, 65]],
  combo: [[24, 38, -20], [96, 38, 20]],
  dead: [[18, 80, -55], [102, 80, 55]],
};

const FEET = {
  idle: [[47, 106], [73, 106]],
  up: [[48, 104], [72, 104]],
  fall: [[44, 111], [76, 111]],
  combo: [[50, 102], [70, 102]],
  dead: [[44, 108], [76, 108]],
};

function face(pose, s) {
  const o = s.outline;
  const eye = (x) => `<ellipse cx="${x}" cy="64" rx="5.5" ry="7.5" fill="${o}"/><circle cx="${x + 1.8}" cy="61" r="2.2" fill="#fff"/>`;
  const cheeks = `<ellipse cx="38" cy="76" rx="6.5" ry="3.8" fill="${s.cheek}" opacity=".85"/><ellipse cx="82" cy="76" rx="6.5" ry="3.8" fill="${s.cheek}" opacity=".85"/>`;
  switch (pose) {
    case 'up':
      return eye(49) + eye(71) + cheeks +
        `<path d="M51 74 Q60 86 69 74 Z" fill="${o}" stroke="${o}" stroke-width="2" stroke-linejoin="round"/>` +
        `<ellipse cx="60" cy="80.5" rx="4.5" ry="2.6" fill="#ff7a8a"/>`;
    case 'fall':
      return `<circle cx="49" cy="63" r="7.5" fill="#fff" stroke="${o}" stroke-width="3"/><circle cx="49" cy="64" r="3.8" fill="${o}"/>` +
        `<circle cx="71" cy="63" r="7.5" fill="#fff" stroke="${o}" stroke-width="3"/><circle cx="71" cy="64" r="3.8" fill="${o}"/>` +
        cheeks + `<ellipse cx="60" cy="80" rx="4.5" ry="5.5" fill="${o}"/>`;
    case 'combo':
      return `<path d="M42 66 Q49 56 56 66" fill="none" stroke="${o}" stroke-width="4" stroke-linecap="round"/>` +
        `<path d="M64 66 Q71 56 78 66" fill="none" stroke="${o}" stroke-width="4" stroke-linecap="round"/>` +
        cheeks +
        `<path d="M48 73 Q60 92 72 73 Z" fill="${o}" stroke="${o}" stroke-width="2" stroke-linejoin="round"/>` +
        `<ellipse cx="60" cy="82" rx="6" ry="3.2" fill="#ff7a8a"/>`;
    case 'dead':
      return `<path d="M44 58 L54 68 M54 58 L44 68 M66 58 L76 68 M76 58 L66 68" stroke="${o}" stroke-width="4" stroke-linecap="round"/>` +
        `<path d="M50 82 Q55 77 60 82 Q65 87 70 82" fill="none" stroke="${o}" stroke-width="3.5" stroke-linecap="round"/>`;
    default:
      return eye(49) + eye(71) + cheeks +
        `<path d="M53 76 Q60 82 67 76" fill="none" stroke="${o}" stroke-width="3.5" stroke-linecap="round"/>`;
  }
}

/** Wolki in einer Pose (idle, up, fall, combo, dead), 120×120-Viewbox. */
export function wolkiSvg(pose = 'idle', skin = SKINS.wolki) {
  const s = skin;
  const o = s.outline;
  const arms = ARMS[pose].map(([x, y, r]) =>
    `<g transform="rotate(${r} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="11" ry="17" fill="${o}"/><ellipse cx="${x}" cy="${y}" rx="7" ry="13" fill="${s.body}"/></g>`).join('');
  const feet = FEET[pose].map(([x, y]) =>
    `<ellipse cx="${x}" cy="${y}" rx="14" ry="10" fill="${o}"/><ellipse cx="${x}" cy="${y - 1}" rx="10" ry="6.5" fill="${s.shoe}"/>` +
    `<rect x="${x - 10}" y="${y + 2}" width="20" height="3" rx="1.5" fill="${s.sole}"/>`).join('');
  const outline = BODY.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r + 4.5}" fill="${o}"/>`).join('');
  const fill = BODY.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
  const sparkles = pose === 'combo'
    ? `<path d="M12 18 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#ffd23f" stroke="${o}" stroke-width="2"/>` +
      `<path d="M104 12 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#ffd23f" stroke="${o}" stroke-width="2"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<defs><clipPath id="b">${fill}</clipPath></defs>
${arms}${feet}${outline}
<g fill="${s.body}">${fill}</g>
<g clip-path="url(#b)"><ellipse cx="60" cy="104" rx="64" ry="22" fill="${s.shade}"/></g>
<ellipse cx="50" cy="36" rx="12" ry="6" transform="rotate(-20 50 36)" fill="#fff" opacity=".9"/>
${face(pose, s)}${sparkles}
</svg>`;
}

export const COIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
<circle cx="24" cy="24" r="21" fill="#7a4a00"/><circle cx="24" cy="24" r="17.5" fill="#ffd23f"/>
<circle cx="24" cy="24" r="12.5" fill="#ffe680"/>
<path d="M24 14 l3 6.3 6.9 1 -5 4.8 1.2 6.9 -6.1 -3.3 -6.1 3.3 1.2 -6.9 -5 -4.8 6.9 -1z" fill="#f5a300"/>
<ellipse cx="17" cy="14" rx="5" ry="2.5" transform="rotate(-35 17 14)" fill="#fff" opacity=".8"/>
</svg>`;

export const SPARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
<path d="M12 1 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" fill="#fff6c2"/></svg>`;

export const BGCLOUD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 110">
<g fill="#fff"><circle cx="60" cy="70" r="36"/><circle cx="110" cy="50" r="46"/><circle cx="165" cy="66" r="38"/>
<circle cx="200" cy="80" r="26"/><rect x="30" y="70" width="190" height="36" rx="18"/></g></svg>`;

export const BALLOON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 120">
<path d="M40 4 C66 4 76 26 72 44 C68 62 50 74 46 82 L34 82 C30 74 12 62 8 44 C4 26 14 4 40 4Z" fill="#2d3a5a"/>
<path d="M40 9 C62 9 70 27 67 43 C64 58 48 70 44 77 L36 77 C32 70 16 58 13 43 C10 27 18 9 40 9Z" fill="#ff6b6b"/>
<path d="M40 9 C48 20 49 60 44 77 L36 77 C31 60 32 20 40 9Z" fill="#ffd23f"/>
<path d="M35 82 L33 96 M45 82 L47 96" stroke="#2d3a5a" stroke-width="2.5"/>
<rect x="29" y="95" width="22" height="16" rx="3" fill="#2d3a5a"/><rect x="32" y="98" width="16" height="10" rx="2" fill="#b0773b"/>
</svg>`;

export const BIRD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40">
<path d="M4 22 Q16 6 30 20 Q44 6 56 22" fill="none" stroke="#2d3a5a" stroke-width="5" stroke-linecap="round"/></svg>`;

export const PLANET_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 110">
<ellipse cx="80" cy="58" rx="76" ry="18" fill="none" stroke="#2d3a5a" stroke-width="10"/>
<circle cx="80" cy="55" r="38" fill="#2d3a5a"/><circle cx="80" cy="55" r="33" fill="#8f7bff"/>
<circle cx="68" cy="45" r="7" fill="#a998ff"/><circle cx="92" cy="66" r="5" fill="#7462e0"/>
<path d="M8 58 Q80 90 152 58" fill="none" stroke="#2d3a5a" stroke-width="10"/>
<path d="M8 58 Q80 90 152 58" fill="none" stroke="#ffd23f" stroke-width="5"/>
</svg>`;

// ---------------------------------------------------------------------------
// Plattformen (Phaser Graphics, lokale Koordinaten: links oben = 0,0)

const hex = (s) => parseInt(s.slice(1), 16);

const STYLE = {
  roof: { fill: '#e0674a', light: '#f59275', dark: '#b94a33', outline: '#4a2320' },
  cloud: { fill: '#ffffff', light: '#ffffff', dark: '#d6e4ff', outline: '#2d3a5a' },
  rainbow: { fill: '#ff6b6b', light: '#ffffff', dark: '#b84a8a', outline: '#4a2350' },
  storm: { fill: '#8a93ad', light: '#a9b1c8', dark: '#687190', outline: '#232a40' },
  ice: { fill: '#bdf1ff', light: '#ffffff', dark: '#7fd0ea', outline: '#1f4a66' },
  asteroid: { fill: '#9a8574', light: '#b39f8e', dark: '#6f5e50', outline: '#2a2020' },
  stardust: { fill: '#b57bff', light: '#e3c9ff', dark: '#7d4ad6', outline: '#2a1450' },
  rain: { fill: '#aab6cc', light: '#c6d0e0', dark: '#8390aa', outline: '#2d3a5a' },
  milestone: { fill: '#ffcf4a', light: '#fff0a8', dark: '#e0a020', outline: '#5a3a00' },
};

export const PLATFORM_H = 40;
// Rand um die Plattform für Wolken-Buckel, Eiszapfen, Tropfen und Flügel
export const PLATFORM_PAD = { x: 36, top: 18, bottom: 36 };

function puffy(g, c, w, h) {
  const step = 40;
  const n = Math.max(2, Math.round(w / step));
  const bumps = [];
  for (let i = 0; i < n; i++) bumps.push([(w / n) * (i + 0.5), 10, 17]);
  g.fillStyle(hex(c.outline));
  g.fillRoundedRect(-5, 5, w + 10, h + 2, (h + 2) / 2);
  bumps.forEach(([x, y, r]) => g.fillCircle(x, y, r + 5));
  g.fillStyle(hex(c.fill));
  g.fillRoundedRect(0, 10, w, h - 8, (h - 8) / 2);
  bumps.forEach(([x, y, r]) => g.fillCircle(x, y, r));
  g.fillStyle(hex(c.dark));
  g.fillRoundedRect(6, h - 8, w - 12, 8, 4);
}

export function drawPlatform(g, style, w, opts = {}) {
  const c = STYLE[style] ?? STYLE.cloud;
  const h = PLATFORM_H;
  g.clear();
  if (style === 'cloud' || style === 'storm' || style === 'rain') {
    puffy(g, c, w, h);
    if (style === 'rain') {
      g.fillStyle(0x5cb8ff);
      for (let x = 20; x < w - 10; x += 34) g.fillEllipse(x, h + 16 + ((x / 34) % 2) * 6, 7, 11);
    }
    if (style === 'storm') {
      g.fillStyle(0xffd23f);
      g.fillTriangle(w / 2 - 4, h + 2, w / 2 + 10, h + 2, w / 2 - 6, h + 22);
    }
  } else if (style === 'rainbow') {
    const bands = ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7'];
    g.fillStyle(hex(c.outline)).fillRoundedRect(-5, -5, w + 10, h + 10, (h + 10) / 2);
    bands.forEach((col, i) => {
      g.fillStyle(hex(col)).fillRoundedRect(0, i * (h / 5), w, h / 5 + 1, Math.min(h / 2, 8));
    });
  } else {
    const r = style === 'roof' || style === 'milestone' ? 12 : h / 2;
    g.fillStyle(hex(c.outline)).fillRoundedRect(-5, -5, w + 10, h + 10, r + 5);
    g.fillStyle(hex(c.fill)).fillRoundedRect(0, 0, w, h, r);
    g.fillStyle(hex(c.dark)).fillRoundedRect(4, h - 12, w - 8, 10, 5);
    g.fillStyle(hex(c.light), 0.9).fillRoundedRect(10, 5, w - 20, 8, 4);
    if (style === 'roof') {
      g.fillStyle(hex(c.dark));
      for (let x = 16; x < w - 10; x += 26) g.fillCircle(x, h - 14, 6);
    } else if (style === 'ice') {
      g.fillStyle(hex(c.fill));
      for (let x = 18; x < w - 12; x += 30) {
        g.fillStyle(hex(c.outline)).fillTriangle(x - 8, h, x + 8, h, x, h + 20);
        g.fillStyle(hex(c.light)).fillTriangle(x - 4, h, x + 4, h, x, h + 12);
      }
    } else if (style === 'asteroid') {
      g.fillStyle(hex(c.dark));
      for (let x = 24; x < w - 16; x += 46) g.fillCircle(x, 20, 7);
    } else if (style === 'stardust') {
      g.fillStyle(0xffffff);
      for (let x = 18; x < w - 10; x += 28) g.fillCircle(x, 20 + ((x / 28) % 2) * 6, 2.5);
    }
  }
  if (opts.moving) {
    // kleine Flügel an beiden Enden
    g.fillStyle(hex(c.outline));
    g.fillEllipse(-14, 8, 34, 20);
    g.fillEllipse(w + 14, 8, 34, 20);
    g.fillStyle(0xffffff);
    g.fillEllipse(-14, 8, 26, 13);
    g.fillEllipse(w + 14, 8, 26, 13);
  }
}

/**
 * Plattform einmalig als Textur vorberechnen (statt jedes Frame als Vektor
 * neu zu zeichnen) und wiederverwenden. Gibt den Texturnamen zurück; das Bild
 * wird mit Ursprung (0,0) bei (x - PAD.x, top - PAD.top) und Scale 1/zoom gesetzt.
 */
export function platformTexture(scene, style, w, moving, zoom) {
  const key = `plat_${style}_${moving ? 'm' : 's'}_${w}`;
  if (scene.textures.exists(key)) return key;
  const P = PLATFORM_PAD;
  const g = scene.make.graphics({}, false);
  drawPlatform(g, style, w, { moving });
  g.setScale(zoom).setPosition(P.x * zoom, P.top * zoom);
  const tw = Math.ceil((w + 2 * P.x) * zoom);
  const th = Math.ceil((PLATFORM_H + P.top + P.bottom) * zoom);
  const tex = scene.textures.addDynamicTexture(key, tw, th);
  tex.draw(g);
  g.destroy();
  return key;
}
