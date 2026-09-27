// Hintergrundmusik, live erzeugt (kostenlos, keine Lizenzfragen).
//
// Ein 32-Takt-Song in C-Dur (Strophe A, Überleitung B, A, Refrain C) im Stil
// flotter Arcade-/Eurodance-Musik: durchgehende Bassdrum, Oktav-Bass,
// Akkord-Stöße, "Pumpen", Trommelwirbel und Rauschen als Übergänge. Im Spiel
// wird er mit jeder Kamerastufe schneller, bekommt mehr Instrumente dazu und
// wechselt ab Stufe 3 und 6 einen Halbton höher. Im Menü läuft eine ruhige
// Fassung ohne Schlagzeug.
import { audioOut } from './audio.js';

const CFG = {
  menuBpm: 92,
  gameBpm: 128,
  bpmPerLevel: 6,
  volume: 0.34,
};

// Akkorde als MIDI-Töne (tiefe Lage, Bass nimmt den ersten Ton)
const CHORDS = {
  C: [48, 52, 55],
  G: [43, 47, 50],
  Am: [45, 48, 52],
  F: [41, 45, 48],
  Em: [40, 43, 47],
};

// Melodie in Achteln: Note, "-" = vorherige Note halten, "." = Pause
const SECTIONS = {
  A: {
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'],
    melody: [
      'E5 G5 C6 G5 E5 G5 A5 G5',
      'D5 G5 B5 G5 D5 G5 A5 G5',
      'C5 E5 A5 E5 C5 E5 G5 E5',
      'F5 - A5 - C6 - A5 G5',
      'E5 G5 C6 G5 E5 G5 A5 G5',
      'D5 G5 B5 D6 C6 B5 A5 G5',
      'A5 - C6 A5 G5 F5 E5 D5',
      'D5 - G5 - B5 - . .',
    ],
  },
  B: {
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'G'],
    melody: [
      'A5 - . A5 C6 - B5 A5',
      'A5 - G5 - F5 - E5 F5',
      'G5 - . G5 C6 - B5 G5',
      'B5 - A5 - G5 - D5 E5',
      'A5 - . A5 C6 - D6 E6',
      'F6 - E6 D6 C6 - A5 C6',
      'D6 - B5 G5 D6 - B5 G5',
      'D6 - - - . . G5 B5',
    ],
  },
  C: {
    chords: ['F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C'],
    melody: [
      'C6 - A5 - C6 D6 C6 A5',
      'B5 - G5 - B5 C6 B5 G5',
      'G5 - E5 - G5 A5 G5 E5',
      'A5 - - - C6 - E6 -',
      'F6 - E6 - D6 - C6 -',
      'D6 - C6 - B5 - G5 -',
      'C6 - E6 - G6 - E6 C6',
      'C6 - - - . . . .',
    ],
  },
};

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const toMidi = (n) => 12 * (Number(n.slice(-1)) + 1) + NOTE[n[0]] + (n[1] === '#' ? 1 : 0);
const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);

/** Song als Liste von Takten: { chord, melody: [[midi, achtel] | null] × 8, section, barInSection, next } */
function buildSong(form) {
  const bars = [];
  form.forEach((key, fi) => {
    const next = form[(fi + 1) % form.length];
    const sec = SECTIONS[key];
    sec.melody.forEach((line, b) => {
      const tokens = line.split(' ');
      const mel = tokens.map((tok, i) => {
        if (tok === '.' || tok === '-') return null;
        let len = 1;
        while (tokens[i + len] === '-') len++;
        return [toMidi(tok), len];
      });
      bars.push({ chord: CHORDS[sec.chords[b]], melody: mel, section: key, barInSection: b, next });
    });
  });
  return bars;
}

const SONGS = {
  game: buildSong(['A', 'B', 'A', 'C']),
  menu: buildSong(['A', 'B']),
};

// ---------------------------------------------------------------------------

let ctx = null;
let out = null; // Gain + Kompressor dieses Laufs
let bus = null;
let noiseBuf = null;
let timer = null;
let mode = 'menu';
let level = 0;
let step = 0;
let nextTime = 0;
let transpose = 0;

const bpm = () => (mode === 'menu' ? CFG.menuBpm : CFG.gameBpm + level * CFG.bpmPerLevel);
const sixteenth = () => 60 / bpm() / 4;

function makeBus() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const filter = (type, freq, q = 1) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  };

  // Echo für Melodie und Arpeggio
  const delay = ctx.createDelay(1);
  delay.delayTime.value = sixteenth() * 3;
  const fb = ctx.createGain();
  fb.gain.value = 0.3;
  const wet = ctx.createGain();
  wet.gain.value = 0.22;
  delay.connect(fb).connect(delay);
  delay.connect(filter('lowpass', 2400)).connect(wet).connect(out);

  const lead = filter('lowpass', 3400);
  lead.connect(out);
  lead.connect(delay);
  // "Pumpen": Arpeggio, Flächen und Akkord-Stöße ducken sich bei jeder Bassdrum
  const pump = ctx.createGain();
  pump.connect(out);
  const arp = filter('lowpass', 2800);
  arp.connect(pump);
  arp.connect(delay);
  const stab = filter('lowpass', 3200);
  stab.connect(pump);
  const bass = filter('lowpass', 700, 2);
  bass.connect(out);
  const pad = filter('lowpass', 1400);
  pad.connect(pump);
  const snare = filter('bandpass', 1900, 0.8);
  snare.connect(out);
  const hat = filter('highpass', 7500);
  hat.connect(out);
  const click = filter('highpass', 3000);
  click.connect(out);
  return { delay, pump, lead, arp, stab, bass, pad, snare, hat, click };
}

function env(t, attack, hold, release, vol) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  return g;
}

function osc(type, midi, t, end, target, detune = 0) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(midiHz(midi), t);
  o.detune.value = detune;
  o.connect(target);
  o.start(t);
  o.stop(end + 0.05);
}

function leadNote(m, t, dur, vol, soft) {
  const g = env(t, 0.012, Math.max(0, dur - 0.08), 0.12, vol);
  g.connect(bus.lead);
  if (soft) {
    osc('triangle', m, t, t + dur + 0.14, g);
  } else {
    osc('square', m, t, t + dur + 0.14, g, -7);
    osc('sawtooth', m, t, t + dur + 0.14, g, 7);
  }
}

function pluck(m, t, vol) {
  const g = env(t, 0.004, 0, 0.16, vol);
  g.connect(bus.arp);
  osc('triangle', m, t, t + 0.2, g);
}

function bassNote(m, t, dur, vol) {
  const g = env(t, 0.006, dur * 0.6, dur * 0.4, vol);
  g.connect(bus.bass);
  osc('square', m, t, t + dur, g);
  osc('triangle', m - 12, t, t + dur, g);
}

function padChord(chord, t, dur, vol) {
  const g = env(t, 0.35, dur - 0.6, 0.5, vol);
  g.connect(bus.pad);
  chord.forEach((m, i) => osc('triangle', m + 12 + transpose, t, t + dur + 0.2, g, i * 4 - 4));
}

function noise(t, dur, vol, target, decay = true) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  if (decay) g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(g).connect(target);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function duck(t) {
  const g = bus.pump.gain;
  g.setValueAtTime(0.3, t);
  g.linearRampToValueAtTime(1, t + 0.15);
}

/** Akkord-Stoß auf der Nachschlag-Zählung */
function stab(chord, t, vol) {
  const g = env(t, 0.004, 0.05, 0.09, vol);
  g.connect(bus.stab);
  chord.forEach((m, i) => osc('sawtooth', m + 24 + transpose, t, t + 0.16, g, i * 5 - 5));
}

function clap(t, vol = 0.5) {
  [0, 0.011, 0.022].forEach((d) => noise(t + d, 0.02, vol, bus.snare));
  noise(t + 0.03, 0.14, vol * 0.6, bus.snare);
}

/** Aufsteigendes Rauschen vor einem neuen Abschnitt */
function riser(t, dur) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 3;
  f.frequency.setValueAtTime(400, t);
  f.frequency.exponentialRampToValueAtTime(9000, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.1);
}

const SCALE = [0, 2, 4, 5, 7, 9, 11];
/** Terz darüber innerhalb der C-Dur-Tonleiter */
function thirdAbove(m) {
  const pc = m % 12;
  const i = SCALE.indexOf(pc);
  if (i < 0) return m + 4;
  return m + ((SCALE[(i + 2) % 7] - pc + 12) % 12);
}

function kick(t, vol = 0.9) {
  noise(t, 0.012, 0.3, bus.click);
  duck(t);
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.25);
}

function snare(t, vol = 0.55) {
  noise(t, 0.16, vol, bus.snare);
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
  g.gain.setValueAtTime(vol * 0.64, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.12);
}

function playStep(i, t) {
  const song = SONGS[mode];
  const barIdx = Math.floor(i / 16) % song.length;
  const bar = song[barIdx];
  const s = i % 16;
  const x = sixteenth();
  const game = mode === 'game';

  // Tonart nur am Taktanfang wechseln
  if (s === 0) transpose = game ? (level >= 6 ? 2 : level >= 3 ? 1 : 0) : 0;
  const tr = transpose;
  const root = bar.chord[0] + tr;

  // Melodie
  if (s % 2 === 0) {
    const n = bar.melody[s / 2];
    if (n) {
      const [m, len] = n;
      const dur = len * 2 * x * 0.92;
      leadNote(m + tr, t, dur, game ? 0.09 : 0.13, !game);
      if (game && bar.section === 'C') leadNote(thirdAbove(m) + tr, t, dur, 0.05, false);
      if (game && level >= 4) leadNote(m + tr - 12, t, dur, 0.05, true);
    }
  }

  if (!game) {
    // Menü: weiche Flächen, sanftes Arpeggio, ruhiger Bass
    if (s === 0) padChord(bar.chord, t, 16 * x, 0.05);
    if (s === 0 || s === 8) bassNote(root, t, 7 * x, 0.16);
    if (s % 4 === 2) pluck(bar.chord[(s / 4) % 3 | 0] + 24 + tr, t, 0.05);
    return;
  }

  const fillBar = bar.barInSection === 7;

  // Bass: Oktav-Sprünge in Achteln (Eurodance), am Taktende synkopiert
  if (s % 2 === 0) bassNote(s % 4 === 0 ? root : root + 12, t, x * 1.7, s % 4 === 0 ? 0.22 : 0.16);

  // Akkord-Stöße auf der Nachschlag-Zählung (im Refrain immer, sonst ab Stufe 2)
  if (s % 4 === 2 && (bar.section === 'C' || level >= 2)) stab(bar.chord, t, 0.035);

  // Arpeggio ab Stufe 1
  if (level >= 1) {
    const tones = [bar.chord[0] + 24, bar.chord[1] + 24, bar.chord[2] + 24, bar.chord[0] + 36];
    pluck(tones[s % 4] + tr, t, 0.045);
  }

  // Schlagzeug: durchgehende Bassdrum, Clap + Snare auf 2 und 4
  if (s % 4 === 0 && !(fillBar && s >= 12)) kick(t, s % 8 === 0 ? 0.95 : 0.8);
  if (level >= 3 && (s === 14 || s === 7) && !fillBar) kick(t, 0.45);
  if ((s === 4 || s === 12) && !(fillBar && s === 12)) {
    snare(t);
    clap(t, 0.4);
  }
  if (s % 4 === 2) noise(t, 0.05, 0.14, bus.hat);
  if (level >= 1 && s % 2 === 0 && s % 4 !== 2) noise(t, 0.03, 0.07, bus.hat);
  if (level >= 4 && s % 2 === 1) noise(t, 0.025, 0.05, bus.hat);
  if (level >= 2 && (s === 6 || s === 14)) noise(t, 0.2, 0.08, bus.hat);

  // Übergang: Trommelwirbel in der zweiten Hälfte des letzten Takts
  if (fillBar && s >= 8 && (level >= 1 || s >= 12)) snare(t, 0.12 + (s - 8) * 0.05);
  // Aufsteigendes Rauschen vor dem Refrain (ab Stufe 2 vor jedem Abschnitt)
  if (fillBar && s === 0 && (bar.next === 'C' || level >= 2)) riser(t, 16 * x);
  // Becken am Anfang jedes Abschnitts
  if (s === 0 && bar.barInSection === 0) noise(t, 1.2, 0.13, bus.hat);
}

function schedule() {
  while (nextTime < ctx.currentTime + 0.15) {
    playStep(step, nextTime);
    nextTime += sixteenth();
    step = (step + 1) % (SONGS[mode].length * 16);
  }
}

export const music = {
  /** Startet die Musik im Modus 'menu' oder 'game' (setzt unlockAudio voraus). */
  start(newMode, newLevel = 0) {
    const a = audioOut();
    if (!a) return;
    ctx = a.ctx;
    const changed = newMode !== mode;
    mode = newMode;
    this.setLevel(newLevel);
    if (timer && !changed) return;
    this.stop();
    const gain = ctx.createGain();
    gain.gain.value = CFG.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    gain.connect(comp).connect(a.master);
    out = gain;
    bus = makeBus();
    step = 0;
    nextTime = ctx.currentTime + 0.06;
    timer = setInterval(schedule, 25);
    schedule();
  },
  setLevel(l) {
    level = l;
    if (bus && ctx) bus.delay.delayTime.setTargetAtTime(sixteenth() * 3, ctx.currentTime, 0.1);
  },
  stop() {
    if (timer) clearInterval(timer);
    timer = null;
    if (out && ctx) {
      const g = out;
      const b = bus;
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      setTimeout(() => {
        g.disconnect();
        b.delay.disconnect(); // Echo-Schleife auflösen
      }, 600);
    }
    out = null;
    bus = null;
  },
};

/**
 * Rendert die Musik ohne Lautsprecher in einen AudioBuffer (für Hörproben
 * und Tests). Beeinflusst eine gerade laufende Musik nicht.
 */
export async function renderPreview(previewMode, previewLevel, seconds, startBar = 0, sampleRate = 32000) {
  const saved = { ctx, out, bus, mode, level, step, nextTime, transpose };
  const off = new OfflineAudioContext(1, Math.ceil(sampleRate * seconds), sampleRate);
  try {
    ctx = off;
    mode = previewMode;
    level = previewLevel;
    const gain = off.createGain();
    gain.gain.value = CFG.volume * 1.6;
    const comp = off.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    gain.connect(comp).connect(off.destination);
    out = gain;
    bus = makeBus();
    step = startBar * 16;
    nextTime = 0.05;
    while (nextTime < seconds - 0.3) {
      playStep(step, nextTime);
      nextTime += sixteenth();
      step = (step + 1) % (SONGS[mode].length * 16);
    }
  } finally {
    ({ ctx, out, bus, mode, level, step, nextTime, transpose } = saved);
  }
  return off.startRendering();
}
