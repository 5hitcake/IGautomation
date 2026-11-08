// Belohnte Werbung über Google AdMob (nur in der Android-App).
// Ablauf: beim Start Einwilligung abfragen (DSGVO, Google UMP), dann eine
// Werbung vorladen. „Weiterspielen per Werbung“ zeigt sie, danach wird die
// nächste vorgeladen. Im Browser gibt es keine echte Werbung.
import { Capacitor } from '@capacitor/core';
import { AdMob, RewardAdPluginEvents } from '@capacitor-community/admob';
import { TEST_TOOLS, ADS } from '../config.js';
import { setAdPlaying } from './audio.js';

const native = Capacitor.isNativePlatform();
let ready = false; // AdMob gestartet und Werbung erlaubt
let loaded = false; // eine Werbung liegt bereit
let loading = null;
let privacyOptions = false; // Nutzer muss die Einwilligung ändern können (EU)

/** Test-Versionen zeigen Googles Test-Werbung, die Store-Version echte. */
const adId = () => (TEST_TOOLS ? ADS.testRewardedId : ADS.rewardedId);

let started = null;
/** Erfüllt sich, sobald die Einwilligungsabfrage durch ist (für den Datenschutz-Knopf im Menü). */
export const adsStarted = () => started ?? Promise.resolve();

/** Beim App-Start einmal aufrufen. Fehler sind nicht schlimm: dann gibt es eben keine Werbung. */
export function initAds() {
  if (!native || started) return;
  started = startAds();
}

async function startAds() {
  try {
    // Google empfiehlt: erst die Einwilligung klären, dann AdMob starten
    let info = await AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable && info.status === 'REQUIRED') {
      info = await AdMob.showConsentForm();
    }
    await AdMob.initialize({ initializeForTesting: TEST_TOOLS, maxAdContentRating: 'Teen' });
    privacyOptions = info.privacyOptionsRequirementStatus === 'REQUIRED';
    ready = info.canRequestAds;
    if (ready) preload();
  } catch (e) {
    console.warn('AdMob nicht verfügbar', e);
  }
}

function preload() {
  if (!ready || loaded || loading) return loading;
  loading = AdMob.prepareRewardVideoAd({ adId: adId(), isTesting: TEST_TOOLS })
    .then(() => { loaded = true; })
    .catch(() => { loaded = false; })
    .finally(() => { loading = null; });
  return loading;
}

/** Gibt es in dieser App überhaupt echte Werbung? */
export const adsSupported = () => native;

/** Muss im Menü ein Knopf „Datenschutz-Einstellungen“ angeboten werden? */
export const needsPrivacyButton = () => native && privacyOptions;

/** Einwilligung nachträglich ändern (Pflicht in der EU). */
export async function showPrivacyOptions() {
  try {
    await AdMob.showPrivacyOptionsForm();
    const info = await AdMob.requestConsentInfo();
    ready = info.canRequestAds;
    if (ready) preload();
  } catch { /* nichts zu tun */ }
}

/**
 * Zeigt eine belohnte Werbung. Ergebnis: 'reward' (ganz angesehen),
 * 'skipped' (vorher geschlossen) oder 'unavailable' (keine Werbung da).
 */
export async function showRewardedAd() {
  if (!native || !ready) return 'unavailable';
  if (!loaded) {
    // Noch nichts geladen: kurz nachladen, aber nicht ewig warten
    await Promise.race([preload(), new Promise((r) => setTimeout(r, ADS.loadTimeoutMs))]);
    if (!loaded) return 'unavailable';
  }
  loaded = false;
  let rewarded = false;
  const subs = [];
  try {
    setAdPlaying(true);
    // Das Versprechen von showRewardVideoAd erfüllt sich nur bei einer Belohnung –
    // wer vorher schließt, löst nur „Dismissed“ aus. Darum auf die Ereignisse warten.
    await new Promise((resolve) => {
      subs.push(AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { rewarded = true; }));
      subs.push(AdMob.addListener(RewardAdPluginEvents.Dismissed, resolve));
      subs.push(AdMob.addListener(RewardAdPluginEvents.FailedToShow, resolve));
      AdMob.showRewardVideoAd().then(() => { rewarded = true; }, resolve);
    });
    // Die Belohnung kann kurz nach dem Schließen gemeldet werden
    if (!rewarded) await new Promise((r) => setTimeout(r, 300));
  } finally {
    setAdPlaying(false);
    for (const s of subs) (await s).remove();
    preload();
  }
  return rewarded ? 'reward' : 'skipped';
}
