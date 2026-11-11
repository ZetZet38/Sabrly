// Lädt den Garmin-Teil direkt aus widget/sabrly-widget.js (einzige Quelle) und gibt die genannten Funktionen zurück.
// Scriptable-Objekte werden durch einfache Platzhalter ersetzt – getestet wird nur die reine Logik.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const WIDGET = path.join(HERE, '..', '..', '..', 'widget', 'sabrly-widget.js');
export function loadGarmin(names) {
  const w = fs.readFileSync(WIDGET, 'utf8'), a = w.indexOf('/* ---------- Garmin (Personal API)'), b = w.indexOf('async function main() {');
  if (a < 0 || b < a) throw new Error('Garmin-Abschnitt im Widget nicht gefunden');
  const pad = n => String(n).padStart(2, '0');
  return new Function('pad', 'iso', 'kget', 'Keychain', 'Request', 'Data', 'Alert', 'Pasteboard', 'QuickLook', 'info', w.slice(a, b) + '\nreturn {' + names.join(',') + '};')(pad, () => '', () => null, {}, null, null, null, null, null, null);
}
