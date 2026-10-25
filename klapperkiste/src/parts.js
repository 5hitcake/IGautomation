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
  // cap (Energievorrat), drag (Luftwiderstand +/-), tags (für Aufträge)
  // Gestaltung: from = Fundort (Ort-ID aus world.js, "start" = von Anfang an da),
  // look = wie es aussieht und woher es stammt
  KK.PARTS = [
    // --- Rahmen ---
    { id: "kiste", cat: "rahmen", name: "Seifenkiste", weight: 30, strength: 2, len: 220, from: "start",
      slots: ["motor", "energie", "lenkung", "radH", "radV", "vorne", "hinten"],
      info: "Leicht und wackelig. Kein Platz für Aufbauten.",
      look: "Eine alte Apfelkiste mit Schablonen-Schrift und Seilgriffen. Die Bretter knarzen bei jedem Huckel." },
    { id: "leiter", cat: "rahmen", name: "Lieferwagen-Rahmen", weight: 70, strength: 5, len: 300, from: "hof",
      slots: ["motor", "energie", "lenkung", "radH", "radV", "vorne", "hinten", "dach"],
      info: "Solider Stahlrahmen mit Platz für einen Aufbau.",
      look: "Stahlträger mit Lochreihe, Roststellen und einem Rest mintgrüner Lieferwagen-Farbe." },
    { id: "traktor", cat: "rahmen", name: "Traktor-Rahmen", weight: 110, strength: 8, len: 260, from: "hof",
      slots: ["motor", "energie", "lenkung", "radH", "radV", "vorne", "hinten", "dach"],
      info: "Schwer wie ein Amboss, hält fast alles aus.",
      look: "Knallroter Rahmen von Hildes altem Trecker, vorne drei Ballast-Gewichte und das Schild „07“." },

    // --- Motoren ---
    { id: "maeher", cat: "motor", name: "Rasenmäher-Motor", weight: 18, power: 10, fuel: "benzin", use: 1.0, from: "start",
      info: "Knattert fröhlich. Braucht Benzin.",
      look: "Roter Einzylinder mit Seilzug-Starter. Zwischen den Kühlrippen hängt noch Gras." },
    { id: "trommel", cat: "motor", name: "Waschmaschinen-Motor", weight: 28, power: 15, fuel: "strom", use: 0.8, from: "moor",
      info: "Läuft im Schleudergang. Braucht Strom.",
      look: "Die ganze Waschmaschine samt Programmwahl. Im Bullauge dreht sich eine vergessene Ringelsocke." },
    { id: "v8", cat: "motor", name: "Dicker V8", weight: 80, power: 38, fuel: "benzin", use: 2.6, from: "pass",
      info: "Sehr stark, sehr durstig.",
      look: "Chrom-Luftfilter, zwei rote Zylinderbänke und aufgemalte Flammen. Lag eingeschneit am Pass." },

    // --- Energie ---
    { id: "kanister", cat: "energie", name: "Benzinkanister", weight: 12, fuel: "benzin", cap: 60, from: "start",
      info: "Kleiner Vorrat Benzin.",
      look: "Roter Blechkanister mit Delle und Deckel an der Kette." },
    { id: "fass", cat: "energie", name: "Ölfass-Tank", weight: 32, fuel: "benzin", cap: 150, from: "pass",
      info: "Riesiger Benzinvorrat, aber schwer.",
      look: "Blaues Fass mit zwei Sicken, einer Beule und einem Tropfen, der nie ganz abfällt." },
    { id: "akku", cat: "energie", name: "Autobatterie", weight: 24, fuel: "strom", cap: 90, from: "moor",
      info: "Strom für Elektromotoren.",
      look: "Schwarzer Kasten mit Ladeauge und zwei Krokodilklemmen, rot und schwarz." },

    // --- Räder ---
    { id: "buggy", cat: "rad", name: "Kinderwagenrad", weight: 3, grip: 2, r: 13, from: "start",
      info: "Leicht, aber rutschig und klein.",
      look: "Weiße Speichen, rote Nabe, ein bisschen eiernd." },
    { id: "reifen", cat: "rad", name: "Autoreifen", weight: 10, grip: 5, r: 19, from: "dorf",
      info: "Guter Allrounder.",
      look: "Weißwandreifen mit Sternradkappe, wie an alten Straßenkreuzern." },
    { id: "ballon", cat: "rad", name: "Ballonreifen", weight: 6, grip: 7, r: 23, from: "leuchtturm",
      info: "Weich und leicht. Geht nicht im Matsch unter.",
      look: "Dicker, prall aufgepumpter Strandbuggy-Reifen mit Ventil und Flicken." },
    { id: "trecker", cat: "rad", name: "Traktorreifen", weight: 24, grip: 9, r: 27, from: "hof",
      info: "Krallt sich in jeden Hang.",
      look: "Grobstollen im Pfeilmuster, senfgelbe Felge mit dicken Muttern." },

    // --- Lenkung ---
    { id: "lenker", cat: "lenkung", name: "Fahrradlenker", weight: 1, from: "start",
      info: "Hauptsache, man kann lenken.",
      look: "Hollandrad-Lenker mit Klingel und bunten Bändern an den Griffen." },
    { id: "lenkrad", cat: "lenkung", name: "Holz-Lenkrad", weight: 4, strength: 1, from: "rennbahn",
      info: "Ein echtes Lenkrad mit Hupe in der Mitte.", tags: ["hupe"],
      look: "Sportlenkrad mit Holzkranz, Geschenk von Frieda nach dem Rennen." },

    // --- Extras: Vorbau ---
    { id: "stange", cat: "vorne", name: "Stoßstange", weight: 10, strength: 2, from: "start",
      info: "Schützt bei Zusammenstößen.",
      look: "Verchromter Bügel mit einem gelben Stern-Aufkleber." },
    { id: "schild", cat: "vorne", name: "Schneeschild", weight: 16, strength: 1, drag: 0.15, from: "gipfel",
      info: "Schiebt Schnee und Gerümpel weg.", tags: ["schnee"],
      look: "Gebogene Schaufel in Senfgelb mit Warnstreifen an der Kante." },
    { id: "lampe", cat: "vorne", name: "Scheinwerfer", weight: 3, from: "dorf",
      info: "Leuchtet im Dunkeln.", tags: ["licht"],
      look: "Runde Glotz-Lampe mit Blechlid. Sieht immer ein bisschen verschlafen aus." },

    // --- Extras: Heck ---
    { id: "turbo", cat: "hinten", name: "Turbo-Auspuff", weight: 6, power: 6, use: 0.6, from: "rennbahn",
      info: "Mehr Kraft, mehr Verbrauch.",
      look: "Doppelrohr mit blau angelaufenen Spitzen. Spuckt beim Gasgeben Flammen." },
    { id: "haken", cat: "hinten", name: "Anhängerkupplung", weight: 8, from: "dorf",
      info: "Damit kann man etwas abschleppen.", tags: ["ziehen"],
      look: "Kugelkopf mit Sicherungskette." },
    { id: "kran", cat: "hinten", name: "Abschleppkran", weight: 26, strength: 1, from: "steinbruch",
      info: "Hebt Lasten an. Schwer, aber nützlich.", tags: ["heben", "ziehen"],
      look: "Gelber Kranarm mit Seilwinde und Haken, abgeschraubt von einem Steinbruch-Laster." },

    // --- Extras: Aufbau ---
    { id: "dach", cat: "dach", name: "Wellblechdach", weight: 14, strength: 2, drag: 0.08, from: "leuchtturm",
      info: "Hält Regen ab.", tags: ["regen"],
      look: "Gewelltes Blech mit einem genieteten Flicken, früher das Dach vom Fahrradschuppen am Leuchtturm." },
    { id: "segel", cat: "dach", name: "Bettlaken-Segel", weight: 6, drag: -0.12, from: "gipfel",
      info: "Rückenwind macht schneller.", tags: ["wind"],
      look: "Gepunktetes Bettlaken am Besenstiel, oben ein roter Wimpel." },
    { id: "blaulicht", cat: "dach", name: "Blaulicht", weight: 4, from: "steinbruch",
      info: "Tatü-tata!", tags: ["sirene", "licht"],
      look: "Blaue Rundumleuchte auf einer Stange. Dreht sich, sobald der Motor läuft." },
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
