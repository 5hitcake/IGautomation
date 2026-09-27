// Platzhalter-Sounds, live per Web Audio synthetisiert (keine Dateien, keine
// Lizenzfragen). Werden später durch CC0-Effekte und KI-Musik ersetzt.

let ctx = null;
let master = null;
let enabled = true;

export function setSoundEnabled(on) {
  enabled = on;
  if (master) master.gain.value = on ? 0.5 : 0;
}

/** Muss nach einer Nutzer-Geste aufgerufen werden (Browser-Regel). */
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.5 : 0;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function tone({ freq = 440, to = freq, dur = 0.12, type = 'sine', vol = 0.3, delay = 0 }) {
  if (!ctx || !enabled) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sfx = {
  /** power 0..1 = wie kräftig der Sprung ist */
  jump(power) {
    const f = 300 + power * 260;
    tone({ freq: f, to: f * 1.8, dur: 0.14, type: 'triangle', vol: 0.18 + power * 0.1 });
  },
  wall() {
    tone({ freq: 180, to: 520, dur: 0.12, type: 'square', vol: 0.08 });
  },
  coin() {
    tone({ freq: 988, dur: 0.07, type: 'square', vol: 0.07 });
    tone({ freq: 1319, dur: 0.12, type: 'square', vol: 0.07, delay: 0.06 });
  },
  comboStep(n) {
    tone({ freq: 520 + Math.min(n, 12) * 60, dur: 0.08, type: 'sine', vol: 0.12 });
  },
  comboEnd(floors) {
    const notes = floors >= 25 ? [523, 659, 784, 1047] : floors >= 7 ? [523, 659, 784] : [523, 659];
    notes.forEach((f, i) => tone({ freq: f, dur: 0.16, type: 'triangle', vol: 0.2, delay: i * 0.08 }));
  },
  hurry() {
    [0, 0.14].forEach((d) => tone({ freq: 880, to: 660, dur: 0.12, type: 'square', vol: 0.09, delay: d }));
  },
  zone() {
    [392, 523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.22, type: 'sine', vol: 0.15, delay: i * 0.1 }));
  },
  gameOver() {
    tone({ freq: 440, to: 110, dur: 0.7, type: 'sawtooth', vol: 0.12 });
  },
  click() {
    tone({ freq: 660, dur: 0.05, type: 'sine', vol: 0.12 });
  },
};

export function vibrate(ms) {
  try { navigator.vibrate?.(ms); } catch { /* nicht unterstützt */ }
}
