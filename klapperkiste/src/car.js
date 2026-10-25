// Fahrzeug-Logik: Bauplan prüfen, Werte berechnen, Fahrphysik.
// Kein DOM, kein Canvas - läuft auch in Node (siehe tests/).
(function (KK) {
  const G = 9.81;
  const CRR = 0.03;        // Rollwiderstand
  const BASE_DRAG = 0.4;   // Luftwiderstand (0.5 * rho * cw * A)
  const WATT_PER_POWER = 300;
  const V_MIN = 2;         // m/s - verhindert unendliche Kraft beim Anfahren
  KK.PX_PER_M = 40;

  // Ein Bauplan: { chassis: "kiste" | null, parts: { slotId: partId } }
  KK.emptyBuild = () => ({ chassis: null, parts: {} });

  KK.setChassis = function (build, chassisId) {
    const chassis = KK.PART[chassisId];
    const parts = {};
    for (const [slot, pid] of Object.entries(build.parts)) {
      if (chassis.slots.includes(slot)) parts[slot] = pid;
    }
    return { chassis: chassisId, parts };
  };

  KK.placePart = function (build, slotId, partId) {
    const chassis = KK.PART[build.chassis];
    const part = KK.PART[partId];
    if (!chassis || !KK.slotsFor(chassis, part).includes(slotId)) return build;
    return { chassis: build.chassis, parts: { ...build.parts, [slotId]: partId } };
  };

  KK.removePart = function (build, slotId) {
    const parts = { ...build.parts };
    delete parts[slotId];
    return { chassis: build.chassis, parts };
  };

  // Freier Slot bevorzugt, sonst der erste passende (wird ersetzt).
  KK.autoSlot = function (build, partId) {
    const chassis = KK.PART[build.chassis];
    const options = KK.slotsFor(chassis, KK.PART[partId]);
    return options.find((s) => !build.parts[s]) || options[0] || null;
  };

  // Liste der Probleme in Spielersprache. Leer = fahrbereit.
  KK.problems = function (build) {
    if (!build.chassis) return ["Zieh zuerst einen Rahmen auf die Hebebühne."];
    const p = build.parts;
    const out = [];
    const motor = p.motor && KK.PART[p.motor];
    const energie = p.energie && KK.PART[p.energie];
    if (!motor) out.push("Es fehlt ein Motor.");
    if (!energie) out.push("Es fehlt Energie: Tank oder Batterie.");
    if (motor && energie && motor.fuel !== energie.fuel) {
      out.push(motor.fuel === "strom"
        ? "Der Elektromotor braucht eine Batterie."
        : "Der Motor braucht Benzin statt Strom.");
    }
    if (!p.radH) out.push("Es fehlt ein Hinterrad.");
    if (!p.radV) out.push("Es fehlt ein Vorderrad.");
    if (!p.lenkung) out.push("Ohne Lenkung fährt hier niemand los.");
    return out;
  };

  function installed(build) {
    return Object.values(build.parts).map((id) => KK.PART[id]);
  }

  // Physikalische Grundwerte des Bauplans
  KK.specs = function (build) {
    const chassis = KK.PART[build.chassis];
    const parts = installed(build);
    const sum = (k) => parts.reduce((a, p) => a + (p[k] || 0), 0);
    const hasMotor = !!build.parts.motor;
    const rH = KK.PART[build.parts.radH];
    const rV = KK.PART[build.parts.radV];
    const wheels = [rH, rV].filter(Boolean);
    return {
      mass: (chassis ? chassis.weight : 0) + KK.DRIVER_WEIGHT + sum("weight"),
      power: hasMotor ? sum("power") : 0,
      use: hasMotor ? sum("use") : 0,
      cap: build.parts.energie ? KK.PART[build.parts.energie].cap : 0,
      grip: wheels.length ? wheels.reduce((a, w) => a + w.grip, 0) / wheels.length : 0,
      strength: (chassis ? chassis.strength : 0) + sum("strength"),
      drag: Math.max(0.15, BASE_DRAG + sum("drag")),
      minRadius: wheels.length ? Math.min(...wheels.map((w) => w.r)) : 0,
      tags: [...new Set(parts.flatMap((p) => p.tags || []))],
    };
  };

  const mu = (grip) => grip * 0.12;

  function driveForce(s, v, slopeRad) {
    const engine = (s.power * WATT_PER_POWER) / Math.max(Math.abs(v), V_MIN);
    const traction = mu(s.grip) * s.mass * G * Math.cos(slopeRad);
    return Math.min(engine, traction);
  }

  // Werte für die Anzeige: km/h, Grad, Meter
  KK.stats = function (build) {
    const s = KK.specs(build);
    let topSpeed = 0;
    if (s.power > 0 && s.grip > 0) {
      let lo = 0, hi = 100;
      for (let i = 0; i < 40; i++) {
        const v = (lo + hi) / 2;
        const net = driveForce(s, v, 0) - CRR * s.mass * G - s.drag * v * v;
        if (net > 0) lo = v; else hi = v;
      }
      topSpeed = lo;
    }
    let maxSlope = 0;
    if (s.power > 0 && s.grip > 0) {
      for (let deg = 0; deg <= 60; deg += 0.5) {
        const r = (deg * Math.PI) / 180;
        const need = s.mass * G * (Math.sin(r) + CRR * Math.cos(r));
        if (driveForce(s, V_MIN, r) >= need) maxSlope = deg; else break;
      }
    }
    const range = s.use > 0 ? (s.cap / s.use) * topSpeed : 0;
    return {
      mass: Math.round(s.mass),
      kmh: Math.round(topSpeed * 3.6),
      slope: Math.round(maxSlope),
      grip: Math.round(s.grip * 10) / 10,
      strength: s.strength,
      range: Math.round(range),
      tags: s.tags,
    };
  };

  // --- Fahrsimulation ------------------------------------------------------
  // sim: { x (m), v (m/s), energy, angle (rad), wheelTurn (rad), slip }
  KK.newSim = function (build) {
    return { x: 4, v: 0, energy: KK.specs(build).cap, angle: 0, wheelTurn: 0, slip: false };
  };

  // Lage des Autos aus den Bodenhöhen unter beiden Rädern
  KK.pose = function (build, x, track) {
    const chassis = KK.PART[build.chassis];
    const pH = KK.slotPos(chassis, "radH");
    const pV = KK.slotPos(chassis, "radV");
    const rH = KK.PART[build.parts.radH].r;
    const rV = KK.PART[build.parts.radV].r;
    const xH = x + pH.x / KK.PX_PER_M;
    const xV = x + pV.x / KK.PX_PER_M;
    const hubH = track.height(xH) + rH / KK.PX_PER_M;
    const hubV = track.height(xV) + rV / KK.PX_PER_M;
    const angle = Math.atan2(hubV - hubH, xV - xH);
    // Rahmenmitte liegt über den Naben (Slot-y = 14 px unter der Mitte)
    const mid = (hubH + hubV) / 2 + pH.y / KK.PX_PER_M;
    return { angle, y: mid };
  };

  // input: { gas: bool, brake: bool }
  KK.step = function (build, sim, input, dt, track) {
    const s = KK.specs(build);
    const { angle } = KK.pose(build, sim.x, track);
    const rough = track.roughness(sim.x);
    const r = s.minRadius / KK.PX_PER_M;
    const crr = CRR * (1 + rough * (0.25 / Math.max(r, 0.1)));

    let force = -s.mass * G * Math.sin(angle);
    const gas = input.gas && sim.energy > 0;
    let slip = false;
    if (gas) {
      const engine = (s.power * WATT_PER_POWER) / Math.max(Math.abs(sim.v), V_MIN);
      const traction = mu(s.grip) * s.mass * G * Math.cos(angle);
      slip = engine > traction;
      force += Math.min(engine, traction);
      sim.energy = Math.max(0, sim.energy - s.use * dt);
    }
    // Widerstände bremsen immer gegen die Fahrtrichtung
    const resist = crr * s.mass * G * Math.cos(angle) + s.drag * sim.v * sim.v;
    const brake = input.brake ? mu(s.grip) * s.mass * G : 0;
    const against = resist + brake;
    let v = sim.v + (force / s.mass) * dt;
    const dv = (against / s.mass) * dt;
    if (Math.abs(v) <= dv) v = 0; else v -= Math.sign(v) * dv;

    sim.v = v;
    sim.x = Math.min(track.length, Math.max(track.start, sim.x + v * dt));
    if (sim.x === track.start && sim.v < 0) sim.v = 0;
    sim.angle = angle;
    sim.slip = slip;
    sim.wheelTurn += (v * dt) / Math.max(r, 0.1);
    return sim;
  };
})(globalThis.KK = globalThis.KK || {});
