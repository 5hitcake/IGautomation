// Skins und ihre Freischaltung, ohne Phaser-Abhängigkeit (testbar).
//
// Jeder Skin ist entweder von Anfang an da, für Münzen kaufbar oder durch einen
// Erfolg freischaltbar; `secret` = im Shop unsichtbar bis zur Freischaltung.
// `iap` = später zusätzlich per In-App-Kauf (Phase 6); `premium` (nur per Kauf)
// wird derzeit nicht verwendet. `trail` = Schweif hinter Wolki (src/systems/trail.js).

// Preise nach gemessenen Münzen pro Runde (Test-Bot, v0.7): bis Etage ~200
// etwa 40–80 Münzen, bei Etage 400–500 etwa 130–290. Der erste Skin ist so
// nach wenigen Runden drin, der Regenbogenschweif ist ein längeres Ziel.
import { tr, num } from '../i18n.js';

export const SKIN_LIST = [
  { id: 'wolki', name: 'Wolki' },
  { id: 'regen', name: tr('Regenwolke', 'Rain Cloud'), price: 300 },
  { id: 'sonne', name: tr('Sonnenschein', 'Sunshine'), price: 750 },
  { id: 'pip', name: tr('Vogel Pip', 'Pip the Bird'), price: 1500 },
  { id: 'rainbow', name: tr('Regenbogenschweif', 'Rainbow Trail'), short: tr('Regenbogen', 'Rainbow'), price: 3000, trail: 'rainbow' },
  { id: 'ballon', name: tr('Heißluftballon', 'Hot-Air Balloon'), goal: { type: 'bestFloor', value: 200 } },
  { id: 'blitz', name: tr('Blitz', 'Lightning'), goal: { type: 'bestCombo', value: 50 } },
  { id: 'astro', name: tr('Astronaut', 'Astronaut'), goal: { type: 'bestFloor', value: 500 } },
  { id: 'mond', name: tr('Mond', 'Moon'), goal: { type: 'runs', value: 100 }, trail: 'stars' },
  // iap: später zusätzlich per In-App-Kauf erhältlich (Phase 6); bis dahin über Erfolge
  { id: 'einhorn', name: tr('Regenbogen-Einhorn', 'Rainbow Unicorn'), short: tr('Einhorn', 'Unicorn'), iap: true, goal: { type: 'bestFloor', value: 700 } },
  { id: 'drache', name: tr('Mini-Drache', 'Mini Dragon'), iap: true, goal: { type: 'bestCombo', value: 75 } },
  { id: 'gold', name: tr('Goldene Wolke', 'Golden Cloud'), iap: true, goal: { type: 'totalScore', value: 1_000_000 } },
  // Geheime Skins: im Shop unsichtbar, bis man sie erspielt hat
  { id: 'alien', name: tr('Alien-Wolki', 'Alien Wolki'), short: 'Alien', secret: true, goal: { type: 'bestFloor', value: 800 } },
  { id: 'roboter', name: tr('Roboter-Wolki', 'Robot Wolki'), short: tr('Roboter', 'Robot'), secret: true, goal: { type: 'bestCombo', value: 100 } },
  { id: 'sterne', name: tr('Stern-Wolki', 'Star Wolki'), short: tr('Stern', 'Star'), secret: true, trail: 'stardust', goal: { type: 'perfectCount', value: 1 } },
  // Der ultimative Skin: geheim, nur am Himmelstor (Etage 1000) freischaltbar
  { id: 'engel', name: tr('Engel-Wolki', 'Angel Wolki'), short: tr('Engel', 'Angel'), secret: true, trail: 'angel', goal: { type: 'gateCount', value: 1 } },
];

export const GOAL_TEXT = {
  bestFloor: (v) => tr(`Etage ${num(v)} erreichen`, `Reach floor ${num(v)}`),
  bestCombo: (v) => tr(`${v}er-Combo schaffen`, `Land a ${v}-floor combo`),
  runs: (v) => tr(`${v} Runden spielen`, `Play ${v} rounds`),
  totalScore: (v) => tr(`${num(v)} Punkte sammeln`, `Collect ${num(v)} points`),
  gateCount: () => tr('Das Himmelstor erreichen', 'Reach the Heaven Gate'),
  perfectCount: () => tr('Das Himmelstor ohne Regenschirm erreichen', 'Reach the Heaven Gate without an umbrella'),
};

export const skinById = (id) => SKIN_LIST.find((s) => s.id === id) ?? SKIN_LIST[0];

export function isOwned(data, id) {
  return id === 'wolki' || data.ownedSkins.includes(id);
}

/** Fortschritt eines Erfolgs-Skins: { current, target, done } oder null */
export function goalProgress(data, skin) {
  if (!skin.goal) return null;
  const current = data[skin.goal.type] ?? 0;
  return { current, target: skin.goal.value, done: current >= skin.goal.value };
}

/** Status für die Anzeige im Shop */
export function skinState(data, skin) {
  if (isOwned(data, skin.id)) return data.selectedSkin === skin.id ? 'selected' : 'owned';
  if (skin.secret) return 'secret';
  if (skin.price) return data.coins >= skin.price ? 'buyable' : 'tooExpensive';
  if (skin.premium) return 'premium'; // ggf. zusätzlich per Erfolg freischaltbar
  return 'goal';
}

/** Kauft einen Skin für Münzen. Gibt true zurück, wenn es geklappt hat. */
export function buySkin(data, id) {
  const skin = skinById(id);
  if (isOwned(data, id) || !skin.price || data.coins < skin.price) return false;
  data.coins -= skin.price;
  data.ownedSkins.push(id);
  return true;
}

export function selectSkin(data, id) {
  if (!isOwned(data, id)) return false;
  data.selectedSkin = id;
  return true;
}

/** Schaltet alle erreichten Erfolgs-Skins frei; gibt die neu freigeschalteten zurück. */
export function unlockGoals(data) {
  const fresh = [];
  for (const skin of SKIN_LIST) {
    if (isOwned(data, skin.id)) continue;
    if (goalProgress(data, skin)?.done) {
      data.ownedSkins.push(skin.id);
      fresh.push(skin);
    }
  }
  return fresh;
}
