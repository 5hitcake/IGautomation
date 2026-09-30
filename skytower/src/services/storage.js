// Spielstand lokal speichern. Im Prototyp über localStorage; in der Android-
// App später über Capacitor Preferences (gleiche Schnittstelle).
import { unlockGoals, SKIN_LIST } from '../systems/progress.js';
import { TEST_TOOLS, TEST_COINS } from '../config.js';

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
  umbrellas: 0, // Regenschirme im Vorrat
  gateCount: 0, // wie oft das Himmelstor erreicht wurde
  perfectCount: 0, // wie oft das Tor ohne Rettung erreicht wurde
  settings: { sound: true, vibration: true },
  tutorialSeen: false,
};

let data = load();

// Test-Versionen: einmalig Start-Münzen gutschreiben (nicht im Store-Build)
if (TEST_TOOLS && !data.testCoinsGranted) {
  data.coins += TEST_COINS;
  data.testCoinsGranted = true;
  persist();
}

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
  /** Test-Werkzeug: Münzen gutschreiben */
  addTestCoins() {
    data.coins += TEST_COINS;
    persist();
  },
  /** Test-Werkzeug: alle Skins freischalten */
  unlockAllSkins() {
    // inklusive der geheimen Skins (nur Test-Versionen, im Store-Build gibt es das nicht)
    data.ownedSkins = SKIN_LIST.filter((s) => s.id !== 'wolki').map((s) => s.id);
    persist();
  },
  /** Regenschirm gutschreiben (z. B. nach Werbung); gibt false zurück, wenn der Vorrat voll ist. */
  addUmbrella(max) {
    if ((data.umbrellas ?? 0) >= max) return false;
    data.umbrellas = (data.umbrellas ?? 0) + 1;
    persist();
    return true;
  },
  /** Rundenergebnis eintragen; gibt neue Rekorde und neu freigeschaltete Skins zurück. */
  /**
   * Runde speichern. Nach „Weiterspielen per Werbung“ wird dieselbe Runde ein
   * zweites Mal gespeichert: dann nur die neu dazugekommenen Münzen/Punkte
   * (coins, scoreDelta) und keine weitere gezählte Runde (continued).
   */
  recordRun({ score, floor, combo, coins, scoreDelta = score, continued = false }) {
    const isNew = {
      score: score > data.highscore,
      floor: floor > data.bestFloor,
      combo: combo > data.bestCombo,
    };
    data.highscore = Math.max(data.highscore, score);
    data.bestFloor = Math.max(data.bestFloor, floor);
    data.bestCombo = Math.max(data.bestCombo, combo);
    data.coins += coins;
    if (!continued) data.runs += 1;
    data.totalScore += scoreDelta;
    isNew.unlocked = unlockGoals(data).map((s) => s.name);
    persist();
    return isNew;
  },
};
