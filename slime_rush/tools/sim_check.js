// Aufruf: node tools/sim_check.js <seed> [sek1,sek2,...]
// schneller Test: alle Frames simulieren (ohne Video), Screenshots an Stichproben
const { chromium } = require('playwright');
const path = require('path'), root = path.resolve(__dirname, '..');
require('child_process').execFileSync(path.join(__dirname, 'build_reel_html.sh'));
(async () => {
  const seed = process.argv[2], shots = (process.argv[3] || '').split(',').filter(Boolean).map(Number);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 540, height: 960 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + root + '/slime_rush_reel.html?seed=' + seed);
  await p.waitForFunction(() => window.reelReady);
  const info = await p.evaluate(() => REEL_INFO);
  let f = 0, done = false; const sceneAt = [];
  while (!done && f < 30 * 300) {
    const r = await p.evaluate(n => { let d = false; for (let i = 0; i < n && !d; i++) d = reelStep(); return [d, sceneIdx]; }, 30);
    f += 30; done = r[0]; sceneAt.push(r[1]);
    if (shots.includes(f / 30)) await p.locator('canvas').screenshot({ path: `chk_${seed}_${f / 30}.jpg`, type: 'jpeg', quality: 70 });
    if (errs.length) break;
  }
  const changes = []; sceneAt.forEach((s, i) => { if (i === 0 || s !== sceneAt[i - 1]) changes.push(`${i}s:scene${s}`); });
  console.log(seed, info.games.join(','), 'dauer', f / 30, 's', changes.join(' '), 'errors', errs, 'sieger', await p.evaluate(() => podiumRank && podiumRank.map(r => r.name).join(' > ')));
  await b.close();
})();
