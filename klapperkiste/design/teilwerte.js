// Werte und Beschreibungen der Teile (erster Entwurf, wird beim Spielen nachgestellt).
// Die Werkstatt zeigt sie im Info-Feld und rechnet daraus die Werte des ganzen Autos.
//
// Werte (alle freiwillig):
//   tempo      Höchstgeschwindigkeit in km/h (Motor)
//   kraft      schafft Steigungen bis so viel Grad (Motor)
//   reichweite Meter mit einer Füllung (Energie)
//   grip       Bodenhaftung 1–10 (Räder)
//   wendig     Wendigkeit 1–10 (Lenkung)
//   komfort    1–10 (Sitz)
//   robust     Robustheit 1–10 (Rahmen, Achse, Karosserie)
//   licht      Leuchtweite in Metern (Licht)
//   laut       Lautstärke 1–10 (Hupe)
//   gewicht    kg, bei Rädern und Achsen je Stück
// text: ein, zwei Sätze zum Teil. extras: kurze Besonderheiten.
window.TEILWERTE = (function () {
  const W = {
    bettgestell: { robust: 2, gewicht: 25, text: "Ein altes Eisenbett, die Matratze ist längst weg. Trägt alles, quietscht aber bei jeder Bodenwelle.", extras: ["Quietscht"] },
    rostachse: { robust: 2, gewicht: 8, text: "Rostig, aber sie dreht sich noch. Meistens.", extras: [] },

    schubkarre: { grip: 2, gewicht: 4, text: "Klein, leicht und hart wie ein Stein. Auf glatten Wegen reicht das.", extras: ["Nur für glatte Wege"] },
    autoreifen: { grip: 6, gewicht: 12, text: "Ein ganz normaler Autoreifen. Fährt sich überall ordentlich.", extras: ["Allrounder"] },
    traktorreifen: { grip: 8, gewicht: 30, text: "Riesig und mit tiefem Profil. Matsch und nasse Wiese sind kein Problem.", extras: ["Matsch", "Wiese", "Schwer"] },
    schneeketten: { grip: 7, gewicht: 16, text: "Mit Ketten drum herum beißt sich das Rad in Schnee und Eis.", extras: ["Schnee", "Eis"] },
    ballonreifen: { grip: 4, gewicht: 6, text: "Dick aufgepumpt und federleicht. Sinkt im Moor nicht ein.", extras: ["Moor", "Federt weich"] },
    kutschenrad: { grip: 3, gewicht: 10, text: "Ein Holzrad mit Eisenring. Hübsch anzusehen, aber ganz schön wackelig.", extras: ["Hübsch", "Wackelt"] },

    maeher: { tempo: 15, kraft: 8, gewicht: 20, text: "Der Motor von Opas altem Rasenmäher. Knattert laut und zieht kaum einen Hering vom Teller.", extras: ["Knattert"] },
    mopedmotor: { tempo: 35, kraft: 10, gewicht: 25, text: "Flink und sparsam, aber am Berg schnell aus der Puste.", extras: ["Sparsam"] },
    waschmaschinenmotor: { tempo: 25, kraft: 15, gewicht: 35, text: "Läuft mit Strom und schleudert ordentlich. Ohne Batterie bewegt er sich aber keinen Millimeter.", extras: ["Braucht Strom", "Leise"] },
    traktormotor: { tempo: 30, kraft: 35, gewicht: 120, text: "Langsam, schwer und unglaublich stark. Zieht dich jeden Berg hinauf.", extras: ["Bergziege", "Schwer"] },
    raketenmotor: { tempo: 120, kraft: 20, gewicht: 60, text: "Fauch! Geradeaus unschlagbar schnell, in Kurven eher ein Abenteuer.", extras: ["Sehr schnell", "Durstig"] },

    giesskanne: { reichweite: 1500, gewicht: 3, text: "Eine Gießkanne voll Sprit. Reicht für eine kurze Runde ums Haus.", extras: [] },
    milchkanne: { reichweite: 2200, gewicht: 10, text: "Eine große Milchkanne vom Bauernhof, jetzt mit Benzin statt Milch.", extras: [] },
    kanister: { reichweite: 3500, gewicht: 20, text: "Ein echter Benzinkanister. Damit kommst du richtig weit.", extras: ["Weite Strecken"] },
    batterieturm: { reichweite: 2800, gewicht: 30, text: "Ein Turm aus Batterien. Liefert Strom für Elektromotoren.", extras: ["Strom"] },

    kuechenstuhl: { komfort: 2, gewicht: 5, text: "Ein harter Küchenstuhl. Nach einer Weile tut der Po weh.", extras: [] },
    traktorsitz: { komfort: 5, gewicht: 12, text: "Ein gefederter Blechsitz vom Traktor. Schluckt die gröbsten Stöße.", extras: ["Gefedert"] },
    sofasessel: { komfort: 9, gewicht: 30, text: "Opas Ohrensessel. Herrlich gemütlich, aber schwer wie ein Sack Kartoffeln.", extras: ["Gemütlich", "Schwer"] },
    rennschale: { komfort: 4, gewicht: 8, text: "Ein Sitz aus dem Rennwagen. Hält dich in jeder Kurve fest.", extras: ["Kurvenhalt"] },

    fahrradlenker: { wendig: 4, gewicht: 2, text: "Ein Fahrradlenker mit Klingel. Lenkt sich ein bisschen zappelig.", extras: ["Klingel"] },
    bus_lenkrad: { wendig: 6, gewicht: 6, text: "Ein riesiges Lenkrad aus einem alten Bus. Ruhig und sicher.", extras: [] },
    steuerrad: { wendig: 7, gewicht: 9, text: "Ein Steuerrad vom Schiff. Ahoi! Lenkt sich weich und weit.", extras: ["Ahoi"] },

    scheinwerfer: { licht: 25, gewicht: 4, text: "Ein alter Scheinwerfer. Damit wird der dunkle Wald befahrbar.", extras: ["Dunkler Wald", "Braucht Strom"] },
    spezialhupe: { laut: 10, gewicht: 2, text: "Laut wie ein Nebelhorn. Selbst die sturste Schafherde macht Platz.", extras: ["Verscheucht Schafe"] },
  };

  // Karosserie: Werte je Teil (hinten, Mitte, vorne), die Fähigkeit gilt nur als kompletter Satz
  const MODELLE = {
    rundling: [3, 15, "Klein, rund und leicht. Passt in jede Garage.", "Leicht"],
    pickup: [5, 25, "Ein kantiger Pick-up mit offener Ladefläche.", "Große Ladefläche"],
    badewanne: [4, 35, "Eine alte Badewanne mit Gummiente vorne drauf.", "Schwimmt durch Furten"],
    telefonzelle: [4, 30, "Eine rote Telefonzelle auf Rädern.", "Regen- und Windschutz"],
    eiswagen: [3, 28, "Ein Eiswagen mit Truhe und gestreifter Markise.", "Eis verkaufen, Kühlware bleibt frisch"],
    heuscheune: [3, 30, "Eine kleine Scheune mit Heu und Kuhglocke.", "Tiere transportieren"],
    rakete: [4, 20, "Eine Rakete mit Heckflossen und Cockpit-Kuppel.", "Tempo höher"],
    kutsche: [3, 25, "Eine feine Kutsche mit Gardinen und Laterne.", "Komfort, Hochzeitsauftrag"],
    hotdog: [3, 28, "Ein hoher Kastenwagen mit Riesen-Hot-Dog auf dem Dach.", "Unterwegs verkaufen, Hunde laufen hinterher"],
    feuerwehr: [6, 35, "Eine rote Feuerwehr mit Glocke und Schlauch.", "Brände löschen"],
    betonmischer: [7, 45, "Ein Betonmischer mit großer Trommel.", "Kaputte Brücken und Wege reparieren"],
    wohnwagen: [3, 30, "Ein runder Mini-Wohnwagen mit Küchenklappe.", "Übernachten"],
    geldtransporter: [10, 50, "Gepanzert, mit Tresorrad. Hält einiges aus.", "Sehr robust"],
    schneeraupe: [6, 35, "Mit beheizter Kabine und großem Räumschild.", "Kälteschutz, räumt Schnee"],
    gewaechshaus: [1, 22, "Ein Glashaus voller Tomaten und Tulpen.", "Pflanzen liefern"],
    zirkus: [2, 25, "Ein Zirkuswagen mit Kuppel und Clownsnase.", "Zuschauer locken"],
    schlauchboot: [1, 8, "Ein Schlauchboot mit Paddeln.", "Über die Seen zu den Inseln"],
  };
  for (const [m, [robust, gewicht, text, satz]] of Object.entries(MODELLE)) {
    for (const teil of ["hinten", "mitte", "vorne"]) {
      W[`${m}_${teil}`] = { robust, gewicht, text, extras: [], satz };
    }
  }
  return W;
})();
