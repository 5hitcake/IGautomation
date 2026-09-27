// Macht aus dist-single/index.html eine Datei ohne <html>/<head>/<body>-Hülle,
// wie sie die Handy-Testseite (Claude-Artifact) erwartet.
import { readFileSync, writeFileSync } from 'node:fs';

const [, , out = 'dist-single/preview.html'] = process.argv;
const html = readFileSync('dist-single/index.html', 'utf8');
const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const styles = [...html.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]).join('\n');
const scripts = [...html.matchAll(/<script[\s\S]*?<\/script>/g)].map((m) => m[0]).join('\n');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '').trim();
writeFileSync(out, `${title}\n${styles}\n${body}\n${scripts}\n`);
console.log(`geschrieben: ${out}`);
