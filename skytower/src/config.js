// Alle Balancing-Werte an einer Stelle. Einheiten: Pixel der logischen
// Spielwelt (720 breit), Sekunden.

export const WORLD_W = 720;

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
  [200, 'LEGENDE!'],
  [140, 'Unaufhaltsam!'],
  [100, 'Kosmisch!'],
  [70, 'Überirdisch!'],
  [50, 'Himmlisch!'],
  [35, 'Wahnsinn!'],
  [25, 'Fantastisch!'],
  [15, 'Klasse!'],
  [7, 'Super!'],
  [4, 'Gut!'],
];

// Zonen: ab Etage `from`. Farben: Himmel oben/unten, Plattform-Stil.
export const ZONES = [
  { from: 0, name: 'Stadtdächer', skyTop: '#8fd3ff', skyBottom: '#ffd6a5', platform: 'roof', deco: 'city' },
  { from: 100, name: 'Wolkenmeer', skyTop: '#5fb8f5', skyBottom: '#bfe6ff', platform: 'cloud', deco: 'balloon' },
  { from: 200, name: 'Sonnenuntergang', skyTop: '#ff7eb3', skyBottom: '#ffc36b', platform: 'rainbow', deco: 'bird' },
  { from: 300, name: 'Gewitterfront', skyTop: '#3d4a6b', skyBottom: '#7a86a8', platform: 'storm', deco: 'bolt' },
  { from: 400, name: 'Polarlicht', skyTop: '#101d45', skyBottom: '#2b6f7a', platform: 'ice', deco: 'aurora' },
  { from: 500, name: 'Weltall', skyTop: '#07081c', skyBottom: '#1c1a4a', platform: 'asteroid', deco: 'planet' },
  { from: 1000, name: 'Galaxie', skyTop: '#1a0630', skyBottom: '#4a1a6e', platform: 'stardust', deco: 'nebula' },
];

export function zoneIndexForFloor(floor) {
  let idx = 0;
  for (let i = 0; i < ZONES.length; i++) if (floor >= ZONES[i].from) idx = i;
  return idx;
}
