// Teilen und Bewerten: Spieler erzählen anderen von Wolki und bewerten es im Play Store.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { save } from './storage.js';
import { STORE_URL, REVIEW } from '../config.js';
import { tr, num } from '../i18n.js';

const native = Capacitor.isNativePlatform();
const InAppReview = registerPlugin('InAppReview');

/** Text zum Teilen eines Ergebnisses */
export function shareText({ score, floor, won, heaven }) {
  if (won) return tr(`Ich habe in Wolki: Sky Climber das Himmelstor auf Etage 1000 erreicht! 🌥️🚪 Schaffst du das auch?`,
    `I reached the Heaven Gate on floor 1000 in Wolki: Sky Climber! 🌥️🚪 Can you make it too?`);
  if (heaven) return tr(`Ich bin in Wolki: Sky Climber ${floor - 1000} Etagen ins Himmelreich gehüpft! 🌥️ Schaffst du mehr?`,
    `I hopped ${floor - 1000} floors into Heaven in Wolki: Sky Climber! 🌥️ Can you beat that?`);
  return tr(`Neuer Rekord in Wolki: Sky Climber: Etage ${floor} und ${num(score)} Punkte! 🌥️ Schaffst du mehr?`,
    `New record in Wolki: Sky Climber: floor ${floor} and ${num(score)} points! 🌥️ Can you beat it?`);
}

/**
 * Ergebnis teilen (Android-Teilen-Menü bzw. Teilen-Funktion des Browsers).
 * Ergebnis: 'shared', 'copied' (Text liegt in der Zwischenablage) oder 'failed'.
 */
export async function shareResult(result) {
  const text = shareText(result);
  try {
    if (native) {
      await Share.share({ title: 'Wolki: Sky Climber', text, url: STORE_URL, dialogTitle: tr('Ergebnis teilen', 'Share your result') });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ title: 'Wolki: Sky Climber', text, url: STORE_URL });
      return 'shared';
    }
    await navigator.clipboard.writeText(`${text} ${STORE_URL}`);
    return 'copied';
  } catch (e) {
    // Teilen abgebrochen ist kein Fehler
    return /cancel|abort/i.test(String(e?.message ?? e?.name ?? e)) ? 'shared' : 'failed';
  }
}

/** Soll jetzt um eine Bewertung gebeten werden? (nach einem schönen Moment) */
export function shouldAskForReview(now = Date.now()) {
  const d = save.get();
  return native
    && d.runs >= REVIEW.minRuns
    && (d.reviewAsks ?? 0) < REVIEW.maxAsks
    && now - (d.reviewAskedAt ?? 0) >= REVIEW.gapDays * 86400000;
}

/** Googles Bewertungsfenster öffnen (falls Google es gerade zulässt). */
export async function askForReview() {
  save.update((d) => { d.reviewAsks = (d.reviewAsks ?? 0) + 1; d.reviewAskedAt = Date.now(); });
  try { await InAppReview.requestReview(); } catch { /* kein Play Store o. Ä. */ }
}
