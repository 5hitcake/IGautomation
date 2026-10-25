// Prüft, dass sich die Welt in der vorgesehenen Reihenfolge durchspielen lässt.
const test = require("node:test");
const assert = require("node:assert");
for (const f of ["parts", "car", "track", "world"]) require(`../src/${f}.js`);
const KK = globalThis.KK;

// Alle Bauweisen aus den verfügbaren Teilen durchprobieren
function findSolution(owned, req) {
  const of = (cat) => KK.PARTS.filter((p) => p.cat === cat && owned.has(p.id)).map((p) => p.id);
  const opt = (cat) => [null, ...of(cat)];
  for (const ch of of("rahmen")) for (const m of of("motor")) for (const e of of("energie"))
    for (const rh of of("rad")) for (const rv of of("rad")) for (const l of of("lenkung"))
      for (const v of opt("vorne")) for (const h of opt("hinten")) for (const d of opt("dach")) {
        const parts = { motor: m, energie: e, radH: rh, radV: rv, lenkung: l, vorne: v, hinten: h, dach: d };
        let b = KK.setChassis(KK.emptyBuild(), ch);
        for (const [slot, pid] of Object.entries(parts)) if (pid) b = KK.placePart(b, slot, pid);
        if (KK.missionGaps(b, req).length === 0) return b;
      }
  return null;
}

test("Jeder Ort hat gültige Belohnungen und Fundorte", () => {
  for (const place of KK.PLACES) for (const pid of place.reward) assert.ok(KK.PART[pid], pid);
  for (const part of KK.PARTS) {
    assert.ok(KK.PLACE[part.from], `${part.id}: unbekannter Fundort ${part.from}`);
    if (part.from !== "start") assert.ok(KK.PLACE[part.from].reward.includes(part.id), part.id);
  }
});

test("Aufträge sind der Reihe nach lösbar, aber nicht schon mit den Startteilen", () => {
  const owned = new Set(KK.PARTS.filter((p) => p.from === "start").map((p) => p.id));
  KK.PLACES.forEach((place, i) => {
    assert.ok(findSolution(owned, place.req), `${place.id} ist mit den bisherigen Teilen nicht lösbar`);
    if (i > 0) {
      const start = new Set(KK.PARTS.filter((p) => p.from === "start").map((p) => p.id));
      assert.strictEqual(findSolution(start, place.req), null, `${place.id} ist schon mit Startteilen lösbar`);
    }
    place.reward.forEach((pid) => owned.add(pid));
  });
});
