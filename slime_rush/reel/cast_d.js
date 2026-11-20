// Besetzung „Konzept D – Festival“: 6 Figuren, nur Hindernislauf im Stadion → Podest.
// Posen pro Figur: idle (Jubel), run1/run2 (Laufen), jump, hit  →  Bilder in ASSETS als d_<id>_<pose>
const CAST = {
  mode: 'race', game: 'track', bg: 'bg_stadion', title: 'BRAND ARENA', size: 68, len: 4600, keep: 3, label: 'TESTRENNEN · CARRERA DE PRUEBA',
  brands: [['Kai', 'd_rot'], ['Leo', 'd_blau'], ['Zap', 'd_gelb'], ['Nova', 'd_lila'], ['Sunny', 'd_orange'], ['Sky', 'd_hellblau']],
  hex: { d_rot: '#e8413c', d_blau: '#2f5fd0', d_gelb: '#86b812', d_lila: '#9b59d6', d_orange: '#f28a12', d_hellblau: '#3fa4ef' },
  pose: { eliminated: 'hit', victory: 'idle' },
};
