// Probefahrt: Seitenansicht auf der Teststrecke, Gas und Bremse.
(function (KK) {
  const $ = (id) => document.getElementById(id);
  const T = KK.TRACK;
  const DT = 1 / 120;

  const D = {
    build: null, sim: null, input: { gas: false, brake: false },
    running: false, over: false, time: 0, best: 0, lastGain: 0, gasIdle: 0,
    cam: { x: 0, y: 0 }, dust: [], onBack: () => {},
  };
  KK.drive = D;

  // Ferne Schrotthaufen: feste Zufallsform, damit sie nicht flackern
  const PILES = Array.from({ length: 40 }, (_, i) => ({
    x: i * 38 + ((i * 97) % 23), h: 8 + ((i * 53) % 13), w: 18 + ((i * 31) % 17),
  }));

  function size(c) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    }
    return { w, h, dpr };
  }

  function render(t) {
    const c = $("road");
    const { w, h, dpr } = size(c);
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const z = Math.max(14, Math.min(h / 11, w / 20)); // px pro Meter
    const sx = (x) => (x - D.cam.x) * z + w * 0.38;
    const sy = (y) => h * 0.6 - (y - D.cam.y) * z;

    // Himmel
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#5fa7b4"); sky.addColorStop(1, "#cfe6d8");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,250,225,0.8)";
    ctx.beginPath(); ctx.arc(w * 0.82, h * 0.2, Math.min(w, h) * 0.07, 0, Math.PI * 2); ctx.fill();

    // Parallax-Schrottberge
    ctx.fillStyle = "#79a9a2";
    for (const p of PILES) {
      const x = ((p.x - D.cam.x * 0.25) % 1520 + 1520) % 1520 - 60;
      const px = (x / 40) * z, base = h * 0.72;
      ctx.beginPath();
      ctx.moveTo(px - p.w * z * 0.05 - 20, base);
      ctx.quadraticCurveTo(px, base - p.h * z * 0.25 - 30, px + p.w * z * 0.05 + 20, base);
      ctx.fill();
    }

    // Boden
    const x0 = D.cam.x - (w * 0.38) / z - 2, x1 = D.cam.x + (w * 0.62) / z + 2;
    ctx.beginPath();
    ctx.moveTo(sx(x0), h);
    for (let x = x0; x <= x1; x += 0.5) ctx.lineTo(sx(x), sy(T.height(x)));
    ctx.lineTo(sx(x1), h);
    ctx.closePath();
    ctx.fillStyle = "#7a5236"; ctx.fill();
    ctx.lineWidth = Math.max(4, z * 0.3);
    ctx.strokeStyle = "#5f9e4f";
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 0.5) {
      const rough = T.roughness(x);
      if (rough) continue;
      ctx.lineTo(sx(x), sy(T.height(x)));
    }
    ctx.stroke();
    // Schotter
    ctx.fillStyle = "#c2ad8c";
    for (let x = Math.max(T.rough[0], Math.floor(x0)); x <= Math.min(T.rough[1], x1); x += 0.7) {
      const y = T.height(x);
      ctx.beginPath(); ctx.arc(sx(x), sy(y) + 3, 2 + ((x * 7) % 3), 0, Math.PI * 2); ctx.fill();
    }

    // Start-Schuppen
    ctx.save();
    ctx.translate(sx(-3), sy(0));
    ctx.fillStyle = "#1b3138";
    ctx.fillRect(-z * 6, -z * 5, z * 6, z * 5);
    ctx.fillStyle = "#f2b632";
    ctx.font = `${Math.round(z * 0.8)}px "Lilita One", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Werkstatt", -z * 3, -z * 3.6);
    ctx.restore();

    // Schilder
    for (const s of T.signs) {
      const gx = sx(s.x), gy = sy(T.height(s.x));
      ctx.fillStyle = "#1d2730";
      ctx.fillRect(gx - 2, gy - z * 2.4, 4, z * 2.4);
      ctx.fillStyle = "#fff4cf";
      ctx.strokeStyle = "#1d2730"; ctx.lineWidth = 3;
      const bw = Math.max(z * 2.2, s.text.length * z * 0.5);
      ctx.beginPath(); ctx.roundRect(gx - bw / 2, gy - z * 3.4, bw, z * 1.2, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#1d2730";
      ctx.font = `${Math.round(z * 0.75)}px "Lilita One", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(s.text, gx, gy - z * 2.5);
    }

    // Ziel
    const fx = sx(T.finish), fy = sy(T.height(T.finish));
    ctx.fillStyle = "#1d2730";
    ctx.fillRect(fx - 2, fy - z * 4, 4, z * 4);
    const sq = z * 0.45;
    for (let r = 0; r < 3; r++) for (let q = 0; q < 4; q++) {
      ctx.fillStyle = (r + q) % 2 ? "#1d2730" : "#ffffff";
      ctx.fillRect(fx + 2 + q * sq, fy - z * 4 + r * sq, sq, sq);
    }

    // Staub
    for (const p of D.dust) {
      ctx.fillStyle = `rgba(214,190,150,${p.life})`;
      ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), p.r * z, 0, Math.PI * 2); ctx.fill();
    }

    // Auto
    const pose = KK.pose(D.build, D.sim.x, T);
    ctx.save();
    ctx.translate(sx(D.sim.x), sy(pose.y));
    ctx.rotate(-pose.angle);
    const k = z / KK.PX_PER_M;
    ctx.scale(k, k);
    KK.drawCar(ctx, D.build, { t, running: D.input.gas && D.sim.energy > 0, turn: D.sim.wheelTurn });
    ctx.restore();
  }

  function hud() {
    $("hud-speed").textContent = Math.round(Math.abs(D.sim.v) * 3.6);
    const cap = KK.specs(D.build).cap;
    $("hud-fuel").style.width = (cap ? (D.sim.energy / cap) * 100 : 0) + "%";
    $("hud-dist").textContent = Math.round(Math.max(0, D.sim.x)) + " / " + T.finish + " m";
  }

  // Warum bleibt das Auto stehen? Antwort in Spielersprache.
  function stuckReason() {
    if (D.sim.energy <= 0) {
      return ["Tank leer!", "Nimm einen größeren Tank oder einen sparsameren Motor. Leichter bauen hilft auch."];
    }
    const st = KK.stats(D.build);
    const s = KK.specs(D.build);
    const tractionLimited = s.grip * 0.12 < Math.tan((st.slope + 4) * Math.PI / 180) && s.grip < 9;
    return tractionLimited
      ? ["Zu steil!", `Die Räder drehen durch. Dein Auto schafft nur ${st.slope}°. Mehr Grip bringen größere Reifen.`]
      : ["Zu steil!", `Dein Auto schafft nur ${st.slope}°. Ein stärkerer Motor oder weniger Gewicht helfen. Mit viel Schwung geht es auch.`];
  }

  function finish(title, text) {
    D.over = true;
    D.input.gas = D.input.brake = false;
    $("btn-gas").classList.remove("down");
    $("btn-brake").classList.remove("down");
    $("result-title").textContent = title;
    $("result-text").textContent = text;
    $("result").hidden = false;
  }

  function update(dt) {
    if (D.over) return;
    D.time += dt;
    KK.step(D.build, D.sim, D.input, dt, T);
    if (D.sim.x > D.best + 0.3) { D.best = D.sim.x; D.lastGain = D.time; D.gasIdle = 0; }
    else if (D.input.gas || D.sim.energy <= 0) D.gasIdle += dt;
    if (D.sim.slip && Math.random() < 0.3) {
      D.dust.push({ x: D.sim.x - 1, y: T.height(D.sim.x) + 0.2, r: 0.2 + Math.random() * 0.25, life: 0.8 });
    }
    for (const p of D.dust) { p.life -= dt * 1.2; p.y += dt * 0.6; p.r += dt * 0.3; }
    D.dust = D.dust.filter((p) => p.life > 0);

    if (D.sim.x >= T.finish) {
      const st = KK.stats(D.build);
      finish("Geschafft!", `${T.finish} m in ${D.time.toFixed(1)} Sekunden. Spitze ${st.kmh} km/h, ${Math.round((D.sim.energy / KK.specs(D.build).cap) * 100)} % Energie übrig.`);
    } else if (D.gasIdle > (D.sim.energy <= 0 ? 1.5 : 4) && Math.abs(D.sim.v) < 1.5) {
      const [title, text] = stuckReason();
      finish(title, `${text} Du bist ${Math.round(D.best)} m weit gekommen.`);
    }
  }

  let last = 0, acc = 0;
  function loop(now) {
    if (!D.running) return;
    const t = now / 1000;
    acc += Math.min(0.1, t - (last || t));
    last = t;
    while (acc >= DT) { update(DT); acc -= DT; }
    const pose = KK.pose(D.build, D.sim.x, T);
    D.cam.x += (D.sim.x + 3 - D.cam.x) * 0.1;
    D.cam.y += (pose.y - D.cam.y) * 0.08;
    render(t);
    hud();
    requestAnimationFrame(loop);
  }

  function reset() {
    D.sim = KK.newSim(D.build);
    D.time = 0; D.best = D.sim.x; D.lastGain = 0; D.gasIdle = 0; D.over = false; D.dust = [];
    D.cam = { x: D.sim.x + 3, y: 0 };
    $("result").hidden = true;
    const fuel = KK.PART[D.build.parts.energie].fuel;
    $("hud-fuel-label").textContent = fuel === "strom" ? "Strom" : "Benzin";
  }

  function pedal(id, key) {
    const b = $(id);
    const set = (v) => { if (D.over) return; D.input[key] = v; b.classList.toggle("down", v); };
    b.addEventListener("pointerdown", (e) => { b.setPointerCapture(e.pointerId); set(true); });
    b.addEventListener("pointerup", () => set(false));
    b.addEventListener("pointercancel", () => set(false));
    b.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  D.init = function (onBack) {
    D.onBack = onBack;
    pedal("btn-gas", "gas");
    pedal("btn-brake", "brake");
    $("btn-back").onclick = () => D.onBack();
    $("btn-rebuild").onclick = () => D.onBack();
    $("btn-retry").onclick = reset;
    const keys = { ArrowRight: "gas", ArrowUp: "gas", d: "gas", ArrowLeft: "brake", ArrowDown: "brake", a: "brake" };
    window.addEventListener("keydown", (e) => {
      if (!D.running || D.over || !keys[e.key]) return;
      D.input[keys[e.key]] = true; e.preventDefault();
    });
    window.addEventListener("keyup", (e) => { if (keys[e.key]) D.input[keys[e.key]] = false; });
  };

  D.show = function (build) {
    D.build = build;
    reset();
    $("drive").hidden = false;
    D.running = true;
    last = 0; acc = 0;
    requestAnimationFrame(loop);
  };

  D.hide = function () {
    D.running = false;
    D.input.gas = D.input.brake = false;
    $("drive").hidden = true;
  };
})(globalThis.KK = globalThis.KK || {});
