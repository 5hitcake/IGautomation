// German UI text. Loaded by strings.js based on detected/saved language -
// see strings.en.js for the English counterpart (same keys throughout).
export const STR = {
  title: "Kritzeldrache",

  // Tools / toolbar (used as accessible labels + tooltips)
  toolPencil: "Stift",
  toolRuler: "Lineal",
  toolEraser: "Radierer",
  toolBoostPad: "Boost-Feld",
  actionPlay: "Los",
  actionPause: "Pause",
  actionFastForward: "Doppeltes Tempo",
  actionRestart: "Neu",
  actionSettings: "Einstellungen",

  // Hints
  hintDraw: "Zeichne eine Linie mit dem Finger",
  hintRuler: "Ziehe für eine gerade Linie",
  hintRulerGone: "Keine Lineale mehr übrig – weiter mit dem Stift",
  hintBoostPad: "Tippe, um ein Boost-Feld zu setzen",
  hintPlay: "Tippe auf Los und lass den Drachen gleiten",
  hintPan: "Zwei Finger: schieben und zoomen",
  hintRotate: "Dreh dein Gerät quer",
  hintRotateSub: "Kritzeldrache spielt sich am besten im Querformat",
  hintScrub: "Ziehe am Balken, um zurückzuspulen",

  // Status
  statusCrash: "Bruchlandung! Spul zurück oder fang neu an",
  statusLost: "Der Drache ist abgestürzt",
  statusMilestone: "Weit geflogen!",
  labelDistance: "Strecke",
  unitMeters: "m",

  // Settings panel
  settingsTitle: "Einstellungen",
  settingsClose: "Fertig",
  settingsGrid: "Raster anzeigen",
  settingsTrail: "Kritzelspur",
  settingsSnap: "Linien einrasten",
  settingsSound: "Sound",
  settingsLanguage: "Sprache",
  settingsClear: "Alles löschen",
  settingsClearConfirm: "Wirklich alles löschen?",
  settingsHelpTitle: "So geht's",
  settingsHelp: [
    "Ein Finger zeichnet eine Linie.",
    "Zwei Finger schieben und zoomen die Seite.",
    "Der Stift zeichnet frei, das Lineal zieht gerade Linien.",
    "Start nah am Ende der letzten Linie, um anzuknüpfen.",
    "Mit dem Radierer wischst du Linien weg.",
    "Im freien Kritzeln: mit dem Boost-Feld-Werkzeug eigene Boost-Felder setzen, der Radierer entfernt sie wieder.",
    "In der Kampagne: Hindernissen ausweichen, Boost-Felder mitnehmen, goldenes Ei erreichen.",
    "Das Lineal ist in der Kampagne begrenzt - je nach Levellänge stehen dir ein paar gerade Linien zur Verfügung.",
    "Doppeltes Tempo lässt den Drachen beim Gleiten schneller fliegen.",
    "Münzen und Truhen unterwegs sind freiwillig - im Shop gegen Farben, Muster und Outfits eintauschbar.",
    "Leertaste = Los / Pause, R = Neu (Tastatur).",
  ],
  settingsCredits: "Ein Kritzel-Abenteuer auf kariertem Papier",
  settingsMenu: "Hauptmenü",

  // Main menu
  welcomeTitle: "Kritzeldrache",
  welcomeBody: "Zeichne eine Bahn und schick den Papierdrachen los.",
  btnFreeDraw: "Freies Kritzeln",
  btnCampaign: "Kampagne",
  btnShop: "Shop",

  // Shop (cosmetics bought with coins collected in campaign levels)
  shopTitle: "Shop",
  shopCoinsLabel: "Münzen",
  shopSectionColors: "Drachenfarbe",
  shopSectionPatterns: "Muster",
  shopSectionPenColor: "Stiftfarbe",
  shopSectionOutfits: "Outfit",
  shopHintLocked: "Zu wenig Münzen",
  shopSectionGetCoins: "Mehr Münzen bekommen",
  shopWatchAd: "Werbevideo schauen",
  shopAdCooldown: "Gleich nochmal versuchen - kurz warten",
  shopAdUnavailable: "Gerade nicht verfügbar - später nochmal versuchen",
  colorNames: { red:"Rot", blue:"Blau", green:"Grün", purple:"Lila", gold:"Gold" },
  patternNames: { none:"Ohne", stripes:"Streifen", stars:"Sterne" },
  outfitNames: {
    none:"Kein Outfit", goggles:"Fliegerbrille", scarf:"Schal", flower:"Blume",
    partyhat:"Partyhut", pilotcap:"Pilotenmütze", tophat:"Zylinder", cape:"Umhang", crown:"Krone",
  },

  // Level select
  levelSelectTitle: "Kampagne",
  levelWord: "Level",
  lockedLabel: "Gesperrt",
  completedBadge: "✓ Geschafft",
  btnBackToMenu: "Zurück",

  // Win screen
  winTitle: "Level geschafft!",
  winBody: "Der Drache hat das goldene Ei erreicht!",
  btnNextLevel: "Nächstes Level",
  btnLevelSelect: "Level-Auswahl",
  btnRetryLevel: "Nochmal",
};
