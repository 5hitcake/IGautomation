// All player-visible text lives in strings.de.js / strings.en.js (same keys
// in both). This file only picks which one to load: an explicit saved
// choice wins, otherwise the browser's own language, defaulting to German.
import { STR as STR_DE } from "./strings.de.js";
import { STR as STR_EN } from "./strings.en.js";

export const LANG_KEY = "kritzeldrache_lang";
function detectLang(){
  try{
    const saved = localStorage.getItem(LANG_KEY);
    if(saved === "de" || saved === "en") return saved;
  }catch{}
  return (navigator.language || "de").toLowerCase().startsWith("de") ? "de" : "en";
}
export const LANG = detectLang();
export const STR = LANG === "en" ? STR_EN : STR_DE;
// Changing the language touches nearly every piece of UI text, most of which
// is written into the DOM once at startup rather than reactively - a full
// reload after saving the new choice is simpler and safer than trying to
// re-render every label in place.
export function setLang(l){
  try{ localStorage.setItem(LANG_KEY, l); }catch{}
  location.reload();
}
