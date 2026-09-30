import { tr } from './i18n.js';

// Alle Balancing-Werte an einer Stelle. Einheiten: Pixel der logischen
// Spielwelt (720 breit), Sekunden.

export const WORLD_W = 720;

// Test-Werkzeuge: 10.000 Start-Münzen, im Shop 5× auf die Münzen tippen = +10.000,
// 5× auf "Skins" tippen = alle Skins frei. Beim Store-Build aus (SKYTOWER_RELEASE=1).
/* global __TEST_TOOLS__ */
export const TEST_TOOLS = typeof __TEST_TOOLS__ === 'undefined' ? true : __TEST_TOOLS__;
export const TEST_COINS = 10000;

export const PHYSICS = {
  gravity: 2900,
  jumpBase: 1200, // Sprunggeschwindigkeit aus dem Stand (~1,6 Etagen)
  jumpSpeedFactor: 0.9, // + Anteil der horizontalen Geschwindigkeit
  maxRunSpeed: 870,
  accel: 2400,
  turnAccel: 4800, // schnelleres Umlenken bei Richtungswechsel
  friction: 1400, // Abbremsen ohne Eingabe (niedrig = mehr Schwung wie im Original)
  wallBounceKeep: 0.9, // behaltenes Tempo beim Wandabpraller
  wallBounceMinSpeed: 420, // Mindesttempo für einen "echten" Abpraller
  wallBounceBoost: 260, // Höhenbonus beim Abpraller
  playerRadius: 34,
};

export const TOWER = {
  floorHeight: 150,
  wallWidth: 26,
  startWidth: 300, // Plattformbreite ganz unten
  minWidthFactor: 0.45, // schmalste Breite relativ zu startWidth
  shrinkUntilFloor: 500,
  milestoneEvery: 50,
  crumbleFromFloor: 100,
  crumbleChance: 0.15,
  crumbleDelay: 0.35,
  movingFromFloor: 200,
  movingChance: 0.2,
  movingSpeed: 110,
  coinChance: 0.3,
};

export const CAMERA = {
  startFloor: 5, // ab hier scrollt die Kamera ...
  startAfter: 8, // ... spätestens aber nach so vielen Sekunden
  baseSpeed: 55,
  speedPerLevel: 32,
  levelEvery: 30, // Sekunden bis zur nächsten Stufe
  maxLevel: 8,
  followZone: 1 / 3, // Spieler im oberen Drittel -> Kamera zieht mit
};

export const COMBO = {
  minFloors: 2, // Sprung muss mind. so viele Etagen schaffen
  minJumps: 2, // Combo zählt erst ab so vielen Combo-Sprüngen
  timer: 3, // Sekunden bis zum nächsten Combo-Sprung
  celebrateFrom: 25, // ab so vielen Etagen strahlt Wolki mit ^^-Augen
  celebrateTime: 1.6, // Sekunden
};

export const SCORE = {
  perFloor: 10,
};

export const COMBO_CALLOUTS = [
  [200, tr('LEGENDE!', 'LEGENDARY!')],
  [140, tr('Unaufhaltsam!', 'Unstoppable!')],
  [100, tr('Kosmisch!', 'Cosmic!')],
  [70, tr('Überirdisch!', 'Out of this world!')],
  [50, tr('Himmlisch!', 'Heavenly!')],
  [35, tr('Wahnsinn!', 'Insane!')],
  [25, tr('Fantastisch!', 'Fantastic!')],
  [15, tr('Klasse!', 'Great!')],
  [7, tr('Super!', 'Super!')],
  [4, tr('Gut!', 'Good!')],
];

// Zonen: je 100 Etagen, bei Etage 1000 wartet das Himmelstor; danach geht es in
// der Galaxie endlos weiter. Farben: Himmel oben/unten, Plattform-Stil, Deko.
export const ZONES = [
  { from: 0, name: tr('Stadtdächer', 'Rooftops'), skyTop: '#8fd3ff', skyBottom: '#ffd6a5', platform: 'roof', deco: 'city' },
  { from: 100, name: tr('Wolkenmeer', 'Sea of Clouds'), skyTop: '#5fb8f5', skyBottom: '#bfe6ff', platform: 'cloud', deco: 'balloon' },
  { from: 200, name: tr('Sonnenuntergang', 'Sunset'), skyTop: '#ff7eb3', skyBottom: '#ffc36b', platform: 'rainbow', deco: 'bird' },
  { from: 300, name: tr('Gewitterfront', 'Thunderstorm'), skyTop: '#3d4a6b', skyBottom: '#7a86a8', platform: 'storm', deco: 'bolt' },
  { from: 400, name: tr('Mondnacht', 'Moonlit Night'), skyTop: '#16224f', skyBottom: '#3b4d8c', platform: 'moonrock', deco: 'moon' },
  { from: 500, name: tr('Polarlicht', 'Northern Lights'), skyTop: '#101d45', skyBottom: '#2b6f7a', platform: 'ice', deco: 'aurora' },
  { from: 600, name: tr('Stratosphäre', 'Stratosphere'), skyTop: '#0b1030', skyBottom: '#2466b0', platform: 'satellite', deco: 'satellite' },
  { from: 700, name: tr('Weltall', 'Outer Space'), skyTop: '#07081c', skyBottom: '#1c1a4a', platform: 'asteroid', deco: 'planet' },
  { from: 800, name: tr('Asteroidengürtel', 'Asteroid Belt'), skyTop: '#140a1e', skyBottom: '#3d2130', platform: 'meteor', deco: 'rock' },
  { from: 900, name: tr('Galaxie', 'Galaxy'), skyTop: '#1a0630', skyBottom: '#4a1a6e', platform: 'stardust', deco: 'nebula' },
  // hinter dem Himmelstor, endlos; beginnt direkt über dem Tor (ohne langen Farbübergang)
  { from: 1001, name: tr('Himmelreich', 'Heaven'), skyTop: '#a8dcff', skyBottom: '#fff4d6', platform: 'heaven', deco: 'heaven', instant: true },
];

// Besonderheiten je Zone (Index wie in ZONES)
export const ZONE_RULES = {
  3: { hint: tr('Vorsicht, Blitze!', 'Watch out, lightning!'), hazard: 'lightning' },
  4: { hint: tr('Gute Nacht, Wolki!', 'Good night, Wolki!') },
  5: { hint: tr('Achtung, glatt!', 'Careful, slippery!'), friction: 0.22, accel: 0.7, turnAccel: 0.45 },
  6: { hint: tr('Achtung, Wind!', 'Watch out, wind!'), wind: 260 },
  7: { hint: tr('Ab ins All!', 'Off to space!') },
  8: { hint: tr('Meteoriten!', 'Meteorites!'), hazard: 'meteor' },
  9: { hint: tr('Warp-Sterne!', 'Warp stars!'), warp: true },
  10: { hint: tr('Wolken puffen nach dem Sprung weg!', 'Clouds go poof after each jump!'), puff: true, coinChance: 0.85 },
};

// Wind in der Stratosphäre: Böen wechseln langsam die Richtung
export const WIND = { period: 7 }; // Sekunden für einmal hin und her

// Gefahren (Blitze im Gewitter, Meteoriten im Asteroidengürtel)
export const LIGHTNING = {
  every: [3.2, 5.5], // Sekunden zwischen zwei Einschlägen (zufällig im Bereich)
  warning: 1.1, // Vorwarnzeit, in der die Plattform blinkt
  minFloorsAbove: 2, // trifft nur Plattformen mind. so weit über Wolki
};

// Münzen: Wert und Wahrscheinlichkeit je Zone (Rest = normale Münze mit Wert 1)
export const COIN_TIERS = {
  silver: { value: 5, texture: 'coin_silver' },
  gold: { value: 10, texture: 'coin_gold' },
  diamond: { value: 25, texture: 'diamond' },
};
export const COIN_TIER_CHANCE = [
  {},
  { silver: 0.2 },
  { silver: 0.3, gold: 0.08 },
  { silver: 0.35, gold: 0.12 },
  { silver: 0.35, gold: 0.18 },
  { silver: 0.3, gold: 0.25, diamond: 0.04 },
  { silver: 0.25, gold: 0.3, diamond: 0.07 },
  { gold: 0.35, diamond: 0.1 },
  { gold: 0.35, diamond: 0.14 },
  { gold: 0.35, diamond: 0.2 },
  { gold: 0.45, diamond: 0.3 }, // Himmelreich: viele wertvolle Münzen
];

export const POWERUPS = {
  fromFloor: 40, // ab dieser Etage können Power-ups auftauchen
  chance: 0.014, // je Plattform – bewusst selten, damit Power-ups etwas Besonderes bleiben
  minGap: 60, // mindestens so viele Etagen zwischen zwei Power-ups
  weights: { rocket: 1, shield: 0.6, magnet: 1 },
  shieldMax: 3, // so viele Regenschirme kann man auf Vorrat haben
  rocket: { floors: 30, duration: 1.3 },
  magnet: { duration: 10, radius: 340 },
  warp: { floors: 12, chance: 0.05 }, // nur in der Galaxie
};

// Weiterspielen nach einem Absturz: ein Regenschirm fängt Wolki auf.
// Zum Start ohne Werbung: 1× pro Runde gratis. Später (AdMob, Phase 6) per
// belohnter Werbung: dann viaAd: true und z. B. max: 3.
// Test-Versionen: wie später mit AdMob – bis 3× per (3-s-Test-)Werbung.
// Store-Version: 1× gratis, ohne Werbung.
export const REVIVE = TEST_TOOLS
  ? { max: 3, viaAd: true, fakeAdSeconds: 3 }
  : { max: 1, viaAd: false, fakeAdSeconds: 3 };
// Countdown nach „Weiterspielen per Werbung“: 3 – 2 – 1 – Los!
export const COUNTDOWN = { from: 3, stepMs: 800 };

// Das große Ziel
export const GATE = {
  floor: 1000,
  bonusCoins: 1000,
  skin: 'engel', // der ultimative Skin, nur hier freischaltbar
  // „Perfekter Aufstieg“: Tor erreicht, ohne ein einziges Mal gerettet zu werden
  // (kein Regenschirm, kein Weiterspielen per Werbung)
  perfectBonus: 2000,
  perfectSkin: 'sterne',
};

export function zoneIndexForFloor(floor) {
  let idx = 0;
  for (let i = 0; i < ZONES.length; i++) if (floor >= ZONES[i].from) idx = i;
  return idx;
}
