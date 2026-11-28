// Startet zu jedem Cron-Termin den passenden Modus von people_post.yml, story_reels.yml,
// kaufkraft_post.yml bzw. token_refresh.yml.
// Secrets (per wrangler aus den GitHub-Secrets gesetzt):
//   GH_DISPATCH_TOKEN   fein granularer GitHub-Token, nur dieses Repo, "Actions: Read and write"
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID   Warnung, falls der Start scheitert
export const SCHEDULE = {
  "30 7 * * *": "Morgen-Freigabe (2 Personen fuer 8:13 + 14:13)",
  "13 11 * * *": "Warteschlange 8:13 jetzt posten",
  "13 17 * * *": "Warteschlange 14:13 jetzt posten",
  "43 20 * * *": "Abend-Freigabe (Reel fuer 20:43)",
};

// Story-Reels (story_reels.yml) + Kaufkraft-Check (kaufkraft_post.yml): EIN gemeinsamer
// Cron-Trigger (Gratis-Tarif: max. 5 pro Konto). Der Worker schaut auf die Uhrzeit und startet
// nur zu den Zeiten in STORY_SLOTS (UTC) bzw. KAUFKRAFT_SLOTS (deutsche Zeit).
// Stunden 8,9,16,17 decken die Kaufkraft-Termine in Sommer- und Winterzeit ab,
// Stunden 4,5,14,15 die Power-of-Christ-Termine (POC_SLOTS).
export const STORY_CRON = "22,52 4,5,8,9,11,13,14,15,16,17,19 * * *";
export const STORY_WORKFLOW = "story_reels.yml";
export const STORY_SLOTS = {
  "11:52": { slot: "52 11 * * *", account: "horror" },
  "17:52": { slot: "52 17 * * *", account: "horror" },
  "13:22": { slot: "22 13 * * *", account: "mysteries" },
  "19:22": { slot: "22 19 * * *", account: "mysteries" },
};

// Fadenbild-Reels (string_art.yml): Vorschau 75 Min. vor dem Termin, Termine 11:07 + 17:07 UTC.
// Fenster 09:52-11:07 und 15:52-17:07 ueberschneiden sich nicht mit den Story-Reel-Freigaben.
export const STRING_WORKFLOW = "string_art.yml";
export const STRING_SLOTS = {
  "09:52": "52 9 * * *",
  "15:52": "52 15 * * *",
};

export function stringSlot(scheduledTime) {
  const d = new Date(scheduledTime);
  const hhmm = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return STRING_SLOTS[hhmm] || null;
}

// Kaufkraft-Check: deutsche Top-Zeiten (Europe/Berlin, Sommer-/Winterzeit automatisch).
export const KAUFKRAFT_WORKFLOW = "kaufkraft_post.yml";
export const KAUFKRAFT_SLOTS = {
  weekday: "18:52", // Mo-Fr: Feierabend-Peak
  weekend: "10:52", // Sa+So: Wochenend-Vormittag
};

// Power of Christ (poc_post.yml): deutsche Zeit, Sommer-/Winterzeit automatisch.
// 06:52 = 05:52 UTC (Winter) / 04:52 UTC (Sommer); 16:22 = 15:22 / 14:22 UTC.
export const POC_WORKFLOW = "poc_post.yml";
export const POC_SLOTS = {
  "06:52": "poc-verse", // Vers-Reel, online ca. 07:00
  "16:22": "poc-story", // Bibelgeschichte, online ca. 16:35
};

export function pocSlot(scheduledTime) {
  return POC_SLOTS[berlinTime(scheduledTime).hhmm] || null;
}

// Token-Erneuerung (token_refresh.yml): montags 10:22 deutscher Zeit (= 09:22 UTC im Winter,
// 08:22 UTC im Sommer, beides im STORY_CRON). Der GitHub-Cron dafuer fiel aus, deshalb hier.
export const TOKEN_WORKFLOW = "token_refresh.yml";
export const TOKEN_SLOT = { weekday: "Mon", hhmm: "10:22" };

export function tokenRefreshDue(scheduledTime) {
  const { weekday, hhmm } = berlinTime(scheduledTime);
  return weekday === TOKEN_SLOT.weekday && hhmm === TOKEN_SLOT.hhmm;
}

export function berlinTime(scheduledTime) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(scheduledTime));
  const get = (t) => parts.find((p) => p.type === t).value;
  return { weekday: get("weekday"), hhmm: `${get("hour")}:${get("minute")}` };
}

export function kaufkraftDue(scheduledTime) {
  const { weekday, hhmm } = berlinTime(scheduledTime);
  const isWeekend = weekday === "Sat" || weekday === "Sun";
  return hhmm === (isWeekend ? KAUFKRAFT_SLOTS.weekend : KAUFKRAFT_SLOTS.weekday);
}

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

async function start(env, label, inputs, workflow) {
  let detail = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await dispatch(env, inputs, workflow);
    if (res.status === 204) {
      console.log(`Gestartet: ${label}`);
      return true;
    }
    detail = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
    console.log(`Versuch ${attempt} fehlgeschlagen - ${detail}`);
    await new Promise((r) => setTimeout(r, 5000 * attempt));
  }
  await warn(env, `⚠️ Zeitgeber konnte "${label}" nicht starten (${detail}). Bitte in GitHub Actions per Run workflow starten.`);
  return false;
}

export function jobsFor(cron, scheduledTime) {
  const jobs = [];
  if (cron === STORY_CRON) {
    const slot = storySlot(scheduledTime);
    if (slot) {
      jobs.push({
        label: `Story-Reel ${slot.account} (${slot.slot})`,
        inputs: { account: slot.account, publish: "true", slot: slot.slot },
        workflow: STORY_WORKFLOW,
      });
    }
    const stringSlotCron = stringSlot(scheduledTime);
    if (stringSlotCron) {
      jobs.push({
        label: `Fadenbild-Reel (${stringSlotCron})`,
        inputs: { publish: "true", slot: stringSlotCron },
        workflow: STRING_WORKFLOW,
      });
    }
    if (kaufkraftDue(scheduledTime)) {
      jobs.push({
        label: "Kaufkraft-Check Post",
        inputs: { kind: "auto", product: "", planned: "true" },
        workflow: KAUFKRAFT_WORKFLOW,
      });
    }
    const poc = pocSlot(scheduledTime);
    if (poc) {
      const kind = poc === "poc-verse" ? "verse" : "story";
      jobs.push({
        label: `Power of Christ ${kind}`,
        inputs: { kind, publish: "true", slot: poc },
        workflow: POC_WORKFLOW,
      });
    }
    if (tokenRefreshDue(scheduledTime)) {
      jobs.push({ label: "Token-Erneuerung", inputs: { dry_run: "false" }, workflow: TOKEN_WORKFLOW });
    }
    return jobs;
  }
  const mode = SCHEDULE[cron];
  if (mode) jobs.push({ label: mode, inputs: { mode } });
  else console.log(`Unbekannter Termin: ${cron}`);
  return jobs;
}

export default {
  async scheduled(event, env) {
    const failed = [];
    for (const job of jobsFor(event.cron, event.scheduledTime)) {
      if (!(await start(env, job.label, job.inputs, job.workflow))) failed.push(job.label);
    }
    if (failed.length) throw new Error(`Dispatch fehlgeschlagen: ${failed.join(", ")}`);
  },
};
