"""Baut data/verses.json aus der Menge-Bibel (1939, gemeinfrei).

Nur nötig, wenn du die Versliste erweitern willst:
    python tools/build_verses.py /pfad/zu/GerMenge.json
Quelle: https://github.com/scrollmapper/bible_databases (formats/json/GerMenge.json)
"""
import json
import re
import sys
from pathlib import Path

# (deutscher Buchname, Name in der Quelldatei)
BOOKS = {
    "1. Mose": "Genesis", "2. Mose": "Exodus", "4. Mose": "Numbers", "5. Mose": "Deuteronomy",
    "Josua": "Joshua", "Rut": "Ruth", "1. Samuel": "I Samuel", "1. Chronik": "I Chronicles",
    "2. Chronik": "II Chronicles", "Nehemia": "Nehemiah", "Hiob": "Job", "Psalm": "Psalms",
    "Sprüche": "Proverbs", "Prediger": "Ecclesiastes", "Jesaja": "Isaiah", "Jeremia": "Jeremiah",
    "Klagelieder": "Lamentations", "Hesekiel": "Ezekiel", "Micha": "Micah", "Nahum": "Nahum",
    "Habakuk": "Habakkuk", "Zefanja": "Zephaniah", "Sacharja": "Zechariah", "Maleachi": "Malachi",
    "Matthäus": "Matthew", "Markus": "Mark", "Lukas": "Luke", "Johannes": "John",
    "Apostelgeschichte": "Acts", "Römer": "Romans", "1. Korinther": "I Corinthians",
    "2. Korinther": "II Corinthians", "Galater": "Galatians", "Epheser": "Ephesians",
    "Philipper": "Philippians", "Kolosser": "Colossians", "1. Thessalonicher": "I Thessalonians",
    "2. Thessalonicher": "II Thessalonians", "1. Timotheus": "I Timothy", "2. Timotheus": "II Timothy",
    "Hebräer": "Hebrews", "Jakobus": "James", "1. Petrus": "I Peter", "2. Petrus": "II Peter",
    "1. Johannes": "I John", "Offenbarung": "Revelation of John",
}

# Buch, Kapitel, Vers von, Vers bis, Thema
REFS = """
Josua|1|9|9|Mut
5. Mose|31|6|6|Mut
5. Mose|31|8|8|Vertrauen
4. Mose|6|24|26|Segen
1. Mose|28|15|15|Fürsorge
2. Mose|14|14|14|Vertrauen
2. Mose|15|2|2|Kraft
Rut|1|16|16|Treue
1. Samuel|16|7|7|Moral
1. Chronik|16|11|11|Kraft
2. Chronik|7|14|14|Umkehr
Nehemia|8|10|10|Freude
Hiob|19|25|25|Hoffnung
Psalm|4|9|9|Frieden
Psalm|16|8|8|Vertrauen
Psalm|18|3|3|Kraft
Psalm|19|15|15|Gebet
Psalm|23|4|4|Trost
Psalm|23|6|6|Fürsorge
Psalm|27|1|1|Mut
Psalm|27|14|14|Geduld
Psalm|28|7|7|Kraft
Psalm|30|6|6|Trost
Psalm|31|25|25|Mut
Psalm|32|8|8|Führung
Psalm|34|5|5|Vertrauen
Psalm|34|19|19|Trost
Psalm|37|4|5|Vertrauen
Psalm|37|7|7|Geduld
Psalm|42|12|12|Hoffnung
Psalm|46|2|2|Kraft
Psalm|46|11|11|Frieden
Psalm|51|12|12|Umkehr
Psalm|55|23|23|Fürsorge
Psalm|56|4|4|Mut
Psalm|62|2|3|Vertrauen
Psalm|73|26|26|Kraft
Psalm|86|5|5|Vergebung
Psalm|90|12|12|Weisheit
Psalm|91|1|2|Schutz
Psalm|91|11|11|Schutz
Psalm|103|2|4|Dankbarkeit
Psalm|103|13|13|Fürsorge
Psalm|118|24|24|Freude
Psalm|119|105|105|Führung
Psalm|121|1|2|Hilfe
Psalm|121|7|8|Schutz
Psalm|127|1|1|Weisheit
Psalm|133|1|1|Gemeinschaft
Psalm|136|1|1|Dankbarkeit
Psalm|139|14|14|Wert
Psalm|143|8|8|Führung
Psalm|145|18|18|Nähe
Psalm|147|3|3|Heilung
Sprüche|3|5|6|Vertrauen
Sprüche|3|27|27|Moral
Sprüche|4|23|23|Weisheit
Sprüche|10|12|12|Liebe
Sprüche|11|25|25|Großzügigkeit
Sprüche|12|25|25|Freundlichkeit
Sprüche|15|1|1|Moral
Sprüche|16|3|3|Vertrauen
Sprüche|16|9|9|Führung
Sprüche|16|24|24|Freundlichkeit
Sprüche|16|32|32|Geduld
Sprüche|17|17|17|Freundschaft
Sprüche|17|22|22|Freude
Sprüche|18|10|10|Schutz
Sprüche|19|11|11|Vergebung
Sprüche|19|17|17|Großzügigkeit
Sprüche|22|1|1|Moral
Sprüche|27|17|17|Freundschaft
Sprüche|28|13|13|Umkehr
Sprüche|31|8|9|Gerechtigkeit
Prediger|3|1|1|Weisheit
Prediger|4|9|10|Gemeinschaft
Prediger|7|8|8|Geduld
Prediger|9|10|10|Fleiß
Jesaja|9|5|5|Hoffnung
Jesaja|26|3|3|Frieden
Jesaja|30|15|15|Vertrauen
Jesaja|40|29|29|Kraft
Jesaja|40|31|31|Kraft
Jesaja|41|10|10|Mut
Jesaja|41|13|13|Hilfe
Jesaja|43|1|1|Wert
Jesaja|43|2|2|Schutz
Jesaja|43|19|19|Neuanfang
Jesaja|46|4|4|Fürsorge
Jesaja|49|15|16|Fürsorge
Jesaja|54|10|10|Treue
Jesaja|55|8|9|Vertrauen
Jesaja|58|10|10|Nächstenliebe
Jesaja|66|13|13|Trost
Jeremia|17|7|8|Vertrauen
Jeremia|29|11|11|Hoffnung
Jeremia|29|13|13|Gebet
Jeremia|31|3|3|Liebe
Jeremia|33|3|3|Gebet
Klagelieder|3|22|23|Treue
Klagelieder|3|25|26|Geduld
Hesekiel|36|26|26|Neuanfang
Micha|6|8|8|Moral
Micha|7|7|7|Hoffnung
Nahum|1|7|7|Schutz
Habakuk|3|19|19|Kraft
Zefanja|3|17|17|Liebe
Sacharja|4|6|6|Kraft
Matthäus|5|3|3|Seligpreisung
Matthäus|5|4|4|Trost
Matthäus|5|5|5|Demut
Matthäus|5|7|7|Barmherzigkeit
Matthäus|5|8|8|Seligpreisung
Matthäus|5|9|9|Frieden
Matthäus|5|14|14|Licht
Matthäus|5|16|16|Licht
Matthäus|5|44|44|Feindesliebe
Matthäus|6|26|26|Fürsorge
Matthäus|6|33|34|Vertrauen
Matthäus|7|7|7|Gebet
Matthäus|7|12|12|Moral
Matthäus|11|28|28|Ruhe
Matthäus|11|29|30|Ruhe
Matthäus|17|20|20|Glaube
Matthäus|19|26|26|Glaube
Matthäus|22|37|39|Liebe
Matthäus|28|20|20|Nähe
Markus|9|23|23|Glaube
Markus|10|27|27|Glaube
Markus|11|24|24|Gebet
Markus|11|25|25|Vergebung
Lukas|1|37|37|Glaube
Lukas|6|31|31|Moral
Lukas|6|36|36|Barmherzigkeit
Lukas|6|37|37|Vergebung
Lukas|6|38|38|Großzügigkeit
Lukas|12|7|7|Wert
Lukas|16|10|10|Treue
Johannes|1|5|5|Licht
Johannes|3|16|16|Liebe
Johannes|8|12|12|Licht
Johannes|10|10|10|Leben
Johannes|11|25|25|Hoffnung
Johannes|13|34|35|Liebe
Johannes|14|1|1|Trost
Johannes|14|6|6|Glaube
Johannes|14|27|27|Frieden
Johannes|15|5|5|Verbundenheit
Johannes|15|13|13|Liebe
Johannes|16|33|33|Mut
Apostelgeschichte|20|35|35|Großzügigkeit
Römer|5|3|5|Hoffnung
Römer|8|18|18|Hoffnung
Römer|8|28|28|Vertrauen
Römer|8|31|31|Mut
Römer|8|38|39|Liebe
Römer|12|2|2|Weisheit
Römer|12|10|10|Liebe
Römer|12|12|12|Geduld
Römer|12|21|21|Moral
Römer|15|13|13|Hoffnung
1. Korinther|10|13|13|Kraft
1. Korinther|13|4|5|Liebe
1. Korinther|13|7|7|Liebe
1. Korinther|13|13|13|Liebe
1. Korinther|15|58|58|Ausdauer
1. Korinther|16|13|14|Mut
2. Korinther|4|16|16|Kraft
2. Korinther|4|17|18|Hoffnung
2. Korinther|5|7|7|Glaube
2. Korinther|5|17|17|Neuanfang
2. Korinther|9|7|7|Großzügigkeit
2. Korinther|12|9|9|Gnade
Galater|5|22|23|Charakter
Galater|6|2|2|Nächstenliebe
Galater|6|9|9|Ausdauer
Epheser|2|8|9|Gnade
Epheser|2|10|10|Wert
Epheser|3|20|20|Glaube
Epheser|4|2|3|Demut
Epheser|4|26|26|Moral
Epheser|4|29|29|Freundlichkeit
Epheser|4|32|32|Vergebung
Epheser|6|10|10|Kraft
Philipper|1|6|6|Vertrauen
Philipper|2|3|4|Demut
Philipper|4|4|4|Freude
Philipper|4|6|7|Frieden
Philipper|4|8|8|Weisheit
Philipper|4|11|11|Zufriedenheit
Philipper|4|13|13|Kraft
Philipper|4|19|19|Fürsorge
Kolosser|3|12|13|Charakter
Kolosser|3|14|14|Liebe
Kolosser|3|23|23|Fleiß
1. Thessalonicher|5|11|11|Gemeinschaft
1. Thessalonicher|5|16|18|Dankbarkeit
2. Thessalonicher|3|3|3|Schutz
1. Timotheus|4|12|12|Vorbild
1. Timotheus|6|6|6|Zufriedenheit
2. Timotheus|1|7|7|Mut
Hebräer|4|16|16|Gnade
Hebräer|10|23|23|Treue
Hebräer|11|1|1|Glaube
Hebräer|12|1|1|Ausdauer
Hebräer|13|2|2|Gastfreundschaft
Hebräer|13|5|5|Zufriedenheit
Hebräer|13|8|8|Treue
Jakobus|1|2|3|Ausdauer
Jakobus|1|5|5|Weisheit
Jakobus|1|12|12|Ausdauer
Jakobus|1|19|19|Weisheit
Jakobus|1|22|22|Moral
Jakobus|4|8|8|Nähe
Jakobus|5|16|16|Gebet
1. Petrus|3|8|9|Charakter
1. Petrus|4|8|8|Liebe
1. Petrus|5|6|7|Fürsorge
1. Petrus|5|10|10|Kraft
1. Johannes|1|9|9|Vergebung
1. Johannes|3|18|18|Liebe
1. Johannes|4|7|7|Liebe
1. Johannes|4|18|18|Liebe
1. Johannes|4|19|19|Liebe
Offenbarung|3|20|20|Nähe
Offenbarung|21|4|4|Hoffnung
Offenbarung|21|5|5|Neuanfang
"""

# Buch Henoch (äthiopisch, 1. Henoch): eigene, freie Übertragung – kein wörtliches Zitat.
HENOCH = [
    ("1,8", "Mit den Gerechten aber wird er Frieden schließen. Er wird die Auserwählten bewahren, Gnade wird über ihnen sein, und das Licht Gottes wird ihnen leuchten.", "Frieden"),
    ("5,7", "Den Auserwählten wird Licht, Freude und Frieden zuteil, und sie werden das Land erben.", "Hoffnung"),
    ("5,8", "Dann wird den Auserwählten Weisheit geschenkt. Sie werden nicht mehr sündigen, weder aus Leichtsinn noch aus Hochmut.", "Weisheit"),
    ("39,7", "Unter den Flügeln des Herrn der Geister sah ich die Wohnung der Gerechten, und alle strahlten wie Feuerglanz.", "Schutz"),
    ("48,4", "Er wird ein Stab für die Gerechten sein, auf den sie sich stützen und nicht fallen. Er wird das Licht der Völker sein und die Hoffnung derer, die im Herzen leiden.", "Hoffnung"),
    ("51,5", "In jenen Tagen wird die Erde sich freuen, die Gerechten werden auf ihr wohnen, und die Auserwählten werden auf ihr wandeln.", "Freude"),
    ("58,3", "Die Gerechten werden im Licht der Sonne sein und die Auserwählten im Licht des ewigen Lebens. Ihre Tage nehmen kein Ende.", "Hoffnung"),
    ("91,4", "Liebt die Aufrichtigkeit und wandelt in ihr. Naht euch der Aufrichtigkeit nicht mit doppeltem Herzen.", "Moral"),
    ("91,19", "Hört auf mich, meine Kinder: Wandelt auf den Wegen der Gerechtigkeit und nicht auf den Wegen der Gewalt.", "Moral"),
    ("92,3", "Der Gerechte wird vom Schlaf aufstehen und auf dem Weg der Gerechtigkeit wandeln. Sein ganzer Weg wird in Güte und Gnade sein.", "Hoffnung"),
    ("94,1", "Liebt die Gerechtigkeit und wandelt in ihr. Denn die Wege der Gerechtigkeit sind es wert, angenommen zu werden.", "Moral"),
    ("96,1", "Hofft, ihr Gerechten! Denn bald wird es euch gut ergehen, und ihr werdet über eure Bedränger hinauswachsen.", "Mut"),
    ("102,4", "Fürchtet euch nicht, ihr Seelen der Gerechten, und seid voller Hoffnung, ihr, die ihr in Gerechtigkeit gestorben seid.", "Trost"),
    ("104,2", "Seid getrost! Einst wart ihr bedrängt, doch nun werdet ihr leuchten wie die Lichter des Himmels.", "Trost"),
    ("104,6", "Fürchtet euch nicht und lasst euch nicht entmutigen. Ihr werdet Gefährten der himmlischen Heerscharen sein.", "Mut"),
    ("108,11", "Er wird die Geister der Guten aus dem Geschlecht des Lichts rufen und jene verwandeln, die in Finsternis geboren wurden.", "Licht"),
]

MAX_CHARS = 260


def clean(t: str) -> str:
    t = re.sub(r"\s+", " ", t).strip()
    t = t.replace("daß", "dass").replace("Daß", "Dass").replace("muß", "muss").replace("läßt", "lässt")
    t = re.sub(r"^(Ein |Von )?(Psalm|Lied|Wallfahrtslied|Stufenlied)[^.:]*?(David|Davids|Salomos|Asaphs|Korachiten)[^.:]*[.:]\s*", "", t)
    t = re.sub(r"^Von (David|Salomo|Asaph)\.\s*", "", t)
    t = re.sub(r"^Ein (Lied|Psalm|Wallfahrtslied|Stufenlied)[^.]{0,40}\.\s*", "", t)
    t = re.sub(r"\(([^)]*)\)", r"\1", t)
    t = re.sub(r"\s*\[[^\]]*\]", "", t)
    t = re.sub(r"[»«„“]", "", t)
    t = re.sub(r"\s*[–-]\s*$", "", t).strip()
    if t and t[0].islower():
        t = t[0].upper() + t[1:]
    if t and t[-1] not in ".!?":
        t = t.rstrip(",;:") + "."
    return t


def main(src):
    data = json.load(open(src, encoding="utf-8"))
    books = {b["name"]: b for b in data["books"]}
    out = []
    for line in REFS.strip().splitlines():
        bk, c, v1, v2, theme = line.split("|")
        c, v1, v2 = int(c), int(v1), int(v2)
        ch = books[BOOKS[bk]]["chapters"][c - 1]
        vs = {v["verse"]: v["text"] for v in ch["verses"]}
        text = clean(" ".join(vs[n] for n in range(v1, v2 + 1)))
        ref = f"{bk} {c},{v1}" + (f"-{v2}" if v2 != v1 else "")
        if len(text) > MAX_CHARS:
            print("zu lang, übersprungen:", ref, len(text))
            continue
        testament = "NT" if list(BOOKS).index(bk) >= list(BOOKS).index("Matthäus") else "AT"
        out.append({"id": ref, "ref": ref, "text": text, "theme": theme, "testament": testament,
                    "translation": "Menge 1939"})
    for r, text, theme in HENOCH:
        ref = f"Henoch {r}"
        out.append({"id": ref, "ref": ref, "text": text, "theme": theme, "testament": "Henoch",
                    "translation": "freie Übertragung"})
    Path("data").mkdir(exist_ok=True)
    json.dump(out, open("data/verses.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(len(out), "Verse geschrieben")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "GerMenge.json")
