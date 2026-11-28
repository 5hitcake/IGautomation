// Telegram-Webhook fuer den Selfie-Bot (personalisierte Fadenbilder).
// Nimmt Fotos NUR aus dem eigenen Chat (TELEGRAM_CHAT_ID) an und startet selfie_art.yml.
// Die Bildunterschrift waehlt die Platte: "kreis" / "quadrat" und "weiss" / "natur".
// Secrets: SELFIE_TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, GH_DISPATCH_TOKEN
// Telegram schickt bei jedem Aufruf den Header X-Telegram-Bot-Api-Secret-Token mit; der Wert
// wird aus dem Bot-Token abgeleitet (siehe webhookSecret) und beim setWebhook mitgegeben.

export const WORKFLOW = "selfie_art.yml";
const HELP =
  "📸 Schick mir ein Foto (am besten als Datei für volle Qualität).\n" +
  "Bildunterschrift wählt die Platte: kreis | quadrat und weiss | natur\n" +
  "Beispiel: „quadrat natur“. Ohne Angabe: Kreis, weiß.\n" +
  "Nach ~6 Minuten kommen Reel, Bild mit Tisch und Bild nur mit Platte zurück.\n" +
  "„anleitung“ schickt die Foto-Anleitung für Kunden (Deutsch + Englisch) zum Weiterleiten.";

export const GUIDE =
  "📸 So wird dein Fadenbild am schönsten:\n" +
  "1. Frontal – gerade in die Kamera schauen\n" +
  "2. Kamera auf Augenhöhe, nicht von unten\n" +
  "3. Licht von vorn oder seitlich (z. B. vor einem Fenster) – kein Gegenlicht, keine Nachtaufnahme\n" +
  "4. Gesicht füllt das Bild – Kopf und Schultern reichen\n" +
  "5. Augen offen, keine Sonnenbrille\n" +
  "6. Scharfes Originalfoto, kein Screenshot\n\n" +
  "📸 How to get the best string art portrait:\n" +
  "1. Face the camera – look straight into the lens\n" +
  "2. Camera at eye level, not from below\n" +
  "3. Light from the front or side (e.g. facing a window) – no backlight, no night shots\n" +
  "4. Fill the frame – head and shoulders are enough\n" +
  "5. Eyes open, no sunglasses\n" +
  "6. Sharp original photo, not a screenshot";

export function isGuideRequest(text) {
  return /^\/?(anleitung|guide|tipps?)\b/i.test((text || "").trim());
}

export async function webhookSecret(token) {
  const data = new TextEncoder().encode(`selfie-bot:${token}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 48);
}

export function pickImage(msg) {
  if (msg.document && /^image\//.test(msg.document.mime_type || "")) {
    return { file_id: msg.document.file_id, kind: "document" };
  }
  if (Array.isArray(msg.photo) && msg.photo.length) {
    const best = msg.photo.reduce((a, b) => ((a.file_size || 0) >= (b.file_size || 0) ? a : b));
    return { file_id: best.file_id, kind: "photo" };
  }
  return null;
}

async function tg(env, method, body) {
  return fetch(`https://api.telegram.org/bot${env.SELFIE_TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function dispatch(env, inputs) {
  return fetch(`https://api.github.com/repos/${env.GH_REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "selfie-bot",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: env.GH_REF || "main", inputs }),
  });
}

// ---------------------------------------------------------------- Bestellungen von der Studio-Seite
export const ORDER_ORIGIN = "https://5hitcake.github.io";
const CORS = {
  "Access-Control-Allow-Origin": ORDER_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};
const MAX_PHOTO = 6 * 1024 * 1024;
const SHAPES = ["circle", "square"];
const PANELS = ["white", "natural"];
const LANGS = ["en", "de", "es", "fr"];

export function orderCode() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => abc[b % abc.length]).join("");
}

export function validateOrder(f) {
  const email = String(f.get("email") || "").trim();
  if (String(f.get("website") || "")) return "spam";          // Honigtopf-Feld ist fuer Menschen unsichtbar
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(email)) return "email";
  const photo = f.get("photo");
  if (!photo || typeof photo === "string" || !/^image\//.test(photo.type) || photo.size > MAX_PHOTO) return "photo";
  if (!SHAPES.includes(f.get("shape")) || !PANELS.includes(f.get("panel"))) return "options";
  if (!LANGS.includes(f.get("lang"))) return "lang";
  return null;
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...CORS } });

async function handleOrder(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") return json({ error: "method" }, 405);
  const form = await request.formData().catch(() => null);
  if (!form) return json({ error: "form" }, 400);
  const problem = validateOrder(form);
  if (problem === "spam") return json({ code: orderCode() });   // Bots nichts verraten
  if (problem) return json({ error: problem }, 400);
  const code = orderCode();
  const shape = form.get("shape"), panel = form.get("panel");
  // Optionen zuerst: Foto einfach an den Bot weiterleiten -> er liest "circle white" usw.
  const caption =
    `${shape} ${panel}\n🛒 Bestellung #${code}\n📧 ${form.get("email").trim()}\n` +
    `🌐 ${form.get("lang")} · Foto-Check: ${form.get("check") || "ok"}\n\n` +
    "➡️ Foto an den Bot weiterleiten, um das Fadenbild zu erstellen.";
  const tgForm = new FormData();
  tgForm.append("chat_id", env.TELEGRAM_CHAT_ID);
  tgForm.append("caption", caption);
  tgForm.append("document", form.get("photo"), `bestellung_${code}.jpg`);
  const res = await fetch(`https://api.telegram.org/bot${env.SELFIE_TELEGRAM_BOT_TOKEN}/sendDocument`, {
    method: "POST", body: tgForm,
  });
  if (!res.ok) return json({ error: "deliver" }, 502);
  return json({ code });
}

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === "/order") return handleOrder(request, env);
    if (request.method !== "POST") return new Response("ok");
    const secret = await webhookSecret(env.SELFIE_TELEGRAM_BOT_TOKEN || "");
    if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== secret) {
      return new Response("forbidden", { status: 403 });
    }
    const update = await request.json().catch(() => ({}));
    const msg = update.message;
    if (!msg || String(msg.chat?.id) !== String(env.TELEGRAM_CHAT_ID)) return new Response("ok");

    const image = pickImage(msg);
    if (!image) {
      const text = isGuideRequest(msg.text) ? GUIDE : HELP;
      await tg(env, "sendMessage", { chat_id: msg.chat.id, text });
      return new Response("ok");
    }
    const options = (msg.caption || "").slice(0, 60);
    const res = await dispatch(env, { file_id: image.file_id, options, message_id: String(msg.message_id) });
    const text = res.ok
      ? `⏳ Fadenbild wird erstellt (${options || "kreis weiss"}) – ca. 6 Minuten.`
      : `⚠️ Konnte den Auftrag nicht starten (GitHub ${res.status}).`;
    await tg(env, "sendMessage", { chat_id: msg.chat.id, text, reply_to_message_id: msg.message_id });
    return new Response("ok");
  },
};
