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
  // Kartengröße in Metern: 480 × 320 (7,5 × 5 Abschnitte à 64 m). Bis x = 320 das alte Tal,
  // östlich davon Landstraße und Dorf (G11)
  const WX = 480, WY = 320;

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
  // eigener Zufall für den Osten (Landstraße, Dorf): so bleibt im alten Tal alles, wo es war
  let seedOst = 4711;
  const rndOst = () => ((seedOst = (seedOst * 1664525 + 1013904223) >>> 0) / 4294967296);

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
  // Alter Holzweg: von der Försterhütte durch den dunklen Wald nach Süden zum Campingplatz
  // am Waldsee. Versperrt von umgestürzten Bäumen, bis Moos sie wegzieht (spiel.holzweg).
  const HOLZWEG = [[45, 212], [36, 232], [22, 252], [18, 272], [26, 287], [37, 289.4]];
  // Alter Anglerpfad: von der Schleife südlich von Opas Schuppen nach Westen ans Ostufer des
  // Waldsees, wo nachts die Lichter tanzen (G8, Spur zu Kauz)
  const UFERPFAD = [[150, 290], [137, 295], [124, 299], [114, 300.5]];
  // Reifenspuren vom Ostufer durchs dichte Schilf nach Norden zu Kauz' versteckter Werkstatt (G9).
  // Das Schilf geht nur mit dem Mähbalken (Kategorie Vorne) weg.
  const SCHILFPFAD = [[114, 300.5], [119.5, 292], [119.5, 284], [114.5, 279]];
  // Mühlenweg (G10): vom Ende des Feldwegs nach Norden über die morsche Brücke am Mühlbach zur Mühle
  const MUEHLENWEG = [[300, 85], [302, 74], [300.5, 63], [297.5, 56], [295.5, 50]]; // endet im Hof (Weg im Mühlenbild)
  // Landstraße (G4/G11): von der Weide nach Osten zum Ortseingang von Klappertal-Dorf. Moos zeichnet
  // sie nach Pieps' Rückkehr ein (seine alte Talkarte). Am Ortsschild ist die Straße noch gesperrt.
  const LANDSTRASSE = [[299, 250], [318, 247], [342, 243], [366, 246], [388, 250]];
  // Klappertal-Dorf (G11): Bilder von oben mit linker oberer Ecke (X, Y); haus = Gebäude (Kollision),
  // Marktplatz mit Brunnen in der Mitte, die Straße läuft unten um den Brunnen herum
  const DORF = { schild: [356, 238.5], fest: [360, 245.3], flaeche: [366, 196, 478, 304],
    platz: { X: 392, Y: 237.2 }, brunnen: [410.3, 250, 3.5], // Platz 36 m breit
    eis: { X: 372, Y: 233, haus: [375.4, 233, 387.8, 241.4] },
    wache: { X: 432, Y: 226, haus: [436.8, 226, 449.5, 235.2] },
    haeuser: [{ bild: "dorfhaus_1", X: 458, Y: 236, haus: [460, 236, 469.5, 244] },
      { bild: "dorfhaus_2", X: 434, Y: 253.5, haus: [436, 253.5, 444.5, 260.5] }] };
  const DORFSTRASSE = [[388, 250], [402.5, 249.5], [408, 255.6], [413.5, 255.6], [419.5, 250], [472, 250]];
  const DORF_HAEUSER = [DORF.eis.haus, DORF.wache.haus, ...DORF.haeuser.map((h) => h.haus)];
  const WEGE = [WEG, ABZWEIG, FELDRAND, WEIDEWEG, HOFWEG, FELDERWEG, WALDPFAD, HOLZWEG, UFERPFAD, SCHILFPFAD, MUEHLENWEG, LANDSTRASSE, DORFSTRASSE];
  const WEGE_OST = [LANDSTRASSE, DORFSTRASSE]; // Bäume und Büsche daran mit eigenem Zufall (rndOst)
  const WEGE_ALT = WEGE.filter((w) => !WEGE_OST.includes(w));
  // Campingplatz (Bild 30 m breit), Einfahrt links, Steg rechts zum Waldsee
  const CAMPING = { X: 37, Y: 282, b: 30, bereich: [37, 282, 67, 302.1],
    haeuser: [[46.6, 282, 51.7, 287.4], [57.4, 285.8, 62.5, 290.2]] };
  // Kauz' Werkstatt (Bild 24 m breit) am Nordostufer des Waldsees, im Schilf versteckt.
  // Sichtbar erst, wenn Opa von Kauz erzählt hat. Haus = Schuppen mit Blechdach.
  const KAUZ = { X: 92, Y: 271, b: 24, bereich: [92, 271, 116, 287.1], haus: [95.8, 271, 108.3, 278.8] };
  // Mühle der Müllerin (Bild 22 m breit) hinter den Feldern im Norden, Mitte bei (x, y)
  // Bild 22 m breit (33,8 m hoch), linke obere Ecke bei (X, Y); der Weg im Bild läuft unten in den Mühlenweg.
  // Haus = Dach und Veranda, aus dem Bild vermessen.
  const MUEHLE = { X: 284.5, Y: 26.2, b: 22, bereich: [284.5, 26, 306.5, 60], haus: [289.5, 27.5, 305, 42] };
  // Mühlbach: Linie, an der morschen Holzbrücke (BRUECKE) quert der Mühlenweg
  const BACH = [[246, 60], [262, 63.5], [278, 66], [292, 67.5], [301.2, 68], [310, 66.5], [322, 63]];
  const BACH_BREITE = 3.2, BRUECKE = { x: 301.2, y: 68, kg: 120 };
  const imBach = (x, y, rand = 0) => BACH.some((q, k) => k > 0 && abstandStrecke(x, y, BACH[k - 1], q) < BACH_BREITE / 2 + rand);
  // Waldsee: Kreise (x, y, r), Sandufer drumherum
  const SEE = [[81, 294, 13], [93, 302, 10], [75, 306, 8]];
  const imSee = (x, y, rand = 0) => SEE.some(([sx, sy, sr]) => Math.hypot(x - sx, y - sy) < sr + rand);
  const WEG_BREITE = 4.5;
  // Wege an den Knicken abrunden (Bogen, je Seite bis 9 m, höchstens die halbe Strecke),
  // damit sie natürlich aussehen und das Auto die Kurven flüssig nimmt. Wege, die an einem
  // anderen Weg beginnen oder enden (Abzweigungen), rücken danach auf den gerundeten Weg.
  (function wegeRunden() {
    const vorher = WEGE.map((w) => w.map((q) => q.slice()));
    for (const w of WEGE) {
      const neu = [w[0]];
      for (let i = 1; i < w.length - 1; i++) {
        const [ax, ay] = w[i - 1], [px, py] = w[i], [bx, by] = w[i + 1];
        const la = Math.hypot(ax - px, ay - py), lb = Math.hypot(bx - px, by - py), r = Math.min(9, la / 2, lb / 2);
        const p1 = [px + (ax - px) / la * r, py + (ay - py) / la * r], p2 = [px + (bx - px) / lb * r, py + (by - py) / lb * r];
        for (let k = 0; k <= 6; k++) {
          const t = k / 6, u = 1 - t;
          const q = [u * u * p1[0] + 2 * u * t * px + t * t * p2[0], u * u * p1[1] + 2 * u * t * py + t * t * p2[1]];
          const l = neu[neu.length - 1];
          if (Math.hypot(q[0] - l[0], q[1] - l[1]) > 0.01) neu.push(q); // keine doppelten Punkte (Strecke der Länge 0)
        }
      }
      neu.push(w[w.length - 1]);
      w.length = 0; w.push(...neu);
    }
    const aufWeg = (q, w) => { // nächster Punkt auf dem Weg w
      let best = q, bd = Infinity;
      for (let i = 1; i < w.length; i++) {
        const [ax, ay] = w[i - 1], dx = w[i][0] - ax, dy = w[i][1] - ay;
        const t = Math.max(0, Math.min(1, ((q[0] - ax) * dx + (q[1] - ay) * dy) / (dx * dx + dy * dy)));
        const x = ax + t * dx, y = ay + t * dy, d = Math.hypot(q[0] - x, q[1] - y);
        if (d < bd) { bd = d; best = [x, y]; }
      }
      return best;
    };
    vorher.forEach((alt, i) => {
      for (const ende of [0, alt.length - 1]) {
        const j = vorher.findIndex((v, k) => k !== i && v.some((_, s) => s > 0 && abstandStrecke(alt[ende][0], alt[ende][1], v[s - 1], v[s]) < 1.5));
        if (j >= 0) WEGE[i][ende === 0 ? 0 : WEGE[i].length - 1] = aufWeg(alt[ende], WEGE[j]);
      }
    });
  })();

  function abstandStrecke(px, py, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], ll = dx * dx + dy * dy;
    const t = ll ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / ll)) : 0;
    return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
  }
  function abstandWeg(px, py, wege = WEGE) {
    let m = Infinity;
    for (const w of wege) for (let i = 1; i < w.length; i++) m = Math.min(m, abstandStrecke(px, py, w[i - 1], w[i]));
    return m;
  }
  // vis: sichtbarer Halbmesser des neuen Objekts. Felsen, Büsche und Bäume dürfen sich im
  // Bild nicht überlagern; nur Nadelbäume stehen im Wald etwas dichter.
  function frei(x, y, r, vis = r, art = null) {
    // Beim Setzen im alten Tal zählen die Wege im Osten nicht (sonst verschöbe sich dort alles);
    // was dann auf der Landstraße steht, räumt karteBauen() wieder weg
    if (abstandWeg(x, y, zq === rnd ? WEGE_ALT : WEGE) < WEG_BREITE / 2 + r + 1.5) return false;
    if (ZAEUNE.some(([a, b]) => abstandStrecke(x, y, a, b) < vis + 0.3)) return false;
    if (imSee(x, y, vis + 1.5) || imBach(x, y, vis + 1)) return false;
    for (const [bx0, by0, bx1, by1] of [SCHUPPEN.bereich, HUETTE.bereich, HOF.bereich, FOERSTER.bereich, CAMPING.bereich, KAUZ.bereich, MUEHLE.bereich]) {
      if (x > bx0 - r - 3 && x < bx1 + r + 3 && y > by0 - r - 3 && y < by1 + r + 3) return false;
    }
    if (x > SCHROTT.X - r - 3 && x < SCHROTT.X + SCHROTT.b + r + 3 && y > SCHROTT.Y - r - 3 && y < SCHROTT.Y + SCHROTT.h + r) return false;
    return !OBJEKTE.some((o) => {
      const d = Math.hypot(o.x - x, o.y - y);
      if (!o.vis) return o.r && d < o.r + r + 0.6; // reine Kollisionskreise (Schrottplatz)
      const wald = o.art === "nadelbaum" && art === "nadelbaum"; // nur im Nadelwald dürfen sich Kronen berühren
      return d < (o.vis + vis) * (wald ? 0.75 : 1.05);
    });
  }

  const OBJEKTE = []; // {art, x, y, rot, s, spiegel, r (Kollision)}
  let zq = rnd; // Zufallsquelle beim Setzen (im Osten rndOst, damit im alten Tal alles bleibt, wo es war)
  const NADELWALD = [[0, 100, 125, 255], [0, 250, 135, 320]]; // wie die Nadelbaum-Flächen unten
  function setze(art, x, y, opt = {}) {
    // In den Nadelwäldern stechen helle Laubbäume heraus: dort wird ein Nadelbaum daraus
    if (art === "laubbaum" && NADELWALD.some(([x0, y0, x1, y1]) => x > x0 && x < x1 && y > y0 && y < y1)) art = "nadelbaum";
    const o = OBJ[art], s = opt.s ?? 0.85 + zq() * 0.3;
    const r = opt.r ?? (art === "felsbrocken" ? 0.42 : art === "busch" ? 0.4 : 0.3) * o.b * s;
    const vis = art === "zaun" ? 0 : 0.5 * o.b * s;
    if (!opt.fest && !frei(x, y, r, vis, art)) return false;
    OBJEKTE.push({ art, x, y, rot: opt.rot ?? (zq() - 0.5) * 0.7, s, spiegel: opt.spiegel ?? zq() < 0.5, r: opt.ohne ? 0 : r, vis });
    return true;
  }
  function streue(art, anzahl, x0, y0, x1, y1, ausser = null) {
    for (let i = 0, n = 0; i < anzahl * 8 && n < anzahl; i++) {
      const x = x0 + zq() * (x1 - x0), y = y0 + zq() * (y1 - y0);
      if (ausser && x > ausser[0] && x < ausser[2] && y > ausser[1] && y < ausser[3]) continue;
      if (setze(art, x, y)) n++;
    }
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
    streue("nadelbaum", 110, 6, 100, 120, 250);
    streue("laubbaum", 30, 10, 110, 120, 250);
    streue("laubbaum", 30, 6, 6, 200, 100);
    // Im Osten bei Hof, Feldern und Mühle Laubbäume wie auf dem Bild der Mühle (keine Tannen)
    streue("laubbaum", 26, 250, 80, 314, 200);
    streue("laubbaum", 10, 252, 8, 318, 76);
    streue("laubbaum", 18, 100, 306, 314, 318);
    streue("laubbaum", 12, 170, 120, 250, 200);
    streue("nadelbaum", 20, 10, 255, 130, 316);
    // Ein paar Büsche und Felsen am Wegrand, die meisten verstreut über die Wiesen (siehe unten)
    const amWegrand = (wege) => {
      for (const w of wege) for (let i = 1; i < w.length; i++) for (let t = 0; t < 1; t += 0.2) {
        const x = w[i - 1][0] + (w[i][0] - w[i - 1][0]) * t, y = w[i - 1][1] + (w[i][1] - w[i - 1][1]) * t;
        const seite = zq() < 0.5 ? -1 : 1, d = 4.2 + zq() * 4;
        const nx = -(w[i][1] - w[i - 1][1]), ny = w[i][0] - w[i - 1][0], nl = Math.hypot(nx, ny);
        if (zq() < 0.07) setze(zq() < 0.7 ? "busch" : "felsbrocken", x + nx / nl * d * seite, y + ny / nl * d * seite);
      }
    };
    amWegrand(WEGE_ALT);
    streue("felsbrocken", 6, 180, 10, 314, 120);
    streue("busch", 10, 130, 120, 260, 300);
    // über die ganze Karte verteilt, damit nicht alles am Straßenrand klebt (Büsche im Wald fallen unten wieder weg)
    streue("felsbrocken", 60, 4, 4, 316, 316);
    streue("busch", 130, 4, 4, 316, 316);
    // Dichter dunkler Wald: viele Nadelbäume und einige Laubbäume, nur in der Waldfläche
    for (let i = 0, n = 0; i < 2000 && n < 150; i++) {
      const x = rnd() * 110, y = 140 + rnd() * 130;
      if (imWald(x, y, -3) && setze("nadelbaum", x, y)) n++;
    }
    // Tannen rund um den Waldsee, mit etwas Abstand zum Sandufer
    for (const [sx, sy, sr] of SEE) {
      for (let i = 0, n = 0; i < 80 && n < Math.round(sr * 0.9); i++) {
        const w = rnd() * Math.PI * 2, d = sr + 4.5 + rnd() * 5, ty = sy + Math.sin(w) * d;
        if (ty < WY - 4 && setze("nadelbaum", sx + Math.cos(w) * d, ty)) n++;
      }
    }
    // Helle Laubbäume, Büsche und Felsen passen nicht in den dunklen Nadelwald (unter dem
    // hohen Walddach sieht man den Boden nicht)
    for (let k = OBJEKTE.length - 1; k >= 0; k--) {
      const o = OBJEKTE[k];
      if ((o.art === "laubbaum" || o.art === "busch") && imWald(o.x, o.y, -4)) OBJEKTE.splice(k, 1);
      else if (o.art === "felsbrocken" && imWald(o.x, o.y, 2)) OBJEKTE.splice(k, 1);
    }
    // Wie in der Rallye: Nadelbäume dicht am Waldweg, ihre Kronen ragen über den Weg
    for (const w of [ABZWEIG, WALDPFAD, HOLZWEG]) for (let i = 1; i < w.length; i++) {
      const [ax, ay] = w[i - 1], [bx, by] = w[i], l = Math.hypot(bx - ax, by - ay);
      for (let s = 1.5; s < l; s += 3.2 + rnd() * 1.6) for (const seite of [-1, 1]) {
        if (rnd() < 0.2) continue;
        const x = ax + (bx - ax) * s / l, y = ay + (by - ay) * s / l, d = WEG_BREITE / 2 + 0.9 + rnd() * 0.9;
        const tx = x - (by - ay) / l * d * seite, ty = y + (bx - ax) / l * d * seite;
        if (!imWald(tx, ty, -3) || abstandWeg(tx, ty) < WEG_BREITE / 2 + 0.8) continue;
        if ([FOERSTER.bereich, CAMPING.bereich, KAUZ.bereich].some(([a, b, c, e]) => tx > a - 2 && tx < c + 2 && ty > b - 2 && ty < e + 2)) continue;
        if (OBJEKTE.some((o) => o.art === "nadelbaum" && Math.hypot(o.x - tx, o.y - ty) < 2.6)) continue;
        setze("nadelbaum", tx, ty, { fest: true, r: 0.45 });
      }
    }
    // Der Osten (Landstraße und Dorf) mit eigenem Zufall: Wiesen mit Laubbäumen, Büschen und Felsen,
    // die Dorffläche bleibt frei für die Häuser (G11)
    for (let k = OBJEKTE.length - 1; k >= 0; k--) {
      const o = OBJEKTE[k];
      if (o.art && o.art !== "zaun" && abstandWeg(o.x, o.y, WEGE_OST) < WEG_BREITE / 2 + (o.r || 0) + 1.5) OBJEKTE.splice(k, 1);
    }
    zq = rndOst;
    amWegrand([LANDSTRASSE]);
    streue("laubbaum", 45, 322, 6, 476, 316, DORF.flaeche);
    streue("busch", 40, 322, 6, 476, 316, DORF.flaeche);
    streue("felsbrocken", 12, 322, 6, 476, 316, DORF.flaeche);
    setze("schild", DORF.schild[0], DORF.schild[1], { fest: true, rot: 0, s: 1, spiegel: false, r: 0.5 });
    OBJEKTE.push({ art: null, x: DORF.brunnen[0], y: DORF.brunnen[1], r: DORF.brunnen[2] }); // Brunnen (nur Kollision)
    zq = rnd;
    OBJEKTE.sort((a, b) => a.y - b.y);
  }

  // Blumenwiesen-Flecken (Gras mit Blumen) über dem ruhigen Gras
  const FLECKEN = [];
  for (let i = 0; i < 40; i++) FLECKEN.push([rnd() * 320, rnd() * WY, 6 + rnd() * 14]);
  for (let i = 0; i < 20; i++) FLECKEN.push([320 + rndOst() * (WX - 320), rndOst() * WY, 6 + rndOst() * 14]);

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
    Object.assign(spiel, { auftrag: null, geld: 0, beutel: 0, gekauft: new Set(), teile: new Set(), hilde: null,
      opa: null, moosRallye: false, donnerkeil: [], moosSeil: null, holzweg: false, rosi: null, rallye: null, knutMoped: false, neben: nebenStart(), ...verbrauchStart() });
    hinweisGezeigt = false; angehalten = false; moosKennt = false; bertaSetzen(); piepsSetzen();
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
    // 22 km/h auf dem Feldweg, mit Platten langsam, nachts ohne Licht gar nicht
    if (route && !kannFahren()) zuDunkel();
    const vmax = 6.2 * u.f * (spiel.platt ? 0.45 : 1) * (kannFahren() ? 1 : 0);
    const ctl = steuerAuto(dt) || { gas: taste.gas, bremse: taste.bremse, lenk: (taste.rechts ? 1 : 0) - (taste.links ? 1 : 0) };
    if (tankLeer()) ctl.gas = false; // ohne Sprit rollt das Auto nur noch aus
    let acc = 0;
    auto.gas = ctl.gas; // für das Motorgeräusch
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
    if (spiel.platt && Math.abs(auto.v) > 0.5) auto.wackel += (Math.random() - 0.5) * 0.08;
    verbrauchen(Math.abs(auto.v) * dt, u.name === "Wiese", dt);
    stoss();
    auto.x = Math.max(2, Math.min(WX - 2, auto.x));
    auto.y = Math.max(2, Math.min(WY - 2, auto.y));
    if (Math.abs(auto.v) > 0.3 && start === null) start = performance.now();
    for (const st of STUECKE) if (!st.genommen && Math.hypot(st.x - auto.x, st.y - auto.y) < 2.4) stueckFinden(st);
    reifenPruefen();
    if (!fertig && !besucht && imSchrottplatz(auto.x, auto.y) && auto.y < SCHROTT.tor[1] - 5) ankunft(); // nur beim Testen per Tastatur
  }

  // Auto als zwei Kreise (vorne, hinten) gegen Bäume, Felsen, Schuppen und Zäune
  function stoss() {
    const r = 0.85;
    let getroffen = false, fels = false;
    for (const s of [1.1, -1.1]) {
      let cx = auto.x + Math.cos(auto.a) * s, cy = auto.y + Math.sin(auto.a) * s;
      const schieb = (nx, ny, tief) => { auto.x += nx * tief; auto.y += ny * tief; cx += nx * tief; cy += ny * tief; getroffen = true; };
      for (const o of OBJEKTE) {
        if (!o.r || Math.abs(o.x - cx) > 6 || Math.abs(o.y - cy) > 6) continue;
        const d = Math.hypot(cx - o.x, cy - o.y), tief = o.r + r - d;
        if (tief > 0 && d > 0) { schieb((cx - o.x) / d, (cy - o.y) / d, tief); if (o.art === "felsbrocken") fels = true; }
      }
      for (const [a, b] of ZAEUNE) {
        const d = abstandStrecke(cx, cy, a, b), tief = 0.35 + r - d;
        if (tief <= 0) continue;
        const dx = b[0] - a[0], dy = b[1] - a[1], ll = Math.hypot(dx, dy);
        let nx = -dy / ll, ny = dx / ll;
        if ((cx - a[0]) * nx + (cy - a[1]) * ny < 0) { nx = -nx; ny = -ny; }
        schieb(nx, ny, tief);
      }
      // Hindernisse (Schafherde, dunkler Wald) lassen ohne das passende Teil niemanden durch,
      // auch nicht beim Wenden oder Zurücksetzen davor
      for (const h of HINDERNISSE) {
        if (h.weg || (hatTeil(h.braucht) && !h.aktion)) continue;
        const d = Math.hypot(cx - h.x, cy - h.y), tief = h.r + r - d;
        if (tief > 0 && d > 0) schieb((cx - h.x) / d, (cy - h.y) / d, tief);
      }
      // nicht in den Mühlbach (nur über die Brücke)
      for (let k = 1; k < BACH.length; k++) {
        if (Math.hypot(cx - BRUECKE.x, cy - BRUECKE.y) < 3) break;
        const [ax, ay] = BACH[k - 1], [bx, by] = BACH[k], dx = bx - ax, dy = by - ay;
        const tt = Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / (dx * dx + dy * dy)));
        const nx = cx - (ax + tt * dx), ny = cy - (ay + tt * dy), d = Math.hypot(nx, ny), tief = BACH_BREITE / 2 + r - d;
        if (tief > 0 && d > 0) schieb(nx / d, ny / d, tief);
      }
      for (const [wx, wy, wr] of SEE) { // nicht in den See
        const d = Math.hypot(cx - wx, cy - wy), tief = wr + r - d;
        if (tief > 0 && d > 0) schieb((cx - wx) / d, (cy - wy) / d, tief);
      }
      for (const [sx0, sy0, sx1, sy1] of [SCHUPPEN.haus, HUETTE.haus, FOERSTER.haus, ...HOF.haeuser, ...CAMPING.haeuser, ...(spiel.neben.kauz ? [KAUZ.haus] : []), MUEHLE.haus, ...DORF_HAEUSER]) {
        const hx = Math.max(sx0, Math.min(cx, sx1)), hy = Math.max(sy0, Math.min(cy, sy1));
        const d = Math.hypot(cx - hx, cy - hy);
        if (d < r && d > 0) schieb((cx - hx) / d, (cy - hy) / d, r - d);
      }
    }
    if (getroffen) {
      if (fels && Math.abs(auto.v) > 2.5 && performance.now() - rumms > 600 && Math.random() < 0.35) plattMachen("Rumms, ein Felsen!");
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
      ["nachdenken", "Und wenn der Tank leer wird oder dein Beutel voll ist: Bei mir kannst du immer tanken, und Kram vom Wegrand kauf ich dir ab."],
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
  // Teile im Laden (je einmal), kommen als Lieferung nach Aufträgen. Karosserien gibt es
  // nur als Belohnung.
  const MOPED_PREIS = 100;
  const LADEN = [
    { id: "spezialhupe", name: "📯 Spezialhupe", preis: 25, ab: () => spiel.auftrag === "erledigt" },
    // nach der ersten Rallye-Fahrt: schneller als der Rasenmäher, damit Bronze ohne perfekte Runde klappt
    { id: "mopedmotor", name: "🏍️ Mopedmotor", preis: MOPED_PREIS, ab: () => Boolean(spiel.rallye) },
  ];
  // auftrag: null | "reifen" | "batterie" | "erledigt"; teile: Belohnungen (für die Kartenprobe ohne Werkstatt)
  // sprit: Meter im Tank (null: voll), strom: Ladung der Lichtbatterie in Prozent, platt: Reifen
  // platt, vorrat: Verbrauchsartikel im Beutel, material: gefundene Materialien im Beutel
  // opa: null | "rennen" (hat vom Rennen und vom Donnerkeil erzählt); moosRallye: Moos hat
  // von der Waldrallye erzählt; donnerkeil: gefundene Teile von Opas altem Rennwagen
  const spiel = { auftrag: null, geld: 0, beutel: 0, gekauft: new Set(), teile: new Set(), hilde: null,
    opa: null, moosRallye: false, donnerkeil: [], moosSeil: null, holzweg: false, rosi: null, rallye: null, knutMoped: false, neben: nebenStart(), ...verbrauchStart() };
  // Nebenaufträge, die parallel zur Rallye entstehen (man kann sie vorher oder nachher machen):
  // kuh (Hilde): null | "suchen" | "heim" | "erledigt"; vogelhaus (Moos): null | "auftrag" | "erledigt";
  // motor (Rosi → Knut → Rosi): null | "zuKnut" | "zurueck" | "erledigt"
  // lichter (Moos, G8): null | "auftrag" | "bolzen" (Bolzen gefunden, zu Opa) | "erledigt"
  // kauz: null | "suchen" (Opa hat von Kauz erzählt, Spuren führen ins Schilf) | "gefunden" (G9)
  // maehbalken (Hilde, G9): null | "auftrag" (2 Schrauben, 1 Feder) | "erledigt"
  // muehle (G10, Die Mühlenkurve): null | "opa1" (Kauz will den Bolzen, zu Opa) | "kauz" (Opa weigert sich)
  //   | "opa2" (Kauz fragt heimlich nach Opa) | "muellerin" (Opa schickt zur Mühle) | "mrad" (Mühlrad: 2 Federn,
  //   2 Schrauben) | "foto" (Foto von der Mühlenkurve, zu Kauz) | "kauzlacht" (zu Opa) | "versoehnt"
  // pieps (Moos, G4): null | "suchen" (Pieps ist ausgebüxt) | "dabei" (sitzt auf dem Auto) | "erledigt";
  //   piepsOrt: wo er sitzt (Index in PIEPS_ORTE)
  // dorf (G11): null | "offen" (Funke hat die Absperrung geöffnet)
  // slalom (Funke, G11): null | "huetchen" (6 Hütchen suchen, genommene in huetchenWeg) | "offen" (Strecke steht)
  //   | "medaille" (erste Medaille, Donnerkeil-Sitz bekommen); slalomBest, slalomMedaille; opaSitz: Opa hat ihn gesehen
  // eis (Gino, G11): null | "opa" (Erdbeerbecher unterwegs) | "neu1" (geschmolzen, zurück zu Gino) | "gino2" |
  //   "zweit" (Vanillebecher zu eisZiel: "muellerin" oder "hilde") | "neu2" | "dank" | "erledigt"; eisRest: 0 … 100
  function nebenStart() {
    return { kuh: null, vogelhaus: null, motor: null, lichter: null, kauz: null, maehbalken: null, muehle: null, pieps: null, piepsOrt: 0,
      dorf: null, eis: null, eisRest: 100, eisZiel: null,
      slalom: null, huetchenWeg: [], slalomBest: null, slalomMedaille: null, opaSitz: false };
  }
  function verbrauchStart() {
    return { sprit: null, strom: 100, platt: false, vorrat: { flickzeug: 0, kanister: 0 },
      material: { schrauben: 0, kabel: 0, federn: 0, blech: 0 } };
  }
  function hudNeu() {
    // Statt einer langen Liste oben links ein Knopf zum Auftragsbuch mit der Zahl offener Aufträge
    $("auftrag").hidden = true;
    const { offen, erledigt } = auftraege(), knopf = $("buchKnopf");
    if (knopf) {
      knopf.hidden = !offen.length && !erledigt.length;
      knopf.textContent = offen.length ? `📖 Aufträge · ${offen.length}` : "📖 Aufträge";
      if (!$("buch").hidden) buchZeigen();
    }
    $("geld").textContent = `🪙 ${spiel.geld}`;
    $("geld").title = `${spiel.geld} Münzen`;
    $("geld").hidden = spiel.auftrag === null;
  }
  // Beim ersten Reifen in Sichtweite erklären, wie das Aufsammeln geht
  // Beim ersten Gegenstand in der Nähe (Reifen, Batterie oder Material vom Wegrand) erklären, wie das Aufsammeln geht
  function reifenPruefen() {
    if (hinweisGezeigt) return;
    const nah = (g) => Math.hypot(g.x - auto.x, g.y - auto.y) < 16 && bekannt(g.x, g.y);
    if ((BRAUCHT[spiel.auftrag] && SAMMEL.some((g) => sichtbar(g) && nah(g))) || FUNDE.some(nah)) {
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
    if (!kamera) return;
    const b = cv.getBoundingClientRect();
    const x = kamera.kx + (e.clientX - b.left - b.width / 2) / kamera.m;
    const y = kamera.ky + (e.clientY - b.top - b.height / 2) / kamera.m;
    const r = SAMMEL.find((q) => sichtbar(q) && Math.hypot(q.x - x, q.y - y) < 2);
    if (r) return aufsammeln(r);
    const f = FUNDE.find((q) => Math.hypot(q.x - x, q.y - y) < 2);
    if (f) fundAufsammeln(f);
  }
  // Wieder am Schrottplatz: Reifen abgeben oder im Laden stöbern
  // Bäuerin Hilde: Ihre Schafherde steht auf dem Feldweg hinter dem Hof. Mit der
  // Spezialhupe (gibt es bei Knut) scheucht man sie weg, Hilde belohnt mit einem
  // Karosserie-Teil. spiel.hilde: null | "auftrag" | "frei" (Schafe weg) | "erledigt"
  function beiHilde() {
    if (eisAbgeben("hilde")) return;
    const hilde = (zeilen, danach) => gespraech("hilde", "Bäuerin Hilde", "bauernhof", zeilen, danach);
    if (spiel.rosi === "fisch") {
      spiel.rosi = "milch"; hudNeu();
      return hilde([
        ["juhu", "Fisch von Rosi? Herrlich, frisch aus dem Waldsee! Den gibt's heute Abend."],
        ["auftrag", "Hier, die Kanne Milch für sie, so wie immer. Grüß mir die Rosi schön!"],
      ], () => toast("🥛 Milchkanne eingepackt. Zurück zu Rosi an den Waldsee!", 4000));
    }
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
      spiel.hilde = "erledigt"; spiel.geld += 30; spiel.teile.add("pickup_hinten"); materialGeben({ federn: 2 });
      if (opt.belohnung) opt.belohnung("pickup_hinten");
      return hilde([
        ["juhu", "Der Weg ist frei! Ich hab's bis hierher tröten hören, die Schafe sind jetzt auf der Wiese. Danke dir!"],
        ["auftrag", "Hier, 30 Münzen und zwei alte Federn aus der Scheune. Und nimm das hier mit: das Heck von unserem alten Pick-up. Der Rest davon steht noch irgendwo herum."],
      ], () => toast("Pick-up hinten erhalten! Liegt in Opas Werkstatt im Regal.", 4500));
    }
    const n = spiel.neben;
    // G9: Hildes alter Mähbalken schneidet eine Schneise ins Schilf
    if (n.kauz === "suchen" && !n.maehbalken) {
      return hilde([
        ["nachdenken", "Durchs Schilf am Waldsee willst du? Da kommt keiner durch, das steht dichter als mein Weizen."],
        ["juhu", "Außer … mit meinem alten Mähbalken! Den hab ich früher vorne an den Traktor gehängt. Der mäht alles weg, was ihm vor die Klingen kommt."],
        ["auftrag", "Nur ist er ziemlich hinüber: Die Klingen sind locker und eine Feder ist gebrochen. Bring mir 2 Schrauben und 1 Feder, dann richte ich ihn dir her."],
      ], () => { n.maehbalken = "auftrag"; fundeVerteilen(); hudNeu(); toast("🌾 Neuer Auftrag: Hildes Mähbalken. Steht im Auftragsbuch.", 4000); });
    }
    if (n.maehbalken === "auftrag") {
      const m = spiel.material;
      if (m.schrauben < 2 || m.federn < 1) {
        return hilde([["nachdenken", `Für den Mähbalken fehlen mir noch ${Math.max(0, 2 - m.schrauben)} Schrauben und ${Math.max(0, 1 - m.federn)} Feder.`]]);
      }
      m.schrauben -= 2; m.federn -= 1; n.maehbalken = "erledigt";
      spiel.teile.add("maehbalken");
      if (opt.belohnung) opt.belohnung("maehbalken");
      return hilde([
        ["juhu", "Schrauben rein, neue Feder dran … und die Klingen geölt. Schau, wie die wieder schnippeln!"],
        ["auftrag", "Bau ihn in Opas Werkstatt vorne an dein Auto. Dann fährst du einfach mitten ins Schilf, und ratatata, ist der Weg frei."],
        ["nachdenken", "Wen du da drüben wohl findest? Grüß ihn von mir, wenn's ein Netter ist."],
      ], () => { hudNeu(); toast("🌾 Mähbalken erhalten! Liegt in Opas Werkstatt im Regal (Kategorie Vorne).", 5000); });
    }
    if (spiel.rosi === "erledigt" && !n.kuh) {
      return hilde([
        ["nachdenken", "Ach, gut, dass du kommst! Meine Kuh Berta ist schon wieder ausgebüxt. Die Schafe sind brav, aber Berta …"],
        ["auftrag", "Zuletzt hat sie einer am Waldweg gesehen, beim Pilze-Mampfen. Fährst du hin? Wenn sie dein Auto hört, trottet sie von allein heim."],
        ["juhu", "Bring sie mir zurück, dann kriegst du was Feines: Opas alte Milchkanne. Da passt mehr Sprit rein als in eine Gießkanne!"],
      ], () => { n.kuh = "suchen"; bertaSetzen(); hudNeu(); toast("🐄 Neuer Auftrag: Kuh Berta suchen. Steht im Auftragsbuch.", 4000); });
    }
    if (n.kuh === "suchen") return hilde([["nachdenken", "Berta ist noch nicht zurück. Schau mal am Waldweg, da frisst sie so gern Pilze."]]);
    if (n.kuh === "heim") {
      n.kuh = "erledigt"; spiel.geld += 30; spiel.teile.add("milchkanne"); materialGeben({ blech: 1 });
      if (opt.belohnung) opt.belohnung("milchkanne");
      return hilde([
        ["juhu", "Berta! Da bist du ja, du alte Ausreißerin. Muuh macht sie, als wär nix gewesen."],
        ["auftrag", "Danke dir! Hier, 30 Münzen, ein Stück Blech und die Milchkanne. Mit der kommst du ein ganzes Stück weiter, bevor der Tank leer ist."],
      ], () => toast("🥛 Milchkanne erhalten (Tank: 2.200 m)! Liegt in Opas Werkstatt im Regal.", 4500));
    }
    hilde([["hallo", "Schön, dich zu sehen! Die Schafe sind brav auf der Wiese geblieben. Komm ruhig wieder vorbei!"]]);
  }
  // Hupen vor der Herde: Schafe stieben auseinander, danach fährt das Auto weiter zum Ziel
  // Förster Moos in der Försterhütte: vorerst Begrüßung, sein Auftrag kommt noch
  let moosKennt = false;
  // Anglerin Rosi Rute, Platzwartin am Campingplatz. Erster Auftrag: frischen Fisch zu Hilde
  // bringen und die Milch dafür zurück. spiel.rosi: null | "fisch" | "milch" | "erledigt"
  function beiRosi(nachher) {
    const ort = D.hintergruende && D.hintergruende.camping ? "camping" : "foersterhuette";
    const rosi = (zeilen, danach) => gespraech("rosi", "Anglerin Rosi", ort, zeilen, () => { if (danach) danach(); if (nachher) nachher(); });
    if (!spiel.rosi) {
      return rosi([
        ["hallo", "Hallo, hallo! Entschuldige, ich war unten am Steg. Ich bin Rosi, mir gehört der Campingplatz. Und die Hälfte der Fische im See, wenn's nach mir geht!"],
        ["nachdenken", "Du bist durch den Holzweg gekommen? Dann hat Moos die Stämme endlich weg. Gut so, hier soll ja bald die Waldrallye starten."],
        ["nachdenken", "Und unter uns: Nachts brummt es drüben am anderen Seeufer, und Lichter flackern übers Wasser. Die Camper denken, es spukt."],
        ["auftrag", "Aber erst mal was Handfestes: Bringst du Hilde auf dem Bauernhof diesen frischen Fisch? Sie gibt mir dafür immer eine Kanne Milch."],
        ["juhu", "Bring mir die Milch zurück, dann hab ich was Schönes für dich. Im Schuppen steht noch eine alte Badewanne!"],
      ], () => { spiel.rosi = "fisch"; hudNeu(); toast("🐟 Frischer Fisch eingepackt. Ab zu Hilde!", 4000); });
    }
    if (spiel.rosi === "fisch") return rosi([["nachdenken", "Der Fisch muss zu Hilde auf den Bauernhof, bevor er anfängt zu riechen!"]]);
    if (spiel.rosi === "milch") {
      spiel.rosi = "erledigt"; spiel.geld += 25; spiel.teile.add("badewanne_vorne");
      if (opt.belohnung) opt.belohnung("badewanne_vorne");
      materialGeben({ blech: 1 });
      return rosi([
        ["juhu", "Frische Milch! Herrlich, da freuen sich die Camper morgen früh."],
        ["auftrag", "Hier, 25 Münzen und ein Stück Blech. Und das Vorderteil der alten Badewanne gehört dir, mit Gummiente vorne drauf!"],
        ["nachdenken", "Die anderen Teile? Eins hat bestimmt der Sperrmüll-Händler … ach, das erzähl ich dir ein andermal."],
      ], () => toast("Badewanne vorne erhalten! Liegt in Opas Werkstatt im Regal.", 4500));
    }
    const n = spiel.neben;
    if (!n.motor) {
      return rosi([
        ["nachdenken", "Sag mal, du kennst doch Knut vom Schrottplatz? Mein Außenbordmotor stottert nur noch, so komm ich nie raus zu den dicken Fischen."],
        ["auftrag", "Nimmst du ihn mit zu Knut? Der kriegt so was im Handumdrehen hin. Die Rallye läuft dir ja nicht weg."],
        ["juhu", "Wenn er wieder schnurrt, schenk ich dir das Steuerrad von meinem alten Kahn. Damit lenkt sich's butterweich!"],
      ], () => { n.motor = "zuKnut"; hudNeu(); toast("⚙️ Neuer Auftrag: Rosis Außenbordmotor zu Knut bringen.", 4000); });
    }
    if (n.motor === "zuKnut") return rosi([["nachdenken", "Mein Motor muss zu Knut auf den Schrottplatz. Der weiß, wie man ihn wieder zum Schnurren bringt!"]]);
    if (n.motor === "zurueck") {
      n.motor = "erledigt"; spiel.geld += 20; spiel.teile.add("steuerrad");
      if (opt.belohnung) opt.belohnung("steuerrad");
      return rosi([
        ["juhu", "Er schnurrt wie ein Kätzchen! Morgen fahr ich raus und hol mir den dicken Hecht."],
        ["auftrag", "Hier, 20 Münzen und das Steuerrad, wie versprochen. Damit weichst du in der Rallye jedem Stamm aus!"],
      ], () => toast("🛞 Schiffs-Steuerrad erhalten (lenkt sich besser)! Liegt in Opas Werkstatt im Regal.", 4500));
    }
    rosi([["hallo", spiel.moosRallye && spiel.holzweg
      ? spiel.rallye && spiel.rallye.medaille
        ? `Na, du Rallye-Ass! Bestzeit ${spiel.rallye.best.toLocaleString("de-DE")} Sekunden. Willst du's noch schneller probieren?`
        : "Schön, dich zu sehen! Moos hat die Rallye-Strecke fertig abgesteckt, der Start ist gleich hier am Platz. Traust du dich?"
      : "Schön, dich zu sehen! Die Fische beißen heute prima."]]);
  }

  // --- Waldrallye --------------------------------------------------------------
  // Start am Campingplatz, sobald Moos davon erzählt hat und der Holzweg frei ist. Nur bei Tag.
  const RALLYE = window.Rallye ? window.Rallye({
    eltern: $("karte").parentElement,
    bilder: { get auto() { return autoWahl; }, get walddach() { return BODEN.walddach.img; }, get erde() { return BODEN.erde.img; },
      get fels() { return OBJ.felsbrocken.img; }, get nadelbaum() { return OBJ.nadelbaum.img; },
      get pfuetze() { return OBJ.pfuetze && OBJ.pfuetze.img; }, get ast() { return OBJ.ast && OBJ.ast.img; },
      get wurzel() { return OBJ.wurzel && OBJ.wurzel.img; }, get schlagloch() { return OBJ.schlagloch && OBJ.schlagloch.img; },
      get hase() { return TIERBILD.hase; } },
    werte: () => (opt.werte ? opt.werte() : { tempo: 15, gewicht: 87, wendig: 4, grip: 2 }),
  }) : null;
  // Dorf-Slalom (G11) auf dem Marktplatz: gleiche Steuerung wie die Rallye
  const SLALOM = window.Rallye ? window.Rallye({
    eltern: $("karte").parentElement, art: "slalom", zeiten: { gold: 27, silber: 37, bronze: 45 },
    bilder: { get auto() { return autoWahl; }, get pylone() { return OBJ.pylone && OBJ.pylone.img; } },
    werte: () => (opt.werte ? opt.werte() : { tempo: 15, gewicht: 87, wendig: 4, grip: 2 }),
  }) : null;
  const rallyeMoeglich = () => RALLYE && spiel.holzweg && spiel.moosRallye && spiel.rosi;
  function rallyeAnbieten() {
    if (!rallyeMoeglich()) return;
    const f = $("rallyeFrage");
    const nacht = istNacht();
    f.querySelector("p").textContent = nacht ? "Nachts fährt keiner die Rallye, man sieht ja die Hand vor Augen nicht. Komm bei Tag wieder!"
      : `Einmal den alten Holzweg entlang, so schnell du kannst. Für Bronze brauchst du höchstens ${RALLYE.ZEITEN.bronze} Sekunden.` +
        (spiel.rallye ? ` Deine Bestzeit: ${spiel.rallye.best.toLocaleString("de-DE")} s.` : "");
    f.querySelector("strong").textContent = "🏁 Waldrallye";
    const los = f.querySelector(".r-los"); los.hidden = nacht; los.onclick = rallyeStarten;
    f.hidden = false;
  }
  function rallyeStarten() {
    $("rallyeFrage").hidden = true;
    RALLYE.starten((e) => {
      if (!e) return;
      const vorher = spiel.rallye;
      const rang = { gold: 3, silber: 2, bronze: 1 }, alt = vorher && vorher.medaille ? rang[vorher.medaille] : 0;
      spiel.rallye = { best: vorher ? Math.min(vorher.best, e.zeit) : e.zeit, medaille: (rang[e.medaille] || 0) > alt ? e.medaille : (vorher && vorher.medaille) || null };
      spiel.geld += e.muenzen;
      const ort = D.hintergruende && D.hintergruende.camping ? "camping" : "foersterhuette";
      if (e.medaille && !alt) {
        // erste Medaille: qualifiziert, Belohnung und das erste Donnerkeil-Teil
        spiel.geld += 30; if (!spiel.donnerkeil.includes("lenkrad")) spiel.donnerkeil.push("lenkrad");
        materialGeben({ federn: 1 });
        gespraech("rosi", "Anglerin Rosi", ort, [
          ["juhu", `Wahnsinn! ${e.zeit.toLocaleString("de-DE")} Sekunden, Moos hat's gestoppt! Damit bist du beim Klappertal-Rennen dabei!`],
          ["auftrag", "Hier, 30 Münzen Preisgeld. Und der Sieger kriegt bei uns traditionell was aus meiner Hütte …"],
          ["nachdenken", "Dieses alte Lenkrad mit dem Blitz drauf hing da schon, als ich den Platz übernommen hab. Sieht aus wie von einem Rennwagen."],
          ["juhu", "Zeig's doch mal Opa Kolben, vielleicht weiß der, wo es herkommt!"],
        ], () => toast("⚡ Donnerkeil-Teil gefunden: das Lenkrad (1/8)! Steht im Auftragsbuch.", 5000));
      } else if (e.medaille === "gold" && alt < 3) {
        spiel.geld += 20;
        gespraech("rosi", "Anglerin Rosi", ort, [["juhu", "Gold! So schnell ist hier noch keiner durch den Wald gebrettert. 20 Münzen extra!"]]);
      } else {
        toast(e.medaille ? `🏁 ${e.zeit.toLocaleString("de-DE")} s. Bestzeit: ${spiel.rallye.best.toLocaleString("de-DE")} s` : (spiel.gekauft.has("mopedmotor") ? "🏁 Knapp daneben! Weich mehr Hindernissen aus." : "🏁 Knapp daneben! Mit einem schnelleren Motor klappt's. Frag mal Knut."), 4000);
      }
      if (e.muenzen) setTimeout(() => toast(`🪙 ${e.muenzen} Münzen auf der Strecke eingesammelt.`), 4200);
      hudNeu();
    });
  }

  // Moos zieht die Bäume weg: Holzweg frei, Campingplatz und Waldsee auf der Karte
  function holzwegFrei() {
    spiel.moosSeil = "erledigt"; spiel.holzweg = true; spiel.geld += 20;
    materialGeben({ schrauben: 2 });
    const g = GEBIETE.find((q) => q.id === "camping");
    if (!g.offen) { g.offen = true; nebelNeu(); }
    setTimeout(() => toast("Neu auf der Karte: der Holzweg zum Campingplatz am Waldsee", 5000), 3000);
  }
  // G8: Moos schickt einen nachts ans Ostufer, wo die Lichter tanzen
  function lichterAuftrag(zeilen) {
    zeilen.push(
      ["auftrag", "Pass auf: Vom Waldsee aus seh ich die Lichter jede Nacht am Ostufer. Da drüben, wo das Schilf so hoch steht."],
      ["auftrag", "Südlich von Opas Schuppen führt ein alter Anglerpfad hin. Ich zeichne ihn dir auf die Karte. Fahr mal hin und schau nach, ja? Die Lichter siehst du nur nachts. Mir ist das nicht geheuer."]);
    spiel.neben.lichter = "auftrag";
    const g = GEBIETE.find((q) => q.id === "ostufer");
    if (!g.offen) { g.offen = true; nebelNeu(); }
    setTimeout(() => toast("🌙 Neuer Auftrag: Die Lichter am Waldsee. Neu auf der Karte: das Ostufer.", 4500), 300);
  }
  // Am Ostufer: nachts fliehen die Lichter ins Schilf, zurück bleibt ein Bolzen mit Opas Blitz
  function amOstufer() {
    const n = spiel.neben;
    if (n.lichter !== "auftrag") {
      // Mit Mähbalken geht es beim ersten Mal gleich weiter durchs Schilf bis zu Kauz (G9)
      const schilf = HINDERNISSE.find((q) => q.id === "schilf"), kauz = zielVon("kauz");
      if (n.kauz && !schilf.weg && hatTeil("vorne") && zielOffen(kauz)) {
        toast("🌾 Mähbalken runter! Den Reifenspuren nach ins Schilf …", 3000);
        return setTimeout(() => { if (!route) planen(kauz); }, 600);
      }
      return toast(n.kauz && !schilf.weg ? "Die Reifenspuren verschwinden im dichten Schilf. Da kommt die Klapperkiste nicht durch." : "Angekommen: Ostufer am Waldsee");
    }
    const blitz = spiel.donnerkeil.includes("lenkrad") ? "Genau so einer ist auf dem Lenkrad, das du Opa gebracht hast!" : "Wie auf dem Donnerkeil auf Opas altem Foto!";
    const bolzenBild = D.geschichte && D.geschichte.bolzen ? [{ bild: D.geschichte.bolzen, alt: "Ein blanker Bolzen mit eingeritztem Blitz im Matsch." }] : [];
    // Nachts sieht man die Lichter davonsausen; tagsüber findet man nur die Spuren und den Bolzen
    const zeilen = istNacht() ? [
      ["", "Da! Drei blasse Lichter schweben über dem Schilf. Sie flackern … und sausen plötzlich davon, übers Wasser, mitten ins Schilf hinein."],
      ["", "Ein Motor brummt kurz auf, tief und rau. Dann ist alles still. Nur die Frösche quaken."],
      ["", "Im Matsch am Ufer: frische Reifenspuren. Sie führen geradewegs ins Schilf, aber da ist es viel zu dicht zum Durchfahren."],
      ["", `Und da glänzt etwas im Scheinwerferlicht: ein schwerer, blanker Bolzen mit einem eingeritzten Blitz. ${blitz}`, ...bolzenBild],
    ] : [
      ["", "Am Ufer ist alles ruhig. Ein paar Enten paddeln durchs Schilf, von Lichtern keine Spur."],
      ["", "Aber im Matsch: frische Reifenspuren, breit und tief, und ein paar Tropfen Öl. Sie führen geradewegs ins Schilf, viel zu dicht zum Durchfahren."],
      ["", `Und da, halb im Matsch: ein schwerer, blanker Bolzen mit einem eingeritzten Blitz. ${blitz}`, ...bolzenBild],
      ["", "Irgendwer fährt hier nachts herum. Und dieser Irgendwer hat etwas verloren."],
    ];
    gespraech("erzaehler", "Am Ostufer", "ostufer", zeilen, () => {
      n.lichter = "bolzen"; hudNeu();
      toast("🔩 Glänzender Bolzen eingesteckt. Zeig ihn Opa in der Werkstatt!", 5000);
    });
  }
  // Altes Foto von der Mühlenkurve (G10): Mitten auf der Strecke steht eine Kuh
  const fotoBild = () => (D.geschichte && D.geschichte.muehlenkurve
    ? [{ bild: D.geschichte.muehlenkurve, alt: "Altes Foto: Der Donnerkeil bremst in der Mühlenkurve, mitten auf der Strecke steht eine Kuh." }] : []);
  // G10: Müllerin Mehlich an der Mühle hinter den Feldern
  function beiMuellerin() {
    if (eisAbgeben("muellerin")) return;
    const n = spiel.neben, m = spiel.material;
    const muellerin = (zeilen, danach) => gespraech("muellerin", "Müllerin Mehlich", "muehle", zeilen, danach);
    if (n.muehle === "muellerin") {
      return muellerin([
        ["hallo", "Besuch! Und das über meine wacklige Brücke. Du musst ja ein Federgewicht von Auto haben. Ich bin die Müllerin Mehlich."],
        ["nachdenken", "Die Mühlenkurve? Ach du liebe Zeit, das ist vierzig Jahre her. Kolben und Kauz im Donnerkeil … und dann haben die beiden sich so zerstritten."],
        ["juhu", "Ich stand damals genau da als Streckenposten. Und ich hab sogar ein Foto gemacht! Irgendwo in der Mühle muss es noch sein."],
        ["auftrag", "Aber erst muss mein Mühlrad wieder laufen, es quietscht und hakt. Bring mir 2 Federn und 2 Schrauben, dann such ich dir das Foto raus."],
      ], () => { n.muehle = "mrad"; fundeVerteilen(); hudNeu(); });
    }
    if (n.muehle === "mrad") {
      if (m.federn < 2 || m.schrauben < 2) {
        return muellerin([["nachdenken", `Fürs Mühlrad fehlen mir noch ${Math.max(0, 2 - m.federn)} Federn und ${Math.max(0, 2 - m.schrauben)} Schrauben.`]]);
      }
      m.federn -= 2; m.schrauben -= 2;
      return muellerin([
        ["juhu", "Federn und Schrauben! Zack, eingebaut … hörst du? Das Mühlrad klappert wieder ganz gemütlich."],
        ["auftrag", "Und hier, das Foto. Ich hab's in der alten Keksdose gefunden. Schau's dir genau an!", ...fotoBild()],
        ["nachdenken", "Na? Siehst du's? Bring das mal den beiden Streithähnen. Am besten zuerst Kauz, der lacht lieber als Kolben."],
      ], () => { n.muehle = "foto"; hudNeu(); toast("📷 Altes Foto von der Mühlenkurve eingesteckt. Zeig es Kauz!", 5000); });
    }
    muellerin([["hallo", n.muehle === "versoehnt"
      ? "Kolben und Kauz schrauben wieder zusammen? Das ist ja schöner als frisches Brot! Grüß die beiden von mir."
      : "Schön, dass du vorbeischaust! Das Mühlrad klappert wieder, und das Mehl wird so fein wie lange nicht."]]);
  }
  // G9: Kauz in seiner versteckten Werkstatt im Schilf
  function beiKauz() {
    const n = spiel.neben;
    const kauz = (zeilen, danach) => gespraech("kauz", "Tüftler Kauz", "kauz", zeilen, danach);
    if (n.kauz === "suchen") {
      return kauz([
        ["nachdenken", "Wer da? … Ein Auto mit Mähbalken, mitten durchs Schilf? Na, du traust dich was."],
        ["auftrag", "Ich bin Kauz. Tüftler. Und das hier ist meine Werkstatt, die eigentlich keiner finden soll. Also: Was willst du?"],
        ["nachdenken", "Einen Bolzen mit Blitz hast du gefunden? Den hab ich neulich nachts verloren, als ich meine Lampen ausprobiert hab. Und wo ist er jetzt?"],
        ["nachdenken", "Bei Kolben?! Ausgerechnet. Hmpf. Dann hat dich der alte Sturkopf geschickt, was?"],
        ["auftrag", "Na gut, ich sag dir was: Unter der Plane da steht der Rahmen vom Donnerkeil. Den hab ich damals gerettet. Ich bau daraus was Neues, nachts, damit's keiner merkt."],
        ["nachdenken", "Ob ich mich bei Kolben blicken lasse? Erst, wenn er zugibt, dass er in der Mühlenkurve zu spät gebremst hat!"],
        ["juhu", "Aber du gefällst mir. Wer selbst schraubt, ist hier willkommen."],
      ], () => { n.kauz = "gefunden"; hudNeu(); toast("🦉 Kauz gefunden! Seine Hütte im Schilf steht jetzt auf der Karte.", 5000); });
    }
    const m10 = n.muehle;
    if (!m10) {
      return kauz([
        ["nachdenken", "Ach, und noch was … der Bolzen mit dem Blitz. Den brauch ich! Ohne den hält die Hinterachse vom neuen Rahmen nicht."],
        ["auftrag", "Hol ihn mir bei Kolben zurück, ja? Aber sag ihm nicht, dass ich drum gebeten hab. Sag einfach … er gehört mir!"],
      ], () => { n.muehle = "opa1"; hudNeu(); toast("🔩 Neuer Auftrag: Die Mühlenkurve. Steht im Auftragsbuch.", 4500); });
    }
    if (m10 === "kauz") {
      return kauz([
        ["nachdenken", "Er rückt ihn nicht raus? Und zu spät gebremst hat er angeblich auch nicht? Hmpf! Dann sag ihm: Falsch angesagt hab ich auch nicht!"],
        ["nachdenken", "…"],
        ["nachdenken", "Wie geht's ihm denn so? Zittern ihm noch die Hände beim Schrauben? … Ach, ist ja egal. Frag nicht weiter."],
      ], () => { n.muehle = "opa2"; hudNeu(); });
    }
    if (m10 === "foto") {
      return kauz([
        ["nachdenken", "Ein Foto von der Mühlenkurve? Von der Müllerin? Zeig her …", ...fotoBild()],
        ["juhu", "Eine KUH! Mitten auf der Strecke! Hahaha! Deshalb hat er gebremst! Und ich hab gebrüllt, er soll Gas geben!", ...fotoBild()],
        ["juhu", "Vierzig Jahre streiten wir uns wegen einer Kuh. Ich lach mich kaputt."],
        ["auftrag", "Weißt du was? Bring Kolben das Foto. Ich … komm dann nach. Vielleicht. Mit was Schönem für dich."],
      ], () => { n.muehle = "kauzlacht"; hudNeu(); });
    }
    if (m10 === "opa1" || m10 === "opa2" || m10 === "kauzlacht") {
      return kauz([["nachdenken", "Na, was sagt der alte Sturkopf? Fahr ruhig zu ihm, ich warte hier. Ich hab eh zu tun."]]);
    }
    kauz([["nachdenken", istNacht()
      ? "Psst, nicht so laut, ich teste gerade die Lampen. Kolben hat nicht zufällig nach mir gefragt? … Nein? Hmpf."
      : "Na, wieder da? Ich hab die ganze Nacht geschraubt, jetzt brauch ich erst mal einen Kaffee. Komm bald wieder!"]]);
  }
  function beiMoos() {
    const zeilen = [];
    if (!moosKennt) {
      zeilen.push(
        ["hallo", "Na so was, Besuch mitten im dunklen Wald! Ich bin Förster Moos. Das Piepsen? Das ist Pieps, der wohnt in meinem Bart."],
        ["nachdenken", "Ohne Licht hätte dich der Wald glatt verschluckt. Gut, dass dir einer einen Scheinwerfer eingebaut hat."]);
    }
    if (spiel.opa === "rennen" && !spiel.moosRallye) {
      // Opa hat vom Rennen erzählt: Moos weiß von der ersten Vorrunde, und von den Lichtern
      zeilen.push(
        ["nachdenken", moosKennt ? "Die Waldrallye? Ja freilich! Hat dir Opa Kolben davon erzählt?" : "Opa Kolben schickt dich wegen der Waldrallye? Ja freilich!"],
        ["auftrag", "Die erste Vorrunde zum Klappertal-Rennen fährt dieses Jahr bei uns im Wald, auf dem alten Holzweg hinter meiner Hütte."],
        ["nachdenken", "Nur liegen da noch umgestürzte Bäume drauf. Sobald der Weg frei ist, trag ich dich als Fahrer ein, versprochen."],
        ["auftrag", "Mit meinem Seilzug könnt ich die Stämme wegziehen. Aber das Seil ist gerissen und die Feder ausgeleiert. Bringst du mir 2 Kabel und 2 Federn? Die liegen manchmal am Wegrand."],
        ["auftrag", "Und noch was, aber sag's nicht weiter: Nachts seh ich da hinten im Wald manchmal Lichter. Und es brummt wie ein Motor. Pieps mag das gar nicht."]);
      spiel.moosRallye = true; spiel.moosSeil = "auftrag"; fundeVerteilen();
    } else if (spiel.moosSeil === "auftrag") {
      const m = spiel.material;
      if (m.kabel >= 2 && m.federn >= 2) {
        m.kabel -= 2; m.federn -= 2;
        zeilen.push(
          ["juhu", "Kabel und Federn! Wunderbar, damit flick ich den Seilzug im Handumdrehen."],
          ["juhu", "So … einhaken … und kurbeln, kurbeln, kurbeln … Rumms! Der Holzweg ist frei!"],
          ["auftrag", "Am Ende vom Holzweg liegt der Campingplatz am Waldsee. Ich zeichne ihn dir auf die Karte. Dort startet auch die Rallye, sobald ich die Strecke abgesteckt hab."],
          ["auftrag", "Hier, 20 Münzen für deine Mühe. Und ein paar Schrauben, die hatte ich noch übrig."]);
        holzwegFrei();
      } else {
        zeilen.push(["nachdenken", `Für den Seilzug fehlen mir noch ${Math.max(0, 2 - m.kabel)} Kabel und ${Math.max(0, 2 - m.federn)} Federn. Schau mal am Wegrand, da liegt oft was herum.`]);
      }
    } else if (spiel.moosSeil === "erledigt" && spiel.neben.vogelhaus !== "erledigt") {
      const n = spiel.neben, m = spiel.material;
      if (!n.vogelhaus) {
        zeilen.push(
          ["nachdenken", "Pieps ist ganz durcheinander. Seit die Lichter im Wald flackern, schläft er nicht mehr in meinem Bart."],
          ["auftrag", "Ich will ihm ein Vogelhaus bauen, ein richtiges, mit Blechdach. Bringst du mir 2 Blech und 2 Schrauben? Liegen manchmal am Wegrand."]);
        n.vogelhaus = "auftrag"; fundeVerteilen();
        setTimeout(() => toast("🐦 Neuer Auftrag: Ein Vogelhaus für Pieps. Steht im Auftragsbuch.", 4000), 300);
      } else if (m.blech >= 2 && m.schrauben >= 2) {
        m.blech -= 2; m.schrauben -= 2; n.vogelhaus = "erledigt"; spiel.geld += 25;
        zeilen.push(
          ["juhu", "Blech und Schrauben! Zack, zack … und fertig ist das Vogelhaus. Pieps zieht sofort ein, schau!"],
          ["auftrag", "Hier, 25 Münzen. Und weißt du, wer früher die schönsten Vogelhäuser im Tal gebaut hat? Der alte Kauz."],
          ["nachdenken", "Ein Tüftler, wohnt irgendwo drüben am anderen Seeufer. Keiner hat ihn lang gesehen. Ob die Lichter was mit ihm zu tun haben?"]);
        lichterAuftrag(zeilen);
      } else {
        zeilen.push(["nachdenken", `Fürs Vogelhaus fehlen mir noch ${Math.max(0, 2 - m.blech)} Blech und ${Math.max(0, 2 - m.schrauben)} Schrauben.`]);
      }
    } else if (spiel.neben.vogelhaus === "erledigt" && !spiel.neben.lichter) {
      lichterAuftrag(zeilen);
    } else if (spiel.neben.lichter === "auftrag") {
      zeilen.push(["nachdenken", "Warst du schon am Ostufer? Nimm den alten Anglerpfad südlich von Opas Schuppen. Die Lichter tanzen dort nur, wenn es richtig dunkel ist."]);
    } else if (spiel.neben.lichter === "bolzen") {
      zeilen.push(["nachdenken", "Ein Bolzen mit einem Blitz drauf? Zeig den mal Opa Kolben. Der weiß bestimmt, wo der herkommt."]);
    } else if (spiel.neben.lichter === "erledigt" && spiel.neben.pieps !== "erledigt") {
      piepsBeiMoos(zeilen);
    } else if (moosKennt) {
      zeilen.push(["nachdenken", spiel.holzweg
        ? "Der Holzweg ist frei, die Rallye-Strecke stecke ich gerade ab. Und die Lichter? Letzte Nacht wieder. Unheimlich, sag ich dir."
        : spiel.moosRallye ? "Der Holzweg ist noch nicht frei, ich bin dran. Und die Lichter? Letzte Nacht wieder. Unheimlich, sag ich dir."
        : "Na, wieder im Wald unterwegs? Ich grüble noch, wobei du mir helfen könntest. Komm bald wieder!"]);
    } else {
      zeilen.push(["auftrag", "Ich hätte da bestimmt was für dich zu tun. Aber erst muss ich in Ruhe nachdenken, was genau. Schau bald wieder vorbei!"]);
    }
    if (!moosKennt) zeilen.push(["juhu", "Und fahr vorsichtig, hier laufen nachts die Hasen über den Weg!"]);
    moosKennt = true;
    // Solange Pieps ausgebüxt ist, ist das Nest im Bart leer (Figur moos_ohne, falls es sie gibt)
    const n = spiel.neben, ohne = n.lichter === "erledigt" && n.pieps === "suchen" && (D.figuren || {}).moos_ohne;
    gespraech(ohne ? "moos_ohne" : "moos", "Förster Moos", "foersterhuette", zeilen, () => hudNeu());
  }

  // --- G11: Klappertal-Dorf ------------------------------------------------------
  // Funke steht an der Absperrung am Ortseingang und macht einen zum Helfer
  function funkeSperre() {
    gespraech("funke", "Hauptfrau Funke", "feuerwache", [
      ["auftrag", "Halt! Stopp! Feuerwehr! Hier kommt keiner durch, wir bauen fürs Dorffest auf!"],
      ["nachdenken", "Moment mal … du hast ja ein Auto. Ein echtes, selbst gebautes? Mit Motor und allem?"],
      ["juhu", "Dann bist du ab sofort Helfer! Helfer dürfen durch. Ich bin Hauptfrau Funke, Feuerwache Klappertal."],
      ["auftrag", "Schau gleich bei Gino in der Eisdiele vorbei, der rauft sich die Haare. Und danach komm zu mir auf die Wache."],
    ], () => {
      spiel.neben.dorf = "offen";
      const g = GEBIETE.find((q) => q.id === "dorf");
      if (!g.offen) { g.offen = true; nebelNeu(); }
      hudNeu(); toast("🏘️ Neues Gebiet: Klappertal-Dorf! Die Absperrung ist weg.", 5000);
    });
  }
  function beiFunke() {
    const n = spiel.neben, funke = (zeilen, danach) => gespraech("funke", "Hauptfrau Funke", "feuerwache", zeilen, danach || (() => hudNeu()));
    if (!n.slalom) {
      return funke([
        ["hallo", "Na, Helfer? Willkommen auf der Wache! Das da drin ist unser Löschwagen, Baujahr Uroma."],
        ["auftrag", "Zum Dorffest gehört der Dorf-Slalom auf dem Marktplatz, die zweite Vorrunde zum Klappertal-Rennen."],
        ["nachdenken", "Nur hat mir der Sturm letzte Nacht die Hütchen für die Strecke davongeweht. Sechs Stück! Die liegen jetzt überall im Dorf und an der Landstraße."],
        ["auftrag", "Sammelst du sie ein? Einfach nah ranfahren, dann hüpfen sie aufs Auto. Dann stecke ich die Strecke ab."],
      ], () => { n.slalom = "huetchen"; n.huetchenWeg = []; hudNeu(); setTimeout(() => toast("🔶 Neuer Auftrag: Funkes Hütchen. 6 Stück im Dorf und an der Landstraße.", 4500), 300); });
    }
    if (n.slalom === "huetchen") {
      const fehlt = HUETCHEN.length - n.huetchenWeg.length;
      if (fehlt > 0) return funke([["nachdenken", `Noch ${fehlt} Hütchen fehlen. Schau im Dorf und an der Landstraße, die leuchten orange im Gras.`]]);
      return funke([
        ["juhu", "Alle sechs Hütchen! Zack, zack, die Strecke steht. Der Marktplatz ist bereit!"],
        ["auftrag", "Immer abwechselnd an den Hütchen vorbei, der grüne Pfeil zeigt die Seite. Umgefahren kostet eine Sekunde, ein verpasstes Tor drei."],
        ["nachdenken", "Wendig muss das Auto sein, und leicht. Wer zu scharf lenkt, wird langsam."],
      ], () => { n.slalom = "offen"; hudNeu(); slalomAnbieten(); });
    }
    funke([["hallo", n.slalom === "medaille" ? "Na, Champion? Noch eine Runde Slalom, für die Bestzeit?" : "Bereit für den Dorf-Slalom? Die Hütchen stehen!"]], () => { hudNeu(); slalomAnbieten(); });
  }
  // Funkes Hütchen: liegen am Wegrand im Dorf und an der Landstraße, nah ranfahren sammelt sie ein
  const HUETCHEN = [[328, 248.2], [351, 241.6], [372, 251], [415, 258], [426.5, 247], [439, 252.8]]; // alle nah an Wegen zwischen Zielen
  function huetchenSchritt() {
    const n = spiel.neben;
    if (n.slalom !== "huetchen") return;
    HUETCHEN.forEach(([x, y], i) => {
      if (n.huetchenWeg.includes(i) || Math.hypot(auto.x - x, auto.y - y) > 5) return;
      n.huetchenWeg.push(i); hudNeu();
      const fehlt = HUETCHEN.length - n.huetchenWeg.length;
      toast(fehlt ? `🔶 Hütchen eingesammelt! (${n.huetchenWeg.length}/${HUETCHEN.length})` : "🔶 Alle 6 Hütchen! Bring sie Funke auf die Wache.", 3000);
    });
  }
  function huetchenZeichnen(sicht) {
    const n = spiel.neben, b = OBJ.pylone;
    if (n.slalom !== "huetchen" || !b || !b.img.complete) return;
    HUETCHEN.forEach(([x, y], i) => {
      if (n.huetchenWeg.includes(i) || !imBild(x, y, sicht)) return;
      ctx.save(); ctx.translate(x, y); ctx.rotate(i % 2 ? 1.2 : -0.9); // umgeweht: liegt im Gras
      ctx.drawImage(b.img, -b.b / 2, -b.h / 2, b.b, b.h); ctx.restore();
    });
  }
  function slalomAnbieten() {
    if (!SLALOM) return;
    const f = $("rallyeFrage"), n = spiel.neben;
    f.querySelector("strong").textContent = "🏁 Dorf-Slalom";
    f.querySelector("p").textContent = `Abwechselnd an den Hütchen vorbei, so schnell du kannst. Für Bronze brauchst du höchstens ${SLALOM.ZEITEN.bronze} Sekunden.` +
      (n.slalomBest ? ` Deine Bestzeit: ${n.slalomBest.toLocaleString("de-DE")} s.` : "");
    const los = f.querySelector(".r-los"); los.hidden = false; los.onclick = slalomStarten;
    f.hidden = false;
  }
  function slalomStarten() {
    $("rallyeFrage").hidden = true;
    SLALOM.starten((e) => {
      if (!e) return;
      const n = spiel.neben, rang = { gold: 3, silber: 2, bronze: 1 }, alt = n.slalomMedaille ? rang[n.slalomMedaille] : 0;
      n.slalomBest = n.slalomBest ? Math.min(n.slalomBest, e.zeit) : e.zeit;
      if ((rang[e.medaille] || 0) > alt) n.slalomMedaille = e.medaille;
      spiel.geld += e.muenzen;
      if (e.medaille && n.slalom !== "medaille") {
        n.slalom = "medaille"; spiel.geld += 30;
        if (!spiel.donnerkeil.includes("sitz")) spiel.donnerkeil.push("sitz");
        spiel.teile.add("donnerkeilsitz"); if (opt.belohnung) opt.belohnung("donnerkeilsitz");
        gespraech("funke", "Hauptfrau Funke", "feuerwache", [
          ["juhu", `${e.zeit.toLocaleString("de-DE")} Sekunden! Damit hast du die zweite Vorrunde geschafft! 30 Münzen Preisgeld!`],
          ["auftrag", "Und jetzt die Überraschung: der alte Sessel aus unserer Wachstube. Ein Rennsitz mit einem Blitz drauf."],
          ["nachdenken", "Den hat mein Vorgänger mal beim Sperrmüll-Händler gekauft, für fünf Mark. Ich glaub, der gehört eher in ein Auto als in eine Wache."],
          ["juhu", "Nimm ihn mit! Und grüß mir Opa Kolben."],
        ], () => { hudNeu(); toast("⚡ Donnerkeil-Teil gefunden: der Sitz (3/8)! Liegt in Opas Werkstatt (Sitz).", 5500); });
      } else if (e.medaille === "gold" && alt < 3) {
        spiel.geld += 20;
        gespraech("funke", "Hauptfrau Funke", "feuerwache", [["juhu", "GOLD! So schnell ist hier noch keiner um die Hütchen gewedelt. 20 Münzen extra!"]], () => hudNeu());
      } else {
        toast(e.medaille ? `🏁 ${e.zeit.toLocaleString("de-DE")} s. Bestzeit: ${n.slalomBest.toLocaleString("de-DE")} s` : "🏁 Knapp daneben! Eine wendigere Lenkung oder ein leichteres Auto helfen.", 4000);
        hudNeu();
      }
      if (e.muenzen) setTimeout(() => toast(`🪙 ${e.muenzen} Münzen auf der Strecke eingesammelt.`), 4200);
    });
  }
  // Ginos Eis-Express: Becher ausliefern, bevor sie schmelzen
  const EIS_SEKUNDEN = 110; // so lange hält ein Becher (Fahrzeit auf der Karte)
  const eisZielName = () => (spiel.neben.eisZiel === "muellerin" ? "die Müllerin" : "Bäuerin Hilde");
  function eisBecher(stand) {
    const n = spiel.neben;
    n.eis = stand; n.eisRest = 100;
    if (stand === "zweit" && !n.eisZiel) n.eisZiel = GEBIETE.find((g) => g.id === "muehle").offen ? "muellerin" : "hilde";
    verbrauchAnzeigen(); hudNeu();
  }
  function eisSchritt(dt) {
    const n = spiel.neben;
    if ((n.eis !== "opa" && n.eis !== "zweit") || !$("gespraech").hidden) return;
    const vorher = n.eisRest;
    n.eisRest = Math.max(0, n.eisRest - dt * 100 / EIS_SEKUNDEN);
    if (Math.ceil(vorher) !== Math.ceil(n.eisRest)) verbrauchAnzeigen();
    if (vorher > 30 && n.eisRest <= 30) toast("🍦 Das Eis wird weich! Schnell!", 2500);
    if (n.eisRest <= 0) {
      n.eis = n.eis === "opa" ? "neu1" : "neu2"; verbrauchAnzeigen(); hudNeu();
      toast("💧 Oh nein, das Eis ist geschmolzen! Hol bei Gino einen neuen Becher.", 4500);
    }
  }
  function beiGino() {
    const n = spiel.neben, gino = (zeilen, danach) => gespraech("gino", "Gino Gelato", "eisdiele", zeilen, danach);
    const toastNeu = (t) => setTimeout(() => toast(t, 4500), 300);
    if (!n.eis) {
      return gino([
        ["hallo", "Buongiorno! Ein Auto! Endlich! Ich bin Gino, Gino Gelato. Das beste Eis im ganzen Klappertal!"],
        ["nachdenken", "Aber eine Katastrophe: Meine Kühltruhe ist kaputt! Heute Abend ist Dorffest und das Eis schmilzt mir unter den Händen weg."],
        ["auftrag", "Die Bestellungen müssen raus, sofort! Opa Kolben kriegt jedes Jahr einen Becher Erdbeere. Fahr schnell, bevor er schmilzt!"],
      ], () => { eisBecher("opa"); toastNeu("🍦 Neuer Auftrag: Ginos Eis-Express. Erdbeere für Opa, schnell!"); });
    }
    if (n.eis === "neu1" || n.eis === "neu2") {
      const zweit = n.eis === "neu2";
      return gino([["nachdenken", zweit
        ? `Geschmolzen? Mamma mia! Hier, ein neuer Becher Vanille für ${eisZielName()}. Diesmal: Vollgas!`
        : "Geschmolzen? Mamma mia! Hier, ein neuer Becher Erdbeere für Opa. Diesmal: Vollgas!"]], () => eisBecher(zweit ? "zweit" : "opa"));
    }
    if (n.eis === "opa" || n.eis === "zweit") {
      return gino([["nachdenken", `Was stehst du noch hier? Das Eis schmilzt! Ab zu ${n.eis === "opa" ? "Opa Kolben" : eisZielName()}!`]]);
    }
    if (n.eis === "gino2") {
      const muehle = GEBIETE.find((g) => g.id === "muehle").offen;
      return gino([
        ["juhu", "Opa Kolben hat sich gefreut? Wunderbar! Er war früher mein bester Kunde."],
        ["auftrag", muehle
          ? "Jetzt die schwierige Lieferung: Vanille für die Müllerin. Die Mühle ist weit und die Brücke morsch. Leicht und schnell muss dein Auto sein!"
          : "Jetzt Vanille für Bäuerin Hilde auf dem Bauernhof. Das ist ein Stück, also gib Gas!"],
      ], () => eisBecher("zweit"));
    }
    if (n.eis === "dank") {
      return gino([
        ["juhu", "Alle Becher angekommen! Du bist der schnellste Eislieferant, den Klappertal je gesehen hat."],
        ["auftrag", "Im Hof steht noch mein alter Eiswagen. Also, nur die Karosserie, der Motor ist längst hin. Nimm sie und bau sie auf dein Auto!"],
        ["juhu", "Dazu 30 Münzen. Und jeden Sonntag eine Kugel umsonst!"],
      ], () => {
        n.eis = "erledigt"; spiel.geld += 30;
        for (const t of ["eiswagen_hinten", "eiswagen_mitte", "eiswagen_vorne"]) { spiel.teile.add(t); if (opt.belohnung) opt.belohnung(t); }
        hudNeu(); toast("🍦 Eiswagen-Karosserie (hinten, Mitte, vorne) liegt jetzt in Opas Werkstatt!", 5000);
      });
    }
    gino([["juhu", "Ciao! Komm bald wieder. Die Kühltruhe repariert hoffentlich bald jemand …"]]);
  }
  // Becher abgeben bei der Müllerin oder bei Hilde (true: Gespräch läuft)
  function eisAbgeben(wer) {
    const n = spiel.neben;
    if (n.eis !== "zweit" || n.eisZiel !== wer) return false;
    const zeilen = wer === "muellerin"
      ? [["juhu", "Vanille von Gino? Für mich? Und noch kalt! Du bist ja schneller als der Donnerkeil damals."],
        ["auftrag", "Sag Gino, er ist ein Schatz. Und er soll seine Truhe endlich reparieren lassen!"]]
      : [["juhu", "Ein Becher Vanille von Gino! Wie jedes Jahr zum Dorffest. Und kein bisschen geschmolzen!"],
        ["auftrag", "Bedank dich bei Gino von mir. Berta kriegt nichts ab, die hat genug Pilze gefressen."]];
    gespraech(wer, wer === "muellerin" ? "Müllerin Mehlich" : "Bäuerin Hilde", wer === "muellerin" ? "muehle" : "bauernhof", zeilen,
      () => { n.eis = "dank"; verbrauchAnzeigen(); hudNeu(); toast("🍦 Abgeliefert! Zurück zu Gino in die Eisdiele.", 4000); });
    return true;
  }

  // G4: Pieps ist ausgebüxt. Man hört ihn im Wald piepsen (links/rechts), fährt hin, er hüpft aufs Auto
  function piepsBeiMoos(zeilen) {
    const n = spiel.neben;
    if (!n.pieps) {
      zeilen.push(
        ["nachdenken", "Ach, du bist's! Ich bin ganz durcheinander: Pieps ist weg! Heute früh ist er aus dem Vogelhaus geflattert und nicht wiedergekommen."],
        ["nachdenken", "Seit am See keine Lichter mehr flackern, ist er so neugierig. Will überall hin, der kleine Frechdachs."],
        ["auftrag", "Ich hör ihn manchmal piepsen, aber mit meinen alten Ohren weiß ich nicht, von wo. Fahr langsam durch den Wald und hör genau hin!"],
        ["juhu", "Wenn du nah genug bist, hüpft er dir bestimmt aufs Auto. Er mag alles, was brummt."]);
      const moeglich = PIEPS_ORTE.map((o, i) => i).filter((i) => bekannt(PIEPS_ORTE[i][0], PIEPS_ORTE[i][1]));
      n.pieps = "suchen"; n.piepsOrt = moeglich.length ? moeglich[Math.floor(Math.random() * moeglich.length)] : 0;
      piepsSetzen();
      setTimeout(() => toast("🐦 Neuer Auftrag: Pieps ist ausgebüxt. Ton an und gut hinhören!", 4500), 300);
    } else if (n.pieps === "suchen") {
      zeilen.push(["nachdenken", "Noch keine Spur von Pieps? Hör genau hin, von welcher Seite es piepst. Und schau nach den kleinen Noten ♪ über den Bäumen."]);
    } else if (n.pieps === "dabei") {
      n.pieps = "erledigt"; spiel.geld += 25;
      zeilen.push(
        ["juhu", "PIEPS! Da sitzt er ja auf deinem Auto, als wär nix gewesen!"],
        ["juhu", "Zack, zurück in den Bart. Da ist's doch am gemütlichsten, gell? Pieps, pieps, sagt er. Das heißt danke."],
        ["auftrag", "Und von mir auch: Danke! Hier, 25 Münzen."]);
      piepsDank(zeilen);
    }
  }
  // Was Moos nach Pieps' Rückkehr noch erzählt (die Karte wächst, G11)
  function piepsDank(zeilen) {
    zeilen.push(
      ["nachdenken", "Weißt du was? Du kommst ja jetzt richtig rum im Tal. Hier, meine alte Talkarte, die brauch ich nicht mehr."],
      ["auftrag", "Da ist die Landstraße eingezeichnet: hinter der Weide nach Osten, bis ins Dorf. Gino von der Eisdiele hat neulich gefragt, ob nicht mal einer mit Auto vorbeikommt."]);
    const g = GEBIETE.find((q) => q.id === "landstrasse");
    if (!g.offen) { g.offen = true; nebelNeu(); setTimeout(() => toast("🗺️ Moos' Talkarte: Neues Gebiet Landstraße ins Dorf!", 5000), 400); }
  }

  function hupenBei(h) {
    h.weg = true;
    $("meldung").hidden = true;
    toast("📯 TRÖÖÖT! Die Schafe springen zur Seite.");
    if (Ton) Ton.hupe();
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
    if (istNacht()) return knut([["nachdenken", "Chrrr … Hm? Was? Mitten in der Nacht? Der Laden ist zu! Komm morgen früh wieder."]]);
    const n = BRAUCHT[spiel.auftrag];
    if (n && spiel.beutel < n) {
      // Auftrag noch offen: Knut sagt, was fehlt, danach ist sein Laden trotzdem offen (tanken, Material verkaufen)
      if (spiel.auftrag === "batterie") {
        return knut([["nachdenken", "Die Batterie? Die liegt irgendwo drüben am Weideweg, ganz im Osten. Ohne Strom bleibt der Scheinwerfer dunkel. Brauchst du solange was aus dem Laden?"]], ladenAuf);
      }
      const f = n - spiel.beutel;
      return knut([["nachdenken", `Hm, da fehl${f === 1 ? "t noch ein Reifen" : `en noch ${f} Reifen`}. Schau mal am Feldrand, am Weg in den Wald und drüben am Weideweg. Brauchst du solange was aus dem Laden?`]], ladenAuf);
    }
    if (spiel.auftrag === "reifen") {
      spiel.auftrag = "batterie"; spiel.beutel = 0; spiel.geld += 40; materialGeben({ schrauben: 2 });
      const weideZu = !GEBIETE.find((g) => g.id === "weide").offen;
      return knut([
        ["juhu", "Drei Reifen, wie bestellt! Die kommen gleich auf meinen Turm da hinten."],
        ["auftrag", "Hier, 40 Münzen und zwei Schrauben für dich. Schau dich ruhig in meinem Laden um."],
        ["nachdenken", "Ach, und noch was: Ich hab hier einen alten Scheinwerfer liegen. Aber ohne Strom bringt der nix."],
        ["auftrag", "Am Weideweg im Osten soll eine alte Autobatterie liegen. Bring sie mir, dann gehört der Scheinwerfer dir!" +
          (weideZu ? " Den Weg dorthin zeigt dir bestimmt ein Kartenstück am Feldrand." : "")],
      ], ladenAuf);
    }
    if (spiel.auftrag === "batterie") {
      spiel.auftrag = "erledigt"; spiel.beutel = 0; spiel.geld += 15; spiel.teile.add("scheinwerfer"); materialGeben({ kabel: 1 });
      if (opt.belohnung) opt.belohnung("scheinwerfer");
      return knut([
        ["juhu", "Die Batterie hat ja noch ordentlich Saft! Und 15 Münzen und ein Stück Kabel obendrauf, weil du so fix warst."],
        ["auftrag", "Hier, der Scheinwerfer gehört dir. Lass ihn dir von Opa einbauen, dann siehst du auch im dunklen Wald was."],
        ["nachdenken", "Ach, und gerade kam eine Lieferung rein: eine Spezialhupe, laut wie ein Nebelhorn. Steht jetzt im Laden."],
      ], () => { toast("Alter Scheinwerfer erhalten! Er liegt in Opas Werkstatt im Regal.", 4500); ladenAuf(); });
    }
    if (spiel.neben.motor === "zuKnut") {
      spiel.neben.motor = "zurueck"; hudNeu();
      return knut([
        ["nachdenken", "Rosis Außenbordmotor? Zeig mal her … Aha. Da hat einer Seegras in die Schraube gewickelt."],
        ["juhu", "Raus damit, Zündkerze sauber, ein Tropfen Öl … Brrrrumm! Läuft wie neu. Bring ihn ihr zurück!"],
      ], () => toast("⚙️ Motor repariert. Zurück zu Rosi an den Waldsee!", 4000));
    }
    if (spiel.rallye && !spiel.knutMoped && !spiel.gekauft.has("mopedmotor")) {
      // nach der ersten Rallye-Fahrt erzählt Knut einmal vom Mopedmotor
      spiel.knutMoped = true;
      return knut([
        ["nachdenken", spiel.rallye.medaille ? "Hab gehört, du hast bei der Waldrallye eine Medaille geholt! Mit dem ollen Rasenmäher-Motor? Respekt."
          : "Hab gehört, du warst bei der Waldrallye. Mit dem Rasenmäher-Motor? Der zieht doch keinen Hering vom Teller!"],
        ["juhu", "Guck mal, was ich vom Sperrmüll mitgebracht hab: einen echten Mopedmotor! Flink und sparsam, damit bist du mehr als doppelt so schnell."],
        ["auftrag", `Für dich ${MOPED_PREIS} Münzen. Opa baut ihn dir in der Werkstatt ein, und dann zeigst du's Moos!`],
      ], ladenAuf);
    }
    ladenAuf();
  }
  // --- Auftragsbuch -----------------------------------------------------------
  // Alle Aufträge, abgeleitet aus dem Spielstand. Mehrere können gleichzeitig offen sein,
  // man entscheidet selbst die Reihenfolge; „Hinfahren“ plant den Weg zum nächsten Schritt.
  const zielVon = (id) => ZIELE.find((z) => z.id === id);
  const DONNERKEIL_TEILE = 8; // so viele Teile hatte Opas Rennwagen (Motor, Lenkrad, Räder, Sitz, Karosserie …)
  // nächster noch liegender Fundgegenstand in bekanntem Gebiet
  function fundZiel(art, name) {
    const liste = SAMMEL.filter((r) => r.art === art && !r.weg && bekannt(r.x, r.y))
      .sort((a, b) => Math.hypot(a.x - auto.x, a.y - auto.y) - Math.hypot(b.x - auto.x, b.y - auto.y));
    return liste[0] ? { id: "fund", name, x: liste[0].x, y: liste[0].y } : null;
  }
  // nächstes Material einer der gesuchten Arten am Wegrand
  function auftraege() {
    const offen = [], erledigt = [];
    const knut = { figur: "knut", wer: "Knut Kurbel" }, hilde = { figur: "hilde", wer: "Bäuerin Hilde" };
    const reifen = { ...knut, titel: "Alte Reifen für Knut", belohnung: "40 Münzen, 2 🔩 Schrauben" };
    const batterie = { ...knut, titel: "Eine alte Autobatterie", belohnung: "Scheinwerfer, 15 Münzen, 1 🔌 Kabel" };
    const schafe = { ...hilde, titel: "Schafe vom Feldweg scheuchen", belohnung: "30 Münzen, ein Karosserie-Teil, 2 🌀 Federn" };
    if (spiel.auftrag === "reifen") {
      const voll = spiel.beutel >= BRAUCHT.reifen;
      offen.push({ ...reifen, stand: `${spiel.beutel}/${BRAUCHT.reifen}`,
        text: voll ? "Alle Reifen sind im Beutel. Bring sie zu Knut auf den Schrottplatz."
          : "Drei alte Reifen einsammeln: am Feldrand, am Weg in den Wald und drüben am Weideweg.",
        ziel: voll ? zielVon("schrottplatz") : fundZiel("reifen", "Alter Reifen"),
        fehlt: voll ? null : "Die übrigen Reifen liegen in Gegenden, die du noch nicht kennst. Such ein Kartenstück." });
    }
    if (spiel.auftrag === "batterie") {
      const voll = spiel.beutel >= BRAUCHT.batterie;
      offen.push({ ...batterie, stand: `${spiel.beutel}/1`,
        text: voll ? "Die Batterie ist im Beutel. Bring sie zu Knut." : "Am Weideweg ganz im Osten liegt eine alte Autobatterie.",
        ziel: voll ? zielVon("schrottplatz") : fundZiel("batterie", "Alte Batterie"),
        fehlt: voll ? null : "Den Weideweg kennst du noch nicht. Am Feldrand liegt ein Kartenstück." });
    }
    if (spiel.auftrag === "batterie" || spiel.auftrag === "erledigt") erledigt.push(reifen);
    if (spiel.auftrag === "erledigt") erledigt.push(batterie);
    if (spiel.hilde === "auftrag") {
      const hupe = hatTeil("hupe");
      // Zu Knut schickt der Auftrag erst, wenn die Hupe auch wirklich in seinem Laden liegt (nach der Batterie)
      const imLaden = !hupe && LADEN.some((w) => w.id === "spezialhupe" && (!w.ab || w.ab()) && !spiel.gekauft.has(w.id));
      offen.push({ ...schafe, stand: hupe ? "Hupe dabei" : "Hupe fehlt",
        text: hupe ? "Fahr auf den Feldweg hinter dem Hof und hup die Schafe von der Straße."
          : imLaden ? "Die Schafe hören nur auf eine richtig laute Hupe. Knut hat eine im Laden."
          : "Die Schafe hören nur auf eine richtig laute Hupe. Knut bekommt bestimmt bald eine rein, erst mal hilfst du ihm weiter.",
        ziel: hupe ? zielVon("felder") : imLaden ? zielVon("schrottplatz") : null,
        fehlt: hupe || imLaden ? null : "Noch hat niemand eine Hupe. Erledige erst Knuts Aufträge." });
    }
    if (spiel.hilde === "frei") offen.push({ ...schafe, stand: "Weg ist frei", text: "Die Schafe sind auf der Wiese. Erzähl es Hilde auf dem Bauernhof.", ziel: zielVon("bauernhof") });
    if (spiel.hilde === "erledigt") erledigt.push(schafe);
    if (spiel.opa === "rennen") {
      const opa = { figur: "opa", wer: "Opa Kolben" };
      offen.push({ ...opa, titel: "Opas Donnerkeil", stand: `${spiel.donnerkeil.length}/${DONNERKEIL_TEILE} Teile`,
        text: "Mit dem Donnerkeil hat Opa das Klappertal-Rennen dreimal gewonnen. Er ist zerlegt, die Teile sind im ganzen Tal verstreut.",
        belohnung: "Opas Rennwagen", ziel: null,
        fehlt: spiel.donnerkeil.length ? `Gefunden: ${spiel.donnerkeil.map((t) => ({ lenkrad: "Lenkrad mit Blitz", rahmen: "Donnerkeil-Rahmen", sitz: "Donnerkeil-Sitz" }[t] || t)).join(", ")}. Wo die anderen wohl sind?`
          : "Noch keine Spur. Die Leute im Tal wissen bestimmt mehr." });
      if (!spiel.moosRallye) {
        const licht = hatTeilEingebaut("licht");
        offen.push({ ...opa, titel: "Anmeldung zur Waldrallye", stand: licht ? "Licht dabei" : "Licht fehlt",
          text: "Die erste Vorrunde zum Klappertal-Rennen wird im Wald gefahren. Opa meint, Förster Moos weiß mehr.",
          belohnung: "Startplatz bei der Waldrallye", ziel: licht ? zielVon("foersterhuette") : null,
          fehlt: licht ? null : "Ohne Licht kommst du nicht durch den dunklen Wald. Knut hat einen Scheinwerfer, wenn du ihm die Batterie bringst." });
      } else {
        const r = spiel.rallye;
        const rallye = { rallye: true, figur: "moos", wer: "Förster Moos", titel: "Die Waldrallye", belohnung: "Startplatz beim Klappertal-Rennen, 30 Münzen und eine Überraschung" };
        if (r && r.medaille) erledigt.push({ ...rallye, titel: `Die Waldrallye (Bestzeit ${r.best.toLocaleString("de-DE")} s)` });
        else offen.push({ ...rallye, stand: spiel.holzweg ? (r ? `Bestzeit ${r.best.toLocaleString("de-DE")} s` : `höchstens ${RALLYE ? RALLYE.ZEITEN.bronze : 58} s`) : "Weg versperrt",
          text: spiel.holzweg ? "Start am Campingplatz am Waldsee, nur bei Tag. Weich Pfützen, Wurzeln und Stämmen aus, Bronze reicht."
            : "Die Rallye fährt auf dem alten Holzweg hinter der Försterhütte. Erst müssen die umgestürzten Bäume weg.",
          ziel: spiel.holzweg ? zielVon("camping") : null,
          fehlt: spiel.holzweg ? null : "Erst den Seilzug für Moos reparieren." });
      }
    }
    if (spiel.knutMoped) {
      const moped = { ...knut, titel: "Ein schnellerer Motor", belohnung: "Mopedmotor: 35 statt 15 km/h" };
      if (spiel.gekauft.has("mopedmotor")) erledigt.push(moped);
      else {
        const genug = spiel.geld >= MOPED_PREIS;
        offen.push({ ...moped, stand: `🪙 ${Math.min(spiel.geld, MOPED_PREIS)}/${MOPED_PREIS}`,
          text: genug ? "Du hast genug Münzen. Knut wartet auf dem Schrottplatz mit dem Mopedmotor."
            : "Knut verkauft einen Mopedmotor. Münzen gibt's für Aufträge und für Material vom Wegrand, das Knut dir abkauft.",
          ziel: genug ? zielVon("schrottplatz") : null });
      }
    }
    if (spiel.moosSeil === "auftrag") {
      const m = spiel.material, genug = m.kabel >= 2 && m.federn >= 2;
      offen.push({ figur: "moos", wer: "Förster Moos", titel: "Ein Seilzug für den Holzweg",
        stand: `🔌 ${Math.min(2, m.kabel)}/2 · 🌀 ${Math.min(2, m.federn)}/2`,
        text: genug ? "Kabel und Federn sind im Beutel. Bring sie Moos in die Försterhütte."
          : "Moos braucht 2 Kabel und 2 Federn für seinen Seilzug. Die liegen am Wegrand, jeden Tag neue.",
        belohnung: "20 Münzen, 2 🔩 Schrauben, der Weg zum Waldsee",
        ziel: genug ? zielVon("foersterhuette") : null });
    }
    if (spiel.moosSeil === "erledigt") erledigt.push({ figur: "moos", wer: "Förster Moos", titel: "Ein Seilzug für den Holzweg" });
    const rosiA = { figur: "rosi", wer: "Anglerin Rosi", titel: "Fisch gegen Milch", belohnung: "25 Münzen, 1 🥫 Blech, ein Karosserie-Teil" };
    if (spiel.rosi === "fisch") offen.push({ ...rosiA, stand: "🐟 Fisch dabei", text: "Bring Hilde auf dem Bauernhof den frischen Fisch von Rosi.", ziel: zielVon("bauernhof") });
    if (spiel.rosi === "milch") offen.push({ ...rosiA, stand: "🥛 Milch dabei", text: "Bring Rosi die Kanne Milch von Hilde zurück an den Waldsee.", ziel: zielVon("camping") });
    if (spiel.rosi === "erledigt") erledigt.push(rosiA);
    // Nebenaufträge
    const n = spiel.neben, m = spiel.material;
    const kuh = { figur: "hilde", wer: "Bäuerin Hilde", titel: "Kuh Berta ist ausgebüxt", belohnung: "30 Münzen, 1 🥫 Blech, Milchkanne (größerer Tank)" };
    if (n.kuh === "suchen") offen.push({ ...kuh, stand: "🐄 gesucht", text: "Berta frisst am Waldweg Pilze. Fahr hin, dann trottet sie von allein heim.", ziel: { id: "fund", name: "Kuh Berta", x: BERTA.x, y: BERTA.y } });
    if (n.kuh === "heim") offen.push({ ...kuh, stand: "🐄 gefunden", text: "Berta ist auf dem Heimweg. Sag Hilde auf dem Bauernhof Bescheid.", ziel: zielVon("bauernhof") });
    if (n.kuh === "erledigt") erledigt.push(kuh);
    const vogel = { figur: "moos", wer: "Förster Moos", titel: "Ein Vogelhaus für Pieps", belohnung: "25 Münzen und ein Tipp" };
    if (n.vogelhaus === "auftrag") {
      const genug = m.blech >= 2 && m.schrauben >= 2;
      offen.push({ ...vogel, stand: `🥫 ${Math.min(2, m.blech)}/2 · 🔩 ${Math.min(2, m.schrauben)}/2`,
        text: genug ? "Blech und Schrauben sind im Beutel. Bring sie Moos in die Försterhütte." : "Moos braucht 2 Blech und 2 Schrauben für ein Vogelhaus. Die liegen am Wegrand.",
        ziel: genug ? zielVon("foersterhuette") : null });
    }
    if (n.vogelhaus === "erledigt") erledigt.push(vogel);
    const eisA = { figur: "gino", wer: "Gino Gelato", titel: "Ginos Eis-Express", belohnung: "Eiswagen-Karosserie und 30 Münzen" };
    const EIS = {
      opa: ["🍦 Erdbeere für Opa", () => `Bring Opa Kolben den Erdbeerbecher, bevor er schmilzt (noch ${Math.ceil(n.eisRest)} %).`, "schuppen"],
      neu1: ["💧 geschmolzen", () => "Das Eis ist geschmolzen. Hol bei Gino einen neuen Becher.", "eisdiele"],
      gino2: ["🍦 zurück zu Gino", () => "Opa hat sein Eis. Gino hat noch eine Bestellung.", "eisdiele"],
      zweit: [`🍦 Vanille für ${n.eisZiel === "muellerin" ? "die Müllerin" : "Hilde"}`, () => `Bring ${eisZielName()} den Vanillebecher, bevor er schmilzt (noch ${Math.ceil(n.eisRest)} %).`, n.eisZiel === "muellerin" ? "muehle" : "bauernhof"],
      neu2: ["💧 geschmolzen", () => "Das Eis ist geschmolzen. Hol bei Gino einen neuen Becher.", "eisdiele"],
      dank: ["✅ alles geliefert", () => "Alle Becher sind angekommen. Gino wartet in der Eisdiele.", "eisdiele"],
    };
    const slalomA = { figur: "funke", wer: "Hauptfrau Funke", titel: "Der Dorf-Slalom", belohnung: "zweite Vorrunde, 30 Münzen und eine Überraschung" };
    if (n.slalom === "huetchen") {
      const genug = n.huetchenWeg.length >= HUETCHEN.length;
      offen.push({ ...slalomA, stand: `🔶 ${n.huetchenWeg.length}/${HUETCHEN.length} Hütchen`, text: genug ? "Alle Hütchen sind da. Bring sie Funke auf die Feuerwache."
        : "Der Sturm hat Funkes Hütchen im Dorf und an der Landstraße verteilt. Nah ranfahren, dann sammelst du sie ein.", ziel: genug ? zielVon("feuerwache") : null });
    }
    if (n.slalom === "offen") offen.push({ ...slalomA, stand: SLALOM ? `höchstens ${SLALOM.ZEITEN.bronze} s` : "", text: "Die Strecke auf dem Marktplatz steht. Frag Funke auf der Feuerwache nach dem Start. Wendig und leicht hilft.", ziel: zielVon("feuerwache") });
    if (n.slalom === "medaille") erledigt.push(slalomA);
    if (EIS[n.eis]) { const [stand, text, ziel] = EIS[n.eis]; offen.push({ ...eisA, stand, text: text(), ziel: zielVon(ziel) }); }
    if (n.eis === "erledigt") erledigt.push(eisA);
    if (spiel.neben.lichter === "erledigt" && spiel.neben.pieps === "erledigt" && !n.dorf) offen.push({ figur: "funke", wer: "Hauptfrau Funke", titel: "Das Dorffest", stand: "🏘️ Landstraße",
      text: "Moos' Talkarte zeigt die Landstraße hinter der Weide. Fahr zum Ortseingang von Klappertal-Dorf.", belohnung: "ein neues Gebiet", ziel: zielVon("ortseingang") });
    const piepsA = { figur: "moos", wer: "Förster Moos", titel: "Pieps ist ausgebüxt", belohnung: "25 Münzen und eine alte Karte" };
    if (n.pieps === "suchen") offen.push({ ...piepsA, stand: "🐦 gesucht", text: "Pieps sitzt irgendwo im Wald. Fahr langsam und hör hin, von welcher Seite es piepst (Ton an). Die Noten ♪ über den Bäumen verraten ihn auch. Ganz nah hüpft er dir aufs Auto." });
    if (n.pieps === "dabei") offen.push({ ...piepsA, stand: "🐦 sitzt auf dem Auto", text: "Pieps sitzt auf deinem Auto. Bring ihn zu Moos in die Försterhütte.", ziel: zielVon("foersterhuette") });
    if (n.pieps === "erledigt") erledigt.push(piepsA);
    const lichter = { figur: "moos", wer: "Förster Moos", titel: "Die Lichter am Waldsee", belohnung: "eine Spur" };
    if (n.lichter === "auftrag") offen.push({ ...lichter, stand: istNacht() ? "🌙 jetzt ist Nacht" : "🔍 Ostufer",
      text: "Moos sieht jede Nacht Lichter am Ostufer des Waldsees. Fahr über den alten Anglerpfad hin und schau nach (die Lichter selbst siehst du nur nachts).",
      ziel: zielVon("ostufer") });
    if (n.lichter === "bolzen") offen.push({ ...lichter, stand: "🔩 Bolzen dabei",
      text: "Am Ostufer lag ein Bolzen mit einem Blitz drauf. Zeig ihn Opa in der Werkstatt.", ziel: zielVon("schuppen") });
    if (n.lichter === "erledigt") erledigt.push(lichter);
    const kauzA = { figur: "opa", wer: "Opa Kolben", titel: "Wo steckt Kauz?", belohnung: "?" };
    if (n.kauz === "suchen") {
      const maeht = hatTeilEingebaut("vorne");
      offen.push({ ...kauzA, stand: maeht ? "🌾 Mähbalken dran" : "🔍 Spur im Schilf",
        text: maeht ? "Kauz' Reifenspuren führen am Ostufer ins Schilf. Mit dem Mähbalken vorne am Auto kommst du durch."
          : n.maehbalken === "erledigt" ? "Bau Hildes Mähbalken in Opas Werkstatt vorne ans Auto, dann kommst du durchs Schilf."
          : "Kauz war Opas Beifahrer beim Donnerkeil. Seine Reifenspuren führen am Ostufer ins dichte Schilf. Hilde mäht doch immer ihre Wiesen. Vielleicht weiß sie Rat?",
        ziel: maeht ? zielVon("kauz") : n.maehbalken === "erledigt" ? zielVon("schuppen") : n.maehbalken ? null : zielVon("bauernhof") });
    }
    if (n.kauz === "gefunden") erledigt.push(kauzA);
    // G10: Die Mühlenkurve
    const muehleA = { figur: "kauz", wer: "Tüftler Kauz", titel: "Die Mühlenkurve", belohnung: "?" };
    const M10 = {
      opa1: ["🔩 Bolzen holen", "Kauz will seinen Bolzen mit Blitz zurück. Opa hat ihn in der Werkstatt.", "schuppen"],
      kauz: ["🔩 kein Bolzen", "Opa rückt den Bolzen nicht raus: „Soll er ihn sich selbst holen!“ Sag es Kauz.", "kauz"],
      opa2: ["💬 Grüße?", "Kauz hat heimlich nach Opa gefragt. Erzähl es Opa in der Werkstatt.", "schuppen"],
      muellerin: ["🌾 zur Mühle", "Die Müllerin war damals Streckenposten an der Mühlenkurve. Die Mühle liegt hinter den Feldern, über die morsche Brücke am Mühlbach (höchstens 120 kg).", "muehle"],
      foto: ["📷 Foto dabei", "Die Müllerin hat ein altes Foto von der Mühlenkurve. Zeig es zuerst Kauz.", "kauz"],
      kauzlacht: ["📷 zu Opa", "Kauz hat Tränen gelacht. Bring Opa das Foto in die Werkstatt.", "schuppen"],
    };
    if (M10[n.muehle]) {
      const [stand, text, ziel] = M10[n.muehle];
      offen.push({ ...muehleA, stand, text, ziel: zielVon(ziel) });
    }
    if (n.muehle === "mrad") {
      const genug = m.federn >= 2 && m.schrauben >= 2;
      offen.push({ figur: "muellerin", wer: "Müllerin Mehlich", titel: "Das quietschende Mühlrad", belohnung: "ein altes Foto",
        stand: `🌀 ${Math.min(2, m.federn)}/2 · 🔩 ${Math.min(2, m.schrauben)}/2`,
        text: genug ? "Federn und Schrauben sind im Beutel. Bring sie der Müllerin." : "Die Müllerin braucht 2 Federn und 2 Schrauben für ihr Mühlrad. Die liegen am Wegrand.",
        ziel: genug ? zielVon("muehle") : null });
    }
    if (["foto", "kauzlacht", "versoehnt"].includes(n.muehle)) erledigt.push({ figur: "muellerin", wer: "Müllerin Mehlich", titel: "Das quietschende Mühlrad" });
    if (n.muehle === "versoehnt") erledigt.push(muehleA);
    const maehA = { figur: "hilde", wer: "Bäuerin Hilde", titel: "Hildes alter Mähbalken", belohnung: "Mähbalken (schneidet Schilf)" };
    if (n.maehbalken === "auftrag") {
      const genug = m.schrauben >= 2 && m.federn >= 1;
      offen.push({ ...maehA, stand: `🔩 ${Math.min(2, m.schrauben)}/2 · 🌀 ${Math.min(1, m.federn)}/1`,
        text: genug ? "Schrauben und Feder sind im Beutel. Bring sie Hilde auf den Bauernhof." : "Hilde braucht 2 Schrauben und 1 Feder für ihren alten Mähbalken. Die liegen am Wegrand.",
        ziel: genug ? zielVon("bauernhof") : null });
    }
    if (n.maehbalken === "erledigt") erledigt.push(maehA);
    const motor = { figur: "rosi", wer: "Anglerin Rosi", titel: "Rosis Außenbordmotor", belohnung: "20 Münzen, Schiffs-Steuerrad (lenkt besser)" };
    if (n.motor === "zuKnut") offen.push({ ...motor, stand: "⚙️ kaputt", text: "Bring Rosis stotternden Außenbordmotor zu Knut auf den Schrottplatz.", ziel: zielVon("schrottplatz") });
    if (n.motor === "zurueck") offen.push({ ...motor, stand: "⚙️ repariert", text: "Knut hat den Motor repariert. Bring ihn Rosi an den Waldsee zurück.", ziel: zielVon("camping") });
    if (n.motor === "erledigt") erledigt.push(motor);
    return { offen, erledigt };
  }
  // Orte mit Aufgabe (neuer Auftrag oder nächster Schritt): leuchten auf den Karten gelb
  let aufgabenCache = null, aufgabenZeit = -1;
  function aufgabenOrte() {
    const jetzt = performance.now();
    if (aufgabenCache && jetzt - aufgabenZeit < 500) return aufgabenCache;
    const orte = new Set(), punkte = [];
    for (const a of auftraege().offen) {
      if (!a.ziel || a.rallye) continue; // die Rallye zeigt eine Rennflagge statt des Leuchtens
      if (ZIELE.includes(a.ziel)) orte.add(a.ziel.id);
      else if (a.ziel.name === "Kuh Berta") punkte.push(a.ziel);
    }
    const n = spiel.neben;
    // neue Aufträge, die bei jemandem warten
    if (spiel.auftrag === null || (spiel.rallye && !spiel.knutMoped && !spiel.gekauft.has("mopedmotor"))) orte.add("schrottplatz");
    if (!spiel.hilde || (spiel.hilde === "erledigt" && spiel.rosi === "erledigt" && !n.kuh)) orte.add("bauernhof");
    if (!spiel.rosi || (spiel.rosi === "erledigt" && !n.motor)) orte.add("camping");
    if (spiel.moosSeil === "erledigt" && !n.vogelhaus) orte.add("foersterhuette");
    if (n.vogelhaus === "erledigt" && !n.lichter) orte.add("foersterhuette");
    if (n.lichter === "erledigt" && !n.pieps) orte.add("foersterhuette");
    if (n.dorf && (!n.eis || ["neu1", "neu2", "gino2", "dank"].includes(n.eis))) orte.add("eisdiele");
    if (n.dorf && (!n.slalom || (n.slalom === "huetchen" && n.huetchenWeg.length >= HUETCHEN.length))) orte.add("feuerwache");
    if (n.kauz === "gefunden" && !n.muehle) orte.add("kauz");
    if (spiel.donnerkeil.includes("lenkrad") && !spiel.opaLenkrad) orte.add("schuppen");
    if (!spiel.opa && ["batterie", "erledigt"].includes(spiel.auftrag)) orte.add("schuppen");
    const liste = ZIELE.filter((z) => orte.has(z.id) && zielOffen(z) && zielErlaubt(z));
    aufgabenCache = [...liste, ...punkte.filter((q) => bekannt(q.x, q.y))]; aufgabenZeit = jetzt;
    return aufgabenCache;
  }
  function buchZeigen() {
    const liste = $("buchListe"), { offen, erledigt } = auftraege();
    const FIG = (window.KARTE_DATEN && window.KARTE_DATEN.figuren) || {};
    liste.innerHTML = "";
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    if (!offen.length) liste.append(el("p", "buch-leer", "Gerade ist nichts offen. Schau bei den Leuten im Tal vorbei, vielleicht brauchen sie Hilfe."));
    for (const a of offen) {
      // Ziel in einer Gegend, die man noch nicht kennt: noch nicht hinfahrbar
      if (a.ziel && a.ziel.gebiet && !zielOffen(a.ziel)) {
        a.fehlt = `Den Weg zu: ${a.ziel.name} kennst du noch nicht. Such ein Kartenstück.`; a.ziel = null;
      }
      const karte = el("article", "buch-auftrag");
      const bild = el("img"); bild.alt = ""; bild.src = (FIG[a.figur] || {}).hallo || "";
      const text = el("div", "buch-text");
      text.append(el("p", "buch-wer", a.wer), el("h3", null, a.titel), el("p", null, a.text));
      const fuss = el("div", "buch-fuss");
      fuss.append(el("span", "buch-stand", a.stand), el("span", "buch-lohn", "🎁 " + a.belohnung));
      const hin = el("button", "knopf", a.ziel ? `🚗 ${a.ziel.name}` : "🚗 Hinfahren"); hin.type = "button";
      hin.disabled = !a.ziel || Boolean(route && zielWahl && a.ziel && zielWahl.x === a.ziel.x && zielWahl.y === a.ziel.y);
      if (!a.ziel && a.fehlt) text.append(el("p", "buch-fehlt", a.fehlt));
      hin.addEventListener("click", () => { buchZu(); planen(a.ziel); });
      if (a.ziel) fuss.append(hin);
      text.append(fuss);
      karte.append(bild, text);
      liste.append(karte);
    }
    if (erledigt.length) {
      liste.append(el("h4", "buch-erledigt-titel", "Erledigt"));
      for (const a of erledigt) liste.append(el("p", "buch-erledigt", `✓ ${a.titel} (${a.wer})`));
    }
  }
  function buchAuf() { if (!$("gespraech").hidden) return; $("buch").hidden = false; buchZeigen(); $("buchZu").focus(); }
  function buchZu() { $("buch").hidden = true; }

  // --- Tag und Nacht ------------------------------------------------------------
  // Die Uhr läuft nur auf der Karte, nicht in Gesprächen und Fenstern. Ein Tag dauert
  // 15 Minuten Spielzeit: 10 Minuten Tag (6–20 Uhr), 1 Minute Abend, 3 Minuten Nacht
  // (21–5 Uhr), 1 Minute Morgen. Jeder Morgen bringt neue Funde und Preise.
  const TAG = 600, ABEND = 60, NACHT = 180, MORGEN = 60, ZYKLUS = TAG + ABEND + NACHT + MORGEN;
  const zeit = { t: 20, tag: 1, laeuft: !opt.wetter }; // im Einstieg (festes Wetter) steht die Uhr
  function dunkelheit(t = zeit.t) {
    if (t < TAG) return 0;
    if (t < TAG + ABEND) return (t - TAG) / ABEND;
    if (t < TAG + ABEND + NACHT) return 1;
    return 1 - (t - TAG - ABEND - NACHT) / MORGEN;
  }
  const istNacht = () => dunkelheit() > 0.5;
  // Das Licht schaltet sich nur bei Bedarf ein: nachts (ab halber Dunkelheit) oder im dunklen Wald, und nur mit Strom
  const imDunklenWald = () => imWald(auto.x, auto.y) && auto.x < WALD_EINGANG + 2;
  const lichtAn = () => hatTeil("licht") && (istNacht() || imDunklenWald());
  // Nachts fährt die Klapperkiste nur mit brennendem Licht (Scheinwerfer eingebaut und Strom)
  const kannFahren = () => !istNacht() || lichtAn();
  // Zwei Lichtkegel, je einer aus dem linken und rechten Scheinwerfer vorne am Auto
  function scheinwerferKegel(c, farbe0, farbe1, weit = 15) {
    const ca = Math.cos(auto.a), sa = Math.sin(auto.a);
    for (const seite of [-1, 1]) {
      const fx = auto.x + ca * 1.9 - sa * 0.55 * seite, fy = auto.y + sa * 1.9 + ca * 0.55 * seite;
      const mitte = auto.a + seite * 0.06; // leicht nach außen gerichtet
      const g = c.createRadialGradient(fx, fy, 0.3, fx, fy, weit);
      g.addColorStop(0, farbe0); g.addColorStop(1, farbe1);
      c.fillStyle = g; c.beginPath(); c.moveTo(fx, fy); c.arc(fx, fy, weit, mitte - 0.34, mitte + 0.34); c.closePath(); c.fill();
    }
  }
  // Im Dunkeln ohne Licht: stehen bleiben und fragen, wie es weitergeht
  function zuDunkel() {
    route = null;
    const d = $("dunkel");
    if (!d || !d.hidden) return;
    d.querySelector("p").textContent = hatTeilEingebaut("licht")
      ? "Die Batterie ist leer, der Scheinwerfer bleibt aus. Im Dunkeln fährst du nirgendwohin."
      : "Ohne Scheinwerfer siehst du nachts die Hand vor Augen nicht. Im Dunkeln fährst du nirgendwohin.";
    d.hidden = false;
  }
  function stunde(t = zeit.t) {
    if (t < TAG) return 6 + (t / TAG) * 14;
    if (t < TAG + ABEND) return 20 + (t - TAG) / ABEND;
    if (t < TAG + ABEND + NACHT) return (21 + ((t - TAG - ABEND) / NACHT) * 8) % 24;
    return 5 + (t - TAG - ABEND - NACHT) / MORGEN;
  }
  function fensterZu() {
    return ["gespraech", "laden", "buch", "beutel", "grosskarte", "meldung", "leer", "dunkel", "rallyeFrage", "rallye", "slalom"].every((id) => !$(id) || $(id).hidden);
  }
  function zeitSchritt(dt) {
    if (!zeit.laeuft || !fensterZu()) return;
    const warNacht = istNacht(), alt = zeit.t;
    zeit.t += dt;
    if (alt < TAG - 60 && zeit.t >= TAG - 60) toast("🌇 Die Sonne geht bald unter.");
    if (!warNacht && istNacht()) {
      toast(hatTeil("licht") ? "🌙 Es wird Nacht. Der Scheinwerfer ist an." : "🌙 Es wird Nacht. Ohne Licht kommst du nur langsam voran.", 5000);
    }
    if (zeit.t >= ZYKLUS) morgen("🌅 Ein neuer Tag beginnt! Am Wegrand liegt neues Material.");
    uhrAnzeigen();
  }
  function morgen(text) {
    zeit.t = 0; zeit.tag++;
    neuerTag();
    if (text) toast(text, 4500);
    uhrAnzeigen(); verbrauchAnzeigen();
  }
  function uhrAnzeigen() {
    const u = $("uhr");
    if (!u) return;
    const h = stunde(), d = dunkelheit();
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 6) * 10;
    u.textContent = `${d > 0.5 ? "🌙" : d > 0 ? "🌇" : "🕒"} ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    u.title = `Tag ${zeit.tag}`;
    const we = $("wetter");
    if (we && !we.classList.contains("zeigen") && we.dataset.art) we.textContent = wetterIcon(we.dataset.art);
  }
  // Nacht: alles bläulich abdunkeln, dann warme Lichter hinzu (Fenster, Laternen, Feuer,
  // Scheinwerfer) und, gut versteckt, seltsame Lichter am anderen Seeufer
  const LICHTER = [[150, 236, 6], [244, 167, 4.5], [271, 147, 5], [283, 147, 4], [230, 44, 4], [49.6, 292.5, 6.5]];
  function nachtZeichnen(w, h, dpr) {
    const d = dunkelheit();
    if (d < 0.01) return;
    const welt = ctx.getTransform(), t = performance.now() / 1000;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "multiply";
    // Dämmerung (halb dunkel) erst warm orange, tiefe Nacht kühl blau
    const warm = Math.max(0, 1 - Math.abs(d - 0.4) / 0.4) * 0.5;
    ctx.fillStyle = `rgb(${Math.round(255 - d * 195 + warm * 60)},${Math.round(255 - d * 180 - warm * 10)},${Math.round(255 - d * 125 - warm * 90)})`;
    ctx.fillRect(0, 0, w, h);
    ctx.setTransform(welt);
    ctx.globalCompositeOperation = "lighter";
    const schein = (x, y, r, farbe, a) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${farbe},${a})`); g.addColorStop(1, `rgba(${farbe},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    };
    for (const [x, y, r] of LICHTER) schein(x, y, r * (1 + (reduce ? 0 : Math.sin(t * 7 + x) * 0.04)), "255,180,90", 0.45 * d);
    const [lx, ly] = FOERSTER.laterne;
    schein(lx, ly, 5, "255,190,100", 0.4 * d);
    if (lichtAn()) scheinwerferKegel(ctx, `rgba(255,226,150,${0.45 * d})`, "rgba(255,226,150,0)");
    schein(auto.x, auto.y, 3, "255,220,160", 0.12 * d);
    // Spuklichter: drei blasse Lichter tanzen am Ostufer des Waldsees (Spur zu Kauz)
    if (d > 0.6) {
      for (let i = 0; i < 3; i++) {
        const x = 109 + Math.sin(t * 0.4 + i * 2.1) * 3, y = 292 + i * 5 + Math.cos(t * 0.33 + i) * 2;
        const an = reduce ? 1 : 0.6 + 0.4 * Math.sin(t * (3 + i) + i * 5);
        schein(x, y, 2.4, "190,220,255", 0.7 * (d - 0.6) / 0.4 * an);
      }
    }
    ctx.restore();
  }

  // --- Verbrauch: Sprit, Strom, Platten ------------------------------------------
  // Tankgröße und Licht kommen aus der Werkstatt (Werte der eingebauten Teile)
  const tankGroesse = () => Math.max(1, (opt.werte ? opt.werte().reichweite : 3500) || 0);
  const tankLeer = () => spiel.sprit !== null && spiel.sprit <= 0;
  const spritAnteil = () => (spiel.sprit === null ? 1 : Math.max(0, Math.min(1, spiel.sprit / tankGroesse())));
  let spritGewarnt = false, stromGewarnt = false;
  function verbrauchen(meter, wiese, dt) {
    if (spiel.sprit === null) spiel.sprit = tankGroesse();
    spiel.sprit = Math.min(spiel.sprit, tankGroesse());
    if (meter > 0 && spiel.sprit > 0) {
      spiel.sprit = Math.max(0, spiel.sprit - meter);
      if (spritAnteil() < 0.2 && !spritGewarnt) { spritGewarnt = true; toast("⛽ Der Tank ist fast leer! Bei Knut kannst du tanken."); }
      if (spiel.sprit === 0) tankIstLeer();
    }
    // Licht im dunklen Wald zieht Strom
    if (lichtAn() && brauchtStrom()) {
      spiel.strom = Math.max(0, spiel.strom - dt * 0.5);
      if (spiel.strom < 20 && !stromGewarnt) { stromGewarnt = true; toast("🔋 Die Batterie wird schwach. Knut lädt sie dir auf."); }
      if (spiel.strom === 0) toast("🔋 Batterie leer, das Licht ist aus!", 4000);
    }
    // Auf den Wegen liegt ab und zu ein Nagel oder eine Scherbe: mit den Schubkarrenrädern
    // etwa alle 4,5 km ein Platten, mit Autoreifen etwa alle 7 km, mit dünnen öfter. Querfeldein
    // (nur beim Testen mit den Pfeiltasten) noch häufiger.
    const grip = opt.werte ? opt.werte().grip || 2 : 6;
    const alle = (wiese ? 1200 : 6000) / Math.max(0.4, 1.6 - grip * 0.13);
    if (meter > 0 && Math.random() < meter / alle) {
      plattMachen(wiese ? "Pfft! Da lag was Spitzes im Gras." : ["Pfft! Ein Nagel auf dem Weg.", "Knirsch! Eine Glasscherbe.", "Peng! Ein spitzer Stein."][Math.floor(Math.random() * 3)]);
    }
    verbrauchAnzeigen();
  }
  function plattMachen(warum) {
    if (spiel.platt) return;
    spiel.platt = true;
    toast(`🛞 ${warum} Ein Reifen ist platt. ${spiel.vorrat.flickzeug ? "Im Beutel ist Flickzeug." : "Opa flickt ihn in der Werkstatt."}`, 5000);
    verbrauchAnzeigen();
  }
  function flicken() {
    if (!spiel.platt) return;
    if (!spiel.vorrat.flickzeug) return toast("Kein Flickzeug im Beutel. Knut verkauft welches, oder Opa flickt in der Werkstatt.");
    spiel.vorrat.flickzeug--; spiel.platt = false;
    toast("🩹 Geflickt! Weiter geht's.");
    verbrauchAnzeigen(); if (!$("beutel").hidden) beutelZeigen();
  }
  function kanisterNutzen() {
    if (!spiel.vorrat.kanister) return;
    spiel.vorrat.kanister--;
    spiel.sprit = Math.min(tankGroesse(), (spiel.sprit || 0) + 600); spritGewarnt = spritAnteil() < 0.2;
    toast("⛽ Reservekanister eingefüllt (+600 m).");
    $("leer").hidden = true; verbrauchAnzeigen(); if (!$("beutel").hidden) beutelZeigen();
  }
  function tankIstLeer() {
    route = null;
    toast("⛽ Tank leer! Die Klapperkiste rollt aus.", 4000);
    const l = $("leer");
    l.querySelector(".kanister").hidden = !spiel.vorrat.kanister;
    l.querySelector(".kanister").textContent = `⛽ Reservekanister einfüllen (${spiel.vorrat.kanister})`;
    l.hidden = false;
  }
  // Opa schleppt ab: kostenlos zurück zur Werkstatt, mit Notvorrat im Tank
  function abschleppen() {
    spiel.sprit = Math.max(spiel.sprit || 0, Math.min(tankGroesse(), 400)); spritGewarnt = false;
    $("leer").hidden = true; hudNeu();
    toast("🚜 Opa hat dich abgeschleppt und dir etwas Sprit eingefüllt.", 5000);
    schnellreise();
  }
  function verbrauchAnzeigen() {
    const sp = $("sprit"), st = $("strom"), pl = $("platt"), bt = $("beutelKnopf");
    if (!sp) return;
    const a = spritAnteil();
    sp.textContent = `⛽ ${Math.round(a * 100)} %`; sp.classList.toggle("wenig", a < 0.2);
    st.hidden = !hatTeilEingebaut("licht") || !brauchtStrom(); st.textContent = `🔋 ${Math.round(spiel.strom)} %`; st.classList.toggle("wenig", spiel.strom < 20);
    pl.hidden = !spiel.platt;
    const eis = $("eis"), traegt = ["opa", "zweit"].includes(spiel.neben.eis);
    if (eis) { eis.hidden = !traegt; eis.textContent = `🍦 ${Math.ceil(spiel.neben.eisRest)} %`; eis.classList.toggle("wenig", spiel.neben.eisRest < 30); }
    bt.textContent = `🎒 ${beutelVoll()}/${BEUTEL_PLATZ}`;
  }

  // --- Materialien und Beutel ----------------------------------------------------
  // Schrauben, Kabel, Federn und Blech liegen am Wegrand. Man sammelt sie wie die Reifen,
  // sie kommen in den Beutel (begrenzt) und Knut kauft sie an. Jeden neuen Tag (bei Opa)
  // liegen neue herum und die Preise ändern sich etwas.
  const MATERIAL = [
    { id: "schrauben", name: "Schrauben", icon: "🔩", preis: 2 },
    { id: "kabel", name: "Kabel", icon: "🔌", preis: 3 },
    { id: "federn", name: "Federn", icon: "🌀", preis: 4 },
    { id: "blech", name: "Blech", icon: "🥫", preis: 5 },
  ];
  const BEUTEL_PLATZ = 6, FUND_ZAHL = 5; // so viele Materialien liegen pro Tag am Wegrand
  const FUNDE = []; // { art, x, y }
  const tagesPreis = Object.fromEntries(MATERIAL.map((m) => [m.id, m.preis]));
  const beutelVoll = () => Object.values(spiel.material).reduce((a, b) => a + b, 0);
  // Was offene Aufträge noch brauchen ({ art: Anzahl }), abzüglich Beutel
  function auftragBedarf() {
    const b = {};
    if (spiel.moosSeil === "auftrag") Object.assign(b, { kabel: 2, federn: 2 });
    if (spiel.neben.vogelhaus === "auftrag") Object.assign(b, { blech: 2, schrauben: 2 });
    if (spiel.neben.maehbalken === "auftrag") { b.schrauben = Math.max(b.schrauben || 0, 2); b.federn = Math.max(b.federn || 0, 1); }
    if (spiel.neben.muehle === "mrad") { b.schrauben = Math.max(b.schrauben || 0, 2); b.federn = Math.max(b.federn || 0, 2); }
    return b;
  }
  function gesucht() {
    const g = {};
    for (const [art, n] of Object.entries(auftragBedarf())) if (spiel.material[art] < n) g[art] = n - spiel.material[art];
    return g;
  }
  // Wegpunkte, die man von Opas Schuppen aus erreicht: durch bekanntes Gebiet und an keinem
  // Hindernis vorbei, für das gerade etwas fehlt (Schilf, Brücke, Gatter, Bäume, Dunkelheit …)
  function erreichbar() {
    const sperre = HINDERNISSE.filter((h) => !h.weg && !hatTeil(h.braucht));
    const frei = (i) => bekannt(KNOTEN[i][0], KNOTEN[i][1]) && !sperre.some((h) => Math.hypot(KNOTEN[i][0] - h.x, KNOTEN[i][1] - h.y) < h.r + 1);
    const start = naechsterKnoten(150, 243), da = new Set([start]), stapel = [start];
    while (stapel.length) for (const j of NACHBARN[stapel.pop()]) if (!da.has(j) && frei(j)) { da.add(j); stapel.push(j); }
    return da;
  }
  // nicht in Gebäuden, im Schrottplatz oder im ungemähten Schilf
  function fundOrtFrei(x, y) {
    // Schrottplatz samt Zaun und Platz vor dem Tor (dort steht man bei Knut, Zaun im Weg)
    if (imSchrottplatz(x, y) || (x > SCHROTT.X - 3 && x < SCHROTT.X + SCHROTT.b + 3 && y > SCHROTT.Y - 3 && y < SCHROTT.Y + SCHROTT.h + 14)) return false;
    if ([SCHUPPEN.bereich, HUETTE.bereich, HOF.bereich, FOERSTER.bereich, CAMPING.bereich, KAUZ.bereich, MUEHLE.bereich].some(([a, b, c, d]) => x > a - 2 && x < c + 2 && y > b - 2 && y < d + 2)) return false;
    return !SCHILF.some((s) => Math.hypot(s.x - x, s.y - y) < 2.5);
  }
  function fundeVerteilen() {
    const da = erreichbar();
    // schon liegende Funde, die man nicht (mehr) erreicht, weg
    for (let k = FUNDE.length - 1; k >= 0; k--) if (!da.has(naechsterKnoten(FUNDE[k].x, FUNDE[k].y)) || !fundOrtFrei(FUNDE[k].x, FUNDE[k].y)) FUNDE.splice(k, 1);
    const wege = WEGE.filter((w) => w.every(([x, y]) => bekannt(x, y)));
    // Gesuchtes für offene Aufträge liegt sicher dabei, der Rest ist Zufall
    const vorne = [];
    for (const [art, n] of Object.entries(gesucht())) {
      const liegt = FUNDE.filter((f) => f.art === art).length;
      for (let i = liegt; i < n; i++) vorne.push(art);
    }
    const ziel = Math.max(FUND_ZAHL, FUNDE.length + vorne.length);
    for (let versuch = 0; versuch < 400 && FUNDE.length < ziel; versuch++) {
      const w = wege[Math.floor(Math.random() * wege.length)];
      if (!w) break;
      const i = 1 + Math.floor(Math.random() * (w.length - 1)), t = Math.random();
      const [ax, ay] = w[i - 1], [bx, by] = w[i], l = Math.hypot(bx - ax, by - ay) || 1;
      const seite = Math.random() < 0.5 ? -1 : 1, d = WEG_BREITE / 2 + 1.2 + Math.random() * 3;
      const x = ax + (bx - ax) * t - (by - ay) / l * d * seite, y = ay + (by - ay) * t + (bx - ax) / l * d * seite;
      if (!bekannt(x, y) || imWald(x, y, -2) || OBJEKTE.some((o) => (o.vis || o.r) && Math.hypot(o.x - x, o.y - y) < (o.vis || o.r) + 0.8)) continue;
      if (!fundOrtFrei(x, y) || imSee(x, y, 0.5) || imBach(x, y, 0.5)) continue;
      const kn = naechsterKnoten(x, y);
      if (!da.has(kn) || Math.hypot(KNOTEN[kn][0] - x, KNOTEN[kn][1] - y) > WEG_BREITE / 2 + 5) continue; // am erreichbaren Weg
      if ([...FUNDE, ...SAMMEL, ...STUECKE].some((f) => Math.hypot(f.x - x, f.y - y) < 6)) continue;
      FUNDE.push({ art: vorne.shift() || MATERIAL[Math.floor(Math.random() * MATERIAL.length)].id, x, y });
    }
  }
  function neuerTag() {
    fundeVerteilen();
    for (const m of MATERIAL) tagesPreis[m.id] = Math.max(1, Math.round(m.preis * (0.8 + Math.random() * 0.5)));
  }
  function fundAufsammeln(f) {
    if (Math.hypot(f.x - auto.x, f.y - auto.y) > REICH) return toast("Zu weit weg. Fahr näher heran.");
    if (Math.abs(auto.v) > LANGSAM) { $("stopp").classList.add("tipp"); return toast("Zu schnell! Drück „Stopp“ oder fahr langsam vorbei."); }
    if (beutelVoll() >= BEUTEL_PLATZ) return toast(`🎒 Der Beutel ist voll (${BEUTEL_PLATZ}). Verkauf die Sachen bei Knut.`);
    FUNDE.splice(FUNDE.indexOf(f), 1);
    spiel.material[f.art]++;
    const m = MATERIAL.find((q) => q.id === f.art);
    toast(`${m.icon} ${m.name} eingesteckt (🎒 ${beutelVoll()}/${BEUTEL_PLATZ}).`);
    if (navigator.vibrate) { try { navigator.vibrate(20); } catch { /* egal */ } }
    verbrauchAnzeigen();
  }
  // Materialien als Belohnung: so viele, wie in den Beutel passen, der Rest gibt Münzen
  function materialGeben(belohnung) {
    const teile = [];
    for (const [art, n] of Object.entries(belohnung)) {
      const m = MATERIAL.find((q) => q.id === art), passt = Math.min(n, BEUTEL_PLATZ - beutelVoll());
      spiel.material[art] += passt;
      if (passt) teile.push(`${passt} ${m.icon} ${m.name}`);
      if (n > passt) { spiel.geld += (n - passt) * m.preis; teile.push(`🪙 ${(n - passt) * m.preis} (Beutel voll)`); }
    }
    if (teile.length) setTimeout(() => toast(`🎒 Dazu bekommen: ${teile.join(", ")}`, 4500), 800);
    hudNeu(); verbrauchAnzeigen();
  }
  function beutelZeigen() {
    const liste = $("beutelListe");
    liste.innerHTML = "";
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    liste.append(el("h3", null, `Materialien · ${beutelVoll()}/${BEUTEL_PLATZ} Plätze`));
    const mat = el("div", "beutel-reihe");
    for (const m of MATERIAL) mat.append(el("span", "beutel-ding", `${m.icon} ${m.name} × ${spiel.material[m.id]}`));
    liste.append(mat, el("p", "buch-leer", "Materialien liegen am Wegrand. Knut kauft sie dir ab."));
    liste.append(el("h3", null, "Vorrat"));
    const vorrat = el("div", "beutel-reihe");
    const flick = el("button", "knopf", `🩹 Flickzeug × ${spiel.vorrat.flickzeug}${spiel.platt ? " · jetzt flicken" : ""}`);
    flick.type = "button"; flick.disabled = !spiel.platt || !spiel.vorrat.flickzeug; flick.addEventListener("click", flicken);
    const kan = el("button", "knopf", `⛽ Reservekanister × ${spiel.vorrat.kanister}${spritAnteil() < 1 ? " · einfüllen" : ""}`);
    kan.type = "button"; kan.disabled = !spiel.vorrat.kanister || spritAnteil() >= 0.99; kan.addEventListener("click", kanisterNutzen);
    vorrat.append(flick, kan);
    liste.append(vorrat);
    if (BRAUCHT[spiel.auftrag]) liste.append(el("p", "buch-leer", `Für Knut: ${spiel.beutel}/${BRAUCHT[spiel.auftrag]} ${spiel.auftrag === "reifen" ? "Reifen" : "Batterie"}`));
  }

  function ladenAuf() {
    const l = $("laden");
    const liste = l.querySelector(".waren");
    liste.innerHTML = "";
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const zeile = (name, preis, an, kauf, knopfText) => {
      const z = el("div", "ware"), k = el("button", "knopf", knopfText || `🪙 ${preis}`);
      k.type = "button"; k.disabled = !an || spiel.geld < preis;
      k.addEventListener("click", () => { spiel.geld -= preis; kauf(); hudNeu(); verbrauchAnzeigen(); ladenAuf(); });
      z.append(el("span", null, name), k);
      liste.append(z);
    };
    // Verbrauch: immer wieder nötig
    liste.append(el("h4", "laden-titel", "Verbrauch"));
    if (spiel.sprit === null) spiel.sprit = tankGroesse();
    const fehlt = Math.max(0, tankGroesse() - spiel.sprit), spritPreis = Math.max(1, Math.ceil(fehlt / 150));
    zeile(fehlt > 1 ? `⛽ Volltanken +${Math.round(fehlt)} m` : "⛽ Tank ist voll", spritPreis, fehlt > 1,
      () => { spiel.sprit = tankGroesse(); spritGewarnt = false; toast("⛽ Vollgetankt!"); });
    if (hatTeilEingebaut("licht") && brauchtStrom()) {
      zeile(spiel.strom < 100 ? `🔋 Batterie laden · ${Math.round(spiel.strom)} %` : "🔋 Batterie ist voll", 5, spiel.strom < 100,
        () => { spiel.strom = 100; stromGewarnt = false; toast("🔋 Batterie geladen!"); });
    }
    zeile(`🩹 Flickzeug (${spiel.vorrat.flickzeug} dabei)`, 6, spiel.vorrat.flickzeug < 3, () => { spiel.vorrat.flickzeug++; });
    zeile(`⛽ Kanister (${spiel.vorrat.kanister} dabei)`, 8, spiel.vorrat.kanister < 2, () => { spiel.vorrat.kanister++; });
    // Ankauf: Materialien aus dem Beutel, Preise ändern sich jeden Tag
    if (MATERIAL.some((m) => spiel.material[m.id] > (auftragBedarf()[m.id] || 0))) {
      liste.append(el("h4", "laden-titel", "Knut kauft an"));
      for (const m of MATERIAL) {
        // was ein offener Auftrag braucht, kauft Knut nicht an
        const n = Math.max(0, spiel.material[m.id] - (auftragBedarf()[m.id] || 0));
        if (!n) continue;
        const z = el("div", "ware"), k = el("button", "knopf", `+🪙 ${n * tagesPreis[m.id]}`);
        k.type = "button";
        k.addEventListener("click", () => { spiel.geld += n * tagesPreis[m.id]; spiel.material[m.id] -= n; hudNeu(); verbrauchAnzeigen(); ladenAuf(); });
        z.append(el("span", null, `${m.icon} ${n} × ${m.name}`), k);
        z.title = `Heute zahlt Knut je ${m.name === "Federn" ? "Feder" : m.name} 🪙 ${tagesPreis[m.id]}`;
        liste.append(z);
      }
    }
    // Teile: einzelne Lieferungen nach Aufträgen
    // schon gekaufte Teile liegen in der Werkstatt und verschwinden aus dem Laden (spart Platz)
    const teile = LADEN.filter((w) => (!w.ab || w.ab()) && !spiel.gekauft.has(w.id));
    if (teile.length) liste.append(el("h4", "laden-titel", "Neu reingekommen"));
    for (const w of teile) {
      const hat = spiel.gekauft.has(w.id);
      zeile(w.name, w.preis, !hat, () => {
        spiel.gekauft.add(w.id); spiel.teile.add(w.id);
        if (opt.gekauft) opt.gekauft(w.id);
        toast(`${w.name} gekauft! Liegt jetzt in Opas Werkstatt im Regal.`);
      }, hat ? "gekauft" : null);
    }
    l.querySelector(".kasse").textContent = `🪙 ${spiel.geld}`;
    l.hidden = false;
    l.querySelector(".zweit").focus({ preventScroll: true });
  }

  // --- Gespräch -------------------------------------------------------------
  let gZeilen = [], gNr = 0, gTipp = null, gEnde = null;
  function gespraech(figur, name, ort, zeilen, ende) {
    const box = $("gespraech");
    // Fehlt der Hintergrund (noch kein Bild), steht ein warmer Holzton als Platzhalter da
    // Je Ort ein Tag- und ein Nachtbild (ORT.png, ORT_nacht.png). Nachts das Nachtbild, tagsüber das
    // Tagbild; fehlt eines, springt das andere ein.
    const HG = D.hintergruende || {}, nacht = istNacht();
    const hg = (nacht ? [`${ort}_nacht`, ort] : [ort, `${ort}_nacht`]).find((k) => HG[k]);
    box.style.backgroundImage = hg ? `url(${HG[hg]})`
      : ort === "ostufer" ? "linear-gradient(180deg, #0d1424 0%, #1c2a44 50%, #22311f 56%, #141c12 100%)" // Nacht am See
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
  // --- Musik und Geräusche: siehe ton.js (window.Ton) ----------------------------
  const Ton = window.Ton;

  function zeile() {
    const [geste, text, extra] = gZeilen[gNr];
    // Optional ein Bild zur Zeile (z. B. Opas altes Foto), groß neben der Figur
    let gb = $("gBild");
    if (!gb) { gb = document.createElement("img"); gb.id = "gBild"; gb.alt = ""; $("gespraech").insertBefore(gb, $("gespraech").querySelector(".g-box")); }
    if (extra && extra.bild) { if (gb.src !== extra.bild) gb.src = extra.bild; gb.alt = extra.alt || ""; gb.hidden = false; } else gb.hidden = true;
    const fig = $("gFigur"), figuren = (D.figuren || {})[$("gespraech").dataset.figur] || {};
    fig.hidden = !Object.keys(figuren).length; // Erzähltext ohne Figur (z. B. nachts am Ostufer)
    if (figuren[geste]) {
      if (fig.src !== figuren[geste]) { fig.src = figuren[geste]; fig.classList.remove("neu"); void fig.offsetWidth; fig.classList.add("neu"); }
    }
    const p = $("gText");
    clearInterval(gTipp);
    if (reduce) { p.textContent = text; gTipp = null; return; } // ohne Animation: Text sofort
    // Schreibmaschine: alle 30 ms zwei Buchstaben
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
    if (Ton) Ton.leise(false);
    if (gEnde) gEnde();
    setTimeout(ketteWeiter, 300);
  }
  const tonKnopf = document.createElement("button");
  tonKnopf.type = "button"; tonKnopf.className = "g-ton";
  const tonZeigen = () => { const an = Ton && Ton.an.stimmen; tonKnopf.textContent = an ? "🔊" : "🔇"; tonKnopf.setAttribute("aria-label", an ? "Geräusche aus" : "Geräusche an"); };
  tonZeigen();
  tonKnopf.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!Ton) return;
    Ton.schalte("stimmen", !Ton.an.stimmen); tonZeigen();
    if (Ton.an.stimmen) Ton.freischalten();
  });
  // Musik an/aus: kleiner Knopf unten links auf der Seite, für Werkstatt und Karte
  const musikKnopf = document.createElement("button");
  musikKnopf.type = "button"; musikKnopf.id = "musikKnopf";
  const musikZeigen = () => { const an = Ton && Ton.an.musik; musikKnopf.textContent = an ? "🎵" : "🎵̸"; musikKnopf.classList.toggle("aus", !an); musikKnopf.setAttribute("aria-label", an ? "Musik aus" : "Musik an"); };
  musikZeigen();
  musikKnopf.addEventListener("click", () => {
    if (!Ton) return;
    Ton.freischalten();
    // Erster Tipp überhaupt auf die Note: Der Ton war noch gesperrt, die Musik also nur
    // scheinbar an. Dann nicht ausschalten, sondern nur hörbar machen.
    if (Ton.an.musik && performance.now() - Ton.seit < 800) return musikZeigen();
    Ton.schalte("musik", !Ton.an.musik); musikZeigen();
  });
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
    { id: "camping", name: "Holzweg und Waldsee", x: 52, y: 282, r: 58, offen: false }, // zeigt Moos
    { id: "muehle", name: "Mühlbach und Mühle", x: 296, y: 50, r: 34, offen: false }, // zeichnet Opa ein (G10)
    { id: "ostufer", name: "Ostufer am Waldsee", x: 122, y: 298, r: 22, offen: false }, // zeichnet Moos ein (G8)
    { id: "landstrasse", name: "Landstraße ins Dorf", x: 348, y: 247, r: 46, offen: false }, // Moos' Talkarte (G4)
    { id: "dorf", name: "Klappertal-Dorf", x: 428, y: 250, r: 64, offen: false }, // G11
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
  nebel.width = WX; nebel.height = WY;
  function nebelNeu() {
    const n = nebel.getContext("2d");
    n.globalCompositeOperation = "source-over";
    n.clearRect(0, 0, WX, WY);
    n.fillStyle = "rgba(228,214,180,0.97)"; n.fillRect(0, 0, WX, WY);
    n.strokeStyle = "rgba(140,110,70,0.22)"; n.lineWidth = 0.5;
    for (let i = -WY; i < WX; i += 7) { n.beginPath(); n.moveTo(i, 0); n.lineTo(i + WY, WY); n.stroke(); }
    n.globalCompositeOperation = "destination-out";
    for (const g of GEBIETE) {
      if (!g.offen) continue;
      const gr = n.createRadialGradient(g.x, g.y, g.r * 0.8, g.x, g.y, g.r);
      gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(1, "rgba(0,0,0,0)");
      n.fillStyle = gr; n.beginPath(); n.arc(g.x, g.y, g.r, 0, Math.PI * 2); n.fill();
    }
    miniGrund = null;
  }
  // Nebel nur im sichtbaren Ausschnitt zeichnen, und gar nicht, wenn dort alles erforscht ist
  const klar = (x, y) => GEBIETE.some((g) => g.offen && Math.hypot(x - g.x, y - g.y) < g.r * 0.78);
  function nebelZeichnen(sicht) {
    const x0 = Math.max(0, Math.floor(sicht.x0) - 1), y0 = Math.max(0, Math.floor(sicht.y0) - 1);
    const x1 = Math.min(WX, Math.ceil(sicht.x1) + 1), y1 = Math.min(WY, Math.ceil(sicht.y1) + 1);
    if (x1 <= x0 || y1 <= y0) return;
    let alles = true;
    for (let i = 0; i <= 6 && alles; i++) for (let j = 0; j <= 4 && alles; j++) {
      alles = klar(x0 + (x1 - x0) * i / 6, y0 + (y1 - y0) * j / 4);
    }
    if (!alles) ctx.drawImage(nebel, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
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
  const NETZ_LINIEN = [[[150, 243], ...WEG], ABZWEIG, FELDRAND, WEIDEWEG, HOFWEG, FELDERWEG, WALDPFAD, HOLZWEG, UFERPFAD, SCHILFPFAD, MUEHLENWEG, LANDSTRASSE, DORFSTRASSE];
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
    { id: "muehle", name: "Mühle", art: "ort", x: 295.5, y: 50, gebiet: "muehle" },
    { id: "camping", name: "Campingplatz", art: "ort", x: 39, y: 289.4, gebiet: "camping" },
    { id: "ostufer", name: "Ostufer am Waldsee", art: "weg", x: 114, y: 300.5, gebiet: "ostufer" },
    // erst, wenn Opa von Kauz erzählt hat (G9)
    { id: "kauz", name: "Hütte im Schilf", art: "ort", x: 114.5, y: 279, gebiet: "ostufer", erst: () => Boolean(spiel.neben.kauz) },
    { id: "ortseingang", name: "Ortseingang Klappertal", art: "weg", x: 364, y: 245.8, gebiet: "landstrasse" },
    { id: "eisdiele", name: "Eisdiele", art: "ort", x: 378, y: 248.2, gebiet: "dorf" },
    { id: "feuerwache", name: "Feuerwache", art: "ort", x: 444, y: 250, gebiet: "dorf" },
  ];
  const zielOffen = (z) => !z.kommt && (!z.erst || z.erst()) && GEBIETE.find((g) => g.id === z.gebiet).offen;
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
    // Umgestürzte Bäume auf dem Holzweg, bis Moos sie mit dem Seilzug wegzieht
    { id: "baeume", x: 38.7, y: 226, r: 3, braucht: "holzweg", titel: "Umgestürzte Bäume!",
      text: "Dicke Stämme liegen quer über dem alten Holzweg. Da kommt keiner durch.",
      fehlt: "Förster Moos zieht sie mit seinem Seilzug weg, sobald er ihn repariert hat." },
    // Gatter am Ende des Feldwegs: Privatweg zur Mühle, offen erst, wenn Opa einen hinschickt (G10)
    { id: "gatter", x: 301.2, y: 80, r: 2.5, braucht: "muehlweg", titel: "Ein verschlossenes Gatter",
      text: "Quer über dem Feldweg hängt ein altes Holzgatter. Auf dem Schild: „Privatweg zur Mühle. Nur mit Einladung!“",
      fehlt: "Wer wohnt da wohl? Vielleicht erzählt dir jemand im Tal von der Mühle." },
    // Morsche Holzbrücke über den Mühlbach: trägt nur leichte Autos (Gewicht aus der Werkstatt)
    { id: "bruecke", x: BRUECKE.x, y: BRUECKE.y + 2.5, r: 2.5, braucht: "leicht", titel: "Morsche Brücke!",
      text: `Die Bretter knarzen schon, wenn man nur hinschaut. Mehr als ${BRUECKE.kg} kg trägt die nicht.`,
      fehlt: () => `Dein Auto wiegt ${autoGewicht()} kg. Bau in Opas Werkstatt leichtere Teile ein (höchstens ${BRUECKE.kg} kg).` },
    // Dichtes Schilf auf den Reifenspuren zu Kauz: Der Mähbalken schneidet eine Schneise (dann weg)
    { id: "schilf", x: 119.5, y: 291, r: 3, braucht: "vorne", titel: "Dichtes Schilf!",
      text: "Das Schilf steht hier so dicht wie eine Wand. Die Reifenspuren führen mitten hinein.",
      fehlt: "Es fehlt: ein Mähbalken (Kategorie Vorne). Hilde auf dem Bauernhof mäht doch immer ihre Wiesen …" },
    // Absperrung am Ortseingang: Das Dorf bereitet sein Fest vor (G11 öffnet sie)
    { id: "dorffest", x: DORF.fest[0], y: DORF.fest[1], r: 2.5, braucht: "dorf", titel: "Straße gesperrt!",
      text: "Rot-weiße Absperrung quer über die Straße. Auf dem Schild: „Klappertal-Dorf. Wegen Dorffest-Vorbereitung gesperrt!“",
      fehlt: "Hinter der Absperrung hört man Hämmern und Musik. Das Dorf bereitet gerade sein Fest vor (kommt mit G11)." },
  ];
  // Ohne Werkstatt (Kartenprobe) zählt eine Belohnung gleich als eingebaut
  const TEIL_FUER = { licht: "scheinwerfer", hupe: "spezialhupe", vorne: "maehbalken" };
  const hatTeilEingebaut = (teil) => (opt.hatTeil ? opt.hatTeil(teil) : spiel.teile.has(TEIL_FUER[teil]));
  // Licht braucht Strom: Ist die Batterie leer, bleibt der Scheinwerfer dunkel.
  // Gute Scheinwerfer (Teilwert ohneStrom) laufen ohne Batterie.
  const brauchtStrom = () => !(opt.werte && opt.werte().ohneStrom);
  const autoGewicht = () => Math.round((opt.werte && opt.werte().gewicht) || 0);
  const hatTeil = (teil) => (teil === "holzweg" ? spiel.holzweg : teil === "leicht" ? autoGewicht() <= BRUECKE.kg
    : teil === "muehlweg" ? ["muellerin", "mrad", "foto", "kauzlacht", "versoehnt"].includes(spiel.neben.muehle)
    : teil === "dorf" ? Boolean(spiel.neben.dorf) // Funke hat die Absperrung geöffnet (G11)
    : hatTeilEingebaut(teil) && (teil !== "licht" || !brauchtStrom() || spiel.strom > 0));

  // --- Selbst zum gewählten Ziel fahren ----------------------------------------
  let route = null, routeI = 0, zielWahl = null, haengt = 0, rueck = 0, angehalten = false;
  function planen(ziel) {
    if (!kannFahren()) return zuDunkel();
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
      if (kann && h.id === "schilf") { schilfMaehen(h); continue; }
      if (kann && !h.aktion) continue;
      // nur anhalten, wenn die Route noch hinter das Hindernis führt
      if (!route.slice(routeI).some(([x, y]) => Math.hypot(x - h.x, y - h.y) < 1.5)) continue;
      route = null;
      if (h.id === "dorffest") { funkeSperre(); return true; } // Funke steht an der Absperrung
      $("mTitel").textContent = h.titel;
      const hupen = kann && h.aktion === "hupen";
      $("mText").textContent = hupen ? "Die Schafe stehen mitten auf dem Weg. Zeit für die Spezialhupe!" : h.text;
      $("mFehlt").textContent = typeof h.fehlt === "function" ? h.fehlt() : h.fehlt; $("mFehlt").hidden = hupen;
      $("hupen").hidden = !hupen; $("zurWerkstatt").hidden = hupen;
      $("hupen").onclick = () => hupenBei(h);
      $("meldung").hidden = false;
      (hupen ? $("hupen") : $("zurWerkstatt")).focus();
      return true;
    }
    return false;
  }
  // Schilf am Nordostufer des Waldsees: Büschel aus Halmen mit Rohrkolben. Es verdeckt Kauz'
  // Hütte, bis Opa von ihm erzählt hat; nach dem Mähen bleibt auf dem Schilfpfad eine Schneise.
  const SCHILF = (() => {
    let s = 4242; const z = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    const liste = [];
    const amPfad = (x, y) => SCHILFPFAD.some((q, k) => k > 0 && abstandStrecke(x, y, SCHILFPFAD[k - 1], q) < 7);
    for (let i = 0; i < 1600 && liste.length < 460; i++) {
      const x = 90 + z() * 38, y = 269 + z() * 32;
      if (imSee(x, y, 0.3) || !(imSee(x, y, 11) || amPfad(x, y))) continue; // am Ufer und um den Pfad, nicht im Wasser
      if (UFERPFAD.some((q, k) => k > 0 && abstandStrecke(x, y, UFERPFAD[k - 1], q) < 3.2)) continue;
      liste.push({ x, y, w: z() * Math.PI * 2, n: 5 + Math.floor(z() * 3), kolben: z() < 0.35 });
    }
    return liste;
  })();
  function schilfZeichnen(sicht, t) {
    const n = spiel.neben, h = HINDERNISSE.find((q) => q.id === "schilf");
    const hk = OBJ.kauzwerkstatt;
    if (n.kauz && hk && hk.img.complete && hk.img.naturalWidth) {
      ctx.drawImage(hk.img, KAUZ.X, KAUZ.Y, hk.b, hk.h);
      // Übergang: der Weg läuft weich über den grasigen Rand des Bilds in den Hof hinein
      const p = musterVon("erde");
      if (p) {
        ctx.save(); ctx.strokeStyle = p; ctx.lineCap = "round";
        for (const [b, al, x0] of [[WEG_BREITE + 1.4, 0.3, 111.8], [WEG_BREITE, 0.75, 112.4], [WEG_BREITE - 1.2, 0.9, 113.2]]) {
          ctx.globalAlpha = al; ctx.lineWidth = b;
          ctx.beginPath(); ctx.moveTo(117.5, 279.2); ctx.lineTo(x0, 279.6); ctx.stroke();
        }
        ctx.restore();
      }
    }
    const [kx0, ky0, kx1, ky1] = KAUZ.bereich;
    ctx.save(); ctx.lineCap = "round";
    for (const b of SCHILF) {
      if (b.x < sicht.x0 - 2 || b.x > sicht.x1 + 2 || b.y < sicht.y0 - 2 || b.y > sicht.y1 + 2) continue;
      if (n.kauz && b.x > kx0 + 0.5 && b.x < kx1 - 0.5 && b.y > ky0 + 0.5 && b.y < ky1 - 1) continue; // Hütte frei
      const inSchneise = SCHILFPFAD.some((q, k) => k > 0 && abstandStrecke(b.x, b.y, SCHILFPFAD[k - 1], q) < WEG_BREITE / 2 + 0.4);
      if (inSchneise && h.weg) continue;
      const wiegen = reduce ? 0 : Math.sin(t * 1.3 + b.x * 0.7 + b.y) * 0.12;
      ctx.strokeStyle = "rgba(20,40,15,0.35)"; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.arc(b.x + 0.25, b.y + 0.3, 0.7, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < b.n; i++) {
        const a = b.w + i * (Math.PI * 2 / b.n) + wiegen, l = 1.1 + (i % 3) * 0.25;
        ctx.strokeStyle = i % 2 ? "#5d7a2e" : "#3f5e22"; ctx.lineWidth = 0.16;
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.quadraticCurveTo(b.x + Math.cos(a) * l * 0.5, b.y + Math.sin(a) * l * 0.5 - 0.2, b.x + Math.cos(a) * l, b.y + Math.sin(a) * l); ctx.stroke();
      }
      if (b.kolben) {
        ctx.fillStyle = "#6b4426"; ctx.strokeStyle = "#2a1a0e"; ctx.lineWidth = 0.06;
        for (const d of [0.35, -0.3]) { ctx.beginPath(); ctx.ellipse(b.x + d, b.y - 0.15 + d * 0.4, 0.14, 0.3, b.w, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      }
    }
    ctx.restore();
  }
  let mbBild = null;
  function maehbalkenBild() {
    const src = (window.TEILE || {}).maehbalken_oben;
    if (!src) return null;
    if (!mbBild) mbBild = lade(src);
    return mbBild.complete && mbBild.naturalWidth ? mbBild : null;
  }
  function schilfMaehen(h) {
    h.weg = true;
    toast("🌾 Ratatatat! Der Mähbalken schneidet eine Schneise ins Schilf.", 4000);
    if (navigator.vibrate) { try { navigator.vibrate([30, 30, 30, 30, 30]); } catch { /* egal */ } }
  }
  // Ankunft an einem Ziel: der Ort reagiert (Gespräch, Werkstatt, Meldung)
  function zielHandeln(z) {
    const id = z.id;
    if (id === "schrottplatz") { if (!besucht) ankunft(); else beiKnut(); }
    else if (id === "schuppen" && opt.zurWerkstatt) opt.zurWerkstatt();
    else if (id === "bauernhof") beiHilde();
    else if (id === "foersterhuette") beiMoos();
    else if (id === "camping") beiRosi(rallyeAnbieten);
    else if (id === "ostufer") amOstufer();
    else if (id === "kauz") beiKauz();
    else if (id === "muehle") beiMuellerin();
    else if (id === "eisdiele") beiGino();
    else if (id === "feuerwache") beiFunke();
    else if (id === "felder" && !hatTeil("muehlweg")) toast("Hier endet der Feldweg an einem verschlossenen Gatter: „Privatweg zur Mühle. Nur mit Einladung!“", 5500);
    else toast(`Angekommen: ${z.name}`);
  }
  // Hat eine Figur nach einem erledigten Auftrag gleich den nächsten, erzählt sie ihn im selben
  // Besuch: Nach dem Gespräch wird geprüft, ob der Ort weiter leuchtet und sich etwas getan hat.
  let kette = null;
  const standJetzt = () => JSON.stringify([spiel.neben, spiel.hilde, spiel.rosi, spiel.auftrag, spiel.moosSeil, spiel.opa,
    spiel.knutMoped, spiel.moosRallye, spiel.holzweg, spiel.donnerkeil]);
  function ketteWeiter() {
    const k = kette;
    if (!k || route || !fensterZu() || k.n >= 3) return;
    const s = standJetzt();
    if (s === k.stand) { kette = null; return; }
    k.stand = s; k.n++; aufgabenCache = null;
    const z = aufgabenOrte().find((q) => q.id === k.id);
    if (!z || Math.hypot(z.x - auto.x, z.y - auto.y) > 6 || k.id === "schuppen") { kette = null; return; }
    zielHandeln(z);
  }
  function steuerAuto(dt) {
    if (!route) return null;
    const voraus = 1.8 + Math.max(0, auto.v) * 0.35; // langsam: kurz vorausschauen, damit Ecken nicht geschnitten werden
    while (routeI < route.length - 1 && Math.hypot(route[routeI][0] - auto.x, route[routeI][1] - auto.y) < voraus) routeI++;
    const [tx, ty] = route[routeI], ende = route[route.length - 1];
    const rest = Math.hypot(ende[0] - auto.x, ende[1] - auto.y);
    if (rest < 1.5) {
      route = null;
      kette = { id: zielWahl.id, n: 0, stand: standJetzt() };
      zielHandeln(zielWahl);
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
  function walddachZeichnen(sicht, c = ctx) {
    const p = musterVon("walddach");
    if (!p) return;
    c.save();
    c.fillStyle = p;
    for (const [wx, wy, wr] of WALD) {
      if (wx + wr < sicht.x0 || wx - wr > sicht.x1 || wy + wr < sicht.y0 || wy - wr > sicht.y1) continue;
      for (let i = 0; i < 8; i++) { // viele dünne Ringe übereinander: weicher Übergang ins Gras
        c.globalAlpha = 0.18; c.beginPath(); c.arc(wx, wy, wr * (1.08 - i * 0.02), 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1; c.beginPath(); c.arc(wx, wy, wr * 0.92, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  function zeichneWege(name, breite, alpha, c = ctx, trifft = null) {
    const p = musterVon(name);
    if (!p) return;
    c.save();
    c.globalAlpha = alpha;
    c.strokeStyle = p; c.lineWidth = breite; c.lineCap = "round"; c.lineJoin = "round";
    for (const w of WEGE) {
      if (trifft && !trifft(Math.min(...w.map((q) => q[0])), Math.min(...w.map((q) => q[1])), Math.max(...w.map((q) => q[0])), Math.max(...w.map((q) => q[1])), breite)) continue;
      c.beginPath();
      c.moveTo(w[0][0], w[0][1]);
      for (let i = 1; i < w.length; i++) c.lineTo(w[i][0], w[i][1]);
      c.stroke();
    }
    c.restore();
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
  function dunklerWald(w, h, sicht) {
    const WX = 50, WY = 205, WR = 54; // Bereich, in dem der Lichtkegel gebraucht wird
    if (sicht.x0 > WALD_EINGANG + 8 || sicht.y1 < 95 || sicht.y0 > 305) return; // nicht im Bild
    const mitLicht = hatTeil("licht") && Math.hypot(auto.x - WX, auto.y - WY) < WR + 20;
    if (dunkel.width !== cv.width || dunkel.height !== cv.height) { dunkel.width = cv.width; dunkel.height = cv.height; }
    dctx.setTransform(1, 0, 0, 1, 0, 0); dctx.clearRect(0, 0, dunkel.width, dunkel.height);
    dctx.setTransform(ctx.getTransform());
    // Dunkel nur unter dem Walddach: auf den Wegen im Wald und auf der Lichtung der Hütte
    dctx.fillStyle = dctx.strokeStyle = "rgba(4,10,8,0.93)"; dctx.lineCap = dctx.lineJoin = "round";
    dctx.lineWidth = WEG_BREITE + 3;
    for (const w of [ABZWEIG, WALDPFAD, HOLZWEG.filter(([, y]) => y < 266)]) {
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
    const kegel = (c, farbe0, farbe1) => scheinwerferKegel(c, farbe0, farbe1);
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

  // Boden: ruhiges Gras, Blumenflecken, Walddach, Wege, Kartenrand und Gebäude
  function bodenMalen(c, sicht) {
    const gras = musterVon("gras_ruhig");
    c.fillStyle = gras || "#4d7a35";
    c.fillRect(sicht.x0 - 1, sicht.y0 - 1, sicht.x1 - sicht.x0 + 2, sicht.y1 - sicht.y0 + 2);
    const blumen = musterVon("gras");
    if (blumen) {
      c.fillStyle = blumen;
      for (const [fx, fy, fr] of FLECKEN) {
        if (fx + fr < sicht.x0 || fx - fr > sicht.x1 || fy + fr < sicht.y0 || fy - fr > sicht.y1) continue;
        for (const [k, al] of [[1, 0.25], [0.8, 0.35], [0.6, 0.5]]) {
          c.globalAlpha = al; c.beginPath(); c.arc(fx, fy, fr * k, 0, Math.PI * 2); c.fill();
        }
      }
      c.globalAlpha = 1;
    }
    // Nur malen, was die Kachel berührt (spart beim Vormalen viel Zeit, sonst ruckelt es)
    const trifft = (x0, y0, x1, y1, rand = 2) => x1 + rand > sicht.x0 && x0 - rand < sicht.x1 && y1 + rand > sicht.y0 && y0 - rand < sicht.y1;
    const bild = (o, x, y) => { if (o && o.img.complete && o.img.naturalWidth && trifft(x, y, x + o.b, y + o.h)) c.drawImage(o.img, x, y, o.b, o.h); };
    const mitte = (o, x, y) => o && bild(o, x - o.b / 2, y - o.h / 2);
    walddachZeichnen(sicht, c);
    if (SEE.some(([x, y, r]) => trifft(x - r, y - r, x + r, y + r, 4))) seeMalen(c);
    if (BACH.some((q, k) => k > 0 && trifft(Math.min(q[0], BACH[k - 1][0]), Math.min(q[1], BACH[k - 1][1]), Math.max(q[0], BACH[k - 1][0]), Math.max(q[1], BACH[k - 1][1]), 4))) bachMalen(c);
    zeichneWege("erde", WEG_BREITE + 1.4, 0.35, c, trifft);
    zeichneWege("erde", WEG_BREITE, 1, c, trifft);
    if (trifft(BRUECKE.x - 2, BRUECKE.y - 3, BRUECKE.x + 2, BRUECKE.y + 3)) brueckeMalen(c);
    // Rand der Karte
    c.fillStyle = "rgba(10,20,15,0.85)";
    c.fillRect(-60, -60, WX + 120, 60); c.fillRect(-60, WY, WX + 120, 60); c.fillRect(-60, 0, 60, WY); c.fillRect(WX, 0, 60, WY);

    bild(OBJ.schrottplatz, SCHROTT.X, SCHROTT.Y);
    bild(OBJ.schuppen, SCHUPPEN.X, SCHUPPEN.Y);
    mitte(OBJ.huette, HUETTE.x, HUETTE.y);
    bild(OBJ.bauernhof, HOF.X, HOF.Y);
    bild(OBJ.marktplatz, DORF.platz.X, DORF.platz.Y);
    bild(OBJ.eisdiele, DORF.eis.X, DORF.eis.Y);
    bild(OBJ.feuerwache, DORF.wache.X, DORF.wache.Y);
    for (const h of DORF.haeuser) bild(OBJ[h.bild], h.X, h.Y);
    mitte(OBJ.foersterhuette, FOERSTER.x, FOERSTER.y);
    bild(OBJ.campingplatz, CAMPING.X, CAMPING.Y);
    bild(OBJ.muehle, MUEHLE.X, MUEHLE.Y);
  }
  // Mühlbach: Sandufer, darauf das Wasser als breite Linie
  function bachMalen(c) {
    const sand = musterVon("sand"), wasser = musterVon("wasser");
    if (!sand || !wasser) return;
    const linie = () => { c.beginPath(); c.moveTo(BACH[0][0], BACH[0][1]); for (const [x, y] of BACH.slice(1)) c.lineTo(x, y); };
    c.save(); c.lineCap = "round"; c.lineJoin = "round";
    c.strokeStyle = sand; c.lineWidth = BACH_BREITE + 2.2; c.globalAlpha = 0.7; linie(); c.stroke();
    c.globalAlpha = 1; c.strokeStyle = wasser; c.lineWidth = BACH_BREITE; linie(); c.stroke();
    c.restore();
  }
  // Morsche Holzbrücke über dem Weg: Bretter quer zum Weg, eins fehlt, zwei Geländerbalken
  function brueckeMalen(c) {
    c.save();
    const bx = BRUECKE.x, by = BRUECKE.y;
    // unter und neben der Brücke fließt Wasser: der Weg darunter wird wieder übermalt
    const wasser = musterVon("wasser");
    if (wasser) {
      c.save(); c.beginPath(); c.rect(bx - 4.5, by - 4, 9, 8); c.clip();
      c.strokeStyle = wasser; c.lineWidth = BACH_BREITE; c.lineCap = "round"; c.lineJoin = "round";
      c.beginPath(); c.moveTo(BACH[0][0], BACH[0][1]); for (const [x, y] of BACH.slice(1)) c.lineTo(x, y); c.stroke();
      c.restore();
    }
    c.fillStyle = "rgba(10,20,8,0.35)"; c.fillRect(bx - 1.6, by - 2.6, 3.6, 5.6);
    for (let i = 0; i < 9; i++) {
      if (i === 5) continue; // ein Brett fehlt
      const y = by - 2.6 + i * 0.6;
      c.fillStyle = i % 2 ? "#8a6a43" : "#7a5a36"; c.fillRect(bx - 1.8 + (i % 3) * 0.08, y, 3.6, 0.5);
      c.strokeStyle = "#3a2818"; c.lineWidth = 0.06; c.strokeRect(bx - 1.8 + (i % 3) * 0.08, y, 3.6, 0.5);
    }
    c.fillStyle = "#5a3e24";
    for (const dx of [-1.95, 1.75]) { c.fillRect(bx + dx, by - 2.8, 0.25, 5.6); }
    c.restore();
  }
  // Waldsee: weiches Sandufer, darauf das Wasser
  function seeMalen(c) {
    const sand = musterVon("sand"), wasser = musterVon("wasser");
    if (!sand || !wasser) return;
    const kreise = (k) => { c.beginPath(); for (const [x, y, r] of SEE) { c.moveTo(x + r + k, y); c.arc(x, y, r + k, 0, Math.PI * 2); } };
    c.save();
    c.fillStyle = sand;
    for (const [k, al] of [[2.6, 0.3], [1.8, 0.6], [1.1, 1]]) { c.globalAlpha = al; kreise(k); c.fill(); }
    c.globalAlpha = 1; c.fillStyle = wasser; kreise(0); c.fill();
    c.restore();
  }
  // Kacheln à 16 m in der aktuellen Auflösung; ändert sie sich, wird neu gemalt.
  // Fertig gemalt wird erst, wenn alle Bilder geladen sind.
  const KACHEL = 16, kacheln = new Map();
  let kachelPx = 0;
  function bodenBereit() {
    if (!["gras_ruhig", "gras", "erde", "walddach", "wasser", "sand"].every((n) => musterVon(n))) return false;
    return ["schrottplatz", "schuppen", "huette", "bauernhof", "foersterhuette", "campingplatz", "muehle", "marktplatz", "eisdiele", "feuerwache"].every((n) => !OBJ[n] || (OBJ[n].img.complete && OBJ[n].img.naturalWidth));
  }
  function kachelMalen(kx, ky, px) {
    const k = document.createElement("canvas"); k.width = k.height = px;
    const c = k.getContext("2d"), wx = kx * KACHEL, wy = ky * KACHEL, f = px / KACHEL;
    c.setTransform(f, 0, 0, f, -wx * f, -wy * f);
    bodenMalen(c, { x0: wx, x1: wx + KACHEL, y0: wy, y1: wy + KACHEL });
    if (kacheln.size > 72) kacheln.delete(kacheln.keys().next().value); // älteste weg (Speicher auf dem Handy)
    return k;
  }
  const kachelWeg = (k) => k.getContext("2d").isContextLost && k.getContext("2d").isContextLost();
  function bodenAusKacheln(sicht, pxProM) {
    if (!bodenBereit()) return false;
    const px = Math.ceil(KACHEL * pxProM);
    if (px !== kachelPx) { kacheln.clear(); kachelPx = px; }
    const x0 = Math.floor(sicht.x0 / KACHEL), x1 = Math.floor(sicht.x1 / KACHEL);
    const y0 = Math.floor(sicht.y0 / KACHEL), y1 = Math.floor(sicht.y1 / KACHEL);
    const ueber = 1 / pxProM; // ein Pixel Überlappung gegen feine Fugen
    let gemalt = 0;
    for (let ky = y0; ky <= y1; ky++) for (let kx = x0; kx <= x1; kx++) {
      const key = kx + "," + ky;
      let k = kacheln.get(key);
      // Auf dem Handy kann der Browser bei Speichernot einzelne Zeichenflächen verwerfen: dann neu malen
      if (k && kachelWeg(k)) { kacheln.delete(key); k = null; }
      if (!k) { k = kachelMalen(kx, ky, px); gemalt++; } else kacheln.delete(key);
      kacheln.set(key, k); // zuletzt benutzt ans Ende
      ctx.drawImage(k, kx * KACHEL, ky * KACHEL, KACHEL + ueber, KACHEL + ueber);
    }
    // Vorausmalen gegen Ruckler: Ist in diesem Bild nichts Neues gemalt worden, eine fehlende
    // Kachel direkt neben dem Bildrand malen, die in Fahrtrichtung zuerst
    if (!gemalt) {
      const vx = Math.cos(auto.a) * Math.sign(auto.v || 1), vy = Math.sin(auto.a) * Math.sign(auto.v || 1);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      let beste = null, bestWert = -Infinity;
      for (let ky = y0 - 1; ky <= y1 + 1; ky++) for (let kx = x0 - 1; kx <= x1 + 1; kx++) {
        if (kx >= x0 && kx <= x1 && ky >= y0 && ky <= y1) continue;
        if (kx < 0 || ky < 0 || kx * KACHEL >= WX || ky * KACHEL >= WY || kacheln.has(kx + "," + ky)) continue;
        const wert = (kx - cx) * vx + (ky - cy) * vy;
        if (wert > bestWert) { bestWert = wert; beste = [kx, ky]; }
      }
      if (beste) kacheln.set(beste[0] + "," + beste[1], kachelMalen(beste[0], beste[1], px));
    }
    return true;
  }

  function zeichne() {
    const w = cv.clientWidth, h = cv.clientHeight;
    // Schärfe begrenzen: bildschirmfüllend auf dem Handy wären es sonst weit über eine
    // Million Pixel je Bild, das ruckelt. Höchstens 1,5-fach und rund 0,8 Mio. Pixel.
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(800000 / Math.max(1, w * h))));
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const m = Math.min(w, h) / 26; // Pixel pro Meter: kurze Bildseite zeigt 26 m
    const vor = Math.max(0, auto.v) * 1.2;
    const kx = auto.x + Math.cos(auto.a) * vor, ky = auto.y + Math.sin(auto.a) * vor;
    ctx.setTransform(dpr * m, 0, 0, dpr * m, dpr * (w / 2 - kx * m), dpr * (h / 2 - ky * m));
    kamera = { m, kx, ky };
    const sicht = { x0: kx - w / 2 / m, x1: kx + w / 2 / m, y0: ky - h / 2 / m, y1: ky + h / 2 / m };

    // Boden (Gras, Blumen, Walddach, Wege, Gebäude) ändert sich nie: einmal in Kacheln
    // vormalen und je Bild nur die sichtbaren Kacheln hinlegen
    if (!bodenAusKacheln(sicht, dpr * m)) bodenMalen(ctx, sicht);

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

    // Holzgatter am Ende des Feldwegs (offen, sobald man zur Mühle darf: dann zur Seite geschwenkt)
    {
      const g = HINDERNISSE.find((q) => q.id === "gatter"), auf = hatTeil("muehlweg");
      ctx.save(); ctx.translate(g.x, g.y);
      ctx.fillStyle = "#4a3220"; ctx.strokeStyle = "#1d140a"; ctx.lineWidth = 0.08;
      for (const dx of [-3.1, 3.1]) { ctx.beginPath(); ctx.arc(dx, 0, 0.35, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.translate(-3.1, 0); ctx.rotate(auf ? -1.35 : 0);
      ctx.fillStyle = "#8a6440";
      for (const dy of [-0.32, 0.18]) { ctx.fillRect(0.2, dy, 5.8, 0.28); ctx.strokeRect(0.2, dy, 5.8, 0.28); }
      ctx.beginPath(); ctx.moveTo(0.4, 0.4); ctx.lineTo(5.8, -0.35); ctx.lineWidth = 0.18; ctx.strokeStyle = "#6b4a2b"; ctx.stroke();
      if (!auf) { ctx.fillStyle = "#f3ead6"; ctx.strokeStyle = "#1d140a"; ctx.lineWidth = 0.06; ctx.fillRect(2.4, -0.9, 1.4, 0.75); ctx.strokeRect(2.4, -0.9, 1.4, 0.75); }
      ctx.restore();
    }
    // Rot-weiße Absperrung am Ortseingang (bis G11), daneben das Ortsschild
    if (!hatTeil("dorf")) {
      const h = HINDERNISSE.find((q) => q.id === "dorffest");
      ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(Math.PI / 2 + 0.05);
      ctx.fillStyle = "rgba(10,20,8,0.3)"; ctx.fillRect(-3.1 + 0.2, -0.2 + 0.2, 6.2, 0.5);
      for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? "#f4f1ea" : "#d23a2a"; ctx.fillRect(-3.1 + i * 0.775, -0.25, 0.775, 0.5); }
      ctx.strokeStyle = "#1d140a"; ctx.lineWidth = 0.08; ctx.strokeRect(-3.1, -0.25, 6.2, 0.5);
      ctx.fillStyle = "#2a2a2a"; for (const dx of [-2.6, 2.6]) { ctx.beginPath(); ctx.arc(dx, 0, 0.3, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    {
      const [sx, sy] = DORF.schild;
      ctx.save(); ctx.translate(sx, sy - 1.6);
      ctx.fillStyle = "#f2c230"; ctx.strokeStyle = "#1d140a"; ctx.lineWidth = 0.1;
      ctx.beginPath(); ctx.roundRect(-2.4, -0.6, 4.8, 1.2, 0.15); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#1d140a"; ctx.font = "900 0.7px Nunito, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("KLAPPERTAL", 0, 0.03);
      ctx.restore();
    }
    // Umgestürzte Stämme quer über dem Holzweg, bis Moos sie wegzieht
    if (!spiel.holzweg) {
      const h = HINDERNISSE.find((q) => q.id === "baeume");
      for (const [dx, dy, rot, lang] of [[-0.6, -0.8, 0.35, 7], [0.5, 0.9, -0.5, 6.2]]) {
        ctx.save(); ctx.translate(h.x + dx, h.y + dy); ctx.rotate(rot);
        ctx.fillStyle = "rgba(10,20,8,0.35)"; ctx.beginPath(); ctx.roundRect(-lang / 2 + 0.3, -0.45, lang, 1.1, 0.5); ctx.fill();
        ctx.fillStyle = "#6b4a2b"; ctx.strokeStyle = "#2a1a0e"; ctx.lineWidth = 0.12;
        ctx.beginPath(); ctx.roundRect(-lang / 2, -0.55, lang, 1.1, 0.5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#c79a5e"; ctx.beginPath(); ctx.ellipse(lang / 2 - 0.15, 0, 0.3, 0.52, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "#4a3220"; ctx.beginPath(); ctx.moveTo(-lang / 2 + 0.8, -0.2); ctx.lineTo(lang / 2 - 1, -0.25); ctx.moveTo(-lang / 2 + 1.4, 0.2); ctx.lineTo(lang / 2 - 1.6, 0.18); ctx.stroke();
        ctx.restore();
      }
    }
    schilfZeichnen(sicht, t);
    // Materialien am Wegrand: kleiner Schimmer und ein Zeichen
    ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "1.3px sans-serif";
    for (const f of FUNDE) {
      if (f.x < sicht.x0 - 2 || f.x > sicht.x1 + 2 || f.y < sicht.y0 - 2 || f.y > sicht.y1 + 2) continue;
      ctx.fillStyle = "rgba(255,240,180,0.35)";
      ctx.beginPath(); ctx.arc(f.x, f.y, 1 + (reduce ? 0 : Math.sin(t * 3 + f.x) * 0.12), 0, Math.PI * 2); ctx.fill();
      ctx.fillText(MATERIAL.find((m) => m.id === f.art).icon, f.x, f.y + 0.05);
    }
    ctx.restore();

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
      // Mähbalken vorne (Kategorie Vorne, 1 × 4 Zellen): gehört nicht zum fertigen Autobild
      const mb = maehbalkenBild();
      if (mb && hatTeilEingebaut("vorne")) ctx.drawImage(mb, kurz / 2 - 0.05, -breit / 2, kurz / 10, breit);
      ctx.restore();
    }
    for (const o of OBJEKTE) zeichneObjekt(o, sicht);
    piepsAufAuto();
    tiereLuft(sicht);
    // Dunkler Wald hinter dem Hindernis
    dunklerWald(w, h, sicht);
    wolkenZeichnen(sicht);
    // Nebel über unerforschten Gebieten
    ctx.imageSmoothingEnabled = true;
    nebelZeichnen(sicht);
    ctx.save();
    ctx.fillStyle = "rgba(90,70,45,0.75)"; ctx.font = "800 2.2px Nunito, sans-serif"; ctx.textAlign = "center";
    for (const g of GEBIETE) if (!g.offen && g.x > sicht.x0 - 20 && g.x < sicht.x1 + 20 && g.y > sicht.y0 - 20 && g.y < sicht.y1 + 20) {
      ctx.fillText("? Unerforscht ?", g.x, g.y); ctx.fillText("Kartenstück fehlt", g.x, g.y + 3);
    }
    ctx.restore();
    nachtZeichnen(w, h, dpr);
    aufgabenWelt(sicht, t); // nach Nacht und dunklem Wald: Aufgaben leuchten immer
    huetchenZeichnen(sicht);
    piepsWelt(sicht); // Pieps' Noten sieht man auch nachts und über dem Walddach
    wetterBildschirm(w, h, dpr);

    // Anzeige
    tachoZeichnen();
    const sk = $("stopp");
    sk.hidden = !route;
    sk.textContent = angehalten ? "▶ Weiter" : "✋ Stopp";
    // Ein Gegenstand (Reifen, Batterie, Material) liegt in Reichweite: „Stopp“ leuchtet, solange das Auto noch rollt
    const inReichweite = (g) => Math.hypot(g.x - auto.x, g.y - auto.y) <= REICH + 2;
    const sammelbar = (BRAUCHT[spiel.auftrag] && SAMMEL.some((g) => sichtbar(g) && inReichweite(g))) || FUNDE.some(inReichweite);
    sk.classList.toggle("tipp", Boolean(route) && !angehalten && sammelbar);
    $("weg").hidden = !route;
    if (route) $("weg").textContent = `📍 ${zielWahl.name} · ${Math.round((route.length - routeI) * 2)} m`;
    miniZeichnen();
  }

  // Rallye-Start: Rennflagge nur auf der Minikarte, sobald die Rallye freigespielt ist und bis
  // man sie mit Gold abgeschlossen hat
  function rallyeOrt() {
    const z = zielVon("camping");
    return rallyeMoeglich() && zielOffen(z) && !(spiel.rallye && spiel.rallye.medaille === "gold") ? z : null;
  }
  // Zielflagge (schwarz-weiß kariert) am Mast; x, y = Fuß des Masts, s = Höhe
  function flaggeZeichnen(c, x, y, s, t) {
    const b = s * 0.62, h = s * 0.42, n = 4, m = 3;
    c.save();
    c.lineCap = "round"; c.strokeStyle = "#12232a"; c.lineWidth = s * 0.07;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - s); c.stroke();
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
      const welle = (q) => (reduce ? 0 : Math.sin(t * 6 - q * 3) * s * 0.04 * q);
      const x0 = x + (i / n) * b, x1 = x + ((i + 1) / n) * b;
      const y0 = y - s + (j / m) * h, y1 = y - s + ((j + 1) / m) * h;
      c.fillStyle = (i + j) % 2 ? "#fffaf0" : "#1d1a16";
      c.beginPath();
      c.moveTo(x0, y0 + welle(i / n)); c.lineTo(x1, y0 + welle((i + 1) / n));
      c.lineTo(x1, y1 + welle((i + 1) / n)); c.lineTo(x0, y1 + welle(i / n)); c.closePath(); c.fill();
    }
    c.lineWidth = s * 0.04; c.strokeStyle = "#12232a";
    
    c.restore();
  }
  // Aufgaben-Orte in der Fahransicht: gelber Ring am Boden und ein schwebendes Ausrufezeichen
  function aufgabenWelt(sicht, t) {
    const puls = reduce ? 0.5 : (Math.sin(t * 4) + 1) / 2;
    for (const z of aufgabenOrte()) {
      if (!imBild(z.x, z.y, sicht, 8)) continue;
      ctx.save();
      ctx.lineWidth = 0.35; ctx.strokeStyle = `rgba(255,214,60,${0.45 + puls * 0.45})`;
      ctx.beginPath(); ctx.arc(z.x, z.y, 3 + puls * 0.8, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(255,214,60,${0.12 + puls * 0.12})`; ctx.fill();
      ctx.restore();
      ausrufZeichnen(ctx, z.x, z.y - 4.2 - (reduce ? 0 : Math.abs(Math.sin(t * 3)) * 0.6), 0.9);
    }
  }
  // Übersichtskarte oben rechts
  const mini = $("mini"), mctx = mini.getContext("2d");
  let miniGrund = null;
  function miniZeichnen() {
    // so hoch wie im Stylesheet, so breit wie die Karte im Verhältnis
    const hoch = mini.clientHeight || 96, breitPx = Math.round(hoch * WX / WY);
    if (mini.style.width !== breitPx + "px") mini.style.width = breitPx + "px";
    const s = hoch * Math.min(window.devicePixelRatio || 1, 2), sb = Math.round(s * WX / WY);
    if (mini.height !== s || mini.width !== sb) { mini.width = sb; mini.height = s; miniGrund = null; }
    const k = s / WY;
    if (!miniGrund) {
      miniGrund = document.createElement("canvas"); miniGrund.width = sb; miniGrund.height = s;
      const g = miniGrund.getContext("2d");
      g.fillStyle = "#5d8a3e"; g.fillRect(0, 0, sb, s);
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
      for (const [hx0, hy0, hx1, hy1] of [HUETTE.haus, FOERSTER.haus, ...HOF.haeuser, ...DORF_HAEUSER]) g.fillRect(hx0 * k, hy0 * k, (hx1 - hx0) * k, (hy1 - hy0) * k);
    }
    if (!miniGrund.mitNebel) { miniGrund.getContext("2d").drawImage(nebel, 0, 0, sb, s); miniGrund.mitNebel = true; }
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
    // Aufgaben-Orte blinken gelb
    const puls = reduce ? 0.5 : (Math.sin(performance.now() / 250) + 1) / 2;
    for (const z of aufgabenOrte()) {
      mctx.fillStyle = `rgba(255,214,60,${0.35 + puls * 0.5})`; mctx.strokeStyle = "#12232a"; mctx.lineWidth = 1.5;
      mctx.beginPath(); mctx.arc(z.x * k, z.y * k, 4 + puls * 2.5, 0, 7); mctx.fill(); mctx.stroke();
    }
    const ro = rallyeOrt();
    if (ro) flaggeZeichnen(mctx, ro.x * k, ro.y * k + 4, 14, performance.now() / 1000);
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
  // Hildes ausgebüxte Kuh Berta: steht am Waldweg, bis man mit dem Auto vorbeikommt, dann trottet sie zur Weide
  const BERTA = { art: "kuh", hx: 78, hy: 215.3, x: 78, y: 215.3, a: 2.4, grast: true, da: false, heim: false, wechsel: 2 };
  function bertaSetzen() {
    const k = spiel.neben.kuh;
    Object.assign(BERTA, { x: BERTA.hx, y: BERTA.hy, da: k === "suchen", heim: false, grast: true });
  }
  function bertaSchritt(dt) {
    if (!BERTA.da) return;
    if (!BERTA.heim) {
      if ((BERTA.wechsel -= dt) <= 0) { BERTA.grast = !BERTA.grast; BERTA.wechsel = zufall(1.5, 4); }
      if (spiel.neben.kuh === "suchen" && Math.hypot(auto.x - BERTA.x, auto.y - BERTA.y) < 8) {
        spiel.neben.kuh = "heim"; BERTA.heim = true; BERTA.grast = false; hudNeu();
        toast("🐄 Muuuh! Da ist Berta. Sie trottet gemütlich zurück zum Hof. Sag Hilde Bescheid!", 4500);
      }
      return;
    }
    // zur Weide: erst vom Auto weg, dann über die Felder (Zäune und Bäume stören eine Kuh nicht)
    const zx = (WEIDE[0] + WEIDE[2]) / 2, zy = (WEIDE[1] + WEIDE[3]) / 2;
    drehZu(BERTA, Math.atan2(zy - BERTA.y, zx - BERTA.x), dt * 1.5);
    BERTA.x += Math.cos(BERTA.a) * 2.2 * dt; BERTA.y += Math.sin(BERTA.a) * 2.2 * dt;
    if (BERTA.x > WEIDE[0] + 3 && BERTA.x < WEIDE[2] - 3 && BERTA.y > WEIDE[1] + 3 && BERTA.y < WEIDE[3] - 3) {
      BERTA.da = false;
      SCHAFE.push({ art: "kuh", x: BERTA.x, y: BERTA.y, a: BERTA.a, zx: 0, zy: 0, warte: zufall(2, 6), grast: true });
    }
  }
  // Pieps (G4) sitzt in einem Baum nahe am Weg. Unter dem Walddach sieht man ihn nicht, nur die Noten
  const PIEPS_ORTE = [[103.5, 204.5], [79, 216], [29, 235.5], [15.5, 264], [131, 292.5]]; // je 4 m neben dem Weg
  const PIEPS = { x: 0, y: 0, a: 0, ruf: 1, noten: [], gehoert: false };
  const PIEPS_HOEREN = 70, PIEPS_FANGEN = 6;
  function piepsSetzen() {
    const o = PIEPS_ORTE[spiel.neben.piepsOrt] || PIEPS_ORTE[0];
    Object.assign(PIEPS, { x: o[0], y: o[1], a: zufall(0, 6.3), ruf: 1, noten: [], gehoert: false });
  }
  function piepsSchritt(dt) {
    const n = spiel.neben;
    for (const no of PIEPS.noten) no.t += dt;
    PIEPS.noten = PIEPS.noten.filter((no) => no.t < 1.8);
    if (n.pieps !== "suchen" || !$("gespraech").hidden) return;
    const d = Math.hypot(auto.x - PIEPS.x, auto.y - PIEPS.y);
    if (d < PIEPS_FANGEN) {
      n.pieps = "dabei"; PIEPS.noten = []; hudNeu();
      if (Ton && Ton.pieps) Ton.pieps(1, 0);
      toast("🐦 Pieps! Da ist er! Er hüpft auf dein Auto. Bring ihn zu Moos zurück.", 4500);
      return;
    }
    if (d > PIEPS_HOEREN || (PIEPS.ruf -= dt) > 0) return;
    PIEPS.ruf = 1.3 + Math.random() * 1.2;
    PIEPS.noten.push({ t: 0, dx: zufall(-0.8, 0.8) });
    if (Ton && Ton.pieps) Ton.pieps(0.08 + Math.pow(1 - d / PIEPS_HOEREN, 1.5) * 0.92, (PIEPS.x - auto.x) / Math.max(d, 1));
    if (!PIEPS.gehoert) { PIEPS.gehoert = true; toast("🎵 Pieps, pieps … Da piepst doch was im Wald!", 3500); }
  }
  // Pieps sitzend (nicht unter dem Walddach) und die Noten über ihm; außerhalb des Bilds
  // zeigt eine Note am Rand, aus welcher Richtung es piepst
  function piepsWelt(sicht) {
    const n = spiel.neben, T = TIERBILD.pieps;
    if (n.pieps === "suchen" && T && imBild(PIEPS.x, PIEPS.y, sicht) && !unterDach(PIEPS.x, PIEPS.y)) tierZeichnen(T[1], PIEPS.x, PIEPS.y, PIEPS.a, 0.8);
    if (!PIEPS.noten.length) return;
    ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "900 3.6px Nunito, sans-serif";
    ctx.lineWidth = 0.5; ctx.lineJoin = "round"; ctx.strokeStyle = "rgba(15,25,45,0.85)";
    const mx = (sicht.x0 + sicht.x1) / 2, my = (sicht.y0 + sicht.y1) / 2;
    for (const no of PIEPS.noten) {
      let x = PIEPS.x + no.dx + no.t * 0.6, y = PIEPS.y - 2 - no.t * 2.2;
      if (!imBild(x, y, sicht, -2)) { // an den Bildrand holen
        const dx = x - mx, dy = y - my, hx = (sicht.x1 - sicht.x0) / 2 - 3, hy = (sicht.y1 - sicht.y0) / 2 - 3;
        const k = Math.min(hx / Math.max(Math.abs(dx), 0.01), hy / Math.max(Math.abs(dy), 0.01));
        x = mx + dx * k; y = my + dy * k;
      }
      ctx.globalAlpha = Math.max(0, 1 - no.t / 1.8);
      ctx.fillStyle = "#a8dcff"; ctx.strokeText("♪", x, y); ctx.fillText("♪", x, y);
    }
    ctx.restore();
  }
  // Pieps fährt mit: sitzt hinten auf dem Auto
  function piepsAufAuto() {
    const T = TIERBILD.pieps;
    if (spiel.neben.pieps !== "dabei" || !T) return;
    const hops = Math.max(0, Math.sin(performance.now() / 260)) * 0.15;
    tierZeichnen(T[1], auto.x - Math.cos(auto.a) * 0.6, auto.y - Math.sin(auto.a) * 0.6 - hops, auto.a, 0.75);
  }
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
    bertaSchritt(dt);
    piepsSchritt(dt);
    eisSchritt(dt);
    huetchenSchritt();
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
    // Hasen: Pause, dann ein paar Sprünge; kommt das Auto, schnell zur Seite davon
    for (const h of HASEN) {
      const d = Math.hypot(h.x - auto.x, h.y - auto.y);
      if (d < 8 + Math.abs(auto.v) && Math.abs(auto.v) > 0.5) {
        if (!h.flucht) { h.flucht = true; h.pause = 0; }
        h.hops = 6;
        if (h.phase <= 0) h.a = fluchtRichtung(h);
      }
      if (h.phase > 0) {
        h.phase -= dt;
        const tempo = h.flucht ? 8.5 : 3.2;
        h.x += Math.cos(h.a) * tempo * dt; h.y += Math.sin(h.a) * tempo * dt;
        if (h.phase <= 0) { h.hops--; h.pause = h.hops > 0 ? (h.flucht ? 0.05 : zufall(0.15, 0.35)) : zufall(1.5, 5); }
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
    // Hasen weichen seitlich aus (auf die Seite, auf der sie schon sitzen), nicht vor dem
    // Auto her. Liegt der Hase hinter dem Auto, einfach weg davon.
    function fluchtRichtung(h) {
      const vx = Math.cos(auto.a) * Math.sign(auto.v), vy = Math.sin(auto.a) * Math.sign(auto.v);
      const dx = h.x - auto.x, dy = h.y - auto.y, d = Math.hypot(dx, dy) || 1;
      if (dx * vx + dy * vy < 0) return Math.atan2(dy, dx) + zufall(-0.4, 0.4);
      const seite = dx * vy - dy * vx > 0 ? 1 : -1; // rechts (1) oder links (-1) der Fahrtrichtung
      const sx = vy * seite + dx / d * 0.5, sy = -vx * seite + dy / d * 0.5;
      return Math.atan2(sy, sx) + zufall(-0.25, 0.25);
    }
    auseinander(dt);
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
  // Tiere laufen nicht übereinander und nicht über Felsen, Büsche und Bäume: wer zu nah
  // kommt, wird sanft zur Seite geschoben
  const tierGroesse = (t) => (t.art === "kuh" ? 1.0 : t.art === "schaf" || t.zx !== undefined ? 0.65 : 0.35);
  function auseinander(dt) {
    const alle = [...SCHAFE, ...HERDE, ...HASEN], k = Math.min(1, dt * 8);
    for (let i = 0; i < alle.length; i++) {
      const a = alle[i], ga = tierGroesse(a);
      for (let j = i + 1; j < alle.length; j++) {
        const b = alle[j], min = ga + tierGroesse(b), dx = b.x - a.x, dy = b.y - a.y;
        if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d >= min) continue;
        const s = (min - d) / 2 * k / d;
        a.x -= dx * s; a.y -= dy * s; b.x += dx * s; b.y += dy * s;
      }
      for (const o of OBJEKTE) {
        if (!o.r || !o.art || o.art === "zaun" || Math.abs(o.x - a.x) > 5 || Math.abs(o.y - a.y) > 5) continue;
        const dx = a.x - o.x, dy = a.y - o.y, d = Math.hypot(dx, dy) || 0.01, min = o.r + ga;
        if (d < min) { a.x += dx / d * (min - d) * k; a.y += dy / d * (min - d) * k; }
      }
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
  // Unter dem hohen Walddach (nicht auf Wegen und Lichtungen) sieht man nichts vom Boden
  function unterDach(x, y) {
    if (!WALD.some(([wx, wy, wr]) => Math.hypot(x - wx, y - wy) < wr * 0.95)) return false;
    if (abstandWeg(x, y) < WEG_BREITE / 2 + 0.6) return false;
    return ![FOERSTER.bereich, CAMPING.bereich, KAUZ.bereich].some(([a, b, c, e]) => x > a && x < c && y > b && y < e);
  }
  function tiereBoden(sicht) {
    const T = TIERBILD;
    const berta = BERTA.da ? [BERTA] : [];
    for (const sf of [...SCHAFE, ...berta, ...HERDE.map((q) => ({ ...q, art: "schaf", grast: q.grast && !q.flucht }))]) if (imBild(sf.x, sf.y, sicht) && T[sf.art] && !unterDach(sf.x, sf.y)) {
      const b = T[sf.art][sf.grast ? 1 : 0];
      tierSchatten(b, sf.x + 0.15, sf.y + 0.15, sf.a, 1, 1);
      tierZeichnen(b, sf.x, sf.y, sf.a);
    }
    // Hasen und Vögel gehen in der Dämmerung schlafen: sie blenden aus, nachts sind sie weg
    const wach = tagTiere();
    if (wach <= 0) return;
    ctx.save(); ctx.globalAlpha = wach;
    for (const h of HASEN) if (imBild(h.x, h.y, sicht) && T.hase && !unterDach(h.x, h.y)) {
      const b = T.hase[h.phase > 0 ? 1 : 0], hub = h.phase > 0 ? Math.sin((0.22 - h.phase) / 0.22 * Math.PI) * 0.25 : 0;
      tierSchatten(b, h.x + 0.1, h.y + 0.1, h.a, 1, 1);
      tierZeichnen(b, h.x - hub * 0.3, h.y - hub * 0.3, h.a, 1 + hub * 0.3);
    }
    if (!T.vogel) { ctx.restore(); return; }
    for (const v of [...VOEGEL, ...ueberflug.voegel]) {
      if (!imBild(v.x + v.z * 0.6, v.y + v.z * 0.6, sicht, 6)) continue;
      const b = T.vogel[v.fliegt && Math.sin(v.flap * 2) > 0 ? 0 : 1];
      // Je höher, desto weiter weg (nach unten rechts) und blasser liegt der Schatten.
      // Über dem Wald fällt er auf die hohen Kronen: dann ganz nah am Vogel und kleiner
      const dach = unterDach(v.x, v.y), sz = dach ? Math.min(v.z, 1.2) : v.z;
      if (!(dach && !v.fliegt)) tierSchatten(b, v.x + sz * 0.6, v.y + sz * 0.6, v.a, 1, Math.max(0.5, 1 - sz * 0.03));
      if (!v.fliegt && !dach) tierZeichnen(b, v.x, v.y, v.a, 0.85);
    }
    ctx.restore();
  }
  // 1 = tagsüber alle Hasen und Vögel da, 0 = nachts keine (dazwischen blenden sie aus)
  const tagTiere = () => Math.max(0, Math.min(1, 1 - (dunkelheit() - 0.2) / 0.3));
  // In der Luft (über Bäumen und Auto): fliegende Vögel, mit der Höhe etwas größer
  function tiereLuft(sicht) {
    const wach = tagTiere();
    if (!TIERBILD.vogel || wach <= 0) return;
    ctx.save(); ctx.globalAlpha = wach;
    for (const v of [...VOEGEL, ...ueberflug.voegel]) {
      if (!v.fliegt || !imBild(v.x, v.y, sicht, 6)) continue;
      tierZeichnen(TIERBILD.vogel[Math.sin(v.flap * 2) > 0 ? 0 : 1], v.x, v.y, v.a, 1 + v.z * 0.05);
    }
    ctx.restore();
  }

  // --- Wetter ----------------------------------------------------------------
  // Jedes Wetter ist eine Mischung aus vier Stärken (0 bis 1). Beim Wechsel gleiten
  // die Stärken langsam zum neuen Wetter, so gibt es keine harten Sprünge.
  const WETTER = {
    sonne: { name: "Sonnig", icon: "☀️", wolken: 0.3, regen: 0, nebel: 0, wind: 0.15 },
    wolkig: { name: "Wolkig", icon: "⛅", wolken: 1, regen: 0, nebel: 0, wind: 0.35 },
    regen: { name: "Regen", icon: "🌧️", wolken: 1, regen: 1, nebel: 0.15, wind: 0.45 },
    nebel: { name: "Nebel", icon: "≋", wolken: 0.15, regen: 0, nebel: 1, wind: 0.05 },
    wind: { name: "Windig", icon: "🍃", wolken: 0.6, regen: 0, nebel: 0, wind: 1 },
  };
  const FOLGE = { sonne: ["wolkig", "wind", "nebel"], wolkig: ["sonne", "regen", "wind"], regen: ["wolkig"],
    nebel: ["sonne", "wolkig"], wind: ["wolkig", "sonne"] };
  const wetter = { art: opt.wetter || "sonne", fest: Boolean(opt.wetter), dauer: 80, ist: { ...WETTER[opt.wetter || "sonne"] } };
  // nachts zeigt das Wettersymbol den Mond statt der Sonne
  const wetterIcon = (art) => (art === "sonne" && dunkelheit() > 0.5 ? "🌕" : WETTER[art].icon);
  function wetterSetzen(art, fest) {
    wetter.art = art; wetter.fest = fest; wetter.dauer = 70 + Math.random() * 60;
    // Symbol im runden Feld; bei einem Wechsel steht ein paar Sekunden der Name daneben
    const el = $("wetter");
    if (!el) return;
    const neu = el.dataset.art && el.dataset.art !== art;
    el.dataset.art = art; el.title = `Wetter: ${WETTER[art].name}`; el.setAttribute("aria-label", el.title);
    const icon = wetterIcon(art);
    el.textContent = neu ? `${icon} ${WETTER[art].name}` : icon;
    el.classList.toggle("zeigen", Boolean(neu));
    clearTimeout(el.zeit);
    if (neu) el.zeit = setTimeout(() => { el.textContent = wetterIcon(art); el.classList.remove("zeigen"); }, 4000);
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
      if (c.x - c.r > WX + 40) c.x = -40 - c.r;
      if (c.y - c.r > WY + 40) c.y = -40 - c.r;
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
  const WOLKEN = Array.from({ length: 80 }, () => ({ x: Math.random() * (WX + 80) - 40, y: Math.random() * (WY + 80) - 40,
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
  let uhuIn = 6;
  function uhuRufen(dt) {
    if (!Ton || !Ton.uhu || !istNacht() || !imWald(auto.x, auto.y, 25) || !$("gespraech").hidden) return;
    if ((uhuIn -= dt) > 0) return;
    uhuIn = 9 + Math.random() * 12;
    Ton.uhu();
    if (Math.random() < 0.35) Ton.uhu(undefined, undefined, 2.2 + Math.random()); // manchmal antwortet ein zweiter
  }
  // Verliert der Browser die Zeichenfläche (Speichernot auf dem Handy), bleibt nur Grün übrig.
  // Kommt sie nicht von selbst zurück, wird nach dem Speichern neu geladen (Spielstand bleibt).
  let zeichenFehler = false, verlorenSeit = 0;
  cv.addEventListener("contextrestored", () => { kacheln.clear(); verlorenSeit = 0; });
  function bildVerlorenPruefen(t) {
    const weg = ctx.isContextLost && ctx.isContextLost();
    if (!weg) { verlorenSeit = 0; return; }
    if (!verlorenSeit) { verlorenSeit = t; kacheln.clear(); return; }
    if (t - verlorenSeit > 2500 && !$("bildWeg")) {
      const k = document.createElement("button");
      k.id = "bildWeg"; k.type = "button"; k.className = "knopf";
      k.textContent = "🔄 Bild neu laden (dein Spielstand bleibt)";
      k.style.cssText = "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:50";
      k.addEventListener("click", () => { if (opt.speichern) opt.speichern(); location.reload(); });
      cv.parentElement.append(k);
    }
  }
  function bild(t) {
    const dt = Math.min(0.05, (t - (zuletzt || t)) / 1000);
    zuletzt = t;
    const rennen = [RALLYE, SLALOM].find((r) => r && r.offen);
    if (rennen) { if (Ton && Ton.grillen) Ton.grillen(0); if (Ton) Ton.motor(rennen.tempo ? { v: rennen.tempo, gas: true } : null); requestAnimationFrame(bild); return; }
    if (Ton) Ton.motor(cv.clientWidth && $("gespraech").hidden ? { v: auto.v, gas: auto.gas } : null);
    if (cv.clientWidth) {
      // nachts ein ruhiges Schlaflied, im Wald dazu ab und zu ein Uhu
      if (Ton) Ton.musik(istNacht() ? "nacht" : imWald(auto.x, auto.y) ? "wald" : "fahren");
      uhuRufen(dt);
      // nachts zirpen leise die Grillen, auf der Wiese etwas mehr als im Wald, im Gespräch nicht
      if (Ton && Ton.grillen) Ton.grillen($("gespraech").hidden ? Math.max(0, dunkelheit() - 0.4) / 0.6 * (imWald(auto.x, auto.y) ? 0.5 : 1) : 0);
      if (!fertig) schritt(dt); else auto.v *= 0.9;
      wetterSchritt(dt);
      zeitSchritt(dt);
      tiereSchritt(dt);
      try {
        if (!$("grosskarte").hidden) grossBild(); // die große Karte verdeckt alles: nur sie (mit blinkenden Aufgaben) malen
        else if ($("gespraech").hidden) zeichne(); // im Gespräch verdeckt das Gesprächsbild die Karte
      } catch (e) {
        // Ein Fehler beim Malen darf das Spiel nicht anhalten; einmal melden, damit man ihn findet
        if (!zeichenFehler) { zeichenFehler = true; toast(`Hoppla, beim Zeichnen ging etwas schief: ${e && e.message}`, 8000); console.error(e); }
      }
      bildVerlorenPruefen(t);
    } else if (Ton && Ton.grillen) Ton.grillen(0); // Werkstatt: keine Grillen
    requestAnimationFrame(bild);
  }

  // --- Große Karte: Ziel wählen -------------------------------------------------
  const gross = $("gross");
  let gctx = gross.getContext("2d"), grossGrund = null;
  let grossMass = null;
  // Grund (Wiese, Bäume, Wege, Nebel) einmal beim Öffnen vormalen; Orte, Aufgaben und Auto
  // malt grossBild() jedes Bild neu, damit die Aufgaben-Orte blinken können
  function grossZeichnen() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const b = gross.getBoundingClientRect();
    gross.width = Math.round(b.width * dpr); gross.height = Math.round(b.height * dpr);
    const k = Math.min(b.width / WX, b.height / WY), kb = WX * k, kh = WY * k, ox = (b.width - kb) / 2, oy = (b.height - kh) / 2;
    grossMass = { k, ox, oy, dpr, b: b.width, h: b.height };
    grossGrund = document.createElement("canvas"); grossGrund.width = gross.width; grossGrund.height = gross.height;
    const echt = gctx;
    gctx = grossGrund.getContext("2d");
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gctx.save(); gctx.translate(ox, oy);
    gctx.fillStyle = "#5d8a3e"; gctx.fillRect(0, 0, kb, kh);
    gctx.fillStyle = "#2c4d2a";
    for (const o of OBJEKTE) if (o.art === "nadelbaum" || o.art === "laubbaum") { gctx.beginPath(); gctx.arc(o.x * k, o.y * k, 2.2 * k, 0, 7); gctx.fill(); }
    gctx.strokeStyle = "#c9a26b"; gctx.lineWidth = Math.max(3, 4.5 * k); gctx.lineCap = "round"; gctx.lineJoin = "round";
    for (const w of WEGE) { gctx.beginPath(); gctx.moveTo(w[0][0] * k, w[0][1] * k); for (const [x, y] of w.slice(1)) gctx.lineTo(x * k, y * k); gctx.stroke(); }
    gctx.fillStyle = "#9a9a90"; gctx.beginPath(); for (const [x, y] of SCHROTT.zaun) gctx.lineTo(x * k, y * k); gctx.fill();
    gctx.drawImage(nebel, 0, 0, kb, kh);
    for (const h of HINDERNISSE) if (offen(h.x, h.y)) {
      gctx.fillStyle = "#1d1a16"; gctx.font = `800 ${Math.max(14, 16)}px Nunito, sans-serif`; gctx.textAlign = "center"; gctx.textBaseline = "middle";
      gctx.fillText("⚠", h.x * k, h.y * k);
    }
    gctx.restore();
    gctx = echt;
    grossBild();
  }
  function grossBild() {
    if (!grossGrund || !grossMass) return;
    const { k, ox, oy, dpr } = grossMass, t = performance.now() / 1000;
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.clearRect(0, 0, gross.width, gross.height);
    gctx.drawImage(grossGrund, 0, 0);
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gctx.save(); gctx.translate(ox, oy);
    // Aufgaben: gelber, pulsierender Schein hinter dem Ort
    const puls = reduce ? 0.5 : (Math.sin(t * 4) + 1) / 2;
    for (const z of aufgabenOrte()) {
      const x = z.x * k, y = z.y * k;
      const g = gctx.createRadialGradient(x, y, 8, x, y, 30 + puls * 8);
      g.addColorStop(0, "rgba(255,214,60,0.95)"); g.addColorStop(1, "rgba(255,214,60,0)");
      gctx.fillStyle = g; gctx.beginPath(); gctx.arc(x, y, 30 + puls * 8, 0, 7); gctx.fill();
      gctx.lineWidth = 3; gctx.strokeStyle = `rgba(255,236,120,${0.5 + puls * 0.5})`;
      gctx.beginPath(); gctx.arc(x, y, 20 + puls * 6, 0, 7); gctx.stroke();
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
    // Ausrufezeichen an den Orten mit Aufgabe
    for (const z of aufgabenOrte()) {
      const hub = reduce ? 0 : Math.abs(Math.sin(t * 3)) * 4;
      if (ZIELE.includes(z)) { ausrufZeichnen(gctx, z.x * k + 14, z.y * k - 16 - hub, 9); continue; }
      // Punkt ohne Ort (z. B. Kuh Berta): Symbol mit Namen obendrauf
      gctx.font = "22px sans-serif"; gctx.textAlign = "center"; gctx.textBaseline = "middle";
      gctx.fillText("🐄", z.x * k, z.y * k - hub);
      beschriftung(z.name, z.x * k, z.y * k + 20, false);
    }
    gctx.save(); gctx.translate(auto.x * k, auto.y * k); gctx.rotate(auto.a);
    gctx.fillStyle = "#e9efe6"; gctx.strokeStyle = "#12232a"; gctx.lineWidth = 2;
    gctx.beginPath(); gctx.moveTo(9, 0); gctx.lineTo(-6, -6); gctx.lineTo(-6, 6); gctx.closePath(); gctx.fill(); gctx.stroke();
    gctx.restore(); gctx.restore();
  }
  // gelbes Schild mit Ausrufezeichen (Aufgabe wartet)
  function ausrufZeichnen(c, x, y, r) {
    c.save();
    c.beginPath(); c.arc(x, y, r, 0, 7);
    c.fillStyle = "#ffd23c"; c.fill(); c.lineWidth = r * 0.22; c.strokeStyle = "#12232a"; c.stroke();
    c.fillStyle = "#12232a"; c.font = `900 ${r * 1.5}px Nunito, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText("!", x, y + r * 0.08);
    c.restore();
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
    if (tankLeer()) return abschleppen(); // mit leerem Tank geht es nur mit Opas Abschleppwagen
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
  const buchKnopf = document.createElement("button");
  buchKnopf.type = "button"; buchKnopf.id = "buchKnopf"; buchKnopf.hidden = true;
  buchKnopf.addEventListener("click", buchAuf);
  document.querySelector(".hud").append(buchKnopf);
  const buch = document.createElement("div");
  buch.id = "buch"; buch.hidden = true; buch.setAttribute("role", "dialog"); buch.setAttribute("aria-label", "Auftragsbuch");
  buch.innerHTML = '<header><h2>📖 Auftragsbuch</h2><button type="button" class="knopf zweit" id="buchZu">Schließen</button></header><div id="buchListe"></div>';
  $("karte").parentElement.append(buch);
  $("buchZu").addEventListener("click", buchZu);
  const rechts = document.createElement("div");
  rechts.className = "hud-rechts"; rechts.setAttribute("aria-live", "polite");
  rechts.innerHTML = '<span id="uhr"></span><span id="wetter"></span><span id="geld" hidden></span><span id="sprit"></span><span id="strom" hidden></span><span id="eis" hidden></span>' +
    '<button type="button" id="platt" hidden>🛞 Platt! Flicken</button><button type="button" id="beutelKnopf">🎒</button>';
  $("karte").parentElement.append(rechts);
  $("platt").addEventListener("click", flicken);
  uhrAnzeigen();
  $("beutelKnopf").addEventListener("click", () => { if (!$("gespraech").hidden) return; $("beutel").hidden = false; beutelZeigen(); $("beutelZu").focus(); });
  const beutel = document.createElement("div");
  beutel.id = "beutel"; beutel.hidden = true; beutel.setAttribute("role", "dialog"); beutel.setAttribute("aria-label", "Beutel");
  beutel.innerHTML = '<header><h2>🎒 Beutel</h2><button type="button" class="knopf zweit" id="beutelZu">Schließen</button></header><div id="beutelListe"></div>';
  $("karte").parentElement.append(beutel);
  $("beutelZu").addEventListener("click", () => { beutel.hidden = true; });
  const frage = document.createElement("div");
  frage.id = "rallyeFrage"; frage.hidden = true; frage.setAttribute("role", "dialog"); frage.setAttribute("aria-label", "Waldrallye");
  frage.innerHTML = '<div><strong>🏁 Waldrallye</strong><p></p><div class="knoepfe"><button type="button" class="knopf r-los">🏁 Starten</button>' +
    '<button type="button" class="knopf zweit r-spaeter">Später</button></div></div>';
  $("karte").parentElement.append(frage);
  frage.querySelector(".r-los").onclick = rallyeStarten;
  frage.querySelector(".r-spaeter").addEventListener("click", () => { frage.hidden = true; });
  const leer = document.createElement("div");
  leer.id = "leer"; leer.hidden = true; leer.setAttribute("role", "alertdialog"); leer.setAttribute("aria-label", "Tank leer");
  leer.innerHTML = '<div><strong>Tank leer!</strong><p>Die Klapperkiste hat keinen Tropfen Sprit mehr.</p>' +
    '<div class="knoepfe"><button type="button" class="knopf kanister"></button><button type="button" class="knopf zweit abschleppen">🚜 Opa schleppt ab</button></div></div>';
  $("karte").parentElement.append(leer);
  leer.querySelector(".kanister").addEventListener("click", kanisterNutzen);
  leer.querySelector(".abschleppen").addEventListener("click", abschleppen);
  const dunkelBox = document.createElement("div");
  dunkelBox.id = "dunkel"; dunkelBox.hidden = true; dunkelBox.setAttribute("role", "alertdialog"); dunkelBox.setAttribute("aria-label", "Zu dunkel");
  dunkelBox.innerHTML = '<div><strong>🌙 Zu dunkel!</strong><p></p>' +
    '<div class="knoepfe"><button type="button" class="knopf warten">🌅 Im Auto schlafen bis zum Morgen</button>' +
    '<button type="button" class="knopf zweit abholen">🚜 Opa holt dich ab</button></div></div>';
  $("karte").parentElement.append(dunkelBox);
  dunkelBox.querySelector(".warten").addEventListener("click", () => {
    dunkelBox.hidden = true; morgen("🌅 Guten Morgen! Etwas steif vom Schlafen im Auto, aber jetzt ist es hell.");
  });
  dunkelBox.querySelector(".abholen").addEventListener("click", () => {
    dunkelBox.hidden = true;
    toast("🚜 Opa hat dich mit dem Traktor abgeholt. In der Werkstatt kannst du schlafen.", 5000);
    schnellreise();
  });
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
  // Kopfzeile mit Titel, Kasse und Tschüss-Knopf, damit alles ohne Scrollen auf den Schirm passt
  laden.innerHTML = '<div><div class="laden-kopf"><strong>Knuts Schrottladen</strong><p class="kasse"></p>' +
    '<button type="button" class="knopf zweit">Tschüss, Knut!</button></div><div class="waren"></div>' +
    '<p class="klein">Neue Teile kommen nach Aufträgen. Materialien aus deinem Beutel kauft Knut an.</p></div>';
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
  window.__kp = { SLALOM, HUETCHEN, beiFunke: () => beiFunke(), aufgabenOrte, BERTA, PIEPS, PIEPS_ORTE, abstandWeg, nebelNeu: () => nebelNeu(), beiMoos: () => beiMoos(), OBJEKTE, auto, planen, zeit, FUNDE, neuerTag, platt: (w) => plattMachen(w), ladenAuf, ZIELE, spiel, REIFEN, SAMMEL, HERDE, HINDERNISSE, GEBIETE, wetter, wetterSetzen, WOLKEN, VOEGEL, HASEN, SCHAFE, get route() { return route; }, get kamera() { return kamera; } }; // für automatische Tests
  karteBauen();
  setTimeout(() => { neuerTag(); verbrauchAnzeigen(); }, 0);
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
    wetterFrei() { wetter.fest = false; wetter.dauer = 40; zeit.laeuft = true; }, // ab jetzt wechseln Wetter und Tageszeit
    // Spielstand der Karte zum Speichern (nur einfache Daten) und wieder einlesen
    stand() {
      const nr = (liste, ja) => liste.flatMap((x, i) => (ja(x) ? [i] : []));
      return {
        auftrag: spiel.auftrag, geld: spiel.geld, beutel: spiel.beutel, hilde: spiel.hilde,
        gekauft: [...spiel.gekauft], teile: [...spiel.teile], moosKennt, besucht, hinweis: hinweisGezeigt,
        sprit: spiel.sprit, strom: spiel.strom, platt: spiel.platt, vorrat: { ...spiel.vorrat }, material: { ...spiel.material },
        opa: spiel.opa, moosRallye: spiel.moosRallye, donnerkeil: [...spiel.donnerkeil], moosSeil: spiel.moosSeil, holzweg: spiel.holzweg,
        rosi: spiel.rosi, zeit: { t: zeit.t, tag: zeit.tag }, rallye: spiel.rallye, opaLenkrad: Boolean(spiel.opaLenkrad), knutMoped: spiel.knutMoped, neben: { ...spiel.neben },
        offen: GEBIETE.filter((g) => g.offen).map((g) => g.id),
        stuecke: nr(STUECKE, (st) => st.genommen), sammel: nr(SAMMEL, (r) => r.weg), hindernisse: nr(HINDERNISSE, (h) => h.weg),
      };
    },
    laden(st) {
      Object.assign(spiel, { auftrag: st.auftrag, geld: st.geld, beutel: st.beutel, hilde: st.hilde,
        gekauft: new Set(st.gekauft), teile: new Set(st.teile) });
      const v = verbrauchStart();
      Object.assign(spiel, { opa: st.opa || null, moosRallye: Boolean(st.moosRallye), donnerkeil: st.donnerkeil || [],
        moosSeil: st.moosSeil || null, holzweg: Boolean(st.holzweg), rosi: st.rosi || null });
      if (st.zeit) { zeit.t = st.zeit.t; zeit.tag = st.zeit.tag; }
      spiel.rallye = st.rallye || null; spiel.opaLenkrad = Boolean(st.opaLenkrad); spiel.knutMoped = Boolean(st.knutMoped);
      spiel.neben = { ...nebenStart(), ...st.neben }; bertaSetzen(); piepsSetzen();
      Object.assign(spiel, { sprit: st.sprit ?? v.sprit, strom: st.strom ?? v.strom, platt: Boolean(st.platt),
        vorrat: { ...v.vorrat, ...st.vorrat }, material: { ...v.material, ...st.material } });
      moosKennt = Boolean(st.moosKennt); besucht = Boolean(st.besucht); hinweisGezeigt = Boolean(st.hinweis);
      GEBIETE.forEach((g) => { g.offen = st.offen.includes(g.id); });
      STUECKE.forEach((x, i) => { x.genommen = st.stuecke.includes(i); });
      SAMMEL.forEach((r, i) => { r.weg = st.sammel.includes(i); });
      HINDERNISSE.forEach((h, i) => { h.weg = st.hindernisse.includes(i); });
      // Schon verscheuchte Schafe grasen gleich neben dem Weg
      const h = HINDERNISSE.find((q) => q.id === "schafe");
      if (h.weg) for (const sf of HERDE) Object.assign(sf, { x: h.x + (sf.x < h.x ? -1 : 1) * zufall(9, 15), flucht: false, grast: true });
      nebelNeu(); hudNeu(); verbrauchAnzeigen();
    },
    // Zurück in der Werkstatt nach Knuts erstem Auftrag: Opa erzählt vom Rennen und vom
    // Donnerkeil (einmal). danach: wird nach dem Gespräch aufgerufen.
    opaErzaehlt(danach) {
      if (spiel.opa || !["batterie", "erledigt"].includes(spiel.auftrag)) return false;
      gespraech("opa", "Opa Kolben", "werkstatt", [
        ["hallo", "Da bist du ja wieder! Knut ist zufrieden mit dir, hab ich gehört. Der lobt sonst nie jemanden."],
        ["nachdenken", "Weißt du eigentlich, was am Ende des Sommers ist? Das Klappertal-Rennen! Das ganze Tal steht dann an der Kiesrennbahn."],
        ["juhu", "Früher bin ich da selbst gefahren. Dreimal gewonnen, mit dem Donnerkeil! Schnell wie der Blitz und laut wie ein Gewitter."],
        ["nachdenken", "Den gibt es leider nicht mehr. Nach einem dummen Streit haben wir ihn auseinandergenommen, und die Teile sind im ganzen Tal verstreut."],
        ...(D.geschichte && D.geschichte.donnerkeil_foto ? [
          ["juhu", "Schau, hier hab ich noch ein Foto von damals: der Donnerkeil und der Pokal, nach dem dritten Sieg!", { bild: D.geschichte.donnerkeil_foto,
            alt: "Altes Foto: der junge Opa Kolben und ein großer, dünner Mann mit Werkzeuggürtel halten einen Pokal, daneben der silberne Rennwagen mit Blitz." }],
          ["nachdenken", "Der Lange daneben? Ach … lassen wir das.", { bild: D.geschichte.donnerkeil_foto }],
        ] : []),
        ["auftrag", "Aber wer weiß … Wenn du die Augen offen hältst, findest du vielleicht das eine oder andere Teil wieder."],
        ["auftrag", "Und fürs Rennen musst du dich erst in den Vorrunden beweisen. Die erste ist im Wald, frag mal Förster Moos danach!"],
        ["juhu", "Ich schreib's dir ins Auftragsbuch. Ach, was freu ich mich: Endlich wieder einer aus der Kolben-Werkstatt am Start!"],
      ], () => { spiel.opa = "rennen"; hudNeu(); toast("📖 Neu im Auftragsbuch: Opas Donnerkeil und die Waldrallye", 5000); if (danach) danach(); });
      return true;
    },
    // Opa erkennt den Sitz aus dem Dorf-Slalom (G11)
    opaSitz() {
      const n = spiel.neben;
      if (!spiel.donnerkeil.includes("sitz") || n.opaSitz) return false;
      n.opaSitz = true;
      gespraech("opa", "Opa Kolben", "werkstatt", [
        ["juhu", "Na so was! Der Sitz vom Donnerkeil! Den Blitz auf der Lehne würd ich unter tausend erkennen."],
        ["nachdenken", "Beim Sperrmüll-Händler gekauft, sagt Funke? Hm. Erst das Lenkrad bei Rosi, jetzt der Sitz auf der Feuerwache …"],
        ["nachdenken", "Jemand hat die Teile damals verkauft, Stück für Stück. Kauz war's nicht, der hat ja den Rahmen behalten. Aber wer dann?"],
        ["auftrag", "Bau ihn ruhig ein, der hält dich in jeder Kurve fest. Und halt die Augen offen. Da steckt mehr dahinter."],
      ], () => hudNeu());
      return true;
    },
    // Ginos Erdbeerbecher kommt bei Opa an (G11)
    opaEis() {
      const n = spiel.neben;
      if (n.eis !== "opa") return false;
      gespraech("opa", "Opa Kolben", "werkstatt", [
        ["juhu", "Ein Becher Erdbeere? Von Gino? Wie jedes Jahr zum Dorffest! Und noch schön kalt!"],
        ["nachdenken", "Früher sind wir mit dem Donnerkeil zum Dorffest gefahren, Kauz und ich. Da gab's den Slalom auf dem Marktplatz …"],
        ["auftrag", "Sag Gino schönen Dank. Und grüß mir Funke von der Feuerwehr!"],
      ], () => { n.eis = "gino2"; verbrauchAnzeigen(); hudNeu(); toast("🍦 Abgeliefert! Gino hat noch eine Bestellung.", 4000); });
      return true;
    },
    // Opa erkennt das Lenkrad aus der Rallye (einmal)
    // und gibt es zum Einbauen. Ältere Spielstände: Opa nimmt es von der Wand.
    opaLenkrad() {
      if (!spiel.donnerkeil.includes("lenkrad") || spiel.teile.has("donnerkeillenkrad")) return false;
      const geben = () => {
        spiel.teile.add("donnerkeillenkrad");
        if (opt.belohnung) opt.belohnung("donnerkeillenkrad");
        toast("🛞 Das Donnerkeil-Lenkrad liegt jetzt im Regal (Lenkung).", 4000);
      };
      if (spiel.opaLenkrad) {
        gespraech("opa", "Opa Kolben", "werkstatt", [
          ["nachdenken", "Weißt du was? Das Lenkrad vom Donnerkeil hängt da nur an der Wand rum und staubt ein."],
          ["juhu", "Nimm's runter und bau's ein! Damit lenkt sich's wie früher bei den Rennen. Für den Donnerkeil heben wir's trotzdem auf."],
        ], geben);
        return true;
      }
      spiel.opaLenkrad = true;
      gespraech("opa", "Opa Kolben", "werkstatt", [
        ["nachdenken", "Zeig mal her, was hast du denn da? Ein Lenkrad mit einem Blitz drauf …"],
        ["juhu", "Das gibt's ja nicht! Das ist das Lenkrad vom Donnerkeil! Den Blitz hab ich selbst draufgemalt, mit Fahrradlack!"],
        ["nachdenken", "Bei Rosi am Campingplatz hing es? Hm. Wie kommt es denn bloß dahin … Da war doch früher nur Wald."],
        ["auftrag", "Und gratuliere zur Qualifikation! Wenn wir alle Teile haben, bauen wir den Donnerkeil wieder zusammen."],
        ["juhu", "Bis dahin bau's ruhig in dein Auto ein. Damit lenkt sich's wie früher bei den Rennen!"],
      ], geben);
      return true;
    },
    // Opa erkennt den Bolzen vom Ostufer und erzählt zum ersten Mal von Kauz (G8)
    opaBolzen() {
      const n = spiel.neben;
      if (n.lichter !== "bolzen") return false;
      const foto = D.geschichte && D.geschichte.donnerkeil_foto;
      const bolzen = D.geschichte && D.geschichte.bolzen ? [{ bild: D.geschichte.bolzen, alt: "Der blanke Bolzen mit dem eingeritzten Blitz." }] : [];
      gespraech("opa", "Opa Kolben", "werkstatt", [
        ["nachdenken", "Was hast du denn da? Zeig mal her … ein Bolzen. Mit einem Blitz drauf.", ...bolzen],
        ["nachdenken", "Den hab ich selbst gedreht, für die Hinterachse vom Donnerkeil. Am Ostufer lag der? Da, wo Moos die Lichter sieht?", ...bolzen],
        ["nachdenken", "Dann ist er also noch da. Der alte Kauz."],
        ["auftrag", "Kauz war mein Beifahrer. Zusammen haben wir den Donnerkeil gebaut, Schraube für Schraube. Der Lange auf dem Foto, das ist er.",
          ...(foto ? [{ bild: foto, alt: "Altes Foto: der junge Opa Kolben und Kauz, ein großer, dünner Mann mit Werkzeuggürtel, mit dem Pokal neben dem Donnerkeil." }] : [])],
        ["nachdenken", "Nach dem dritten Sieg haben wir uns gestritten. Um eine dumme Kurve! Er sagt, ich hab zu spät gebremst. Ich sag, er hat sie falsch angesagt."],
        ["nachdenken", "Seitdem haben wir kein Wort mehr geredet. Der Donnerkeil wurde zerlegt … Ich dachte, Kauz ist längst weggezogen."],
        ["auftrag", "Wenn der nachts am See herumschraubt … Schau doch mal, ob du ihn findest. Aber sag ihm bloß nicht, dass ich dich schicke!"],
      ], () => {
        n.lichter = "erledigt"; n.kauz = "suchen"; hudNeu();
        toast("📖 Neu im Auftragsbuch: Wo steckt Kauz?", 5000);
      });
      return true;
    },
    // G10: Opa in der Werkstatt (Bolzen verweigern, Mühle verraten, Foto, Versöhnung mit Kauz)
    opaMuehle() {
      const n = spiel.neben;
      const opa = (zeilen, danach) => gespraech("opa", "Opa Kolben", "werkstatt", zeilen, danach);
      if (n.muehle === "opa1") {
        opa([
          ["nachdenken", "Kauz will seinen Bolzen zurück? SEINEN Bolzen? Den hab ich gedreht, mit diesen Händen!"],
          ["auftrag", "Soll er ihn sich doch selbst holen, der alte Sturkopf! Und richte ihm aus: Zu spät gebremst hab ich nicht!"],
        ], () => { n.muehle = "kauz"; hudNeu(); });
        return true;
      }
      if (n.muehle === "opa2") {
        opa([
          ["nachdenken", "Er hat gefragt, wie's mir geht? … Hm. Die Hände zittern ein bisschen, ja. Aber schrauben kann ich noch!"],
          ["nachdenken", "Weißt du was? Die Müllerin Mehlich stand damals an der Mühlenkurve. Die hat alles gesehen. Frag die, wer recht hat!"],
          ["auftrag", "Die Mühle liegt hinter den Feldern im Norden, über den Mühlbach. Ich zeichne sie dir ein. Aber Vorsicht: Die alte Brücke ist morsch, die trägt nur ein leichtes Auto!"],
        ], () => {
          n.muehle = "muellerin"; hudNeu();
          const g = GEBIETE.find((q) => q.id === "muehle");
          if (!g.offen) { g.offen = true; nebelNeu(); }
          toast("🌾 Neu auf der Karte: Mühlbach und Mühle (Brücke höchstens 120 kg)", 5000);
        });
        return true;
      }
      if (n.muehle === "kauzlacht") {
        opa([
          ["nachdenken", "Ein Foto? Von der Mühlenkurve? Na zeig schon her …", ...fotoBild()],
          ["nachdenken", "Das ist … eine Kuh. Mitten auf der Strecke. Die hatte ich ja ganz vergessen.", ...fotoBild()],
          ["juhu", "Hehe … hehehe … vierzig Jahre! Wegen einer Kuh!"],
        ], () => {
          // Kauz steht in der Tür: kurzes Hin und Her zwischen den beiden
          const kauz = (zeilen, danach) => gespraech("kauz", "Tüftler Kauz", "werkstatt", zeilen, danach);
          kauz([["nachdenken", "Na, Fahrer?"]], () => opa([["juhu", "Na, Beifahrer! … Komm rein, alter Kauz. Der Kaffee ist noch warm."]], () => kauz([
            ["auftrag", "Ich hab was mitgebracht. Den Rahmen vom Donnerkeil hab ich damals gerettet, und daraus hab ich nachts einen neuen gebaut. Leicht und stark, nach unserem alten Plan."],
            ["juhu", "Der ist für dich. Bau ihn in deine Klapperkiste! Und den Bolzen, den behalten wir beide. Abwechselnd."],
          ], () => {
            n.muehle = "versoehnt";
            if (!spiel.donnerkeil.includes("rahmen")) spiel.donnerkeil.push("rahmen");
            spiel.teile.add("donnerkeilrahmen");
            if (opt.belohnung) opt.belohnung("donnerkeilrahmen");
            hudNeu();
            toast("⚡ Donnerkeil-Rahmen erhalten (Donnerkeil-Teil 2/8)! Liegt in Opas Werkstatt im Regal.", 6000);
          })));
        });
        return true;
      }
      return false;
    },
    // In Opas Werkstatt: Reifen flicken, Tank füllen und Batterie laden (kostenlos)
    beiOpa() {
      if (spiel.platt) { spiel.platt = false; toast("🩹 Opa hat den platten Reifen geflickt."); }
      this.volltanken();
    },
    // Tank voll und Batterie geladen (auch beim Losfahren aus der Werkstatt, falls ein größerer Tank eingebaut wurde)
    volltanken() { spiel.sprit = tankGroesse(); spiel.strom = 100; spritGewarnt = false; stromGewarnt = false; verbrauchAnzeigen(); },
    // Uhr: Stunde (0–24), ob es dunkel ist, und bei Opa bis zum Morgen schlafen
    zeit: () => ({ stunde: stunde(), nacht: istNacht(), abend: dunkelheit() > 0 || stunde() >= 18, tag: zeit.tag }),
    schlafen() { morgen(); },
  };
};
