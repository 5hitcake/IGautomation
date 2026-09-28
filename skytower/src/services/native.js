// Anbindung an die Android-App (Capacitor). Im Browser passiert hier nichts.
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/** Zurück-Taste: im Spiel pausieren, in der Pause weiterspielen, im Shop zum Menü, sonst App schließen. */
export function setupNative(game) {
  if (!Capacitor.isNativePlatform()) return;
  App.addListener('backButton', () => {
    const sm = game.scene;
    if (sm.isActive('Pause')) {
      sm.getScene('Pause').resumeGame();
    } else if (sm.isActive('Game') && sm.getScene('Game').state === 'play') {
      sm.getScene('Game').pauseGame();
    } else if (sm.isActive('Game') && ['cutscene', 'won'].includes(sm.getScene('Game').state) && !sm.isActive('GameOver')) {
      // Himmelstor-Szene läuft: nicht abbrechen, sonst gehen die Münzen verloren
    } else if (sm.isActive('GameOver') || sm.isActive('Game')) {
      sm.stop('GameOver');
      sm.stop('Game');
      sm.start('Menu');
    } else if (sm.isActive('Shop')) {
      sm.stop('Shop');
      sm.start('Menu');
    } else {
      App.exitApp();
    }
  });
}
