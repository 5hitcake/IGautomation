import Phaser from 'phaser';
import '@fontsource/baloo-2/latin-800.css';
import { W, VIEW_H, ZOOM } from './view.js';
import { BootScene } from './scenes/Boot.js';
import { MenuScene } from './scenes/Menu.js';
import { GameScene } from './scenes/Game.js';
import { PauseScene, GameOverScene } from './scenes/Overlays.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: Math.round(W * ZOOM),
  height: Math.round(VIEW_H * ZOOM),
  backgroundColor: '#7ec8f2',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 },
  scene: [BootScene, MenuScene, GameScene, GameOverScene, PauseScene],
});

// Für automatisierte Tests im Browser
window.__skytower = game;
