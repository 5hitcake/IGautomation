// Teile-Katalog. Reine Daten, keine Logik - neue Teile kommen nur hier dazu.
//
// Koordinaten: lokales Auto-System in Pixeln, x zeigt nach vorne (rechts),
// y nach unten, (0,0) ist die Mitte des Rahmens. Slot-Positionen sind als
// Anteil der Rahmenlänge L angegeben, damit sie auf jedem Rahmen passen.
(function (KK) {
  // Slot-Typen: welche Teilekategorie in welchen Platz passt.
  KK.SLOTS = {
    motor:    { label: "Motor",     accepts: "motor" },
    energie:  { label: "Energie",   accepts: "energie" },
    lenkung:  { label: "Lenkung",   accepts: "lenkung" },
    radH:     { label: "Hinterrad", accepts: "rad" },
    radV:     { label: "Vorderrad", accepts: "rad" },
    vorne:    { label: "Vorbau",    accepts: "vorne" },
    hinten:   { label: "Heck",      accepts: "hinten" },
    dach:     { label: "Aufbau",    accepts: "dach" },
  };

  // Slot-Position je Rahmen: [x als Anteil von L, y in px]
  const BASE_SLOTS = {
    motor:   [-0.30, -22],
    energie: [-0.07, -18],
    lenkung: [0.24, -30],
    radH:    [-0.34, 14],
    radV:    [0.34, 14],
    vorne:   [0.5, -2],
    hinten:  [-0.5, -2],
    dach:    [0.0, -78],
  };

  KK.CATEGORIES = [
    { id: "rahmen",  label: "Rahmen" },
    { id: "motor",   label: "Motoren" },
    { id: "energie", label: "Energie" },
    { id: "rad",     label: "Räder" },
    { id: "lenkung", label: "Lenkung" },
    { id: "extra",   label: "Extras", includes: ["vorne", "hinten", "dach"] },
  ];

  // Gemeinsame Felder: id, cat, name, info, weight (kg)
  // Optionale Werte: power (Kraft-Einheiten), strength (Robustheit), grip,
  // r (Radradius px), fuel ("benzin"|"strom"), use (Verbrauch/s),
  // cap (Energievorrat), drag (Luftwiderstand +/-), tags (für spätere Aufträge)
  KK.PARTS = [
    // --- Rahmen ---
    { id: "kiste", cat: "rahmen", name: "Seifenkiste", weight: 30, strength: 2, len: 220,
      slots: ["motor", "energie", "lenkung", "radH", "radV", "vorne", "hinten"],
      info: "Leicht und wackelig. Kein Platz für Aufbauten." },
    { id: "leiter", cat: "rahmen", name: "Lieferwagen-Rahmen", weight: 70, strength: 5, len: 300,
      slots: ["motor", "energie", "lenkung", "radH", "radV", "vorne", "hinten", "dach"],
      info: "Solider Stahlrahmen mit Platz für einen Aufbau." },
    { id: "traktor", cat: "rahmen", name: "Traktor-Rahmen", weight: 110, strength: 8, len: 260,
      slots: ["motor", "energie", "lenkung", "radH", "radV", "vorne", "hinten", "dach"],
      info: "Schwer wie ein Amboss, hält fast alles aus." },

    // --- Motoren ---
    { id: "maeher", cat: "motor", name: "Rasenmäher-Motor", weight: 18, power: 10, fuel: "benzin", use: 1.0,
      info: "Knattert fröhlich. Braucht Benzin." },
    { id: "trommel", cat: "motor", name: "Waschmaschinen-Motor", weight: 28, power: 15, fuel: "strom", use: 0.8,
      info: "Läuft im Schleudergang. Braucht Strom." },
    { id: "v8", cat: "motor", name: "Dicker V8", weight: 80, power: 38, fuel: "benzin", use: 2.6,
      info: "Sehr stark, sehr durstig." },

    // --- Energie ---
    { id: "kanister", cat: "energie", name: "Benzinkanister", weight: 12, fuel: "benzin", cap: 60,
      info: "Kleiner Vorrat Benzin." },
    { id: "fass", cat: "energie", name: "Ölfass-Tank", weight: 32, fuel: "benzin", cap: 150,
      info: "Riesiger Benzinvorrat, aber schwer." },
    { id: "akku", cat: "energie", name: "Autobatterie", weight: 24, fuel: "strom", cap: 90,
      info: "Strom für Elektromotoren." },

    // --- Räder ---
    { id: "buggy", cat: "rad", name: "Kinderwagenrad", weight: 3, grip: 2, r: 13,
      info: "Leicht, aber rutschig und klein." },
    { id: "reifen", cat: "rad", name: "Autoreifen", weight: 10, grip: 5, r: 19,
      info: "Guter Allrounder." },
    { id: "trecker", cat: "rad", name: "Traktorreifen", weight: 24, grip: 9, r: 27,
      info: "Krallt sich in jeden Hang." },

    // --- Lenkung ---
    { id: "lenker", cat: "lenkung", name: "Fahrradlenker", weight: 1,
      info: "Hauptsache, man kann lenken." },
    { id: "lenkrad", cat: "lenkung", name: "Lenkrad", weight: 4, strength: 1,
      info: "Ein echtes Lenkrad mit Hupe in der Mitte.", tags: ["hupe"] },

    // --- Extras: Vorbau ---
    { id: "stange", cat: "vorne", name: "Stoßstange", weight: 10, strength: 2,
      info: "Schützt bei Zusammenstößen." },
    { id: "schild", cat: "vorne", name: "Schneeschild", weight: 16, strength: 1, drag: 0.15,
      info: "Schiebt Schnee und Gerümpel weg.", tags: ["schnee"] },
    { id: "lampe", cat: "vorne", name: "Scheinwerfer", weight: 3,
      info: "Leuchtet im Dunkeln.", tags: ["licht"] },

    // --- Extras: Heck ---
    { id: "turbo", cat: "hinten", name: "Turbo-Auspuff", weight: 6, power: 6, use: 0.6,
      info: "Mehr Kraft, mehr Verbrauch." },
    { id: "haken", cat: "hinten", name: "Anhängerkupplung", weight: 8,
      info: "Damit kann man etwas abschleppen.", tags: ["ziehen"] },

    // --- Extras: Aufbau ---
    { id: "dach", cat: "dach", name: "Blechdach", weight: 14, strength: 2, drag: 0.08,
      info: "Hält Regen ab.", tags: ["regen"] },
    { id: "segel", cat: "dach", name: "Segel", weight: 6, drag: -0.12,
      info: "Rückenwind macht schneller.", tags: ["wind"] },
    { id: "blaulicht", cat: "dach", name: "Blaulicht", weight: 4,
      info: "Tatü-tata!", tags: ["sirene", "licht"] },
  ];

  KK.PART = Object.fromEntries(KK.PARTS.map((p) => [p.id, p]));

  KK.DRIVER_WEIGHT = 30;

  // Position eines Slots auf einem Rahmen in lokalen px
  KK.slotPos = function (chassis, slotId) {
    const [fx, y] = BASE_SLOTS[slotId];
    return { x: fx * chassis.len, y };
  };

  // Welche Slots akzeptieren ein Teil (auf diesem Rahmen)?
  KK.slotsFor = function (chassis, part) {
    if (!chassis || part.cat === "rahmen") return [];
    return chassis.slots.filter((s) => KK.SLOTS[s].accepts === part.cat);
  };
})(globalThis.KK = globalThis.KK || {});
