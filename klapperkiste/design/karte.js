// Karte: Startgebiet, selbst fahrendes Auto, Nebel, Gespräche. Wird von
// kartenprobe.html und spielstart.html mit Karte(optionen) gestartet.
//
// Optionen (alle freiwillig):
//   offen:        IDs der Gebiete, die am Anfang aufgedeckt sind (sonst nur "start")
//   zielErlaubt:  (ziel) => bool, welche Ziele man gerade wählen darf
//   hatTeil:      (kategorie) => bool, z. B. "licht"
//   zurWerkstatt: wird bei Schnellreise und Ankunft an Opas Schuppen aufgerufen
//   unterwegs:    (ziel) => …, nach dem Wählen eines Ziels
//   nachKnut:     nach dem ersten Gespräch mit Knut
//   gekauft:      (teilId) => …, wenn bei Knut ein Teil gekauft wurde
//   belohnung:    (teilId) => …, wenn es für einen Auftrag ein Teil gibt
//   wetter:       festes Wetter am Anfang (z. B. "sonne" beim Spielstart), sonst wechselt es
//   wetterWahl:   Auswahlfeld fürs Wetter zeigen (zum Ausprobieren)
window.Karte = function (opt = {}) {
  const D = window.KARTE_DATEN;
  const $ = (id) => document.getElementById(id);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const W = 320; // Kartengröße in Metern (5 × 5 Abschnitte à 64 m)

  // --- Bilder laden --------------------------------------------------------
  const lade = (src) => { const im = new Image(); im.src = src; return im; };
  const BODEN = {}, OBJ = {};
  for (const [k, v] of Object.entries(D.boden)) BODEN[k] = { img: lade(v.bild), meter: v.meter };
  for (const [k, v] of Object.entries(D.objekte)) OBJ[k] = { img: lade(v.bild), b: v.breite, h: v.hoehe };
  const AUTOS = D.autos.map((a) => ({ ...a, img: lade(a.bild), achseImg: a.achse ? lade(a.achse) : null }));

  // Schatten je Objektart einmal vorberechnen (dunkle, weiche Silhouette)
  function schattenVon(o) {
    const pad = 12, w = o.img.naturalWidth, h = o.img.naturalHeight;
    const c = document.createElement("canvas");
    c.width = w + 2 * pad; c.height = h + 2 * pad;
    const x = c.getContext("2d");
    const s = document.createElement("canvas"); s.width = w; s.height = h;
    const sx = s.getContext("2d");
    sx.drawImage(o.img, 0, 0);
    sx.globalCompositeOperation = "source-in";
    sx.fillStyle = "rgb(15,30,10)"; sx.fillRect(0, 0, w, h);
    x.globalAlpha = 0.07;
    for (let dx = -6; dx <= 6; dx += 3) for (let dy = -6; dy <= 6; dy += 3) x.drawImage(s, pad + dx, pad + dy);
    o.schatten = c; o.pad = pad;
  }

  // --- Zufall mit festem Startwert, damit die Karte immer gleich ist --------
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

  // --- Karte -----------------------------------------------------------------
  // Opas Schuppen: Bild 14 m breit, linke obere Ecke bei (X, Y). Maße aus dem Bild vermessen.
  const SCHUPPEN = { X: 143.2, Y: 230, haus: [144.9, 231.1, 155.5, 238.9], bereich: [143, 230, 158, 252] };
  // Hütte am Feldrand: Bild 11 m breit, Mitte bei (x, y), Tür nach Süden zum Weg. Haus = Dach und Veranda.
  // Bauernhof: Bild 32 m breit, linke obere Ecke bei (X, Y), Hoftor unten in der Mitte.
  // Häuser: Wohnhaus (L-Form als zwei Rechtecke) und Scheune, aus dem Bild vermessen.
  // Försterhütte im dunklen Wald: Bild 14 m breit, Mitte bei (x, y), Pfad unten zum Waldweg.
  // Dach und Laterne aus dem Bild vermessen.
  const FOERSTER = { x: 36, y: 186, haus: [32.4, 178.4, 39.7, 184.3], bereich: [29, 175.6, 43, 196.4], laterne: [41, 185.5] };
  // Dunkler Wald im Westen: Kreise (x, y, r), zusammen die Waldfläche. Hier liegt überall
  // das Walddach; nur auf Waldweg, Pfad und Lichtung bei der Försterhütte ist es dunkel.
  const WALD = [[50, 205, 50], [22, 175, 32], [70, 235, 30], [35, 238, 30], [80, 190, 26]];
  const WALD_EINGANG = 102; // hier beginnt die Dunkelheit auf dem Waldweg (Hindernis Licht)
  const imWald = (x, y, rand = 0) => WALD.some(([wx, wy, wr]) => Math.hypot(x - wx, y - wy) < wr + rand);
  const HOF = { X: 260, Y: 141.25, haeuser: [[261.3, 141.25, 275.5, 149.3], [261.3, 141.25, 269.7, 156.2],
    [276.4, 141.25, 290.6, 148.9]], bereich: [260, 141, 292, 159.5] };
  const HUETTE = { x: 244, y: 168, haus: [241.4, 164.1, 246.7, 170.9], bereich: [238.5, 163.4, 249.5, 172.6] };
  // Schrottplatz: Bild 26 m breit, Tor unten mittig bei (230, 50). Zaun und Hindernisse in Bildpixeln
  // des Ausschnitts (776 px breit) vermessen und hier in Meter umgerechnet.
  const SCHROTT = (() => {
    const k = 26 / 776, X = 230 - 388 * k, Y = 50 - 907 * k;
    const p = ([x, y]) => [X + (x - 7) * k, Y + (y - 53) * k];
    const zaun = [[335, 950], [215, 930], [110, 880], [35, 760], [25, 560], [45, 330], [110, 160], [220, 85],
      [390, 70], [560, 85], [680, 160], [740, 330], [765, 560], [755, 760], [690, 880], [580, 930], [455, 955]].map(p);
    const kreise = [[310, 250, 80], [415, 375, 30], [600, 240, 110], [515, 680, 85], [575, 745, 25], [165, 265, 55],
      [140, 355, 60], [125, 445, 65], [105, 545, 50], [120, 625, 55], [115, 715, 55], [160, 790, 55], [655, 420, 65],
      [665, 525, 65], [690, 740, 40], [560, 830, 30]].map(([x, y, r]) => [...p([x, y]), r * k]);
    return { X, Y, k, zaun, kreise, mitte: p([395, 520]), tor: [230, 50], b: 26, h: 1115 * k };
  })();
  function imSchrottplatz(x, y) {
    const z = SCHROTT.zaun;
    let drin = false;
    for (let i = 0, j = z.length - 1; i < z.length; j = i++) {
      if ((z[i][1] > y) !== (z[j][1] > y) && x < (z[j][0] - z[i][0]) * (y - z[i][1]) / (z[j][1] - z[i][1]) + z[i][0]) drin = !drin;
    }
    return drin;
  }
  const WEG = [[150, 251], [150, 292], [168, 304], [192, 298], [203, 272], [198, 244], [186, 220], [180, 196],
    [188, 170], [212, 140], [214, 108], [222, 78], [230, 60], [230, 50]];
  const ABZWEIG = [[181, 204], [130, 202], [96, 210], [60, 214]]; // in den Wald, endet vorerst am Zaun
  const FELDRAND = [[188, 170], [214, 173], [240, 177]]; // Stichweg nach Osten, endet am Feld
  // Weideweg: von der Kurve südlich der Weide um die Weide herum bis zum Feldrand (Rundweg)
  // Mit Abstand um die Zaunecken der Weide (214/282, 284) herum, sonst bleibt das Auto daran hängen
  const WEIDEWEG = [[203, 272], [206, 290], [230, 296], [270, 298], [292, 290], [298, 270], [300, 230], [292, 200],
    [262, 190], [240, 177]];
  const HOFWEG = [[276, 194.7], [276, 161]]; // Zufahrt vom Weideweg zum Hoftor
  // Feldweg: vom Weideweg nach Norden zu den Feldern. Hier steht Hildes Schafherde im Weg.
  const FELDERWEG = [[296, 215], [306, 190], [309, 160], [307, 120], [300, 85]];
  const WALDPFAD = [[60, 214], [45, 212], [37.5, 205], [36, 196]]; // durchs Tor zur Försterhütte
  const WEGE = [WEG, ABZWEIG, FELDRAND, WEIDEWEG, HOFWEG, FELDERWEG, WALDPFAD];
  const WEG_BREITE = 4.5;

  function abstandStrecke(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
  }
  function abstandWeg(px, py) {
    let m = Infinity;
    for (const w of WEGE) for (let i = 1; i < w.length; i++) m = Math.min(m, abstandStrecke(px, py, w[i - 1], w[i]));
    return m;
  }
  function frei(x, y, r) {
    if (abstandWeg(x, y) < WEG_BREITE / 2 + r + 1.5) return false;
    for (const [bx0, by0, bx1, by1] of [SCHUPPEN.bereich, HUETTE.bereich, HOF.bereich, FOERSTER.bereich]) {
      if (x > bx0 - r - 3 && x < bx1 + r + 3 && y > by0 - r - 3 && y < by1 + r + 3) return false;
    }
    if (x > SCHROTT.X - r - 3 && x < SCHROTT.X + SCHROTT.b + r + 3 && y > SCHROTT.Y - r - 3 && y < SCHROTT.Y + SCHROTT.h + r) return false;
    return !OBJEKTE.some((o) => o.r && Math.hypot(o.x - x, o.y - y) < o.r + r + 0.6);
  }

  const OBJEKTE = []; // {art, x, y, rot, s, spiegel, r (Kollision)}
  const NADELWALD = [[0, 100, 125, 255], [245, 75, 320, 205], [0, 250, 135, 320]]; // wie die Nadelbaum-Flächen unten
  function setze(art, x, y, opt = {}) {
    // In den Nadelwäldern stechen helle Laubbäume heraus: dort wird ein Nadelbaum daraus
    if (art === "laubbaum" && NADELWALD.some(([x0, y0, x1, y1]) => x > x0 && x < x1 && y > y0 && y < y1)) art = "nadelbaum";
    const o = OBJ[art], s = opt.s ?? 0.85 + rnd() * 0.3;
    const r = opt.r ?? (art === "felsbrocken" ? 0.42 : art === "busch" ? 0.4 : 0.3) * o.b * s;
    if (!opt.fest && !frei(x, y, r)) return false;
    OBJEKTE.push({ art, x, y, rot: opt.rot ?? (rnd() - 0.5) * 0.7, s, spiegel: opt.spiegel ?? rnd() < 0.5, r: opt.ohne ? 0 : r });
    return true;
  }
  function streue(art, anzahl, x0, y0, x1, y1) {
    for (let i = 0, n = 0; i < anzahl * 8 && n < anzahl; i++) if (setze(art, x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0))) n++;
  }
  const ZAEUNE = []; // Strecken für die Kollision
  function zaun(punkte) {
    for (let i = 1; i < punkte.length; i++) {
      const [ax, ay] = punkte[i - 1], [bx, by] = punkte[i];
      const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(len / 3.64)), rot = Math.atan2(by - ay, bx - ax);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        setze("zaun", ax + (bx - ax) * t, ay + (by - ay) * t, { fest: true, ohne: true, rot, s: len / n / 3.64 * 0.98, spiegel: false });
      }
      ZAEUNE.push([[ax, ay], [bx, by]]);
    }
  }

  function karteBauen() {
    // Weide mit Zaun östlich des Wegs, der Abzweig endet am geschlossenen Gatter
    zaun([[214, 206], [282, 206], [282, 284], [214, 284], [214, 212]]);
    zaun([[56, 202], [56, 209]]); zaun([[56, 219], [56, 226]]); // offenes Tor zum Wald
    setze("schild", 176, 210, { fest: true, rot: 0.1, s: 1, spiegel: false, r: 0.5 });
    // Hofzaun des Schuppens nur als Kollision, das Bild zeigt ihn schon
    for (let i = 1; i < SCHROTT.zaun.length; i++) ZAEUNE.push([SCHROTT.zaun[i - 1], SCHROTT.zaun[i]]);
    for (const [x, y, r] of SCHROTT.kreise) OBJEKTE.push({ art: null, x, y, r });
    ZAEUNE.push([[144.1, 234], [144.1, 246.4]], [[156.4, 234], [156.4, 246.4]],
      [[144.1, 246.4], [148.3, 246.4]], [[151.6, 246.4], [156.4, 246.4]]);
    // Wald im Westen, lichter Mischwald im Norden, Einzelbäume
    streue("nadelbaum", 140, 6, 100, 120, 250);
    streue("laubbaum", 30, 10, 110, 120, 250);
    streue("laubbaum", 40, 6, 6, 200, 100);
    streue("nadelbaum", 40, 250, 80, 314, 200);
    streue("laubbaum", 18, 100, 306, 314, 318);
    streue("laubbaum", 12, 170, 120, 250, 200);
    streue("nadelbaum", 20, 10, 255, 130, 316);
    // Büsche und Felsen am Wegrand
    for (const w of WEGE) for (let i = 1; i < w.length; i++) for (let t = 0; t < 1; t += 0.2) {
      const x = w[i - 1][0] + (w[i][0] - w[i - 1][0]) * t, y = w[i - 1][1] + (w[i][1] - w[i - 1][1]) * t;
      const seite = rnd() < 0.5 ? -1 : 1, d = 4.2 + rnd() * 4;
      const nx = -(w[i][1] - w[i - 1][1]), ny = w[i][0] - w[i - 1][0], nl = Math.hypot(nx, ny);
      if (rnd() < 0.55) setze(rnd() < 0.7 ? "busch" : "felsbrocken", x + nx / nl * d * seite, y + ny / nl * d * seite);
    }
    streue("felsbrocken", 20, 180, 10, 314, 120);
    streue("busch", 30, 130, 120, 260, 300);
    // Dichter dunkler Wald: viele Nadelbäume und einige Laubbäume, nur in der Waldfläche
    for (let i = 0, n = 0; i < 2000 && n < 170; i++) {
      const x = rnd() * 110, y = 140 + rnd() * 130;
      if (imWald(x, y, -3) && setze("nadelbaum", x, y)) n++;
    }
    // Helle Laubbäume und Büsche passen nicht in den dunklen Nadelwald
    for (let k = OBJEKTE.length - 1; k >= 0; k--) {
      const o = OBJEKTE[k];
      if ((o.art === "laubbaum" || o.art === "busch") && imWald(o.x, o.y, -4)) OBJEKTE.splice(k, 1);
    }
    OBJEKTE.sort((a, b) => a.y - b.y);
  }

  // Blumenwiesen-Flecken (Gras mit Blumen) über dem ruhigen Gras
  const FLECKEN = [];
  for (let i = 0; i < 40; i++) FLECKEN.push([rnd() * W, rnd() * W, 6 + rnd() * 14]);

  // --- Zustand ---------------------------------------------------------------
  // #schrottplatz in der Adresse: direkt vor dem Tor starten (zum Testen)
  const START = location.hash === "#schrottplatz" ? { x: 230, y: 66, a: -Math.PI / 2 } : { x: 150, y: 242.6, a: Math.PI / 2 };
  const auto = { ...START, v: 0, wackel: 0 };
  let autoWahl = AUTOS[0];
  const taste = { gas: false, bremse: false, links: false, rechts: false };
  let start = null, fertig = false, rumms = 0, besucht = false;

  function neu() {
    Object.assign(auto, { ...START, v: 0 });
    route = null;
    gebieteStart();
    Object.assign(spiel, { auftrag: null, geld: 0, beutel: 0, gekauft: new Set(), teile: new Set(), hilde: null });
    hinweisGezeigt = false; angehalten = false; moosKennt = false;
    for (const h of HINDERNISSE) h.weg = false;
    herdeSetzen();
    for (const r of SAMMEL) r.weg = false;
    hudNeu(); $("laden").hidden = true;
    nebelNeu();
    start = null; fertig = false; besucht = false; $("auftrag").hidden = true; $("ziel").hidden = true; $("gespraech").hidden = true; $("meldung").hidden = true; karteZu();
  }

  // --- Physik ----------------------------------------------------------------
  const L = 2.4;              // Radstand in Metern
  const LENK = 0.55;          // größter Lenkeinschlag
  let lenk = 0;

  function untergrund(x, y) {
    if (imSchrottplatz(x, y)) return { name: "Schrottplatz", f: 0.85 };
    const [hx0, hy0, hx1, hy1] = SCHUPPEN.bereich;
    if (x > hx0 && x < hx1 && y > hy0 && y < hy1) return { name: "Opas Hof", f: 0.7 };
    if (abstandWeg(x, y) < WEG_BREITE / 2 + 0.2) return { name: "Feldweg", f: 1 };
    return { name: "Wiese", f: 0.55 };
  }

  function schritt(dt) {
    const u = untergrund(auto.x, auto.y);
    const vmax = 6.2 * u.f; // 22 km/h auf dem Feldweg
    const ctl = steuerAuto(dt) || { gas: taste.gas, bremse: taste.bremse, lenk: (taste.rechts ? 1 : 0) - (taste.links ? 1 : 0) };
    let acc = 0;
    if (ctl.gas) acc = auto.v < 0 ? 7 : 3.2;
    if (ctl.bremse) acc = auto.v > 0.2 ? -7 : -2.2;
    auto.v += acc * dt;
    if (!ctl.gas && !ctl.bremse) auto.v -= Math.sign(auto.v) * Math.min(Math.abs(auto.v), 1.6 * dt);
    if (auto.v > vmax) auto.v = Math.max(vmax, auto.v - 5 * dt);
    auto.v = Math.max(-2.2, auto.v);
    const ziel = ctl.lenk;
    lenk += (ziel * LENK - lenk) * Math.min(1, dt * 6);
    auto.a += auto.v * Math.tan(lenk) / L * dt;
    auto.x += Math.cos(auto.a) * auto.v * dt;
    auto.y += Math.sin(auto.a) * auto.v * dt;
    if (u.name === "Wiese" && Math.abs(auto.v) > 0.5) auto.wackel = (Math.random() - 0.5) * 0.06;
    else auto.wackel = 0;
    stoss();
    auto.x = Math.max(2, Math.min(W - 2, auto.x));
    auto.y = Math.max(2, Math.min(W - 2, auto.y));
    if (Math.abs(auto.v) > 0.3 && start === null) start = performance.now();
    for (const st of STUECKE) if (!st.genommen && Math.hypot(st.x - auto.x, st.y - auto.y) < 2.4) stueckFinden(st);
    reifenPruefen();
    if (!fertig && !besucht && imSchrottplatz(auto.x, auto.y) && auto.y < SCHROTT.tor[1] - 5) ankunft(); // nur beim Testen per Tastatur
  }

  // Auto als zwei Kreise (vorne, hinten) gegen Bäume, Felsen, Schuppen und Zäune
  function stoss() {
    const r = 0.85;
    let getroffen = false;
    for (const s of [1.1, -1.1]) {
      let cx = auto.x + Math.cos(auto.a) * s, cy = auto.y + Math.sin(auto.a) * s;
      const schieb = (nx, ny, tief) => { auto.x += nx * tief; auto.y += ny * tief; cx += nx * tief; cy += ny * tief; getroffen = true; };
      for (const o of OBJEKTE) {
        if (!o.r || Math.abs(o.x - cx) > 6 || Math.abs(o.y - cy) > 6) continue;
        const d = Math.hypot(cx - o.x, cy - o.y), tief = o.r + r - d;
        if (tief > 0 && d > 0) schieb((cx - o.x) / d, (cy - o.y) / d, tief);
      }
      for (const [a, b] of ZAEUNE) {
        const d = abstandStrecke(cx, cy, a, b), tief = 0.35 + r - d;
        if (tief <= 0) continue;
        const dx = b[0] - a[0], dy = b[1] - a[1], ll = Math.hypot(dx, dy);
        let nx = -dy / ll, ny = dx / ll;
        if ((cx - a[0]) * nx + (cy - a[1]) * ny < 0) { nx = -nx; ny = -ny; }
        schieb(nx, ny, tief);
      }
      for (const [sx0, sy0, sx1, sy1] of [SCHUPPEN.haus, HUETTE.haus, FOERSTER.haus, ...HOF.haeuser]) {
        const hx = Math.max(sx0, Math.min(cx, sx1)), hy = Math.max(sy0, Math.min(cy, sy1));
        const d = Math.hypot(cx - hx, cy - hy);
        if (d < r && d > 0) schieb((cx - hx) / d, (cy - hy) / d, r - d);
      }
    }
    if (getroffen) {
      if (Math.abs(auto.v) > 1.5 && performance.now() - rumms > 600) { rumms = performance.now(); if (navigator.vibrate) { try { navigator.vibrate(40); } catch { /* egal */ } } }
      auto.v *= Math.abs(auto.v) > 1 ? -0.25 : 0.5;
    }
  }

  function ankunft() {
    fertig = true; besucht = true; route = null;
    const s = start ? (performance.now() - start) / 1000 : 0;
    const zeit = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    const wie = s > 1 ? `bis hierher, in ${zeit} Minuten? Respekt.` : "bis hierher? Respekt.";
    gespraech("knut", "Knut Kurbel", "schrottplatz", [
      ["hallo", `Na sieh mal einer an! Mit der Klapperkiste ${wie} Ich bin Knut Kurbel, mir gehört der ganze Schrott hier.`],
      ["nachdenken", "Hm … ohne Karosserie fährst du ja praktisch im Unterhemd durch die Gegend. Und die Reifen sind auch nicht mehr die jüngsten."],
      ["auftrag", "Pass auf: Draußen am Feldrand liegen drei alte Reifen herum. Bring sie mir, dann suche ich dir was Ordentliches aus dem Schrott raus."],
      ["juhu", "Abgemacht? Prima! Dann ab mit dir, der Schrott wartet nicht!"],
    ], () => {
      spiel.auftrag = "reifen";
      hudNeu();
      fertig = false;
      if (opt.nachKnut) opt.nachKnut();
    });
  }

  // --- Auftrag, Beutel, Geld und Knuts Laden ----------------------------------
  // Die alten Reifen liegen erst da, wenn Knut den Auftrag gegeben hat, etwas
  // abseits der Wege. Man tippt sie an, wenn das Auto nah und langsam genug ist;
  // sie kommen in den Beutel, nicht ins Auto.
  const SAMMEL = [
    { art: "reifen", auftrag: "reifen", x: 228, y: 180.5 },
    { art: "reifen", auftrag: "reifen", x: 117, y: 200 },
    { art: "reifen", auftrag: "reifen", x: 304, y: 250 },
    { art: "batterie", auftrag: "batterie", x: 285, y: 193.5 },
  ];
  const REIFEN = SAMMEL.filter((g) => g.art === "reifen");
  const BRAUCHT = { reifen: 3, batterie: 1 }; // so viele Gegenstände je Auftrag
  const sichtbar = (g) => !g.weg && spiel.auftrag === g.auftrag;
  const REICH = 8;      // so nah muss das Auto sein (Meter)
  const LANGSAM = 3.5;  // höchstens so schnell (m/s, etwa 12 km/h)
  let hinweisGezeigt = false;
  const LADEN = [
    { id: "rundling_hinten", name: "Rundling hinten", preis: 25 },
    { id: "rundling_mitte", name: "Rundling Mitte", preis: 35 },
    { id: "rundling_vorne", name: "Rundling vorne", preis: 30 },
    // Lieferung nach dem Batterie-Auftrag
    { id: "spezialhupe", name: "Spezialhupe", preis: 25, ab: () => spiel.auftrag === "erledigt" },
  ];
  // auftrag: null | "reifen" | "batterie" | "erledigt"; teile: Belohnungen (für die Kartenprobe ohne Werkstatt)
  const spiel = { auftrag: null, geld: 0, beutel: 0, gekauft: new Set(), teile: new Set(), hilde: null };
  function hudNeu() {
    const a = $("auftrag"), n = BRAUCHT[spiel.auftrag], zeilen = [];
    if (n) zeilen.push(`📋 ${spiel.auftrag === "reifen" ? "Alte Reifen" : "Alte Batterie"} für Knut · ${spiel.beutel}/${n}`);
    if (spiel.hilde === "auftrag") zeilen.push("📋 Hildes Schafe vom Feldweg scheuchen");
    if (spiel.hilde === "frei") zeilen.push("📋 Zurück zu Hilde");
    a.hidden = !zeilen.length;
    a.textContent = zeilen.join("\n");
    $("geld").textContent = `🪙 ${spiel.geld}`;
    $("geld").title = `${spiel.geld} Münzen`;
    $("geld").hidden = spiel.auftrag === null;
  }
  // Beim ersten Reifen in Sichtweite erklären, wie das Aufsammeln geht
  function reifenPruefen() {
    if (!BRAUCHT[spiel.auftrag] || hinweisGezeigt) return;
    if (SAMMEL.some((g) => sichtbar(g) && Math.hypot(g.x - auto.x, g.y - auto.y) < 16)) {
      hinweisGezeigt = true;
      toast("👆 Gegenstand berühren, um ihn aufzusammeln. Fährst du zu schnell, erst „Stopp“ drücken.", 6000);
    }
  }
  function aufsammeln(r) {
    if (Math.hypot(r.x - auto.x, r.y - auto.y) > REICH) return toast("Zu weit weg. Fahr näher heran.");
    if (Math.abs(auto.v) > LANGSAM) { $("stopp").classList.add("tipp"); return toast("Zu schnell! Drück „Stopp“ oder fahr langsam vorbei."); }
    r.weg = true; spiel.beutel++;
    $("stopp").classList.remove("tipp");
    if (r.art === "batterie") toast("Alte Autobatterie eingesammelt! Ab zu Knut damit.");
    else toast(spiel.beutel < 3 ? `Alter Reifen eingesammelt (${spiel.beutel}/3). Ab in den Beutel!` : "Alle 3 Reifen im Beutel! Zurück zu Knut.");
    if (navigator.vibrate) { try { navigator.vibrate(30); } catch { /* egal */ } }
    hudNeu();
  }
  // Antippen auf der Karte: Bildschirm- in Kartenpunkt umrechnen, Reifen in der Nähe suchen
  function tippKarte(e) {
    if (!kamera || !BRAUCHT[spiel.auftrag]) return;
    const b = cv.getBoundingClientRect();
    const x = kamera.kx + (e.clientX - b.left - b.width / 2) / kamera.m;
    const y = kamera.ky + (e.clientY - b.top - b.height / 2) / kamera.m;
    const r = SAMMEL.find((q) => sichtbar(q) && Math.hypot(q.x - x, q.y - y) < 2);
    if (r) aufsammeln(r);
  }
  // Wieder am Schrottplatz: Reifen abgeben oder im Laden stöbern
  // Bäuerin Hilde: Ihre Schafherde steht auf dem Feldweg hinter dem Hof. Mit der
  // Spezialhupe (gibt es bei Knut) scheucht man sie weg, Hilde belohnt mit einem
  // Karosserie-Teil. spiel.hilde: null | "auftrag" | "frei" (Schafe weg) | "erledigt"
  function beiHilde() {
    const hilde = (zeilen, danach) => gespraech("hilde", "Bäuerin Hilde", "bauernhof", zeilen, danach);
    if (!spiel.hilde) {
      return hilde([
        ["hallo", "Ja grüß dich! Ein Besuch auf dem Hof, wie schön. Ich bin Hilde, mir gehören die Weide, die Schafe und die Kühe da drüben."],
        ["nachdenken", "Nur meine Schafe machen mir Sorgen: Die stehen hinter dem Hof mitten auf dem Feldweg und rühren sich keinen Zentimeter."],
        ["auftrag", "Kannst du sie mir vom Weg scheuchen? Ich zeichne dir den Feldweg auf deiner Karte ein. Aber Vorsicht: Rufen hilft da nix, die hören nur auf eine richtig laute Hupe!"],
        ["juhu", "Wenn der Weg frei ist, hab ich was Schönes für dich. Und frische Milch gibt's sowieso!"],
      ], () => {
        spiel.hilde = "auftrag"; hudNeu();
        const g = GEBIETE.find((q) => q.id === "felder");
        if (!g.offen) { g.offen = true; nebelNeu(); toast("Neu auf der Karte: der Feldweg zu den Feldern"); }
      });
    }
    if (spiel.hilde === "auftrag") {
      return hilde([["nachdenken", hatTeil("hupe")
        ? "Du hast eine Hupe? Prima! Dann ab zum Feldweg hinter dem Hof und kräftig drauf!"
        : "Die Schafe stehen immer noch auf dem Feldweg. Ohne eine richtig laute Hupe wird das nix. Frag doch mal Knut auf dem Schrottplatz."]]);
    }
    if (spiel.hilde === "frei") {
      spiel.hilde = "erledigt"; spiel.geld += 30; spiel.teile.add("pickup_hinten"); hudNeu();
      if (opt.belohnung) opt.belohnung("pickup_hinten");
      return hilde([
        ["juhu", "Der Weg ist frei! Ich hab's bis hierher tröten hören, die Schafe sind jetzt auf der Wiese. Danke dir!"],
        ["auftrag", "Hier, 30 Münzen. Und nimm das hier mit: das Heck von unserem alten Pick-up. Der Rest davon steht noch irgendwo herum."],
      ], () => toast("Pick-up hinten erhalten! Liegt in Opas Werkstatt im Regal.", 4500));
    }
    hilde([["hallo", "Schön, dich zu sehen! Die Schafe sind brav auf der Wiese geblieben. Komm ruhig wieder vorbei!"]]);
  }
  // Hupen vor der Herde: Schafe stieben auseinander, danach fährt das Auto weiter zum Ziel
  // Förster Moos in der Försterhütte: vorerst Begrüßung, sein Auftrag kommt noch
  let moosKennt = false;
  function beiMoos() {
    const moos = (zeilen) => gespraech("moos", "Förster Moos", "foersterhuette", zeilen);
    if (moosKennt) {
      return moos([["nachdenken", "Na, wieder im Wald unterwegs? Ich grüble noch, wobei du mir helfen könntest. Komm bald wieder!"]]);
    }
    moosKennt = true;
    moos([
      ["hallo", "Na so was, Besuch mitten im dunklen Wald! Ich bin Förster Moos. Das Piepsen? Das ist Pieps, der wohnt in meinem Bart."],
      ["nachdenken", "Ohne Licht hätte dich der Wald glatt verschluckt. Gut, dass dir einer einen Scheinwerfer eingebaut hat."],
      ["auftrag", "Ich hätte da bestimmt was für dich zu tun. Aber erst muss ich in Ruhe nachdenken, was genau. Schau bald wieder vorbei!"],
      ["juhu", "Und fahr vorsichtig, hier laufen nachts die Hasen über den Weg!"],
    ]);
  }
  function hupenBei(h) {
    h.weg = true;
    $("meldung").hidden = true;
    toast("📯 TRÖÖÖT! Die Schafe springen zur Seite.");
    if (navigator.vibrate) { try { navigator.vibrate([60, 40, 120]); } catch { /* egal */ } }
    for (const sf of HERDE) {
      const seite = sf.x < h.x ? -1 : 1;
      Object.assign(sf, { flucht: true, zx: h.x + seite * zufall(9, 15), zy: sf.y + zufall(-6, 6) });
    }
    if (spiel.hilde === "auftrag") { spiel.hilde = "frei"; hudNeu(); }
    const ziel = zielWahl;
    setTimeout(() => { if (ziel && !route) planen(ziel); }, 1500);
  }

  function beiKnut() {
    const knut = (zeilen, danach) => gespraech("knut", "Knut Kurbel", "schrottplatz", zeilen, danach);
    const n = BRAUCHT[spiel.auftrag];
    if (n && spiel.beutel < n) {
      if (spiel.auftrag === "batterie") {
        return knut([["nachdenken", "Die Batterie? Die liegt irgendwo drüben am Weideweg, ganz im Osten. Ohne Strom bleibt der Scheinwerfer dunkel."]]);
      }
      const f = n - spiel.beutel;
      return knut([["nachdenken", `Hm, da fehl${f === 1 ? "t noch ein Reifen" : `en noch ${f} Reifen`}. Schau mal am Feldrand, am Weg in den Wald und drüben am Weideweg.`]]);
    }
    if (spiel.auftrag === "reifen") {
      spiel.auftrag = "batterie"; spiel.beutel = 0; spiel.geld += 40; hudNeu();
      const weideZu = !GEBIETE.find((g) => g.id === "weide").offen;
      return knut([
        ["juhu", "Drei Reifen, wie bestellt! Die kommen gleich auf meinen Turm da hinten."],
        ["auftrag", "Hier, 40 Münzen für dich. Schau dich ruhig in meinem Laden um."],
        ["nachdenken", "Ach, und noch was: Ich hab hier einen alten Scheinwerfer liegen. Aber ohne Strom bringt der nix."],
        ["auftrag", "Am Weideweg im Osten soll eine alte Autobatterie liegen. Bring sie mir, dann gehört der Scheinwerfer dir!" +
          (weideZu ? " Den Weg dorthin zeigt dir bestimmt ein Kartenstück am Feldrand." : "")],
      ], ladenAuf);
    }
    if (spiel.auftrag === "batterie") {
      spiel.auftrag = "erledigt"; spiel.beutel = 0; spiel.geld += 15; spiel.teile.add("scheinwerfer"); hudNeu();
      if (opt.belohnung) opt.belohnung("scheinwerfer");
      return knut([
        ["juhu", "Die Batterie hat ja noch ordentlich Saft! Und 15 Münzen obendrauf, weil du so fix warst."],
        ["auftrag", "Hier, der Scheinwerfer gehört dir. Lass ihn dir von Opa einbauen, dann siehst du auch im dunklen Wald was."],
        ["nachdenken", "Ach, und gerade kam eine Lieferung rein: eine Spezialhupe, laut wie ein Nebelhorn. Steht jetzt im Laden."],
      ], () => { toast("Alter Scheinwerfer erhalten! Er liegt in Opas Werkstatt im Regal.", 4500); ladenAuf(); });
    }
    ladenAuf();
  }
  function ladenAuf() {
    const l = $("laden");
    const liste = l.querySelector(".waren");
    liste.innerHTML = "";
    for (const w of LADEN) {
      if (w.ab && !w.ab()) continue;
      const zeile = document.createElement("div");
      zeile.className = "ware";
      const name = document.createElement("span");
      name.textContent = w.name;
      const knopf = document.createElement("button");
      knopf.type = "button"; knopf.className = "knopf";
      const hat = spiel.gekauft.has(w.id);
      knopf.textContent = hat ? "gekauft" : `🪙 ${w.preis}`;
      knopf.disabled = hat || spiel.geld < w.preis;
      knopf.addEventListener("click", () => {
        spiel.geld -= w.preis; spiel.gekauft.add(w.id); spiel.teile.add(w.id); hudNeu();
        if (opt.gekauft) opt.gekauft(w.id);
        toast(`${w.name} gekauft! Liegt jetzt in Opas Werkstatt im Regal.`);
        ladenAuf();
      });
      zeile.append(name, knopf);
      liste.append(zeile);
    }
    l.querySelector(".kasse").textContent = `Du hast 🪙 ${spiel.geld} Münzen.`;
    l.hidden = false;
    l.querySelector(".zweit").focus();
  }

  // --- Gespräch -------------------------------------------------------------
  let gZeilen = [], gNr = 0, gTipp = null, gEnde = null;
  function gespraech(figur, name, ort, zeilen, ende) {
    const box = $("gespraech");
    // Fehlt der Hintergrund (noch kein Bild), steht ein warmer Holzton als Platzhalter da
    box.style.backgroundImage = D.hintergruende && D.hintergruende[ort] ? `url(${D.hintergruende[ort]})`
      : "linear-gradient(180deg, #6b4a2e 0%, #8a6440 55%, #4a3220 56%, #3a2818 100%)";
    box.dataset.figur = figur;
    box.setAttribute("aria-label", `Gespräch mit ${name}`);
    $("gName").textContent = name;
    gZeilen = zeilen; gNr = 0; gEnde = ende;
    box.hidden = false;
    box.classList.add("auf");
    setTimeout(() => box.classList.remove("auf"), 500);
    box.focus();
    if (Ton) Ton.leise(true, figur);
    zeile();
  }
  // --- Gebrummel und Musik: siehe ton.js (window.Ton) ---------------------------
  const Ton = window.Ton;
  const silbe = (figur, info) => Ton && Ton.silbe(figur, info);

  function zeile() {
    const [geste, text] = gZeilen[gNr];
    const fig = $("gFigur"), figuren = (D.figuren || {})[$("gespraech").dataset.figur] || {};
    if (figuren[geste]) {
      if (fig.src !== figuren[geste]) { fig.src = figuren[geste]; fig.classList.remove("neu"); void fig.offsetWidth; fig.classList.add("neu"); }
    }
    const p = $("gText");
    clearInterval(gTipp);
    if (Ton) Ton.still();
    const figur = $("gespraech").dataset.figur;
    if (reduce) { // ohne Animation: nur ein kurzes Gebrummel
      p.textContent = text; gTipp = null;
      for (let k = 0; k < 6; k++) setTimeout(() => silbe(figur, { fortschritt: k / 5, betont: k === 0 }), k * 100);
      return;
    }
    let i = 0, schritt = 0, pause = 0;
    p.textContent = "";
    gTipp = setInterval(() => {
      i += 2;
      p.textContent = text.slice(0, i);
      const neu = text.slice(i - 2, i);
      if (/[.,!?…:;]/.test(neu)) pause = 4; // Satzzeichen: kurz Luft holen
      else if (pause > 0) pause--;
      else if (schritt++ % 3 === 0 && /[\p{L}]/u.test(neu)) {
        // Satzmelodie: wie weit sind wir im aktuellen Satz, und endet er mit einer Frage?
        const vorher = text.slice(0, i).search(/[^.!?]*$/), nach = text.slice(i).search(/[.!?]/);
        const ende = nach < 0 ? text.length : i + nach;
        silbe(figur, { fortschritt: (i - vorher) / Math.max(1, ende - vorher), frage: text[ende] === "?", betont: /[A-ZÄÖÜ]/.test(neu) });
      }
      if (i >= text.length) { clearInterval(gTipp); gTipp = null; }
    }, 30);
  }
  function weiter() {
    if (gTipp) { clearInterval(gTipp); gTipp = null; $("gText").textContent = gZeilen[gNr][1]; if (Ton) Ton.still(); return; }
    gNr++;
    if (gNr < gZeilen.length) return zeile();
    $("gespraech").hidden = true;
    if (Ton) { Ton.leise(false); Ton.still(); }
    if (gEnde) gEnde();
  }
  const tonKnopf = document.createElement("button");
  tonKnopf.type = "button"; tonKnopf.className = "g-ton";
  const tonZeigen = () => { const an = Ton && Ton.an.stimmen; tonKnopf.textContent = an ? "🔊" : "🔇"; tonKnopf.setAttribute("aria-label", an ? "Stimmen aus" : "Stimmen an"); };
  tonZeigen();
  tonKnopf.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!Ton) return;
    Ton.schalte("stimmen", !Ton.an.stimmen); tonZeigen();
    if (Ton.an.stimmen) { Ton.freischalten(); silbe($("gespraech").dataset.figur, { betont: true }); } // kurze Probe zum Hören
  });
  // Musik an/aus: kleiner Knopf unten links auf der Seite, für Werkstatt und Karte
  const musikKnopf = document.createElement("button");
  musikKnopf.type = "button"; musikKnopf.id = "musikKnopf";
  const musikZeigen = () => { const an = Ton && Ton.an.musik; musikKnopf.textContent = an ? "🎵" : "🎵̸"; musikKnopf.classList.toggle("aus", !an); musikKnopf.setAttribute("aria-label", an ? "Musik aus" : "Musik an"); };
  musikZeigen();
  musikKnopf.addEventListener("click", () => { if (!Ton) return; Ton.freischalten(); Ton.schalte("musik", !Ton.an.musik); musikZeigen(); });
  document.body.append(musikKnopf);
  document.querySelector("#gespraech .g-box").append(tonKnopf);
  $("gespraech").addEventListener("click", weiter);
  $("gespraech").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); weiter(); } });

  // --- Gebiete, Nebel und Kartenstücke --------------------------------------
  const GEBIETE = [
    { id: "start", name: "Rund um Opas Schuppen", x: 166, y: 262, r: 92, offen: true },
    { id: "nord", name: "Nordweg und Schrottplatz", x: 214, y: 112, r: 112, offen: false },
    { id: "wald", name: "Waldrand im Westen", x: 70, y: 196, r: 82, offen: false },
    { id: "weide", name: "Weideweg im Osten", x: 282, y: 248, r: 62, offen: false },
    { id: "felder", name: "Feldweg zu den Feldern", x: 300, y: 140, r: 70, offen: false }, // zeigt Hilde
  ];
  const STUECKE = [
    { gebiet: "nord", x: 184, y: 213 },
    { gebiet: "wald", x: 213, y: 124 },
    { gebiet: "weide", x: 233, y: 176 },
  ];
  // Kartenstücke für Gebiete, die schon offen sind, liegen gar nicht erst herum
  function gebieteStart() {
    for (const g of GEBIETE) g.offen = (opt.offen || ["start"]).includes(g.id) || location.hash === "#schrottplatz";
    for (const st of STUECKE) st.genommen = GEBIETE.find((g) => g.id === st.gebiet).offen;
  }
  const bekannt = (x, y) => GEBIETE.some((g) => g.offen && Math.hypot(x - g.x, y - g.y) < g.r);
  const offen = (x, y) => GEBIETE.some((g) => g.offen && Math.hypot(x - g.x, y - g.y) < g.r - 2);
  const nebel = document.createElement("canvas");
  nebel.width = W; nebel.height = W;
  function nebelNeu() {
    const n = nebel.getContext("2d");
    n.globalCompositeOperation = "source-over";
    n.clearRect(0, 0, W, W);
    n.fillStyle = "rgba(228,214,180,0.97)"; n.fillRect(0, 0, W, W);
    n.strokeStyle = "rgba(140,110,70,0.22)"; n.lineWidth = 0.5;
    for (let i = -W; i < W; i += 7) { n.beginPath(); n.moveTo(i, 0); n.lineTo(i + W, W); n.stroke(); }
    n.globalCompositeOperation = "destination-out";
    for (const g of GEBIETE) {
      if (!g.offen) continue;
      const gr = n.createRadialGradient(g.x, g.y, g.r * 0.8, g.x, g.y, g.r);
      gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      n.fillStyle = gr; n.beginPath(); n.arc(g.x, g.y, g.r, 0, Math.PI * 2); n.fill();
    }
    miniGrund = null;
  }
  let toastZeit = null;
  function toast(text, ms = 3200) {
    const t = $("toast");
    t.textContent = text; t.hidden = false;
    clearTimeout(toastZeit);
    toastZeit = setTimeout(() => { t.hidden = true; }, ms);
  }
  function stueckFinden(st) {
    st.genommen = true;
    const g = GEBIETE.find((x) => x.id === st.gebiet);
    g.offen = true;
    nebelNeu();
    toast(`Kartenstück gefunden! Neues Gebiet: ${g.name}`);
    if (navigator.vibrate) { try { navigator.vibrate([30, 40, 30]); } catch { /* egal */ } }
  }

  // --- Wegenetz, Ziele und Hindernisse ----------------------------------------
  // Das Auto fährt nur auf den Wegen. Die Linien werden in Punkte im Abstand von
  // etwa 2 m zerlegt; benachbarte Punkte und die Abzweigung sind verbunden.
  const NETZ_LINIEN = [[[150, 243], ...WEG], ABZWEIG, FELDRAND, WEIDEWEG, HOFWEG, FELDERWEG, WALDPFAD];
  const KNOTEN = [], NACHBARN = [];
  let HAUPT = 0; // Anzahl Punkte der Hauptlinie
  function netzBauen() {
    for (const [nr, linie] of NETZ_LINIEN.entries()) {
      const anfang = KNOTEN.length;
      let vorher = -1;
      for (let i = 1; i < linie.length; i++) {
        const [ax, ay] = linie[i - 1], [bx, by] = linie[i];
        const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 2));
        for (let k = i === 1 ? 0 : 1; k <= n; k++) {
          const id = KNOTEN.push([ax + (bx - ax) * k / n, ay + (by - ay) * k / n]) - 1;
          NACHBARN.push([]);
          if (vorher >= 0) { NACHBARN[id].push(vorher); NACHBARN[vorher].push(id); }
          vorher = id;
        }
      }
      if (nr === 0) { HAUPT = KNOTEN.length; continue; }
      // Abzweigung: Anfang der Linie mit dem nächsten Punkt der früheren Linien verbinden,
      // das Ende auch, wenn es auf eine frühere Linie trifft (Rundweg)
      const fruehere = (k) => k < anfang;
      const j = naechsterKnoten(KNOTEN[anfang][0], KNOTEN[anfang][1], fruehere);
      NACHBARN[anfang].push(j); NACHBARN[j].push(anfang);
      const e = KNOTEN.length - 1, j2 = naechsterKnoten(KNOTEN[e][0], KNOTEN[e][1], fruehere);
      if (Math.hypot(KNOTEN[j2][0] - KNOTEN[e][0], KNOTEN[j2][1] - KNOTEN[e][1]) < 3) { NACHBARN[e].push(j2); NACHBARN[j2].push(e); }
    }
  }
  function naechsterKnoten(x, y, nur) {
    let best = -1, bd = Infinity;
    KNOTEN.forEach(([kx, ky], i) => { if (nur && !nur(i)) return; const d = Math.hypot(kx - x, ky - y); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  // art "ort": Hauptziel (Ort mit Bewohner), "weg": Wegweiser/Wegpunkt. kommt: Ort gibt es
  // noch nicht, er steht nur als Fragezeichen auf der Karte.
  const ZIELE = [
    { id: "schuppen", name: "Opas Schuppen", art: "ort", x: 150, y: 243, gebiet: "start" },
    { id: "wegweiser", name: "Wegweiser", art: "weg", x: 181, y: 204, gebiet: "start" },
    { id: "schrottplatz", name: "Schrottplatz", art: "ort", x: 230, y: 60, gebiet: "nord" }, // parkt vor dem Tor
    { id: "waldweg", name: "Waldweg", art: "weg", x: 60, y: 214, gebiet: "wald" },
    { id: "feldrand", name: "Feldrand", art: "weg", x: 240, y: 177, gebiet: "nord" },
    { id: "weide", name: "Weide", art: "weg", x: 298, y: 250, gebiet: "weide" },
    { id: "bauernhof", name: "Bauernhof", art: "ort", x: 276, y: 162, gebiet: "nord" },
    { id: "foersterhuette", name: "Försterhütte", art: "ort", x: 36, y: 197, gebiet: "wald" },
    { id: "felder", name: "Zu den Feldern", art: "weg", x: 300, y: 85, gebiet: "felder" },
    { id: "muehle", name: "Mühle", art: "ort", x: 296, y: 45, gebiet: "felder", kommt: true },
  ];
  const zielOffen = (z) => !z.kommt && GEBIETE.find((g) => g.id === z.gebiet).offen;
  const zielErlaubt = (z) => !opt.zielErlaubt || opt.zielErlaubt(z);
  // Hindernisse auf dem Weg: hier hält das Auto, wenn ihm ein Teil fehlt
  const HINDERNISSE = [
    { x: 102, y: 208.5, r: 3, braucht: "licht", titel: "Zu dunkel!",
      text: "Hier beginnt der dunkle Wald. Ohne Licht sieht die Klapperkiste die Hand vor Augen nicht.",
      fehlt: "Es fehlt: Scheinwerfer (Kategorie Licht). Bau in der Werkstatt ein Licht ein." },
    // Die Schafherde geht nur mit Hupe weg: Mit Hupe hält das Auto trotzdem und man hupt selbst
    { id: "schafe", x: 309, y: 158, r: 4, braucht: "hupe", aktion: "hupen", titel: "Mäh!",
      text: "Eine ganze Schafherde steht mitten auf dem Weg und rührt sich keinen Zentimeter.",
      fehlt: "Es fehlt: eine richtig laute Hupe (Kategorie Hupe). Vielleicht hat Knut eine." },
  ];
  // Ohne Werkstatt (Kartenprobe) zählt eine Belohnung gleich als eingebaut
  const TEIL_FUER = { licht: "scheinwerfer", hupe: "spezialhupe" };
  const hatTeil = (teil) => (opt.hatTeil ? opt.hatTeil(teil) : spiel.teile.has(TEIL_FUER[teil]));

  // --- Selbst zum gewählten Ziel fahren ----------------------------------------
  let route = null, routeI = 0, zielWahl = null, haengt = 0, rueck = 0, angehalten = false;
  function planen(ziel) {
    const start = naechsterKnoten(auto.x, auto.y), ende = naechsterKnoten(ziel.x, ziel.y);
    const dist = new Float64Array(KNOTEN.length).fill(Infinity), von = new Int32Array(KNOTEN.length).fill(-1);
    const offenListe = [start];
    dist[start] = 0;
    while (offenListe.length) {
      offenListe.sort((a, b) => dist[a] - dist[b]);
      const i = offenListe.shift();
      if (i === ende) break;
      for (const j of NACHBARN[i]) {
        // nie durch den Nebel planen (nur direkt ums Auto herum, damit es nie festsitzt)
        if (!bekannt(KNOTEN[j][0], KNOTEN[j][1]) && Math.hypot(KNOTEN[j][0] - auto.x, KNOTEN[j][1] - auto.y) > 20) continue;
        const d = dist[i] + Math.hypot(KNOTEN[j][0] - KNOTEN[i][0], KNOTEN[j][1] - KNOTEN[i][1]);
        if (d < dist[j]) { if (dist[j] === Infinity) offenListe.push(j); dist[j] = d; von[j] = i; }
      }
    }
    if (ende !== start && von[ende] < 0) { toast("Dorthin führt kein Weg."); return; }
    angehalten = false;
    const weg = [];
    for (let i = ende; i >= 0; i = von[i]) { weg.push(KNOTEN[i]); if (i === start) break; }
    route = weg.reverse(); routeI = 0; zielWahl = ziel; haengt = 0; fertig = false;
    $("meldung").hidden = true;
    toast(`Unterwegs zu: ${ziel.name}`);
    if (opt.unterwegs) opt.unterwegs(ziel);
  }
  function hindernisPruefen() {
    for (const h of HINDERNISSE) {
      if (h.weg || Math.hypot(h.x - auto.x, h.y - auto.y) > h.r + 2) continue;
      const kann = hatTeil(h.braucht);
      if (kann && !h.aktion) continue;
      // nur anhalten, wenn die Route noch hinter das Hindernis führt
      if (!route.slice(routeI).some(([x, y]) => Math.hypot(x - h.x, y - h.y) < 1.5)) continue;
      route = null;
      $("mTitel").textContent = h.titel;
      const hupen = kann && h.aktion === "hupen";
      $("mText").textContent = hupen ? "Die Schafe stehen mitten auf dem Weg. Zeit für die Spezialhupe!" : h.text;
      $("mFehlt").textContent = h.fehlt; $("mFehlt").hidden = hupen;
      $("hupen").hidden = !hupen; $("zurWerkstatt").hidden = hupen;
      $("hupen").onclick = () => hupenBei(h);
      $("meldung").hidden = false;
      (hupen ? $("hupen") : $("zurWerkstatt")).focus();
      return true;
    }
    return false;
  }
  function steuerAuto(dt) {
    if (!route) return null;
    const voraus = 1.8 + Math.max(0, auto.v) * 0.35; // langsam: kurz vorausschauen, damit Ecken nicht geschnitten werden
    while (routeI < route.length - 1 && Math.hypot(route[routeI][0] - auto.x, route[routeI][1] - auto.y) < voraus) routeI++;
    const [tx, ty] = route[routeI], ende = route[route.length - 1];
    const rest = Math.hypot(ende[0] - auto.x, ende[1] - auto.y);
    if (rest < 1.5) {
      route = null;
      if (zielWahl.id === "schrottplatz") { if (!besucht) ankunft(); else beiKnut(); }
      else if (zielWahl.id === "schuppen" && opt.zurWerkstatt) opt.zurWerkstatt();
      else if (zielWahl.id === "bauernhof") beiHilde();
      else if (zielWahl.id === "foersterhuette") beiMoos();
      else toast(`Angekommen: ${zielWahl.name}`);
      return { gas: false, bremse: Math.abs(auto.v) > 0.3, lenk: 0 };
    }
    if (hindernisPruefen()) return { gas: false, bremse: true, lenk: 0 };
    if (angehalten) { haengt = 0; return { gas: false, bremse: auto.v > 0.2, lenk: 0 }; } // nur bremsen, nicht rückwärts
    if (rueck > 0) { rueck -= dt; return { gas: false, bremse: true, lenk: 0 }; }
    let diff = Math.atan2(ty - auto.y, tx - auto.x) - auto.a;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (Math.abs(diff) > 1.3) {
      // Wenden: Ziel liegt hinter dem Auto. Langsam rollen und zügig herumdrehen statt langer Rangierfahrt.
      auto.a += Math.sign(diff) * Math.min(Math.abs(diff), 1.9 * dt);
      return { gas: auto.v < 1.2, bremse: auto.v > 1.8, lenk: Math.sign(diff) };
    }
    const soll = Math.min(6.2, Math.max(1.4, rest * 0.9)) * (Math.abs(diff) > 0.9 ? 0.45 : 1);
    if (Math.abs(auto.v) < 0.25) {
      haengt += dt;
      if (haengt > 1.2) { haengt = 0; rueck = 1.4; planen(zielWahl); }
    } else haengt = 0;
    return { gas: auto.v < soll, bremse: auto.v > soll + 1.5, lenk: Math.max(-1, Math.min(1, diff * 2.2)) };
  }

  // --- Zeichnen --------------------------------------------------------------
  const cv = $("karte"), ctx = cv.getContext("2d");
  let kamera = null; // Maßstab und Mittelpunkt des letzten Bilds (für das Antippen)
  const muster = {};
  function musterVon(name) {
    if (muster[name]) return muster[name];
    const b = BODEN[name];
    if (!b.img.complete || !b.img.naturalWidth) return null;
    const p = ctx.createPattern(b.img, "repeat");
    p.setTransform(new DOMMatrix().scale(b.meter / b.img.naturalWidth));
    return (muster[name] = p);
  }

  // Walddach als Boden der Waldfläche, mit weichem Rand ins Gras
  function walddachZeichnen(sicht) {
    const p = musterVon("walddach");
    if (!p) return;
    ctx.save();
    ctx.fillStyle = p;
    for (const [wx, wy, wr] of WALD) {
      if (wx + wr < sicht.x0 || wx - wr > sicht.x1 || wy + wr < sicht.y0 || wy - wr > sicht.y1) continue;
      for (let i = 0; i < 8; i++) { // viele dünne Ringe übereinander: weicher Übergang ins Gras
        ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.arc(wx, wy, wr * (1.08 - i * 0.02), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(wx, wy, wr * 0.92, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function zeichneWege(name, breite, alpha) {
    const p = musterVon(name);
    if (!p) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = p; ctx.lineWidth = breite; ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const w of WEGE) {
      ctx.beginPath();
      ctx.moveTo(w[0][0], w[0][1]);
      for (let i = 1; i < w.length; i++) ctx.lineTo(w[i][0], w[i][1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  function zeichneObjekt(o, sicht) {
    if (!o.art) return;
    const t = OBJ[o.art];
    const b = t.b * o.s, h = t.h * o.s;
    if (o.x + b < sicht.x0 || o.x - b > sicht.x1 || o.y + b < sicht.y0 || o.y - b > sicht.y1) return;
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.rotate(o.rot);
    if (o.spiegel) ctx.transform(0, 1, 1, 0, 0, 0); // an der Diagonale spiegeln, Licht bleibt oben links
    if (!t.schatten && t.img.complete && t.img.naturalWidth) schattenVon(t);
    if (t.schatten) {
      const k = b / t.img.naturalWidth, d = b * 0.14;
      ctx.drawImage(t.schatten, -b / 2 - t.pad * k + d, -h / 2 - t.pad * k + d, t.schatten.width * k, t.schatten.height * k);
    }
    ctx.drawImage(t.img, -b / 2, -h / 2, b, h);
    ctx.restore();
  }

  function platzhalter(text, x, y, w, h, rund) {
    ctx.save();
    ctx.fillStyle = rund ? "rgba(90,80,70,0.35)" : "#5a3d26";
    ctx.strokeStyle = "#1a1410"; ctx.lineWidth = 0.25;
    ctx.beginPath();
    if (rund) ctx.arc(x, y, w, 0, Math.PI * 2); else ctx.rect(x - w / 2, y - h / 2, w, h);
    ctx.fill(); ctx.stroke();
    if (!rund) {
      ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 0.12;
      for (let i = -w / 2 + 1; i < w / 2; i += 1) { ctx.beginPath(); ctx.moveTo(x + i, y - h / 2); ctx.lineTo(x + i, y + h / 2); ctx.stroke(); }
    }
    ctx.fillStyle = "#f6f0dc"; ctx.font = "800 1.6px Nunito, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.lineWidth = 0.3;
    ctx.strokeText(text, x, y); ctx.fillText(text, x, y);
    ctx.restore();
  }

  // Dunkler Wald: alles schwarz, nur mit Licht-Teil ein Lichtkegel vor dem Auto und ein
  // schwacher Schein drumherum. Gezeichnet auf einer eigenen Ebene, damit der Kegel
  // nur die Dunkelheit ausschneidet und nicht die Karte darunter.
  const dunkel = document.createElement("canvas"), dctx = dunkel.getContext("2d");
  function dunklerWald(w, h) {
    const WX = 50, WY = 205, WR = 54; // Bereich, in dem der Lichtkegel gebraucht wird
    const mitLicht = hatTeil("licht") && Math.hypot(auto.x - WX, auto.y - WY) < WR + 20;
    if (dunkel.width !== cv.width || dunkel.height !== cv.height) { dunkel.width = cv.width; dunkel.height = cv.height; }
    dctx.setTransform(1, 0, 0, 1, 0, 0); dctx.clearRect(0, 0, dunkel.width, dunkel.height);
    dctx.setTransform(ctx.getTransform());
    // Dunkel nur unter dem Walddach: auf den Wegen im Wald und auf der Lichtung der Hütte
    dctx.fillStyle = dctx.strokeStyle = "rgba(4,10,8,0.93)"; dctx.lineCap = dctx.lineJoin = "round";
    dctx.lineWidth = WEG_BREITE + 3;
    for (const w of [ABZWEIG, WALDPFAD]) {
      dctx.beginPath(); dctx.moveTo(w[0][0], w[0][1]);
      for (const [x, y] of w.slice(1)) dctx.lineTo(x, y);
      dctx.stroke();
    }
    const [fx0, fy0, fx1, fy1] = FOERSTER.bereich;
    dctx.fillStyle = "rgba(4,10,8,0.78)"; // Lichtung etwas heller, die Hütte ahnt man
    dctx.beginPath(); dctx.ellipse((fx0 + fx1) / 2, (fy0 + fy1) / 2, (fx1 - fx0) / 2 + 2, (fy1 - fy0) / 2 + 2, 0, 0, Math.PI * 2); dctx.fill();
    // nur innerhalb der Waldfläche, zum Waldrand hin weich auslaufen
    dctx.globalCompositeOperation = "destination-in";
    const rand = dctx.createLinearGradient(WALD_EINGANG + 6, 0, WALD_EINGANG - 4, 0);
    rand.addColorStop(0, "rgba(0,0,0,0)"); rand.addColorStop(1, "rgba(0,0,0,1)");
    dctx.fillStyle = rand; dctx.fillRect(-20, 100, WALD_EINGANG + 30, 200);
    dctx.globalCompositeOperation = "source-over";
    // Die Laterne an der Försterhütte brennt immer: kleiner warmer Lichtfleck, flackert leicht
    const [lx, ly] = FOERSTER.laterne, flacker = reduce ? 1 : 1 + Math.sin(performance.now() / 130) * 0.05;
    const lr = 4.2 * flacker;
    const laterne = (c, farbe0, farbe1) => {
      const g = c.createRadialGradient(lx, ly, 0.2, lx, ly, lr);
      g.addColorStop(0, farbe0); g.addColorStop(1, farbe1);
      c.fillStyle = g; c.beginPath(); c.arc(lx, ly, lr, 0, Math.PI * 2); c.fill();
    };
    dctx.globalCompositeOperation = "destination-out";
    laterne(dctx, "rgba(0,0,0,0.9)", "rgba(0,0,0,0)");
    dctx.globalCompositeOperation = "source-over";
    if (!mitLicht) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(dunkel, 0, 0); ctx.restore();
      laterne(ctx, "rgba(255,200,110,0.3)", "rgba(255,200,110,0)");
      return;
    }
    const fx = auto.x + Math.cos(auto.a) * 1.8, fy = auto.y + Math.sin(auto.a) * 1.8, weit = 15, breit = 0.5;
    const kegel = (c, farbe0, farbe1) => {
      const g = c.createRadialGradient(fx, fy, 0.5, fx, fy, weit);
      g.addColorStop(0, farbe0); g.addColorStop(1, farbe1);
      c.fillStyle = g; c.beginPath(); c.moveTo(fx, fy); c.arc(fx, fy, weit, auto.a - breit, auto.a + breit); c.closePath(); c.fill();
    };
    dctx.globalCompositeOperation = "destination-out";
    kegel(dctx, "rgba(0,0,0,1)", "rgba(0,0,0,0)");
    const schein = dctx.createRadialGradient(auto.x, auto.y, 0, auto.x, auto.y, 4.5);
    schein.addColorStop(0, "rgba(0,0,0,0.75)"); schein.addColorStop(1, "rgba(0,0,0,0)");
    dctx.fillStyle = schein; dctx.beginPath(); dctx.arc(auto.x, auto.y, 4.5, 0, Math.PI * 2); dctx.fill();
    dctx.globalCompositeOperation = "source-over";
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(dunkel, 0, 0); ctx.restore();
    kegel(ctx, "rgba(255,226,140,0.22)", "rgba(255,226,140,0)"); // warmes Licht im Kegel
    laterne(ctx, "rgba(255,200,110,0.3)", "rgba(255,200,110,0)");
  }

  function zeichne() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const m = Math.min(w, h) / 26; // Pixel pro Meter: kurze Bildseite zeigt 26 m
    const vor = Math.max(0, auto.v) * 1.2;
    const kx = auto.x + Math.cos(auto.a) * vor, ky = auto.y + Math.sin(auto.a) * vor;
    ctx.setTransform(dpr * m, 0, 0, dpr * m, dpr * (w / 2 - kx * m), dpr * (h / 2 - ky * m));
    kamera = { m, kx, ky };
    const sicht = { x0: kx - w / 2 / m, x1: kx + w / 2 / m, y0: ky - h / 2 / m, y1: ky + h / 2 / m };

    // Boden: ruhiges Gras, Blumenflecken, Wege
    const gras = musterVon("gras_ruhig");
    ctx.fillStyle = gras || "#4d7a35";
    ctx.fillRect(sicht.x0 - 1, sicht.y0 - 1, sicht.x1 - sicht.x0 + 2, sicht.y1 - sicht.y0 + 2);
    const blumen = musterVon("gras");
    if (blumen) {
      ctx.fillStyle = blumen;
      for (const [fx, fy, fr] of FLECKEN) {
        if (fx + fr < sicht.x0 || fx - fr > sicht.x1 || fy + fr < sicht.y0 || fy - fr > sicht.y1) continue;
        for (const [k, al] of [[1, 0.25], [0.8, 0.35], [0.6, 0.5]]) {
          ctx.globalAlpha = al; ctx.beginPath(); ctx.arc(fx, fy, fr * k, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    walddachZeichnen(sicht);
    zeichneWege("erde", WEG_BREITE + 1.4, 0.35);
    zeichneWege("erde", WEG_BREITE, 1);
    // Rand der Karte
    ctx.fillStyle = "rgba(10,20,15,0.85)";
    ctx.fillRect(-60, -60, W + 120, 60); ctx.fillRect(-60, W, W + 120, 60); ctx.fillRect(-60, 0, 60, W); ctx.fillRect(W, 0, 60, W);

    const sp = OBJ.schrottplatz;
    if (sp.img.complete && sp.img.naturalWidth) ctx.drawImage(sp.img, SCHROTT.X, SCHROTT.Y, sp.b, sp.h);
    const sch = OBJ.schuppen;
    if (sch.img.complete && sch.img.naturalWidth) ctx.drawImage(sch.img, SCHUPPEN.X, SCHUPPEN.Y, sch.b, sch.h);
    const hu = OBJ.huette;
    if (hu && hu.img.complete && hu.img.naturalWidth) ctx.drawImage(hu.img, HUETTE.x - hu.b / 2, HUETTE.y - hu.h / 2, hu.b, hu.h);
    const hof = OBJ.bauernhof;
    if (hof && hof.img.complete && hof.img.naturalWidth) ctx.drawImage(hof.img, HOF.X, HOF.Y, hof.b, hof.h);
    const fh = OBJ.foersterhuette;
    if (fh && fh.img.complete && fh.img.naturalWidth) ctx.drawImage(fh.img, FOERSTER.x - fh.b / 2, FOERSTER.y - fh.h / 2, fh.b, fh.h);

    // Route und Ziel
    const t = performance.now() / 1000;
    if (route) {
      ctx.save();
      const [zx, zy] = route[route.length - 1], puls = reduce ? 0 : Math.sin(t * 5) * 0.25;
      ctx.lineWidth = 0.3; ctx.strokeStyle = "#f2b632";
      ctx.beginPath(); ctx.arc(zx, zy, 1.4 + puls, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "rgba(242,182,50,0.35)"; ctx.beginPath(); ctx.arc(zx, zy, 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // Kartenstücke: kleine Karte mit rotem Kreuz, wippt und leuchtet
    for (const st of STUECKE) {
      if (st.genommen) continue;
      const hub = reduce ? 0 : Math.sin(t * 3 + st.x) * 0.15;
      ctx.save(); ctx.translate(st.x, st.y + hub); ctx.rotate(-0.2);
      ctx.fillStyle = "rgba(255,230,140,0.35)"; ctx.beginPath(); ctx.arc(0, 0, 1.6 + (reduce ? 0 : Math.sin(t * 4) * 0.2), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#f3e2b8"; ctx.strokeStyle = "#3a2a18"; ctx.lineWidth = 0.12;
      ctx.beginPath(); ctx.rect(-0.8, -0.6, 1.6, 1.2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = "#8a6a48"; ctx.lineWidth = 0.06;
      ctx.beginPath(); ctx.moveTo(-0.6, 0.2); ctx.quadraticCurveTo(-0.1, -0.4, 0.3, 0.1); ctx.stroke();
      ctx.strokeStyle = "#c0392b"; ctx.lineWidth = 0.14;
      ctx.beginPath(); ctx.moveTo(0.25, -0.25); ctx.lineTo(0.55, 0.05); ctx.moveTo(0.55, -0.25); ctx.lineTo(0.25, 0.05); ctx.stroke();
      ctx.restore();
    }

    // Gegenstände zum Aufsammeln (nur während ihres Auftrags), mit Leuchten, damit man sie findet
    for (const r of SAMMEL) {
      const rf = OBJ[r.art];
      if (!sichtbar(r) || !rf || !rf.img.complete) continue;
      const nah = Math.hypot(r.x - auto.x, r.y - auto.y) <= REICH;
      ctx.fillStyle = nah ? "rgba(255,220,90,0.55)" : "rgba(255,230,140,0.3)";
      ctx.beginPath(); ctx.arc(r.x, r.y, (nah ? 1.6 : 1.3) + (reduce ? 0 : Math.sin(t * 4 + r.x) * 0.2), 0, Math.PI * 2); ctx.fill();
      const gb = rf.b * 1.15, gh = rf.h * 1.15; // etwas größer, damit man sie gut antippen kann
      ctx.drawImage(rf.img, r.x - gb / 2, r.y - gh / 2, gb, gh);
    }

    tiereBoden(sicht);

    // Auto, dann alles, was höher ist (Bäume über dem Auto)
    const img = autoWahl.img;
    if (img.complete && img.naturalWidth) {
      const lang = autoWahl.laenge, breit = lang * img.naturalHeight / img.naturalWidth;
      const kurz = 4; // 4 m: Länge ohne Anbauteil, Mitte des Autos
      ctx.save();
      ctx.translate(auto.x, auto.y);
      ctx.rotate(auto.a + (reduce ? 0 : auto.wackel));
      ctx.fillStyle = "rgba(10,20,8,0.3)";
      ctx.beginPath(); ctx.roundRect(-kurz / 2 + 0.25, -breit / 2 + 0.25, kurz, breit, 0.5); ctx.fill();
      // Vorderachse mit Vorderrädern dreht sich um ihre Mitte mit dem Lenkeinschlag, darunter
      // liegt sie, damit Rahmen und Karosserie sie wie am echten Auto teilweise verdecken
      const ach = autoWahl.achseImg;
      if (ach && ach.complete && ach.naturalWidth) {
        const [px, py] = autoWahl.drehpunkt, hoch = kurz * ach.naturalHeight / ach.naturalWidth;
        ctx.save();
        ctx.translate(-kurz / 2 + px, -hoch / 2 + py);
        ctx.rotate(lenk);
        ctx.drawImage(ach, -px, -py, kurz, hoch);
        ctx.restore();
      }
      ctx.drawImage(img, -kurz / 2, -breit / 2, lang, breit);
      ctx.restore();
    }
    for (const o of OBJEKTE) zeichneObjekt(o, sicht);
    tiereLuft(sicht);
    // Dunkler Wald hinter dem Hindernis
    dunklerWald(w, h);
    wolkenZeichnen(sicht);
    // Nebel über unerforschten Gebieten
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(nebel, 0, 0, W, W);
    ctx.save();
    ctx.fillStyle = "rgba(90,70,45,0.75)"; ctx.font = "800 2.2px Nunito, sans-serif"; ctx.textAlign = "center";
    for (const g of GEBIETE) if (!g.offen && g.x > sicht.x0 - 20 && g.x < sicht.x1 + 20 && g.y > sicht.y0 - 20 && g.y < sicht.y1 + 20) {
      ctx.fillText("? Unerforscht ?", g.x, g.y); ctx.fillText("Kartenstück fehlt", g.x, g.y + 3);
    }
    ctx.restore();
    wetterBildschirm(w, h, dpr);

    // Anzeige
    tachoZeichnen();
    const sk = $("stopp");
    sk.hidden = !route;
    sk.textContent = angehalten ? "▶ Weiter" : "✋ Stopp";
    $("weg").hidden = !route;
    if (route) $("weg").textContent = `📍 ${zielWahl.name} · ${Math.round((route.length - routeI) * 2)} m`;
    miniZeichnen();
  }

  // Übersichtskarte oben rechts
  const mini = $("mini"), mctx = mini.getContext("2d");
  let miniGrund = null;
  function miniZeichnen() {
    const s = 96 * Math.min(window.devicePixelRatio || 1, 2);
    if (mini.width !== s) { mini.width = s; mini.height = s; miniGrund = null; }
    const k = s / W;
    if (!miniGrund) {
      miniGrund = document.createElement("canvas"); miniGrund.width = s; miniGrund.height = s;
      const g = miniGrund.getContext("2d");
      g.fillStyle = "#5d8a3e"; g.fillRect(0, 0, s, s);
      g.fillStyle = "#2c4d2a";
      for (const o of OBJEKTE) if (o.art === "nadelbaum" || o.art === "laubbaum") { g.beginPath(); g.arc(o.x * k, o.y * k, 2.2 * k, 0, 7); g.fill(); }
      g.strokeStyle = "#c9a26b"; g.lineWidth = Math.max(2, 4.5 * k); g.lineCap = "round"; g.lineJoin = "round";
      for (const w of WEGE) { g.beginPath(); g.moveTo(w[0][0] * k, w[0][1] * k); for (const [x, y] of w.slice(1)) g.lineTo(x * k, y * k); g.stroke(); }
      g.strokeStyle = "#8a6a48"; g.lineWidth = Math.max(1, 0.8 * k);
      for (const [a, b] of ZAEUNE) { g.beginPath(); g.moveTo(a[0] * k, a[1] * k); g.lineTo(b[0] * k, b[1] * k); g.stroke(); }
      g.fillStyle = "#9a9a90"; g.beginPath();
      for (const [x, y] of SCHROTT.zaun) g.lineTo(x * k, y * k);
      g.fill();
      const [mx0, my0, mx1, my1] = SCHUPPEN.haus;
      g.fillStyle = "#5a3d26"; g.fillRect(mx0 * k, my0 * k, (mx1 - mx0) * k, (my1 - my0) * k);
      for (const [hx0, hy0, hx1, hy1] of [HUETTE.haus, FOERSTER.haus, ...HOF.haeuser]) g.fillRect(hx0 * k, hy0 * k, (hx1 - hx0) * k, (hy1 - hy0) * k);
    }
    if (!miniGrund.mitNebel) { miniGrund.getContext("2d").drawImage(nebel, 0, 0, s, s); miniGrund.mitNebel = true; }
    mctx.drawImage(miniGrund, 0, 0);
    mctx.fillStyle = "#c0392b";
    for (const st of STUECKE) if (!st.genommen && offen(st.x, st.y)) { mctx.fillRect(st.x * k - 3, st.y * k - 3, 6, 6); }
    if (BRAUCHT[spiel.auftrag]) {
      mctx.fillStyle = "#1d1a16"; mctx.strokeStyle = "#f2b632"; mctx.lineWidth = 1.5;
      for (const r of SAMMEL) if (sichtbar(r) && offen(r.x, r.y)) { mctx.beginPath(); mctx.arc(r.x * k, r.y * k, 3.5, 0, 7); mctx.fill(); mctx.stroke(); }
    }
    if (route) {
      // Route wie bei einer Navi-App: blaue Linie mit hellem Rand, nur auf der Minikarte
      mctx.save(); mctx.lineCap = "round"; mctx.lineJoin = "round";
      mctx.beginPath(); mctx.moveTo(auto.x * k, auto.y * k);
      for (let i = routeI; i < route.length; i++) mctx.lineTo(route[i][0] * k, route[i][1] * k);
      mctx.strokeStyle = "rgba(255,255,255,0.9)"; mctx.lineWidth = 6; mctx.stroke();
      mctx.strokeStyle = "#2b7de9"; mctx.lineWidth = 3.5; mctx.stroke();
      const e = route[route.length - 1];
      mctx.fillStyle = "#2b7de9"; mctx.strokeStyle = "#fff"; mctx.lineWidth = 2;
      mctx.beginPath(); mctx.arc(e[0] * k, e[1] * k, 4.5, 0, 7); mctx.fill(); mctx.stroke();
      mctx.restore();
    }
    mctx.save(); mctx.translate(auto.x * k, auto.y * k); mctx.rotate(auto.a);
    mctx.fillStyle = "#f2b632"; mctx.strokeStyle = "#12232a"; mctx.lineWidth = 2;
    mctx.beginPath(); mctx.moveTo(7, 0); mctx.lineTo(-5, -5); mctx.lineTo(-5, 5); mctx.closePath(); mctx.fill(); mctx.stroke();
    mctx.restore();
  }

  // --- Tiere -------------------------------------------------------------------
  // Je Tier zwei Posen (Kopf zeigt nach rechts). Vögel sitzen in kleinen Gruppen am
  // Weg und fliegen auf, wenn das Auto kommt; ihr Schatten rückt mit der Höhe ab.
  // Hasen hoppeln herum und flüchten vor dem Auto, Schafe grasen auf der Weide.
  const TIERBILD = {};
  for (const [name, posen] of Object.entries(D.tiere || {})) {
    TIERBILD[name] = posen.map((q) => ({ img: lade(q.bild), b: q.breite, h: q.hoehe }));
  }
  const zufall = (a, b) => a + Math.random() * (b - a);
  const VOGELPLAETZE = [[160, 275], [196, 232], [205, 150], [250, 297], [122, 211], [244, 186], [293, 228]];
  const VOEGEL = [];
  function schwarmSetzen(platz) {
    const [px, py] = platz;
    for (let i = 0, n = 3 + Math.floor(Math.random() * 3); i < n; i++) {
      VOEGEL.push({ platz, x: px + zufall(-2, 2), y: py + zufall(-2, 2), a: zufall(0, 6.3), z: 0, vz: 0, fliegt: false,
        v: 0, flap: Math.random(), pick: Math.random() * 3 });
    }
  }
  const HASEN = [[125, 190], [232, 122], [176, 300], [302, 214], [90, 240]].map(([x, y]) => ({ hx: x, hy: y, x, y,
    a: zufall(0, 6.3), pause: zufall(0, 3), hops: 0, phase: 0, flucht: false }));
  const WEIDE = [218, 210, 278, 280]; // innen am Zaun
  const SCHAFE = ["schaf", "schaf", "schaf", "schaf", "schaf", "kuh", "kuh"].map((art) => ({ art,
    x: zufall(WEIDE[0] + 3, WEIDE[2] - 3), y: zufall(WEIDE[1] + 3, WEIDE[3] - 3), a: zufall(0, 6.3), zx: 0, zy: 0,
    warte: zufall(0, 5), grast: true }));
  let ueberflug = { naechster: 12, voegel: [] };
  // Hildes Schafherde steht auf dem Feldweg (Hindernis "schafe"), bis man hupt
  const HERDE = [];
  function herdeSetzen() {
    HERDE.length = 0;
    const h = HINDERNISSE.find((q) => q.id === "schafe");
    for (let i = 0; i < 6; i++) {
      HERDE.push({ x: h.x + zufall(-2.5, 2.5), y: h.y + zufall(-3.5, 3.5), a: zufall(0, 6.3), grast: Math.random() < 0.5,
        wechsel: zufall(1, 4), flucht: false, zx: 0, zy: 0 });
    }
  }
  function tiereStart() {
    VOEGEL.length = 0;
    for (const p of VOGELPLAETZE) schwarmSetzen(p);
  }
  function drehZu(t, ziel, max) {
    let d = ziel - t.a; d = Math.atan2(Math.sin(d), Math.cos(d));
    t.a += Math.max(-max, Math.min(max, d));
  }
  function tiereSchritt(dt) {
    for (const sf of HERDE) {
      if (sf.flucht) { // davonlaufen zur Wiese neben dem Weg, dort wieder grasen
        const d = Math.hypot(sf.zx - sf.x, sf.zy - sf.y);
        if (d < 0.4) { sf.flucht = false; sf.grast = true; continue; }
        drehZu(sf, Math.atan2(sf.zy - sf.y, sf.zx - sf.x), dt * 6);
        sf.x += Math.cos(sf.a) * 4 * dt; sf.y += Math.sin(sf.a) * 4 * dt;
      } else if ((sf.wechsel -= dt) <= 0) { sf.wechsel = zufall(1.5, 5); sf.grast = !sf.grast; sf.a += zufall(-0.8, 0.8); }
    }
    // Vögel: auffliegen, wenn das Auto nah ist, weg vom Auto und steigen
    for (let i = VOEGEL.length - 1; i >= 0; i--) {
      const v = VOEGEL[i];
      const d = Math.hypot(v.x - auto.x, v.y - auto.y);
      if (!v.fliegt && d < 9 && Math.abs(auto.v) > 0.5) {
        v.fliegt = true; v.a = Math.atan2(v.y - auto.y, v.x - auto.x) + zufall(-0.6, 0.6); v.v = zufall(7, 10);
      }
      if (v.fliegt) {
        v.z = Math.min(14, v.z + dt * 5); v.flap += dt * 9;
        v.x += Math.cos(v.a) * v.v * dt; v.y += Math.sin(v.a) * v.v * dt; v.a += Math.sin(v.flap * 0.3) * dt * 0.3;
        if (Math.hypot(v.x - v.platz[0], v.y - v.platz[1]) > 90) VOEGEL.splice(i, 1);
      } else if ((v.pick -= dt) < 0) { v.pick = zufall(0.8, 3); v.a += zufall(-1.2, 1.2); } // picken und umdrehen
    }
    // Leere Plätze nach einer Weile wieder besetzen, aber nicht direkt vor dem Auto
    for (const p of VOGELPLAETZE) {
      if (VOEGEL.some((v) => v.platz === p)) continue;
      p.leer = (p.leer || 0) + dt;
      if (p.leer > 30 && Math.hypot(p[0] - auto.x, p[1] - auto.y) > 30) { p.leer = 0; schwarmSetzen(p); }
    }
    // Ab und zu fliegt ein Schwarm hoch über das Auto hinweg
    if ((ueberflug.naechster -= dt) < 0 && !ueberflug.voegel.length) {
      ueberflug.naechster = zufall(25, 45);
      const r = zufall(0, 6.3), x = auto.x - Math.cos(r) * 35, y = auto.y - Math.sin(r) * 35;
      ueberflug.voegel = Array.from({ length: 5 + Math.floor(Math.random() * 4) }, (_, k) => ({ x: x + zufall(-4, 4) - Math.cos(r) * k * 1.5,
        y: y + zufall(-4, 4) - Math.sin(r) * k * 1.5, a: r, z: zufall(10, 16), v: 9, flap: Math.random() * 6, fliegt: true }));
    }
    for (const v of ueberflug.voegel) { v.x += Math.cos(v.a) * v.v * dt; v.y += Math.sin(v.a) * v.v * dt; v.flap += dt * 8; }
    if (ueberflug.voegel.length && ueberflug.voegel.every((v) => Math.hypot(v.x - auto.x, v.y - auto.y) > 45 &&
      Math.cos(v.a) * (v.x - auto.x) + Math.sin(v.a) * (v.y - auto.y) > 0)) ueberflug.voegel = [];
    // Hasen: Pause, dann ein paar Sprünge; ist das Auto nah, schnell davon
    for (const h of HASEN) {
      const d = Math.hypot(h.x - auto.x, h.y - auto.y);
      if (d < 8 && !h.flucht && Math.abs(auto.v) > 0.5) {
        h.flucht = true; h.hops = 6; h.pause = 0; h.a = Math.atan2(h.y - auto.y, h.x - auto.x) + zufall(-0.5, 0.5);
      }
      if (h.phase > 0) {
        h.phase -= dt;
        const tempo = h.flucht ? 7 : 3.2;
        h.x += Math.cos(h.a) * tempo * dt; h.y += Math.sin(h.a) * tempo * dt;
        if (h.phase <= 0) { h.hops--; h.pause = h.hops > 0 ? (h.flucht ? 0.08 : zufall(0.15, 0.35)) : zufall(1.5, 5); }
      } else if ((h.pause -= dt) <= 0) {
        if (h.hops <= 0) {
          h.flucht = false; h.hops = 2 + Math.floor(Math.random() * 4);
          // weg vom Zuhause? Dann zurück, sonst irgendwohin (manchmal über den Weg)
          const weg = Math.hypot(h.x - h.hx, h.y - h.hy);
          h.a = weg > 14 ? Math.atan2(h.hy - h.y, h.hx - h.x) + zufall(-0.4, 0.4) : zufall(0, 6.3);
        }
        h.phase = 0.22;
      }
    }
    // Schafe: langsam zu einem neuen Grasplatz laufen, dort grasen
    for (const sf of SCHAFE) {
      if (sf.grast) {
        if ((sf.warte -= dt) <= 0) { sf.grast = false; sf.zx = zufall(WEIDE[0] + 2, WEIDE[2] - 2); sf.zy = zufall(WEIDE[1] + 2, WEIDE[3] - 2); }
        continue;
      }
      const d = Math.hypot(sf.zx - sf.x, sf.zy - sf.y);
      if (d < 0.4) { sf.grast = true; sf.warte = zufall(4, 12); continue; }
      drehZu(sf, Math.atan2(sf.zy - sf.y, sf.zx - sf.x), dt * 1.2);
      const tempo = sf.art === "kuh" ? 0.45 : 0.6;
      sf.x += Math.cos(sf.a) * tempo * dt; sf.y += Math.sin(sf.a) * tempo * dt;
    }
  }
  function tierZeichnen(bild, x, y, a, gross = 1) {
    if (!bild || !bild.img.complete || !bild.img.naturalWidth) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    ctx.drawImage(bild.img, -bild.b * gross / 2, -bild.h * gross / 2, bild.b * gross, bild.h * gross);
    ctx.restore();
  }
  function tierSchatten(bild, x, y, a, gross, deck) {
    if (!bild || !bild.img.complete || !bild.img.naturalWidth) return;
    if (!bild.schatten) schattenVon(bild);
    const k = bild.b * gross / bild.img.naturalWidth;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.globalAlpha = deck;
    ctx.drawImage(bild.schatten, -bild.b * gross / 2 - bild.pad * k, -bild.h * gross / 2 - bild.pad * k,
      bild.schatten.width * k, bild.schatten.height * k);
    ctx.restore();
  }
  const imBild = (x, y, sicht, rand = 3) => x > sicht.x0 - rand && x < sicht.x1 + rand && y > sicht.y0 - rand && y < sicht.y1 + rand;
  // Am Boden: Schafe, Hasen, sitzende Vögel und die Schatten der fliegenden
  function tiereBoden(sicht) {
    const T = TIERBILD;
    for (const sf of [...SCHAFE, ...HERDE.map((q) => ({ ...q, art: "schaf", grast: q.grast && !q.flucht }))]) if (imBild(sf.x, sf.y, sicht) && T[sf.art]) {
      const b = T[sf.art][sf.grast ? 1 : 0];
      tierSchatten(b, sf.x + 0.15, sf.y + 0.15, sf.a, 1, 1);
      tierZeichnen(b, sf.x, sf.y, sf.a);
    }
    for (const h of HASEN) if (imBild(h.x, h.y, sicht) && T.hase) {
      const b = T.hase[h.phase > 0 ? 1 : 0], hub = h.phase > 0 ? Math.sin((0.22 - h.phase) / 0.22 * Math.PI) * 0.25 : 0;
      tierSchatten(b, h.x + 0.1, h.y + 0.1, h.a, 1, 1);
      tierZeichnen(b, h.x - hub * 0.3, h.y - hub * 0.3, h.a, 1 + hub * 0.3);
    }
    if (!T.vogel) return;
    for (const v of [...VOEGEL, ...ueberflug.voegel]) {
      if (!imBild(v.x + v.z * 0.6, v.y + v.z * 0.6, sicht, 6)) continue;
      const b = T.vogel[v.fliegt && Math.sin(v.flap * 2) > 0 ? 0 : 1];
      // Je höher, desto weiter weg (nach unten rechts) und blasser liegt der Schatten
      tierSchatten(b, v.x + v.z * 0.6, v.y + v.z * 0.6, v.a, 1, Math.max(0.5, 1 - v.z * 0.03));
      if (!v.fliegt) tierZeichnen(b, v.x, v.y, v.a, 0.85);
    }
  }
  // In der Luft (über Bäumen und Auto): fliegende Vögel, mit der Höhe etwas größer
  function tiereLuft(sicht) {
    if (!TIERBILD.vogel) return;
    for (const v of [...VOEGEL, ...ueberflug.voegel]) {
      if (!v.fliegt || !imBild(v.x, v.y, sicht, 6)) continue;
      tierZeichnen(TIERBILD.vogel[Math.sin(v.flap * 2) > 0 ? 0 : 1], v.x, v.y, v.a, 1 + v.z * 0.05);
    }
  }

  // --- Wetter ----------------------------------------------------------------
  // Jedes Wetter ist eine Mischung aus vier Stärken (0 bis 1). Beim Wechsel gleiten
  // die Stärken langsam zum neuen Wetter, so gibt es keine harten Sprünge.
  const WETTER = {
    sonne: { name: "Sonnig", icon: "☀️", wolken: 0.3, regen: 0, nebel: 0, wind: 0.15 },
    wolkig: { name: "Wolkig", icon: "⛅", wolken: 1, regen: 0, nebel: 0, wind: 0.35 },
    regen: { name: "Regen", icon: "🌧️", wolken: 1, regen: 1, nebel: 0.15, wind: 0.45 },
    nebel: { name: "Nebel", icon: "🌫️", wolken: 0.15, regen: 0, nebel: 1, wind: 0.05 },
    wind: { name: "Windig", icon: "🍃", wolken: 0.6, regen: 0, nebel: 0, wind: 1 },
  };
  const FOLGE = { sonne: ["wolkig", "wind", "nebel"], wolkig: ["sonne", "regen", "wind"], regen: ["wolkig"],
    nebel: ["sonne", "wolkig"], wind: ["wolkig", "sonne"] };
  const wetter = { art: opt.wetter || "sonne", fest: Boolean(opt.wetter), dauer: 80, ist: { ...WETTER[opt.wetter || "sonne"] } };
  function wetterSetzen(art, fest) {
    wetter.art = art; wetter.fest = fest; wetter.dauer = 70 + Math.random() * 60;
    // Symbol im runden Feld; bei einem Wechsel steht ein paar Sekunden der Name daneben
    const el = $("wetter");
    if (!el) return;
    const neu = el.dataset.art && el.dataset.art !== art;
    el.dataset.art = art; el.title = `Wetter: ${WETTER[art].name}`; el.setAttribute("aria-label", el.title);
    el.textContent = neu ? `${WETTER[art].icon} ${WETTER[art].name}` : WETTER[art].icon;
    el.classList.toggle("zeigen", Boolean(neu));
    clearTimeout(el.zeit);
    if (neu) el.zeit = setTimeout(() => { el.textContent = WETTER[art].icon; el.classList.remove("zeigen"); }, 4000);
  }
  function wetterSchritt(dt) {
    if (!wetter.fest && (wetter.dauer -= dt) <= 0) {
      const moeglich = FOLGE[wetter.art];
      wetterSetzen(moeglich[Math.floor(Math.random() * moeglich.length)], false);
    }
    const soll = WETTER[wetter.art], k = Math.min(1, dt * 0.25);
    for (const t of ["wolken", "regen", "nebel", "wind"]) wetter.ist[t] += (soll[t] - wetter.ist[t]) * k;
    // Wolken (und Nebelschwaden) ziehen mit dem Wind über die Karte
    const vx = 1 + wetter.ist.wind * 5, vy = 0.3 + wetter.ist.wind;
    for (const c of WOLKEN) {
      c.x += vx * dt * c.s; c.y += vy * dt * c.s;
      if (c.x - c.r > W + 40) c.x = -40 - c.r;
      if (c.y - c.r > W + 40) c.y = -40 - c.r;
    }
  }
  // Ein weicher Klecks aus mehreren Kreisen, einmal gemalt und dann nur noch kopiert
  function klecks(farbe) {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const g = c.getContext("2d");
    for (const [x, y, r] of [[128, 128, 90], [80, 110, 60], [175, 120, 65], [120, 165, 55], [150, 85, 55]]) {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, farbe); gr.addColorStop(1, farbe.replace(/[\d.]+\)$/, "0)"));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    return c;
  }
  const WOLKE = klecks("rgba(10,25,35,0.9)"), SCHWADE = klecks("rgba(235,240,238,0.9)");
  const WOLKEN = Array.from({ length: 60 }, () => ({ x: Math.random() * (W + 80) - 40, y: Math.random() * (W + 80) - 40,
    r: 8 + Math.random() * 10, s: 0.7 + Math.random() * 0.6 }));
  function wolkenZeichnen(sicht) {
    const { wolken, nebel: dunst } = wetter.ist;
    for (const c of WOLKEN) {
      if (c.x + c.r < sicht.x0 || c.x - c.r > sicht.x1 || c.y + c.r < sicht.y0 || c.y - c.r > sicht.y1) continue;
      if (wolken > 0.02) { ctx.globalAlpha = wolken * 0.4; ctx.drawImage(WOLKE, c.x - c.r, c.y - c.r, 2 * c.r, 2 * c.r); }
      if (dunst > 0.02) { ctx.globalAlpha = dunst * 0.55; ctx.drawImage(SCHWADE, c.x - c.r * 1.3, c.y - c.r, 2.6 * c.r, 2 * c.r); }
    }
    ctx.globalAlpha = 1;
  }
  // Regen, Pfützenringe, Blätter und Dunst liegen über dem Bild (Bildschirm-Koordinaten)
  const TROPFEN = Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random(), l: 0.6 + Math.random() * 0.6 }));
  const RINGE = Array.from({ length: 24 }, () => ({ x: Math.random(), y: Math.random(), t: Math.random() * 0.7 }));
  const BLAETTER = Array.from({ length: 22 }, () => ({ x: Math.random(), y: Math.random(), a: Math.random() * 6,
    f: ["#7a9a3a", "#a8782e", "#c4a03a", "#5d7d2e"][Math.floor(Math.random() * 4)] }));
  let wetterZeit = 0;
  function wetterBildschirm(w, h, dpr) {
    const { regen, nebel: dunst, wind, wolken } = wetter.ist;
    const jetzt = performance.now() / 1000, dt = Math.min(0.05, jetzt - (wetterZeit || jetzt));
    wetterZeit = jetzt;
    const bewegt = reduce ? 0 : dt;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Licht: bei Wolken und Regen etwas trüber, bei Nebel heller und blasser
    const trueb = wolken * 0.06 + regen * 0.16;
    if (trueb > 0.01) { ctx.fillStyle = `rgba(20,35,50,${trueb})`; ctx.fillRect(0, 0, w, h); }
    if (dunst > 0.01) { ctx.fillStyle = `rgba(228,234,232,${dunst * 0.32})`; ctx.fillRect(0, 0, w, h); }
    if (regen > 0.02) {
      const schraeg = 0.12 + wind * 0.25;
      ctx.strokeStyle = `rgba(205,222,235,${0.55 * regen})`; ctx.lineWidth = 1.2; ctx.lineCap = "round";
      ctx.beginPath();
      for (const d of TROPFEN.slice(0, Math.round(TROPFEN.length * regen))) {
        d.y += bewegt * 1.5 * d.l; d.x += bewegt * schraeg * 1.5 * d.l;
        if (d.y > 1) { d.y -= 1; d.x = Math.random(); }
        if (d.x > 1) d.x -= 1;
        const x = d.x * w, y = d.y * h, len = 16 * d.l;
        ctx.moveTo(x, y); ctx.lineTo(x - schraeg * len, y - len);
      }
      ctx.stroke();
      ctx.lineWidth = 1;
      for (const g of RINGE.slice(0, Math.round(RINGE.length * regen))) {
        g.t += bewegt;
        if (g.t > 0.7) { g.t = 0; g.x = Math.random(); g.y = Math.random(); }
        ctx.strokeStyle = `rgba(220,235,245,${(1 - g.t / 0.7) * 0.5 * regen})`;
        ctx.beginPath(); ctx.ellipse(g.x * w, g.y * h, 2 + g.t * 12, 1 + g.t * 6, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    const blatt = Math.max(0, (wind - 0.4) / 0.6);
    if (blatt > 0.02) {
      for (const b of BLAETTER.slice(0, Math.round(BLAETTER.length * blatt))) {
        b.x += bewegt * (0.22 + wind * 0.25); b.y += bewegt * Math.sin(jetzt * 2 + b.a) * 0.06; b.a += bewegt * 4;
        if (b.x > 1.05) { b.x = -0.05; b.y = Math.random(); }
        ctx.save(); ctx.translate(b.x * w, b.y * h); ctx.rotate(b.a);
        ctx.fillStyle = b.f; ctx.strokeStyle = "rgba(30,25,10,0.7)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, 0, 7, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // --- Tacho -------------------------------------------------------------------
  // Kleiner Rundtacho unten rechts: 0 bis 40 km/h auf einem Dreiviertelkreis
  const TACHO_MAX = 40;
  function tachoZeichnen() {
    const t = $("tacho");
    const dpr = Math.min(window.devicePixelRatio || 1, 2), g = t.clientWidth || 76;
    if (t.width !== Math.round(g * dpr)) { t.width = t.height = Math.round(g * dpr); }
    const c = t.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, g, g);
    const m = g / 2, r = g / 2 - 3, von = Math.PI * 0.75, bogen = Math.PI * 1.5;
    c.beginPath(); c.arc(m, m, r, 0, Math.PI * 2);
    c.fillStyle = "rgba(18,35,42,0.85)"; c.fill(); c.lineWidth = 2; c.strokeStyle = "rgba(0,0,0,0.5)"; c.stroke();
    const kmh = Math.abs(auto.v) * 3.6, anteil = Math.min(1, kmh / TACHO_MAX);
    c.lineCap = "round"; c.lineWidth = 5;
    c.beginPath(); c.arc(m, m, r - 7, von, von + bogen); c.strokeStyle = "rgba(233,239,230,0.15)"; c.stroke();
    if (anteil > 0.005) { c.beginPath(); c.arc(m, m, r - 7, von, von + bogen * anteil); c.strokeStyle = "#f2b632"; c.stroke(); }
    c.lineWidth = 1.5; c.strokeStyle = "rgba(233,239,230,0.6)";
    for (let i = 0; i <= 4; i++) { // Striche bei 0, 10, 20, 30, 40
      const w = von + bogen * i / 4;
      c.beginPath(); c.moveTo(m + Math.cos(w) * (r - 13), m + Math.sin(w) * (r - 13)); c.lineTo(m + Math.cos(w) * (r - 17), m + Math.sin(w) * (r - 17)); c.stroke();
    }
    const w = von + bogen * anteil;
    c.lineWidth = 2.5; c.strokeStyle = "#e8735f";
    c.beginPath(); c.moveTo(m, m); c.lineTo(m + Math.cos(w) * (r - 12), m + Math.sin(w) * (r - 12)); c.stroke();
    c.fillStyle = "#e9efe6"; c.beginPath(); c.arc(m, m, 3, 0, Math.PI * 2); c.fill();
    c.textAlign = "center"; c.textBaseline = "middle";
    c.font = "800 15px Nunito, sans-serif"; c.fillText(String(Math.round(kmh)), m, m + r * 0.5);
    c.font = "800 8px Nunito, sans-serif"; c.fillStyle = "rgba(233,239,230,0.7)";
    c.fillText(auto.v < -0.2 ? "R" : "km/h", m, m + r * 0.5 + 11);
  }

  // --- Schleife --------------------------------------------------------------
  let zuletzt = 0;
  function bild(t) {
    const dt = Math.min(0.05, (t - (zuletzt || t)) / 1000);
    zuletzt = t;
    if (cv.clientWidth) {
      if (Ton) Ton.musik(imWald(auto.x, auto.y) ? "wald" : "fahren");
      if (!fertig) schritt(dt); else auto.v *= 0.9;
      wetterSchritt(dt);
      tiereSchritt(dt);
      zeichne();
    }
    requestAnimationFrame(bild);
  }

  // --- Große Karte: Ziel wählen -------------------------------------------------
  const gross = $("gross"), gctx = gross.getContext("2d");
  let grossMass = null;
  function grossZeichnen() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const b = gross.getBoundingClientRect(), seite = Math.min(b.width, b.height);
    gross.width = Math.round(b.width * dpr); gross.height = Math.round(b.height * dpr);
    const k = seite / W, ox = (b.width - seite) / 2, oy = (b.height - seite) / 2;
    grossMass = { k, ox, oy };
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gctx.clearRect(0, 0, b.width, b.height);
    gctx.save(); gctx.translate(ox, oy);
    gctx.fillStyle = "#5d8a3e"; gctx.fillRect(0, 0, seite, seite);
    gctx.fillStyle = "#2c4d2a";
    for (const o of OBJEKTE) if (o.art === "nadelbaum" || o.art === "laubbaum") { gctx.beginPath(); gctx.arc(o.x * k, o.y * k, 2.2 * k, 0, 7); gctx.fill(); }
    gctx.strokeStyle = "#c9a26b"; gctx.lineWidth = Math.max(3, 4.5 * k); gctx.lineCap = "round"; gctx.lineJoin = "round";
    for (const w of WEGE) { gctx.beginPath(); gctx.moveTo(w[0][0] * k, w[0][1] * k); for (const [x, y] of w.slice(1)) gctx.lineTo(x * k, y * k); gctx.stroke(); }
    gctx.fillStyle = "#9a9a90"; gctx.beginPath(); for (const [x, y] of SCHROTT.zaun) gctx.lineTo(x * k, y * k); gctx.fill();
    gctx.drawImage(nebel, 0, 0, seite, seite);
    for (const h of HINDERNISSE) if (offen(h.x, h.y)) {
      gctx.fillStyle = "#1d1a16"; gctx.font = `800 ${Math.max(14, 16)}px Nunito, sans-serif`; gctx.textAlign = "center"; gctx.textBaseline = "middle";
      gctx.fillText("⚠", h.x * k, h.y * k);
    }
    // Wegweiser zuerst (klein), Orte darüber (groß); unbekannte Orte als Fragezeichen
    const sortiert = [...ZIELE].sort((a, b) => (a.art === "ort") - (b.art === "ort"));
    for (const z of sortiert) {
      if (!zielErlaubt(z)) continue;
      const x = z.x * k, y = z.y * k, frei = zielOffen(z);
      if (z.art === "weg" && frei) wegweiserZeichnen(x, y, z.name);
      else if (z.art === "ort" && frei) ortZeichnen(x, y, z.name);
      else if (z.art === "ort") unbekanntZeichnen(x, y);
    }
    gctx.save(); gctx.translate(auto.x * k, auto.y * k); gctx.rotate(auto.a);
    gctx.fillStyle = "#e9efe6"; gctx.strokeStyle = "#12232a"; gctx.lineWidth = 2;
    gctx.beginPath(); gctx.moveTo(9, 0); gctx.lineTo(-6, -6); gctx.lineTo(-6, 6); gctx.closePath(); gctx.fill(); gctx.stroke();
    gctx.restore(); gctx.restore();
  }
  function beschriftung(text, x, y, gross) {
    gctx.font = `800 ${gross ? 15 : 12}px Nunito, sans-serif`; gctx.textAlign = "center"; gctx.textBaseline = "middle";
    gctx.lineWidth = 4; gctx.strokeStyle = "rgba(255,250,240,0.95)"; gctx.fillStyle = gross ? "#12232a" : "#4a3420";
    gctx.strokeText(text, x, y); gctx.fillText(text, x, y);
  }
  // Ort: großer gelber Kreis mit Haus, fetter Name
  function ortZeichnen(x, y, name) {
    gctx.beginPath(); gctx.arc(x, y, 16, 0, 7);
    gctx.fillStyle = "#f2b632"; gctx.fill(); gctx.lineWidth = 3; gctx.strokeStyle = "#12232a"; gctx.stroke();
    gctx.fillStyle = "#12232a";
    gctx.beginPath(); gctx.moveTo(x - 8, y - 1); gctx.lineTo(x, y - 9); gctx.lineTo(x + 8, y - 1); gctx.closePath(); gctx.fill();
    gctx.fillRect(x - 6, y - 1, 12, 9);
    gctx.fillStyle = "#f2b632"; gctx.fillRect(x - 2, y + 3, 4, 5); // Tür
    beschriftung(name, x, y + 27, true);
  }
  // Wegweiser: kleines Holzschild am Pfosten, kleiner Name
  function wegweiserZeichnen(x, y, name) {
    gctx.lineWidth = 2; gctx.strokeStyle = "#12232a";
    gctx.fillStyle = "#6b4a2e"; gctx.fillRect(x - 1.5, y - 4, 3, 12); gctx.strokeRect(x - 1.5, y - 4, 3, 12);
    gctx.fillStyle = "#c9935a";
    gctx.beginPath(); gctx.moveTo(x - 9, y - 12); gctx.lineTo(x + 6, y - 12); gctx.lineTo(x + 10, y - 8); gctx.lineTo(x + 6, y - 4);
    gctx.lineTo(x - 9, y - 4); gctx.closePath(); gctx.fill(); gctx.stroke();
    beschriftung(name, x, y - 20, false);
  }
  // Noch unbekannter Ort: graues Fragezeichen ohne Namen
  function unbekanntZeichnen(x, y) {
    gctx.beginPath(); gctx.arc(x, y, 14, 0, 7);
    gctx.fillStyle = "rgba(120,100,70,0.75)"; gctx.fill();
    gctx.setLineDash([4, 3]); gctx.lineWidth = 2.5; gctx.strokeStyle = "#3a2a18"; gctx.stroke(); gctx.setLineDash([]);
    gctx.fillStyle = "#fffaf0"; gctx.font = "800 17px Nunito, sans-serif"; gctx.textAlign = "center"; gctx.textBaseline = "middle";
    gctx.fillText("?", x, y + 1);
  }
  function karteAuf() { if (!$("gespraech").hidden) return; $("grosskarte").hidden = false; grossZeichnen(); $("karteZu").focus(); }
  function karteZu() { $("grosskarte").hidden = true; }
  gross.addEventListener("click", (e) => {
    const b = gross.getBoundingClientRect(), { k, ox, oy } = grossMass;
    const x = e.clientX - b.left - ox, y = e.clientY - b.top - oy;
    // Unbekannte Wegweiser sind unsichtbar und daher auch nicht antippbar
    const z = ZIELE.find((q) => zielErlaubt(q) && (q.art === "ort" || zielOffen(q)) && Math.hypot(q.x * k - x, q.y * k - y) < 22);
    if (!z) return;
    if (z.kommt) { toast("Ein unbekannter Ort. Was dort wohl ist? (kommt später)"); return; }
    if (!zielOffen(z)) { toast(z.art === "ort" ? "Ein unbekannter Ort im Nebel. Finde ein Kartenstück!" : "Dieses Ziel liegt noch im Nebel."); return; }
    karteZu();
    planen(z);
  });
  $("karteAuf").addEventListener("click", karteAuf);
  mini.addEventListener("click", karteAuf);
  $("karteZu").addEventListener("click", karteZu);
  function schnellreise() {
    Object.assign(auto, { x: 150, y: 242.6, a: Math.PI / 2, v: 0 });
    route = null; fertig = false;
    $("meldung").hidden = true;
    if (opt.zurWerkstatt) opt.zurWerkstatt();
    else toast("Zurück in Opas Werkstatt. Hier baust du später die fehlenden Teile ein.");
  }
  $("zurWerkstatt").addEventListener("click", schnellreise);
  $("schnellreise").addEventListener("click", schnellreise);
  $("mZu").addEventListener("click", () => { $("meldung").hidden = true; });
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") { karteZu(); $("meldung").hidden = true; $("laden").hidden = true; } });

  // --- Tastatur (nur zum Testen) ---------------------------------------------
  const KEYS = { ArrowUp: "gas", KeyW: "gas", ArrowDown: "bremse", KeyS: "bremse", ArrowLeft: "links", KeyA: "links", ArrowRight: "rechts", KeyD: "rechts" };
  window.addEventListener("keydown", (e) => { const k = KEYS[e.code]; if (k && !(e.target instanceof HTMLSelectElement)) { taste[k] = true; route = null; e.preventDefault(); } });
  window.addEventListener("keyup", (e) => { const k = KEYS[e.code]; if (k) taste[k] = false; });
  window.addEventListener("blur", () => { for (const k in taste) taste[k] = false; });

  const wahl = $("auto");
  if (wahl) {
    for (const a of AUTOS) { const o = document.createElement("option"); o.value = a.id; o.textContent = a.name; wahl.append(o); }
    wahl.addEventListener("change", () => { autoWahl = AUTOS.find((a) => a.id === wahl.value); wahl.blur(); });
  }
  if ($("neu")) $("neu").addEventListener("click", neu);
  $("ziel").addEventListener("click", neu);

  // Geld-Anzeige und Laden-Fenster gehören zur Karte, damit beide Seiten sie haben
  // Anzeigen am Rand: oben links Ziel und Auftrag (.hud), rechts unter der Minikarte Wetter
  // und Münzen, unten rechts der Tacho
  const rechts = document.createElement("div");
  rechts.className = "hud-rechts"; rechts.setAttribute("aria-live", "polite");
  rechts.innerHTML = '<span id="wetter"></span><span id="geld" hidden></span>';
  $("karte").parentElement.append(rechts);
  const tacho = document.createElement("canvas");
  tacho.id = "tacho"; tacho.setAttribute("aria-hidden", "true");
  $("karte").parentElement.append(tacho);
  wetterSetzen(wetter.art, wetter.fest);
  if (opt.wetterWahl) {
    const sel = document.createElement("select");
    sel.id = "wetterWahl"; sel.setAttribute("aria-label", "Wetter");
    sel.innerHTML = '<option value="">Wetter: wechselt</option>' +
      Object.entries(WETTER).map(([k, v]) => `<option value="${k}">${v.icon} ${v.name}</option>`).join("");
    sel.addEventListener("change", () => { if (sel.value) wetterSetzen(sel.value, true); else wetter.fest = false; sel.blur(); });
    ($("neu") ? $("neu").parentElement : document.body).append(sel);
  }
  const laden = document.createElement("div");
  laden.id = "laden"; laden.hidden = true;
  laden.setAttribute("role", "dialog"); laden.setAttribute("aria-label", "Knuts Schrottladen");
  laden.innerHTML = '<div><strong>Knuts Schrottladen</strong><p class="kasse"></p><div class="waren"></div>' +
    '<p class="klein">Neue Ware kommt nach Aufträgen. Karosserie-Teile gibt es Stück für Stück.</p>' +
    '<div class="knoepfe"><button type="button" class="knopf zweit">Tschüss, Knut!</button></div></div>';
  laden.querySelector(".zweit").addEventListener("click", () => { laden.hidden = true; });
  const hupKnopf = document.createElement("button");
  hupKnopf.type = "button"; hupKnopf.id = "hupen"; hupKnopf.className = "knopf"; hupKnopf.hidden = true;
  hupKnopf.textContent = "📯 Hupen";
  $("zurWerkstatt").parentElement.prepend(hupKnopf);
  const stopp = document.createElement("button");
  stopp.type = "button"; stopp.id = "stopp"; stopp.className = "knopf"; stopp.hidden = true;
  stopp.addEventListener("click", () => { angehalten = !angehalten; stopp.classList.remove("tipp"); });
  $("karte").parentElement.append(stopp);
  cv.addEventListener("click", tippKarte);
  $("karte").parentElement.append(laden);
  hudNeu();

  // Erst bauen, wenn die Objektbilder da sind (Größen kommen aus den Daten, Bilder nur fürs Zeichnen)
  window.__kp = { get silben() { return Ton ? Ton.silben : 0; }, auto, planen, ZIELE, spiel, REIFEN, SAMMEL, HERDE, HINDERNISSE, GEBIETE, wetter, wetterSetzen, WOLKEN, VOEGEL, HASEN, SCHAFE, get route() { return route; }, get kamera() { return kamera; } }; // für automatische Tests
  karteBauen();
  // Platz um die Kartenstücke und Reifen freiräumen
  for (let k = OBJEKTE.length - 1; k >= 0; k--) if (OBJEKTE[k].art && [...STUECKE, ...SAMMEL].some((st) => Math.hypot(OBJEKTE[k].x - st.x, OBJEKTE[k].y - st.y) < 4)) OBJEKTE.splice(k, 1);
  netzBauen();
  gebieteStart();
  tiereStart();
  herdeSetzen();
  nebelNeu();
  requestAnimationFrame(bild);

  return {
    auto, gespraech, toast, karteAuf,
    // Auto für die Karte: "ohne" oder Modell-ID eines kompletten Satzes
    setzeAuto(id) { autoWahl = AUTOS.find((a) => a.id === id) || AUTOS[0]; },
    // Vor Opas Schuppen abstellen (Start und Schnellreise)
    zuHause() { Object.assign(auto, { x: 150, y: 242.6, a: Math.PI / 2, v: 0 }); route = null; fertig = false; },
    // Zum Testen: direkt vor Knuts Tor stellen und das erste Gespräch starten
    beiKnutAnkommen() { Object.assign(auto, { x: 230, y: 62, a: Math.PI / 2, v: 0 }); route = null; fertig = false; ankunft(); },
    karteNeu() { if ($("grosskarte").hidden === false) grossZeichnen(); },
    musik(name) { if (Ton) Ton.musik(name); }, // z. B. "werkstatt" (Spielstart)
    wetterFrei() { wetter.fest = false; wetter.dauer = 40; }, // ab jetzt wechselt das Wetter
  };
};
