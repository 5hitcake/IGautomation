// Erzeugt das komplette Reel (1080x1920, ~2 min, mit Musik + Soundeffekten).
// Aufruf: node tools/make_reel2.js [seed] [ausgabe.mp4]
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const seed = process.argv[2] || new Date().toISOString().slice(0, 10);
const out = path.resolve(process.argv[3] || `reel_${seed}.mp4`);
const tmp = fs.mkdtempSync(path.join(root, 'tmp_reel_'));
(async () => {
  execFileSync(path.join(__dirname, 'build_reel_html.sh'));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 540, height: 960 } });
  p.on('pageerror', e => { console.error(e); process.exit(1); });
  await p.goto(`file://${root}/slime_rush_reel.html?seed=${encodeURIComponent(seed)}`);
  await p.waitForFunction(() => window.reelReady);
  const vid = path.join(tmp, 'video.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '19', vid], { stdio: ['pipe', 'inherit', 'inherit'] });
  let n = 0, done = false;
  while (!done && n < 30 * 240) {
    const r = await p.evaluate(() => [window.reelStep(), document.getElementById('c').toDataURL('image/jpeg', 0.92)]);
    done = r[0];
    if (!ff.stdin.write(Buffer.from(r[1].split(',')[1], 'base64'))) await new Promise(res => ff.stdin.once('drain', res));
    if (++n % 900 === 0) console.log(`${n / 30}s gerendert`);
  }
  const info = await p.evaluate(() => ({ events: EVENTS, games: REEL_INFO.games, rank: podiumRank.map(r => r.name) }));
  ff.stdin.end(); await new Promise(res => ff.on('close', res)); await b.close();
  const evf = path.join(tmp, 'events.json'), wav = path.join(tmp, 'audio.wav');
  fs.writeFileSync(evf, JSON.stringify(info.events));
  execFileSync('python3', [path.join(__dirname, 'mix_audio.py'), evf, String(n / 30), path.join(root, 'audio', 'musik_rennen.wav'), wav], { stdio: 'inherit' });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', vid, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out]);
  fs.rmSync(tmp, { recursive: true });
  fs.writeFileSync(out.replace(/\.mp4$/, '.json'), JSON.stringify({ seed, games: info.games, podium: info.rank, seconds: n / 30 }, null, 2));
  console.log(`fertig: ${out} (${(n / 30).toFixed(1)} s) Spiele: ${info.games.join(', ')} | Podest: ${info.rank.join(' > ')}`);
})();
