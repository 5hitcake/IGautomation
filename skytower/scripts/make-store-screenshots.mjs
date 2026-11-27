// Store-Screenshots mit großer Überschrift (Deutsch + Englisch), 1080 × 1920.
// Aufruf: node scripts/make-store-screenshots.mjs   (braucht Playwright + Chromium)
// Quelle: store/screenshot-<sprache>-<n>.png, Ergebnis: store/screenshot-<sprache>-text-<n>.png
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

// Reihenfolge = Reihenfolge im Store (die ersten zählen am meisten)
const SHOTS = [
  { src: 2, de: 'Bau riesige Combos!', en: 'Build huge combos!' },
  { src: 3, de: '10 Himmelszonen –\nbis ins Weltall!', en: '10 sky zones –\nall the way to space!' },
  { src: 5, de: 'Schaffst du\nEtage 1000?', en: 'Can you reach\nfloor 1000?' },
  { src: 4, de: '16 Skins –\nmanche sind geheim!', en: '16 skins –\nsome are secret!' },
  { src: 1, de: 'Hüpf mit Wolki\nin den Himmel!', en: 'Jump with Wolki\ninto the sky!' },
];

const font = readFileSync('node_modules/@fontsource/baloo-2/files/baloo-2-latin-800-normal.woff2').toString('base64');
const png = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;

function page(caption, img) {
  return `<!doctype html><html><head><style>
  @font-face { font-family: B; src: url(data:font/woff2;base64,${font}); }
  html, body { margin: 0; width: 1080px; height: 1920px; overflow: hidden; }
  body { background: linear-gradient(#5fb4ec, #a8dcff 55%, #fff1d6); font-family: B; position: relative; }
  h1 { position: absolute; top: 70px; left: 0; right: 0; margin: 0; text-align: center; white-space: pre-line;
       font-size: 104px; line-height: 1.04; color: #fff; letter-spacing: 1px;
       -webkit-text-stroke: 14px #2d3a5a; paint-order: stroke fill; }
  .phone { position: absolute; left: 50%; bottom: -60px; transform: translateX(-50%);
           width: 800px; height: 1422px; border-radius: 64px; border: 14px solid #2d3a5a;
           overflow: hidden; box-shadow: 0 24px 60px rgba(30,50,90,.35); background: #2d3a5a; }
  .phone img { width: 100%; height: 100%; object-fit: cover; display: block; }
  </style></head><body><h1>${caption}</h1><div class="phone"><img src="${img}"></div></body></html>`;
}

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const p = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
for (const lang of ['de', 'en']) {
  for (const [i, s] of SHOTS.entries()) {
    await p.setContent(page(s[lang], png(`store/screenshot-${lang}-${s.src}.png`)));
    await p.evaluate(() => document.fonts.ready);
    const out = `store/screenshot-${lang}-text-${i + 1}.png`;
    await p.screenshot({ path: out });
    console.log(out);
  }
}
await browser.close();
