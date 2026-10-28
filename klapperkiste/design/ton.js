// Ton: Gebrummel der Figuren und Musik im Browser (Web Audio), aus Aufnahmen oder selbst gespielt.
// Wird von karte.js genutzt (window.Ton). Keine Sprache: Die Figuren brabbeln
// unverständlich, damit es in jeder Übersetzung gleich bleibt.
window.Ton = (function () {
  let audio = null, laerm = null, stimmBus = null, musikBus = null;
  const lies = (k, std) => { try { return localStorage.getItem(k) ?? std; } catch { return std; } };
  const merk = (k, v) => { try { localStorage.setItem(k, v); } catch { /* egal */ } };
  const ein = { stimmen: lies("klapperkiste-ton", "an") !== "aus", musik: lies("klapperkiste-musik", "an") !== "aus" };

  function bereit() {
    try {
      if (!audio) {
        audio = new (window.AudioContext || window.webkitAudioContext)();
        laerm = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
        const d = laerm.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        stimmBus = busBauen(audio, audio.destination, 0.9, 5000);
        stimmeLaden(audio);
        musikBus = busBauen(audio, audio.destination, 1, 6000);
      }
      if (audio.state === "suspended") audio.resume();
    } catch { audio = null; }
    return audio;
  }
  // Ein Bus: Lautstärke und ein Tiefpass, der alles etwas weicher und „durch die Wand“ macht
  function busBauen(a, ziel, lautst, tiefpass) {
    const g = a.createGain(); g.gain.value = lautst;
    const f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = tiefpass; f.Q.value = 0.5;
    g.connect(f).connect(ziel);
    return g;
  }
  // Handy-Browser geben Ton nur frei, wenn er direkt in einer Berührung startet
  function freischalten() {
    const a = bereit();
    if (!a) return;
    try {
      const s = a.createBufferSource(); s.buffer = a.createBuffer(1, 1, 22050); s.connect(a.destination); s.start(0);
    } catch { /* egal */ }
    if (a.state === "running") for (const ev of ["pointerdown", "touchend", "click", "keydown"]) window.removeEventListener(ev, freischalten, true);
  }
  for (const ev of ["pointerdown", "touchend", "click", "keydown"]) window.addEventListener(ev, freischalten, true);

  // --- Gebrummel ---------------------------------------------------------------
  // Formant-Stimme: ein summender Grundton (wie die Stimmbänder) läuft durch zwei
  // Resonanzfilter (wie Mund und Rachen), die je Silbe einen anderen Vokal formen.
  // Dazu Atemrauschen, manchmal ein kurzer Konsonant davor, eine Satzmelodie, die
  // zum Satzende abfällt (bei Fragen steigt), und weiche, ineinanderfließende Silben.
  // groesse: >1 hebt die Resonanzen (kleinere, hellere Stimme), ton: Grundton in Hz.
  const STIMMEN = {
    opa: { bank: "maennlich", rate: 0.97, ton: 112, groesse: 0.95, zittern: 0.035, atem: 0.35, tempo: 0.9 },     // alt, zittrig, hauchig
    knut: { bank: "maennlich", rate: 0.84, ton: 88, groesse: 0.9, zittern: 0.012, atem: 0.45, tempo: 1 },        // tief und brummig
    hilde: { bank: "weiblich", rate: 1.0, ton: 205, groesse: 1.15, zittern: 0.015, atem: 0.2, tempo: 1.05 },   // warm, freundlich
    moos: { bank: "maennlich", rate: 0.92, ton: 98, groesse: 0.92, zittern: 0.02, atem: 0.4, tempo: 0.9, piep: true },
    gino: { bank: "maennlich", rate: 1.12, ton: 165, groesse: 1.05, zittern: 0.03, atem: 0.2, tempo: 1.15 },     // singend
    funke: { bank: "weiblich", rate: 1.06, ton: 220, groesse: 1.18, zittern: 0.01, atem: 0.15, tempo: 1.2 },    // zackig
    broesel: { bank: "maennlich", rate: 0.76, ton: 74, groesse: 0.85, zittern: 0.01, atem: 0.5, tempo: 0.85 },
    zylinda: { bank: "weiblich", rate: 1.2, ton: 270, groesse: 1.25, zittern: 0.025, atem: 0.15, tempo: 1.2 },
    kiel: { bank: "weiblich", rate: 0.86, ton: 150, groesse: 1.08, zittern: 0.015, atem: 0.45, tempo: 1 },      // rau, Seebärin
    frieder: { bank: "maennlich", rate: 1.02, ton: 128, groesse: 1, zittern: 0.02, atem: 0.3, tempo: 0.95 },
  };
  // Vokale als erste und zweite Resonanz (Hz, Erwachsenen-Mittelwerte)
  const VOKALE = [[730, 1090], [530, 1840], [300, 2250], [570, 840], [320, 870], [660, 1700], [440, 1020]];
  let silbenZahl = 0, letzterTon = 0, letzteZeit = 0;

  // Echte Silben: aus zwei gesprochenen Fantasie-Aufnahmen geschnitten (tools/stimmen.py,
  // design/stimmen_daten.js). Je Figur eine der beiden Stimmen, höher oder tiefer
  // abgespielt. Fehlen die Daten, springt die künstliche Formant-Stimme ein.
  const BANK_DATEN = window.STIMMEN_DATEN || {};
  const banken = new WeakMap(); // je AudioContext: { name: AudioBuffer | "laedt" }
  function bank(a, name) {
    let b = banken.get(a);
    if (!b) { b = {}; banken.set(a, b); }
    if (b[name] || !BANK_DATEN[name]) return b[name] instanceof AudioBuffer ? b[name] : null;
    b[name] = "laedt";
    try {
      const bin = atob(BANK_DATEN[name].wav.split(",")[1]), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const fertig = (buf) => { b[name] = buf; };
      const p = a.decodeAudioData(bytes.buffer, fertig, () => { b[name] = null; });
      if (p && p.then) p.then(fertig).catch(() => { b[name] = null; });
    } catch { b[name] = null; }
    return null;
  }
  function stimmeLaden(a) { for (const n of Object.keys(BANK_DATEN)) bank(a, n); }
  const zuletzt = {}; // letzte Silbe je Stimme, damit sie sich nicht direkt wiederholt
  function echteSilbe(a, ziel, st, info, buf) {
    const liste = BANK_DATEN[st.bank].silben;
    let nr;
    do { nr = Math.floor(Math.random() * liste.length); } while (liste.length > 3 && nr === zuletzt[st.bank]);
    zuletzt[st.bank] = nr;
    const [ab, lang] = liste[nr];
    const fort = info.fortschritt ?? 0.5;
    let kurve = 1.06 - 0.14 * fort; // Satzmelodie: zum Ende tiefer, bei Fragen am Ende höher
    if (info.frage && fort > 0.7) kurve += (fort - 0.7) * 0.6;
    if (info.betont) kurve *= 1.05;
    const rate = st.rate * kurve * (0.96 + Math.random() * 0.08);
    const t = Math.max(a.currentTime, 0) + 0.02;
    const nutz = Math.min(lang, 0.17) / rate; // lange Silben kürzen, damit es flüssig bleibt
    const q = a.createBufferSource(); q.buffer = buf; q.playbackRate.value = rate;
    const g = a.createGain(), laut = (info.betont ? 0.7 : 0.6) * (0.85 + Math.random() * 0.25);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(laut, t + 0.015);
    g.gain.setValueAtTime(laut, t + nutz * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + nutz + 0.03);
    q.connect(g).connect(ziel);
    q.start(t, ab, Math.min(lang, 0.17) + 0.04);
    if (st.piep && Math.random() < 0.06) piep(a, ziel, t);
    silbenZahl++;
  }
  function piep(a, ziel, t) { // Pieps im Bart von Förster Moos
    const v = a.createOscillator(), vg = a.createGain();
    v.type = "sine"; v.frequency.setValueAtTime(3200, t + 0.05); v.frequency.linearRampToValueAtTime(4200, t + 0.11);
    vg.gain.setValueAtTime(0.05, t + 0.05); vg.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    v.connect(vg).connect(ziel); v.start(t + 0.05); v.stop(t + 0.14);
  }

  function silbe(figur, info = {}, a = ein.stimmen && bereit(), ziel = stimmBus) {
    if (!a) return;
    const stEcht = STIMMEN[figur] || { bank: "maennlich", rate: 1 };
    const buf = stEcht.bank && bank(a, stEcht.bank);
    if (buf) return echteSilbe(a, ziel, stEcht, info, buf);
    const st = STIMMEN[figur] || { ton: 140, groesse: 1, zittern: 0.02, atem: 0.3, tempo: 1 };
    const t = Math.max(a.currentTime, 0) + 0.04; // Luft für den Konsonanten davor
    const dauer = (0.11 + Math.random() * 0.07) / st.tempo;
    // Satzmelodie: am Anfang etwas höher, zum Ende tiefer; Fragen gehen am Ende hoch
    const fort = info.fortschritt ?? 0.5;
    let kurve = 1.1 - 0.22 * fort;
    if (info.frage && fort > 0.7) kurve += (fort - 0.7) * 0.9;
    if (info.betont) kurve *= 1.08;
    const ziel0 = st.ton * kurve * (0.94 + Math.random() * 0.12);
    // fließender Übergang von der letzten Silbe, wenn sie gerade erst war
    const start = t - letzteZeit < 0.25 && letzterTon ? letzterTon : ziel0;
    letzterTon = ziel0 * 0.97; letzteZeit = t + dauer;

    const quelle = a.createGain(); quelle.gain.value = 1;
    for (const verstimmt of [1, 1.004]) { // zwei leicht verstimmte Schwinger: weniger „Maschine“
      const o = a.createOscillator(); o.type = "sawtooth";
      o.frequency.setValueAtTime(start * verstimmt, t);
      o.frequency.exponentialRampToValueAtTime(ziel0 * verstimmt, t + 0.05);
      o.frequency.exponentialRampToValueAtTime(ziel0 * 0.96 * verstimmt, t + dauer);
      const zitt = a.createOscillator(), zg = a.createGain();
      zitt.frequency.value = 4.5 + Math.random() * 2; zg.gain.value = ziel0 * st.zittern;
      zitt.connect(zg).connect(o.frequency);
      const og = a.createGain(); og.gain.value = 0.5;
      o.connect(og).connect(quelle);
      o.start(t); zitt.start(t); o.stop(t + dauer + 0.1); zitt.stop(t + dauer + 0.1);
    }
    const weich = a.createBiquadFilter(); weich.type = "lowpass"; weich.frequency.value = 1800 * st.groesse;
    quelle.connect(weich);
    // Atem: Rauschen durch dieselben Resonanzen
    const atem = a.createBufferSource(); atem.buffer = laerm; atem.loop = true;
    const ag = a.createGain(); ag.gain.value = 0.12 + st.atem * 0.5;
    atem.connect(ag).connect(weich);
    atem.start(t, Math.random() * 0.8); atem.stop(t + dauer + 0.1);

    // Vokal: zwei Resonanzen, die zur Silbe hin leicht gleiten (wie ein Mund, der sich bewegt)
    const [v1, v2] = VOKALE[Math.floor(Math.random() * VOKALE.length)];
    const [w1, w2] = VOKALE[Math.floor(Math.random() * VOKALE.length)];
    const huelle = a.createGain();
    for (const [f0, f1, q, g] of [[v1, w1, 6, 1], [v2, w2, 9, 0.55]]) {
      const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = q;
      bp.frequency.setValueAtTime(f0 * st.groesse, t);
      bp.frequency.linearRampToValueAtTime(((f0 + f1) / 2) * st.groesse, t + dauer);
      const bg = a.createGain(); bg.gain.value = g * 3;
      weich.connect(bp).connect(bg).connect(huelle);
    }
    const kopf = a.createGain(); kopf.gain.value = 0.25; weich.connect(kopf).connect(huelle); // etwas Brustton
    // Lautstärke: weich ein- und ausblenden, damit Silben ineinanderfließen
    const laut = (info.betont ? 0.3 : 0.24) * (0.85 + Math.random() * 0.3);
    huelle.gain.setValueAtTime(0.0001, t);
    huelle.gain.exponentialRampToValueAtTime(laut, t + 0.03);
    huelle.gain.setValueAtTime(laut, t + dauer * 0.55);
    huelle.gain.exponentialRampToValueAtTime(0.0001, t + dauer + 0.06);
    huelle.connect(ziel);

    if (Math.random() < 0.55) { // kurzer Konsonant davor (zischt, klickt oder pustet)
      const k = a.createBufferSource(); k.buffer = laerm;
      const kf = a.createBiquadFilter(); kf.type = "bandpass"; kf.Q.value = 1.5;
      kf.frequency.value = [1800, 3200, 5200][Math.floor(Math.random() * 3)];
      const kg = a.createGain();
      kg.gain.setValueAtTime(0.0001, t - 0.03); kg.gain.exponentialRampToValueAtTime(0.06, t - 0.02);
      kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.01);
      k.connect(kf).connect(kg).connect(ziel); k.start(Math.max(0, t - 0.03), Math.random() * 0.5); k.stop(t + 0.02);
    }
    if (st.piep && Math.random() < 0.06) { // Pieps im Bart von Förster Moos
      const v = a.createOscillator(), vg = a.createGain();
      v.type = "sine"; v.frequency.setValueAtTime(3200, t + 0.05); v.frequency.linearRampToValueAtTime(4200, t + 0.11);
      vg.gain.setValueAtTime(0.05, t + 0.05); vg.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      v.connect(vg).connect(ziel); v.start(t + 0.05); v.stop(t + 0.14);
    }
    silbenZahl++;
  }

  // --- Musik -------------------------------------------------------------------
  // Stücke in ABC-Notenschrift (dieselbe Schreibweise, die man auch als Notenblatt
  // anhören kann). Melodie plus Begleitung aus den Akkordnamen in Anführungszeichen.
  // stil: "ragtime"/"polka" (Bass auf 1, Akkord auf 2), "walzer" (Bass, Akkord, Akkord),
  // "wald" (lange, leise Akkorde). instr: Klangfarbe der Melodie.
  const STUECKE = {
    werkstatt: { stil: "ragtime", instr: "klavier", abc: `M:2/4
L:1/16
Q:1/4=104
K:C
"C"e2^de g2e2 | "C"c2G2 E2G2 | "F"A2^GA c2A2 | "C"G4 z2 GA |
"G7"B2AB d2B2 | "C"c2e2 g2e2 | "D7"^f2ef a2^f2 | "G7"g4 z2 G2 |
"C"e2^de g2e2 | "C7"c2G2 _B2G2 | "F"A2^GA c2f2 | "F#dim"e2d2 c2A2 |
"C"G2E2 "G7"D2B,2 | "C"C2E2 G2c2 | "G7"B2G2 F2D2 | "C"C4 z4 |` },
    fahren: { stil: "polka", instr: "akkordeon", abc: `M:2/4
L:1/8
Q:1/4=118
K:G
"G"B>c dB | "G"G2 B2 | "D7"A>B cA | "D7"F2 A2 | "G"B>c dB | "C"e2 c2 | "D7"Bc AF | "G"G2 z2 |
"C"e>f ge | "G"d2 B2 | "D7"c>d ec | "G"B2 G2 | "C"e>f ge | "G"d2 B2 | "D7"A>B cA | "G"G2 z2 |` },
    wald: { stil: "wald", instr: "klarinette", abc: `M:3/4
L:1/4
Q:1/4=66
K:Am
"Am"A,2 C | E3 | "Dm"D2 F | A3 | "Am"E2 C | "E7"B,3 | "Am"C2 B, | A,3 |
"F"F2 E | D3 | "C"E2 C | G,3 | "Dm"F2 D | "E7"^G,2 B, | "Am"A,3 | z3 |` },
  };

  // Kleiner ABC-Leser: Noten, Vorzeichen (auch aus der Tonart), Oktaven, Längen,
  // punktierte Paare (>), Pausen und Akkordnamen. Ergebnis in Sekunden.
  const TONART = { C: {}, G: { F: 1 }, D: { F: 1, C: 1 }, F: { B: -1 }, Am: {}, Em: { F: 1 }, Dm: { B: -1 } };
  const STUFE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function abcLesen(text) {
    const kopf = {}, noten = [], akkorde = [];
    const zeilen = text.split("\n");
    for (const z of zeilen) { const m = z.match(/^([A-Z]):\s*(.*)$/); if (m) kopf[m[1]] = m[2].trim(); }
    const [ln, ld] = (kopf.L || "1/8").split("/").map(Number);
    const [qn, qd, qbpm] = (kopf.Q || "1/4=100").match(/(\d+)\/(\d+)=(\d+)/).slice(1).map(Number);
    const proEinheit = (60 / qbpm) * ((ln / ld) / (qn / qd)); // Sekunden je L-Einheit
    const [mn, md] = (kopf.M || "4/4").split("/").map(Number);
    const vorz = TONART[kopf.K] || {};
    const koerper = zeilen.filter((z) => !/^[A-Z]:/.test(z)).join(" ");
    let t = 0, takt = {}, punkt = 0;
    const re = /"([^"]+)"|(\^\^|\^|__|_|=)?([A-Ga-gz])([',]*)(\d*)(\/?)(\d*)|(\|)|([<>])/g;
    let m;
    while ((m = re.exec(koerper))) {
      if (m[1]) { akkorde.push({ t, name: m[1] }); continue; }
      if (m[8]) { takt = {}; continue; }
      if (m[9]) { punkt = m[9] === ">" ? 1 : -1; const n = noten[noten.length - 1]; if (n) { const alt = n.l; n.l *= punkt > 0 ? 1.5 : 0.5; t += n.l - alt; } continue; }
      let l = m[5] ? Number(m[5]) : 1;
      if (m[6]) l /= m[7] ? Number(m[7]) : 2;
      if (punkt) { l *= punkt > 0 ? 0.5 : 1.5; punkt = 0; }
      if (m[3] === "z") { t += l; continue; }
      const gross = m[3].toUpperCase(), klein = m[3] !== gross;
      let midi = 60 + STUFE[gross] + (klein ? 12 : 0);
      for (const c of m[4]) midi += c === "'" ? 12 : -12;
      const akz = { "^": 1, "^^": 2, _: -1, __: -2, "=": 0 };
      if (m[2] !== undefined) takt[gross + m[4] + klein] = akz[m[2]];
      const a = takt[gross + m[4] + klein];
      midi += a !== undefined ? a : (vorz[gross] || 0);
      noten.push({ t, l, midi });
      t += l;
    }
    for (const n of noten) { n.t *= proEinheit; n.l *= proEinheit; }
    for (const k of akkorde) k.t *= proEinheit;
    const schlag = (60 / qbpm) * ((1 / md) / (qn / qd));
    return { noten, akkorde, laenge: t * proEinheit, schlag, proTakt: mn };
  }
  function akkordTone(name) {
    const m = name.match(/^([A-G])([#b]?)(m(?!aj)|dim)?(7)?/);
    if (!m) return null;
    const grund = STUFE[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
    const art = m[3] === "m" ? [0, 3, 7] : m[3] === "dim" ? [0, 3, 6] : [0, 4, 7];
    if (m[4]) art.push(m[3] === "dim" ? 9 : 10);
    return { grund, tone: art };
  }
  const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  // Klangfarben, alle aus einfachen Schwingern gebaut
  function note(a, ziel, instr, midi, t, dauer, laut) {
    const f = hz(midi), g = a.createGain();
    const os = (typ, mal, vol) => { const o = a.createOscillator(); o.type = typ; o.frequency.value = f * mal; const og = a.createGain(); og.gain.value = vol; o.connect(og).connect(g); o.start(t); o.stop(t + dauer + 0.8); return o; };
    if (instr === "klavier") { // Anschlag und Ausklingen, leicht verstimmt wie ein altes Klavier
      os("triangle", 1, 0.7); os("triangle", 1.003, 0.4); os("sine", 2, 0.15);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(laut, t + 0.008);
      g.gain.exponentialRampToValueAtTime(laut * 0.25, t + 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dauer + 0.5);
    } else if (instr === "akkordeon") { // zwei Zungen, leicht gegeneinander verstimmt
      const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200;
      const z = a.createGain(); z.connect(lp).connect(g);
      for (const [mal, vol] of [[1, 0.35], [1.006, 0.35]]) { const o = a.createOscillator(); o.type = "sawtooth"; o.frequency.value = f * mal; const og = a.createGain(); og.gain.value = vol; o.connect(og).connect(z); o.start(t); o.stop(t + dauer + 0.3); }
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(laut * 0.7, t + 0.03);
      g.gain.setValueAtTime(laut * 0.7, t + dauer * 0.85); g.gain.exponentialRampToValueAtTime(0.0001, t + dauer + 0.12);
    } else if (instr === "klarinette") { // hohl und weich
      const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1300;
      const z = a.createGain(); z.connect(lp).connect(g);
      const o = a.createOscillator(); o.type = "square"; o.frequency.value = f; o.connect(z); o.start(t); o.stop(t + dauer + 0.5);
      const vib = a.createOscillator(), vg = a.createGain(); vib.frequency.value = 5; vg.gain.value = f * 0.006;
      vib.connect(vg).connect(o.frequency); vib.start(t + 0.2); vib.stop(t + dauer + 0.5);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(laut * 0.5, t + 0.12);
      g.gain.setValueAtTime(laut * 0.5, t + dauer * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dauer + 0.35);
    } else if (instr === "tuba") { // runder, tiefer Bass
      const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 500;
      const z = a.createGain(); z.connect(lp).connect(g);
      for (const [typ, vol] of [["triangle", 0.8], ["sawtooth", 0.25]]) { const o = a.createOscillator(); o.type = typ; o.frequency.value = f; const og = a.createGain(); og.gain.value = vol; o.connect(og).connect(z); o.start(t); o.stop(t + dauer + 0.3); }
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(laut, t + 0.03);
      g.gain.exponentialRampToValueAtTime(laut * 0.4, t + dauer); g.gain.exponentialRampToValueAtTime(0.0001, t + dauer + 0.15);
    } else { // "flaeche": leise lange Akkorde
      os("triangle", 1, 0.5); os("sine", 0.5, 0.3);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(laut, t + 0.5);
      g.gain.setValueAtTime(laut, t + dauer * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + dauer + 0.6);
    }
    g.connect(ziel);
  }
  // Begleitung eines Durchgangs: aus den Akkordnamen Bass und Akkorde je Schlag
  function begleitung(stueck) {
    const { akkorde, laenge, schlag, proTakt } = stueck.daten, ev = [];
    let nr = 0;
    for (let t = 0; t < laenge - 0.001; t += schlag, nr++) {
      let akk = null;
      for (const k of akkorde) if (k.t <= t + 0.001) akk = k;
      const ton = akk && akkordTone(akk.name);
      if (!ton) continue;
      const imTakt = nr % proTakt, taktNr = Math.floor(nr / proTakt);
      if (stueck.stil === "wald") {
        if (imTakt === 0) for (const iv of ton.tone.slice(0, 3)) ev.push({ t, l: schlag * proTakt, midi: 48 + ((ton.grund + iv) % 12), instr: "flaeche", laut: 0.09 });
        continue;
      }
      if (imTakt === 0) { // Bass, abwechselnd Grundton und Quinte
        const bass = 36 + ((ton.grund + (taktNr % 2 ? 7 : 0)) % 12);
        ev.push({ t, l: schlag * 0.8, midi: bass, instr: "tuba", laut: 0.5 });
      } else { // Nachschlag: kurzer Akkord
        for (const iv of ton.tone) ev.push({ t, l: schlag * 0.35, midi: 55 + ((ton.grund + iv) % 12), instr: stueck.instr === "klavier" ? "klavier" : "akkordeon", laut: 0.12 });
      }
    }
    return ev;
  }
  for (const s of Object.values(STUECKE)) {
    s.daten = abcLesen(s.abc);
    s.ereignisse = [...s.daten.noten.map((n) => ({ ...n, instr: s.instr, laut: 0.4 })), ...begleitung(s)].sort((a, b) => a.t - b.t);
  }

  // Abspielen mit Vorausplanung: alle 80 ms werden die Noten der nächsten 0,3 s gesetzt
  // Aufnahmen (tools/musik.py, design/musik_daten.js) haben Vorrang vor den Noten
  const MUSIK_DATEN = window.MUSIK_DATEN || {};
  const aufnahmen = {}; // name: AudioBuffer | "laedt" | "fehlt"
  function aufnahme(a, name) {
    if (!MUSIK_DATEN[name]) return "fehlt";
    if (!aufnahmen[name]) {
      aufnahmen[name] = "laedt";
      try {
        const bin = atob(MUSIK_DATEN[name].split(",")[1]), bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const fertig = (buf) => { aufnahmen[name] = buf; }, fehler = () => { aufnahmen[name] = "fehlt"; };
        const p = a.decodeAudioData(bytes.buffer, fertig, fehler);
        if (p && p.then) p.then(fertig).catch(fehler);
      } catch { aufnahmen[name] = "fehlt"; }
    }
    return aufnahmen[name];
  }
  // Aufnahme in Schleife: jede Runde startet kurz vor dem Ende der letzten und blendet über
  const UEBERBLENDEN = 2;
  function aufnahmePlanen(a, buf) {
    if (laeuft.naechste === null) laeuft.naechste = a.currentTime + 0.1;
    if (laeuft.naechste > a.currentTime + 0.5) return;
    const t = laeuft.naechste, ende = t + buf.duration;
    const src = a.createBufferSource(), g = a.createGain();
    src.buffer = buf; src.connect(g).connect(laeuft.bus);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1, t + (laeuft.runde ? UEBERBLENDEN : 0.3));
    g.gain.setValueAtTime(1, ende - UEBERBLENDEN);
    g.gain.linearRampToValueAtTime(0.0001, ende);
    src.start(t); src.stop(ende + 0.05);
    laeuft.quellen = [...laeuft.quellen.slice(-2), src];
    laeuft.runde++;
    laeuft.naechste = ende - UEBERBLENDEN;
  }

  let laeuft = null, wunsch = null, uhr = null;
  function planen() {
    const a = audio;
    if (!a || a.state !== "running" || !laeuft) return;
    if (laeuft.aufnahme) {
      const buf = aufnahme(a, laeuft.name);
      if (buf instanceof AudioBuffer) return aufnahmePlanen(a, buf);
      if (buf === "laedt") return;
      laeuft.aufnahme = false; laeuft.start = a.currentTime + 0.1; // Aufnahme kaputt: Noten spielen
    }
    if (!STUECKE[laeuft.name]) return;
    const s = STUECKE[laeuft.name], bis = a.currentTime + 0.3;
    while (true) {
      const e = s.ereignisse[laeuft.i];
      if (!e) { laeuft.i = 0; laeuft.start += s.daten.laenge; continue; }
      const t = laeuft.start + e.t;
      if (t > bis) break;
      if (t >= a.currentTime - 0.02) note(a, laeuft.bus, e.instr, e.midi, t, e.l, e.laut);
      laeuft.i++;
    }
  }
  function musik(name) {
    wunsch = name;
    if (!ein.musik) name = null;
    if (laeuft && laeuft.name === name) return;
    const a = bereit();
    if (!a) return;
    if (laeuft) { // altes Stück ausblenden
      const { bus: alt, quellen } = laeuft;
      alt.gain.setTargetAtTime(0.0001, a.currentTime, 0.25);
      setTimeout(() => { for (const q of quellen) try { q.stop(); } catch { /* schon aus */ } alt.disconnect(); }, 1500);
      laeuft = null;
    }
    const hatAufnahme = name && aufnahme(a, name) !== "fehlt";
    if (!name || !(hatAufnahme || STUECKE[name])) return;
    const bus = a.createGain(); bus.gain.value = 0.0001; bus.connect(musikBus);
    bus.gain.setTargetAtTime(gedaempft ? 0.55 : 1, a.currentTime + 0.1, 0.4);
    laeuft = { name, bus, start: a.currentTime + 0.15, i: 0, aufnahme: hatAufnahme, naechste: null, runde: 0, quellen: [] };
    if (!uhr) uhr = setInterval(planen, 80);
  }
  // Während eines Gesprächs leiser, damit man das Gebrummel hört
  let gedaempft = false;
  function leise(an) {
    gedaempft = an;
    if (laeuft && audio) laeuft.bus.gain.setTargetAtTime(an ? 0.55 : 1, audio.currentTime, 0.3);
  }
  function schalte(was, an) {
    ein[was] = an;
    merk(was === "musik" ? "klapperkiste-musik" : "klapperkiste-ton", an ? "an" : "aus");
    if (was === "musik") { const w = wunsch; laeuft && musik(null); wunsch = w; if (an) musik(w); }
  }

  // Zum Testen: Ton ohne Lautsprecher berechnen (OfflineAudioContext) und als Zahlen zurückgeben
  async function probe(art, name, sekunden = 6) {
    const rate = 22050, a = new OfflineAudioContext(1, rate * sekunden, rate);
    const bus = busBauen(a, a.destination, art === "musik" ? 1 : 0.9, art === "musik" ? 6000 : 5000);
    if (art !== "musik") { // Silben im Offline-Kontext dekodieren und abwarten
      stimmeLaden(a);
      for (let k = 0; k < 50 && !(bank(a, "weiblich") && bank(a, "maennlich")); k++) await new Promise((ok) => setTimeout(ok, 50));
    }
    if (art === "musik") {
      for (const e of STUECKE[name].ereignisse) if (e.t < sekunden) note(a, bus, e.instr, e.midi, e.t + 0.05, e.l, e.laut);
    } else {
      const altA = audio, altL = laerm;
      laerm = a.createBuffer(1, rate, rate); const d = laerm.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      audio = a; letzteZeit = 0;
      // ein Satz: 12 Silben mit Pause in der Mitte, dann eine Frage
      const plan = [...Array(12)].map((_, k) => ({ t: 0.2 + k * 0.09 + (k > 5 ? 0.25 : 0), fortschritt: k / 11, betont: k === 0 }));
      for (let k = 0; k < 8; k++) plan.push({ t: 1.9 + k * 0.09, fortschritt: k / 7, frage: true, betont: k === 0 });
      for (const p of plan) {
        const orig = a.currentTime; // OfflineAudioContext: currentTime ist 0, Zeit über Versatz setzen
        Object.defineProperty(a, "currentTime", { value: p.t, configurable: true });
        silbe(name, p, a, bus);
        Object.defineProperty(a, "currentTime", { value: orig, configurable: true });
      }
      audio = altA; laerm = altL;
    }
    const puffer = await a.startRendering();
    return Array.from(puffer.getChannelData(0));
  }

  return {
    silbe, musik, leise, freischalten, probe, STUECKE,
    get an() { return ein; }, schalte,
    get laeuft() { return laeuft && { name: laeuft.name, aufnahme: laeuft.aufnahme, runde: laeuft.runde }; }, get silben() { return silbenZahl; },
  };
})();
