# Sabrly – Projektwissen für Claude

Lies diese Datei zuerst. Sie enthält alles, was eine neue Sitzung braucht, um an Sabrly weiterzuarbeiten.
**Am Ende jeder Sitzung:** diese Datei aktualisieren (neues Wissen eintragen, erledigte Punkte aus der offenen Liste streichen).

## Worum es geht

Sabrly ist Zeynels persönlicher Habit-Tracker mit Training, Läufen, Gebeten, Aufgaben und Wochenrückblick.

- **App:** eine einzige Datei `index.html` (Vanilla JS, keine Bibliotheken), als PWA auf dem iPhone-Home-Bildschirm.
  Live unter https://zetzet38.github.io/Sabrly/ (GitHub Pages, Branch `main`).
- **Sync:** Firebase Auth + Firestore (`config.js`, `firestore.rules`).
- **Widget:** `widget/sabrly-widget.js` für die iPhone-App *Scriptable* (Widgets, Mitteilungen, Garmin-Import).
- **Garmin:** Läufe und Trainings kommen über die Garmin Personal API ins Widget und von dort nach Firestore.
- **Sprache:** Oberfläche und Texte Deutsch, Du-Form. Zeynel ist Schichtarbeiter (Tagesbeginn einstellbar, siehe `dayStart`).

## Arbeitsweise mit Zeynel

- Antworten auf Deutsch, kurz und direkt, mit genauen Schritten. Keine Prototypen, wenn er „los“ sagt – direkt bauen.
- Er testet auf dem iPhone. Nach App-Änderungen muss er Sabrly **komplett schließen und neu öffnen**.
  Widget-Änderungen kommen von selbst (der Loader holt die neue Version).
- Visuelle Änderungen vor dem Veröffentlichen per Screenshot prüfen (iPhone-Breite 390 px, siehe Testen).
- Der Garmin-Schlüssel gehört **nie** in den Chat, ins Repo oder nach Firestore – nur in den iPhone-Schlüsselbund.

## Dateien

| Pfad | Was | Bearbeiten? |
|---|---|---|
| `index.html` | **gebaute** App | nein – wird von `dev/build.py` erzeugt |
| `dev/base/index.base.html` | Basis-App (Habits, Heute, Statistik, Gebete, Aufgaben, Sync …), Stand vor dem Training-Modul | ja, für Änderungen an der Basis-App |
| `dev/build.py` | baut `index.html`: Basis + ~100 gezielte `rep()`-Ersetzungen + Module aus `dev/src/` | ja; `rep()` bricht ab, wenn ein Suchtext nicht genau 1× vorkommt |
| `dev/src/lib.js` | Übungsbibliothek `LIB` (56 Übungen, Muskeln, Tipps) | ja |
| `dev/src/main.js` | Training-Modul (Plan, Tage, Workout-Modus, Läufe, Garmin-Anzeige) + Habit-Sortierung | ja |
| `dev/src/week.js` | Pausen-Ton, Wachhalten, Wochenrückblick, „Für Claude kopieren“-Texte | ja |
| `dev/src/tr.css`, `week.css` | Styles der Module | ja |
| `widget/sabrly-widget.js` | Scriptable-Widget (einzige Quelle, inkl. Garmin) | ja – erste Zeile `// SABRLY_WIDGET vN` bei jeder Änderung hochzählen |
| `widget/loader.js` | Mini-Skript in Scriptable, lädt das Widget von GitHub Pages | selten |
| `sw.js` | Service Worker (network-first) | selten |
| `gebetszeiten/`, `scripts/gebetszeiten.mjs` | Gebetszeiten-Daten | selten |
| `README.md` | Doku für Zeynel | bei neuen Funktionen ergänzen |
| `dev/tests/…` | alle Tests (siehe unten) | bei neuen Funktionen Tests ergänzen |

## Bauen und testen

```bash
cd dev && npm install          # einmal pro Umgebung (@garmin/fitsdk, fflate)
python3 dev/build.py           # baut index.html
bash dev/test.sh               # alle Tests – Ziel: „ALLES GRÜN“
```

- Playwright + Chromium sind in Claude-Code-Cloud-Umgebungen vorinstalliert (über `NODE_PATH`) – **nicht** neu installieren.
  Nur wenn `node -e "require('playwright')"` fehlschlägt: `cd dev && npm i -D playwright && npx playwright install chromium`.
- `test.sh` umfasst (Stand Übergabe): Widget 439 Tests, Garmin-Logik (Erkennung, Tempo, FIT/ZIP 98), Web-App 488 Tests.
- **Web-Tests:** `dev/tests/web/build_harness.py` baut Testseiten aus `index.html` + `fbmock.js` (Firestore-Nachbau, lehnt wie
  das echte Firestore **Arrays in Arrays** und `undefined` ab). `web_train_tests.js` = Training/Garmin, `web_tests.js` = Basis-App.
- **Widget-Tests:** `dev/tests/widget/run.js` ist ein strenger Scriptable-Nachbau (unbekannte Eigenschaften werfen Fehler).
  `actions.js` enthält einen Firestore-REST-Emulator; `garmin_tests.js` / `garmin_sync_tests.js` testen Garmin mit Aufzeichnungen
  aus `fixtures/` (erzeugt von `dev/tests/garmin/gen_*.mjs`).
- **Screenshots:** nach `build_harness.py` liegt `dev/tests/web/web_shot.html` (App ohne Tests, angemeldet als Testnutzer).
  Mit Playwright öffnen (`devices['iPhone 13']`), Zustand per `page.evaluate` setzen (`S`, `LOGS`, `UI`, `render()`), Screenshot ansehen.

## Veröffentlichen

1. `bash dev/test.sh` grün.
2. `git add -A && git commit -m "…"`, dann `git pull --rebase` und `git push` auf **`main`** – GitHub Pages veröffentlicht nur `main`.
   Arbeitet die Sitzung auf einem eigenen Branch (Standard in Claude Code im Web): am Ende in `main` zusammenführen und `main` pushen.
   Geht das nicht (Push auf `main` verweigert), einen Pull Request erstellen und Zeynel sagen, dass er ihn auf GitHub mit „Merge“ übernimmt.
3. GitHub Pages braucht ~1 min. Prüfen: Datei mit Cache-Buster laden, z. B. `…/widget/sabrly-widget.js?t=<zeit>` (erste Zeile = Version).
   **Hängt Pages länger als ~5 min** (kam vor): leeren Commit pushen – `git commit --allow-empty -m "GitHub Pages neu veröffentlichen"`.
4. Zeynel Bescheid geben: App neu öffnen; bei Garmin-Änderungen in Scriptable „⌚ Garmin → Jetzt abrufen“.

## Datenmodell (Firestore `users/{uid}/data/…`)

- `state`: Habits, Einstellungen (`settings.dayStart`, `weekNotify`, `revSeen` …), `training`. Wird beim Laden normalisiert
  (`normalize`, `normTraining`) – **unbekannte Felder in `training` gehen dabei verloren**, neue Felder dort in `normTraining` aufnehmen.
- `m-YYYY-MM`: `days.{YYYY-MM-DD}` mit `h` (Habit-Werte), Stimmung, Aufgaben, `tr` (Krafttrainings), `run` (Läufe), `ga` (Garmin-Einheiten),
  `gdel` (gelöschte Garmin-IDs). Monatsdokumente werden **nicht** normalisiert.
- `garmin`: Status vom Widget (`at`, `err`, `n`, `last`) – die App liest ihn nur (Training → ⚙︎).
- Sync: lokale Änderungen → `touch(key)` → Flush schreibt das ganze Dokument. Kommt ein Snapshot für ein Dokument mit
  ungespeicherten lokalen Änderungen, gewinnt lokal.
- **Firestore: keine Arrays direkt in Arrays, kein `undefined`.** Darum überall Objekte in Listen.

### Training (`S.training`, siehe Kopf von `dev/src/main.js`)

- `days:[{id,name,sub,col,blocks}]`, `ex` (eigene Übungen), `weeks:{Montag:{d:{0..6:[ids]}, s:{0..6:'F'|'S'|'N'}}}` (Plan + Schicht),
  `habit`/`rhabit` (Habit für Training/Lauf, automatisch abhaken), `hr` (Pulsgrenze locker), `snd`, `wake`.
- Baustein: `{k:'ex',id,e,p:[{k,r}],lo,hi,rest,note}` oder EMOM `{k:'emom',id,v,n,it:[{e,r,k}],note}`.
- Session pro Tag: `tr:[{id,day,n,st,en,feel,x:[{b,e,s:[{k,r}]} | {b,em:{v,n,it,ok}}]}]`.
- Lauf: `run:[{id,t:'easy'|'iv',dur,km,hr,max,iv,g}]`; Plan-Einträge `@L` (locker) / `@I` (Intervalle).
- Doppelte Progression; „Hart“ hält das Gewicht; Plateau = 5 Einheiten ohne Fortschritt; Wochensätze je Muskel
  (`MUS`: Brust, Rücken, Schultern, Bizeps, Trizeps, Beine, Core).

## Garmin (Widget, `widget/sabrly-widget.js`, Abschnitt „Garmin (Personal API)“)

- Basis `https://personal.connectapi.garmin.com`. Token: `POST /personalapitoken-service/personal-api/personal-api-key/token`
  mit `Authorization: ApiKey <schlüssel>` → JWT (24 h, im Schlüsselbund gecacht). Danach `Authorization: Bearer <jwt>`.
- Genutzt: Aktivitätsliste (`/activitylist-service/activities/search/activities`), Details (`/activity-service/activity/{id}`),
  Aufzeichnung als ZIP (`/download-service/files/activity/{id}`). `/splits`, `/exerciseSets`, `/hrTimeInZones` gibt es **nicht** (404).
- Das Widget entpackt das ZIP (eigenes inflate) und liest die FIT-Datei selbst (`fitParse`); getestet gegen den offiziellen Garmin-Decoder.
- Ablauf: Widget prüft höchstens alle 20 min (2 Einheiten pro Aktualisierung); in Scriptable „⌚ Garmin → Jetzt abrufen“ holt alles der
  letzten 14 Tage. Ob eine Einheit schon da ist, entscheidet **nur** Firestore (+ `gdel`) – so kommt ein Import zurück, falls die App ihn
  beim gleichzeitigen Speichern überschrieben hat. Habit-Haken nur für heute/gestern.
- Läufe → `run[]` mit `g` (Uhrwerte): `km` (Splits mit Puls, Kadenz, Höhe), `seg` (Abschnitte), `lap`, `z`/`zb` (Zonen), `cv` (Verlauf je Minute:
  Pace/Puls/Kadenz/Höhe), `dc` (aerobe Entkopplung, nur ohne Intervalle), `ivx` (erkannte Intervalle), `v` (Auswertungs-Version `GV`, aktuell 3).
  Läufe mit `g.v < GV` lädt das Widget neu und wertet sie neu aus (selbst geänderte Intervalle bleiben).
- Intervall-Erkennung: (1) Runden mit Pause (Workout der Uhr); (2) Lauf/Geh-Abschnitte der Uhr – nur echte Gehpausen ≥ 40 s, ≥ 2 gleich lange
  Läufe direkt hintereinander, Pausenanteil ≥ 8 %; (3) Trabpausen am Tempo (`gPaceSegs`): zwei Tempos ≥ 22 % auseinander, ≥ 3 gleiche
  schnelle Blöcke (2, wenn Plan `@I`). Davor/danach = Ein-/Auslaufen (`seg[].p = 'e'/'a'`). Plan `@L`/`@I` entscheidet den Typ.
- Kraft und Sonstiges (ab 20 min, kein Gehen) → `ga[]`; die App ordnet Garmin-Kraft der Sabrly-Session mit der nächsten Startzeit zu.
- Zeynels Stand: Uhr mit metrischen Einheiten, Auto-Lap 1 km. Erster Schlüssel am 10.11.2026 für 30 Tage erstellt
  (läuft ~10.12.2026 ab → in Garmin Connect neu erstellen, in Scriptable „Schlüssel ersetzen“).

## iPhone-/PWA-/Scriptable-Eigenheiten (hart erarbeitet)

- Zeit-Rad: transparentes `<input type=time>` über dem Feld (Minuten:Sekunden).
- Haptik-Overlays (iOS-Schalter-Trick) blockieren das Scrollen → nur auf Elementen ≤ 120×64 px.
- Gummiband-Scrollen überall: `body` `min-height: calc(100dvh + 1px)`; Zeilen mit `touch-action: pan-y`.
- „Bewegung reduzieren“: Seitenwechsel als kurzes Überblenden (`rmfade`) statt ohne Übergang.
- Datumsfelder: `-webkit-appearance:none` und `min-width:0`, sonst ragen sie über den Rand.
- Ton: Web Audio erst nach Tipp entsperren, `navigator.audioSession.type='transient'`; im Lautlos-Modus evtl. stumm → grünes Aufleuchten als Ersatz.
- Bildschirm an: Wake Lock API während des Trainings.
- Mitteilungen/Widgets können die Home-Bildschirm-PWA **nicht** öffnen → Inhalte direkt in die Mitteilung schreiben.
- Orange/Gelb als Tönung auf dunklem Grund wirkt bräunlich → stärkere Tönung (`TTA`).
- Scriptable: Widgets haben wenig Zeit/Speicher → Garmin-Import im Widget begrenzt (Zeitbudget, wenige Einheiten).

## Offene Liste

Mit Zeynel besprochen am 11.11.2026, Reihenfolge = Vorschlag (oben zuerst):

1. **RIR je Satz** – nach dem Abhaken eine Reihe zum Antippen `0 · 1 · 2 · 3 · 4+` (optional, letzter Wert vorbelegt). Progression nutzt RIR
   (Luft nach oben → mehr steigern, RIR 0 → halten). „Wie schwer war's?“ am Ende aus RIR vorschlagen. In „Für Claude kopieren“ aufnehmen.
2. **Notiz pro Übung** im Training – kleines „+ Notiz“, Schnellauswahl („Pause verlängert“, „links/rechts ungleich“, „Technik unsauber“) + Freitext.
   In Zusammenfassung und Text für Claude.
3. **Zeiten automatisch** – Zeitstempel je abgehaktem Satz → echte Pausen, Zeit pro Übung, Wechselzeiten. Anzeige in der Zusammenfassung, im Text für Claude.
   (Später möglich: Garmin-Puls je Übung aus der Kraft-Aufzeichnung über diese Zeitstempel.)
4. **Zusammenfassung wieder ansehen** – die Ansicht nach Trainingsende (Minuten, Sätze, Tonnen, Vorschläge) soll für gespeicherte Trainings
   wieder aufrufbar sein: Antippen → Zusammenfassung, „Bearbeiten“ als Knopf darin.
5. **Aufwärmen** – Zeit bis zum ersten Arbeitssatz automatisch messen; am Start antippen, was gemacht wurde (Rad, Laufband, Mobility, Aufwärmsätze);
   einzelne Sätze als Aufwärmsatz markierbar (zählen nicht für die Progression).
6. **Supersätze** – zwei Übungen im Trainingstag verbinden (z. B. Swings + Suitcase Carry), im Training abwechselnd, Pause erst nach dem Paar.

Später / Ideen: alternative Übungen (erst wenn Zeynel regelmäßig im Gym trackt), Trainings-Widget, Körpergewicht/Bauchumfang,
Intervall-Farbe Pink statt Orange (falls es ihn stört). Aufräumen auf GitHub: Branch „probe“ löschen (macht Zeynel).
