// Teststrecke hinter der Werkstatt. Höhen in Metern, x in Metern.
(function (KK) {
  const POINTS = [
    [0, 0], [60, 0], [110, 12], [150, 12], [190, 0], [230, 0],
    // Schotterpiste 230-300 (Höcker kommen aus bumps())
    [300, 0], [356, 30], [386, 30], [416, 14], [446, 14],
    [446.5, 14], [502, 64], [532, 64], [612, 0], [700, 0],
  ];
  const ROUGH = [230, 300];

  function base(x) {
    if (x <= POINTS[0][0]) return POINTS[0][1];
    for (let i = 1; i < POINTS.length; i++) {
      const [x1, y1] = POINTS[i];
      if (x <= x1) {
        const [x0, y0] = POINTS[i - 1];
        return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
      }
    }
    return POINTS[POINTS.length - 1][1];
  }

  function bumps(x) {
    if (x < ROUGH[0] || x > ROUGH[1]) return 0;
    const fade = Math.min(1, (x - ROUGH[0]) / 5, (ROUGH[1] - x) / 5);
    return fade * (0.22 * Math.abs(Math.sin(x * 1.7)) + 0.1 * Math.sin(x * 4.3));
  }

  const slopeDeg = (a, b) =>
    Math.round((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI);

  KK.TRACK = {
    start: 2,
    finish: 680,
    length: 698,
    rough: ROUGH,
    height: (x) => base(x) + bumps(x),
    roughness: (x) => (x >= ROUGH[0] && x <= ROUGH[1] ? 1 : 0),
    signs: [
      { x: 55, text: slopeDeg(POINTS[1], POINTS[2]) + "°" },
      { x: 226, text: "Schotter" },
      { x: 296, text: slopeDeg(POINTS[6], POINTS[7]) + "°" },
      { x: 442, text: slopeDeg(POINTS[11], POINTS[12]) + "°" },
    ],
  };
})(globalThis.KK = globalThis.KK || {});
