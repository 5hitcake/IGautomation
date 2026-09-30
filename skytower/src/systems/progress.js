// Skins und ihre Freischaltung, ohne Phaser-Abhängigkeit (testbar).
//
// Jeder Skin ist entweder von Anfang an da, für Münzen kaufbar, durch einen
// Erfolg freischaltbar oder Premium (In-App-Kauf ab Phase 6). Die Goldene
// Wolke gibt es auch über 1.000.000 gesammelte Punkte. `trail` = Schweif hinter
// Wolki (siehe src/systems/trail.js).

// Preise nach gemessenen Münzen pro Runde (Test-Bot, v0.7): bis Etage ~200
// etwa 40–80 Münzen, bei Etage 400–500 etwa 130–290. Der erste Skin ist so
// nach wenigen Runden drin, der Regenbogenschweif ist ein längeres Ziel.
export const SKIN_LIST = [
  { id: 'wolki', name: 'Wolki' },
  { id: 'regen', name: 'Regenwolke', price: 300 },
  { id: 'sonne', name: 'Sonnenschein', price: 750 },
  { id: 'pip', name: 'Vogel Pip', price: 1500 },
  { id: 'rainbow', name: 'Regenbogenschweif', short: 'Regenbogen', price: 3000, trail: 'rainbow' },
  { id: 'ballon', name: 'Heißluftballon', goal: { type: 'bestFloor', value: 200 } },
  { id: 'blitz', name: 'Blitz', goal: { type: 'bestCombo', value: 50 } },
  { id: 'astro', name: 'Astronaut', goal: { type: 'bestFloor', value: 500 } },
  { id: 'mond', name: 'Mond', goal: { type: 'runs', value: 100 }, trail: 'stars' },
  { id: 'einhorn', name: 'Regenbogen-Einhorn', short: 'Einhorn', premium: true },
  { id: 'drache', name: 'Mini-Drache', premium: true },
  { id: 'gold', name: 'Goldene Wolke', premium: true, goal: { type: 'totalScore', value: 1_000_000 } },
  // Geheime Skins: im Shop unsichtbar, bis man sie erspielt hat
  { id: 'alien', name: 'Alien-Wolki', short: 'Alien', secret: true, goal: { type: 'bestFloor', value: 800 } },
  { id: 'roboter', name: 'Roboter-Wolki', short: 'Roboter', secret: true, goal: { type: 'bestCombo', value: 100 } },
  { id: 'sterne', name: 'Sternen-Wolki', short: 'Sterne', secret: true, trail: 'stars', goal: { type: 'perfectCount', value: 1 } },
  // Der ultimative Skin: geheim, nur am Himmelstor (Etage 1000) freischaltbar
  { id: 'engel', name: 'Engel-Wolki', short: 'Engel', secret: true, trail: 'angel', goal: { type: 'gateCount', value: 1 } },
];

export const GOAL_TEXT = {
  bestFloor: (v) => `Etage ${v.toLocaleString('de-DE')} erreichen`,
  bestCombo: (v) => `${v}er-Combo schaffen`,
  runs: (v) => `${v} Runden spielen`,
  totalScore: (v) => `${v.toLocaleString('de-DE')} Punkte sammeln`,
  gateCount: () => 'Das Himmelstor erreichen',
  perfectCount: () => 'Das Himmelstor ohne Regenschirm erreichen',
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
