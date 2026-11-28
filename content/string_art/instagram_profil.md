# Instagram-Profil für die Fadenbild-Seite (englischsprachig)

Profilbild, Name und Bio lassen sich nicht per API ändern – einmalig in der Instagram-App unter
**Profil → Profil bearbeiten** eintragen.

## Profilbild

Drei Vorschläge in `assets/string_art/profile/` (1080 × 1080, Instagram schneidet rund zu):

| Datei | Wirkung |
|---|---|
| `profilbild_c_portraet.jpg` | Fadenporträt – zeigt sofort, worum es geht (Empfehlung) |
| `profilbild_a_wurmloch.jpg` | farbige 3D-Illusion, fällt im Feed auf |
| `profilbild_b_kugel.jpg` | rote 3D-Kugel, sehr markant auch ganz klein |

## Name (fett, durchsuchbar)

`String Art | Nails & Thread`

## Benutzername (Vorschläge, Verfügbarkeit in der App prüfen)

`@stringart.daily` · `@nails.and.thread` · `@threadportraits` · `@one.thread.art`

**Wichtig:** Wenn sich der Benutzername ändert, muss er auch in
`content/string_art/motifs.json` → `account.instagram_username` angepasst werden. Das Posting
prüft vor jedem Upload, dass der Zugang wirklich zu diesem Account gehört, und bricht sonst ab.

## Bio (max. 150 Zeichen)

```
🧵 Portraits made from nails & a single thread
🔨 Calculated line by line – 2 new pieces daily
💬 Want your favorite? Drop it in the comments
```

Link-Feld: `https://ko-fi.com/5hitcake` (Titel: „☕ Support the page“)

## Kategorie

Profil bearbeiten → Kategorie: **Artist** (oder „Digital Creator“).

## Alte Jota-Labs-Beiträge

Vorhandene Posts passen nicht mehr zum Thema – archivieren statt löschen (Beitrag → ⋯ → Archivieren),
dann bleiben Likes/Kommentare erhalten und man kann sie später wiederherstellen.
Der tägliche Jota-Labs-Story-Workflow (`jotalabs_story.yml`) ist auf dem Branch bereits ohne Zeitplan.
