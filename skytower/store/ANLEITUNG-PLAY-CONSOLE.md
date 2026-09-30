# Anleitung: „Wolki: Sky Climber“ in den Play Store bringen

Reihenfolge der Schritte in der [Google Play Console](https://play.google.com/console).
Texte und Formular-Antworten stehen in [STORE-EINTRAG.md](STORE-EINTRAG.md).

## 0. Vorab (einmalig)

**Upload-Schlüssel sicher aufbewahren.** Die Datei `wolki-upload.jks` und das Passwort
(`wolki-upload-zugang.txt`) bekommst du separat, sie liegen **nicht** im Repository.
Speichere beides an zwei sicheren Orten, z. B. im Passwort-Manager und auf einem USB-Stick.
Jede künftige Version muss mit diesem Schlüssel signiert werden. Bei Verlust kann Google
den Upload-Schlüssel zurücksetzen („Play App Signing“), das dauert aber einige Tage.

**Datenschutzerklärung online stellen.** Play braucht dafür eine öffentliche Web-Adresse.
Kostenlose Möglichkeiten:
- **Google Sites** (sites.google.com): neue Seite anlegen, den Text aus `datenschutz.html`
  (Deutsch und Englisch) einfügen, veröffentlichen, Adresse kopieren.
- **GitHub Pages**: ein neues *öffentliches* Repository (z. B. `wolki-datenschutz`) mit
  `datenschutz.html` als `index.html`, dann unter Settings → Pages einschalten.

Die Kontaktadresse (deine Gmail-Adresse) ist schon eingetragen.

## 1. App anlegen

Play Console → **App erstellen**
- Name: `Wolki: Sky Climber`
- Standardsprache: Deutsch (Deutschland)
- App oder Spiel: **Spiel** · Kostenlos
- Erklärungen bestätigen → Erstellen

## 2. App-Inhalte ausfüllen (linkes Menü „Richtlinie → App-Inhalte“)

Nach [STORE-EINTRAG.md](STORE-EINTRAG.md#antworten-für-die-formulare-in-der-play-console):
Datenschutzerklärung (URL), App-Zugriff, Anzeigen (**keine**), Einstufung des Inhalts (IARC),
Zielgruppe (**ab 13**), Datensicherheit (**keine Daten erhoben**), Behörden-/Finanz-/Gesundheits-Apps (**nein**).

## 3. Store-Eintrag (Wachstum → Store-Präsenz → Haupteintrag)

- Texte auf Deutsch eintragen, dann unter **Übersetzungen verwalten → Englisch (USA)** die englischen Texte.
- Grafiken aus diesem Ordner hochladen: `icon-512.png`, `feature-graphic-1024x500.png`,
  Screenshots `screenshot-de-*.png` (Deutsch) bzw. `screenshot-en-*.png` (Englisch).
- Kategorie: **Arcade**, Kontakt-E-Mail eintragen.

## 4. Geschlossener Test (Pflicht für neue private Konten: 12 Tester, 14 Tage)

Testen und veröffentlichen → **Test → Geschlossener Test** → Track „Closed testing“ → **Tester**:
1. **Tester-Liste per E-Mail** anlegen, oder einfacher eine **Google Group**
   (groups.google.com, neue Gruppe, Tester treten selbst bei) und die Gruppen-Adresse eintragen.
2. **Neuen Release erstellen** → App-Bundle `wolki-sky-climber-v0.9.0.aab` hochladen.
   Bei der ersten Frage zu **Play App Signing** → „Von Google verwalten lassen“ (empfohlen).
3. Versionshinweis, z. B. „Erste Testversion“ → Überprüfen → **Einführung starten**.
4. Den **Link zur Teilnahme** („Über das Web teilnehmen“) an die Tester schicken.

Wichtig für die Pflicht: Die **12 Tester müssen den Test 14 Tage lang durchgehend angemeldet** lassen
(die App installiert haben und nicht austreten). Danach erscheint in der Console die Schaltfläche
**„Produktion beantragen“**, die Google innerhalb weniger Tage prüft.

### Woher 12 Tester nehmen?

- **Freunde, Familie, Kollegen, Vereine, Klassenchats:** Jeder mit Android-Handy und Google-Konto
  kann mitmachen. Am besten 15 bis 20 fragen, falls einige abspringen.
- **Tester-Tausch-Gemeinschaften (kostenlos):** Entwickler testen gegenseitig ihre Apps, z. B. die
  Reddit-Foren r/TestersCommunity und r/AndroidClosedTesting oder Discord-Server zum
  „closed testing“. Du testest dort 14 Tage die Apps anderer, die testen deine.
  Seriöse Angebote verlangen kein Geld und kein Passwort, nur deine Gruppen- oder Tester-Adresse.
- **Nicht zu empfehlen:** kostenpflichtige „12 Tester für X €“-Dienste. Das widerspricht dem Ziel,
  kostenlos zu bleiben, und Google erkennt Scheinkonten zunehmend.

Tipp: Bitte die Tester, die App in den 14 Tagen ein paar Mal zu öffnen und dir Rückmeldung zu geben.
Google fragt beim Antrag auf Produktion, wie getestet wurde und was du verbessert hast.

## 5. Produktion

Nach der Freigabe: **Produktion → Neuen Release erstellen** → dasselbe oder ein neueres App-Bundle →
Länder auswählen (z. B. alle) → Überprüfen → Einführung starten. Die erste Prüfung dauert meist 1 bis 7 Tage.

## Neue Versionen bauen

```bash
cd skytower
# versionCode (+1) und versionName in android/app/build.gradle erhöhen
SKYTOWER_RELEASE=1 npm run build     # Store-Version: ohne Test-Münzen/-Werkzeuge
npx cap sync android
cd android && ./gradlew bundleRelease   # braucht android/keystore.properties
# Ergebnis: android/app/build/outputs/bundle/release/app-release.aab
```

`android/keystore.properties` (nicht im Repository) sieht so aus:

```
storeFile=/pfad/zu/wolki-upload.jks
storePassword=…
keyAlias=upload
keyPassword=…
```
