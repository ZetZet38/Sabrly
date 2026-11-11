# Sabrly

Persönlicher Habit-Tracker als Web-App. Login und Sync über Firebase, gehostet mit GitHub Pages.

- `index.html` – die App
- `config.js` – Firebase-Konfiguration
- `firestore.rules` – Datenbank-Regeln (in der Firebase-Konsole einfügen)
- `sw.js`, `manifest.webmanifest`, Icons – Home-Bildschirm und Offline
- `gebetszeiten/` – offizielle Diyanet-Gebetszeiten (täglich aktualisiert von `scripts/gebetszeiten.mjs` über die GitHub Action „Gebetszeiten“)
- `widget/` – Home-Bildschirm-Widgets für die App „Scriptable“ (`loader.js` einmal in Scriptable einfügen, es lädt `sabrly-widget.js`)

## Widgets

Im Widget unter „Parameter“ eintragen:

| Parameter | Widget |
|---|---|
| (leer) | klein: Tagesring · mittel/groß: alle Habits von heute |
| `heute` | alle Habits von heute als Liste |
| `woche` | Wochenraster mit Häkchen pro Tag |
| `habit: Name` | ein Habit zum Abhaken |
| `aufgaben` | offene Aufgaben |
| `vers` | Vers bzw. Satz des Tages |
| `monat` | Monatskalender mit Erfüllung pro Tag |
| `serie` / `serie: Name` | längste Serie bzw. Serie eines Habits |
| `stimmung` | Stimmung des Tages |

Ein Tipp auf einen Habit, eine Aufgabe oder eine Stimmung öffnet kurz Scriptable und trägt direkt ein (Bestätigung mit „Rückgängig“). Ein Tipp auf eine freie Stelle zeigt die Liste „Heute abhaken“. Die Sabrly-App selbst lässt sich aus Scriptable nicht öffnen (`webapp://` funktioniert nur aus Notizen).

### Abhaken ohne dass sich etwas öffnet (Kurzbefehle)

Kurzbefehl mit der Aktion „Run Script“ (Scriptable): Script `Sabrly`, Parameter = Habit-Name (z. B. `Beten`) oder `stimmung: 4`, „Run In App“ aus. Die Kurzbefehle in einen Ordner legen und das Kurzbefehle-Widget mit diesem Ordner auf den Home-Bildschirm setzen.

## Gebet

In Sabrly unter Mehr → Gebet einschalten und die Stadt wählen. Je früher im Zeitfenster abgehakt wird, desto mehr Prozent
(Fajr: am besten in den letzten 40 Minuten vor Sonnenaufgang; Asr endet 30 Minuten vor Maghrib; Isha bis Mitternacht 100 → 20,
dann 20, im letzten Drittel der Nacht 10; nachgeholt 10). Gesperrt vor Beginn, Uhrzeit ändern per langem Druck (✎).
Adhan-Mitteilungen plant das Scriptable-Skript.

## Training

Eigener Tab in der Leiste (Statistik steckt dann oben in Habits; unter Mehr → Ansicht wieder als eigener Tab einstellbar).
Beim ersten Öffnen eine Vorlage wählen (Push · Pull · Tag C, Push · Pull · Beine, Oberkörper · Unterkörper, Ganzkörper oder leer),
danach ist alles änderbar: Trainingstage, Übungen aus der Bibliothek oder eigene, Sätze, Wiederholungsbereich, Pause (Zeitrad), EMOM-Blöcke.
Die Woche wird pro Woche geplant (mit Schicht pro Tag). Im Training: Sätze abhaken, Pausen-Timer (±10 s), ⓘ für Ausführung und Video,
⇄ für Alternativen. Vorschläge nach doppelter Progression, Plateau-Hinweis ab 5 Einheiten ohne Fortschritt.
Läufe (locker/lang oder Intervalle nach Zeit oder Strecke) mit Auswertung „Pace bei Puls unter …“, Kilometer pro KW und Intervall-Verlauf.
Nach dem Speichern wird der Habit „Training“ (bzw. „Laufen“) automatisch abgehakt.
Am Ende der Pause gibt es einen kurzen Ton und der Bildschirm leuchtet grün auf; während des Trainings bleibt der Bildschirm an (beides unter Training → ⚙︎).
„Für Claude kopieren“ (Woche, einzelnes Training, einzelner Lauf) erzeugt einen kompakten Text mit allen Sätzen, Gewichten, Läufen und Habits zum Einfügen in einen Chat.

## Wochenrückblick

Sonntags (und montags für die vergangene Woche) zeigt Heute einen Rückblick: Habits in % mit Vergleich zur Vorwoche, Training, Kilometer,
Stimmung, was gut lief und was ausbaufähig ist – mit „Nächste Woche planen“. Das Widget plant dazu sonntags um 18 Uhr eine Mitteilung
„Woche planen“ mit Kurzfassung (abschaltbar unter Mehr → Ansicht; entfällt, wenn die nächste Woche schon geplant ist).

## Garmin

Läufe und Trainings kommen automatisch von der Garmin-Uhr. Einrichten: in Scriptable das Sabrly-Skript öffnen → „⌚ Garmin“ →
Schlüssel eingeben (Garmin Connect im Browser → Einstellungen → Personal API Key, direkt: connect.garmin.com/app/settings/personalApiToken).
Der Schlüssel liegt nur im Schlüsselbund des iPhones, nie im Code oder in Firestore.

- Das Widget prüft höchstens alle 20 Minuten auf neue Einheiten (2 pro Aktualisierung), „Jetzt abrufen“ im Skript holt alles der letzten 14 Tage.
- Läufe werden Lauf-Einträge mit den Werten der Uhr (`run[].g`): km-Splits (aus der Aufzeichnung berechnet), Lauf/Geh-Abschnitte,
  Runden, Pulszonen, Kadenz, Höhenmeter, Trainingseffekt. Intervalle erkennt Sabrly aus Runden mit Pause oder aus den Lauf/Geh-Abschnitten –
  dort nur bei echten Gehpausen (≥ 40 s) zwischen mindestens zwei gleich langen, direkt aufeinanderfolgenden Läufen. Was davor bzw. danach liegt,
  ist Ein- bzw. Auslaufen (`seg[].p` = 'e'/'a') und steht auf der Lauf-Seite getrennt. Der Wochenplan entscheidet, ob ein Lauf als locker oder
  Intervall zählt. Intervalle mit Trabpausen (die Uhr erkennt nur Gehen) findet Sabrly am Tempo: zwei klar getrennte Tempos (≥ 22 %),
  mindestens 3 gleich lange schnelle Blöcke (2, wenn der Plan „Intervalle“ sagt). Bei lockeren Läufen zeigt die Lauf-Seite keine Tabelle,
  nur die Summe der kurzen Gehpausen. Läufe mit älterer Auswertung (`g.v` < 3) lädt das Widget einmal neu; selbst geänderte Intervalle bleiben.
- Für die Auswertung mit Claude speichert Sabrly je Lauf einen Minuten-Verlauf (`g.cv`: Pace, Puls, Kadenz, Höhe), die aerobe Entkopplung
  (`g.dc`, nur bei Läufen ohne Intervalle), die Puls-Erholung in Gehpausen (`seg[].d`) sowie Kadenz und Höhenänderung je km.
  „Für Claude kopieren“ nimmt alles mit. Ein selbst eingetragener Lauf am selben Tag bekommt die Werte dazu.
- Krafttraining und sonstige Einheiten (z. B. Indoor-Radfahren, ab 20 min; Gehen nicht) landen in `ga` und werden der Sabrly-Session
  mit der nächsten Startzeit zugeordnet. Gelöschte oder ausgeblendete Einheiten merkt sich der Tag in `gdel`.
- Für heute und gestern hakt der Import den Lauf- bzw. Trainings-Habit ab, ältere Tage bleiben unverändert.
- Status für die App: Dokument `garmin` (zuletzt geprüft, Fehler, letzte Einheiten), sichtbar unter Training → ⚙︎.
- „Bericht für Claude (Test)“ im Skript zeigt, was die Garmin-Schnittstelle liefert (ohne Standort und Personendaten).

## Entwicklung

Quellen, Bau-Skript und Tests liegen in `dev/`. Wie man baut, testet und veröffentlicht, steht in `CLAUDE.md`.
