// Sprache: Deutsch auf deutschsprachigen Geräten, sonst Englisch.
// Texte stehen direkt im Code als tr('Deutsch', 'English').

function detect() {
  try {
    const list = globalThis.navigator?.languages?.length ? navigator.languages : [globalThis.navigator?.language];
    return String(list[0] ?? 'de').toLowerCase().startsWith('de') ? 'de' : 'en';
  } catch {
    return 'de';
  }
}

export const LANG = detect();

/** Text in der aktuellen Sprache */
export const tr = (de, en) => (LANG === 'de' ? de : en);

/** Zahl mit Tausendertrennzeichen der Sprache (1.000 bzw. 1,000) */
export const num = (n) => Number(n).toLocaleString(LANG === 'de' ? 'de-DE' : 'en-US');
