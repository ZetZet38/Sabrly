# Sabrly

Persönlicher Habit-Tracker als Web-App. Login und Sync über Firebase, gehostet mit GitHub Pages.

- `index.html` – die App
- `config.js` – Firebase-Konfiguration
- `firestore.rules` – Datenbank-Regeln (in der Firebase-Konsole einfügen)
- `sw.js`, `manifest.webmanifest`, Icons – Home-Bildschirm und Offline
- `widget/` – Home-Bildschirm-Widgets für die App „Scriptable“ (`loader.js` einmal in Scriptable einfügen, es lädt `sabrly-widget.js`)

## Widgets

Im Widget unter „Parameter“ eintragen:

| Parameter | Widget |
|---|---|
| (leer) | Übersicht: Tagesring, Habits, Woche |
| `woche` | Wochenraster mit Häkchen pro Tag |
| `habit: Name` | ein Habit zum Abhaken |
| `stimmung` | Stimmung des Tages |
| `aufgaben` | offene Aufgaben |

Ein Tipp auf einen Habit, eine Aufgabe oder eine Stimmung trägt ein und öffnet danach die Sabrly-App vom Home-Bildschirm (`webapp://`). Scriptable blitzt dabei kurz auf. Ein Tipp auf eine freie Stelle öffnet nur Sabrly.
