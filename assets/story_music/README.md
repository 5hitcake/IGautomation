# Musik für die Story-Reels (optional)

- `horror/` → Gruselgeschichten-Account
- `mysteries/` → Rätsel-/Verschwörungs-Account

Lege hier lizenzfreie Tracks ab (`.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg`). Pro Reel wird
zufällig ein Track gewählt (nicht zweimal hintereinander derselbe), auf Reel-Länge
geschnitten und ein-/ausgeblendet.

**Ordner leer?** Kein Problem: Dann erzeugt `story_reel.py` automatisch einen dunklen
Ambient-Klangteppich per ffmpeg (rein synthetisch, also komplett lizenzfrei).

Gute kostenlose Quellen: [Pixabay Music](https://pixabay.com/music/) (Suche z.B. „dark ambient“,
„horror drone“, „mystery“), [YouTube Audio Library](https://www.youtube.com/audiolibrary).
Bitte die Lizenz jedes Tracks prüfen. Musik aus der Instagram-App kann über die API
**nicht** angehängt werden – sie muss im Video stecken.
