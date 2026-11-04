// Baut eine HTML-Datei für die Web-Vorschau. Aufruf:
//   node klapperkiste/build-artifact.mjs <ziel.html> [quelle.html] [--auslagern]
// Quelle ist standardmäßig das Spiel (index.html), z. B. auch
// design/gestaltungsbuch.html.
// Ohne --auslagern sind alle Skripte eingebettet (eine einzige Datei). Mit --auslagern
// bleiben große Skripte (über 1 MB, die Bilddaten) eigene Dateien neben <ziel.html>, weil
// jede Datei der Vorschau höchstens 16 MB groß sein darf. Die Liste der ausgelagerten
// Dateien steht am Ende der Ausgabe (für das Veröffentlichen mit mehreren Dateien).
import { copyFileSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const auslagern = process.argv.includes("--auslagern");
const ziel = args[0] || join(root, "dist.html");
const source = join(root, args[1] || "index.html");
const GROSS = 1_000_000;
const ausgelagert = [];
let html = readFileSync(source, "utf8");
html = html.replace(/<script src="([^"]+)"><\/script>/g, (tag, src) => {
  const pfad = join(dirname(source), src);
  if (auslagern && statSync(pfad).size > GROSS && !src.includes("/")) {
    copyFileSync(pfad, join(dirname(ziel), src));
    ausgelagert.push(src);
    return tag;
  }
  return `<script>\n${readFileSync(pfad, "utf8")}</script>`;
});
// Eigene Stylesheets ebenfalls einbetten (Google Fonts bleiben Links)
html = html.replace(/<link rel="stylesheet" href="(?!https?:)([^"]+)">/g, (_, href) =>
  `<style>\n${readFileSync(join(dirname(source), href), "utf8")}</style>`);
// Die Vorschau-Umgebung liefert Doctype, head und body selbst
html = html
  .replace(/<!doctype html>\s*/i, "")
  .replace(/<\/?html[^>]*>\s*/g, "")
  .replace(/<\/?head>\s*/g, "")
  .replace(/<\/?body>\s*/g, "")
  .replace(/<meta charset="utf-8">\s*/, "")
  .replace(/<meta name="viewport"[^>]*>\s*/, "");
writeFileSync(ziel, html);
for (const f of ausgelagert) console.log(`ausgelagert: ${f} (${Math.round(statSync(join(dirname(ziel), f)).size / 1e5) / 10} MB)`);
console.log(`${ziel}: ${Math.round(statSync(ziel).size / 1e5) / 10} MB`);
