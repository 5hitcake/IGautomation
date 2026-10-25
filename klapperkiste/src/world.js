// Die Welt: Klappertal. Orte, Nachbarn, Aufträge und Belohnungen.
// Kartenkoordinaten in einem 1000 x 700 Raster (siehe map.js).
(function (KK) {
  KK.HOME = { id: "start", name: "Schrottplatz", who: "Rita", role: "Mechanikerin", pos: [215, 560] };

  // req: kmh, slope, grip, strength, range (Mindestwerte), maxMass, tags
  // Reihenfolge = vorgesehener Spielfortschritt
  KK.PLACES = [
    { id: "dorf", name: "Dorfplatz", who: "Bruno", role: "Bäcker", pos: [480, 410],
      task: "Die Brötchen müssen zum Frühstück überall sein, bevor sie kalt werden.",
      req: { kmh: 50 }, reward: ["reifen", "lampe", "haken"] },
    { id: "hof", name: "Hof Krautkopf", who: "Hilde", role: "Bäuerin", pos: [430, 600],
      task: "Der Heuwagen steckt am Hang fest. Kannst du ihn in die Scheune ziehen?",
      req: { tags: ["ziehen"], slope: 25 }, reward: ["trecker", "traktor", "leiter"] },
    { id: "leuchtturm", name: "Leuchtturm", who: "Lotte", role: "Leuchtturmwärterin", pos: [885, 420],
      task: "Meine Lampe ist kaputt. Leuchte dem Fischkutter über den holprigen Klippenweg heim.",
      req: { tags: ["licht"], strength: 4 }, reward: ["ballon", "dach"] },
    { id: "moor", name: "Unkenmoor", who: "Ulla", role: "Moorforscherin", pos: [125, 315],
      task: "Meine Messgeräte stehen mitten im Moor. Schwere Autos versinken sofort.",
      req: { grip: 7, maxMass: 130 }, reward: ["trommel", "akku"] },
    { id: "gipfel", name: "Gipfelhütte", who: "Sepp", role: "Hüttenwirt", pos: [385, 120],
      task: "Bring Proviant hoch zur Hütte. Der Weg ist lang und richtig steil.",
      req: { slope: 40, range: 1500 }, reward: ["schild", "segel"] },
    { id: "pass", name: "Frostpass", who: "Frost", role: "Wetterforscherin", pos: [640, 95],
      task: "Der Pass ist zugeschneit. Räum den Weg frei, ohne dass dein Auto auseinanderfällt.",
      req: { tags: ["schnee"], strength: 6 }, reward: ["v8", "fass"] },
    { id: "rennbahn", name: "Kiesrennbahn", who: "Frieda", role: "Rennfahrerin", pos: [745, 575],
      task: "Fahr gegen mich! Unter 100 km/h brauchst du gar nicht erst antreten.",
      req: { kmh: 100 }, reward: ["turbo", "lenkrad"] },
    { id: "steinbruch", name: "Steinbruch", who: "Rocko", role: "Sprengmeister", pos: [190, 140],
      task: "Hier fallen ständig Steine. Nur ein sehr robustes Auto kommt die Rampe hoch.",
      req: { strength: 10, slope: 30 }, reward: ["kran", "blaulicht"] },
    { id: "feuerwache", name: "Feuerwache", who: "Funke", role: "Feuerwehrfrau", pos: [590, 320],
      task: "Kater Moppel sitzt auf dem Kirchturm! Wir brauchen Kran und Blaulicht.",
      req: { tags: ["heben", "sirene"] }, reward: [] },
  ];

  KK.ROADS = [
    ["start", "hof"], ["start", "dorf"], ["start", "moor"], ["dorf", "hof"],
    ["dorf", "feuerwache"], ["dorf", "rennbahn"], ["rennbahn", "leuchtturm"],
    ["feuerwache", "leuchtturm"], ["feuerwache", "pass"], ["dorf", "gipfel"],
    ["moor", "steinbruch"], ["steinbruch", "gipfel"], ["gipfel", "pass"],
  ];

  KK.PLACE = Object.fromEntries([KK.HOME, ...KK.PLACES].map((p) => [p.id, p]));

  const TAG_TEXT = {
    ziehen: "etwas zum Ziehen", licht: "Licht", schnee: "ein Schneeschild",
    heben: "einen Kran", sirene: "ein Blaulicht", wind: "ein Segel", hupe: "eine Hupe",
  };

  // Bedingungen als kurze Stichworte (für Karte und Gestaltungsbuch)
  KK.reqLabels = function (req) {
    const out = [];
    if (req.kmh) out.push(`ab ${req.kmh} km/h`);
    if (req.slope) out.push(`Steigung ab ${req.slope}°`);
    if (req.grip) out.push(`Grip ab ${req.grip}`);
    if (req.strength) out.push(`Robustheit ab ${req.strength}`);
    if (req.range) out.push(`Reichweite ab ${req.range} m`);
    if (req.maxMass) out.push(`höchstens ${req.maxMass} kg`);
    for (const t of req.tags || []) out.push(TAG_TEXT[t][0].toUpperCase() + TAG_TEXT[t].slice(1));
    return out;
  };

  // Was fehlt dem Auto für diesen Auftrag? Leere Liste = geschafft.
  KK.missionGaps = function (build, req) {
    if (KK.problems(build).length) return ["Das Auto ist noch nicht fahrbereit."];
    const st = KK.stats(build);
    const gaps = [];
    if (req.kmh && st.kmh < req.kmh) gaps.push(`Zu langsam: ${st.kmh} statt ${req.kmh} km/h.`);
    if (req.slope && st.slope < req.slope) gaps.push(`Schafft nur ${st.slope}° statt ${req.slope}°.`);
    if (req.grip && st.grip < req.grip) gaps.push(`Zu wenig Grip: ${st.grip} statt ${req.grip}.`);
    if (req.strength && st.strength < req.strength) gaps.push(`Nicht robust genug: ${st.strength} statt ${req.strength}.`);
    if (req.range && st.range < req.range) gaps.push(`Reichweite ${st.range} m statt ${req.range} m.`);
    if (req.maxMass && st.mass > req.maxMass) gaps.push(`Zu schwer: ${st.mass} statt höchstens ${req.maxMass} kg.`);
    for (const t of req.tags || []) if (!st.tags.includes(t)) gaps.push(`Es fehlt ${TAG_TEXT[t]}.`);
    return gaps;
  };
})(globalThis.KK = globalThis.KK || {});
