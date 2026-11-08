// Startet zu jedem Cron-Termin den passenden Modus von people_post.yml bzw. story_reels.yml.
// Secrets (per wrangler aus den GitHub-Secrets gesetzt):
//   GH_DISPATCH_TOKEN   fein granularer GitHub-Token, nur dieses Repo, "Actions: Read and write"
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID   Warnung, falls der Start scheitert
export const SCHEDULE = {
  "30 7 * * *": "Morgen-Freigabe (2 Personen fuer 8:13 + 14:13)",
  "13 11 * * *": "Warteschlange 8:13 jetzt posten",
  "13 17 * * *": "Warteschlange 14:13 jetzt posten",
  "43 20 * * *": "Abend-Freigabe (Reel fuer 20:43)",
};

// Story-Reels (story_reels.yml): EIN Cron-Trigger fuer alle Termine (Gratis-Tarif: max. 5 pro
// Konto). Der Worker schaut auf die Uhrzeit und startet nur zu den Zeiten in STORY_SLOTS.
export const STORY_CRON = "22,52 11,13,17,19 * * *";
export const STORY_WORKFLOW = "story_reels.yml";
export const STORY_SLOTS = {
  "11:52": { slot: "52 11 * * *", account: "horror" },
  "17:52": { slot: "52 17 * * *", account: "horror" },
  "13:22": { slot: "22 13 * * *", account: "mysteries" },
  "19:22": { slot: "22 19 * * *", account: "mysteries" },
};

export function storySlot(scheduledTime) {
  const d = new Date(scheduledTime);
  const hhmm = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return STORY_SLOTS[hhmm] || null;
}

async function dispatch(env, inputs, workflow) {
  const url = `https://api.github.com/repos/${env.GH_REPO}/actions/workflows/${workflow || env.GH_WORKFLOW}/dispatches`;
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "people-scheduler",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: env.GH_REF || "main", inputs }),
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
    let label, inputs, workflow;
    if (event.cron === STORY_CRON) {
      const slot = storySlot(event.scheduledTime);
      if (!slot) return; // Zeit ohne Story-Termin (z.B. 11:22)
      label = `Story-Reel ${slot.account} (${slot.slot})`;
      inputs = { account: slot.account, publish: "true", slot: slot.slot };
      workflow = STORY_WORKFLOW;
    } else {
      const mode = SCHEDULE[event.cron];
      if (!mode) {
        console.log(`Unbekannter Termin: ${event.cron}`);
        return;
      }
      label = mode;
      inputs = { mode };
    }
    let detail = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await dispatch(env, inputs, workflow);
      if (res.status === 204) {
        console.log(`Gestartet: ${label}`);
        return;
      }
      detail = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
      console.log(`Versuch ${attempt} fehlgeschlagen - ${detail}`);
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
    await warn(env, `⚠️ Zeitgeber konnte "${label}" nicht starten (${detail}). Bitte in GitHub Actions per Run workflow starten.`);
    throw new Error(`Dispatch fehlgeschlagen: ${detail}`);
  },
};
