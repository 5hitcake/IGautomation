// Bildschirm während des Spielens wach halten.
// App: eigenes Android-Modul (KeepAwakePlugin.java, FLAG_KEEP_SCREEN_ON).
// Browser: Screen-Wake-Lock-Schnittstelle, falls vorhanden.
import { Capacitor, registerPlugin } from '@capacitor/core';

const Native = Capacitor.isNativePlatform() ? registerPlugin('KeepAwake') : null;
let want = false;
let lock = null;

async function webLock(on) {
  try {
    if (on && !lock && navigator.wakeLock) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } else if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch { /* nicht unterstützt oder abgelehnt – dann eben nicht */ }
}

/** true = Bildschirm anlassen, false = darf wieder ausgehen */
export function keepAwake(on) {
  if (on === want) return;
  want = on;
  if (Native) (on ? Native.keepOn() : Native.allowSleep()).catch(() => {});
  else webLock(on);
}

// Der Browser gibt den Wake-Lock beim Verlassen der Seite frei – beim Zurückkommen erneuern
document.addEventListener('visibilitychange', () => {
  if (!Native && want && !document.hidden) webLock(true);
});
