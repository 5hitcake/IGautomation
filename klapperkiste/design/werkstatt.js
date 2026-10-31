// Werkstatt: Hebebühne, Teile-Regal und Checkliste. Wird von werkstatt.html und
// spielstart.html mit Werkstatt(optionen) gestartet.
//
// Optionen (alle freiwillig):
//   teile:    Liste der Teil-IDs im Regal (sonst alle)
//   vorbau:   schon eingebaute Teile, z. B. { rahmen: "bettgestell" }
//   stumm:    keine Begrüßung in der Statuszeile
//   nachher:  wird nach jeder Änderung aufgerufen (für den geführten Einstieg)
window.Werkstatt = function (opt = {}) {
  const R = window.RASTER, G = window.GELIEFERT || {}, FULL = window.TEILE || {};
  const CELL = R.zelle_px;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ALLE_TEILE = [
    { id: "bettgestell", kat: "rahmen", name: "Bettgestell-Rahmen" },
    { id: "rostachse", kat: "achse", name: "Rostige Achse" },
    { id: "schubkarre", kat: "rad", name: "Schubkarrenrad" },
    { id: "autoreifen", kat: "rad", name: "Autoreifen" },
    { id: "traktorreifen", kat: "rad", name: "Traktorreifen" },
    { id: "schneeketten", kat: "rad", name: "Rad mit Schneeketten" },
    { id: "ballonreifen", kat: "rad", name: "Ballonreifen" },
    { id: "kutschenrad", kat: "rad", name: "Kutschenrad" },
    { id: "maeher", kat: "motor", name: "Rasenmäher-Motor" },
    { id: "raketenmotor", kat: "motor", name: "Raketen-Triebwerk" },
    { id: "mopedmotor", kat: "motor", name: "Mopedmotor" },
    { id: "traktormotor", kat: "motor", name: "Traktormotor" },
    { id: "waschmaschinenmotor", kat: "motor", name: "Waschmaschinen-Motor" },
    { id: "giesskanne", kat: "energie", name: "Gießkanne" },
    { id: "kanister", kat: "energie", name: "Benzinkanister" },
    { id: "milchkanne", kat: "energie", name: "Milchkanne" },
    { id: "batterieturm", kat: "energie", name: "Batterie-Turm" },
    { id: "kuechenstuhl", kat: "sitz", name: "Küchenstuhl" },
    { id: "sofasessel", kat: "sitz", name: "Ohrensessel" },
    { id: "traktorsitz", kat: "sitz", name: "Traktorsitz" },
    { id: "rennschale", kat: "sitz", name: "Rennschale" },
    { id: "fahrradlenker", kat: "lenkung", name: "Fahrradlenker" },
    { id: "bus_lenkrad", kat: "lenkung", name: "Bus-Lenkrad" },
    { id: "steuerrad", kat: "lenkung", name: "Schiffs-Steuerrad" },
    { id: "scheinwerfer", kat: "licht", name: "Alter Scheinwerfer" },
    { id: "spezialhupe", kat: "hupe", name: "Spezialhupe" },
    { id: "schlauchboot_hinten", kat: "karosserie_hinten", name: "Schlauchboot hinten" },
    { id: "schlauchboot_mitte", kat: "karosserie_mitte", name: "Schlauchboot Mitte" },
    { id: "schlauchboot_vorne", kat: "karosserie_vorne", name: "Schlauchboot vorne" },
    { id: "zirkus_hinten", kat: "karosserie_hinten", name: "Zirkus hinten" },
    { id: "zirkus_mitte", kat: "karosserie_mitte", name: "Zirkus Mitte" },
    { id: "zirkus_vorne", kat: "karosserie_vorne", name: "Zirkus vorne" },
    { id: "gewaechshaus_hinten", kat: "karosserie_hinten", name: "Gewächshaus hinten" },
    { id: "gewaechshaus_mitte", kat: "karosserie_mitte", name: "Gewächshaus Mitte" },
    { id: "gewaechshaus_vorne", kat: "karosserie_vorne", name: "Gewächshaus vorne" },
    { id: "schneeraupe_hinten", kat: "karosserie_hinten", name: "Schneeraupe hinten" },
    { id: "schneeraupe_mitte", kat: "karosserie_mitte", name: "Schneeraupe Mitte" },
    { id: "schneeraupe_vorne", kat: "karosserie_vorne", name: "Schneeraupe vorne" },
    { id: "geldtransporter_hinten", kat: "karosserie_hinten", name: "Geldtransporter hinten" },
    { id: "geldtransporter_mitte", kat: "karosserie_mitte", name: "Geldtransporter Mitte" },
    { id: "geldtransporter_vorne", kat: "karosserie_vorne", name: "Geldtransporter vorne" },
    { id: "wohnwagen_hinten", kat: "karosserie_hinten", name: "Mini-Wohnwagen hinten" },
    { id: "wohnwagen_mitte", kat: "karosserie_mitte", name: "Mini-Wohnwagen Mitte" },
    { id: "wohnwagen_vorne", kat: "karosserie_vorne", name: "Mini-Wohnwagen vorne" },
    { id: "betonmischer_hinten", kat: "karosserie_hinten", name: "Betonmischer hinten" },
    { id: "betonmischer_mitte", kat: "karosserie_mitte", name: "Betonmischer Mitte" },
    { id: "betonmischer_vorne", kat: "karosserie_vorne", name: "Betonmischer vorne" },
    { id: "feuerwehr_hinten", kat: "karosserie_hinten", name: "Feuerwehr hinten" },
    { id: "feuerwehr_mitte", kat: "karosserie_mitte", name: "Feuerwehr Mitte" },
    { id: "feuerwehr_vorne", kat: "karosserie_vorne", name: "Feuerwehr vorne" },
    { id: "kutsche_hinten", kat: "karosserie_hinten", name: "Kutsche hinten" },
    { id: "kutsche_mitte", kat: "karosserie_mitte", name: "Kutsche Mitte" },
    { id: "kutsche_vorne", kat: "karosserie_vorne", name: "Kutsche vorne" },
    { id: "rakete_hinten", kat: "karosserie_hinten", name: "Rakete hinten" },
    { id: "rakete_mitte", kat: "karosserie_mitte", name: "Rakete Mitte" },
    { id: "rakete_vorne", kat: "karosserie_vorne", name: "Rakete vorne" },
    { id: "heuscheune_hinten", kat: "karosserie_hinten", name: "Heuscheune hinten" },
    { id: "heuscheune_mitte", kat: "karosserie_mitte", name: "Heuscheune Mitte" },
    { id: "heuscheune_vorne", kat: "karosserie_vorne", name: "Heuscheune vorne" },
    { id: "telefonzelle_hinten", kat: "karosserie_hinten", name: "Telefonzelle hinten" },
    { id: "telefonzelle_mitte", kat: "karosserie_mitte", name: "Telefonzelle Mitte" },
    { id: "telefonzelle_vorne", kat: "karosserie_vorne", name: "Telefonzelle vorne" },
    { id: "badewanne_hinten", kat: "karosserie_hinten", name: "Badewanne hinten" },
    { id: "badewanne_mitte", kat: "karosserie_mitte", name: "Badewanne Mitte" },
    { id: "badewanne_vorne", kat: "karosserie_vorne", name: "Badewanne vorne" },
    { id: "pickup_hinten", kat: "karosserie_hinten", name: "Pick-up hinten" },
    { id: "pickup_mitte", kat: "karosserie_mitte", name: "Pick-up Mitte" },
    { id: "pickup_vorne", kat: "karosserie_vorne", name: "Pick-up vorne" },
    { id: "rundling_hinten", kat: "karosserie_hinten", name: "Rundling hinten" },
    { id: "rundling_mitte", kat: "karosserie_mitte", name: "Rundling Mitte" },
    { id: "rundling_vorne", kat: "karosserie_vorne", name: "Rundling vorne" },
    { id: "hotdog_hinten", kat: "karosserie_hinten", name: "Hot-Dog-Wagen hinten" },
    { id: "hotdog_mitte", kat: "karosserie_mitte", name: "Hot-Dog-Wagen Mitte" },
    { id: "hotdog_vorne", kat: "karosserie_vorne", name: "Hot-Dog-Wagen vorne" },
    { id: "eiswagen_hinten", kat: "karosserie_hinten", name: "Eiswagen hinten" },
    { id: "eiswagen_mitte", kat: "karosserie_mitte", name: "Eiswagen Mitte" },
    { id: "eiswagen_vorne", kat: "karosserie_vorne", name: "Eiswagen vorne" },
  ];
  const PARTS = opt.teile ? ALLE_TEILE.filter((p) => opt.teile.includes(p.id)) : ALLE_TEILE;
  // Kategorien im Regal (Vorauswahl)
  const TABS = [
    { id: "rahmen", label: "Grundgestell", kats: ["rahmen"] },
    { id: "achse", label: "Achsen", kats: ["achse"] },
    { id: "rad", label: "Räder", kats: ["rad"] },
    { id: "motor", label: "Motor", kats: ["motor"] },
    { id: "energie", label: "Energie", kats: ["energie"] },
    { id: "sitz", label: "Sitz", kats: ["sitz"] },
    { id: "lenkung", label: "Lenkung", kats: ["lenkung"] },
    { id: "licht", label: "Licht", kats: ["licht"] },
    { id: "hupe", label: "Hupe", kats: ["hupe"] },
    { id: "karosserie", label: "Karosserie", kats: ["karosserie_hinten", "karosserie_mitte", "karosserie_vorne"] },
  ];
  const SLOTS = ["rahmen", "achseH", "achseV", "radH", "radV", "motor", "energie", "sitz", "lenkung", "licht", "hupe",
    "karoH", "karoM", "karoV"];
  const LABEL = { rahmen: "Rahmen", achseH: "Hinterachse", achseV: "Vorderachse", radH: "Hinterräder", radV: "Vorderräder",
    motor: "Motor", energie: "Tank", sitz: "Sitz", lenkung: "Lenkung", licht: "Licht", hupe: "Hupe",
    karoH: "Karosserie hinten", karoM: "Karosserie Mitte", karoV: "Karosserie vorne" };
  const KARO = ["karoH", "karoM", "karoV"];
  // Das muss drin sein, bevor die Karosserie drauf darf (fahrbereit)
  const FAHRBEREIT = ["rahmen", "achseH", "achseV", "radH", "radV", "motor", "energie", "sitz", "lenkung"];
  const kat = (slot) => R.slots[slot].kategorie;

  // Einbaureihenfolge: was muss schon drin sein?
  const NEEDS = { rahmen: null, achseH: "rahmen", achseV: "rahmen", radH: "achseH", radV: "achseV",
    motor: "rahmen", energie: "rahmen", sitz: "rahmen", lenkung: "rahmen", licht: "rahmen", hupe: "rahmen",
    karoH: "fahrbereit", karoM: "fahrbereit", karoV: "fahrbereit" };
  // Was blockiert das Ausbauen?
  const BLOCKS = { achseH: ["radH"], achseV: ["radV"] };

  const state = { view: "seite", mounted: { ...opt.vorbau }, anim: {}, tab: "rahmen", tipp: null, wahl: null, wahlSlot: null };
  let drag = null;          // laufendes Ziehen: { partId, kat, fromSlot, x, y, target, touch }
  let suppressClick = false; // nach einem Ziehen den folgenden Klick verschlucken

  // Bilder laden
  const IMG = {};
  for (const p of ALLE_TEILE) for (const v of ["seite", "oben"]) {
    const src = FULL[`${p.id}_${v}`] || (G[`${p.id}_${v}`] && G[`${p.id}_${v}`].bild);
    if (!src) continue;
    const im = new Image(); im.src = src; IMG[`${p.id}_${v}`] = im;
  }
  // Anbauteile (z. B. Räumschild der Schneeraupe) kommen mit ihrem Teil automatisch mit
  const ANBAU = Object.fromEntries(Object.entries(R.anbauten || {}).filter(([k]) => !k.startsWith("_")));
  for (const a of Object.values(ANBAU)) for (const v of ["seite", "oben"]) {
    const src = FULL[`${a.teil}_${v}`];
    if (src) { const im = new Image(); im.src = src; IMG[`${a.teil}_${v}`] = im; }
  }

  const $ = (id) => document.getElementById(id);
  // Hintergrund: eigenes Hallenbild, sonst Opas Schuppen
  const HG = (window.KARTE_DATEN && window.KARTE_DATEN.hintergruende) || {};
  const halle = $("stage").closest(".halle");
  if (halle && (HG.halle || HG.werkstatt)) halle.style.setProperty("--halle-bild", `url(${HG.halle || HG.werkstatt})`);
  // Das Hallenbild hat eine gemalte Hebebühne: Lage im Bild (Anteile an Breite und Höhe),
  // links und rechts die Kante mit den Warnstreifen, boden = Höhe, auf der die Räder stehen
  const BUEHNE = { x0: 0.264, x1: 0.730, boden: 0.792 };
  let HALLE = null;
  if (HG.halle) { HALLE = new Image(); HALLE.src = HG.halle; }
  const halleBereit = () => HALLE && HALLE.complete && HALLE.naturalWidth;
  // Bild so groß, dass die Bühne gut 85 % der Breite füllt und unten im Bild steht
  function hallePlatz(w, h) {
    const iw = HALLE.naturalWidth, ih = HALLE.naturalHeight;
    const k = Math.max(w / iw, h / ih, (0.92 * w) / (iw * (BUEHNE.x1 - BUEHNE.x0)));
    const dx = Math.min(0, Math.max(w - iw * k, w / 2 - iw * k * (BUEHNE.x0 + BUEHNE.x1) / 2));
    const dy = Math.min(0, Math.max(h - ih * k, h * 0.84 - ih * k * BUEHNE.boden));
    return { k, dx, dy, iw, ih };
  }
  function say(text, kind) {
    const s = $("status"); s.textContent = text; s.className = kind || "";
  }

  // --- Regeln ---------------------------------------------------------------
  function missing(slot) {
    const need = NEEDS[slot];
    if (need === "fahrbereit") {
      const fehlt = FAHRBEREIT.filter((s) => !state.mounted[s]);
      if (!fehlt.length) return null;
      if (!state.mounted.rahmen) return "Die Karosserie kommt ganz zum Schluss. Leg zuerst einen Rahmen auf die Hebebühne.";
      return `Die Karosserie kommt ganz zum Schluss. Es fehlt noch: ${fehlt.map((s) => LABEL[s]).join(", ")}.`;
    }
    if (!need || state.mounted[need]) return null;
    // Bis zum ersten fehlenden Schritt zurückgehen (Rad -> Achse -> Rahmen)
    const earlier = missing(need);
    if (earlier) return earlier;
    if (need === "rahmen") return "Leg zuerst einen Rahmen auf die Hebebühne.";
    return `Für die ${LABEL[slot]} brauchst du zuerst die ${LABEL[need]}.`;
  }

  function mountPart(part) {
    const free = SLOTS.filter((s) => kat(s) === part.kat && !state.mounted[s]);
    if (!free.length) {
      // Belegt mit einem anderen Teil derselben Kategorie: tauschen
      const other = SLOTS.find((s) => kat(s) === part.kat && state.mounted[s] !== part.id);
      if (!other) return say(`${part.name}: Alle passenden Plätze sind schon belegt.`, "warn");
      const why = removeBlocked(other);
      if (why) return say(why, "warn");
      const alt = PARTS.find((p) => p.id === state.mounted[other]).name;
      state.mounted[other] = part.id;
      state.anim[other] = performance.now();
      say(`${alt} gegen ${part.name} getauscht.`);
      return refresh();
    }
    const slot = free.find((s) => !missing(s));
    if (!slot) return say(missing(free[0]), "warn");
    if (part.kat === "achse" && state.view !== "oben") {
      setView("oben");
      say("Achsen baust du von oben ein, da sieht man sie. Ich habe auf die Draufsicht umgeschaltet.");
      mountAt(slot, part.id, true);
    } else {
      mountAt(slot, part.id);
    }
  }

  function mountAt(slot, partId, quiet) {
    state.mounted[slot] = partId;
    state.anim[slot] = performance.now();
    if (!quiet) say(`${PARTS.find((p) => p.id === partId).name} eingebaut: ${LABEL[slot]}.`);
    nextTab();
    refresh();
  }

  // Ist die aktuelle Kategorie fertig, zur nächsten springen, in der jetzt etwas geht
  function nextTab() {
    const cur = TABS.find((t) => t.id === state.tab);
    const offen = (t) => SLOTS.some((sl) => t.kats.includes(kat(sl)) && !state.mounted[sl] && !missing(sl)) &&
      PARTS.some((p) => t.kats.includes(p.kat));
    if (offen(cur)) return;
    const next = TABS.find(offen);
    if (next) state.tab = next.id;
  }

  // Darf dieser Platz ausgebaut werden? Gibt den Grund zurück, falls nicht.
  function removeBlocked(slot) {
    if (!KARO.includes(slot) && slot !== "licht" && slot !== "hupe" && KARO.some((s) => state.mounted[s])) {
      return "Erst die Karosserie abnehmen, dann kommst du an die Teile darunter.";
    }
    if (slot === "rahmen" && SLOTS.some((s) => s !== "rahmen" && state.mounted[s])) {
      return "Den Rahmen kannst du erst abnehmen, wenn alle anderen Teile ab sind.";
    }
    const blocked = (BLOCKS[slot] || []).find((b) => state.mounted[b]);
    return blocked ? `Erst die ${LABEL[blocked]} abnehmen, dann kommst du an die ${LABEL[slot]}.` : null;
  }

  function unmount(slot) {
    const why = removeBlocked(slot);
    if (why) return say(why, "warn");
    const name = PARTS.find((p) => p.id === state.mounted[slot]).name;
    delete state.mounted[slot];
    state.wahlSlot = null;
    say(`${name} ausgebaut.`);
    refresh();
  }

  // --- Geometrie ------------------------------------------------------------
  function layout(w, h) {
    const g = R[state.view];
    if (state.view === "seite" && halleBereit()) {
      // Auto auf die gemalte Bühne stellen
      const P = hallePlatz(w, h);
      const pw = (BUEHNE.x1 - BUEHNE.x0) * P.iw * P.k, boden = P.dy + BUEHNE.boden * P.ih * P.k;
      const s = Math.min((pw * 1.1) / (g.breite * CELL), (boden * 0.97) / (R.seite.boden * CELL));
      const cell = CELL * s;
      const mitte = P.dx + ((BUEHNE.x0 + BUEHNE.x1) / 2) * P.iw * P.k;
      return { s, ox: mitte - (g.breite * cell) / 2, oy: boden - R.seite.boden * cell, cell };
    }
    const s = Math.min((w * 0.94) / (g.breite * CELL), (h * (state.view === "seite" ? 0.8 : 0.84)) / (g.hoehe * CELL));
    const cw = g.breite * CELL * s, ch = g.hoehe * CELL * s;
    const ox = (w - cw) / 2;
    const oy = state.view === "seite" ? h * 0.9 - ch : (h - ch) / 2;
    return { s, ox, oy, cell: CELL * s };
  }

  // Rechtecke eines Platzes in der aktuellen Ansicht (Räder oben: zwei)
  function rects(slot, L) {
    const [b, hh] = R.kategorien[kat(slot)][state.view];
    const pos = state.view === "seite" ? [R.slots[slot].seite] : R.slots[slot].oben;
    return pos.map(([x, y], i) => ({ x: L.ox + x * L.cell, y: L.oy + y * L.cell, w: b * L.cell, h: hh * L.cell, flip: i === 1 }));
  }

  // In der Seitenansicht ist die Achse hinter dem Rad unsichtbar
  function visible(slot) {
    if (state.view === "seite" && kat(slot) === "achse") return !state.mounted[slot === "achseH" ? "radH" : "radV"];
    return true;
  }

  // --- Zeichnen -------------------------------------------------------------
  // Die Halle selbst ist das Hintergrundbild (CSS). Auf der Bühne: Lichtkegel von oben
  // auf das Auto und die Hebebühne mit Warnstreifen bzw. von oben eine Drehscheibe.
  function drawWorkshop(ctx, w, h, L) {
    ctx.clearRect(0, 0, w, h);
    const g = R[state.view];
    const mx = L.ox + (g.breite * L.cell) / 2;
    if (halleBereit()) {
      const P = hallePlatz(w, h);
      ctx.drawImage(HALLE, P.dx, P.dy, P.iw * P.k, P.ih * P.k);
      if (state.view === "seite") return; // Licht und Bühne sind schon im Bild
      ctx.fillStyle = "rgba(10,14,16,0.62)"; ctx.fillRect(0, 0, w, h);
    }
    if (state.view === "seite") {
      const floor = L.oy + R.seite.boden * L.cell, breit = g.breite * L.cell;
      // Lichtkegel
      const kegel = ctx.createLinearGradient(0, 0, 0, floor);
      kegel.addColorStop(0, "rgba(255,236,180,0.0)"); kegel.addColorStop(1, "rgba(255,236,180,0.16)");
      ctx.fillStyle = kegel;
      ctx.beginPath(); ctx.moveTo(mx - breit * 0.12, 0); ctx.lineTo(mx + breit * 0.12, 0);
      ctx.lineTo(mx + breit * 0.62, floor); ctx.lineTo(mx - breit * 0.62, floor); ctx.closePath(); ctx.fill();
      // Lichtfleck auf dem Boden
      const fleck = ctx.createRadialGradient(mx, floor, 0, mx, floor, breit * 0.7);
      fleck.addColorStop(0, "rgba(255,230,160,0.45)"); fleck.addColorStop(1, "rgba(255,230,160,0)");
      ctx.fillStyle = fleck;
      ctx.beginPath(); ctx.ellipse(mx, floor + L.cell * 0.15, breit * 0.7, L.cell * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      // Hebebühne: Platte mit Warnstreifen
      const px = mx - breit * 0.58, pw = breit * 1.16, ph = Math.max(8, L.cell * 0.16);
      ctx.fillStyle = "#1d2428"; ctx.beginPath(); ctx.roundRect(px, floor, pw, ph, 3); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.rect(px, floor, pw, ph * 0.6); ctx.clip();
      ctx.fillStyle = "#f2b632";
      for (let x = px - ph; x < px + pw; x += ph * 2.4) {
        ctx.beginPath(); ctx.moveTo(x, floor + ph); ctx.lineTo(x + ph, floor); ctx.lineTo(x + ph * 2.2, floor); ctx.lineTo(x + ph * 1.2, floor + ph); ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = "#3a464c";
      for (const sx of [px + pw * 0.12, px + pw * 0.88]) ctx.fillRect(sx - ph * 0.4, floor + ph, ph * 0.8, h - floor - ph);
    } else {
      const ry = L.oy + (g.hoehe * L.cell) / 2, r = Math.max(g.breite, g.hoehe) * L.cell * 0.62;
      const fleck = ctx.createRadialGradient(mx, ry, r * 0.2, mx, ry, r * 1.15);
      fleck.addColorStop(0, "rgba(255,230,160,0.28)"); fleck.addColorStop(1, "rgba(255,230,160,0)");
      ctx.fillStyle = fleck; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(20,28,32,0.75)"; ctx.strokeStyle = "#f2b632"; ctx.lineWidth = 3; ctx.setLineDash([14, 10]);
      ctx.beginPath(); ctx.ellipse(mx, ry, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // Gewähltes Teil auf der Bühne mit einem pulsierenden Rahmen zeigen
  function drawWahl(ctx, L, t) {
    if (!state.wahl || drag) return;
    const puls = 0.55 + 0.45 * Math.sin(t * 5);
    for (const sl of SLOTS) {
      if (state.mounted[sl] !== state.wahl || !visible(sl)) continue;
      if (state.wahlSlot && state.mounted[state.wahlSlot] === state.wahl && sl !== state.wahlSlot) continue;
      for (const r of rects(sl, L)) {
        ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(242,182,50,${puls})`;
        ctx.shadowColor = "rgba(242,182,50,0.8)"; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.roundRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 10); ctx.stroke(); ctx.restore();
      }
    }
  }

  // Leere Plätze nur zeigen, wenn sie sinnvoll sind
  function hintShown(slot) {
    if (state.view === "seite" && kat(slot) === "achse") return false;
    if (drag) return kat(slot) === drag.kat;
    if (KARO.includes(slot)) return !missing(slot);
    return true;
  }

  function drawSlotHint(ctx, slot, L, t) {
    if (!hintShown(slot)) return;
    // Beim Ziehen nur die Plätze zeigen, auf die das gezogene Teil passt
    if (drag && kat(slot) !== drag.kat) return;
    const ok = !missing(slot);
    if (drag && drag.target === slot) {
      for (const r of rects(slot, L)) {
        ctx.fillStyle = "rgba(242,182,50,0.35)";
        ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6, 8); ctx.fill();
      }
    }
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    for (const r of rects(slot, L)) {
      ctx.save();
      ctx.setLineDash([7, 6]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = ok ? `rgba(242,182,50,${0.55 + pulse * 0.45})` : "rgba(233,239,230,0.18)";
      ctx.fillStyle = ok ? "rgba(242,182,50,0.06)" : "rgba(0,0,0,0)";
      ctx.beginPath(); ctx.roundRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6, 8); ctx.fill(); ctx.stroke();
      ctx.restore();
      if (r.flip) continue;
      ctx.fillStyle = ok ? "#f2b632" : "rgba(233,239,230,0.35)";
      ctx.font = `800 ${Math.max(10, Math.min(14, L.cell * 0.16))}px Nunito, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(LABEL[slot], r.x + r.w / 2, r.y + r.h / 2);
    }
  }

  function drawPart(ctx, slot, L, now) {
    const img = IMG[`${state.mounted[slot]}_${state.view}`];
    if (!img || !img.complete) return;
    const t0 = state.anim[slot];
    let k = 1;
    if (t0 && !reduce) k = Math.max(0, Math.min(1, (now - t0) / 380));
    const ease = 1 - Math.pow(1 - k, 3);
    const drop = (1 - ease) * L.cell * 1.2;
    const anbau = ANBAU[state.mounted[slot]];
    const aImg = anbau && IMG[`${anbau.teil}_${state.view}`];
    if (aImg && aImg.complete) {
      const [ax, ay, aw, ah] = anbau[state.view];
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.7 * ease;
      ctx.drawImage(aImg, L.ox + ax * L.cell, L.oy + ay * L.cell - drop, aw * L.cell, ah * L.cell);
      ctx.restore();
    }
    for (const r of rects(slot, L)) {
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.7 * ease;
      if (r.flip && kat(slot) === "rad") {
        ctx.translate(r.x, r.y + r.h - drop); ctx.scale(1, -1); ctx.drawImage(img, 0, 0, r.w, r.h);
      } else {
        ctx.drawImage(img, r.x, r.y - drop, r.w, r.h);
      }
      ctx.restore();
    }
  }

  function render(now) {
    const c = $("stage");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const L = layout(w, h);
    drawWorkshop(ctx, w, h, L);
    const order = R["reihenfolge_" + state.view].filter((s) => SLOTS.includes(s));
    for (const slot of order) {
      const inHand = drag && drag.fromSlot === slot;
      if (state.mounted[slot] && !inHand) { if (visible(slot)) drawPart(ctx, slot, L, now); }
      else drawSlotHint(ctx, slot, L, now / 1000);
    }
    drawWahl(ctx, L, now / 1000);
    requestAnimationFrame(render);
  }

  // --- Antippen und Ziehen ------------------------------------------------------
  function stagePoint(clientX, clientY) {
    const b = $("stage").getBoundingClientRect();
    return { x: clientX - b.left, y: clientY - b.top, inside: clientX >= b.left && clientX <= b.right && clientY >= b.top && clientY <= b.bottom, w: b.width, h: b.height };
  }

  // Oberstes sichtbares Teil (oder leerer Platz) unter einem Punkt der Bühne
  function hitSlot(pt) {
    const L = layout(pt.w, pt.h);
    const order = R["reihenfolge_" + state.view].filter((sl) => SLOTS.includes(sl)).reverse();
    const inside = (sl) => rects(sl, L).some((r) => pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.h);
    // Eingebaute Teile haben Vorrang vor leeren Plätzen
    return order.find((sl) => state.mounted[sl] && visible(sl) && inside(sl)) ||
      order.find((sl) => !state.mounted[sl] && hintShown(sl) && inside(sl));
  }

  function tapStage(clientX, clientY) {
    const slot = hitSlot(stagePoint(clientX, clientY));
    if (!slot) { if (state.wahl) { state.wahl = null; refresh(); } return; }
    state.tab = TABS.find((t) => t.kats.includes(kat(slot))).id;
    if (state.mounted[slot]) {
      // eingebautes Teil: auswählen, dann zeigt das Info-Feld „Ausbauen“
      state.wahl = state.mounted[slot]; state.wahlSlot = slot;
      return refresh();
    }
    state.wahl = null;
    const why = missing(slot);
    if (why) say(why, "warn");
    else say(`${LABEL[slot]}: such dir rechts ein Teil aus.`);
    refresh();
  }

  // Nächster passender Platz zum Finger (innerhalb einer knappen Zelle)
  function findTarget(d) {
    const pt = stagePoint(d.x, d.y - (d.touch ? 40 : 0));
    if (!pt.inside) return { over: false, slot: null, near: null };
    const L = layout(pt.w, pt.h);
    let best = null, bestD = L.cell * 0.9;
    for (const sl of SLOTS) {
      if (kat(sl) !== d.kat || (state.mounted[sl] && sl !== d.fromSlot)) continue;
      if (state.view === "seite" && kat(sl) === "achse") continue;
      for (const r of rects(sl, L)) {
        const dx = Math.max(r.x - pt.x, 0, pt.x - (r.x + r.w)), dy = Math.max(r.y - pt.y, 0, pt.y - (r.y + r.h));
        const d = Math.hypot(dx, dy);
        if (d < bestD) { bestD = d; best = sl; }
      }
    }
    return { over: true, slot: best && !missing(best) ? best : null, near: best };
  }

  function drawGhost() {
    const g = $("ghost"), img = IMG[`${drag.partId}_${state.view}`];
    const b = $("stage").getBoundingClientRect();
    const L = layout(b.width, b.height);
    const [bw, bh] = R.kategorien[drag.kat][state.view];
    const w = bw * L.cell, h = bh * L.cell, dpr = Math.min(window.devicePixelRatio || 1, 2);
    g.width = Math.round(w * dpr); g.height = Math.round(h * dpr);
    g.style.width = w + "px"; g.style.height = h + "px";
    const ctx = g.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (img && img.complete) ctx.drawImage(img, 0, 0, w, h);
    drag.gw = w; drag.gh = h;
    g.hidden = false;
  }

  function moveDrag(x, y) {
    drag.x = x; drag.y = y;
    const lift = drag.touch ? 40 : 0;
    $("ghost").style.transform = `translate(${x - drag.gw / 2}px, ${y - lift - drag.gh / 2}px)`;
    drag.target = findTarget(drag).slot;
  }

  function startDrag(press) {
    const part = PARTS.find((p) => p.id === press.partId);
    if (press.fromSlot) {
      const why = removeBlocked(press.fromSlot);
      if (why) { say(why, "warn"); return false; }
    }
    drag = { partId: part.id, kat: part.kat, fromSlot: press.fromSlot || null, touch: press.touch, x: press.x, y: press.y, target: null };
    if (part.kat === "achse" && state.view !== "oben") {
      setView("oben");
      say("Achsen baust du von oben ein. Ich habe auf die Draufsicht umgeschaltet.");
    } else {
      say(press.fromSlot ? `${part.name} abnehmen: auf einen anderen Platz oder von der Bühne ziehen.` : `${part.name}: auf einen gelben Platz ziehen.`);
    }
    document.body.classList.add("dragging");
    drawGhost();
    moveDrag(press.x, press.y);
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch { /* egal */ } }
    return true;
  }

  function endDrag(cancelled) {
    const d = drag;
    drag = null;
    $("ghost").hidden = true;
    document.body.classList.remove("dragging");
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    if (cancelled || !d) return;
    const name = PARTS.find((p) => p.id === d.partId).name;
    const res = findTarget(d);
    if (res.slot) {
      if (d.fromSlot) delete state.mounted[d.fromSlot];
      return mountAt(res.slot, d.partId);
    }
    if (d.fromSlot) {
      // Von der Bühne gezogen und nicht auf einen passenden Platz: zurück ins Regal
      delete state.mounted[d.fromSlot];
      say(`${name} ausgebaut.`);
      return refresh();
    }
    if (res.over) say(res.near ? missing(res.near) || `${name} passt hier nicht hin.` : `${name} passt hier nicht hin.`, "warn");
  }

  // Ein Druck auf Regal-Karte oder Bühne: wird Tipp oder (nach Bewegung bzw. Halten) Ziehen
  let press = null;
  function beginPress(e, info) {
    if (e.button && e.button !== 0) return;
    const touch = e.pointerType === "touch", halten = touch || info.halten;
    press = { ...info, id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, touch, halten, ready: !halten };
    // Finger (und Teile im Band): erst nach kurzem Halten ziehen, damit Wischen weiter wischt
    if (halten) press.timer = setTimeout(() => { if (press) { press.ready = true; startDrag(press) || (press = null); } }, 260);
  }
  window.addEventListener("pointermove", (e) => {
    if (drag) { moveDrag(e.clientX, e.clientY); return; }
    if (!press || e.pointerId !== press.id) return;
    press.x = e.clientX; press.y = e.clientY;
    const moved = Math.hypot(e.clientX - press.sx, e.clientY - press.sy);
    if (press.halten && !press.ready && moved > 10) { clearTimeout(press.timer); press = null; return; }
    if (!press.halten && moved > 5) { if (!startDrag(press)) press = null; }
  });
  window.addEventListener("pointerup", (e) => {
    if (press) clearTimeout(press.timer);
    if (drag) { endDrag(false); press = null; return; }
    press = null;
  });
  window.addEventListener("pointercancel", () => { if (press) clearTimeout(press.timer); press = null; if (drag) endDrag(true); });
  // Während des Ziehens darf die Seite nicht scrollen
  document.addEventListener("touchmove", (e) => { if (drag) e.preventDefault(); }, { passive: false });
  document.addEventListener("contextmenu", (e) => { if (press || drag) e.preventDefault(); });

  $("stage").addEventListener("pointerdown", (e) => {
    const slot = hitSlot(stagePoint(e.clientX, e.clientY));
    if (slot && state.mounted[slot]) beginPress(e, { partId: state.mounted[slot], fromSlot: slot });
  });
  $("stage").addEventListener("click", (e) => {
    if (suppressClick) return;
    tapStage(e.clientX, e.clientY);
  });

  // --- Kategorien, Teile, Info ------------------------------------------------
  const TW = window.TEILWERTE || {};
  // [Schlüssel, Name, Einheit, Wert für einen vollen Balken]
  const WERTE = [["tempo", "Tempo", "km/h", 120], ["kraft", "Steigung", "°", 40], ["reichweite", "Reichweite", "m", 1500],
    ["grip", "Grip", "", 10], ["wendig", "Lenkung", "", 10], ["komfort", "Komfort", "", 10], ["robust", "Robustheit", "", 10],
    ["licht", "Licht", "m", 30], ["laut", "Lautstärke", "", 10], ["gewicht", "Gewicht", "kg", 300]];
  const AUTO_WERTE = ["tempo", "kraft", "reichweite", "grip", "wendig", "gewicht"];
  const zahl = (v) => v.toLocaleString("de-DE");
  const wert = (id, k) => (TW[id] || {})[k];

  // Werte des ganzen Autos aus den eingebauten Teilen
  function autoWerte(m) {
    const w = {}, an = (sl, k) => (m[sl] ? wert(m[sl], k) || 0 : 0);
    w.tempo = an("motor", "tempo"); w.kraft = an("motor", "kraft"); w.reichweite = an("energie", "reichweite");
    w.grip = m.radH && m.radV ? Math.min(an("radH", "grip"), an("radV", "grip")) : 0;
    w.wendig = an("lenkung", "wendig"); w.komfort = an("sitz", "komfort"); w.licht = an("licht", "licht"); w.laut = an("hupe", "laut");
    const tragend = ["rahmen", "achseH", "achseV", ...KARO].filter((sl) => m[sl]);
    w.robust = tragend.length ? Math.round(tragend.reduce((n, sl) => n + an(sl, "robust"), 0) / tragend.length) : 0;
    // Räder sind Paare: zwei Räder je Platz
    w.gewicht = SLOTS.reduce((n, sl) => n + an(sl, "gewicht") * (kat(sl) === "rad" ? 2 : 1), 0);
    const karo = KARO.map((sl) => m[sl]);
    if (karo.every(Boolean) && new Set(karo.map((id) => id.split("_")[0])).size === 1 && karo[0].startsWith("rakete")) {
      w.tempo = Math.round(w.tempo * 1.2);
    }
    return w;
  }

  // Wie sähe das Auto aus, wenn dieses Teil eingebaut würde? (null: geht gerade nicht)
  function probeEinbau(part) {
    const slots = SLOTS.filter((sl) => kat(sl) === part.kat);
    const frei = slots.find((sl) => !state.mounted[sl] && !missing(sl));
    const tausch = slots.find((sl) => state.mounted[sl] && state.mounted[sl] !== part.id && !removeBlocked(sl));
    const sl = frei || (!slots.some((x) => !state.mounted[x]) && tausch);
    return sl ? { ...state.mounted, [sl]: part.id } : null;
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function bildVon(id) {
    const key = `${id}_seite`;
    return FULL[key] || (G[key] && G[key].bild) || "";
  }

  // Band zum Durchwischen: ein Kästchen vorne groß, die anderen kleiner und dunkler
  // dahinter. Wischen, Mausrad, Pfeiltasten oder ein hinteres Kästchen antippen holt
  // es nach vorne; ein Tipp auf das vordere ruft beimTipp auf.
  function Band(box, o) {
    let pos = 0, vorn = -1, kinder = [], schluessel = null, zug = null, rad = 0, radZeit = 0;
    box.classList.add("band");
    box.tabIndex = 0;
    const achse = () => (o.achse ? o.achse() : "x");
    const abstand = () => (achse() === "x" ? o.abstandX : o.abstandY);
    function zeigen() {
      const ax = achse();
      box.classList.toggle("band-y", ax === "y");
      kinder.forEach((k, i) => {
        const d = i - pos, a = Math.abs(d), m = Math.min(a, 3);
        const v = Math.sign(d) * (Math.min(a, 1) * abstand() + Math.max(0, m - 1) * abstand() * 0.62);
        const sk = 1 - m * 0.14;
        k.style.transform = `translate(-50%, -50%) translate${ax === "x" ? "X" : "Y"}(${v}px) scale(${sk})`;
        k.style.zIndex = String(100 - Math.round(a * 10));
        k.style.filter = a < 0.5 ? "none" : `brightness(${1 - m * 0.2}) saturate(${1 - m * 0.2})`;
        k.style.opacity = a > 3.3 ? "0" : "1";
        k.style.pointerEvents = a > 3.3 ? "none" : "";
        k.classList.toggle("vorn", a < 0.5);
      });
    }
    function gehe(i, melden = true) {
      i = Math.max(0, Math.min(kinder.length - 1, i));
      pos = i; zeigen();
      if (i !== vorn) { vorn = i; if (melden && o.beiWahl) o.beiWahl(i); }
    }
    box.addEventListener("pointerdown", (e) => {
      if (e.button && e.button !== 0) return;
      const ziel = e.target.closest(".band-k");
      zug = { start: achse() === "x" ? e.clientX : e.clientY, pos0: pos, ziel: ziel ? kinder.indexOf(ziel) : -1, weit: false,
        spur: [[performance.now(), pos]] };
    });
    window.addEventListener("pointermove", (e) => {
      if (!zug) return;
      if (drag) { zug = null; box.classList.remove("zieht"); return; }
      const delta = (achse() === "x" ? e.clientX : e.clientY) - zug.start;
      if (!zug.weit && Math.abs(delta) < 8) return;
      zug.weit = true; box.classList.add("zieht");
      pos = Math.max(-0.4, Math.min(kinder.length - 0.6, zug.pos0 - delta / abstand()));
      zug.spur.push([performance.now(), pos]); if (zug.spur.length > 6) zug.spur.shift();
      zeigen();
    });
    window.addEventListener("pointerup", () => {
      if (!zug) return;
      const z = zug; zug = null;
      box.classList.remove("zieht");
      if (drag) return;
      if (z.weit) {
        // Schwung: schnelles Wischen läuft noch ein Stück weiter
        const [t0, p0] = z.spur[0], [t1, p1] = z.spur[z.spur.length - 1];
        const v = t1 > t0 ? (p1 - p0) / (t1 - t0) : 0;
        suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
        return gehe(Math.round(pos + v * 100));
      }
      if (z.ziel < 0) return;
      if (z.ziel !== vorn) gehe(z.ziel);
      else if (o.beimTipp) o.beimTipp(z.ziel);
    });
    window.addEventListener("pointercancel", () => { if (zug) { zug = null; box.classList.remove("zieht"); gehe(Math.round(pos)); } });
    box.addEventListener("wheel", (e) => {
      const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (!d || !kinder.length) return;
      e.preventDefault();
      rad += d;
      const jetzt = performance.now();
      if (Math.abs(rad) > 40 && jetzt - radZeit > 140) { gehe(vorn + Math.sign(rad)); rad = 0; radZeit = jetzt; }
    }, { passive: false });
    box.addEventListener("keydown", (e) => {
      const schritt = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
      if (schritt) { e.preventDefault(); gehe(vorn + schritt); }
      if ((e.key === "Enter" || e.key === " ") && o.beimTipp && vorn >= 0) { e.preventDefault(); o.beimTipp(vorn); }
    });
    window.addEventListener("resize", () => zeigen());
    return {
      // Neue Kästchen; wechselt der Schlüssel (andere Kategorie), springt das Band ohne Gleiten
      setze(neu, vorne, schl) {
        const sprung = schl !== schluessel;
        schluessel = schl;
        kinder = neu;
        box.replaceChildren(...neu);
        for (const k of neu) k.classList.add("band-k");
        if (sprung) { box.classList.add("zieht"); vorn = -1; }
        const i = vorne != null && vorne >= 0 ? vorne : sprung ? 0 : Math.min(Math.max(vorn, 0), neu.length - 1);
        vorn = i; pos = i; zeigen();
        if (sprung) requestAnimationFrame(() => box.classList.remove("zieht"));
      },
    };
  }
  const handy = window.matchMedia("(max-width: 860px) and (orientation: portrait)");
  const katBand = Band($("tabs"), {
    achse: () => (handy.matches ? "x" : "y"), abstandX: 112, abstandY: 62,
    beiWahl: (i) => {
      const t = TABS[i];
      state.tab = t.id;
      if (state.wahl && !t.kats.includes(PARTS.find((p) => p.id === state.wahl).kat)) state.wahl = null;
      refresh();
    },
  });
  let angebotJetzt = [];
  const teilBand = Band($("tray"), {
    abstandX: 78,
    beiWahl: (i) => { state.wahl = angebotJetzt[i].id; state.wahlSlot = null; refresh(); },
    beimTipp: (i) => {
      const id = angebotJetzt[i].id;
      state.wahl = state.wahl === id ? null : id; state.wahlSlot = null;
      refresh();
    },
  });

  function refresh() {
    const tab = TABS.find((t) => t.id === state.tab);
    // Kategorien als Kästchen: fertig = ausgegraut mit Haken, fehlt (zum Fahren nötig) = roter Punkt
    const kaesten = [];
    for (const t of TABS) {
      const slotsT = SLOTS.filter((sl) => t.kats.includes(kat(sl)));
      const n = slotsT.filter((sl) => state.mounted[sl]).length;
      const teile = PARTS.filter((p) => t.kats.includes(p.kat));
      const fertig = slotsT.length && n === slotsT.length;
      const fehlt = !fertig && slotsT.some((sl) => FAHRBEREIT.includes(sl) && !state.mounted[sl]);
      const b = el("div", "kat" + (fertig ? " fertig" : "") + (fehlt ? " fehlt" : "") + (teile.length ? "" : " leer"));
      b.role = "tab"; b.id = "tab-" + t.id;
      b.setAttribute("aria-selected", String(t.id === state.tab));
      const drin = slotsT.map((sl) => state.mounted[sl]).find(Boolean);
      const icon = el("img"); icon.alt = ""; icon.draggable = false;
      const quelle = bildVon(drin || (teile[0] || {}).id || "");
      if (quelle) icon.src = quelle; else icon.style.visibility = "hidden";
      const name = el("span", "kat-name", t.label);
      const zahlEl = el("span", "kat-n", fertig ? "✓ fertig" : slotsT.length ? `${n}/${slotsT.length}` : "");
      b.append(icon, name, zahlEl);
      b.setAttribute("aria-label", `${t.label}: ${fertig ? "fertig" : `${n} von ${slotsT.length} eingebaut`}${fehlt ? ", fehlt noch" : ""}`);
      kaesten.push(b);
    }
    katBand.setze(kaesten, TABS.indexOf(tab), "kategorien");

    // Teile der Kategorie
    const angebot = PARTS.filter((p) => tab.kats.includes(p.kat));
    angebotJetzt = angebot;
    const karten = angebot.map((p) => {
      const slots = SLOTS.filter((sl) => kat(sl) === p.kat);
      const mine = slots.filter((sl) => state.mounted[sl] === p.id).length;
      const b = el("div", "part" + (mine ? " in" : "") + (state.wahl === p.id ? " gewaehlt" : "") +
        (state.tipp === p.id && mine < slots.length ? " tipp" : ""));
      b.role = "option";
      b.setAttribute("aria-selected", String(state.wahl === p.id));
      const img = el("img"); img.src = bildVon(p.id); img.alt = ""; img.draggable = false;
      const badge = el("span", "badge", slots.length > 1 ? (mine ? `${mine}/${slots.length}` : "") : mine ? "drin" : "");
      if (!badge.textContent) badge.hidden = true;
      b.append(badge, img, el("span", null, p.name));
      b.addEventListener("pointerdown", (e) => { if (mine < slots.length) beginPress(e, { partId: p.id, halten: true }); });
      return b;
    });
    const gewaehlt = angebot.findIndex((p) => p.id === state.wahl);
    const getippt = angebot.findIndex((p) => p.id === state.tipp);
    teilBand.setze(karten, gewaehlt >= 0 ? gewaehlt : getippt >= 0 ? getippt : null, tab.id);
    if (!angebot.length) $("tray").append(el("p", "empty", "Noch keine Teile in dieser Kategorie. Sie kommen später über die Karte und Aufträge."));
    $("tray").classList.toggle("leer", !angebot.length);

    infoZeigen();
    werteZeigen();

    const checks = $("checks");
    if (checks) {
      checks.innerHTML = "";
      const list = [["Rahmen", ["rahmen"]], ["Achsen", ["achseH", "achseV"]], ["Räder", ["radH", "radV"]],
        ["Motor", ["motor"]], ["Tank", ["energie"]], ["Sitz", ["sitz"]], ["Lenkung", ["lenkung"]]];
      for (const [label, slots] of list) {
        const ok = slots.every((s) => state.mounted[s]);
        checks.append(el("span", "check" + (ok ? " ok" : ""), (ok ? "✓ " : "") + label));
      }
    }
    const karo = KARO.map((sl) => state.mounted[sl]);
    if (FAHRBEREIT.every((s) => state.mounted[s]) && !karo.some(Boolean) && !opt.stumm && !state.wahl) {
      say("Fahrbereit! Jetzt kann die Karosserie drauf: links unter „Karosserie“.", "ok");
    }
    if (opt.nachher) opt.nachher();
  }

  // Info über das gewählte Teil, mit Einbauen/Tauschen, Ausbauen und Abbrechen
  function infoZeigen() {
    const box = $("info");
    if (!box) return;
    box.innerHTML = "";
    const p = PARTS.find((q) => q.id === state.wahl);
    if (!p) {
      const tab = TABS.find((t) => t.id === state.tab);
      box.append(el("p", "info-leer", `Wisch durch die Teile und tipp das vordere an, dann siehst du hier alles darüber. Kategorie: ${tab.label}.`));
      box.classList.remove("voll");
      return;
    }
    box.classList.add("voll");
    const tw = TW[p.id] || {};
    const slots = SLOTS.filter((sl) => kat(sl) === p.kat);
    const mine = slots.filter((sl) => state.mounted[sl] === p.id);
    const frei = slots.filter((sl) => !state.mounted[sl]);
    const fremd = slots.filter((sl) => state.mounted[sl] && state.mounted[sl] !== p.id);

    const bild = el("div", "info-bild"); const img = el("img"); img.src = bildVon(p.id); img.alt = ""; bild.append(img);
    const ort = mine.length ? "eingebaut: " + mine.map((sl) => LABEL[sl]).join(", ") : "im Regal";
    box.append(bild, el("p", "info-kat", `${TABS.find((t) => t.kats.includes(p.kat)).label} · ${ort}`), el("h3", null, p.name));
    if (tw.text) box.append(el("p", "info-text", tw.text));
    const dl = el("dl", "info-werte");
    for (const [k, name, einheit, voll] of WERTE) {
      if (tw[k] == null) continue;
      const pro = k === "gewicht" && p.kat === "rad" ? " je Rad" : "";
      const zeile = el("div");
      const balken = el("span", "balken"); const f = el("i"); f.style.width = Math.min(100, (tw[k] / voll) * 100) + "%"; balken.append(f);
      zeile.append(el("dt", null, name), balken, el("dd", null, `${zahl(tw[k])}${einheit ? " " + einheit : ""}${pro}`));
      dl.append(zeile);
    }
    box.append(dl);
    if (tw.extras && tw.extras.length) {
      const ex = el("div", "info-extras");
      for (const x of tw.extras) ex.append(el("span", null, x));
      box.append(ex);
    }
    if (tw.satz) box.append(el("p", "info-satz", `Als kompletter Satz: ${tw.satz}`));

    // Knöpfe
    const knoepfe = el("div", "info-knoepfe");
    let grund = null;
    if (frei.length || fremd.length) {
      const tausch = !frei.length;
      const b = el("button", "knopf" + (state.tipp === p.id ? " tipp" : ""), tausch ? "Tauschen" : "Einbauen");
      b.type = "button";
      if (tausch) {
        grund = removeBlocked(fremd[fremd.length - 1]);
      } else if (frei.every((sl) => missing(sl))) {
        grund = missing(frei[0]);
      }
      b.disabled = Boolean(grund);
      b.onclick = () => einbauen(p);
      knoepfe.append(b);
    }
    if (mine.length) {
      const sl = mine.includes(state.wahlSlot) ? state.wahlSlot : mine[mine.length - 1];
      const b = el("button", "knopf zweit", "Ausbauen");
      b.type = "button";
      const warum = removeBlocked(sl);
      b.disabled = Boolean(warum);
      if (warum && !grund) grund = warum;
      b.onclick = () => { unmount(sl); };
      knoepfe.append(b);
    }
    const ab = el("button", "knopf leise", "Abbrechen");
    ab.type = "button";
    ab.onclick = () => { state.wahl = null; state.wahlSlot = null; refresh(); };
    knoepfe.append(ab);
    if (grund) box.append(el("p", "info-warn", grund));
    box.append(knoepfe);
  }

  function einbauen(p) {
    mountPart(p);
    // Noch ein Platz frei (z. B. das zweite Rad)? Dann bleibt das Teil gewählt.
    const nochFrei = SLOTS.some((sl) => kat(sl) === p.kat && !state.mounted[sl]);
    if (!nochFrei || !PARTS.some((q) => q.id === p.id)) state.wahl = null;
    refresh();
  }

  // Werte des Autos; ist ein Teil gewählt, zeigt der Pfeil, was sich durch Einbauen ändert
  function werteZeigen() {
    const box = $("werte");
    if (!box) return;
    box.innerHTML = "";
    const jetzt = autoWerte(state.mounted);
    const p = PARTS.find((q) => q.id === state.wahl);
    const mitTeil = p && probeEinbau(p);
    const dann = mitTeil && autoWerte(mitTeil);
    for (const k of AUTO_WERTE) {
      const [, name, einheit] = WERTE.find((w) => w[0] === k);
      const z = el("div", "wert");
      z.append(el("span", "wert-name", name), el("strong", null, `${zahl(jetzt[k])}${einheit ? " " + einheit : ""}`));
      if (dann && dann[k] !== jetzt[k]) {
        const d = dann[k] - jetzt[k];
        const besser = k === "gewicht" ? d < 0 : d > 0;
        z.append(el("span", "wert-neu " + (besser ? "plus" : "minus"), `${d > 0 ? "▲" : "▼"} ${zahl(dann[k])}`));
      }
      box.append(z);
    }
  }

  // Welches Auto darf auf die Karte? "ohne" (keine Karosserie), die Modell-ID
  // (kompletter Satz) oder null (nicht fahrbereit oder Karosserie gemischt/unvollständig)
  function fahrzeug() {
    if (FAHRBEREIT.some((s) => !state.mounted[s])) return null;
    const karo = KARO.map((sl) => state.mounted[sl]);
    if (!karo.some(Boolean)) return "ohne";
    if (!karo.every(Boolean)) return null;
    const modelle = new Set(karo.map((id) => id.split("_")[0]));
    return modelle.size === 1 ? [...modelle][0] : null;
  }

  function setView(v) {
    state.view = v;
    $("view-seite").setAttribute("aria-pressed", String(v === "seite"));
    $("view-oben").setAttribute("aria-pressed", String(v === "oben"));
    refresh();
  }
  $("view-seite").onclick = () => setView("seite");
  $("view-oben").onclick = () => setView("oben");
  if ($("btn-clear")) $("btn-clear").onclick = () => {
    state.mounted = {}; state.tab = "rahmen";
    say("Alles abgebaut. Leg zuerst den Rahmen auf die Hebebühne."); refresh();
  };
  if ($("btn-all")) $("btn-all").onclick = () => {
    const order = FAHRBEREIT;
    const now = performance.now();
    state.tab = "karosserie";
    order.forEach((slot, i) => {
      if (state.mounted[slot]) return;
      state.mounted[slot] = PARTS.find((p) => p.kat === kat(slot)).id;
      state.anim[slot] = now + i * 140;
    });
    refresh();
  };

  if (!opt.stumm) say("Leg zuerst den Rahmen auf die Hebebühne: im Regal den Bettgestell-Rahmen antippen oder auf die Bühne ziehen.");
  refresh();
  requestAnimationFrame(render);

  return {
    state, say, refresh, setView, fahrzeug,
    fahrbereit: () => FAHRBEREIT.every((s) => state.mounted[s]),
    // Teil im Regal hervorheben und seine Kategorie öffnen (null: keins)
    tipp(id) {
      state.tipp = id;
      const p = PARTS.find((q) => q.id === id);
      if (p) state.tab = TABS.find((t) => t.kats.includes(p.kat)).id;
      refresh();
    },
    // Neues Teil ins Regal legen (gekauft oder als Belohnung)
    neuesTeil(id) {
      const p = ALLE_TEILE.find((q) => q.id === id);
      if (p && !PARTS.includes(p)) PARTS.push(p);
      refresh();
    },
    // Alles Fahrnötige einbauen (zum Testen: Einstieg überspringen)
    zusammenbauen() {
      for (const slot of FAHRBEREIT) if (!state.mounted[slot]) state.mounted[slot] = PARTS.find((p) => p.kat === kat(slot)).id;
      refresh();
    },
  };
};
