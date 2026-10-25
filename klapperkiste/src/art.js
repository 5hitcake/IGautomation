// Alle Teile werden per Canvas-Code gezeichnet: dicke Tusche-Kontur,
// flache Farben, ein heller Glanzstrich. Jedes Teil zeichnet sich um seinen
// Ankerpunkt (= Slot-Position) herum.
(function (KK) {
  const C = {
    ink: "#1d2730",
    wood: "#c98a4b", woodDark: "#9c6534",
    steel: "#6f8fa6", steelDark: "#4b667a", chrome: "#cbd6dd",
    red: "#e04b3a", tractor: "#d2452f", blue: "#2f6fb0", sky: "#3a7bd5",
    mustard: "#f2b632", teal: "#2f8f88", cream: "#fff4cf", skin: "#f3c7a0",
    rubber: "#262b30", white: "#eef3f4", glass: "#9fd7e8",
  };
  KK.COLORS = C;

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }
  function paint(ctx, fill, lw = 3) {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
  }
  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  function line(ctx, pts, w, color = C.ink) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.lineWidth = w;
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }
  // Pfosten = dunkle Kontur + helle Füllung
  function pole(ctx, pts, w, color) {
    line(ctx, pts, w + 4);
    line(ctx, pts, w, color);
  }
  function shine(ctx, x, y, w) {
    line(ctx, [x, y, x + w, y], 3, "rgba(255,255,255,0.55)");
  }

  // Abstand vom Aufbau-Slot (y=-78) bis zur Rahmenoberkante
  const ROOF_DROP = 70;

  function dot(ctx, x, y, r, color = C.ink) {
    circle(ctx, x, y, r); ctx.fillStyle = color; ctx.fill();
  }
  function stencil(ctx, text, x, y, size, color) {
    ctx.font = `${size}px "Lilita One", "Arial Black", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  const DRAW = {
    // --- Rahmen ---------------------------------------------------------
    // Apfelkiste: zwei Bretterreihen, Eckpfosten, Seilgriffe, Schablonen-Schrift
    kiste(ctx, o) {
      const L = o.len;
      rr(ctx, -L / 2, -13, L, 24, 3); paint(ctx, C.wood);
      line(ctx, [-L / 2 + 3, -1, L / 2 - 3, -1], 2, C.woodDark);
      for (const x of [-L / 2 + 8, 0, L / 2 - 8]) {
        rr(ctx, x - 6, -13, 12, 24, 2); paint(ctx, "#b77a3f", 2);
        dot(ctx, x, -8, 1.6); dot(ctx, x, 6, 1.6);
      }
      stencil(ctx, "ÄPFEL", -L * 0.25, 5, 10, "rgba(120,70,30,0.75)");
      stencil(ctx, "Nr. 7", L * 0.24, 5, 9, "rgba(120,70,30,0.75)");
      ctx.beginPath(); ctx.arc(-L / 2 - 1, -1, 6, Math.PI * 0.5, Math.PI * 1.5);
      ctx.lineWidth = 3; ctx.strokeStyle = "#d9c28e"; ctx.stroke();
      shine(ctx, -L / 2 + 18, -8, L * 0.18);
    },
    // Stahlträger mit Lochreihe, Rost und altem Lack
    leiter(ctx, o) {
      const L = o.len;
      rr(ctx, -L / 2, -9, L, 18, 3); paint(ctx, C.steel);
      ctx.save(); rr(ctx, -L / 2, -9, L, 18, 3); ctx.clip();
      ctx.fillStyle = "#7fcfae"; ctx.fillRect(-L * 0.18, -9, L * 0.34, 7);
      for (const [x, r] of [[-L * 0.38, 7], [L * 0.05, 5], [L * 0.33, 8]]) {
        ctx.fillStyle = "#c8673a"; circle(ctx, x, 5, r); ctx.fill();
        ctx.fillStyle = "#a9512c"; circle(ctx, x + 2, 6, r * 0.5); ctx.fill();
      }
      ctx.restore();
      rr(ctx, -L / 2, -9, L, 18, 3); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
      for (let x = -L / 2 + 16; x < L / 2 - 8; x += 22) { circle(ctx, x, 1, 3.2); paint(ctx, C.steelDark, 2); }
      for (const x of [-L / 2, L / 2]) { rr(ctx, x - 4, -12, 8, 24, 2); paint(ctx, C.steelDark, 2.5); }
      shine(ctx, -L / 2 + 8, -5, L * 0.12);
    },
    // Trecker-Rahmen mit Ballast-Gewichten und Nummernschild
    traktor(ctx, o) {
      const L = o.len;
      rr(ctx, -L / 2, -14, L, 27, 6); paint(ctx, C.tractor);
      for (let i = 0; i < 3; i++) { rr(ctx, L / 2 - 30 + i * 9, -22, 9, 40, 2); paint(ctx, "#39434b", 2.5); }
      rr(ctx, -L * 0.05, -7, 26, 13, 2); paint(ctx, C.mustard, 2);
      stencil(ctx, "07", -L * 0.05 + 13, 0, 10, C.ink);
      for (let x = -L / 2 + 10; x < L / 2 - 36; x += 18) { dot(ctx, x, -9, 2); dot(ctx, x, 8, 2); }
      shine(ctx, -L / 2 + 10, -9, L * 0.25);
    },

    // --- Motoren --------------------------------------------------------
    // Rasenmäher: Kühlrippen, Seilzug mit T-Griff, Gras zwischen den Rippen
    maeher(ctx, o) {
      const shake = o.running ? Math.sin(o.t * 60) * 0.8 : 0;
      ctx.translate(0, shake);
      rr(ctx, -24, -16, 44, 30, 7); paint(ctx, C.red);
      for (let x = -16; x <= 6; x += 5.5) line(ctx, [x, -9, x, 9], 2.5, "#a8302a");
      circle(ctx, 20, -1, 10); paint(ctx, "#39434b");
      circle(ctx, 20, -1, 4); paint(ctx, C.chrome, 2);
      line(ctx, [22, -6, 30, -16], 1.5);
      rr(ctx, 25, -21, 12, 5, 2.5); paint(ctx, C.ink, 1.5);
      rr(ctx, -12, -24, 18, 9, 3); paint(ctx, C.ink);
      rr(ctx, -6, -28, 6, 5, 1.5); paint(ctx, C.mustard, 2);
      for (const [x, y] of [[-20, 12], [-9, 13], [3, 12]]) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 5); ctx.moveTo(x + 2, y); ctx.lineTo(x + 3, y + 5);
        ctx.lineWidth = 2; ctx.strokeStyle = "#5f9e4f"; ctx.stroke();
      }
      shine(ctx, -18, -11, 6);
    },
    // Waschmaschine: Programmwahl, Bullauge mit Ringelsocke, Schaum beim Laufen
    trommel(ctx, o) {
      rr(ctx, -24, -24, 48, 42, 6); paint(ctx, C.white);
      line(ctx, [-24, -14, 24, -14], 2.5);
      circle(ctx, 15, -19, 3.2); paint(ctx, C.chrome, 1.5);
      line(ctx, [15, -19, 17, -21], 1.5);
      for (let i = 0; i < 3; i++) dot(ctx, -16 + i * 5, -19, 1.4, i === 1 ? C.red : "#8a9aa3");
      circle(ctx, 0, 2, 13); paint(ctx, C.chrome);
      circle(ctx, 0, 2, 9.5); paint(ctx, C.glass, 2);
      const a = o.running ? o.t * 14 : 0.6;
      ctx.save(); ctx.beginPath(); ctx.arc(0, 2, 9, 0, Math.PI * 2); ctx.clip();
      ctx.translate(0, 2); ctx.rotate(a);
      for (let i = 0; i < 4; i++) {
        rr(ctx, -5 + i * 3, -2, 3, 6, 1); ctx.fillStyle = i % 2 ? "#ff8fb1" : C.white; ctx.fill();
      }
      rr(ctx, 6, 1, 4, 5, 2); ctx.fillStyle = "#ff8fb1"; ctx.fill();
      ctx.restore();
      if (o.running) for (let i = 0; i < 3; i++) {
        const k = (o.t * 1.5 + i / 3) % 1;
        circle(ctx, -18 + i * 6, -26 - k * 14, 2 + k * 2); ctx.fillStyle = `rgba(255,255,255,${1 - k})`; ctx.fill();
      }
      shine(ctx, -18, -19, 8);
    },
    // V8: Chrom-Luftfilter, Zylinderbänke, Krümmer, aufgemalte Flammen
    v8(ctx, o) {
      const shake = o.running ? Math.sin(o.t * 45) * 1.2 : 0;
      ctx.translate(0, shake);
      rr(ctx, -34, -14, 68, 30, 5); paint(ctx, "#8c99a3");
      ctx.beginPath();
      ctx.moveTo(-30, 12); ctx.quadraticCurveTo(-24, -2, -18, 6); ctx.quadraticCurveTo(-12, -8, -6, 6);
      ctx.quadraticCurveTo(0, -4, 6, 12); ctx.closePath();
      ctx.fillStyle = "#ff8a3a"; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-26, 12); ctx.quadraticCurveTo(-21, 4, -17, 9); ctx.quadraticCurveTo(-11, 0, -7, 9); ctx.quadraticCurveTo(-2, 3, 2, 12); ctx.closePath();
      ctx.fillStyle = C.mustard; ctx.fill();
      for (let x = 12; x <= 28; x += 8) line(ctx, [x, -6, x, 10], 2.5, "#5f6b74");
      rr(ctx, -33, -30, 31, 17, 4); paint(ctx, C.red);
      rr(ctx, 2, -30, 31, 17, 4); paint(ctx, C.red);
      for (const x of [-26, -16, 9, 19]) dot(ctx, x, -21, 1.8);
      ctx.beginPath(); ctx.ellipse(0, -36, 22, 7, 0, 0, Math.PI * 2); paint(ctx, C.chrome);
      dot(ctx, 0, -36, 2.5);
      pole(ctx, [-30, 16, -34, 22, -40, 22], 3, C.chrome);
      shine(ctx, -28, -25, 10); shine(ctx, 7, -25, 10);
    },

    // --- Energie --------------------------------------------------------
    // Kanister mit X-Prägung, Delle und Deckel an der Kette
    kanister(ctx) {
      rr(ctx, -15, -16, 30, 32, 4); paint(ctx, "#d93b30");
      line(ctx, [-9, -9, 9, 10], 2.5, "#a8302a"); line(ctx, [9, -9, -9, 10], 2.5, "#a8302a");
      ctx.beginPath(); ctx.arc(-15, 8, 5, -Math.PI / 2, Math.PI / 2);
      ctx.lineWidth = 2; ctx.strokeStyle = "#a8302a"; ctx.stroke();
      rr(ctx, -12, -23, 14, 8, 3); paint(ctx, C.ink);
      rr(ctx, 6, -22, 7, 7, 2); paint(ctx, C.mustard, 2.5);
      ctx.beginPath(); ctx.moveTo(13, -18); ctx.quadraticCurveTo(20, -14, 15, -8);
      ctx.setLineDash([2, 2]); ctx.lineWidth = 1.5; ctx.strokeStyle = C.ink; ctx.stroke(); ctx.setLineDash([]);
      shine(ctx, -10, -12, 5);
    },
    // Ölfass: zwei Sicken, Beule, ein hängender Tropfen
    fass(ctx) {
      ctx.beginPath();
      ctx.moveTo(-17, -22); ctx.lineTo(17, -22); ctx.lineTo(17, -2);
      ctx.quadraticCurveTo(12, 2, 17, 6); ctx.lineTo(17, 20); ctx.lineTo(-17, 20); ctx.closePath();
      paint(ctx, C.blue);
      line(ctx, [-17, -9, 17, -9], 3); line(ctx, [-17, 8, 17, 8], 3);
      rr(ctx, -11, -6, 18, 11, 2); paint(ctx, C.white, 2);
      stencil(ctx, "ÖL", -2, 0, 8, C.ink);
      dot(ctx, 9, -16, 2.5);
      ctx.beginPath(); ctx.moveTo(-8, 20); ctx.quadraticCurveTo(-11, 26, -8, 28); ctx.quadraticCurveTo(-5, 26, -8, 20);
      ctx.fillStyle = C.ink; ctx.fill();
      shine(ctx, -13, -15, 6);
    },
    // Batterie mit Ladeauge und Krokodilklemmen
    akku(ctx) {
      rr(ctx, -12, -21, 7, 6, 1); paint(ctx, C.red, 2);
      rr(ctx, 5, -21, 7, 6, 1); paint(ctx, C.ink, 2);
      rr(ctx, -18, -16, 36, 28, 3); paint(ctx, "#2b3440");
      ctx.beginPath();
      ctx.moveTo(2, -11); ctx.lineTo(-6, 0); ctx.lineTo(0, 0); ctx.lineTo(-3, 8); ctx.lineTo(7, -4); ctx.lineTo(1, -4);
      ctx.closePath(); paint(ctx, C.mustard, 2);
      circle(ctx, 12, -9, 3); paint(ctx, "#6fd3a3", 1.5);
      ctx.beginPath(); ctx.moveTo(-9, -21); ctx.bezierCurveTo(-14, -32, -26, -22, -22, -10);
      ctx.lineWidth = 2.5; ctx.strokeStyle = C.red; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-25, -10); ctx.lineTo(-19, -10); ctx.lineTo(-22, -4); ctx.closePath(); paint(ctx, C.red, 1.5);
    },

    // --- Räder (o.turn = Drehwinkel) -------------------------------------
    buggy(ctx, o) {
      const r = 13;
      circle(ctx, 0, 0, r); paint(ctx, C.white, 3);
      circle(ctx, 0, 0, r - 4); ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = o.turn + (i * Math.PI) / 4;
        line(ctx, [0, 0, Math.cos(a) * (r - 4), Math.sin(a) * (r - 4)], 1.2);
      }
      circle(ctx, 0, 0, 3.2); paint(ctx, C.red, 2);
    },
    reifen(ctx, o) {
      const r = 19;
      circle(ctx, 0, 0, r); paint(ctx, C.rubber);
      circle(ctx, 0, 0, r * 0.7); ctx.fillStyle = C.white; ctx.fill();
      circle(ctx, 0, 0, r * 0.5); paint(ctx, C.chrome, 2.5);
      ctx.save(); ctx.rotate(o.turn);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5, rad = i % 2 ? 3 : 7;
        ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath(); paint(ctx, C.mustard, 1.5);
      ctx.restore();
      ctx.beginPath(); ctx.arc(0, 0, r - 3, Math.PI * 1.1, Math.PI * 1.4);
      ctx.lineWidth = 2.5; ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.stroke();
    },
    // Ballonreifen: dick, weich, mit Ventil und Flicken
    ballon(ctx, o) {
      const r = 23;
      circle(ctx, 0, 0, r); paint(ctx, "#3d4a55");
      ctx.save(); ctx.rotate(o.turn);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(0, 0, r - 4 - i * 3.5, -0.6 + i, 0.4 + i);
        ctx.lineWidth = 2; ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.stroke();
      }
      rr(ctx, r * 0.45, -5, 8, 8, 1.5); paint(ctx, "#c8673a", 1.5);
      line(ctx, [0, r * 0.38, 0, r * 0.55], 3, C.chrome);
      ctx.restore();
      circle(ctx, 0, 0, r * 0.35); paint(ctx, C.white, 2.5);
      dot(ctx, 0, 0, 2.5, C.teal);
      ctx.beginPath(); ctx.arc(0, 0, r - 3, Math.PI * 1.05, Math.PI * 1.45);
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.stroke();
    },
    // Traktorreifen: Pfeilstollen, Senf-Felge, dicke Muttern
    trecker(ctx, o) {
      const r = 27;
      ctx.save(); ctx.rotate(o.turn);
      for (let i = 0; i < 14; i++) {
        ctx.save(); ctx.rotate((i * Math.PI * 2) / 14);
        ctx.beginPath(); ctx.moveTo(r - 4, -5); ctx.lineTo(r + 3, -1); ctx.lineTo(r + 3, 4); ctx.lineTo(r - 4, 1); ctx.closePath();
        paint(ctx, C.rubber, 2);
        ctx.restore();
      }
      ctx.restore();
      circle(ctx, 0, 0, r); paint(ctx, C.rubber);
      circle(ctx, 0, 0, r * 0.52); paint(ctx, C.mustard, 2.5);
      ctx.save(); ctx.rotate(o.turn);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        dot(ctx, Math.cos(a) * 9, Math.sin(a) * 9, 2.2);
      }
      ctx.restore();
      circle(ctx, 0, 0, 4); paint(ctx, C.ink, 2);
    },

    // --- Lenkung --------------------------------------------------------
    // Hollandrad-Lenker mit Klingel und Bändern
    lenker(ctx, o) {
      pole(ctx, [-6, 24, 0, 0], 4, C.chrome);
      line(ctx, [-10, -6, 0, 0, 6, -2], 7);
      line(ctx, [-10, -6, 0, 0, 6, -2], 3, C.chrome);
      line(ctx, [-14, -9, -9, -6], 7); line(ctx, [-14, -9, -9, -6], 4, C.red);
      circle(ctx, 4, -6, 3.5); paint(ctx, C.mustard, 2);
      const wave = o.running ? Math.sin(o.t * 18) * 3 : 0;
      for (const [c, dy] of [["#3a7bd5", 0], ["#ff8fb1", 3]]) {
        ctx.beginPath(); ctx.moveTo(-14, -8 + dy);
        ctx.quadraticCurveTo(-20, -10 + dy + wave, -26, -4 + dy - wave);
        ctx.lineWidth = 2; ctx.strokeStyle = c; ctx.stroke();
      }
    },
    // Holz-Lenkrad mit Hupenknopf
    lenkrad(ctx) {
      pole(ctx, [8, 24, 0, 0], 4, C.steel);
      ctx.save(); ctx.rotate(-0.35);
      ctx.beginPath(); ctx.ellipse(0, 0, 4.5, 14, 0, 0, Math.PI * 2);
      ctx.lineWidth = 7.5; ctx.strokeStyle = C.ink; ctx.stroke();
      ctx.lineWidth = 4; ctx.strokeStyle = "#b9773a"; ctx.stroke();
      ctx.restore();
      circle(ctx, 0, 0, 3.8); paint(ctx, C.red, 2);
    },

    // --- Vorbau ---------------------------------------------------------
    stange(ctx) {
      rr(ctx, -4, -9, 15, 18, 5); paint(ctx, C.chrome);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? 1.6 : 3.8;
        ctx.lineTo(4 + Math.cos(a) * rad, 2 + Math.sin(a) * rad);
      }
      ctx.closePath(); paint(ctx, C.mustard, 1);
      shine(ctx, 0, -5, 5);
    },
    // Schneeschild mit Warnstreifen
    schild(ctx) {
      pole(ctx, [-2, 0, 10, 0], 5, C.steelDark);
      const blade = () => {
        ctx.beginPath();
        ctx.moveTo(10, -26); ctx.quadraticCurveTo(30, -6, 18, 16); ctx.lineTo(26, 16);
        ctx.quadraticCurveTo(40, -8, 16, -26); ctx.closePath();
      };
      blade(); paint(ctx, C.mustard);
      ctx.save(); blade(); ctx.clip();
      for (let y = -30; y < 20; y += 9) line(ctx, [14, y, 40, y + 12], 3.5, C.ink);
      ctx.restore();
      blade(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
    },
    // Verschlafene Glotz-Lampe mit Blechlid
    lampe(ctx, o) {
      pole(ctx, [-2, 0, 4, -10], 3, C.steelDark);
      if (o.running) {
        ctx.beginPath(); ctx.moveTo(10, -14); ctx.lineTo(70, -30); ctx.lineTo(70, 6); ctx.closePath();
        ctx.fillStyle = "rgba(255,240,170,0.35)"; ctx.fill();
      }
      circle(ctx, 6, -14, 8.5); paint(ctx, C.ink);
      circle(ctx, 8, -14, 5.5); paint(ctx, C.cream, 2);
      dot(ctx, 9.5, -13, 1.8);
      ctx.beginPath(); ctx.arc(6, -14, 9.5, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath();
      paint(ctx, C.steel, 2.5);
    },

    // --- Heck -----------------------------------------------------------
    // Doppelrohr mit angelaufenen Spitzen
    turbo(ctx, o) {
      if (o.running) {
        const f = 8 + Math.sin(o.t * 40) * 4;
        for (const y of [-4, 5]) {
          ctx.beginPath(); ctx.moveTo(-28, y - 4); ctx.lineTo(-28 - f - 6, y); ctx.lineTo(-28, y + 4); ctx.closePath();
          ctx.fillStyle = "#ff8a3a"; ctx.fill();
        }
      }
      for (const y of [-8, 1]) {
        rr(ctx, -26, y, 28, 8, 4); paint(ctx, C.chrome, 2.5);
        rr(ctx, -30, y - 1, 7, 10, 3); paint(ctx, "#7d8fd6", 2.5);
      }
    },
    // Kugelkopf mit Sicherungskette
    haken(ctx) {
      pole(ctx, [2, 2, -14, 2], 4, C.steelDark);
      circle(ctx, -18, -1, 5); paint(ctx, C.chrome, 2.5);
      ctx.setLineDash([2.5, 2]);
      ctx.beginPath(); ctx.moveTo(-6, 4); ctx.quadraticCurveTo(-12, 14, -18, 6);
      ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke(); ctx.setLineDash([]);
    },
    // Abschleppkran: Arm schräg nach hinten oben, Seil, Haken
    kran(ctx, o) {
      rr(ctx, -12, -8, 16, 14, 3); paint(ctx, "#39434b");
      ctx.save(); ctx.rotate(-2.2);
      rr(ctx, -4, -6, 62, 12, 3); paint(ctx, C.mustard);
      for (let x = 6; x < 54; x += 10) line(ctx, [x, -4, x + 6, 4], 2, C.ink);
      ctx.restore();
      const tipX = Math.cos(-2.2) * 56, tipY = Math.sin(-2.2) * 56;
      circle(ctx, tipX, tipY, 4); paint(ctx, C.chrome, 2);
      const swing = o.running ? Math.sin(o.t * 4) * 3 : 0;
      line(ctx, [tipX - 3, tipY, tipX - 3 + swing, tipY + 34], 1.5);
      ctx.beginPath(); ctx.arc(tipX - 3 + swing, tipY + 40, 5, -Math.PI / 2, Math.PI * 0.9);
      ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
      circle(ctx, -4, -1, 4); paint(ctx, C.chrome, 2);
    },

    // --- Aufbau (Anker oben, Pfosten bis zum Rahmen) ---------------------
    // Wellblech mit genietetem Flicken
    dach(ctx) {
      pole(ctx, [-46, 0, -46, ROOF_DROP], 4, C.steel);
      pole(ctx, [46, 0, 46, ROOF_DROP], 4, C.steel);
      ctx.beginPath(); ctx.moveTo(-62, 2);
      for (let x = -62; x <= 62; x += 8) ctx.quadraticCurveTo(x + 4, -12, x + 8, -6);
      ctx.lineTo(62, 4); ctx.lineTo(-62, 4); ctx.closePath();
      paint(ctx, "#a9b8c2");
      for (let x = -58; x < 62; x += 8) line(ctx, [x, -6, x, 2], 1.5, "#7c8d99");
      rr(ctx, 14, -8, 18, 11, 1); paint(ctx, "#c8673a", 2);
      for (const [x, y] of [[17, -5], [29, -5], [17, 0], [29, 0]]) dot(ctx, x, y, 1.2);
    },
    // Gepunktetes Bettlaken am Besenstiel
    segel(ctx, o) {
      pole(ctx, [-30, -34, -30, ROOF_DROP], 3, C.woodDark);
      const bulge = o.running ? 12 : 5;
      const sail = () => {
        ctx.beginPath(); ctx.moveTo(-27, -32); ctx.quadraticCurveTo(-27 + 30 + bulge, 0, -27, 46);
        ctx.lineTo(-27, -32); ctx.closePath();
      };
      sail(); paint(ctx, C.cream);
      ctx.save(); sail(); ctx.clip();
      for (let y = -28; y < 46; y += 11) for (let x = -24; x < 10; x += 10) dot(ctx, x + ((y / 11) % 2) * 5, y, 2.2, "#ff8fb1");
      ctx.restore();
      sail(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
      const flap = o.running ? Math.sin(o.t * 14) * 3 : 0;
      ctx.beginPath(); ctx.moveTo(-30, -34); ctx.lineTo(-46, -30 + flap); ctx.lineTo(-30, -26); ctx.closePath();
      paint(ctx, C.red, 2);
    },
    blaulicht(ctx, o) {
      pole(ctx, [0, 4, 0, ROOF_DROP], 3, C.steel);
      const on = o.running && Math.sin(o.t * 12) > 0;
      if (on) { circle(ctx, 0, -4, 20); ctx.fillStyle = "rgba(80,150,255,0.35)"; ctx.fill(); }
      rr(ctx, -10, -12, 20, 14, [8, 8, 2, 2]); paint(ctx, on ? "#7fb2ff" : C.sky);
      line(ctx, [-4, -8, -4, -1], 2.5, "rgba(255,255,255,0.6)");
      rr(ctx, -13, 1, 26, 6, 2); paint(ctx, C.ink, 2);
    },
  };

  // Greifbereich je Teil (relativ zum Anker) - für Antippen/Rausziehen
  KK.partBox = function (part, len) {
    if (part.cat === "rahmen") return [-len / 2 - 6, -22, len / 2 + 2, 18];
    if (part.cat === "rad") return [-part.r - 3, -part.r - 3, part.r + 3, part.r + 3];
    const boxes = {
      maeher: [-26, -29, 38, 18], trommel: [-26, -30, 26, 20], v8: [-42, -44, 36, 24],
      kanister: [-17, -24, 20, 17], fass: [-18, -23, 18, 29], akku: [-27, -30, 19, 13],
      lenker: [-27, -12, 8, 24], lenkrad: [-8, -16, 10, 24],
      stange: [-5, -10, 12, 10], schild: [-2, -27, 34, 17], lampe: [-3, -24, 16, -5],
      turbo: [-31, -10, 3, 10], haken: [-24, -7, 3, 12], kran: [-44, -50, 8, 10],
      dach: [-63, -14, 63, 8], segel: [-47, -35, 10, 46], blaulicht: [-14, -13, 14, 8],
    };
    return boxes[part.id];
  };

  KK.drawPart = function (ctx, partId, opts) {
    ctx.save();
    DRAW[partId](ctx, opts);
    ctx.restore();
  };

  // Kleiner Mechaniker am Steuer: Latzhose, Mütze, Schweißerbrille
  function drawDriver(ctx, x, grip, t) {
    const bob = Math.sin(t * 8) * 0.8;
    ctx.save();
    ctx.translate(x, bob);
    rr(ctx, -11, -36, 22, 28, 9); paint(ctx, C.teal);
    line(ctx, [-4, -34, -4, -24], 2, C.ink);
    circle(ctx, 1, -48, 11); paint(ctx, C.skin);
    ctx.beginPath(); ctx.arc(1, -51, 11, Math.PI, 0); ctx.closePath(); paint(ctx, C.mustard);
    line(ctx, [8, -52, 16, -52], 4);
    line(ctx, [-10, -46, 12, -46], 3);
    circle(ctx, 6, -46, 3.5); paint(ctx, C.glass, 2);
    ctx.restore();
    // Arm zum Lenker
    line(ctx, [x + 4, -26 + bob, grip.x, grip.y], 6);
    line(ctx, [x + 4, -26 + bob, grip.x, grip.y], 2.5, C.teal);
  }

  // Ganzes Auto in lokalen px. opts: { turn, running, t, ghostSlot }
  KK.drawCar = function (ctx, build, opts = {}) {
    if (!build.chassis) return;
    const chassis = KK.PART[build.chassis];
    const o = { len: chassis.len, turn: 0, running: false, t: 0, ...opts };
    const at = (slot) => {
      const pid = build.parts[slot];
      if (!pid) return;
      const p = KK.slotPos(chassis, slot);
      ctx.save();
      ctx.translate(p.x, p.y);
      KK.drawPart(ctx, pid, o);
      ctx.restore();
    };
    at("dach");
    KK.drawPart(ctx, chassis.id, o);
    at("energie");
    at("motor");
    const steer = KK.slotPos(chassis, "lenkung");
    const grip = build.parts.lenkung ? { x: steer.x - 3, y: steer.y + 1 } : { x: chassis.len * 0.17, y: -16 };
    drawDriver(ctx, chassis.len * 0.1, grip, o.t);
    at("lenkung");
    at("vorne");
    at("hinten");
    at("radH");
    at("radV");
  };

  // Vorschaubild eines Teils in ein Canvas (Werkzeugleiste)
  KK.drawThumb = function (canvas, partId) {
    const part = KK.PART[partId];
    const len = part.len || 0;
    const box = KK.partBox(part, len);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 72, h = canvas.clientHeight || 56;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const bw = box[2] - box[0], bh = box[3] - box[1];
    const s = Math.min((w - 10) / bw, (h - 10) / bh, 1.4);
    ctx.translate(w / 2 - ((box[0] + box[2]) / 2) * s, h / 2 - ((box[1] + box[3]) / 2) * s);
    ctx.scale(s, s);
    KK.drawPart(ctx, partId, { len, turn: 0.3, running: false, t: 0 });
  };
})(globalThis.KK = globalThis.KK || {});
