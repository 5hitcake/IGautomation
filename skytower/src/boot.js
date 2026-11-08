// Start: auf Android erst kurz warten, bis Capacitor die Größe von Statusleiste und
// Kamera-Aussparung meldet (--safe-area-inset-*), sonst stimmt das Seitenverhältnis
// des Spielbereichs nicht. Im Browser geht es sofort los.
import { Capacitor } from '@capacitor/core';

function insetsKnown() {
  return getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top').trim() !== '';
}

async function waitForInsets(maxMs = 600) {
  if (!Capacitor.isNativePlatform()) return;
  const t0 = performance.now();
  while (!insetsKnown() && performance.now() - t0 < maxMs) {
    await new Promise((r) => setTimeout(r, 30));
  }
}

waitForInsets().then(() => import('./main.js'));
