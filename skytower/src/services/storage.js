// Spielstand lokal speichern. Im Prototyp über localStorage; in der Android-
// App später über Capacitor Preferences (gleiche Schnittstelle).
import { unlockGoals } from '../systems/progress.js';

const KEY = 'skytower.save.v1';

const DEFAULTS = {
  highscore: 0,
  bestFloor: 0,
  bestCombo: 0,
  coins: 0,
  runs: 0,
  totalScore: 0,
  ownedSkins: [],
  selectedSkin: 'wolki',
  settings: { sound: true, vibration: true },
  tutorialSeen: false,
};

let data = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const base = structuredClone(DEFAULTS); // eigene Kopie, z. B. von ownedSkins
      const d = { ...base, ...parsed, settings: { ...base.settings, ...parsed.settings } };
      // v0.4 -> v0.5: Papierflieger wurde durch Regenbogenschweif ersetzt
      d.ownedSkins = d.ownedSkins.map((id) => (id === 'papier' ? 'rainbow' : id));
      if (d.selectedSkin === 'papier') d.selectedSkin = 'rainbow';
      return d;
    }
  } catch { /* privater Modus o. Ä. */ }
  return structuredClone(DEFAULTS);
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignorieren */ }
}

export const save = {
  get: () => data,
  update(fn) {
    fn(data);
    persist();
  },
  /** Rundenergebnis eintragen; gibt neue Rekorde und neu freigeschaltete Skins zurück. */
  recordRun({ score, floor, combo, coins }) {
    const isNew = {
      score: score > data.highscore,
      floor: floor > data.bestFloor,
      combo: combo > data.bestCombo,
    };
    data.highscore = Math.max(data.highscore, score);
    data.bestFloor = Math.max(data.bestFloor, floor);
    data.bestCombo = Math.max(data.bestCombo, combo);
    data.coins += coins;
    data.runs += 1;
    data.totalScore += score;
    isNew.unlocked = unlockGoals(data).map((s) => s.name);
    persist();
    return isNew;
  },
};
