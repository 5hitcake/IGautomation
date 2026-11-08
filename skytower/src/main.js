import Phaser from 'phaser';
import '@fontsource/baloo-2/latin-800.css';
import { W, VIEW_H, ZOOM } from './view.js';
import { BootScene } from './scenes/Boot.js';
import { MenuScene } from './scenes/Menu.js';
import { GameScene } from './scenes/Game.js';
import { PauseScene, GameOverScene } from './scenes/Overlays.js';
import { ShopScene } from './scenes/Shop.js';
import { setupNative } from './services/native.js';
import { initAds } from './services/ads.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: Math.round(W * ZOOM),
  height: Math.round(VIEW_H * ZOOM),
  backgroundColor: '#7ec8f2',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 },
  // Phasers Glättung kappt die Frame-Zeit auf 16,7 ms, sobald ein Frame länger
  // dauert – auf langsamen Geräten lief das Spiel dadurch in Zeitlupe.
  // Wir nehmen die echte Zeit (Game.js begrenzt sie selbst auf 0,1 s).
  fps: { smoothStep: false },
  scene: [BootScene, MenuScene, GameScene, GameOverScene, PauseScene, ShopScene],
});

setupNative(game);
// Die randlosen Ränder meldet Android erst nach dem Start: dann neu einpassen
if (window.ResizeObserver) new ResizeObserver(() => game.scale.refresh()).observe(document.getElementById('game'));
initAds();

// Für automatisierte Tests im Browser
window.__skytower = game;
