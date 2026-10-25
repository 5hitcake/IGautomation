// Baut eine einzelne HTML-Datei (alle Skripte eingebettet) für die
// Web-Vorschau. Aufruf: node klapperkiste/build-artifact.mjs <ziel.html>
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
let html = readFileSync(join(root, "index.html"), "utf8");
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) =>
  `<script>\n${readFileSync(join(root, src), "utf8")}</script>`);
// Die Vorschau-Umgebung liefert Doctype, head und body selbst
html = html
  .replace(/<!doctype html>\s*/i, "")
  .replace(/<\/?html[^>]*>\s*/g, "")
  .replace(/<\/?head>\s*/g, "")
  .replace(/<\/?body>\s*/g, "")
  .replace(/<meta charset="utf-8">\s*/, "")
  .replace(/<meta name="viewport"[^>]*>\s*/, "");
writeFileSync(process.argv[2] || join(root, "dist.html"), html);
