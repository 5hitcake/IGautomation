// Spielstand lokal speichern. Im Prototyp über localStorage; in der Android-
// App später über Capacitor Preferences (gleiche Schnittstelle).

const KEY = 'skytower.save.v1';

const DEFAULTS = {
  highscore: 0,
  bestFloor: 0,
  bestCombo: 0,
  coins: 0,
  runs: 0,
  settings: { sound: true, vibration: true },
  tutorialSeen: false,
};

let data = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed, settings: { ...DEFAULTS.settings, ...parsed.settings } };
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
  /** Rundenergebnis eintragen; gibt zurück, welche Rekorde neu sind. */
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
    persist();
    return isNew;
  },
};
