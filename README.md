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
