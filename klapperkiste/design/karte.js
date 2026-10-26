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
  const AUTOS = D.autos.map((a) => ({ ...a, img: lade(a.bild) }));

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
  const WEGE = [WEG, ABZWEIG];
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
    const [bx0, by0, bx1, by1] = SCHUPPEN.bereich;
    if (x > bx0 - r - 3 && x < bx1 + r + 3 && y > by0 - r - 3 && y < by1 + r + 3) return false;
    if (x > SCHROTT.X - r - 3 && x < SCHROTT.X + SCHROTT.b + r + 3 && y > SCHROTT.Y - r - 3 && y < SCHROTT.Y + SCHROTT.h + r) return false;
    return !OBJEKTE.some((o) => o.r && Math.hypot(o.x - x, o.y - y) < o.r + r + 0.6);
  }

  const OBJEKTE = []; // {art, x, y, rot, s, spiegel, r (Kollision)}
  function setze(art, x, y, opt = {}) {
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
    zaun([[56, 204], [56, 224]]);
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
      const [sx0, sy0, sx1, sy1] = SCHUPPEN.haus;
      const hx = Math.max(sx0, Math.min(cx, sx1)), hy = Math.max(sy0, Math.min(cy, sy1));
      const d = Math.hypot(cx - hx, cy - hy);
      if (d < r && d > 0) schieb((cx - hx) / d, (cy - hy) / d, r - d);
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
    gespraech("knut", "Knut Kurbel", "schrottplatz", [
      ["hallo", `Na sieh mal einer an! Mit der Klapperkiste bis hierher, in ${zeit} Minuten? Respekt. Ich bin Knut Kurbel, mir gehört der ganze Schrott hier.`],
      ["nachdenken", "Hm … ohne Karosserie fährst du ja praktisch im Unterhemd durch die Gegend. Und die Reifen sind auch nicht mehr die jüngsten."],
      ["auftrag", "Pass auf: Draußen am Feldrand liegen drei alte Reifen herum. Bring sie mir, dann suche ich dir was Ordentliches aus dem Schrott raus."],
      ["juhu", "Abgemacht? Prima! Dann ab mit dir, der Schrott wartet nicht!"],
    ], () => {
      const a = $("auftrag");
      a.textContent = "Auftrag: 3 alte Reifen für Knut (kommt bald)";
      a.hidden = false;
      fertig = false;
      if (opt.nachKnut) opt.nachKnut();
    });
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
    zeile();
  }
  function zeile() {
    const [geste, text] = gZeilen[gNr];
    const fig = $("gFigur"), figuren = (D.figuren || {})[$("gespraech").dataset.figur] || {};
    if (figuren[geste]) {
      if (fig.src !== figuren[geste]) { fig.src = figuren[geste]; fig.classList.remove("neu"); void fig.offsetWidth; fig.classList.add("neu"); }
    }
    const p = $("gText");
    clearInterval(gTipp);
    if (reduce) { p.textContent = text; gTipp = null; return; }
    let i = 0;
    p.textContent = "";
    gTipp = setInterval(() => {
      i += 2;
      p.textContent = text.slice(0, i);
      if (i >= text.length) { clearInterval(gTipp); gTipp = null; }
    }, 30);
  }
  function weiter() {
    if (gTipp) { clearInterval(gTipp); gTipp = null; $("gText").textContent = gZeilen[gNr][1]; return; }
    gNr++;
    if (gNr < gZeilen.length) return zeile();
    $("gespraech").hidden = true;
    if (gEnde) gEnde();
  }
  $("gespraech").addEventListener("click", weiter);
  $("gespraech").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); weiter(); } });

  // --- Gebiete, Nebel und Kartenstücke --------------------------------------
  const GEBIETE = [
    { id: "start", name: "Rund um Opas Schuppen", x: 166, y: 262, r: 92, offen: true },
    { id: "nord", name: "Nordweg und Schrottplatz", x: 214, y: 112, r: 112, offen: false },
    { id: "wald", name: "Waldrand im Westen", x: 70, y: 196, r: 82, offen: false },
  ];
  const STUECKE = [
    { gebiet: "nord", x: 184, y: 213 },
    { gebiet: "wald", x: 213, y: 124 },
  ];
  // Kartenstücke für Gebiete, die schon offen sind, liegen gar nicht erst herum
  function gebieteStart() {
    for (const g of GEBIETE) g.offen = (opt.offen || ["start"]).includes(g.id) || location.hash === "#schrottplatz";
    for (const st of STUECKE) st.genommen = GEBIETE.find((g) => g.id === st.gebiet).offen;
  }
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
  function toast(text) {
    const t = $("toast");
    t.textContent = text; t.hidden = false;
    clearTimeout(toastZeit);
    toastZeit = setTimeout(() => { t.hidden = true; }, 3200);
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
  const NETZ_LINIEN = [[[150, 243], ...WEG], ABZWEIG];
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
      // Abzweigung: Anfang der Linie mit dem nächsten Punkt der Hauptlinie verbinden
      const j = naechsterKnoten(KNOTEN[anfang][0], KNOTEN[anfang][1], (k) => k < HAUPT);
      NACHBARN[anfang].push(j); NACHBARN[j].push(anfang);
    }
  }
  function naechsterKnoten(x, y, nur) {
    let best = -1, bd = Infinity;
    KNOTEN.forEach(([kx, ky], i) => { if (nur && !nur(i)) return; const d = Math.hypot(kx - x, ky - y); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  const ZIELE = [
    { id: "schuppen", name: "Opas Schuppen", x: 150, y: 243, gebiet: "start" },
    { id: "wegweiser", name: "Wegweiser", x: 181, y: 204, gebiet: "start" },
    { id: "schrottplatz", name: "Schrottplatz", x: 230, y: 60, gebiet: "nord" }, // parkt vor dem Tor
    { id: "waldweg", name: "Waldweg", x: 60, y: 214, gebiet: "wald" },
  ];
  const zielOffen = (z) => GEBIETE.find((g) => g.id === z.gebiet).offen;
  const zielErlaubt = (z) => !opt.zielErlaubt || opt.zielErlaubt(z);
  // Hindernisse auf dem Weg: hier hält das Auto, wenn ihm ein Teil fehlt
  const HINDERNISSE = [
    { x: 102, y: 208.5, r: 3, braucht: "licht", titel: "Zu dunkel!",
      text: "Hier beginnt der dunkle Wald. Ohne Licht sieht die Klapperkiste die Hand vor Augen nicht.",
      fehlt: "Es fehlt: Scheinwerfer (Kategorie Licht). Bau in der Werkstatt ein Licht ein." },
  ];
  const hatTeil = (teil) => (opt.hatTeil ? opt.hatTeil(teil) : false); // die Schrottkarre hat noch kein Licht

  // --- Selbst zum gewählten Ziel fahren ----------------------------------------
  let route = null, routeI = 0, zielWahl = null, haengt = 0, rueck = 0;
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
        const d = dist[i] + Math.hypot(KNOTEN[j][0] - KNOTEN[i][0], KNOTEN[j][1] - KNOTEN[i][1]);
        if (d < dist[j]) { if (dist[j] === Infinity) offenListe.push(j); dist[j] = d; von[j] = i; }
      }
    }
    if (ende !== start && von[ende] < 0) { toast("Dorthin führt kein Weg."); return; }
    const weg = [];
    for (let i = ende; i >= 0; i = von[i]) { weg.push(KNOTEN[i]); if (i === start) break; }
    route = weg.reverse(); routeI = 0; zielWahl = ziel; haengt = 0; fertig = false;
    $("meldung").hidden = true;
    toast(`Unterwegs zu: ${ziel.name}`);
    if (opt.unterwegs) opt.unterwegs(ziel);
  }
  function hindernisPruefen() {
    for (const h of HINDERNISSE) {
      if (hatTeil(h.braucht) || Math.hypot(h.x - auto.x, h.y - auto.y) > h.r + 2) continue;
      // nur anhalten, wenn die Route noch hinter das Hindernis führt
      if (!route.slice(routeI).some(([x, y]) => Math.hypot(x - h.x, y - h.y) < 1.5)) continue;
      route = null;
      $("mTitel").textContent = h.titel; $("mText").textContent = h.text; $("mFehlt").textContent = h.fehlt;
      $("meldung").hidden = false;
      $("zurWerkstatt").focus();
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
      if (zielWahl.id === "schrottplatz" && !besucht) ankunft();
      else if (zielWahl.id === "schuppen" && opt.zurWerkstatt) opt.zurWerkstatt();
      else toast(`Angekommen: ${zielWahl.name}`);
      return { gas: false, bremse: Math.abs(auto.v) > 0.3, lenk: 0 };
    }
    if (hindernisPruefen()) return { gas: false, bremse: true, lenk: 0 };
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
  const muster = {};
  function musterVon(name) {
    if (muster[name]) return muster[name];
    const b = BODEN[name];
    if (!b.img.complete || !b.img.naturalWidth) return null;
    const p = ctx.createPattern(b.img, "repeat");
    p.setTransform(new DOMMatrix().scale(b.meter / b.img.naturalWidth));
    return (muster[name] = p);
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

  function zeichne() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const m = Math.min(w, h) / 26; // Pixel pro Meter: kurze Bildseite zeigt 26 m
    const vor = Math.max(0, auto.v) * 1.2;
    const kx = auto.x + Math.cos(auto.a) * vor, ky = auto.y + Math.sin(auto.a) * vor;
    ctx.setTransform(dpr * m, 0, 0, dpr * m, dpr * (w / 2 - kx * m), dpr * (h / 2 - ky * m));
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
    zeichneWege("erde", WEG_BREITE + 1.4, 0.35);
    zeichneWege("erde", WEG_BREITE, 1);
    // Rand der Karte
    ctx.fillStyle = "rgba(10,20,15,0.85)";
    ctx.fillRect(-60, -60, W + 120, 60); ctx.fillRect(-60, W, W + 120, 60); ctx.fillRect(-60, 0, 60, W); ctx.fillRect(W, 0, 60, W);

    const sp = OBJ.schrottplatz;
    if (sp.img.complete && sp.img.naturalWidth) ctx.drawImage(sp.img, SCHROTT.X, SCHROTT.Y, sp.b, sp.h);
    const sch = OBJ.schuppen;
    if (sch.img.complete && sch.img.naturalWidth) ctx.drawImage(sch.img, SCHUPPEN.X, SCHUPPEN.Y, sch.b, sch.h);

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
      ctx.drawImage(img, -kurz / 2, -breit / 2, lang, breit);
      ctx.restore();
    }
    for (const o of OBJEKTE) zeichneObjekt(o, sicht);
    // Dunkler Wald hinter dem Hindernis
    const wg = ctx.createRadialGradient(62, 212, 8, 62, 212, 46);
    wg.addColorStop(0, "rgba(4,10,8,0.92)"); wg.addColorStop(0.75, "rgba(4,10,8,0.8)"); wg.addColorStop(1, "rgba(4,10,8,0)");
    ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(62, 212, 46, 0, Math.PI * 2); ctx.fill();
    // Nebel über unerforschten Gebieten
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(nebel, 0, 0, W, W);
    ctx.save();
    ctx.fillStyle = "rgba(90,70,45,0.75)"; ctx.font = "800 2.2px Nunito, sans-serif"; ctx.textAlign = "center";
    for (const g of GEBIETE) if (!g.offen && g.x > sicht.x0 - 20 && g.x < sicht.x1 + 20 && g.y > sicht.y0 - 20 && g.y < sicht.y1 + 20) {
      ctx.fillText("? Unerforscht ?", g.x, g.y); ctx.fillText("Kartenstück fehlt", g.x, g.y + 3);
    }
    ctx.restore();

    // Anzeige
    const u = untergrund(auto.x, auto.y);
    $("tempo").textContent = `${Math.round(Math.abs(auto.v) * 3.6)} km/h${auto.v < -0.2 ? " rückwärts" : ""}`;
    $("boden").textContent = u.name;
    $("weg").textContent = route ? `Ziel: ${zielWahl.name} · ${Math.round((route.length - routeI) * 2)} m` : besucht ? "Schrottplatz besucht" : `Schrottplatz: ${Math.round(Math.hypot(auto.x - SCHROTT.tor[0], auto.y - SCHROTT.tor[1]))} m Luftlinie`;
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
    }
    if (!miniGrund.mitNebel) { miniGrund.getContext("2d").drawImage(nebel, 0, 0, s, s); miniGrund.mitNebel = true; }
    mctx.drawImage(miniGrund, 0, 0);
    mctx.fillStyle = "#c0392b";
    for (const st of STUECKE) if (!st.genommen && offen(st.x, st.y)) { mctx.fillRect(st.x * k - 3, st.y * k - 3, 6, 6); }
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

  // --- Schleife --------------------------------------------------------------
  let zuletzt = 0;
  function bild(t) {
    const dt = Math.min(0.05, (t - (zuletzt || t)) / 1000);
    zuletzt = t;
    if (cv.clientWidth) {
      if (!fertig) schritt(dt); else auto.v *= 0.9;
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
    for (const z of ZIELE) {
      if (!zielErlaubt(z)) continue;
      const x = z.x * k, y = z.y * k, frei = zielOffen(z);
      gctx.beginPath(); gctx.arc(x, y, 13, 0, 7);
      gctx.fillStyle = frei ? "#f2b632" : "rgba(120,100,70,0.6)"; gctx.fill();
      gctx.lineWidth = 3; gctx.strokeStyle = "#12232a"; gctx.stroke();
      gctx.fillStyle = "#12232a"; gctx.font = "800 15px Nunito, sans-serif"; gctx.textAlign = "center"; gctx.textBaseline = "middle";
      gctx.fillText(frei ? "★" : "?", x, y + 1);
      if (frei) {
        gctx.font = "800 14px Nunito, sans-serif"; gctx.lineWidth = 4; gctx.strokeStyle = "rgba(255,250,240,0.95)";
        gctx.strokeText(z.name, x, y - 22); gctx.fillText(z.name, x, y - 22);
      }
    }
    gctx.save(); gctx.translate(auto.x * k, auto.y * k); gctx.rotate(auto.a);
    gctx.fillStyle = "#e9efe6"; gctx.strokeStyle = "#12232a"; gctx.lineWidth = 2;
    gctx.beginPath(); gctx.moveTo(9, 0); gctx.lineTo(-6, -6); gctx.lineTo(-6, 6); gctx.closePath(); gctx.fill(); gctx.stroke();
    gctx.restore(); gctx.restore();
  }
  function karteAuf() { if (!$("gespraech").hidden) return; $("grosskarte").hidden = false; grossZeichnen(); $("karteZu").focus(); }
  function karteZu() { $("grosskarte").hidden = true; }
  gross.addEventListener("click", (e) => {
    const b = gross.getBoundingClientRect(), { k, ox, oy } = grossMass;
    const x = e.clientX - b.left - ox, y = e.clientY - b.top - oy;
    const z = ZIELE.find((q) => zielErlaubt(q) && Math.hypot(q.x * k - x, q.y * k - y) < 22);
    if (!z) return;
    if (!zielOffen(z)) { toast("Dieses Ziel liegt noch im Nebel. Finde ein Kartenstück!"); return; }
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
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") { karteZu(); $("meldung").hidden = true; } });

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

  // Erst bauen, wenn die Objektbilder da sind (Größen kommen aus den Daten, Bilder nur fürs Zeichnen)
  window.__kp = { auto, planen, ZIELE, get route() { return route; } }; // für automatische Tests
  karteBauen();
  // Platz um die Kartenstücke freiräumen
  for (let k = OBJEKTE.length - 1; k >= 0; k--) if (OBJEKTE[k].art && STUECKE.some((st) => Math.hypot(OBJEKTE[k].x - st.x, OBJEKTE[k].y - st.y) < 4)) OBJEKTE.splice(k, 1);
  netzBauen();
  gebieteStart();
  nebelNeu();
  requestAnimationFrame(bild);

  return {
    auto, gespraech, toast, karteAuf,
    // Auto für die Karte: "ohne" oder Modell-ID eines kompletten Satzes
    setzeAuto(id) { autoWahl = AUTOS.find((a) => a.id === id) || AUTOS[0]; },
    // Vor Opas Schuppen abstellen (Start und Schnellreise)
    zuHause() { Object.assign(auto, { x: 150, y: 242.6, a: Math.PI / 2, v: 0 }); route = null; fertig = false; },
    karteNeu() { if ($("grosskarte").hidden === false) grossZeichnen(); },
  };
};
