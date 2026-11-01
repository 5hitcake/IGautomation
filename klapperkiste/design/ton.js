// Ton: Musik und Geräusche (Motor, Hupe, Uhu, Grillen) im Browser (Web Audio), aus Aufnahmen
// oder selbst gespielt. Wird von karte.js genutzt (window.Ton). Die Figuren sprechen nicht
// (die Stimmen sind entfernt), Gespräche gibt es nur als Text.
window.Ton = (function () {
  let audio = null, laerm = null, musikBus = null;
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
  // Handy-Browser geben Ton nur frei, wenn er direkt in einer Berührung startet. Ein
  // Fingerdruck (pointerdown) zählt dafür noch nicht, erst das Loslassen (touchend,
  // pointerup, click). Musik, die vorher bestellt wurde, startet erst, wenn der Ton
  // wirklich läuft: Stücke, die im stummen Zustand angelegt wurden, blieben auf
  // manchen Handys still, bis man die Musik aus- und wieder einschaltete.
  const FREI = ["pointerdown", "pointerup", "touchend", "click", "keydown", "mousedown"];
  function freischalten() {
    const a = bereit();
    if (!a) return;
    try {
      const s = a.createBufferSource(); s.buffer = a.createBuffer(1, 1, 22050); s.connect(a.destination); s.start(0);
    } catch { /* egal */ }
    if (a.state === "running") {
      for (const ev of FREI) window.removeEventListener(ev, freischalten, true);
      laufenLassen();
    } else if (a.resume) {
      a.resume().then(laufenLassen).catch(() => { /* beim nächsten Tippen wieder */ });
    }
  }
  for (const ev of FREI) window.addEventListener(ev, freischalten, true);
  // Ton läuft (wieder): bestellte Musik jetzt wirklich starten
  function laufenLassen() {
    if (!audio || audio.state !== "running") return;
    if (!audio.wach) {
      audio.wach = performance.now();
      audio.addEventListener("statechange", () => { if (audio.state === "running") laufenLassen(); });
    }
    if (!laeuft) spielen(gespraechStueck || wunsch);
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
    // Nachts: langsames Schlaflied auf dem alten Klavier, darunter leise Flächen
    nacht: { stil: "wald", instr: "klavier", abc: `M:3/4
L:1/4
Q:1/4=58
K:F
"F"c2 A | F3 | "Bb"d2 B | F3 | "F"A2 c | "C7"G2 E | "F"F3 | z3 |
"Dm"A2 F | D3 | "Bb"B2 d | "C"c3 | "F"A2 F | "C7"G2 E | "F"F3 | z3 |` },
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
  // Aufnahmen (tools/musik.py, design/musik_daten.js) haben Vorrang vor den Noten.
  // Je Stück: { src, schleife: [Anfang, Ende] } – zwischen den beiden Stellen läuft es
  // nahtlos im Kreis, der Schluss (wird langsamer) fällt weg.
  const MUSIK_DATEN = window.MUSIK_DATEN || {};
  const aufnahmen = {}; // name: AudioBuffer | "laedt" | "fehlt"
  function aufnahme(a, name) {
    if (!MUSIK_DATEN[name]) return "fehlt";
    if (!aufnahmen[name]) {
      aufnahmen[name] = "laedt";
      try {
        const bin = atob(MUSIK_DATEN[name].src.split(",")[1]), bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const fertig = (buf) => { aufnahmen[name] = buf; }, fehler = () => { aufnahmen[name] = "fehlt"; };
        const p = a.decodeAudioData(bytes.buffer, fertig, fehler);
        if (p && p.then) p.then(fertig).catch(fehler);
      } catch { aufnahmen[name] = "fehlt"; }
    }
    return aufnahmen[name];
  }
  function aufnahmePlanen(a, buf) {
    if (laeuft.quellen.length) return;
    const src = a.createBufferSource(), [anfang, ende] = MUSIK_DATEN[laeuft.name].schleife;
    src.buffer = buf; src.loop = true; src.loopStart = anfang; src.loopEnd = Math.min(ende, buf.duration);
    src.connect(laeuft.bus); src.start(a.currentTime + 0.05);
    laeuft.quellen.push(src);
    laeuft.runde++;
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
  // Lautstärke je Lage: Gesprächsstück deutlich leiser, sonst im Gespräch etwas gedämpft
  const zielLaut = (name) => (name && name.startsWith("figur_") ? 0.3 : gedaempft ? 0.55 : 1);
  function spielen(name) {
    if (!ein.musik) name = null;
    if (laeuft && laeuft.name === name) return;
    // Noch kein Ton erlaubt: nur vormerken (wunsch), laufenLassen() startet es später
    if (!audio || audio.state !== "running") {
      if (laeuft) { for (const q of laeuft.quellen) try { q.stop(); } catch { /* schon aus */ } laeuft = null; }
      return;
    }
    const a = audio;
    if (laeuft) { // altes Stück ausblenden
      const { bus: alt, quellen } = laeuft;
      alt.gain.setTargetAtTime(0.0001, a.currentTime, 0.25);
      setTimeout(() => { for (const q of quellen) try { q.stop(); } catch { /* schon aus */ } alt.disconnect(); }, 1500);
      laeuft = null;
    }
    const hatAufnahme = name && aufnahme(a, name) !== "fehlt";
    if (!name || !(hatAufnahme || STUECKE[name])) return;
    const bus = a.createGain(); bus.gain.value = 0.0001; bus.connect(musikBus);
    bus.gain.setTargetAtTime(zielLaut(name), a.currentTime + 0.1, 0.4);
    laeuft = { name, bus, start: a.currentTime + 0.15, i: 0, aufnahme: hatAufnahme, runde: 0, quellen: [] };
    if (!uhr) uhr = setInterval(planen, 80);
  }
  // Musik für einen Ort; während eines Gesprächs mit eigenem Stück wird nur vorgemerkt
  let gespraechStueck = null;
  function musik(name) {
    wunsch = name;
    if (!gespraechStueck) spielen(name);
  }
  // Gespräch: hat die Figur ein eigenes Stück, läuft das leise, sonst wird die Musik gedämpft
  let gedaempft = false;
  function leise(an, figur) {
    gedaempft = an;
    const eigenes = an && figur && MUSIK_DATEN["figur_" + figur] ? "figur_" + figur : null;
    if (eigenes || gespraechStueck) {
      gespraechStueck = eigenes;
      spielen(eigenes || wunsch);
    }
    if (laeuft && audio) laeuft.bus.gain.setTargetAtTime(zielLaut(laeuft.name), audio.currentTime, 0.3);
  }
  function schalte(was, an) {
    ein[was] = an;
    merk(was === "musik" ? "klapperkiste-musik" : "klapperkiste-ton", an ? "an" : "aus");
    if (was === "musik") spielen(an ? gespraechStueck || wunsch : null);
  }

  // --- Geräusche ------------------------------------------------------------------
  // Motor: ein tiefer Sägezahn (Brummen) und Rauschen (Klappern), beides im Takt der
  // Zündungen zerhackt – das macht das „Tuck-tuck“. Schneller fahren und Gas geben
  // heben Takt, Tonhöhe und Helligkeit. Läuft mit dem Schalter für Stimmen (🔊).
  let motorTeile = null;
  function motorBauen(a, ziel) {
    const bus = a.createGain(); bus.gain.value = 0.0001; bus.connect(ziel);
    const takt = a.createGain(); takt.gain.value = 0.5; // wird vom Zündtakt auf und ab bewegt
    const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 350; lp.Q.value = 2;
    takt.connect(lp).connect(bus);
    const brumm = a.createOscillator(); brumm.type = "sawtooth"; brumm.frequency.value = 14;
    const bg = a.createGain(); bg.gain.value = 0.9; brumm.connect(bg).connect(takt);
    const klapper = a.createBufferSource(); klapper.buffer = laerm || a.createBuffer(1, a.sampleRate, a.sampleRate); klapper.loop = true;
    const kf = a.createBiquadFilter(); kf.type = "bandpass"; kf.frequency.value = 700; kf.Q.value = 1.2;
    const kg = a.createGain(); kg.gain.value = 0.35; klapper.connect(kf).connect(kg).connect(takt);
    const zuend = a.createOscillator(); zuend.type = "square"; zuend.frequency.value = 7;
    const zg = a.createGain(); zg.gain.value = 0.5; zuend.connect(zg).connect(takt.gain);
    for (const q of [brumm, klapper, zuend]) q.start();
    return { bus, lp, brumm, zuend, kf };
  }
  // zustand: null = aus, sonst { v: m/s, gas: true/false }
  function motor(zustand) {
    const a = audio;
    if (!a || a.state !== "running") return;
    if (!motorTeile) { if (!zustand || !ein.stimmen) return; motorTeile = motorBauen(a, a.destination); }
    const m = motorTeile, t = a.currentTime;
    if (!zustand || !ein.stimmen) { m.bus.gain.setTargetAtTime(0.0001, t, 0.15); return; }
    const v = Math.min(1, Math.abs(zustand.v) / 6.2), gas = zustand.gas ? 1 : 0;
    const f = 14 + v * 24 + gas * 4;
    m.brumm.frequency.setTargetAtTime(f, t, 0.12);
    m.zuend.frequency.setTargetAtTime(f / 2, t, 0.12);
    m.lp.frequency.setTargetAtTime(320 + v * 500 + gas * 250, t, 0.15);
    m.kf.frequency.setTargetAtTime(600 + v * 500, t, 0.2);
    m.bus.gain.setTargetAtTime(0.16 + v * 0.1 + gas * 0.05, t, 0.15);
  }
  // Spezialhupe: zwei schiefe Töne, die kurz ansteigen, mit Flattern – „Trööööt!“
  function hupe(a = ein.stimmen && bereit(), ziel = a && a.destination, ab = 0) {
    if (!a) return;
    const t = a.currentTime + 0.02 + ab, g = a.createGain(), lp = a.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 2400; g.connect(lp).connect(ziel);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.05);
    g.gain.setValueAtTime(0.22, t + 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    const flattern = a.createOscillator(), fg = a.createGain(); flattern.frequency.value = 9; fg.gain.value = 6;
    flattern.connect(fg);
    for (const f of [349, 440]) {
      const o = a.createOscillator(); o.type = "square";
      o.frequency.setValueAtTime(f * 0.92, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
      fg.connect(o.frequency); o.connect(g); o.start(t); o.stop(t + 1.05);
    }
    flattern.start(t); flattern.stop(t + 1.05);
  }

  // Uhu im nächtlichen Wald: ein kurzes „hu“ und ein langes, leicht fallendes „huuu“, mit Hall
  function uhu(a = ein.stimmen && bereit(), ziel = a && a.destination, ab = 0) {
    if (!a) return;
    const t0 = a.currentTime + 0.02 + ab, raus = a.createGain(), lp = a.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 900; raus.gain.value = 0.5;
    // Hall: kurzes Echo mit Rückkopplung, klingt nach Wald
    const echo = a.createDelay(1), rueck = a.createGain(); echo.delayTime.value = 0.23; rueck.gain.value = 0.32;
    lp.connect(raus).connect(ziel); lp.connect(echo); echo.connect(rueck).connect(echo); echo.connect(raus);
    const hoehe = 330 + Math.random() * 40; // jeder Uhu etwas anders
    for (const [start, dauer, f0, f1] of [[0, 0.22, 1.0, 0.97], [0.42, 0.75, 1.02, 0.9]]) {
      const t = t0 + start, o = a.createOscillator(), g = a.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(hoehe * f0, t); o.frequency.exponentialRampToValueAtTime(hoehe * f1, t + dauer);
      const vib = a.createOscillator(), vg = a.createGain(); vib.frequency.value = 6; vg.gain.value = 3; vib.connect(vg).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + Math.min(0.08, dauer * 0.4));
      g.gain.setValueAtTime(0.32, t + dauer * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dauer);
      o.connect(g).connect(lp); o.start(t); o.stop(t + dauer + 0.05); vib.start(t); vib.stop(t + dauer + 0.05);
    }
    setTimeout(() => { try { raus.disconnect(); echo.disconnect(); } catch { /* schon weg */ } }, (ab + 4) * 1000);
  }

  // Grillen: ganz leises Zirpen im Hintergrund. grillen(0 … 1) setzt die Stärke, 0 = still.
  // Drei Grillen zirpen jede in ihrem eigenen Takt: kurze Pulse eines hohen Tons.
  let grillenStaerke = 0, grillenUhr = null, grillenBus = null;
  const GRILLEN = [{ f: 4300, takt: 0.62, pulse: 3, naechst: 0 }, { f: 4700, takt: 0.81, pulse: 4, naechst: 0.3 }, { f: 3900, takt: 1.07, pulse: 3, naechst: 0.55 }];
  function grillenPlanen() {
    const a = ein.stimmen && bereit();
    if (!a || grillenStaerke <= 0) return;
    if (!grillenBus) { grillenBus = a.createGain(); grillenBus.gain.value = 0; grillenBus.connect(a.destination); }
    grillenBus.gain.setTargetAtTime(0.035 * grillenStaerke, a.currentTime, 0.5);
    for (const g of GRILLEN) {
      if (g.naechst < a.currentTime) g.naechst = a.currentTime + Math.random() * g.takt;
      while (g.naechst < a.currentTime + 0.4) {
        const t = g.naechst;
        if (Math.random() < 0.85) { // ab und zu macht eine Pause
          for (let i = 0; i < g.pulse; i++) {
            const o = a.createOscillator(), e = a.createGain(), ti = t + i * 0.032;
            o.type = "sine"; o.frequency.value = g.f * (1 + (Math.random() - 0.5) * 0.01);
            e.gain.setValueAtTime(0.0001, ti); e.gain.exponentialRampToValueAtTime(1, ti + 0.004); e.gain.exponentialRampToValueAtTime(0.0001, ti + 0.022);
            o.connect(e).connect(grillenBus); o.start(ti); o.stop(ti + 0.03);
          }
        }
        g.naechst += g.takt * (0.9 + Math.random() * 0.2);
      }
    }
  }
  function grillen(staerke) {
    grillenStaerke = Math.max(0, Math.min(1, staerke || 0));
    if (grillenStaerke > 0 && !grillenUhr) grillenUhr = setInterval(grillenPlanen, 150);
    if (grillenStaerke <= 0 && grillenBus && audio) grillenBus.gain.setTargetAtTime(0, audio.currentTime, 0.4);
  }

  // Zum Testen: Ton ohne Lautsprecher berechnen (OfflineAudioContext) und als Zahlen zurückgeben
  async function probe(art, name, sekunden = 6) {
    const rate = 22050, a = new OfflineAudioContext(1, rate * sekunden, rate);
    const bus = busBauen(a, a.destination, art === "musik" ? 1 : 0.9, art === "musik" ? 6000 : 2600);
    if (art === "hupe") hupe(a, bus, 0.2);
    else if (art === "motor") { // Leerlauf, Gas bis 22 km/h, rollen lassen, wieder Leerlauf
      const m = motorBauen(a, bus);
      for (let t = 0; t < sekunden; t += 0.1) {
        const v = t < 1.5 ? 0 : t < 5 ? (t - 1.5) / 3.5 : t < 8 ? 1 - (t - 5) / 4 : 0, gas = t >= 1.5 && t < 5 ? 1 : 0;
        const f = 14 + v * 24 + gas * 4;
        m.brumm.frequency.setTargetAtTime(f, t, 0.12); m.zuend.frequency.setTargetAtTime(f / 2, t, 0.12);
        m.lp.frequency.setTargetAtTime(320 + v * 500 + gas * 250, t, 0.15); m.kf.frequency.setTargetAtTime(600 + v * 500, t, 0.2);
        m.bus.gain.setTargetAtTime(0.16 + v * 0.1 + gas * 0.05, t, 0.15);
      }
    } else if (art === "musik") {
      for (const e of STUECKE[name].ereignisse) if (e.t < sekunden) note(a, bus, e.instr, e.midi, e.t + 0.05, e.l, e.laut);
    }
    const puffer = await a.startRendering();
    return Array.from(puffer.getChannelData(0));
  }

  return {
    musik, leise, motor, hupe, uhu, grillen, freischalten, probe, STUECKE,
    get an() { return ein; }, schalte,
    // Zeitpunkt, seit dem Ton erlaubt ist (0: noch nicht)
    get seit() { return (audio && audio.wach) || 0; },
    get laeuft() { return laeuft && { name: laeuft.name, aufnahme: laeuft.aufnahme, runde: laeuft.runde }; },
  };
})();
