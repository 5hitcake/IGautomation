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

  const DRAW = {
    // --- Rahmen ---------------------------------------------------------
    kiste(ctx, o) {
      const L = o.len;
      rr(ctx, -L / 2, -12, L, 22, 4); paint(ctx, C.wood);
      for (let x = -L / 2 + 30; x < L / 2 - 10; x += 30) line(ctx, [x, -10, x, 8], 2, C.woodDark);
      for (let x = -L / 2 + 12; x < L / 2; x += 30) {
        circle(ctx, x, -6, 1.8); ctx.fillStyle = C.ink; ctx.fill();
      }
      shine(ctx, -L / 2 + 8, -7, L * 0.3);
    },
    leiter(ctx, o) {
      const L = o.len;
      rr(ctx, -L / 2, -8, L, 16, 3); paint(ctx, C.steel);
      for (let x = -L / 2 + 18; x < L / 2 - 10; x += 26) {
        circle(ctx, x, 0, 3.5); paint(ctx, C.steelDark, 2);
      }
      shine(ctx, -L / 2 + 6, -4, L * 0.4);
    },
    traktor(ctx, o) {
      const L = o.len;
      rr(ctx, -L / 2, -14, L, 26, 6); paint(ctx, C.tractor);
      rr(ctx, L / 2 - 34, -20, 30, 36, 5); paint(ctx, C.ink);
      for (let x = -L / 2 + 14; x < L / 2 - 40; x += 22) {
        circle(ctx, x, -7, 2.2); ctx.fillStyle = C.ink; ctx.fill();
      }
      shine(ctx, -L / 2 + 8, -8, L * 0.35);
    },

    // --- Motoren --------------------------------------------------------
    maeher(ctx, o) {
      const shake = o.running ? Math.sin(o.t * 60) * 0.8 : 0;
      ctx.translate(0, shake);
      rr(ctx, -24, -16, 46, 30, 7); paint(ctx, C.red);
      for (let x = -16; x <= 8; x += 6) line(ctx, [x, -10, x, 8], 2.5, "#a8302a");
      rr(ctx, -14, -24, 22, 9, 3); paint(ctx, C.ink);
      line(ctx, [22, -6, 28, -12], 2.5);
      circle(ctx, 29, -13, 4); paint(ctx, C.mustard, 2.5);
      shine(ctx, -18, -11, 6);
    },
    trommel(ctx, o) {
      rr(ctx, -24, -24, 48, 42, 6); paint(ctx, C.white);
      line(ctx, [-24, -14, 24, -14], 2.5);
      circle(ctx, 14, -19, 2.5); ctx.fillStyle = C.red; ctx.fill();
      circle(ctx, 0, 2, 13); paint(ctx, C.chrome);
      circle(ctx, 0, 2, 9); paint(ctx, C.glass, 2);
      const a = o.running ? o.t * 14 : 0;
      line(ctx, [Math.cos(a) * 6, 2 + Math.sin(a) * 6, -Math.cos(a) * 6, 2 - Math.sin(a) * 6], 2.5, C.blue);
      shine(ctx, -18, -19, 8);
    },
    v8(ctx, o) {
      const shake = o.running ? Math.sin(o.t * 45) * 1.2 : 0;
      ctx.translate(0, shake);
      rr(ctx, -34, -14, 68, 30, 5); paint(ctx, "#8c99a3");
      rr(ctx, -33, -30, 31, 17, 4); paint(ctx, C.red);
      rr(ctx, 2, -30, 31, 17, 4); paint(ctx, C.red);
      ctx.beginPath(); ctx.ellipse(0, -36, 22, 7, 0, 0, Math.PI * 2); paint(ctx, C.chrome);
      for (let x = -26; x <= 26; x += 10) line(ctx, [x, -2, x, 10], 2.5, "#5f6b74");
      shine(ctx, -28, -25, 10); shine(ctx, 7, -25, 10);
    },

    // --- Energie --------------------------------------------------------
    kanister(ctx) {
      rr(ctx, -15, -16, 30, 32, 4); paint(ctx, "#d93b30");
      line(ctx, [-9, -9, 9, 10], 2.5, "#a8302a"); line(ctx, [9, -9, -9, 10], 2.5, "#a8302a");
      rr(ctx, -12, -23, 14, 8, 3); paint(ctx, C.ink);
      rr(ctx, 6, -22, 7, 7, 2); paint(ctx, C.mustard, 2.5);
    },
    fass(ctx) {
      rr(ctx, -17, -22, 34, 42, 5); paint(ctx, C.blue);
      line(ctx, [-17, -8, 17, -8], 3); line(ctx, [-17, 7, 17, 7], 3);
      circle(ctx, 8, -16, 2.5); ctx.fillStyle = C.ink; ctx.fill();
      shine(ctx, -12, -15, 6);
    },
    akku(ctx) {
      rr(ctx, -12, -21, 7, 6, 1); paint(ctx, C.red, 2);
      rr(ctx, 5, -21, 7, 6, 1); paint(ctx, C.ink, 2);
      rr(ctx, -18, -16, 36, 28, 3); paint(ctx, "#2b3440");
      ctx.beginPath();
      ctx.moveTo(2, -11); ctx.lineTo(-6, 0); ctx.lineTo(0, 0); ctx.lineTo(-3, 8); ctx.lineTo(7, -4); ctx.lineTo(1, -4);
      ctx.closePath(); paint(ctx, C.mustard, 2);
    },

    // --- Räder (o.turn = Drehwinkel) -------------------------------------
    buggy(ctx, o) {
      const r = 13;
      circle(ctx, 0, 0, r); paint(ctx, C.white, 3);
      circle(ctx, 0, 0, r - 4); ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = o.turn + (i * Math.PI) / 3;
        line(ctx, [0, 0, Math.cos(a) * (r - 4), Math.sin(a) * (r - 4)], 1.5);
      }
      circle(ctx, 0, 0, 3); paint(ctx, C.red, 2);
    },
    reifen(ctx, o) {
      const r = 19;
      circle(ctx, 0, 0, r); paint(ctx, C.rubber);
      circle(ctx, 0, 0, r * 0.55); paint(ctx, C.chrome, 2.5);
      for (let i = 0; i < 5; i++) {
        const a = o.turn + (i * Math.PI * 2) / 5;
        circle(ctx, Math.cos(a) * 6, Math.sin(a) * 6, 1.8); ctx.fillStyle = C.ink; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(0, 0, r - 4, Math.PI * 1.1, Math.PI * 1.4);
      ctx.lineWidth = 2.5; ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.stroke();
    },
    trecker(ctx, o) {
      const r = 27;
      ctx.save(); ctx.rotate(o.turn);
      for (let i = 0; i < 14; i++) {
        ctx.save(); ctx.rotate((i * Math.PI * 2) / 14);
        rr(ctx, r - 4, -4, 7, 8, 2); paint(ctx, C.rubber, 2);
        ctx.restore();
      }
      ctx.restore();
      circle(ctx, 0, 0, r); paint(ctx, C.rubber);
      circle(ctx, 0, 0, r * 0.5); paint(ctx, C.mustard, 2.5);
      circle(ctx, 0, 0, 4); paint(ctx, C.ink, 2);
    },

    // --- Lenkung --------------------------------------------------------
    lenker(ctx) {
      pole(ctx, [-6, 24, 0, 0], 4, C.chrome);
      line(ctx, [-8, -6, 0, 0, 6, -2], 7);
      line(ctx, [-8, -6, 0, 0, 6, -2], 3, C.chrome);
      line(ctx, [-12, -9, -7, -6], 7); line(ctx, [-12, -9, -7, -6], 4, C.red);
    },
    lenkrad(ctx) {
      pole(ctx, [8, 24, 0, 0], 4, C.steel);
      ctx.save(); ctx.rotate(-0.35);
      ctx.beginPath(); ctx.ellipse(0, 0, 4.5, 14, 0, 0, Math.PI * 2);
      ctx.lineWidth = 7; ctx.strokeStyle = C.ink; ctx.stroke();
      ctx.lineWidth = 3.5; ctx.strokeStyle = C.rubber; ctx.stroke();
      ctx.restore();
      circle(ctx, 0, 0, 3.5); paint(ctx, C.red, 2);
    },

    // --- Vorbau ---------------------------------------------------------
    stange(ctx) {
      rr(ctx, -4, -9, 15, 18, 5); paint(ctx, C.chrome);
      shine(ctx, 0, -4, 5);
    },
    schild(ctx) {
      pole(ctx, [-2, 0, 10, 0], 5, C.steelDark);
      ctx.beginPath();
      ctx.moveTo(10, -26); ctx.quadraticCurveTo(30, -6, 18, 16); ctx.lineTo(26, 16);
      ctx.quadraticCurveTo(40, -8, 16, -26); ctx.closePath();
      paint(ctx, C.mustard);
      line(ctx, [17, -14, 22, -10], 3, C.ink);
      line(ctx, [21, -2, 26, 1], 3, C.ink);
    },
    lampe(ctx, o) {
      pole(ctx, [-2, 0, 4, -10], 3, C.steelDark);
      if (o.running) {
        ctx.beginPath(); ctx.moveTo(10, -14); ctx.lineTo(70, -30); ctx.lineTo(70, 6); ctx.closePath();
        ctx.fillStyle = "rgba(255,240,170,0.35)"; ctx.fill();
      }
      circle(ctx, 6, -14, 8); paint(ctx, C.ink);
      circle(ctx, 8, -14, 5); paint(ctx, C.cream, 2);
    },

    // --- Heck -----------------------------------------------------------
    turbo(ctx, o) {
      if (o.running) {
        const f = 8 + Math.sin(o.t * 40) * 4;
        ctx.beginPath(); ctx.moveTo(-26, -5); ctx.lineTo(-26 - f - 6, 0); ctx.lineTo(-26, 6); ctx.closePath();
        ctx.fillStyle = "#ff8a3a"; ctx.fill();
      }
      rr(ctx, -28, -6, 30, 11, 5); paint(ctx, C.chrome);
      rr(ctx, -30, -8, 7, 15, 3); paint(ctx, "#8c99a3", 2.5);
    },
    haken(ctx) {
      pole(ctx, [2, 2, -14, 2], 4, C.steelDark);
      circle(ctx, -18, -1, 5); paint(ctx, C.chrome, 2.5);
    },

    // --- Aufbau (Anker oben, Pfosten bis zum Rahmen) ---------------------
    dach(ctx) {
      pole(ctx, [-46, 0, -46, ROOF_DROP], 4, C.steel);
      pole(ctx, [46, 0, 46, ROOF_DROP], 4, C.steel);
      rr(ctx, -62, -9, 124, 13, 6); paint(ctx, C.mustard);
      shine(ctx, -54, -4, 40);
    },
    segel(ctx, o) {
      pole(ctx, [-30, -34, -30, ROOF_DROP], 3, C.woodDark);
      const bulge = o.running ? 10 : 4;
      ctx.beginPath(); ctx.moveTo(-27, -32); ctx.quadraticCurveTo(-27 + 28 + bulge, 0, -27, 46);
      ctx.lineTo(-27, -32); ctx.closePath(); paint(ctx, C.cream);
      ctx.beginPath(); ctx.moveTo(-30, -34); ctx.lineTo(-44, -30); ctx.lineTo(-30, -26); ctx.closePath();
      paint(ctx, C.red, 2);
    },
    blaulicht(ctx, o) {
      pole(ctx, [0, 4, 0, ROOF_DROP], 3, C.steel);
      const on = o.running && Math.sin(o.t * 12) > 0;
      if (on) { circle(ctx, 0, -4, 20); ctx.fillStyle = "rgba(80,150,255,0.35)"; ctx.fill(); }
      rr(ctx, -10, -12, 20, 14, [8, 8, 2, 2]); paint(ctx, on ? "#7fb2ff" : C.sky);
      rr(ctx, -13, 1, 26, 6, 2); paint(ctx, C.ink, 2);
    },
  };

  // Greifbereich je Teil (relativ zum Anker) - für Antippen/Rausziehen
  KK.partBox = function (part, len) {
    if (part.cat === "rahmen") return [-len / 2, -20, len / 2, 16];
    if (part.cat === "rad") return [-part.r, -part.r, part.r, part.r];
    const boxes = {
      maeher: [-26, -26, 34, 16], trommel: [-26, -26, 26, 20], v8: [-36, -44, 36, 18],
      kanister: [-16, -24, 16, 17], fass: [-18, -23, 18, 21], akku: [-19, -22, 19, 13],
      lenker: [-14, -12, 8, 24], lenkrad: [-8, -16, 10, 24],
      stange: [-5, -10, 12, 10], schild: [-2, -27, 34, 17], lampe: [-3, -23, 15, -5],
      turbo: [-31, -9, 3, 8], haken: [-24, -7, 3, 6],
      dach: [-63, -10, 63, 8], segel: [-45, -35, 10, 46], blaulicht: [-14, -13, 14, 8],
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
