// Steuerung durch Neigen des Handys (Lagesensor, DeviceOrientation).
// gamma = Neigung nach links/rechts in Grad (Hochformat). Auf Android ohne
// Nachfrage verfügbar; kommen keine Daten, wird im Spiel auf Tippen ausgewichen.

const DEAD = 3; // Grad, in denen nichts passiert (ruhige Hand)
const FULL = 22; // ab dieser Neigung volles Tempo

let gamma = null;
let lastEvent = 0;
let zero = 0;
let listening = false;

function onOrientation(e) {
  if (e.gamma == null) return;
  gamma = e.gamma;
  lastEvent = performance.now();
}

/** Sensor einschalten (einmalig). */
export function startTilt() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('deviceorientation', onOrientation);
}

/** Liefert der Sensor gerade Werte? */
export const tiltAvailable = () => gamma !== null && performance.now() - lastEvent < 1000;

/** Aktuelle Haltung als „gerade“ merken (zu Beginn einer Runde). */
export function calibrateTilt() {
  zero = gamma === null ? 0 : Math.max(-15, Math.min(15, gamma));
}

/** -1 (ganz links) … 0 … 1 (ganz rechts), stufenlos */
export function tiltValue() {
  if (gamma === null) return 0;
  const g = gamma - zero;
  const a = Math.abs(g);
  if (a < DEAD) return 0;
  return Math.sign(g) * Math.min(1, (a - DEAD) / (FULL - DEAD));
}
