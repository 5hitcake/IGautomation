// Ausführen: node --test klapperkiste/tests/*.test.js
const test = require("node:test");
const assert = require("node:assert");
for (const f of ["parts", "car", "track"]) require(`../src/${f}.js`);
const KK = globalThis.KK;

function build(chassis, parts) {
  let b = KK.setChassis(KK.emptyBuild(), chassis);
  for (const [slot, pid] of Object.entries(parts)) b = KK.placePart(b, slot, pid);
  return b;
}

// Fährt mit Vollgas, bis Ziel erreicht oder 6 s kein Fortschritt
function testDrive(b) {
  const sim = KK.newSim(b);
  let t = 0, best = sim.x, lastGain = 0;
  while (t < 300) {
    KK.step(b, sim, { gas: true }, 1 / 60, KK.TRACK);
    t += 1 / 60;
    if (sim.x >= KK.TRACK.finish) return { finished: true, x: sim.x };
    if (sim.x > best + 0.5) { best = sim.x; lastGain = t; }
    if (t - lastGain > 6) break;
  }
  return { finished: false, x: best };
}

const basic = { motor: "maeher", energie: "kanister", lenkung: "lenker" };

test("Teile passen nur in ihre Slots", () => {
  const b = build("kiste", {});
  assert.deepStrictEqual(KK.placePart(b, "motor", "kanister"), b);
  assert.strictEqual(KK.placePart(b, "motor", "v8").parts.motor, "v8");
  // Die Seifenkiste hat keinen Aufbau-Slot
  assert.strictEqual(KK.autoSlot(b, "dach"), null);
});

test("Rahmenwechsel behält passende Teile", () => {
  const b = build("leiter", { ...basic, dach: "segel" });
  const k = KK.setChassis(b, "kiste");
  assert.strictEqual(k.parts.motor, "maeher");
  assert.strictEqual(k.parts.dach, undefined);
});

test("autoSlot füllt zuerst freie Plätze", () => {
  let b = build("kiste", {});
  b = KK.placePart(b, KK.autoSlot(b, "reifen"), "reifen");
  assert.strictEqual(KK.autoSlot(b, "reifen"), "radV");
});

test("Probleme werden erkannt", () => {
  assert.strictEqual(KK.problems(KK.emptyBuild()).length, 1);
  const wrongFuel = build("kiste", { ...basic, motor: "trommel", radH: "reifen", radV: "reifen" });
  assert.deepStrictEqual(KK.problems(wrongFuel), ["Der Elektromotor braucht eine Batterie."]);
  const ok = build("kiste", { ...basic, radH: "reifen", radV: "reifen" });
  assert.deepStrictEqual(KK.problems(ok), []);
});

test("Werte sind plausibel", () => {
  const s = KK.stats(build("kiste", { ...basic, radH: "buggy", radV: "buggy" }));
  assert.ok(s.kmh > 40 && s.kmh < 90, `kmh=${s.kmh}`);
  const big = KK.stats(build("traktor", { ...basic, motor: "v8", energie: "fass", radH: "trecker", radV: "trecker" }));
  assert.ok(big.slope > s.slope);
  assert.ok(big.mass > s.mass);
});

// Die Teststrecke soll verschiedene Bauweisen belohnen
test("Kinderwagenräder scheitern am 28°-Hang", () => {
  const r = testDrive(build("kiste", { ...basic, radH: "buggy", radV: "buggy" }));
  assert.ok(!r.finished && r.x > 290 && r.x < 360, `x=${r.x}`);
});

test("Autoreifen scheitern am 42°-Hang", () => {
  const r = testDrive(build("kiste", { ...basic, radH: "reifen", radV: "reifen" }));
  assert.ok(!r.finished && r.x > 446, `x=${r.x}`);
});

test("Traktorreifen schaffen die ganze Strecke", () => {
  const r = testDrive(build("kiste", { ...basic, radH: "trecker", radV: "trecker" }));
  assert.ok(r.finished, `x=${r.x}`);
});

test("V8 mit Kanister kommt nur knapp an, mit Fass locker", () => {
  const kan = build("leiter", { ...basic, motor: "v8", radH: "reifen", radV: "reifen" });
  assert.ok(KK.stats(kan).range < KK.TRACK.finish * 1.2);
  const fass = build("leiter", { ...basic, motor: "v8", energie: "fass", radH: "reifen", radV: "reifen" });
  assert.ok(testDrive(fass).finished);
  assert.ok(KK.stats(fass).range > KK.TRACK.finish * 2);
});
