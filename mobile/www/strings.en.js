// English UI text. Loaded by strings.js based on detected/saved language -
// see strings.de.js for the German counterpart (same keys throughout).
// The game is titled "Dragonslide" in English (vs. "Kritzeldrache" in German).
export const STR = {
  title: "Dragonslide",

  // Tools / toolbar (used as accessible labels + tooltips)
  toolPencil: "Pencil",
  toolRuler: "Ruler",
  toolEraser: "Eraser",
  toolBoostPad: "Boost Pad",
  actionPlay: "Go",
  actionPause: "Pause",
  actionFastForward: "Double Speed",
  actionRestart: "Restart",
  actionSettings: "Settings",

  // Hints
  hintDraw: "Draw a line with your finger",
  hintRuler: "Drag for a straight line",
  hintRulerGone: "No rulers left - use the pencil instead",
  hintBoostPad: "Tap to place a boost pad",
  hintPlay: "Tap Go and let the dragon glide",
  hintPan: "Two fingers: pan and zoom",
  hintRotate: "Turn your device sideways",
  hintRotateSub: "Dragonslide plays best in landscape",
  hintScrub: "Drag the bar to rewind",

  // Status
  statusCrash: "Crash landing! Rewind or start over",
  statusLost: "The dragon crashed",
  statusMilestone: "Flying far!",
  labelDistance: "Distance",
  unitMeters: "m",

  // Settings panel
  settingsTitle: "Settings",
  settingsClose: "Done",
  settingsGrid: "Show grid",
  settingsTrail: "Doodle trail",
  settingsSnap: "Snap lines",
  settingsSound: "Sound",
  settingsLanguage: "Language",
  settingsClear: "Clear all",
  settingsClearConfirm: "Really clear everything?",
  settingsHelpTitle: "How to play",
  settingsHelp: [
    "One finger draws a line.",
    "Two fingers pan and zoom the page.",
    "The pencil draws freehand, the ruler draws straight lines.",
    "Start near the end of your last line to connect to it.",
    "Use the eraser to wipe lines away.",
    "In free draw: use the boost-pad tool to place your own boost pads, the eraser removes them again.",
    "In the campaign: dodge obstacles, grab boost pads, reach the golden egg.",
    "The ruler is limited in the campaign - you get a few straight lines depending on the level's length.",
    "Double speed makes the dragon glide faster.",
    "Coins and chests along the way are optional - trade them in the shop for colors, patterns and outfits.",
    "Spacebar = Go / Pause, R = Restart (keyboard).",
  ],
  settingsCredits: "A doodle adventure on graph paper",
  settingsMenu: "Main Menu",

  // Main menu
  welcomeTitle: "Dragonslide",
  welcomeBody: "Draw a track and send the paper dragon flying.",
  btnFreeDraw: "Free Draw",
  btnCampaign: "Campaign",
  btnShop: "Shop",

  // Shop (cosmetics bought with coins collected in campaign levels)
  shopTitle: "Shop",
  shopCoinsLabel: "Coins",
  shopSectionColors: "Dragon Color",
  shopSectionPatterns: "Pattern",
  shopSectionPenColor: "Pen Color",
  shopSectionOutfits: "Outfit",
  shopHintLocked: "Not enough coins",
  colorNames: { red:"Red", blue:"Blue", green:"Green", purple:"Purple", gold:"Gold" },
  patternNames: { none:"None", stripes:"Stripes", stars:"Stars" },
  outfitNames: {
    none:"No Outfit", goggles:"Goggles", scarf:"Scarf", flower:"Flower",
    partyhat:"Party Hat", pilotcap:"Pilot Cap", tophat:"Top Hat", cape:"Cape", crown:"Crown",
  },

  // Level select
  levelSelectTitle: "Campaign",
  levelWord: "Level",
  lockedLabel: "Locked",
  completedBadge: "✓ Done",
  btnBackToMenu: "Back",

  // Win screen
  winTitle: "Level complete!",
  winBody: "The dragon reached the golden egg!",
  btnNextLevel: "Next Level",
  btnLevelSelect: "Level Select",
  btnRetryLevel: "Retry",
};
