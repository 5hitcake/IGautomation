// Einstieg: Bauplan laden, Werkstatt und Probefahrt verbinden.
(function (KK) {
  const SAVE_KEY = "klapperkiste.build.v1";

  // Erster Start: fast fertiges Auto, nur ein Rad fehlt - so sieht man
  // sofort, wie das Bauen funktioniert.
  const STARTER = {
    chassis: "kiste",
    parts: { motor: "maeher", energie: "kanister", lenkung: "lenker", radH: "buggy" },
  };

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return STARTER;
      const b = JSON.parse(raw);
      // Teile, die es nicht mehr gibt, werden still entfernt
      if (b.chassis && !KK.PART[b.chassis]) return STARTER;
      let clean = b.chassis ? KK.setChassis(KK.emptyBuild(), b.chassis) : KK.emptyBuild();
      for (const [slot, pid] of Object.entries(b.parts || {})) {
        if (KK.PART[pid]) clean = KK.placePart(clean, slot, pid);
      }
      return clean;
    } catch {
      return STARTER;
    }
  }

  function save(build) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(build)); } catch { /* egal */ }
  }

  function start() {
    KK.garage.init(load(), save);
    KK.drive.init(() => { KK.drive.hide(); KK.garage.show(); });
    document.getElementById("btn-drive").onclick = () => {
      if (KK.problems(KK.garage.build).length) return;
      KK.garage.hide();
      KK.drive.show(KK.garage.build);
    };
    KK.garage.show();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})(globalThis.KK = globalThis.KK || {});
