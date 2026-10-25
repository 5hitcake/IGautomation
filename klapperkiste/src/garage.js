// Werkstatt: Hebebühne (Canvas), Teile-Regal, Werte-Tafel, Drag & Drop.
(function (KK) {
  const $ = (id) => document.getElementById(id);
  const TOUCH_LIFT = 34; // Teil schwebt über dem Finger, damit man es sieht

  const G = {
    build: null,
    tab: "rahmen",
    selected: null,   // { partId, slot? }
    drag: null,       // { partId, fromSlot, x, y, target, active }
    pending: null,    // Tipp im Regal, der noch Drag oder Scroll werden kann
    onChange: () => {},
    view: { s: 1, ox: 0, oy: 0, w: 0, h: 0 },
  };
  KK.garage = G;

  // --- Ansicht ------------------------------------------------------------
  function layout() {
    const c = $("garage");
    const w = c.clientWidth, h = c.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    }
    const len = G.build.chassis ? KK.PART[G.build.chassis].len : 260;
    const s = Math.max(0.4, Math.min(w / (len + 150), h / 210, 2.4));
    G.view = { s, ox: w / 2, oy: h / 2 + 22 * s, w, h, dpr };
  }

  const toLocal = (sx, sy) => ({ x: (sx - G.view.ox) / G.view.s, y: (sy - G.view.oy) / G.view.s });

  function stagePoint(e) {
    const r = $("garage").getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, inside: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom };
  }

  function drawBackground(ctx, t) {
    const { w, h, s, oy } = G.view;
    ctx.fillStyle = "#1b3138";
    ctx.fillRect(0, 0, w, h);
    // Lochwand
    ctx.fillStyle = "#24414a";
    const step = 22;
    for (let y = 10; y < h; y += step) for (let x = 10 + ((y / step) % 2) * 11; x < w; x += step) {
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    }
    // Boden
    const floor = oy + 78 * s;
    ctx.fillStyle = "#14252b";
    ctx.fillRect(0, floor, w, h - floor);
    ctx.fillStyle = "#f2b632";
    for (let x = -((t * 0) % 40); x < w; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, floor); ctx.lineTo(x + 20, floor); ctx.lineTo(x + 14, floor + 6); ctx.lineTo(x - 6, floor + 6); ctx.fill();
    }
    // Hebebühne
    ctx.save();
    ctx.translate(G.view.ox, oy);
    ctx.scale(s, s);
    const len = G.build.chassis ? KK.PART[G.build.chassis].len : 260;
    ctx.fillStyle = "#3e5d66";
    ctx.fillRect(-14, 50, 28, 28);
    ctx.fillStyle = "#4f7480";
    ctx.beginPath(); ctx.roundRect(-len * 0.42, 44, len * 0.84, 9, 4); ctx.fill();
    ctx.restore();
  }

  function drawSlots(ctx, t) {
    const chassis = KK.PART[G.build.chassis];
    const dragPart = G.drag && G.drag.active ? KK.PART[G.drag.partId] : null;
    const ok = dragPart ? KK.slotsFor(chassis, dragPart) : [];
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    ctx.font = "800 11px Nunito, sans-serif";
    ctx.textAlign = "center";
    for (const slot of chassis.slots) {
      const filled = !!G.build.parts[slot];
      const fits = ok.includes(slot);
      if (filled && !fits) continue;
      if (dragPart && !fits) continue;
      const p = KK.slotPos(chassis, slot);
      const r = slot.startsWith("rad") ? 20 : 15;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + (fits ? pulse * 3 : 0), 0, Math.PI * 2);
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = fits ? "#f2b632" : "rgba(233,239,230,0.35)";
      if (G.drag && G.drag.target === slot) { ctx.fillStyle = "rgba(242,182,50,0.35)"; ctx.fill(); }
      ctx.stroke();
      ctx.setLineDash([]);
      if (fits || !filled) {
        ctx.fillStyle = fits ? "#f2b632" : "rgba(233,239,230,0.55)";
        ctx.fillText(KK.SLOTS[slot].label, p.x, slot === "radH" || slot === "radV" ? p.y + r + 13 : p.y - r - 5);
      }
    }
  }

  function render(t) {
    layout();
    const ctx = $("garage").getContext("2d");
    const { s, ox, oy, dpr } = G.view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground(ctx, t);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    if (G.build.chassis) {
      KK.drawCar(ctx, buildWithoutDragged(), { t, running: false, turn: 0 });
      drawSlots(ctx, t);
      if (G.selected && G.selected.slot) highlight(ctx, G.selected.slot);
    } else {
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = G.drag && G.drag.active && KK.PART[G.drag.partId].cat === "rahmen" ? "#f2b632" : "rgba(233,239,230,0.4)";
      ctx.beginPath(); ctx.roundRect(-130, -16, 260, 32, 8); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(233,239,230,0.7)";
      ctx.font = "800 13px Nunito, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Rahmen hierher ziehen", 0, 5);
    }
    ctx.restore();
  }

  function highlight(ctx, slot) {
    const chassis = KK.PART[G.build.chassis];
    const part = KK.PART[G.build.parts[slot]];
    if (!part) return;
    const p = KK.slotPos(chassis, slot);
    const b = KK.partBox(part, chassis.len);
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#f2b632";
    ctx.strokeRect(p.x + b[0] - 4, p.y + b[1] - 4, b[2] - b[0] + 8, b[3] - b[1] + 8);
    ctx.setLineDash([]);
  }

  function buildWithoutDragged() {
    if (G.drag && G.drag.active && G.drag.fromSlot) return KK.removePart(G.build, G.drag.fromSlot);
    return G.build;
  }

  // --- Ghost (das Teil unter dem Finger) ---------------------------------
  function drawGhost() {
    const g = $("ghost");
    const d = G.drag;
    const part = KK.PART[d.partId];
    const len = part.len || 0;
    const b = KK.partBox(part, len);
    const s = G.view.s;
    const pad = 8;
    const w = (b[2] - b[0]) * s + pad * 2, h = (b[3] - b[1]) * s + pad * 2;
    const dpr = G.view.dpr || 1;
    g.width = w * dpr; g.height = h * dpr;
    g.style.width = w + "px"; g.style.height = h + "px";
    const ctx = g.getContext("2d");
    ctx.setTransform(dpr * s, 0, 0, dpr * s, (pad - b[0] * s) * dpr, (pad - b[1] * s) * dpr);
    KK.drawPart(ctx, d.partId, { len, turn: 0, running: false, t: 0 });
    d.ghostOffset = { x: pad - b[0] * s, y: pad - b[1] * s };
    g.hidden = false;
  }

  function moveGhost(e) {
    const d = G.drag;
    const lift = e.pointerType === "touch" ? TOUCH_LIFT : 0;
    d.x = e.clientX; d.y = e.clientY - lift;
    const g = $("ghost");
    g.style.transform = `translate(${d.x - d.ghostOffset.x}px, ${d.y - d.ghostOffset.y}px)`;
    d.target = findTarget();
  }

  function findTarget() {
    const d = G.drag;
    const r = $("garage").getBoundingClientRect();
    const inside = d.x >= r.left && d.x <= r.right && d.y >= r.top && d.y <= r.bottom;
    if (!inside) return null;
    const part = KK.PART[d.partId];
    if (part.cat === "rahmen") return "rahmen";
    if (!G.build.chassis) return null;
    const chassis = KK.PART[G.build.chassis];
    const local = toLocal(d.x - r.left, d.y - r.top);
    const reach = Math.max(72, 56 / G.view.s);
    let best = null, bestDist = reach;
    for (const slot of KK.slotsFor(chassis, part)) {
      const p = KK.slotPos(chassis, slot);
      const dist = Math.hypot(p.x - local.x, p.y - local.y);
      if (dist < bestDist) { best = slot; bestDist = dist; }
    }
    return best;
  }

  function startDrag(e, partId, fromSlot) {
    G.drag = { partId, fromSlot, active: true, target: null, x: 0, y: 0 };
    G.selected = null;
    drawGhost();
    moveGhost(e);
  }

  function endDrag() {
    const d = G.drag;
    $("ghost").hidden = true;
    G.drag = null;
    if (!d) return;
    const part = KK.PART[d.partId];
    if (d.target === "rahmen") {
      G.build = KK.setChassis(G.build, d.partId);
      say(part.name + " steht auf der Bühne.");
    } else if (d.target) {
      let b = d.fromSlot ? KK.removePart(G.build, d.fromSlot) : G.build;
      const replaced = b.parts[d.target];
      // Tausch: das verdrängte Teil wandert in den frei gewordenen Slot, wenn es passt
      b = KK.placePart(b, d.target, d.partId);
      if (replaced && d.fromSlot && KK.slotsFor(KK.PART[b.chassis], KK.PART[replaced]).includes(d.fromSlot)) {
        b = KK.placePart(b, d.fromSlot, replaced);
      }
      G.build = b;
      G.selected = { partId: d.partId, slot: d.target };
    } else if (d.fromSlot) {
      G.build = KK.removePart(G.build, d.fromSlot);
      say(part.name + " ausgebaut.");
    } else if (!G.build.chassis) {
      say("Zieh zuerst einen Rahmen auf die Hebebühne.");
    }
    commit();
  }

  // Antippen im Regal: Teil kommt auf den passenden Platz
  function tapPlace(partId) {
    const part = KK.PART[partId];
    if (part.cat === "rahmen") {
      G.build = KK.setChassis(G.build, partId);
      G.selected = { partId };
    } else if (!G.build.chassis) {
      G.selected = { partId };
      say("Zieh zuerst einen Rahmen auf die Hebebühne.");
    } else {
      const slot = KK.autoSlot(G.build, partId);
      if (slot) {
        G.build = KK.placePart(G.build, slot, partId);
        G.selected = { partId, slot };
      } else {
        G.selected = { partId };
        say(part.name + ": Dieser Rahmen hat keinen Platz dafür.");
      }
    }
    commit();
  }

  // --- Regal --------------------------------------------------------------
  function catOf(part) {
    return KK.CATEGORIES.find((c) => c.id === part.cat || (c.includes && c.includes.includes(part.cat))).id;
  }

  function renderTabs() {
    const tabs = $("tabs");
    tabs.innerHTML = "";
    for (const c of KK.CATEGORIES) {
      const b = document.createElement("button");
      b.type = "button";
      b.role = "tab";
      b.id = "tab-" + c.id;
      b.textContent = c.label;
      b.setAttribute("aria-selected", String(c.id === G.tab));
      b.onclick = () => { G.tab = c.id; renderTabs(); renderItems(); };
      tabs.appendChild(b);
    }
  }

  function renderItems() {
    const items = $("items");
    items.innerHTML = "";
    const used = new Set([G.build.chassis, ...Object.values(G.build.parts)]);
    for (const part of KK.PARTS.filter((p) => catOf(p) === G.tab)) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "card" + (used.has(part.id) ? " in" : "");
      card.dataset.part = part.id;
      card.setAttribute("aria-label", part.name);
      const cv = document.createElement("canvas");
      const label = document.createElement("span");
      label.textContent = part.name;
      card.append(cv, label);
      items.appendChild(card);
      KK.drawThumb(cv, part.id);
    }
  }

  function bindTray() {
    const items = $("items");
    items.addEventListener("pointerdown", (e) => {
      const card = e.target.closest(".card");
      if (!card) return;
      G.pending = { partId: card.dataset.part, x: e.clientX, y: e.clientY, id: e.pointerId, card };
    });
    items.addEventListener("pointermove", (e) => {
      const p = G.pending;
      if (G.drag && G.drag.active) { moveGhost(e); return; }
      if (!p || p.id !== e.pointerId) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      // Nach oben ziehen = Teil greifen, seitlich = Regal scrollen (macht der Browser)
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
        p.card.setPointerCapture(e.pointerId);
        startDrag(e, p.partId, null);
        G.pending = null;
      }
    });
    items.addEventListener("pointerup", (e) => {
      if (G.drag && G.drag.active) { endDrag(); return; }
      const p = G.pending;
      G.pending = null;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 8) tapPlace(p.partId);
    });
    items.addEventListener("pointercancel", () => {
      G.pending = null;
      if (G.drag) { $("ghost").hidden = true; G.drag = null; }
    });
    // Tastatur: Enter/Leertaste auf einer Karte setzt das Teil ein
    items.addEventListener("keydown", (e) => {
      const card = e.target.closest(".card");
      if (card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); tapPlace(card.dataset.part); }
    });
  }

  // --- Bühne: eingebaute Teile antippen oder rausziehen ------------------
  function hitPart(local) {
    if (!G.build.chassis) return null;
    const chassis = KK.PART[G.build.chassis];
    const order = ["radV", "radH", "hinten", "vorne", "lenkung", "motor", "energie", "dach"];
    for (const slot of order) {
      const pid = G.build.parts[slot];
      if (!pid) continue;
      const p = KK.slotPos(chassis, slot);
      const b = KK.partBox(KK.PART[pid], chassis.len);
      const pad = 8;
      if (local.x >= p.x + b[0] - pad && local.x <= p.x + b[2] + pad && local.y >= p.y + b[1] - pad && local.y <= p.y + b[3] + pad) {
        return { slot, partId: pid };
      }
    }
    const b = KK.partBox(chassis, chassis.len);
    if (local.x >= b[0] && local.x <= b[2] && local.y >= b[1] && local.y <= b[3]) return { slot: null, partId: chassis.id };
    return null;
  }

  function bindStage() {
    const c = $("garage");
    let press = null;
    c.addEventListener("pointerdown", (e) => {
      const pt = stagePoint(e);
      const hit = hitPart(toLocal(pt.x, pt.y));
      press = hit ? { ...hit, x: e.clientX, y: e.clientY } : null;
      if (!hit) { G.selected = null; renderInfo(); }
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener("pointermove", (e) => {
      if (G.drag && G.drag.active) { moveGhost(e); return; }
      if (!press || !press.slot) return;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) {
        startDrag(e, press.partId, press.slot);
        press = null;
      }
    });
    c.addEventListener("pointerup", () => {
      if (G.drag && G.drag.active) { endDrag(); return; }
      if (press) { G.selected = { partId: press.partId, slot: press.slot }; renderInfo(); }
      press = null;
    });
    c.addEventListener("pointercancel", () => {
      press = null;
      if (G.drag) { $("ghost").hidden = true; G.drag = null; }
    });
  }

  // --- Tafel --------------------------------------------------------------
  const METERS = [
    ["Tempo", "kmh", "km/h", 120],
    ["Steigung", "slope", "°", 50],
    ["Grip", "grip", "", 10],
    ["Reichweite", "range", "m", 2500],
    ["Robustheit", "strength", "", 14],
    ["Gewicht", "mass", "kg", 0],
  ];

  function renderStats() {
    const st = KK.stats(G.build);
    const dl = $("stats");
    dl.innerHTML = "";
    for (const [label, key, unit, max] of METERS) {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = st[key] + (unit ? " " + unit : "");
      dl.append(dt, dd);
      if (max) {
        const m = document.createElement("div");
        m.className = "meter";
        const i = document.createElement("i");
        i.style.width = Math.min(100, (st[key] / max) * 100) + "%";
        m.appendChild(i);
        dl.appendChild(m);
      }
    }
  }

  function partNumbers(p) {
    const out = [p.weight + " kg"];
    if (p.power) out.push("Kraft +" + p.power);
    if (p.cap) out.push("Vorrat " + p.cap);
    if (p.fuel && p.cat === "motor") out.push(p.fuel === "strom" ? "Strom" : "Benzin");
    if (p.grip) out.push("Grip " + p.grip);
    if (p.strength) out.push("Robust +" + p.strength);
    return out.join(" · ");
  }

  function renderInfo() {
    const box = $("info");
    box.innerHTML = "";
    const sel = G.selected;
    if (!sel) {
      const p = document.createElement("p");
      p.textContent = "Tippe ein Teil im Regal an oder zieh es auf das Auto. Teile auf dem Auto kannst du wieder herunterziehen.";
      box.appendChild(p);
      return;
    }
    const part = KK.PART[sel.partId];
    const name = document.createElement("strong");
    name.textContent = part.name;
    const info = document.createElement("p");
    info.textContent = part.info;
    const nums = document.createElement("p");
    nums.className = "nums";
    nums.textContent = partNumbers(part);
    box.append(name, info, nums);
    if (sel.slot) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.id = "btn-remove";
      btn.textContent = "Ausbauen";
      btn.onclick = () => {
        G.build = KK.removePart(G.build, sel.slot);
        G.selected = null;
        say(part.name + " ausgebaut.");
        commit();
      };
      box.appendChild(btn);
    }
  }

  let sayUntil = 0;
  function say(text) {
    const s = $("status");
    s.textContent = text;
    s.className = "";
    sayUntil = performance.now() + 2500;
  }

  function renderStatus() {
    if (performance.now() < sayUntil) return;
    const probs = KK.problems(G.build);
    const s = $("status");
    s.textContent = probs.length ? probs[0] : "Fahrbereit! Ab auf die Teststrecke.";
    s.className = probs.length ? "" : "ok";
    $("btn-drive").disabled = probs.length > 0;
  }

  function commit() {
    renderItems();
    renderStats();
    renderInfo();
    $("btn-drive").disabled = KK.problems(G.build).length > 0;
    G.onChange(G.build);
  }

  // --- Start --------------------------------------------------------------
  let running = false;
  function loop(now) {
    if (!running) return;
    render(now / 1000);
    renderStatus();
    requestAnimationFrame(loop);
  }

  G.init = function (build, onChange) {
    G.build = build;
    G.onChange = onChange;
    renderTabs();
    bindTray();
    bindStage();
    $("btn-clear").onclick = () => {
      G.build = KK.emptyBuild();
      G.selected = null;
      say("Alles ausgebaut. Neuer Versuch!");
      commit();
    };
    commit();
  };

  G.show = function () {
    $("shop").hidden = false;
    running = true;
    requestAnimationFrame(loop);
  };

  G.hide = function () {
    running = false;
    $("shop").hidden = true;
  };
})(globalThis.KK = globalThis.KK || {});
