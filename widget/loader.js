// Sabrly – Widget für Scriptable
// Diesen Code einmal in ein neues Scriptable-Skript namens „Sabrly“ einfügen.
// Er lädt immer die neueste Version des Widgets, offline die zuletzt geladene.
const SRC = 'https://zetzet38.github.io/Sabrly/widget/sabrly-widget.js';
const fm = FileManager.local(), cache = fm.joinPath(fm.documentsDirectory(), 'sabrly-widget-code.js');
let code = null;
try {
  const r = new Request(SRC + '?t=' + Date.now()); r.timeoutInterval = 10;
  const c = await r.loadString();
  if (r.response.statusCode === 200 && c.includes('SABRLY_WIDGET')) { code = c; fm.writeString(cache, c); }
} catch (e) {}
if (!code && fm.fileExists(cache)) code = fm.readString(cache);
if (!code) throw new Error('Sabrly-Widget konnte nicht geladen werden. Prüfe die Internetverbindung und starte das Skript nochmal.');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
await new AsyncFunction(code)();
