// Rendert stories.html zu ../../assets/jotalabs_stories/story_XX.jpg (JPEG, weil die Instagram-API nur JPEG annimmt) (1080x1920).
// Aufruf aus diesem Ordner: node render_stories.mjs  (Playwright + Chromium noetig)
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', '..', 'assets', 'jotalabs_stories');
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
await p.goto('file://' + path.join(here, 'stories.html'), { waitUntil: 'networkidle' });
await p.evaluate(() => document.fonts.ready);
const n = await p.locator('section.s').count();
for (let i = 1; i <= n; i++) {
  await p.locator('#s' + i).screenshot({ path: path.join(out, `story_${String(i).padStart(2, '0')}.jpg`), type: 'jpeg', quality: 90 });
}
await b.close();
console.log(`${n} Stories gerendert nach ${out}`);
