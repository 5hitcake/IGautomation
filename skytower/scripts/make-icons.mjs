// Erzeugt App-Icons und Startbildschirme für Android aus den Wolki-Grafiken.
// Nutzt Playwright zum Rendern: PLAYWRIGHT=/pfad/zu/playwright/index.mjs node scripts/make-icons.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { wolkiSvg } from '../src/art.js';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const RES = 'android/app/src/main/res';
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const SKY = 'linear-gradient(#8fd3ff, #ffd6a5)';
const face = wolkiSvg('happy');

const page = await (await chromium.launch()).newPage();

async function render(file, w, h, html, transparent = false) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:transparent}
    .c{width:100%;height:100%;display:flex;align-items:center;justify-content:center}
    svg{display:block}</style>${html}`);
  await page.screenshot({ path: file, omitBackground: transparent });
}
const wolki = (size) => face.replace('<svg ', `<svg width="${size}" height="${size}" `);

for (const [d, f] of Object.entries(DENSITIES)) {
  const dir = join(RES, `mipmap-${d}`);
  const legacy = Math.round(48 * f);
  await render(join(dir, 'ic_launcher.png'), legacy, legacy,
    `<div class="c" style="background:${SKY};border-radius:${legacy * 0.18}px">${wolki(legacy * 0.84)}</div>`, true);
  await render(join(dir, 'ic_launcher_round.png'), legacy, legacy,
    `<div class="c" style="background:${SKY};border-radius:50%">${wolki(legacy * 0.8)}</div>`, true);
  // Adaptives Icon: Vordergrund 108dp, sichtbarer Bereich ~66dp in der Mitte
  const fg = Math.round(108 * f);
  await render(join(dir, 'ic_launcher_foreground.png'), fg, fg, `<div class="c">${wolki(fg * 0.62)}</div>`, true);
}

// Startbildschirme in den Größen, die das Capacitor-Projekt mitbringt
for (const dir of readdirSync(RES).filter((n) => n.startsWith('drawable'))) {
  const file = join(RES, dir, 'splash.png');
  let buf;
  try { buf = readFileSync(file); } catch { continue; }
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  await render(file, w, h, `<div class="c" style="background:${SKY}">${wolki(Math.min(w, h) * 0.42)}</div>`);
}

console.log('Icons und Startbildschirme erzeugt.');
process.exit(0);
