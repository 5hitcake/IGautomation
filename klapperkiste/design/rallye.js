// Waldrallye: erste Vorrunde zum Klappertal-Rennen. Zeitfahren auf dem alten Holzweg von
// oben, das Auto fährt von links nach rechts von selbst, man lenkt nach oben und unten
// (Finger auf die Bahn halten oder Pfeiltasten) und weicht Pfützen, Wurzeln, Stämmen und
// Steinen und Schlaglöchern aus. Start mit Countdown 3, 2, 1, GO, dann fährt es von selbst los.
// Bilder für Hindernisse (bilder.pfuetze, ast, wurzel, schlagloch) werden genutzt, wenn es sie
// gibt; sonst sind sie einfach gezeichnet.
// Die Werte des Autos zählen: Tempo, Gewicht (Beschleunigung), Lenkung, Grip (Pfützen).
//
// window.Rallye({ eltern, bilder, werte }) gibt { starten(fertig) } zurück.
//   bilder: { auto: {img, laenge}, walddach, erde, fels, nadelbaum } (Image-Objekte)
//   werte(): Werte des Autos wie in der Werkstatt (tempo, gewicht, wendig, grip)
//   fertig({ zeit, medaille, muenzen }) nach „Fertig“; medaille: "gold" | "silber" | "bronze" | null
window.Rallye = function (opt) {
  const LAENGE = 480; // Meter
  const BAHN = 4.2; // halbe Breite der Fahrbahn in Metern
  const ZEITEN = { gold: 66, silber: 78, bronze: 92 }; // Sekunden; Gold braucht einen schnelleren Motor als den Rasenmäher
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const box = document.createElement("div");
  box.id = "rallye"; box.hidden = true;
  box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Waldrallye");
  box.innerHTML = '<canvas aria-label="Rennstrecke. Finger auf die Bahn halten, um nach oben oder unten zu lenken."></canvas>' +
    '<div class="r-hud"><span class="r-zeit">0,0 s</span><span class="r-ziele"></span></div>' +
    '<div class="r-bar"><i></i></div><div class="r-zahl" hidden></div><div class="r-meldung" hidden></div>' +
    '<div class="r-ende" hidden><div><strong></strong><p class="r-text"></p><p class="r-tab"></p>' +
    '<div class="knoepfe"><button type="button" class="knopf r-nochmal">🔁 Nochmal</button><button type="button" class="knopf zweit r-fertig">Fertig</button></div></div></div>';
  opt.eltern.append(box);
  const cv = box.querySelector("canvas"), ctx = cv.getContext("2d");
  const $ = (s) => box.querySelector(s);
  $(".r-ziele").textContent = `🥇 ${ZEITEN.gold} s · 🥈 ${ZEITEN.silber} s · 🥉 ${ZEITEN.bronze} s`;

  // Strecke: immer dieselbe (fair und lernbar). In jedem Abschnitt höchstens ein Hindernis,
  // das nie die ganze Breite sperrt; dazwischen Münzen.
  let s = 7;
  const zufall = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const DINGE = [], BAEUME = [];
  for (let x = 30; x < LAENGE - 15; x += 9 + zufall() * 7) {
    const r = zufall(), y = (zufall() * 2 - 1) * (BAHN - 1.3);
    const art = r < 0.26 ? "pfuetze" : r < 0.46 ? "wurzel" : r < 0.66 ? "schlagloch" : r < 0.84 ? "stamm" : "stein";
    const d = { pfuetze: [3.2, 1.7], wurzel: [1.3, 3.6], schlagloch: [2, 1.3], stamm: [1.2, 4.4], stein: [1.6, 1.6] }[art];
    let oy = y;
    if (art === "stamm") oy = (zufall() < 0.5 ? -1 : 1) * (BAHN - 2.1); // liegt halb über der Bahn
    DINGE.push({ art, x, y: oy, b: d[0], h: d[1], rot: (zufall() - 0.5) * 0.4 });
    if (zufall() < 0.55) DINGE.push({ art: "muenze", x: x + 4.5, y: (zufall() * 2 - 1) * (BAHN - 1), b: 1, h: 1 });
  }
  // Wegrand: weich gewellt statt schnurgerade (Summe zweier Sinuswellen je Seite)
  const RAND = [[zufall() * 6, zufall() * 6], [zufall() * 6, zufall() * 6]];
  const rand = (x, seite) => {
    const [a, b] = RAND[seite > 0 ? 1 : 0];
    return BAHN + 0.35 + Math.sin(x / 9 + a) * 0.55 + Math.sin(x / 3.7 + b) * 0.25;
  };
  for (let x = -20; x < LAENGE + 40; x += 2.6 + zufall() * 2.4) {
    for (const seite of [-1, 1]) {
      // ab und zu ragt eine Krone weit über den Wegrand (wie an einem echten Waldweg)
      const ueber = zufall() < 0.3 ? zufall() * 2.2 : 0;
      BAEUME.push({ x: x + zufall() * 2, y: seite * (rand(x, seite) + 2.4 - ueber + zufall() * 4), s: 0.8 + zufall() * 0.45 });
    }
  }
  // Hasen: sitzen am Wegrand und hoppeln über die Bahn, wenn das Auto näher kommt
  const HASEN = [];
  for (let x = 60; x < LAENGE - 30; x += 55 + zufall() * 45) HASEN.push({ x0: x, seite: zufall() < 0.5 ? -1 : 1 });

  let lauf = null, fertigFn = null, zuletzt = 0;
  const finger = { y: null };
  const tasten = { hoch: false, runter: false };

  function starten(fertig) {
    fertigFn = fertig;
    const w = opt.werte() || {};
    lauf = {
      x: 0, y: 0, v: 0, zeit: 0, phase: "ampel", ampel: 0, gruen: 3, lenkwinkel: 0,
      vmax: 5 + (w.tempo || 15) / 10, acc: Math.max(1.4, 4.5 - (w.gewicht || 90) / 100) + (w.schub || 1) * 0.6,
      rakete: (w.schub || 1) >= 8,
      lenk: 5 + (w.wendig || 4) * 0.6 + (5 + (w.tempo || 15) / 10) * 0.3, grip: w.grip || 2, muenzen: 0, fehl: 0, wackel: 0, spritz: 0, gesehen: new Set(),
    };
    for (const d of DINGE) d.weg = false;
    for (const h of HASEN) Object.assign(h, { x: h.x0, y: h.seite * (BAHN + 1.5), los: false, getroffen: false, sprung: 0 });
    box.hidden = false; $(".r-ende").hidden = true; $(".r-meldung").hidden = true;
    zuletzt = performance.now();
    requestAnimationFrame(bild);
  }

  function meldung(text, ms = 1200) {
    const m = $(".r-meldung");
    m.textContent = text; m.hidden = false;
    clearTimeout(m.zeit); m.zeit = setTimeout(() => { m.hidden = true; }, ms);
  }

  cv.addEventListener("pointerdown", (e) => { finger.y = e.clientY; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => { if (finger.y !== null) finger.y = e.clientY; });
  const los = () => { finger.y = null; };
  cv.addEventListener("pointerup", los); cv.addEventListener("pointercancel", los);
  window.addEventListener("keydown", (e) => {
    if (box.hidden) return;
    if (e.key === "ArrowUp") { tasten.hoch = true; e.preventDefault(); }
    if (e.key === "ArrowDown") { tasten.runter = true; e.preventDefault(); }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowUp") tasten.hoch = false;
    if (e.key === "ArrowDown") tasten.runter = false;
  });
  $(".r-nochmal").addEventListener("click", () => starten(fertigFn));
  $(".r-fertig").addEventListener("click", () => {
    box.hidden = true;
    const e = lauf.ergebnis; lauf = null;
    if (fertigFn) fertigFn(e);
  });

  let mass = { m: 20, ox: 0, oy: 0 };
  function schritt(dt) {
    const L = lauf;
    if (L.phase === "ampel") {
      const vorher = L.ampel;
      L.ampel += dt;
      // Countdown 3, 2, 1, GO (je eine Sekunde)
      const zahl = L.ampel < L.gruen ? String(3 - Math.floor(L.ampel)) : "GO!";
      const z = $(".r-zahl");
      if (z.textContent !== zahl) { z.textContent = zahl; z.hidden = false; z.classList.remove("puls"); void z.offsetWidth; z.classList.add("puls"); }
      if (vorher < L.gruen && L.ampel >= L.gruen) {
        L.phase = "fahrt";
        setTimeout(() => { z.hidden = true; }, 700);
      }
      return;
    }
    if (L.phase !== "fahrt") return;
    L.zeit += dt;
    // Lenken: zum Finger hin oder mit den Pfeiltasten
    let ziel = null;
    if (finger.y !== null) ziel = Math.max(-BAHN + 0.9, Math.min(BAHN - 0.9, (finger.y - cv.getBoundingClientRect().top - mass.oy) / mass.m));
    if (tasten.hoch) ziel = L.y - 1; if (tasten.runter) ziel = L.y + 1;
    const yAlt = L.y;
    if (ziel !== null) {
      const d = ziel - L.y, step = L.lenk * dt;
      L.y += Math.abs(d) < step ? d : Math.sign(d) * step;
    }
    const soll = dt > 0 ? Math.max(-0.5, Math.min(0.5, (L.y - yAlt) / dt / 6)) : 0;
    L.lenkwinkel += (soll - L.lenkwinkel) * Math.min(1, dt * 10);
    L.y = Math.max(-BAHN + 0.9, Math.min(BAHN - 0.9, L.y));
    L.v = Math.min(L.vmax, L.v + L.acc * dt);
    L.x += L.v * dt;
    L.wackel *= Math.pow(0.02, dt); L.spritz = Math.max(0, L.spritz - dt);
    // Zusammenstöße (Auto als Rechteck 3,4 × 1,6 m)
    for (const d of DINGE) {
      if (d.weg || Math.abs(d.x - L.x) > (d.b / 2 + 1.7) || Math.abs(d.y - L.y) > (d.h / 2 + 0.8)) continue;
      if (d.art === "muenze") { d.weg = true; L.muenzen++; continue; }
      d.weg = true; // jedes Hindernis wirkt nur einmal
      if (d.art === "pfuetze") { L.v *= 0.35 + Math.min(0.5, L.grip * 0.05); L.spritz = 0.6; meldung("Platsch!", 700); }
      if (d.art === "wurzel") { L.v *= 0.6; L.wackel = 0.25; meldung("Rumpel!", 700); }
      if (d.art === "schlagloch") { L.v *= 0.45; L.wackel = 0.4; meldung("Bums! Ein Schlagloch!", 800); }
      if (d.art === "stamm" || d.art === "stein") {
        L.v *= 0.15; L.wackel = 0.5; meldung(d.art === "stamm" ? "Rumms! Ein Stamm!" : "Autsch, ein Stein!", 900);
        if (navigator.vibrate) { try { navigator.vibrate(60); } catch { /* egal */ } }
      }
    }
    for (const h of HASEN) {
      if (!h.los && h.x0 - L.x < 16 + L.v * 0.6) h.los = true;
      if (!h.los || Math.abs(h.y) > BAHN + 3) continue;
      h.sprung += dt * 7;
      h.y -= h.seite * dt * 3.2; // hoppelt quer über den Weg zur anderen Seite
      h.x += dt * 0.6;
      if (!h.getroffen && Math.abs(h.x - L.x) < 2 && Math.abs(h.y - L.y) < 1.1) {
        h.getroffen = true; L.v *= 0.25; L.wackel = 0.3; meldung("Vollbremsung! Ein Hase!", 900);
        h.y -= h.seite * 1.5; // springt erschrocken weiter
      }
    }
    if (L.x >= LAENGE || L.zeit > 160) ziel_(L);
  }
  function ziel_(L) {
    L.phase = "ziel";
    const zeit = Math.round(L.zeit * 10) / 10;
    const medaille = zeit <= ZEITEN.gold ? "gold" : zeit <= ZEITEN.silber ? "silber" : zeit <= ZEITEN.bronze ? "bronze" : null;
    L.ergebnis = { zeit, medaille, muenzen: L.muenzen };
    if (opt.beiZiel) opt.beiZiel(L.ergebnis);
    const e = $(".r-ende");
    e.querySelector("strong").textContent = medaille ? { gold: "🥇 Gold!", silber: "🥈 Silber!", bronze: "🥉 Bronze!" }[medaille] : "Zu langsam …";
    e.querySelector(".r-text").textContent = `Zeit: ${zeit.toLocaleString("de-DE")} s · 🪙 ${L.muenzen} eingesammelt`;
    e.querySelector(".r-tab").textContent = medaille ? "Damit bist du für das Klappertal-Rennen qualifiziert!"
      : `Für Bronze brauchst du höchstens ${ZEITEN.bronze} Sekunden. Ein schnellerer Motor oder ein leichteres Auto helfen.`;
    setTimeout(() => { e.hidden = false; }, 600);
  }

  // --- Zeichnen ------------------------------------------------------------------
  const muster = {};
  const musterVon = (name, meter) => {
    const img = opt.bilder[name];
    if (!img || !img.complete || !img.naturalWidth) return null;
    if (!muster[name]) { muster[name] = ctx.createPattern(img, "repeat"); muster[name].meter = meter; }
    return muster[name];
  };
  // Grund (Waldboden, Weg mit gewelltem Rand) ändert sich nie: in 12-m-Kacheln vormalen
  const KACHEL = 12, kacheln = new Map();
  let kachelPx = 0, kachelHoch = 0;
  function grundZeichnen(x0, x1, y0, y1, pxProM) {
    const dach = musterVon("walddach"), erde = musterVon("erde");
    if (!dach || !erde) { ctx.fillStyle = "#1f3a26"; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); ctx.fillStyle = "#7a5434"; ctx.fillRect(x0, -BAHN, x1 - x0, BAHN * 2); return; }
    const hoch = Math.ceil(y1 - y0) + 2, px = Math.ceil(KACHEL * pxProM);
    if (px !== kachelPx || hoch !== kachelHoch) { kacheln.clear(); kachelPx = px; kachelHoch = hoch; }
    const ky0 = -hoch / 2;
    for (let k = Math.floor(x0 / KACHEL); k <= Math.floor(x1 / KACHEL); k++) {
      let c = kacheln.get(k);
      if (!c) {
        c = document.createElement("canvas"); c.width = px; c.height = Math.ceil(hoch * pxProM);
        const g = c.getContext("2d"), f = px / KACHEL, wx = k * KACHEL;
        g.setTransform(f, 0, 0, f, -wx * f, -ky0 * f);
        const pd = g.createPattern(opt.bilder.walddach, "repeat"), pe = g.createPattern(opt.bilder.erde, "repeat");
        pd.setTransform(new DOMMatrix().scale(14 / opt.bilder.walddach.naturalWidth));
        pe.setTransform(new DOMMatrix().scale(6 / opt.bilder.erde.naturalWidth));
        g.fillStyle = pd; g.fillRect(wx - 1, ky0, KACHEL + 2, hoch);
        const weg = (extra) => {
          g.beginPath(); g.moveTo(wx - 1, -rand(wx - 1, -1) - extra);
          for (let x = wx - 1; x <= wx + KACHEL + 1; x += 0.5) g.lineTo(x, -rand(x, -1) - extra);
          for (let x = wx + KACHEL + 1; x >= wx - 1; x -= 0.5) g.lineTo(x, rand(x, 1) + extra);
          g.closePath();
        };
        g.fillStyle = "rgba(0,0,0,0.28)"; weg(0.8); g.fill();
        g.fillStyle = pe; weg(0); g.fill();
        kacheln.set(k, c);
        if (kacheln.size > 30) kacheln.delete(kacheln.keys().next().value);
      }
      ctx.drawImage(c, k * KACHEL, ky0, KACHEL + 1 / pxProM, hoch);
    }
  }
  function zeichnen() {
    const L = lauf;
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(700000 / Math.max(1, cv.clientWidth * cv.clientHeight))));
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const m = h / 17, kx = L.x - (w * 0.28) / m;
    mass = { m, ox: -kx * m, oy: h / 2 };
    const wack = reduce ? 0 : Math.sin(performance.now() / 30) * L.wackel * 0.3;
    ctx.setTransform(dpr * m, 0, 0, dpr * m, dpr * (-kx * m), dpr * (h / 2 + wack * m));
    const x0 = kx - 2, x1 = kx + w / m + 2, y0 = -h / 2 / m - 1, y1 = h / 2 / m + 1;
    grundZeichnen(x0, x1, y0, y1, dpr * m);
    // Start- und Ziellinie
    for (const lx of [0, LAENGE]) {
      for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? "#1d1a16" : "#fffaf0";
        ctx.fillRect(lx + j * 0.6, -BAHN + i * (BAHN / 4), 0.6, BAHN / 4);
      }
    }
    // Hindernisse und Münzen
    const t = performance.now() / 1000;
    for (const d of DINGE) {
      if (d.x < x0 - 3 || d.x > x1 + 3 || (d.weg && d.art === "muenze")) continue;
      ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot || 0);
      const bild = opt.bilder[d.art === "stamm" ? "ast" : d.art];
      if (d.art !== "stein" && d.art !== "muenze" && bild && bild.complete && bild.naturalWidth) {
        // Bild so lang wie das Hindernis, Seitenverhältnis bleibt (Ast und Wurzel liegen quer
        // über dem Weg, ihre Bilder sind waagerecht gezeichnet)
        const quer = d.art === "stamm" || d.art === "wurzel";
        if (quer) ctx.rotate(Math.PI / 2);
        const bw = (quer ? d.h : d.b) + 0.4, bh = bw * bild.naturalHeight / bild.naturalWidth;
        ctx.drawImage(bild, -bw / 2, -bh / 2, bw, bh);
      } else if (d.art === "schlagloch") {
        ctx.fillStyle = "#4a321e"; ctx.beginPath(); ctx.ellipse(0, 0, d.b / 2, d.h / 2, 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#2a1a0e"; ctx.beginPath(); ctx.ellipse(0.1, 0.1, d.b / 2 - 0.25, d.h / 2 - 0.25, 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,230,190,0.25)"; ctx.beginPath(); ctx.ellipse(-0.2, -0.25, d.b / 4, d.h / 8, 0.3, 0, Math.PI * 2); ctx.fill();
      } else if (d.art === "pfuetze") {
        ctx.fillStyle = "rgba(60,90,110,0.85)"; ctx.beginPath(); ctx.ellipse(0, 0, d.b / 2, d.h / 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(200,225,240,0.5)"; ctx.beginPath(); ctx.ellipse(-0.3, -0.3, d.b / 4, d.h / 6, 0, 0, Math.PI * 2); ctx.fill();
      } else if (d.art === "wurzel") {
        ctx.strokeStyle = "#4a3220"; ctx.lineWidth = 0.35; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(0, -d.h / 2); ctx.quadraticCurveTo(0.6, 0, 0, d.h / 2); ctx.moveTo(0.2, -0.4); ctx.lineTo(-0.5, -1); ctx.moveTo(0.3, 0.6); ctx.lineTo(0.9, 1.1); ctx.stroke();
      } else if (d.art === "stamm") {
        ctx.fillStyle = "rgba(10,20,8,0.35)"; ctx.beginPath(); ctx.roundRect(-d.b / 2 + 0.2, -d.h / 2 + 0.2, d.b, d.h, 0.5); ctx.fill();
        ctx.fillStyle = "#6b4a2b"; ctx.strokeStyle = "#2a1a0e"; ctx.lineWidth = 0.1;
        ctx.beginPath(); ctx.roundRect(-d.b / 2, -d.h / 2, d.b, d.h, 0.5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#c79a5e"; ctx.beginPath(); ctx.ellipse(0, d.h / 2 - 0.1, d.b / 2 - 0.05, 0.25, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else if (d.art === "stein") {
        const f = opt.bilder.fels;
        if (f && f.complete && f.naturalWidth) ctx.drawImage(f, -d.b / 2 - 0.2, -d.h / 2 - 0.2, d.b + 0.4, d.h + 0.4);
        else { ctx.fillStyle = "#9a9a92"; ctx.beginPath(); ctx.arc(0, 0, d.b / 2, 0, Math.PI * 2); ctx.fill(); }
      } else if (d.art === "muenze") {
        const s = Math.abs(Math.cos(t * 3 + d.x));
        ctx.fillStyle = "#f2b632"; ctx.strokeStyle = "#8a5a10"; ctx.lineWidth = 0.08;
        ctx.beginPath(); ctx.ellipse(0, 0, 0.45 * Math.max(0.2, s), 0.45, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
    // Auto (von oben, zeigt nach rechts)
    const a = opt.bilder.auto;
    if (a && a.img.complete && a.img.naturalWidth) {
      const lang = a.laenge, breit = lang * a.img.naturalHeight / a.img.naturalWidth;
      ctx.save(); ctx.translate(L.x, L.y); ctx.rotate((reduce ? 0 : Math.sin(t * 40) * L.wackel * 0.15));
      ctx.fillStyle = "rgba(10,20,8,0.35)"; ctx.beginPath(); ctx.roundRect(-2 + 0.25, -breit / 2 + 0.25, 4, breit, 0.5); ctx.fill();
      // Vorderachse mit den Vorderrädern ist ein eigenes Bild (dreht beim Lenken mit), darüber der Rumpf
      const ach = a.achseImg;
      if (ach && ach.complete && ach.naturalWidth && a.drehpunkt) {
        const [px, py] = a.drehpunkt, hoch = 4 * ach.naturalHeight / ach.naturalWidth;
        ctx.save(); ctx.translate(-2 + px, -hoch / 2 + py); ctx.rotate(L.lenkwinkel);
        ctx.drawImage(ach, -px, -py, 4, hoch); ctx.restore();
      }
      // Raketenantrieb: Flamme am Heck, solange er beschleunigt
      if (L.rakete && L.phase === "fahrt" && L.v < L.vmax * 0.98) {
        const f = 1 - L.v / L.vmax, fl = 1.2 + f * 2.2 + (reduce ? 0 : Math.random() * 0.5);
        const g = ctx.createLinearGradient(-2, 0, -2 - fl, 0);
        g.addColorStop(0, "rgba(255,240,180,0.95)"); g.addColorStop(0.4, "rgba(255,150,40,0.85)"); g.addColorStop(1, "rgba(220,60,20,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-1.9, -0.45); ctx.quadraticCurveTo(-2 - fl, 0, -1.9, 0.45); ctx.closePath(); ctx.fill();
      }
      ctx.drawImage(a.img, -2, -breit / 2, lang, breit);
      ctx.restore();
    }
    if (L.spritz > 0) {
      ctx.fillStyle = `rgba(150,190,215,${L.spritz})`;
      for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(L.x - 1 + Math.cos(i) * (1.2 + (0.6 - L.spritz) * 3), L.y + Math.sin(i * 2.3) * 1.4, 0.18, 0, Math.PI * 2); ctx.fill(); }
    }
    // Hasen
    const hb = opt.bilder.hase;
    for (const h of HASEN) {
      if (h.x < x0 - 2 || h.x > x1 + 2) continue;
      const pose = hb && hb[h.los && Math.sin(h.sprung) > 0 ? 1 : 0];
      if (!pose || !pose.img.complete || !pose.img.naturalWidth) continue;
      const hub = h.los ? Math.max(0, Math.sin(h.sprung)) * 0.15 : 0;
      ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.los ? -h.seite * Math.PI / 2 : 0); ctx.scale(1 + hub, 1 + hub);
      ctx.drawImage(pose.img, -pose.b / 2, -pose.h / 2, pose.b, pose.h);
      ctx.restore();
    }
    // Bäume am Rand (über allem, wie Kronen)
    const baum = opt.bilder.nadelbaum;
    if (baum && baum.complete && baum.naturalWidth) {
      for (const b of BAEUME) if (b.x > x0 - 4 && b.x < x1 + 4) ctx.drawImage(baum, b.x - 2.6 * b.s, b.y - 2.6 * b.s, 5.2 * b.s, 5.2 * b.s);
    }
    // Ampel
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (L.phase === "ampel" || (L.phase === "fahrt" && L.zeit < 0.8)) {
      const n = Math.min(3, Math.floor(L.ampel) + 1), gruen = false;
      const bx = w / 2 - 75, by = h * 0.18;
      ctx.fillStyle = "rgba(20,20,20,0.9)"; ctx.beginPath(); ctx.roundRect(bx, by, 150, 56, 14); ctx.fill();
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = L.phase === "fahrt" || gruen ? "#46d16a" : i < n ? "#e04b3a" : "#3a2a28";
        ctx.beginPath(); ctx.arc(bx + 30 + i * 45, by + 28, 17, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = "#fffaf0"; ctx.font = "800 14px Nunito, sans-serif"; ctx.textAlign = "center";
      ctx.fillText("Finger auf die Bahn: dorthin lenkt das Auto", w / 2, by + 78);
    }
    $(".r-zeit").textContent = `⏱ ${L.zeit.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s · 🪙 ${L.muenzen}`;
    $(".r-bar i").style.width = `${Math.min(100, (L.x / LAENGE) * 100)}%`;
  }

  function bild(t) {
    if (!lauf || box.hidden) return;
    const dt = Math.min(0.05, (t - zuletzt) / 1000);
    zuletzt = t;
    schritt(dt);
    zeichnen();
    requestAnimationFrame(bild);
  }

  return { starten, ZEITEN, get offen() { return !box.hidden; }, get tempo() { return lauf && lauf.phase === "fahrt" ? lauf.v / lauf.vmax * 6.2 : 0; } };
};
