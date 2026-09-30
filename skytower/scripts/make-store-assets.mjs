// Erzeugt Store-Grafiken für Google Play: Icon (512×512) und Titelbild (1024×500).
// PLAYWRIGHT=/pfad/zu/playwright/index.mjs node scripts/make-store-assets.mjs
import { readFileSync, mkdirSync } from 'node:fs';
import { wolkiSvg, SKINS } from '../src/art.js';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const OUT = 'store';
mkdirSync(OUT, { recursive: true });
const font = readFileSync('node_modules/@fontsource/baloo-2/files/baloo-2-latin-800-normal.woff2').toString('base64');
const css = `@font-face{font-family:'Baloo 2';font-weight:800;src:url(data:font/woff2;base64,${font}) format('woff2')}
  html,body{margin:0;overflow:hidden}svg{display:block}`;
const svg = (pose, skin, size) => wolkiSvg(pose, SKINS[skin]).replace('<svg ', `<svg width="${size}" height="${size}" `);
const cloud = (x, y, s, o = 1) => `<div style="position:absolute;left:${x}px;top:${y}px;width:${240 * s}px;height:${110 * s}px;opacity:${o}">
  <svg viewBox="0 0 240 110" width="100%" height="100%"><g fill="#fff"><circle cx="60" cy="70" r="36"/><circle cx="110" cy="50" r="46"/>
  <circle cx="165" cy="66" r="38"/><circle cx="200" cy="80" r="26"/><rect x="30" y="70" width="190" height="36" rx="18"/></g></svg></div>`;

const page = await (await chromium.launch()).newPage();
async function render(file, w, h, html) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<style>${css}</style>${html}`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file });
}

// App-Icon für den Store: vollflächig (Google rundet selbst ab)
await render(`${OUT}/icon-512.png`, 512, 512, `<div style="width:512px;height:512px;background:linear-gradient(#8fd3ff,#ffd6a5);
  display:flex;align-items:center;justify-content:center">${svg('happy', 'wolki', 430)}</div>`);

// Titelbild 1024×500: Himmel, Wolken, Wolki mit Freunden, Schriftzug
const title = `font-family:'Baloo 2';font-weight:800;color:#fff;-webkit-text-stroke:0;text-shadow:
  0 6px 0 #2d3a5a, 4px 0 0 #2d3a5a, -4px 0 0 #2d3a5a, 0 -4px 0 #2d3a5a, 3px 3px 0 #2d3a5a, -3px 3px 0 #2d3a5a, 3px -3px 0 #2d3a5a, -3px -3px 0 #2d3a5a`;
await render(`${OUT}/feature-graphic-1024x500.png`, 1024, 500, `<div style="position:relative;width:1024px;height:500px;
  background:linear-gradient(160deg,#7ec8f2 0%,#bfe6ff 45%,#ffd6a5 100%);overflow:hidden">
  ${cloud(-40, 330, 1.4)}${cloud(700, 360, 1.6)}${cloud(380, 400, 1.2, 0.9)}${cloud(820, 40, 0.8, 0.8)}${cloud(40, 30, 0.6, 0.7)}
  <div style="position:absolute;left:60px;top:95px;${title};font-size:64px;color:#ffe066;line-height:1">Wolki</div>
  <div style="position:absolute;left:52px;top:150px;${title};font-size:108px;line-height:1">Sky Climber</div>
  <div style="position:absolute;left:655px;top:55px;transform:rotate(-8deg)">${svg('happy', 'wolki', 230)}</div>
  <div style="position:absolute;left:860px;top:230px;transform:rotate(10deg)">${svg('combo', 'sterne', 140)}</div>
  <div style="position:absolute;left:480px;top:290px;transform:rotate(-6deg)">${svg('up', 'alien', 125)}</div>
  <div style="position:absolute;left:895px;top:25px">${svg('happy', 'engel', 105)}</div>
</div>`);
console.log('fertig:', OUT);
process.exit(0);
