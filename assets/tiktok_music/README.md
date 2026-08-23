# Musik fuer TikTok-Videos (optional)

Lege hier lizenzfreie Musiktracks ab (`.mp3`, `.wav`, `.m4a` oder `.aac`).
`tiktok_generate_video.py` waehlt automatisch einen zufaelligen Track aus diesem Ordner
und mischt ihn deutlich gedaempft unter die Erzaehlerstimme. Ist der Ordner leer, wird
das Video einfach **ohne Musik** (nur Erzaehlerstimme) erstellt - kein Zutun noetig.

Dieser Ordner ist bewusst getrennt von `assets/music/` (das ist der Musik-Pool fuer den
Mindset/Motivation-Account) - hier soll ein **dunklerer, mysterioeser** Stil rein, passend
zu den "unterdrueckte Geschichte"-Mystery-Videos von @weirdworld.ai.

## Welcher Stil passt?

- Dunkle, cinematic/atmosphaerische Ambient-Tracks (kein Beat/Drop, keine Lyrics)
- Spannungsaufbau, mysterioes, leicht bedrohlich - denkt an Dokumentation/Verschwoerungstheorie-
  Aesthetik, nicht an Motivation/Feel-Good
- Stichwoerter zur Suche: "dark ambient", "mystery documentary", "suspense cinematic",
  "conspiracy", "archaeology discovery"

## Wo bekomme ich lizenzfreie Musik?

- [YouTube Audio Library](https://www.youtube.com/audiolibrary) - kostenlos, Download als MP3
- [Pixabay Music](https://pixabay.com/music/) - kostenlos, keine Attribution noetig
- [Uppbeat](https://uppbeat.io) - kostenlos mit Attribution oder bezahlter Lizenz ohne

Empfehlung: 3-5 dunkle, atmosphaerische Tracks herunterladen und hier ablegen. Bitte bei
jeder Quelle die Lizenzbedingungen pruefen, bevor der Track kommerziell auf TikTok/Instagram
verwendet wird.

## Lautstaerke

Die Musik wird automatisch stark gedaempft (siehe `MUSIC_VOLUME` in
`scripts/tiktok_generate_video.py`) und unter die Erzaehlerstimme gemischt, damit der
gesprochene Text jederzeit klar im Vordergrund bleibt. Die Musik laeuft in einer Schleife
und wird auf die Laenge der Erzaehlung zugeschnitten.
