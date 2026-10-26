// Baut eine einzelne HTML-Datei (alle Skripte eingebettet) für die
// Web-Vorschau. Aufruf:
//   node klapperkiste/build-artifact.mjs <ziel.html> [quelle.html]
// Quelle ist standardmäßig das Spiel (index.html), z. B. auch
// design/gestaltungsbuch.html.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const source = join(root, process.argv[3] || "index.html");
let html = readFileSync(source, "utf8");
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) =>
  `<script>\n${readFileSync(join(dirname(source), src), "utf8")}</script>`);
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
writeFileSync(process.argv[2] || join(root, "dist.html"), html);
