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
    { id: "maeher", kat: "motor", name: "Rasenmäher-Motor" },
    { id: "raketenmotor", kat: "motor", name: "Raketen-Triebwerk" },
    { id: "mopedmotor", kat: "motor", name: "Mopedmotor" },
    { id: "traktormotor", kat: "motor", name: "Traktormotor" },
    { id: "giesskanne", kat: "energie", name: "Gießkanne" },
    { id: "kuechenstuhl", kat: "sitz", name: "Küchenstuhl" },
    { id: "fahrradlenker", kat: "lenkung", name: "Fahrradlenker" },
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

  const state = { view: "seite", mounted: { ...opt.vorbau }, anim: {}, tab: "rahmen", tipp: null };
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
    say(`${name} ausgebaut.`);
    refresh();
  }

  // --- Geometrie ------------------------------------------------------------
  function layout(w, h) {
    const g = R[state.view];
    const s = Math.min((w * 0.86) / (g.breite * CELL), (h * (state.view === "seite" ? 0.78 : 0.82)) / (g.hoehe * CELL));
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
  function drawWorkshop(ctx, w, h, L) {
    ctx.fillStyle = "#1b3138"; ctx.fillRect(0, 0, w, h);
    if (state.view === "seite") {
      ctx.fillStyle = "#24414a";
      for (let y = 14; y < h * 0.9; y += 22) for (let x = 14 + ((y / 22) % 2) * 11; x < w; x += 22) {
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      }
      const floor = L.oy + R.seite.boden * L.cell;
      ctx.fillStyle = "#14252b"; ctx.fillRect(0, floor, w, h - floor);
      ctx.fillStyle = "#f2b632";
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, floor); ctx.lineTo(x + 20, floor); ctx.lineTo(x + 14, floor + 6); ctx.lineTo(x - 6, floor + 6); ctx.fill();
      }
    } else {
      // Boden von oben: Betonplatten und die zwei Fahrschienen der Hebebühne
      ctx.strokeStyle = "rgba(233,239,230,0.06)"; ctx.lineWidth = 2;
      for (let x = 0; x < w; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.fillStyle = "#2c4a52";
      for (const row of [0, 3]) ctx.fillRect(L.ox - L.cell * 0.4, L.oy + row * L.cell + L.cell * 0.15, 10.8 * L.cell, L.cell * 0.7);
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
    if (!slot) return;
    if (state.mounted[slot]) return unmount(slot);
    const why = missing(slot);
    return why ? say(why, "warn") : mountPart(PARTS.find((p) => p.kat === kat(slot)));
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
    const touch = e.pointerType === "touch";
    press = { ...info, id: e.pointerId, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, touch, ready: !touch };
    // Finger: erst nach kurzem Halten ziehen, damit Wischen weiter scrollt
    if (touch) press.timer = setTimeout(() => { if (press) { press.ready = true; startDrag(press) || (press = null); } }, 220);
  }
  window.addEventListener("pointermove", (e) => {
    if (drag) { moveDrag(e.clientX, e.clientY); return; }
    if (!press || e.pointerId !== press.id) return;
    press.x = e.clientX; press.y = e.clientY;
    const moved = Math.hypot(e.clientX - press.sx, e.clientY - press.sy);
    if (press.touch && !press.ready && moved > 10) { clearTimeout(press.timer); press = null; return; }
    if (!press.touch && moved > 5) { if (!startDrag(press)) press = null; }
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

  // --- Regal, Checkliste ------------------------------------------------------
  function refresh() {
    const tabs = $("tabs");
    tabs.innerHTML = "";
    for (const t of TABS) {
      const tb = document.createElement("button");
      tb.type = "button";
      tb.role = "tab";
      tb.id = "tab-" + t.id;
      tb.setAttribute("aria-selected", String(t.id === state.tab));
      const slotsT = SLOTS.filter((sl) => t.kats.includes(kat(sl)));
      const n = slotsT.filter((sl) => state.mounted[sl]).length;
      tb.textContent = t.label;
      if (slotsT.length) {
        const c = document.createElement("span");
        c.className = "n";
        c.textContent = `${n}/${slotsT.length}`;
        tb.append(c);
      }
      tb.onclick = () => { state.tab = t.id; refresh(); };
      tabs.append(tb);
    }
    const tray = $("tray");
    tray.innerHTML = "";
    const tab = TABS.find((t) => t.id === state.tab);
    const angebot = PARTS.filter((p) => tab.kats.includes(p.kat));
    if (!angebot.length) {
      const e = document.createElement("p");
      e.className = "empty";
      e.textContent = "Noch keine Teile in dieser Kategorie. Sie kommen später über die Karte und Aufträge.";
      tray.append(e);
    }
    for (const p of angebot) {
      const slots = SLOTS.filter((sl) => kat(sl) === p.kat);
      const mine = slots.filter((sl) => state.mounted[sl] === p.id).length;
      const full = mine === slots.length;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "part" + (mine ? " in" : "") + (full ? " full" : "") + (state.tipp === p.id && !full ? " tipp" : "");
      const img = document.createElement("img");
      const key = `${p.id}_${state.view}`;
      img.src = (G[key] && G[key].bild) || "";
      img.alt = "";
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = slots.length > 1 ? `${mine}/${slots.length}` : mine ? "drin" : "";
      if (!badge.textContent) badge.hidden = true;
      const name = document.createElement("span");
      name.textContent = p.name;
      b.append(badge, img, name);
      if (full) {
        const hint = document.createElement("span");
        hint.className = "badge";
        hint.style.cssText = "position:static;margin-top:2px";
        hint.textContent = "Tippen zum Ausbauen";
        b.append(hint);
        b.setAttribute("aria-label", `${p.name} ausbauen`);
      }
      // Voll eingebaut: Tipp baut aus (zuletzt eingebauten Platz zuerst), sonst ein bzw. tauschen
      b.addEventListener("click", () => {
        if (suppressClick) return;
        if (full) unmount([...slots].reverse()[0]);
        else mountPart(p);
      });
      if (!full) b.addEventListener("pointerdown", (e) => beginPress(e, { partId: p.id }));
      tray.append(b);
    }
    const checks = $("checks");
    checks.innerHTML = "";
    const list = [["Rahmen", ["rahmen"]], ["Achsen", ["achseH", "achseV"]], ["Räder", ["radH", "radV"]],
      ["Motor", ["motor"]], ["Tank", ["energie"]], ["Sitz", ["sitz"]], ["Lenkung", ["lenkung"]]];
    let all = true;
    for (const [label, slots] of list) {
      const ok = slots.every((s) => state.mounted[s]);
      all = all && ok;
      const chip = document.createElement("span");
      chip.className = "check" + (ok ? " ok" : "");
      chip.textContent = (ok ? "✓ " : "") + label;
      checks.append(chip);
    }
    const karo = KARO.map((sl) => state.mounted[sl]);
    if (karo.every(Boolean)) {
      const modelle = new Set(karo.map((id) => id.split("_")[0]));
      const chip = document.createElement("span");
      chip.className = "check ok";
      chip.textContent = modelle.size === 1 ? "✓ Karosserie: kompletter Satz" : "✗ Karosserie gemischt: so nicht auf die Karte";
      if (modelle.size !== 1) chip.className = "check";
      checks.append(chip);
    } else if (karo.some(Boolean)) {
      const chip = document.createElement("span");
      chip.className = "check";
      chip.textContent = "✗ Karosserie unvollständig: so nicht auf die Karte";
      checks.append(chip);
    }
    if (all && !KARO.some((sl) => state.mounted[sl]) && !opt.stumm) {
      say("Fahrbereit! Jetzt kann die Karosserie drauf: im Regal unter „Karosserie“.", "ok");
    }
    if (opt.nachher) opt.nachher();
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
