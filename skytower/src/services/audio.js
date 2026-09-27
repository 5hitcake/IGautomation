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

// ---------------------------------------------------------------------------
// Hintergrundmusik: ein fröhlicher 8-Takt-Loop, live erzeugt. Im Spiel steigt
// das Tempo mit jeder Kamerastufe, und ab bestimmten Stufen kommen
// Hi-Hats, Snare und eine zweite Stimme dazu.

const MUSIC = {
  menuBpm: 96,
  gameBpm: 120,
  bpmPerLevel: 7,
  volume: 0.32,
};

// Grundtöne der Akkorde je Takt (MIDI): C Am F G | F G C G
const BASS = [48, 45, 41, 43, 41, 43, 48, 43];
// Melodie in Achteln je Takt (MIDI, null = Pause)
const MELODY = [
  [76, 79, 84, 79, 81, 79, 76, 74],
  [72, 76, 81, 76, 79, 76, 72, 74],
  [69, 72, 77, 81, 79, 77, 74, 72],
  [71, 74, 79, 74, 77, 76, 74, 71],
  [77, null, 77, 79, 81, null, 79, 77],
  [79, null, 79, 81, 83, null, 81, 79],
  [84, 83, 81, 79, 76, 79, 84, null],
  [83, null, 79, null, 74, 76, 79, null],
];
const STEPS = BASS.length * 16;

const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

let musicGain = null;
let noiseBuf = null;
let timer = null;
let step = 0;
let nextTime = 0;
let mode = 'menu';
let level = 0;

function bpm() {
  return mode === 'menu' ? MUSIC.menuBpm : MUSIC.gameBpm + level * MUSIC.bpmPerLevel;
}

function note(m, t, dur, type, vol, cutoff) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(midiHz(m), t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let out = osc.connect(g);
  if (cutoff) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    out = out.connect(f);
  }
  out.connect(musicGain);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(t, dur, vol, freq, type = 'highpass') {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(musicGain);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function kick(t) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  osc.connect(g).connect(musicGain);
  osc.start(t);
  osc.stop(t + 0.2);
}

function playStep(i, t) {
  const bar = Math.floor(i / 16);
  const s = i % 16;
  const sixteenth = 60 / bpm() / 4;
  const game = mode === 'game';

  // Bass: Viertel, im Spiel mit Oktav-Sprung dazwischen
  if (s % 4 === 0) note(BASS[bar], t, sixteenth * 3.2, 'triangle', 0.32);
  else if (game && s % 4 === 2) note(BASS[bar] + 12, t, sixteenth * 1.6, 'triangle', 0.16);

  // Melodie (Achtel)
  if (s % 2 === 0) {
    const m = MELODY[bar][s / 2];
    if (m) {
      note(m, t, sixteenth * 1.8, game ? 'square' : 'triangle', game ? 0.07 : 0.14, 2600);
      if (game && level >= 4) note(m - 12, t, sixteenth * 1.8, 'triangle', 0.08);
    }
  }

  if (!game) return;
  // Schlagzeug wird mit der Kamerastufe voller
  if (s % 8 === 0) kick(t);
  if (level >= 1 && s % 8 === 4) noise(t, 0.12, 0.22, 1800, 'bandpass');
  if (level >= 2 && s % 2 === 0) noise(t, 0.04, 0.08, 7000);
  if (level >= 5 && s % 2 === 1) noise(t, 0.03, 0.05, 8000);
  if (level >= 3 && s === 14) kick(t);
}

function schedule() {
  while (nextTime < ctx.currentTime + 0.15) {
    playStep(step, nextTime);
    nextTime += 60 / bpm() / 4;
    step = (step + 1) % STEPS;
  }
}

export const music = {
  /** Startet die Musik im Modus 'menu' oder 'game' (setzt unlockAudio voraus). */
  start(newMode, newLevel = 0) {
    if (!ctx) return;
    const changed = newMode !== mode;
    mode = newMode;
    level = newLevel;
    if (timer && !changed) return;
    this.stop();
    musicGain = ctx.createGain();
    musicGain.gain.value = MUSIC.volume;
    musicGain.connect(master);
    step = 0;
    nextTime = ctx.currentTime + 0.06;
    timer = setInterval(schedule, 25);
    schedule();
  },
  setLevel(l) {
    level = l;
  },
  stop() {
    if (timer) clearInterval(timer);
    timer = null;
    if (musicGain && ctx) {
      const g = musicGain;
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      setTimeout(() => g.disconnect(), 400);
    }
    musicGain = null;
  },
};

// Tab/App im Hintergrund: alles stumm schalten
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend();
  else ctx.resume();
});
