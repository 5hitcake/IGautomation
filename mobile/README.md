# Kritzeldrache / Dragonslide - native app wrapper

A [Capacitor](https://capacitorjs.com/) project that packages the web game
in `../game/` as a real Android/iOS app, rather than pointing a WebView at
the hosted Higgsfield URL (that would show the platform's own wrapper UI
around the game, which isn't appropriate for an independent store listing).

The game itself now supports German and English (auto-detected from the
device, switchable in Settings) - see `../game/strings.de.js` /
`strings.en.js`. The app is titled **Kritzeldrache** in German and
**Dragonslide** in English; `app.title`/`document.title` and both app-icon
concepts should follow whichever name matches the storefront's language.

## Status

- ✅ Capacitor project scaffolded (`capacitor.config.json`, `package.json`).
- ✅ Android platform added (`android/` - a real Gradle project).
- ✅ iOS platform added (`ios/` - a real Xcode project).
- ✅ `www/` bundles a **local copy** of the game (`index.html`, `strings*.js`,
  `logic.js`) so the app works fully offline, no network dependency on the
  Higgsfield deployment.
- ⏳ `www/assets/` needs the actual game asset files (sprites, audio) copied
  in from `../game/assets/` - see "Known gap" below.
- ⏳ App icon + splash screen source images, and store screenshots - being
  generated separately (see `store/` and the asset pipeline notes in
  `../game/design/assets.csv`).
- ❌ Actually compiling: this environment has Node/npm/Java but **no Android
  SDK** and **no Xcode/CocoaPods**, so `npx cap sync` works but a real
  `gradlew assembleDebug` / Xcode build cannot run here. Both platform
  projects are otherwise complete and ready to open in Android Studio /
  Xcode.

## Known gap: game assets aren't in the repo yet

This coding environment's egress policy blocks the asset CDN the deployed
game's images/audio live on (documented in `../game/design/assets.csv`), so
`game/assets/` has always been empty in this repo - the live deployment
gets its assets packaged directly from the platform's asset store, bypassing
git entirely. That's fine for the *hosted* game, but a native app bundle
needs the actual files physically present in `www/assets/` to work offline.

**Whoever/whatever generated or has access to the 41 shipped assets needs to
add the actual PNG/JPG/MP3 files to `game/assets/` in this repo** (or
directly to `mobile/www/assets/`). Once they're there:

```
cp ../game/assets/* www/assets/
npx cap sync
```

## Building (once you have SDKs/Xcode)

```
npm install
npx cap sync          # copies www/ into android/ and ios/, applies config
```

- **Android**: open `android/` in Android Studio, or run
  `cd android && ./gradlew assembleDebug` (needs `ANDROID_HOME` set and SDK
  platform/build-tools installed).
- **iOS**: open `ios/App/App.xcworkspace` in Xcode (needs CocoaPods -
  `cd ios/App && pod install` first if it wasn't run automatically).

## App icon / splash

Run `npm run assets` (wraps `@capacitor/assets`) once real source images
exist at `resources/icon.png` (1024x1024) and `resources/splash.png`
(2732x2732, centered content) - it generates every required Android/iOS
size automatically into both native projects.

## Store listing text

See `store/listing-de.md` and `store/listing-en.md` for ready-to-paste
Google Play / Apple App Store copy (name, descriptions, keywords), plus
notes on what's still needed for an actual submission (privacy policy URL,
your own developer accounts).

## App ID

`com.kritzeldrache.dragon` (`capacitor.config.json`) - a placeholder reverse-
DNS identifier. Change it before a real submission if you want it tied to
your own domain/company; it must stay unique and, once submitted, is very
hard to change without losing the app's identity on the store.

## Monetization: rewarded ads + coin bundles

Optional, purely-cosmetic coins can now also be earned by watching a
rewarded ad, or bought directly as coin bundles - both **only show up
inside the native app** (the "Get More Coins" section in the shop is
hidden entirely on the web-hosted build, since AdMob and store billing
don't exist in a plain browser). The code lives in `game/index.html`
(search for "monetization (native app only)") and is feature-detected via
`window.Capacitor.isNativePlatform()`.

**This has NOT been tested on a real device or store sandbox** - there's no
Android/iOS device, emulator, or store sandbox account in this environment.
The code follows both plugins' documented APIs as closely as possible, but
you should test the full flow (watch an ad, buy a bundle, restore
purchases) on a real device before shipping.

### What's already wired (with placeholder/test IDs)

- **`@capacitor-community/admob`** for rewarded video ads. Currently
  configured with Google's official public **test** ad unit IDs and App IDs
  (`AndroidManifest.xml`'s `com.google.android.gms.ads.APPLICATION_ID`,
  `Info.plist`'s `GADApplicationIdentifier`, and `AD_UNIT_REWARDED` in
  `game/index.html`) - these show real test ads but never pay out real
  money. A successful watch awards `AD_REWARD_COINS` (15) coins, with a
  60-second cooldown between requests.
- **`cordova-plugin-purchase`** (via Capacitor's Cordova compatibility
  layer) for three consumable coin bundles: `coins_small` (50 coins),
  `coins_medium` (150 coins), `coins_large` (400 coins) - see
  `COIN_BUNDLES` in `game/index.html`.

### What YOU need to do before this earns real money

1. **Create an AdMob account** (admob.google.com), link it to your app, and
   create a real Rewarded ad unit for Android and one for iOS. Replace the
   test ad unit IDs in `AD_UNIT_REWARDED` (`game/index.html`) and the two
   App IDs (`AndroidManifest.xml`, `Info.plist`) with your real ones.
2. **Create matching in-app products** in Google Play Console and App Store
   Connect with the **exact same IDs** used in `COIN_BUNDLES`
   (`coins_small`, `coins_medium`, `coins_large`), type "consumable", and
   set your own prices there (the `fallbackPrice` strings in the code are
   just a placeholder shown before the store responds).
3. Consider **receipt validation** (`store.validator` in the plugin) for
   production - the current wiring trusts the plugin's local `approved` /
   `verified` events without a validation server, which is fine to get
   started but is more spoofable than server-side validation.
4. Both stores require ad content to be disclosed in your data-safety /
   app-privacy questionnaires, and the EU requires a consent flow for
   personalized ads (GDPR) - `AdMob.initialize()` is currently called
   without any consent handling; `@capacitor-community/admob` has a
   `consent` module for this (see its docs) that should be wired in before
   a real release if you'll have EU users.
