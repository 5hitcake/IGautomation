// Karte vom Klappertal, gezeichnet im selben Stil wie die Teile.
// Alles in einem 1000 x 700 Raster; drawMap skaliert auf die Canvas-Größe.
(function (KK) {
  const C = KK.COLORS;
  const W = 1000, H = 700;

  const COAST = [
    [-200, -200], [1200, -200], [1020, 230], [965, 300], [940, 380], [968, 455],
    [930, 525], [880, 600], [815, 648], [700, 668], [560, 690], [420, 676],
    [330, 640], [250, 680], [120, 668], [-200, 800],
  ];
  const RIVER = [[505, 40], [478, 190], [400, 290], [345, 420], [318, 520], [330, 640]];
  const MOUNTAINS = [
    [250, 210, 150, 120], [330, 190, 170, 160], [450, 200, 160, 130], [560, 190, 190, 170],
    [690, 210, 170, 140], [790, 220, 140, 110], [150, 230, 130, 90],
  ];
  const FORESTS = [[285, 330, 7], [660, 250, 6], [815, 330, 5], [560, 520, 4], [80, 480, 6]];

  // Weiche Kurve durch Punkte (Mittelpunkte als Stützstellen)
  function smooth(ctx, pts, closed) {
    ctx.beginPath();
    const n = pts.length;
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (closed) {
      const m0 = mid(pts[n - 1], pts[0]);
      ctx.moveTo(m0[0], m0[1]);
      for (let i = 0; i < n; i++) {
        const m = mid(pts[i], pts[(i + 1) % n]);
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
      }
      ctx.closePath();
    } else {
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n - 1; i++) {
        const m = mid(pts[i], pts[i + 1]);
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
      }
      ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
    }
  }
  function stroke(ctx, w, color) {
    ctx.lineWidth = w; ctx.strokeStyle = color; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
  }
  function fillInk(ctx, fill, lw = 3) {
    ctx.fillStyle = fill; ctx.fill(); stroke(ctx, lw, C.ink);
  }
  function rect(ctx, x, y, w, h, r = 2) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function tri(ctx, ax, ay, bx, by, cx, cy) {
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath();
  }
  // Fester Pseudo-Zufall, damit die Karte bei jedem Bild gleich aussieht
  function rand(i) { const x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); }

  function drawGround(ctx, t) {
    ctx.fillStyle = "#3f8fa0"; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(220,245,245,0.45)"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    for (let i = 0; i < 70; i++) {
      const x = rand(i) * W, y = rand(i + 99) * H, dx = Math.sin(t * 0.8 + i) * 3;
      ctx.beginPath(); ctx.arc(x + dx, y, 7, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    }
    smooth(ctx, COAST, true); stroke(ctx, 26, "#e9d39a");
    smooth(ctx, COAST, true); ctx.fillStyle = "#9cc58a"; ctx.fill(); stroke(ctx, 3, C.ink);
    ctx.fillStyle = "#b3d39c";
    for (const [x, y, r] of [[480, 470, 110], [760, 470, 90], [250, 600, 70], [620, 380, 70]]) {
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawMountains(ctx) {
    for (const [x, base, w, h] of MOUNTAINS) {
      tri(ctx, x - w / 2, base, x, base - h, x + w / 2, base); fillInk(ctx, "#8796a8");
      tri(ctx, x, base - h, x + w / 2, base, x + w * 0.1, base); ctx.fillStyle = "#6e7d90"; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - w * 0.16, base - h * 0.68); ctx.lineTo(x, base - h);
      ctx.lineTo(x + w * 0.16, base - h * 0.68); ctx.lineTo(x + w * 0.06, base - h * 0.74);
      ctx.lineTo(x - w * 0.04, base - h * 0.64); ctx.closePath();
      fillInk(ctx, "#f4f7f8", 2.5);
      tri(ctx, x - w / 2, base, x, base - h, x + w / 2, base); stroke(ctx, 3, C.ink);
    }
  }

  function drawMoor(ctx) {
    ctx.fillStyle = "#6f7f4c";
    for (const [x, y, rx, ry] of [[120, 320, 95, 60], [175, 360, 60, 35], [70, 270, 50, 35]]) {
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#4e7f86";
    for (const [x, y, r] of [[90, 330, 16], [150, 290, 11], [190, 355, 13], [60, 285, 9]]) {
      ctx.beginPath(); ctx.ellipse(x, y, r * 1.5, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 18; i++) {
      const x = 50 + rand(i + 7) * 160, y = 280 + rand(i + 31) * 90;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y - 12); ctx.moveTo(x, y); ctx.lineTo(x + 3, y - 10);
      stroke(ctx, 2, "#3f5a2e");
      ctx.beginPath(); ctx.ellipse(x - 2, y - 14, 1.8, 4, 0, 0, Math.PI * 2); ctx.fillStyle = "#7a4e2a"; ctx.fill();
    }
  }

  function drawForests(ctx) {
    FORESTS.forEach(([cx, cy, n], k) => {
      for (let i = 0; i < n; i++) {
        const x = cx + (rand(k * 10 + i) - 0.5) * 70, y = cy + (rand(k * 10 + i + 5) - 0.5) * 40;
        ctx.beginPath(); ctx.rect(x - 2, y, 4, 9); ctx.fillStyle = "#7a4e2a"; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y - 4, 11, 0, Math.PI * 2); fillInk(ctx, k % 2 ? "#4f8f45" : "#5f9e4f", 2.5);
      }
    });
  }

  function drawRiver(ctx) {
    smooth(ctx, RIVER, false); stroke(ctx, 16, C.ink);
    smooth(ctx, RIVER, false); stroke(ctx, 11, "#5fb0c0");
  }

  function roadPath(ctx, a, b, i) {
    const [x1, y1] = a.pos, [x2, y2] = b.pos;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const bend = (rand(i + 3) - 0.5) * len * 0.35;
    const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
    ctx.beginPath(); ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(mx + nx * bend, my + ny * bend, x2, y2);
  }

  function drawRoads(ctx) {
    KK.ROADS.forEach(([a, b], i) => { roadPath(ctx, KK.PLACE[a], KK.PLACE[b], i); stroke(ctx, 12, C.ink); });
    KK.ROADS.forEach(([a, b], i) => { roadPath(ctx, KK.PLACE[a], KK.PLACE[b], i); stroke(ctx, 7, "#f3e3b8"); });
    ctx.setLineDash([6, 9]);
    KK.ROADS.forEach(([a, b], i) => { roadPath(ctx, KK.PLACE[a], KK.PLACE[b], i); stroke(ctx, 1.5, "#c9b27c"); });
    ctx.setLineDash([]);
  }

  // --- Gebäude je Ort (um den Ortspunkt herum, ca. 60 x 50) ---------------
  const ICONS = {
    start(ctx, t) {
      rect(ctx, -30, -30, 42, 30, 3); fillInk(ctx, "#2f5560");
      tri(ctx, -34, -28, -9, -46, 16, -28); fillInk(ctx, C.mustard);
      rect(ctx, -22, -20, 22, 20, 2); fillInk(ctx, "#1b3138", 2.5);
      ctx.beginPath(); ctx.arc(26, -8, 9, 0, Math.PI * 2); fillInk(ctx, C.rubber);
      ctx.beginPath(); ctx.arc(26, -8, 3.5, 0, Math.PI * 2); fillInk(ctx, C.chrome, 2);
      rect(ctx, 14, -26, 14, 10, 2); fillInk(ctx, C.wood, 2.5);
      ctx.save(); ctx.translate(-9, -36); ctx.rotate(Math.sin(t * 2) * 0.2);
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); stroke(ctx, 3, C.ink);
      ctx.restore();
    },
    dorf(ctx) {
      rect(ctx, -32, -26, 28, 26, 2); fillInk(ctx, C.cream);
      tri(ctx, -36, -24, -18, -42, 0, -24); fillInk(ctx, C.red);
      rect(ctx, -22, -14, 9, 14, 1); fillInk(ctx, "#2f5560", 2);
      rect(ctx, 0, -32, 30, 32, 2); fillInk(ctx, "#f4d6a8");
      tri(ctx, -4, -30, 15, -48, 34, -30); fillInk(ctx, "#2f5560");
      ctx.beginPath(); ctx.arc(15, -16, 7, 0, Math.PI * 2); stroke(ctx, 3.5, "#9c6534");
      ctx.beginPath(); ctx.moveTo(9, -12); ctx.lineTo(21, -20); ctx.moveTo(21, -12); ctx.lineTo(9, -20); stroke(ctx, 3, "#9c6534");
    },
    hof(ctx) {
      rect(ctx, -32, -30, 40, 30, 2); fillInk(ctx, C.tractor);
      ctx.beginPath(); ctx.moveTo(-36, -28); ctx.lineTo(-12, -48); ctx.lineTo(12, -28); ctx.closePath(); fillInk(ctx, "#a8302a");
      rect(ctx, -22, -18, 20, 18, 1); fillInk(ctx, C.white, 2.5);
      ctx.beginPath(); ctx.moveTo(-22, -18); ctx.lineTo(-2, 0); ctx.moveTo(-2, -18); ctx.lineTo(-22, 0); stroke(ctx, 2.5, C.tractor);
      rect(ctx, 12, -44, 16, 44, 7); fillInk(ctx, C.chrome);
      ctx.beginPath(); ctx.ellipse(20, -44, 8, 4, 0, Math.PI, 0); fillInk(ctx, C.steel, 2);
      ctx.beginPath(); ctx.ellipse(-40, -6, 9, 6, 0, 0, Math.PI * 2); fillInk(ctx, C.mustard, 2.5);
    },
    leuchtturm(ctx, t) {
      const a = t * 1.6;
      ctx.save(); ctx.translate(0, -58);
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.arc(0, 0, 60, a - 0.25, a + 0.25); ctx.closePath();
      ctx.fillStyle = "rgba(255,244,180,0.55)"; ctx.fill();
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-8, -50); ctx.lineTo(8, -50); ctx.lineTo(12, 0); ctx.closePath(); fillInk(ctx, C.white);
      ctx.save(); ctx.clip();
      for (let y = -42; y < 0; y += 16) { ctx.fillStyle = C.red; ctx.fillRect(-14, y, 28, 8); }
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-8, -50); ctx.lineTo(8, -50); ctx.lineTo(12, 0); ctx.closePath(); stroke(ctx, 3, C.ink);
      rect(ctx, -9, -64, 18, 14, 2); fillInk(ctx, C.cream);
      tri(ctx, -12, -63, 0, -74, 12, -63); fillInk(ctx, C.red);
    },
    moor(ctx) {
      for (const x of [-18, 14]) { ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x, 4); stroke(ctx, 4, C.ink); }
      rect(ctx, -24, -32, 44, 22, 2); fillInk(ctx, C.wood);
      tri(ctx, -28, -30, -2, -48, 24, -30); fillInk(ctx, "#6f7f4c");
      rect(ctx, -8, -26, 10, 10, 1); fillInk(ctx, C.glass, 2);
      ctx.beginPath(); ctx.moveTo(26, -2); ctx.lineTo(26, -26); stroke(ctx, 2.5, C.ink);
      rect(ctx, 22, -34, 10, 8, 1); fillInk(ctx, C.mustard, 2);
    },
    gipfel(ctx, t) {
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.5 + i / 3) % 1;
        ctx.beginPath(); ctx.arc(14 + k * 8, -46 - k * 26, 4 + k * 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.8 - k * 0.8})`; ctx.fill();
      }
      rect(ctx, -26, -28, 46, 28, 2); fillInk(ctx, "#9c6534");
      for (let y = -21; y < 0; y += 7) { ctx.beginPath(); ctx.moveTo(-26, y); ctx.lineTo(20, y); stroke(ctx, 1.5, "#7a4e2a"); }
      tri(ctx, -32, -26, -3, -48, 26, -26); fillInk(ctx, C.red);
      rect(ctx, 10, -48, 8, 14, 1); fillInk(ctx, "#39434b", 2);
      rect(ctx, -12, -20, 12, 10, 1); fillInk(ctx, C.cream, 2);
    },
    pass(ctx) {
      ctx.beginPath(); ctx.ellipse(0, -2, 34, 10, 0, 0, Math.PI * 2); fillInk(ctx, "#f4f7f8", 2.5);
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-6, -44); stroke(ctx, 4, C.ink);
      ctx.beginPath(); ctx.moveTo(-6, -40); ctx.lineTo(22, -40); ctx.lineTo(28, -34); ctx.lineTo(22, -28); ctx.lineTo(-6, -28); ctx.closePath();
      fillInk(ctx, C.mustard, 2.5);
      ctx.save(); ctx.translate(-24, -26);
      for (let i = 0; i < 3; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); stroke(ctx, 3, "#5fa7d6");
      }
      ctx.restore();
    },
    rennbahn(ctx) {
      ctx.beginPath(); ctx.ellipse(0, -14, 40, 18, 0, 0, Math.PI * 2); fillInk(ctx, "#c9b27c");
      ctx.beginPath(); ctx.ellipse(0, -14, 26, 9, 0, 0, Math.PI * 2); fillInk(ctx, "#9cc58a", 2.5);
      ctx.beginPath(); ctx.moveTo(30, -18); ctx.lineTo(30, -50); stroke(ctx, 3, C.ink);
      for (let r = 0; r < 2; r++) for (let q = 0; q < 3; q++) {
        ctx.fillStyle = (r + q) % 2 ? C.ink : "#ffffff"; ctx.fillRect(31 + q * 6, -50 + r * 6, 6, 6);
      }
      rect(ctx, 31, -50, 18, 12, 0); stroke(ctx, 1.5, C.ink);
    },
    steinbruch(ctx) {
      ctx.beginPath(); ctx.moveTo(-38, 0); ctx.lineTo(-38, -16); ctx.lineTo(-22, -16); ctx.lineTo(-22, -32);
      ctx.lineTo(-4, -32); ctx.lineTo(-4, -46); ctx.lineTo(24, -46); ctx.lineTo(36, 0); ctx.closePath();
      fillInk(ctx, "#a7a49c");
      ctx.beginPath(); ctx.moveTo(-38, -16); ctx.lineTo(36, -16); ctx.moveTo(-22, -32); ctx.lineTo(30, -32); stroke(ctx, 1.5, "#7c7a73");
      ctx.beginPath(); ctx.arc(-28, -4, 5, 0, Math.PI * 2); fillInk(ctx, "#8b887f", 2);
      rect(ctx, 6, -60, 6, 14, 2); fillInk(ctx, C.red, 2);
      ctx.beginPath(); ctx.moveTo(9, -60); ctx.quadraticCurveTo(14, -66, 18, -62); stroke(ctx, 1.5, C.ink);
    },
    feuerwache(ctx, t) {
      rect(ctx, -32, -30, 50, 30, 2); fillInk(ctx, C.red);
      rect(ctx, -26, -22, 18, 22, 2); fillInk(ctx, "#f4f7f8", 2.5);
      for (let y = -17; y < 0; y += 5) { ctx.beginPath(); ctx.moveTo(-26, y); ctx.lineTo(-8, y); stroke(ctx, 1.2, "#8a9aa3"); }
      rect(ctx, 18, -52, 16, 52, 2); fillInk(ctx, "#f4d6a8");
      tri(ctx, 15, -50, 26, -64, 37, -50); fillInk(ctx, C.red);
      ctx.save(); ctx.translate(26, -42); ctx.rotate(Math.sin(t * 4) * 0.3);
      ctx.beginPath(); ctx.moveTo(-5, 4); ctx.quadraticCurveTo(0, -8, 5, 4); ctx.closePath(); fillInk(ctx, C.mustard, 2);
      ctx.restore();
      // Kater Moppel auf dem Turm
      ctx.beginPath(); ctx.arc(26, -68, 4.5, 0, Math.PI * 2); fillInk(ctx, "#f29a3a", 2);
      tri(ctx, 22, -71, 23, -77, 26, -72); fillInk(ctx, "#f29a3a", 1.5);
      tri(ctx, 26, -72, 29, -77, 30, -71); fillInk(ctx, "#f29a3a", 1.5);
    },
  };

  function drawPin(ctx, place, n, o) {
    const [x, y] = place.pos;
    ctx.save(); ctx.translate(x, y);
    ICONS[place.id](ctx, o.t);
    // Namensschild
    ctx.font = '600 15px "Nunito", system-ui, sans-serif';
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const w = ctx.measureText(place.name).width + 18;
    rect(ctx, -w / 2, 8, w, 22, 11); fillInk(ctx, n ? C.cream : C.mustard, 2.5);
    ctx.fillStyle = C.ink; ctx.fillText(place.name, 0, 19.5);
    if (n) {
      const active = o.active === place.id;
      const r = active ? 15 + Math.sin(o.t * 5) * 2 : 13;
      ctx.beginPath(); ctx.arc(-w / 2 - 8, 19, r, 0, Math.PI * 2); fillInk(ctx, active ? C.mustard : "#1b3138", 2.5);
      ctx.font = '17px "Lilita One", "Arial Black", sans-serif';
      ctx.fillStyle = active ? C.ink : C.mustard; ctx.fillText(String(n), -w / 2 - 8, 20);
    }
    ctx.restore();
  }

  // opts: { t (Sekunden), active (Ort-ID zum Hervorheben) }
  KK.drawMap = function (ctx, w, h, opts = {}) {
    const o = { t: 0, active: null, ...opts };
    const k = Math.min(w / W, h / H);
    ctx.save();
    ctx.translate((w - W * k) / 2, (h - H * k) / 2);
    ctx.scale(k, k);
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    drawGround(ctx, o.t);
    drawMoor(ctx);
    drawRiver(ctx);
    drawMountains(ctx);
    drawForests(ctx);
    drawRoads(ctx);
    drawPin(ctx, KK.HOME, 0, o);
    KK.PLACES.forEach((p, i) => drawPin(ctx, p, i + 1, o));
    ctx.restore();
  };

  // Ort unter einem Punkt finden (für Antippen auf der Karte)
  KK.mapHit = function (w, h, x, y) {
    const k = Math.min(w / W, h / H);
    const mx = (x - (w - W * k) / 2) / k, my = (y - (h - H * k) / 2) / k;
    let best = null, dist = 55;
    for (const p of [KK.HOME, ...KK.PLACES]) {
      const d = Math.hypot(p.pos[0] - mx, p.pos[1] - 10 - my);
      if (d < dist) { best = p.id; dist = d; }
    }
    return best;
  };
})(globalThis.KK = globalThis.KK || {});
