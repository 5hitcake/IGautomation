// Erzeugt ein 1080x1920 Reel (MP4) vom Tagesrennen.
// Aufruf: node tools/make_reel.js [seed] [ausgabe.mp4]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const seed = process.argv[2] || new Date().toISOString().slice(0, 10);
const out = process.argv[3] || `reel_${seed}.mp4`;
(async () => {
  const html = path.resolve(__dirname, '..', 'slime_rush_prototyp.html');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 540, height: 960 } });
  p.on('pageerror', e => { console.error(e); process.exit(1); });
  await p.goto(`file://${html}?reel=1&seed=${encodeURIComponent(seed)}`);
  await p.waitForFunction(() => window.reelReady);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
    '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-shortest',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '20', '-c:a', 'aac', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  let n = 0, done = false;
  while (!done && n < 30 * 120) {
    const r = await p.evaluate(() => [window.reelStep(), document.getElementById('c').toDataURL('image/jpeg', 0.92)]);
    done = r[0];
    const buf = Buffer.from(r[1].split(',')[1], 'base64');
    if (!ff.stdin.write(buf)) await new Promise(res => ff.stdin.once('drain', res));
    if (++n % 300 === 0) console.log(`${n / 30}s`);
  }
  const winner = await p.evaluate(() => finishOrder[0].name);
  ff.stdin.end(); await new Promise(res => ff.on('close', res)); await b.close();
  console.log(`fertig: ${out} (${(n / 30).toFixed(1)}s) Sieger: ${winner}`);
})();
