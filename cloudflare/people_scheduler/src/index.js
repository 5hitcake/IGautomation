// Startet zu jedem Cron-Termin den passenden Modus von people_post.yml.
// Secrets (per wrangler aus den GitHub-Secrets gesetzt):
//   GH_DISPATCH_TOKEN   fein granularer GitHub-Token, nur dieses Repo, "Actions: Read and write"
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID   Warnung, falls der Start scheitert
export const SCHEDULE = {
  "30 7 * * *": "Morgen-Freigabe (2 Personen fuer 8:13 + 14:13)",
  "13 11 * * *": "Warteschlange 8:13 jetzt posten",
  "13 17 * * *": "Warteschlange 14:13 jetzt posten",
  "43 20 * * *": "Abend-Freigabe (Reel fuer 20:43)",
};

async function dispatch(env, mode) {
  const url = `https://api.github.com/repos/${env.GH_REPO}/actions/workflows/${env.GH_WORKFLOW}/dispatches`;
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "people-scheduler",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: env.GH_REF || "main", inputs: { mode } }),
  });
}

async function warn(env, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
  });
}

export default {
  async scheduled(event, env) {
    const mode = SCHEDULE[event.cron];
    if (!mode) {
      console.log(`Unbekannter Termin: ${event.cron}`);
      return;
    }
    let detail = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await dispatch(env, mode);
      if (res.status === 204) {
        console.log(`Gestartet: ${mode}`);
        return;
      }
      detail = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
      console.log(`Versuch ${attempt} fehlgeschlagen - ${detail}`);
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
    await warn(env, `⚠️ Zeitgeber konnte "${mode}" nicht starten (${detail}). Bitte in GitHub Actions per Run workflow starten.`);
    throw new Error(`Dispatch fehlgeschlagen: ${detail}`);
  },
};
