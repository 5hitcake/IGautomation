// Waldrallye: erste Vorrunde zum Klappertal-Rennen. Zeitfahren auf dem alten Holzweg von
// oben, das Auto fährt von links nach rechts von selbst, man lenkt nach oben und unten
// (Finger auf die Bahn halten oder Pfeiltasten) und weicht Pfützen, Wurzeln, Stämmen und
// Steinen aus. Start mit Countdown 3, 2, 1, GO: Wer genau bei GO Gas gibt, bekommt einen
// Blitzstart; wer zu früh Gas gibt, würgt den Motor ab und startet eine Sekunde später.
// Die Werte des Autos zählen: Tempo, Gewicht (Beschleunigung), Lenkung, Grip (Pfützen).
//
// window.Rallye({ eltern, bilder, werte }) gibt { starten(fertig) } zurück.
//   bilder: { auto: {img, laenge}, walddach, erde, fels, nadelbaum } (Image-Objekte)
//   werte(): Werte des Autos wie in der Werkstatt (tempo, gewicht, wendig, grip)
//   fertig({ zeit, medaille, muenzen }) nach „Fertig“; medaille: "gold" | "silber" | "bronze" | null
window.Rallye = function (opt) {
  const LAENGE = 320; // Meter
  const BAHN = 4.2; // halbe Breite der Fahrbahn in Metern
  const ZEITEN = { gold: 45, silber: 51, bronze: 58 }; // Sekunden; Gold braucht einen schnelleren Motor als den Rasenmäher
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const box = document.createElement("div");
  box.id = "rallye"; box.hidden = true;
  box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Waldrallye");
  box.innerHTML = '<canvas aria-label="Rennstrecke. Finger auf die Bahn halten, um nach oben oder unten zu lenken."></canvas>' +
    '<div class="r-hud"><span class="r-zeit">0,0 s</span><span class="r-ziele"></span></div>' +
    '<div class="r-bar"><i></i></div><div class="r-zahl" hidden></div><div class="r-meldung" hidden></div>' +
    '<button type="button" class="r-gas" aria-label="Gas geben">GAS</button>' +
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
    const art = r < 0.32 ? "pfuetze" : r < 0.58 ? "wurzel" : r < 0.8 ? "stamm" : "stein";
    const d = { pfuetze: [3.2, 2], wurzel: [1, 3.4], stamm: [1.2, 4.2], stein: [1.6, 1.6] }[art];
    let oy = y;
    if (art === "stamm") oy = (zufall() < 0.5 ? -1 : 1) * (BAHN - 2.1); // liegt halb über der Bahn
    DINGE.push({ art, x, y: oy, b: d[0], h: d[1], rot: (zufall() - 0.5) * 0.4 });
    if (zufall() < 0.55) DINGE.push({ art: "muenze", x: x + 4.5, y: (zufall() * 2 - 1) * (BAHN - 1), b: 1, h: 1 });
  }
  for (let x = -20; x < LAENGE + 40; x += 2.6 + zufall() * 2.4) {
    for (const seite of [-1, 1]) BAEUME.push({ x: x + zufall() * 2, y: seite * (BAHN + 2.6 + zufall() * 4.5), s: 0.8 + zufall() * 0.4 });
  }

  let lauf = null, fertigFn = null, zuletzt = 0;
  const finger = { y: null };
  const tasten = { hoch: false, runter: false };

  function starten(fertig) {
    fertigFn = fertig;
    const w = opt.werte() || {};
    lauf = {
      x: 0, y: 0, v: 0, zeit: 0, phase: "ampel", ampel: 0, gruen: 3, warte: 0,
      vmax: 5 + (w.tempo || 15) / 10, acc: Math.max(1.4, 4.5 - (w.gewicht || 90) / 100),
      lenk: 2.6 + (w.wendig || 4) * 0.45, grip: w.grip || 2, muenzen: 0, fehl: 0, wackel: 0, spritz: 0, gesehen: new Set(),
    };
    for (const d of DINGE) d.weg = false;
    box.hidden = false; $(".r-ende").hidden = true; $(".r-meldung").hidden = true; $(".r-gas").hidden = false;
    zuletzt = performance.now();
    requestAnimationFrame(bild);
  }

  function meldung(text, ms = 1200) {
    const m = $(".r-meldung");
    m.textContent = text; m.hidden = false;
    clearTimeout(m.zeit); m.zeit = setTimeout(() => { m.hidden = true; }, ms);
  }

  // Gas beim Start: zu früh = Motor abgewürgt (1 s später los), höchstens 0,35 s nach GO = Blitzstart
  function gas() {
    const L = lauf;
    if (!L || L.gedrueckt) return;
    L.gedrueckt = true;
    if (L.phase === "ampel") { L.warte = 1; meldung("Zu früh! Motor abgewürgt …", 1400); return; }
    if (L.phase === "fahrt" && L.zeit < 0.35) { L.blitz = true; L.v = Math.max(L.v, L.vmax * 0.75); meldung("⚡ Blitzstart!"); }
  }
  $(".r-gas").addEventListener("pointerdown", (e) => { e.preventDefault(); gas(); });
  cv.addEventListener("pointerdown", (e) => { finger.y = e.clientY; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => { if (finger.y !== null) finger.y = e.clientY; });
  const los = () => { finger.y = null; };
  cv.addEventListener("pointerup", los); cv.addEventListener("pointercancel", los);
  window.addEventListener("keydown", (e) => {
    if (box.hidden) return;
    if (e.key === "ArrowUp") { tasten.hoch = true; e.preventDefault(); }
    if (e.key === "ArrowDown") { tasten.runter = true; e.preventDefault(); }
    if (e.key === " " || e.key === "Enter") { gas(); e.preventDefault(); }
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
    if (L.zeit > 1.2) $(".r-gas").hidden = true;
    if (L.warte > 0) { L.warte -= dt; return; } // abgewürgt: Uhr läuft, Auto steht
    // Lenken: zum Finger hin oder mit den Pfeiltasten
    let ziel = null;
    if (finger.y !== null) ziel = Math.max(-BAHN + 0.9, Math.min(BAHN - 0.9, (finger.y - cv.getBoundingClientRect().top - mass.oy) / mass.m));
    if (tasten.hoch) ziel = L.y - 1; if (tasten.runter) ziel = L.y + 1;
    if (ziel !== null) {
      const d = ziel - L.y, step = L.lenk * dt;
      L.y += Math.abs(d) < step ? d : Math.sign(d) * step;
    }
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
      if (d.art === "stamm" || d.art === "stein") {
        L.v *= 0.15; L.wackel = 0.5; meldung(d.art === "stamm" ? "Rumms! Ein Stamm!" : "Autsch, ein Stein!", 900);
        if (navigator.vibrate) { try { navigator.vibrate(60); } catch { /* egal */ } }
      }
    }
    if (L.x >= LAENGE || L.zeit > 120) ziel_(L);
  }
  function ziel_(L) {
    L.phase = "ziel"; $(".r-gas").hidden = true;
    const zeit = Math.round(L.zeit * 10) / 10;
    const medaille = zeit <= ZEITEN.gold ? "gold" : zeit <= ZEITEN.silber ? "silber" : zeit <= ZEITEN.bronze ? "bronze" : null;
    L.ergebnis = { zeit, medaille, muenzen: L.muenzen };
    if (opt.beiZiel) opt.beiZiel(L.ergebnis);
    const e = $(".r-ende");
    e.querySelector("strong").textContent = medaille ? { gold: "🥇 Gold!", silber: "🥈 Silber!", bronze: "🥉 Bronze!" }[medaille] : "Zu langsam …";
    e.querySelector(".r-text").textContent = `Zeit: ${zeit.toLocaleString("de-DE")} s${L.blitz ? " (mit Blitzstart)" : ""} · 🪙 ${L.muenzen} eingesammelt`;
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
  function zeichnen() {
    const L = lauf, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const m = h / 17, kx = L.x - (w * 0.28) / m;
    mass = { m, ox: -kx * m, oy: h / 2 };
    const wack = reduce ? 0 : Math.sin(performance.now() / 30) * L.wackel * 0.3;
    ctx.setTransform(dpr * m, 0, 0, dpr * m, dpr * (-kx * m), dpr * (h / 2 + wack * m));
    const x0 = kx - 2, x1 = kx + w / m + 2, y0 = -h / 2 / m - 1, y1 = h / 2 / m + 1;
    const dach = musterVon("walddach"), erde = musterVon("erde");
    const setz = (p, meter) => p && p.setTransform(new DOMMatrix().scale(meter / opt.bilder[p === dach ? "walddach" : "erde"].naturalWidth));
    setz(dach, 14); setz(erde, 6);
    ctx.fillStyle = dach || "#1f3a26"; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(x0, -BAHN - 0.9, x1 - x0, BAHN * 2 + 1.8);
    ctx.fillStyle = erde || "#7a5434"; ctx.fillRect(x0, -BAHN, x1 - x0, BAHN * 2);
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
      if (d.art === "pfuetze") {
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
      ctx.drawImage(a.img, -2, -breit / 2, lang, breit);
      ctx.restore();
    }
    if (L.spritz > 0) {
      ctx.fillStyle = `rgba(150,190,215,${L.spritz})`;
      for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(L.x - 1 + Math.cos(i) * (1.2 + (0.6 - L.spritz) * 3), L.y + Math.sin(i * 2.3) * 1.4, 0.18, 0, Math.PI * 2); ctx.fill(); }
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
      ctx.fillText("Genau bei GO auf GAS drücken: Blitzstart!", w / 2, by + 78);
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
