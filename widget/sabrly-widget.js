// SABRLY_WIDGET v13
// Sabrly-Widget für die App „Scriptable“.
// Einmal in Scriptable ausführen → anmelden. Danach als Widget hinzufügen.
// Ein Tipp auf das Widget öffnet kurz Scriptable und trägt direkt in Sabrly ein (ohne Safari).
// Welches Widget erscheint, steuerst du über das Feld „Parameter“ in den Widget-Einstellungen:
//   (leer)        klein: Tagesring · mittel/groß: alle Habits von heute
//   heute         alle Habits von heute als Liste
//   woche         Wochenraster: jeder Habit mit Häkchen pro Tag
//   habit: Lesen  ein einzelner Habit zum Abhaken (Name aus Sabrly)
//   aufgaben      offene Aufgaben
//   vers          Vers bzw. Satz des Tages
//   monat         Monatskalender mit Erfüllung pro Tag
//   serie         längste Serie (serie: Lesen für einen bestimmten Habit)
//   stimmung      Stimmung des Tages
// Garmin: In der Scriptable-App „⌚ Garmin“ wählen und den Schlüssel aus Garmin Connect (Einstellungen → Personal API Key) eingeben.
// Danach übernimmt das Widget neue Läufe und Trainings automatisch nach Sabrly. Der Schlüssel liegt nur im Schlüsselbund.

const CFG = {
  apiKey: 'AIzaSyDigyr-IMs9guXwfa-o-fs5CLmZ9INUGdc',
  projectId: 'sabrly-b38ee',
  appUrl: 'https://zetzet38.github.io/Sabrly/'
};
const K = { refresh: 'sabrly.refresh', id: 'sabrly.idtoken', exp: 'sabrly.exp', uid: 'sabrly.uid', email: 'sabrly.email' };
const COL = {
  top: new Color('#26282C'), bottom: new Color('#000000'),
  fg: new Color('#EEF2F1'), muted: new Color('#8A9391'), faint: new Color('#4A5250'),
  accent: new Color('#46E0AE'), track: new Color('#FFFFFF', 0.12), chip: new Color('#FFFFFF', 0.06),
  amber: new Color('#F2A93B'), blue: new Color('#4C8DFF'), green: new Color('#2FCB8E'), crit: new Color('#FF5F6D'),
  ink: new Color('#0B0D0E')
};
const DN = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const DL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const MN = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MOODS = ['😞', '😕', '😐', '🙂', '😄'];

/* ---------- Rechenlogik (gleich wie in der App) ---------- */
let S = { habits: [], todos: [], quotes: [], settings: { dayStart: 0 } }, LOGS = {};
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const pdate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = pdate(s); d.setDate(d.getDate() + n); return iso(d); };
const wd = s => (pdate(s).getDay() + 6) % 7;
const weekStart = s => addDays(s, -wd(s));
const mkey = s => 'm-' + s.slice(0, 7);
const today = () => iso(new Date(Date.now() - (S.settings.dayStart || 0) * 3600e3));
const dayGet = d => (LOGS[mkey(d)] && LOGS[mkey(d)].days && LOGS[mkey(d)].days[d]) || null;
const scheduled = (h, d) => h.freq === 'weekly' || !h.days || h.days.length >= 7 || h.days.includes(wd(d));
const active = d => S.habits.filter(h => !h.archived && h.created <= d && scheduled(h, d));
const tgt = h => h.freq === 'daily' ? Math.max(1, (h.labels && h.labels.length) || h.target || 1) : 1;
const hraw = (h, d) => { const e = dayGet(d); return e && e.h ? e.h[h.id] : undefined; };
function hv(h, d) { const v = hraw(h, d); return Array.isArray(v) ? v.length : (+v || 0); }
const isDone = (h, d) => hv(h, d) >= tgt(h);
const frac = (h, d) => Math.min(1, hv(h, d) / tgt(h));
// nächster Wert beim Abhaken, gleich wie in der App
function stepVal(h, d) {
  if (h.freq === 'daily' && h.labels.length) { const r = hraw(h, d), a = Array.isArray(r) ? r.slice() : []; const nx = h.labels.findIndex((_, i) => !a.includes(i)); return nx < 0 ? [] : a.concat([nx]).sort((p, q) => p - q); }
  if (h.freq === 'daily' && tgt(h) > 1) { const v = hv(h, d); return v >= tgt(h) ? 0 : v + 1; }
  return hv(h, d) >= 1 ? 0 : 1;
}
function nextLabel(h, d) { if (h.freq !== 'daily' || !h.labels.length) return ''; const r = hraw(h, d), a = Array.isArray(r) ? r : []; const nx = h.labels.findIndex((_, i) => !a.includes(i)); return nx < 0 ? '' : String(h.labels[nx]); }
function weekCount(h, ws, until) { let c = 0; for (let i = 0; i < 7; i++) { const d = addDays(ws, i); if (until && d > until) break; if (isDone(h, d)) c++; } return c; }
function streak(h) {
  const t = today();
  if (h.freq === 'daily') {
    let d = t, n = 0; if (scheduled(h, t) && !isDone(h, t)) d = addDays(t, -1);
    for (let i = 0; i < 3700 && d >= h.created; i++) { if (!scheduled(h, d)) { d = addDays(d, -1); continue; } if (!isDone(h, d)) break; n++; d = addDays(d, -1); }
    return n;
  }
  let ws = weekStart(t); if (weekCount(h, ws, t) < h.target) ws = addDays(ws, -7); let n = 0;
  for (let i = 0; i < 530 && addDays(ws, 6) >= h.created && weekCount(h, ws, t) >= h.target; i++) { n++; ws = addDays(ws, -7); }
  return n;
}
function dayScore(d) { const a = active(d); const dl = a.filter(h => h.freq === 'daily'); const L = dl.length ? dl : a; if (!L.length) return 0; return L.reduce((s, h) => s + frac(h, d), 0) / L.length; }
function dayHash(d) { let h = 0; for (const c of d) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
function pickQuote(d) { const Q = S.quotes || []; return Q.length ? Q[dayHash(d) % Q.length] : null; }

function normalizeState(s) {
  s = s || {};
  const habits = (Array.isArray(s.habits) ? s.habits : []).map(h => ({
    id: String(h.id || ''), name: String(h.name || 'Habit'), emoji: h.emoji || '✅', freq: h.freq === 'weekly' ? 'weekly' : 'daily',
    target: Math.max(1, +h.target || 1), labels: Array.isArray(h.labels) ? h.labels : [],
    days: Array.isArray(h.days) && h.days.length ? h.days.map(Number) : [0, 1, 2, 3, 4, 5, 6],
    time: h.time || '', created: h.created || '2000-01-01', archived: !!h.archived
  }));
  const todos = (Array.isArray(s.todos) ? s.todos : []).map(x => ({ id: String(x.id || ''), title: String(x.title || ''), prio: ['h', 'n', 'l'].includes(x.prio) ? x.prio : 'n', due: x.due || null, time: x.time || '', done: !!x.done }));
  return {
    habits, todos, quotes: Array.isArray(s.quotes) ? s.quotes : [],
    settings: { dayStart: Math.max(0, Math.min(6, +((s.settings || {}).dayStart) || 0)), userName: String((s.settings || {}).userName || ''),
      prayer: (s.settings && s.settings.prayer && typeof s.settings.prayer === 'object') ? s.settings.prayer : null, weekNotify: (s.settings || {}).weekNotify !== false },
    training: (s.training && typeof s.training === 'object') ? s.training : null
  };
}

function model() {
  const t = today(), hs = active(t);
  const items = hs.map(h => ({
    id: h.id, emoji: h.emoji, name: h.name, time: h.time, weekly: h.freq === 'weekly', td: isDone(h, t), done: h.freq === 'weekly' ? weekCount(h, weekStart(t), t) >= h.target : isDone(h, t),
    v: h.freq === 'weekly' ? weekCount(h, weekStart(t), t) : hv(h, t), T: h.freq === 'weekly' ? h.target : tgt(h), streak: streak(h)
  })).sort((a, b) => (a.done - b.done) || ((a.time || '99:99') < (b.time || '99:99') ? -1 : 1));
  const daily = hs.filter(h => h.freq === 'daily');
  const ws = weekStart(t);
  const week = DN.map((n, i) => { const d = addDays(ws, i); return { label: n, fut: d > t, today: d === t, p: d > t ? 0 : dayScore(d), has: active(d).length > 0 }; });
  const todosOpen = S.todos.filter(x => !x.done && (!x.due || x.due <= t)).length;
  return {
    t, score: dayScore(t), items, done: items.filter(i => i.done).length, total: items.length,
    dailyOpen: daily.filter(h => !isDone(h, t)).length, best: items.reduce((m, i) => Math.max(m, i.streak), 0),
    week, quote: pickQuote(t), name: S.settings.userName, todosOpen
  };
}
// Wochenraster: pro Habit und Tag ein Zustand
function weekGrid() {
  const t = today(), ws = weekStart(t), we = addDays(ws, 6);
  const rows = S.habits.filter(h => !h.archived && h.created <= we).map(h => ({
    id: h.id, emoji: h.emoji, name: h.name, open: h.created <= t && scheduled(h, t) && !isDone(h, t),
    cells: DN.map((_, i) => {
      const d = addDays(ws, i);
      if (d > t || d < h.created) return { k: 'fut' };
      if (h.freq === 'daily' && !scheduled(h, d)) return { k: 'off' };
      if (isDone(h, d)) return { k: 'done' };
      const f = frac(h, d);
      if (f > 0) return { k: 'part', p: f };
      return { k: d === t ? 'today' : 'miss' };
    })
  }));
  return { t, ws, we, rows };
}
const PRW = { h: 0, n: 1, l: 2 };
function todoList() {
  const t = today(), open = S.todos.filter(x => !x.done);
  const sort = (a, b) => ((a.due || '9999') < (b.due || '9999') ? -1 : (a.due || '9999') > (b.due || '9999') ? 1 : PRW[a.prio] - PRW[b.prio]);
  const now = open.filter(x => !x.due || x.due <= t).sort(sort), later = open.filter(x => x.due && x.due > t).sort(sort);
  return { t, now, later, list: now.concat(later) };
}

/* ---------- Firebase ---------- */
function fv(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fv);
  if ('mapValue' in v) { const o = {}; for (const [k, x] of Object.entries(v.mapValue.fields || {})) o[k] = fv(x); return o; }
  return null;
}
const kget = k => Keychain.contains(k) ? Keychain.get(k) : null;
function authError(code) {
  const m = { EMAIL_NOT_FOUND: 'E-Mail oder Passwort stimmt nicht.', INVALID_PASSWORD: 'E-Mail oder Passwort stimmt nicht.', INVALID_LOGIN_CREDENTIALS: 'E-Mail oder Passwort stimmt nicht.',
    INVALID_EMAIL: 'Diese E-Mail-Adresse ist ungültig.', USER_DISABLED: 'Dieses Konto ist gesperrt.', MISSING_PASSWORD: 'Gib dein Passwort ein.' };
  const c = String(code || ''); for (const k of Object.keys(m)) if (c.startsWith(k)) return m[k];
  if (c.startsWith('TOO_MANY_ATTEMPTS')) return 'Zu viele Versuche. Warte kurz und probier es dann nochmal.';
  return 'Anmeldung fehlgeschlagen (' + c + ').';
}
async function postJSON(url, body, form) {
  const r = new Request(url); r.method = 'POST'; r.timeoutInterval = 15;
  r.headers = { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' };
  r.body = form ? body : JSON.stringify(body);
  return await r.loadJSON();
}
async function login() {
  const a = new Alert();
  a.title = 'Bei Sabrly anmelden';
  a.message = 'Mit derselben E-Mail und demselben Passwort wie in der App. Das Passwort wird nicht gespeichert.';
  a.addTextField('E-Mail', kget(K.email) || '');
  a.addSecureTextField('Passwort', '');
  a.addAction('Anmelden'); a.addCancelAction('Abbrechen');
  if (await a.presentAlert() === -1) return false;
  const email = a.textFieldValue(0).trim(), pw = a.textFieldValue(1);
  const j = await postJSON('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + CFG.apiKey, { email, password: pw, returnSecureToken: true });
  if (j.error || !j.refreshToken) { await info('Anmeldung fehlgeschlagen', authError(j.error && j.error.message)); return false; }
  Keychain.set(K.refresh, j.refreshToken); Keychain.set(K.id, j.idToken); Keychain.set(K.uid, j.localId); Keychain.set(K.email, email);
  Keychain.set(K.exp, String(Date.now() + (Number(j.expiresIn || 3600) - 120) * 1000));
  return true;
}
function logout() { for (const k of Object.values(K)) if (Keychain.contains(k)) Keychain.remove(k); garminForget(); const fm = FileManager.local(), p = cachePath(); if (fm.fileExists(p)) fm.remove(p); }
async function idToken() {
  const id = kget(K.id), exp = Number(kget(K.exp) || 0);
  if (id && exp > Date.now()) return id;
  const rt = kget(K.refresh); if (!rt) throw new Error('LOGIN');
  const j = await postJSON('https://securetoken.googleapis.com/v1/token?key=' + CFG.apiKey, 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(rt), true);
  if (j.error || !j.id_token) {
    const msg = String((j.error && (j.error.message || j.error.status)) || '');
    if (/TOKEN_EXPIRED|INVALID_REFRESH_TOKEN|USER_NOT_FOUND|USER_DISABLED|INVALID_GRANT_TYPE|MISSING_REFRESH_TOKEN/.test(msg)) throw new Error('LOGIN');
    throw new Error(msg || 'Netzwerkfehler');
  }
  Keychain.set(K.refresh, j.refresh_token); Keychain.set(K.id, j.id_token); if (j.user_id) Keychain.set(K.uid, j.user_id);
  Keychain.set(K.exp, String(Date.now() + (Number(j.expires_in || 3600) - 120) * 1000));
  return j.id_token;
}
async function loadRemote() {
  const tok = await idToken(), uid = kget(K.uid); if (!uid) throw new Error('LOGIN');
  let docs = [], pt = '';
  for (let i = 0; i < 20; i++) {
    const r = new Request('https://firestore.googleapis.com/v1/projects/' + CFG.projectId + '/databases/(default)/documents/users/' + uid + '/data?pageSize=300' + (pt ? '&pageToken=' + encodeURIComponent(pt) : ''));
    r.headers = { Authorization: 'Bearer ' + tok }; r.timeoutInterval = 15;
    const j = await r.loadJSON();
    if (j.error) { if (j.error.code === 401 || j.error.status === 'UNAUTHENTICATED') { Keychain.remove(K.id); } throw new Error(j.error.status === 'PERMISSION_DENIED' || j.error.code === 401 ? 'LOGIN' : (j.error.message || 'Fehler')); }
    docs = docs.concat(j.documents || []); pt = j.nextPageToken || ''; if (!pt) break;
  }
  let state = null; const logs = {};
  for (const d of docs) {
    const id = String(d.name || '').split('/').pop(), obj = fv({ mapValue: { fields: d.fields || {} } });
    if (id === 'state') state = obj; else if (id.startsWith('m-')) logs[id] = obj && obj.days ? obj : { days: {} };
  }
  return { state, logs, at: Date.now() };
}
const cachePath = () => { const fm = FileManager.local(); return fm.joinPath(fm.documentsDirectory(), 'sabrly-widget-data.json'); };
function saveCache(d) { try { FileManager.local().writeString(cachePath(), JSON.stringify(d)); } catch (e) {} }
function readCache() { try { const fm = FileManager.local(), p = cachePath(); return fm.fileExists(p) ? JSON.parse(fm.readString(p)) : null; } catch (e) { return null; } }

/* ---------- Eintragen (Firestore REST) ----------
   Es wird nur das eine Feld geändert, das sich ändert. Eine Vorbedingung (updateTime) sorgt dafür,
   dass nichts überschrieben wird, was die App in der Zwischenzeit gespeichert hat. */
function tval(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: v.length ? { values: v.map(tval) } : {} };
  const f = {}; for (const [k, x] of Object.entries(v)) f[k] = tval(x); return { mapValue: { fields: f } };
}
const docUrl = id => 'https://firestore.googleapis.com/v1/projects/' + CFG.projectId + '/databases/(default)/documents/users/' + kget(K.uid) + '/data/' + id;
const fpath = segs => segs.map(s => /^[A-Za-z_][A-Za-z_0-9]*$/.test(s) ? s : '`' + String(s).replace(/\\/g, '\\\\').replace(/`/g, '\\`') + '`').join('.');
function nest(segs, val) { if (val === undefined) return {}; let v = val; for (let i = segs.length - 1; i >= 1; i--) v = { mapValue: { fields: { [segs[i]]: v } } }; return { [segs[0]]: v }; }
function rawAt(fields, segs) { let f = fields; for (let i = 0; i < segs.length; i++) { const v = f && f[segs[i]]; if (!v) return undefined; if (i === segs.length - 1) return v; f = v.mapValue && v.mapValue.fields; } return undefined; }
function fsError(e) {
  const st = String(e.status || ''), c = Number(e.code || 0);
  if (c === 401 || st === 'UNAUTHENTICATED') { if (Keychain.contains(K.id)) Keychain.remove(K.id); return new Error('LOGIN'); }
  if (st === 'PERMISSION_DENIED') return new Error('LOGIN');
  if (st === 'FAILED_PRECONDITION' || st === 'ALREADY_EXISTS' || st === 'ABORTED' || c === 409) return new Error('CONFLICT');
  return new Error(e.message || st || 'Fehler');
}
async function fsCall(method, url, body) {
  const tok = await idToken(), uid = kget(K.uid); if (!uid) throw new Error('LOGIN');
  const r = new Request(url); r.method = method; r.timeoutInterval = 15;
  r.headers = { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' };
  if (body) r.body = JSON.stringify(body);
  const j = await r.loadJSON();
  return j || {};
}
async function getDoc(id) {
  const j = await fsCall('GET', docUrl(id));
  if (j.error) { if (Number(j.error.code) === 404 || j.error.status === 'NOT_FOUND') return null; throw fsError(j.error); }
  return j;
}
// pre: updateTime des gelesenen Dokuments, null = Dokument darf noch nicht existieren
async function patchField(id, segs, val, pre) {
  let url = docUrl(id) + '?updateMask.fieldPaths=' + encodeURIComponent(fpath(segs));
  if (pre) url += '&currentDocument.updateTime=' + encodeURIComponent(pre);
  else if (pre === null) url += '&currentDocument.exists=false';
  const j = await fsCall('PATCH', url, { fields: nest(segs, val) });
  if (j.error) throw fsError(j.error);
  return j;
}
// mehrere Felder in einem Schritt (z. B. Gebet + Uhrzeit)
function mergeF(a, b) { for (const [k, v] of Object.entries(b)) { if (a[k] && a[k].mapValue && v.mapValue) a[k] = { mapValue: { fields: mergeF(Object.assign({}, a[k].mapValue.fields || {}), v.mapValue.fields || {}) } }; else a[k] = v; } return a; }
async function patchFields(id, ops, pre) {
  let url = docUrl(id) + '?' + ops.map(([segs]) => 'updateMask.fieldPaths=' + encodeURIComponent(fpath(segs))).join('&');
  if (pre) url += '&currentDocument.updateTime=' + encodeURIComponent(pre);
  else if (pre === null) url += '&currentDocument.exists=false';
  const fields = ops.reduce((acc, [segs, val]) => mergeF(acc, nest(segs, val)), {});
  const j = await fsCall('PATCH', url, { fields });
  if (j.error) throw fsError(j.error);
  return j;
}
async function retry(fn) { for (let i = 0; ; i++) { try { return await fn(); } catch (e) { if (e.message !== 'CONFLICT' || i >= 3) throw e; } } }
const asObj = doc => fv({ mapValue: { fields: (doc && doc.fields) || {} } });
async function readState() { const sd = await getDoc('state'); if (!sd) throw new Error('NODATA'); S = normalizeState(asObj(sd)); return sd; }
const q = s => '„' + s + '“';
// Habit-Definitionen und Tageswechsel aus dem Widget-Zwischenspeicher (spart eine Anfrage), sonst frisch laden
async function stateFor(hid) { const c = readCache(); if (c && c.state) { S = normalizeState(c.state); if (!hid || S.habits.some(x => x.id === hid)) return; } await readState(); }

// einen Habit für heute abhaken (bei mehreren Schritten: der nächste Schritt)
async function actTick(hid) {
  await stateFor(hid);
  const h = S.habits.find(x => x.id === hid && !x.archived);
  if (!h) return { title: 'Nicht gefunden', msg: 'Diesen Habit gibt es nicht mehr.' };
  if (prayerHabit() === h && PS().on) { const r = await actPrayer(h); if (r) return r; }
  const t = today();
  if (!scheduled(h, t) || h.created > t) return { title: q(h.name), msg: 'Ist heute nicht geplant.' };
  return retry(async () => {
    const mk = mkey(t), md = await getDoc(mk);
    LOGS = {}; if (md) LOGS[mk] = asObj(md);
    if (isDone(h, t)) return { title: q(h.name) + ' ✓', msg: 'Ist heute schon erledigt.' };
    const segs = ['days', t, 'h', h.id], before = md ? rawAt(md.fields, segs) : undefined, nv = stepVal(h, t);
    const step = nextLabel(h, t);
    const res = await patchField(mk, segs, tval(nv), md ? md.updateTime : null);
    if (!LOGS[mk]) LOGS[mk] = { days: {} }; if (!LOGS[mk].days) LOGS[mk].days = {}; if (!LOGS[mk].days[t]) LOGS[mk].days[t] = {};
    if (!LOGS[mk].days[t].h) LOGS[mk].days[t].h = {}; LOGS[mk].days[t].h[h.id] = nv;
    const done = isDone(h, t);
    return { ok: true, title: q(h.name) + (done ? ' abgehakt ✓' : (step ? ': ' + step + ' ✓' : ' ✓')), msg: done ? openLine(t) : hv(h, t) + ' von ' + tgt(h) + ' geschafft.',
      undo: { doc: mk, segs, val: before, pre: res.updateTime } };
  });
}
function openLine(t) { const n = openToday(t).length; return n ? 'Heute noch ' + n + ' offen.' : 'Alles für heute erledigt. Stark!'; }
// Stimmung für heute speichern
async function actMood(v) {
  v = Math.round(+v); if (!(v >= 1 && v <= 5)) return { title: 'Stimmung', msg: 'Ungültiger Wert.' };
  await stateFor(null);
  const t = today(), mk = mkey(t), segs = ['days', t, 'mood'];
  return retry(async () => {
    const md = await getDoc(mk), before = md ? rawAt(md.fields, segs) : undefined;
    const res = await patchField(mk, segs, tval(v), md ? md.updateTime : null);
    return { ok: true, title: 'Stimmung gespeichert ' + MOODS[v - 1], msg: '', undo: { doc: mk, segs, val: before, pre: res.updateTime } };
  });
}
// Aufgabe als erledigt markieren
async function actTodo(tid) {
  return retry(async () => {
    const sd = await readState(), t = today();
    const tf = sd.fields && sd.fields.todos, raw = (tf && tf.arrayValue && tf.arrayValue.values) || [];
    const it = raw.find(x => x && x.mapValue && x.mapValue.fields && fv(x.mapValue.fields.id) === tid);
    if (!it) return { title: 'Nicht gefunden', msg: 'Diese Aufgabe gibt es nicht mehr.' };
    const f = it.mapValue.fields, title = String(fv(f.title) || 'Aufgabe');
    if (fv(f.done) === true) return { title: q(title) + ' ✓', msg: 'Ist schon erledigt.' };
    const before = JSON.parse(JSON.stringify(tf));
    f.done = { booleanValue: true }; f.doneAt = { stringValue: t };
    const res = await patchField('state', ['todos'], { arrayValue: { values: raw } }, sd.updateTime);
    const left = S.todos.filter(x => !x.done && x.id !== tid && (!x.due || x.due <= t)).length;
    return { ok: true, title: q(title) + ' erledigt ✓', msg: left ? 'Noch ' + left + ' offen.' : 'Keine offenen Aufgaben mehr.', undo: { doc: 'state', segs: ['todos'], val: before, pre: res.updateTime } };
  });
}
async function undo(u) { if (u.ops) await patchFields(u.doc, u.ops, u.pre); else await patchField(u.doc, u.segs, u.val, u.pre); }
/* ---------- Gebet: Zeiten, Wertung, Abhaken mit Uhrzeit, Adhan-Mitteilungen ---------- */
const PDEF = { on: false, habit: '', city: null, travel: null, buf: 30, notify: true, since: '' };
const PS = () => Object.assign({}, PDEF, (S.settings && S.settings.prayer) || {});
const PN = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const labelsOf = v => Array.isArray(v) ? v : [];
function prayerHabit() {
  const P = PS(), L = S.habits.filter(x => !x.archived && x.freq === 'daily' && x.labels.length === 5);
  return L.find(x => x.id === P.habit) || (!P.habit ? L.find(x => /bet|gebet|namaz|salah|salat/i.test(x.name)) : null) || null;
}
const pLabel = i => { const x = prayerHabit(); return (x && x.labels[i]) || PN[i]; };
const hmM = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
const durM = m => { m = Math.max(0, Math.round(m)); return m < 60 ? m + ' Min.' : Math.floor(m / 60) + ':' + pad(m % 60) + ' h'; };
const nowMin = d => Math.floor((Date.now() - pdate(d).getTime()) / 60000);
const TIMES = {};
async function loadCityTimes(id) {
  id = +id; if (!id || TIMES[id]) return;
  const fm = FileManager.local(), p = fm.joinPath(fm.documentsDirectory(), 'sabrly-pt-' + id + '.json');
  let c = null; try { if (fm.fileExists(p)) c = JSON.parse(fm.readString(p)); } catch (e) {}
  if (!c || !c.days || !c.days[addDays(today(), 2)] || Date.now() - (c.at || 0) > 12 * 3600e3) {
    try {
      const r = new Request(CFG.appUrl + 'gebetszeiten/z/' + id + '.json'); r.timeoutInterval = 10;
      const j = await r.loadJSON(); if (j && j.days) { c = { at: Date.now(), days: j.days }; fm.writeString(p, JSON.stringify(c)); }
    } catch (e) {}
  }
  if (c && c.days) TIMES[id] = c.days;
}
async function ensureTimes() { const P = PS(); if (!P.on) return; if (P.city) await loadCityTimes(P.city.id); if (P.travel) await loadCityTimes(P.travel.id); }
function cityFor(d) { const P = PS(), t = P.travel; return t && t.from <= d && d <= t.until ? t : P.city; }
function timesFor(d) { const c = cityFor(d); if (!c) return null; const z = TIMES[+c.id]; if (!z || !z[d]) return null; const b = z[addDays(d, 1)] || z[d]; return { s: z[d] + '|' + b.slice(0, 4), c: +c.id }; }
function pzParse(s) {
  if (!s || !/^\d{24}\|\d{4}$/.test(s)) return null; const m = i => +s.slice(i * 4, i * 4 + 2) * 60 + +s.slice(i * 4 + 2, i * 4 + 4);
  return { F: m(0), S: m(1), D: m(2), A: m(3), M: m(4), I: m(5), F2: 1440 + +s.slice(25, 27) * 60 + +s.slice(27, 29) };
}
function pzFor(d) { const e = dayGet(d); if (e && e.pz) return pzParse(e.pz); const t = timesFor(d); return t ? pzParse(t.s) : null; }
const pWin = (z, i, buf) => [[z.F, z.S], [z.D, z.A], [z.A, z.M - buf], [z.M, z.I], [z.I, z.F2]][i];
const lin = (x, x0, x1, y0, y1) => x1 <= x0 ? y1 : y0 + (y1 - y0) * Math.min(1, Math.max(0, (x - x0) / (x1 - x0)));
// gleiche Wertung wie in der App: Fajr steigt zum besten Fenster, sonst 100 → 20, nachgeholt 10
function pScore(z, i, m, buf) {
  if (i === 0) { if (m < z.F) return null; if (m >= z.S) return 10; const B1 = z.S - 40, B2 = z.S - 10;
    if (m < B1) return Math.round(lin(m, z.F, B1, 50, 100)); if (m < B2) return 100; return Math.round(lin(m, B2, z.S, 100, 20)); }
  if (i === 4) { if (m < z.I) return null; const N = z.M + (z.F2 - z.M) / 2, L = z.M + 2 * (z.F2 - z.M) / 3;
    if (m < N) return Math.round(lin(m, z.I, N, 100, 20)); if (m < L) return 20; return 10; }
  const [s, e] = pWin(z, i, buf); if (m < s) return null; if (m >= e) return 10; return Math.round(lin(m, s, e, 100, 20));
}
function prayerDay(d) {
  const P = PS(); if (!P.on || !P.since || d < P.since) return null; const x = prayerHabit(); if (!x || x.created > d || !scheduled(x, d)) return null;
  const z = pzFor(d); if (!z) return null; const e = dayGet(d) || {}, on = labelsOf(hraw(x, d)), pt = e.pt || {}, pm = e.pm || {}, nm = nowMin(d);
  const items = [0, 1, 2, 3, 4].map(i => {
    const [s, end] = pWin(z, i, P.buf), tk = on.includes(i); let sc = null, st;
    if (tk) { const m = pt[i]; sc = pm[i] ? 100 : m == null ? 10 : (pScore(z, i, m, P.buf) ?? 10); st = 'done'; } else if (nm < s) st = 'wait'; else if (nm < end) st = 'now'; else { sc = 0; st = 'miss'; }
    return { i, s, end, sc, st, tk };
  });
  const sc = items.filter(it => it.sc != null); return { x, z, items, avg: sc.length ? sc.reduce((a, b) => a + b.sc, 0) / sc.length / 100 : null };
}
// welches Gebet ein Tipp abhakt: Isha von gestern nach Mitternacht, sonst das laufende, sonst das älteste verpasste
function prayerTarget() {
  const t = today(), y = addDays(t, -1), py = prayerDay(y), pt = prayerDay(t);
  if (py && py.items[4].st === 'now') return { d: y, i: 4, yest: true };
  if (!pt) return null;
  const cur = pt.items.find(x => x.st === 'now') || pt.items.find(x => x.st === 'miss');
  if (cur) return { d: t, i: cur.i };
  const w = pt.items.find(x => x.st === 'wait'); if (w) return { lock: true, i: w.i, s: w.s };
  return { done: true };
}
function prayerStatus(d) {
  const pd = prayerDay(d); if (!pd) return ''; const nm = nowMin(d), z = pd.z, cur = pd.items.find(it => it.st === 'now');
  if (cur) { const i = cur.i, L = pLabel(i);
    if (i === 0) { const B1 = z.S - 40, B2 = z.S - 10; if (nm < B1) return L + ' · beste Zeit ab ' + hmM(B1); if (nm < B2) return L + ' · beste Zeit, noch ' + durM(B2 - nm); return L + ' · noch ' + durM(z.S - nm); }
    if (i === 4) { const N = z.M + (z.F2 - z.M) / 2, T = z.M + 2 * (z.F2 - z.M) / 3; if (nm < N) return L + ' · bis Mitternacht ' + hmM(N); if (nm < T) return L + ' · noch bis ' + hmM(T); return L + ' · letztes Drittel der Nacht'; }
    return L + ' · noch ' + durM(cur.end - nm); }
  const nx = pd.items.find(it => it.st === 'wait'); if (nx) return pLabel(nx.i) + ' ab ' + hmM(nx.s);
  return pd.items.every(it => it.tk) ? 'Alle Gebete verrichtet' : '';
}
// abhaken mit Uhrzeit (explicit = { d, i } aus einer Mitteilung); null = Gebetszeiten nicht nutzbar
async function actPrayer(h, explicit) {
  await ensureTimes();
  return retry(async () => {
    const t = today(), y = addDays(t, -1), docs = {};
    LOGS = {};
    for (const k of [...new Set([mkey(y), mkey(t)].concat(explicit ? [mkey(explicit.d)] : []))]) { docs[k] = await getDoc(k); if (docs[k]) LOGS[k] = asObj(docs[k]); }
    let d, i;
    if (explicit) { d = explicit.d; i = explicit.i; }
    else {
      const tg = prayerTarget(); if (!tg) return null;
      if (tg.lock) return { title: q(h.name), msg: pLabel(tg.i) + ' beginnt um ' + hmM(tg.s) + '.' };
      if (tg.done) return { title: q(h.name) + ' ✓', msg: 'Alle Gebete für heute verrichtet.' };
      d = tg.d; i = tg.i;
    }
    const pd = prayerDay(d); if (!pd || !(i >= 0 && i <= 4)) return null;
    const it = pd.items[i];
    if (it.tk) return { title: pLabel(i) + ' ✓', msg: 'Ist schon abgehakt.' };
    if (it.st === 'wait') return { title: q(h.name), msg: pLabel(i) + ' beginnt um ' + hmM(it.s) + '.' };
    const mk = mkey(d), md = docs[mk] || null, m = nowMin(d);
    const hs = ['days', d, 'h', h.id], ps = ['days', d, 'pt', String(i)];
    const nv = labelsOf(hraw(h, d)).concat([i]).sort((a, b) => a - b);
    const ops = [[hs, tval(nv)], [ps, tval(m)]];
    const e = dayGet(d) || {}; if (!e.pz) { const tz = timesFor(d); if (tz) ops.push([['days', d, 'pz'], tval(tz.s)], [['days', d, 'pc'], tval(tz.c)]); }
    const res = await patchFields(mk, ops, md ? md.updateTime : null);
    const sc = pScore(pd.z, i, m, PS().buf) ?? 10;
    return { ok: true, title: q(h.name) + ': ' + pLabel(i) + (d !== t ? ' (gestern)' : '') + ' ✓', msg: 'Wertung ' + sc + ' %',
      undo: { doc: mk, ops: [[hs, md ? rawAt(md.fields, hs) : undefined], [ps, md ? rawAt(md.fields, ps) : undefined]], pre: res.updateTime } };
  });
}
function notifBody(z, i, buf) {
  if (i === 0) return 'Am besten ' + hmM(z.S - 40) + '–' + hmM(z.S - 10) + ' · Sonnenaufgang ' + hmM(z.S);
  if (i === 4) return 'Am besten bis Mitternacht (' + hmM(z.M + (z.F2 - z.M) / 2) + ')';
  return 'Zeit bis ' + hmM(pWin(z, i, buf)[1]);
}
// Adhan-Mitteilungen für die nächsten 36 Stunden planen (nur Änderungen, gleiche Kennung ersetzt die alte)
async function syncPrayerNotifs() {
  try {
    const P = PS(), want = [];
    if (P.on && P.notify && prayerHabit()) {
      await ensureTimes();
      const t = today();
      for (const d of [t, addDays(t, 1)]) {
        const pd = prayerDay(d); if (!pd) continue;
        for (const it of pd.items) {
          if (it.tk) continue;
          const at = pdate(d).getTime() + it.s * 60000;
          if (at <= Date.now() + 30000 || at > Date.now() + 36 * 3600e3) continue;
          want.push({ id: 'sabrly-p-' + d + '-' + it.i, at, d, i: it.i, title: '🕌 ' + pLabel(it.i) + ' · ' + hmM(it.s), body: notifBody(pd.z, it.i, P.buf) });
        }
      }
    }
    const fm = FileManager.local(), p = fm.joinPath(fm.documentsDirectory(), 'sabrly-notif.json');
    let prev = []; try { if (fm.fileExists(p)) prev = JSON.parse(fm.readString(p)) || []; } catch (e) {}
    const sig = o => o.id + '|' + o.at + '|' + o.title + '|' + o.body, had = new Set(prev.map(sig));
    const stale = prev.filter(o => !want.some(w => w.id === o.id)).map(o => o.id);
    if (stale.length) Notification.removePending(stale);
    for (const o of want) {
      if (had.has(sig(o))) continue;
      const n = new Notification(); n.identifier = o.id; n.title = o.title; n.body = o.body; n.threadIdentifier = 'sabrly-gebet';
      n.sound = 'default'; n.userInfo = { sabrly: 'p', d: o.d, i: o.i };
      n.setTriggerDate(new Date(o.at)); n.addAction('Gebetet ✓', run({ a: 'ptick', d: o.d, i: o.i }));
      await n.schedule();
    }
    fm.writeString(p, JSON.stringify(want));
  } catch (e) {}
}
// Wochenrückblick (kurz) – gleiche Rechnung wie in der App
function weekReview(ws) {
  const t = today(), days = []; for (let i = 0; i < 7; i++) { const d = addDays(ws, i); if (d <= t) days.push(d); }
  const pct = w => { const L = []; for (let i = 0; i < 7; i++) { const d = addDays(w, i); if (d > t) break; if (active(d).length) L.push(dayScore(d)); } return L.length ? Math.round(L.reduce((a, b) => a + b, 0) / L.length * 100) : null; };
  const last = days[days.length - 1] || ws;
  const per = S.habits.filter(x => !x.archived && x.created <= last).map(x => {
    if (x.freq === 'weekly') { const c = weekCount(x, ws, last); return { x, v: c, T: x.target, p: c / x.target }; }
    let v = 0, T = 0; for (const d of days) if (x.created <= d && scheduled(x, d)) { T++; v += frac(x, d); } return { x, v, T, p: T ? v / T : 1 };
  }).filter(o => o.T > 0);
  let tr = 0, runs = 0, km = 0; const ms = [];
  for (const d of days) { const e = dayGet(d) || {}; if (Array.isArray(e.tr)) tr += e.tr.length; if (Array.isArray(e.run)) { runs += e.run.length; e.run.forEach(r => { km += +r.km || 0; }); } if (e.mood) ms.push(e.mood); }
  return { hp: pct(ws), hpPrev: pct(addDays(ws, -7)), weak: per.filter(o => o.p < 0.6).sort((a, b) => a.p - b.p).slice(0, 2), good: per.filter(o => o.p >= 1).length, n: per.length,
    tr, runs, km: Math.round(km * 10) / 10, mood: ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : 0 };
}
function weekText(R) {
  const a = [];
  if (R.hp != null) a.push('Habits ' + R.hp + ' %' + (R.hpPrev != null ? ' (Vorwoche ' + R.hpPrev + ' %)' : ''));
  if (S.training) a.push('Training ' + R.tr + (R.runs ? ' · Läufe ' + R.runs + ' · ' + String(R.km).replace('.', ',') + ' km' : ''));
  if (R.mood) a.push('Stimmung ' + MOODS[R.mood - 1]);
  let t = a.join(' · ');
  if (R.weak.length) t += '\nAusbaufähig: ' + R.weak.map(o => o.x.name).join(', ');
  else if (R.n && R.good === R.n) t += '\nAlle Habits geschafft 💪';
  return t + '\nÖffne Sabrly und plane die nächste Woche.';
}
// Sonntag 18 Uhr: „Woche planen“ mit kurzem Rückblick. Wird bei jeder Aktualisierung neu berechnet, entfällt wenn schon geplant.
async function syncWeekNotif() {
  try {
    const fm = FileManager.local(), p = fm.joinPath(fm.documentsDirectory(), 'sabrly-week.json');
    let prev = null; try { if (fm.fileExists(p)) prev = JSON.parse(fm.readString(p)); } catch (e) {}
    const t = today(), ws = weekStart(t), at = pdate(addDays(ws, 6)).getTime() + 18 * 3600e3, nws = addDays(ws, 7), T = S.training;
    const planned = !!(T && T.weeks && T.weeks[nws] && Object.values(T.weeks[nws].d || {}).some(a => Array.isArray(a) && a.length));
    let want = null;
    if (S.settings.weekNotify && at > Date.now() + 30000 && !planned && (S.habits.length || T)) want = { id: 'sabrly-week-' + ws, at, ws, title: '📅 Woche planen', body: weekText(weekReview(ws)) };
    if (prev && prev.id && (!want || prev.id !== want.id)) Notification.removePending([prev.id]);
    if (want && (!prev || prev.id !== want.id || prev.body !== want.body || prev.at !== want.at)) {
      const n = new Notification(); n.identifier = want.id; n.title = want.title; n.body = want.body; n.threadIdentifier = 'sabrly-woche';
      n.sound = 'default'; n.userInfo = { sabrly: 'w', ws }; n.setTriggerDate(new Date(want.at)); await n.schedule();
    }
    if (want || prev) fm.writeString(p, JSON.stringify(want));
  } catch (e) {}
}
// nächste Gebetszeit heute (damit das Widget pünktlich aktualisiert)
function nextPrayerAt() { const t = today(), pd = prayerDay(t); if (!pd) return null; const w = pd.items.find(x => x.st === 'wait'); return w ? pdate(t).getTime() + w.s * 60000 : null; }


/* ---------- Zeichnen ---------- */
const hhmm = ms => { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
// Tipp → Scriptable führt dieses Skript mit Parametern aus und trägt direkt ein
// (eine Web-App vom Home-Bildschirm lässt sich aus Scriptable nicht öffnen, nur Safari)
const SCRIPT_NAME = (() => { try { return Script.name() || 'Sabrly'; } catch (e) { return 'Sabrly'; } })();
const run = p => 'scriptable:///run/' + encodeURIComponent(SCRIPT_NAME) + (p ? '?' + Object.keys(p).map(k => k + '=' + encodeURIComponent(p[k])).join('&') : '');
function mix(a, b, t) { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const A = p(a), B = p(b); return new Color('#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')); }
function arc(ctx, cx, cy, r, p, color, lw) {
  if (p <= 0) return;
  const q = Math.min(p, 0.9999), path = new Path(), n = Math.max(2, Math.ceil(140 * q));
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + 2 * Math.PI * q * i / n, pt = new Point(cx + r * Math.cos(a), cy + r * Math.sin(a)); if (i === 0) path.move(pt); else path.addLine(pt); }
  ctx.addPath(path); ctx.setStrokeColor(color); ctx.setLineWidth(lw); ctx.strokePath();
  ctx.setFillColor(color);
  for (const a of [-Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * q]) ctx.fillEllipse(new Rect(cx + r * Math.cos(a) - lw / 2, cy + r * Math.sin(a) - lw / 2, lw, lw));
}
function canvas(w, h) { const c = new DrawContext(); c.size = new Size(w, h); c.opaque = false; c.respectScreenScale = true; return c; }
function ringImage(p, size, lw, fontSize) {
  const ctx = canvas(size, size), r = size / 2 - lw / 2 - 1, cx = size / 2;
  ctx.setStrokeColor(COL.track); ctx.setLineWidth(lw); ctx.strokeEllipse(new Rect(cx - r, cx - r, 2 * r, 2 * r));
  arc(ctx, cx, cx, r, p, COL.accent, lw);
  if (fontSize) {
    ctx.setFont(Font.boldRoundedSystemFont(fontSize)); ctx.setTextColor(COL.fg); ctx.setTextAlignedCenter();
    const th = fontSize * 1.3; ctx.drawTextInRect(Math.round(p * 100) + '%', new Rect(0, cx - th / 2, size, th));
  }
  return ctx.getImage();
}
function checkPath(ctx, s, color, lw) {
  const p = new Path(); p.move(new Point(s * 0.29, s * 0.52)); p.addLine(new Point(s * 0.44, s * 0.66)); p.addLine(new Point(s * 0.72, s * 0.36));
  ctx.addPath(p); ctx.setStrokeColor(color); ctx.setLineWidth(lw); ctx.strokePath();
}
const IMG = {};
// kleine Kreise im Wochenraster und in der Aufgabenliste
function dotImage(kind, p) {
  const key = kind + (p || ''); if (IMG[key]) return IMG[key];
  const s = 48, ctx = canvas(s, s), lw = 3.4, r = s / 2 - lw / 2 - 1, c = s / 2;
  const ring = (color, w) => { ctx.setStrokeColor(color); ctx.setLineWidth(w); ctx.strokeEllipse(new Rect(c - r, c - r, 2 * r, 2 * r)); };
  if (kind === 'done') { ctx.setFillColor(COL.fg); ctx.fillEllipse(new Rect(1, 1, s - 2, s - 2)); checkPath(ctx, s, COL.ink, 5.5); }
  else if (kind === 'today') ring(COL.fg, lw);
  else if (kind === 'part') { ring(new Color('#FFFFFF', 0.22), lw); arc(ctx, c, c, r, p, COL.fg, lw); }
  else if (kind === 'off') { ctx.setFillColor(new Color('#FFFFFF', 0.2)); ctx.fillEllipse(new Rect(c - 4, c - 4, 8, 8)); }
  else if (kind === 'miss') ring(new Color('#FFFFFF', 0.22), lw * 0.8);
  else ring(new Color('#FFFFFF', 0.12), lw * 0.8);
  return (IMG[key] = ctx.getImage());
}
// großer Kreis im Habit-Widget
function bigCircle(state, p, label) {
  const s = 180, ctx = canvas(s, s), r = s / 2 - 8, c = s / 2;
  ctx.setFillColor(new Color('#1D2C5C', 0.6)); ctx.fillEllipse(new Rect(c - r, c - r, 2 * r, 2 * r));
  ctx.setStrokeColor(new Color('#8FB0FF', state === 'done' ? 0.9 : 0.55)); ctx.setLineWidth(4); ctx.strokeEllipse(new Rect(c - r, c - r, 2 * r, 2 * r));
  if (state === 'done') checkPath(ctx, s, COL.fg, 13);
  else {
    if (p > 0) arc(ctx, c, c, r - 14, p, COL.fg, 9);
    if (label) { ctx.setFont(Font.boldRoundedSystemFont(38)); ctx.setTextColor(COL.fg); ctx.setTextAlignedCenter(); ctx.drawTextInRect(label, new Rect(0, c - 25, s, 50)); }
  }
  return ctx.getImage();
}
// dunkler Verlauf, optional mit farbigem Leuchten von unten
function glowBackground(fam, hex) {
  const W = fam === 'small' ? 340 : 720, H = fam === 'large' || fam === 'extraLarge' ? 760 : 340;
  const ctx = new DrawContext(); ctx.size = new Size(W, H); ctx.opaque = true; ctx.respectScreenScale = false;
  const n = 40; for (let i = 0; i < n; i++) { ctx.setFillColor(mix('#26282C', '#050607', i / (n - 1))); ctx.fillRect(new Rect(0, Math.floor(i * H / n), W, Math.ceil(H / n) + 1)); }
  if (hex) for (let i = 0; i < 40; i++) { const k = 1 - i / 40, rw = W * 1.0 * k, rh = H * 0.8 * k; ctx.setFillColor(new Color(hex, 0.032)); ctx.fillEllipse(new Rect(W / 2 - rw / 2, H - rh * 0.42, rw, rh)); }
  return ctx.getImage();
}
function base(w, fam, glow) { w.backgroundImage = glowBackground(fam, glow); w.url = run({ a: 'heute' }); }
function txt(stack, s, font, color, lines) { const t = stack.addText(s); t.font = font; t.textColor = color || COL.fg; t.lineLimit = lines || 1; t.minimumScaleFactor = 0.75; return t; }
function centered(stack, img, size) { const row = stack.addStack(); row.layoutHorizontally(); row.addSpacer(); const i = row.addImage(img); i.imageSize = new Size(size, size); row.addSpacer(); return row; }
function centerStack(stack) { const row = stack.addStack(); row.layoutHorizontally(); row.addSpacer(); const inner = row.addStack(); row.addSpacer(); return inner; }
function pill(stack, label, font) { const p = stack.addStack(); p.setPadding(5, 13, 5, 13); p.cornerRadius = 14; p.backgroundColor = new Color('#FFFFFF', 0.08); p.borderWidth = 1; p.borderColor = new Color('#FFFFFF', 0.16); txt(p, label, font || Font.mediumSystemFont(12), COL.fg); return p; }
function footer(stack, data, stale) { txt(stack, (stale ? 'Offline · ' : '') + 'Stand ' + hhmm(data.at), Font.mediumSystemFont(10), COL.faint); }
function dateLine(t) { const d = pdate(t); return DL[wd(t)] + ', ' + d.getDate() + '. ' + MN[d.getMonth()]; }
function weekTitle(ws, we) { const a = pdate(ws), b = pdate(we); return a.getMonth() === b.getMonth() ? MS[a.getMonth()] + ' ' + a.getDate() + '–' + b.getDate() : MS[a.getMonth()] + ' ' + a.getDate() + ' – ' + MS[b.getMonth()] + ' ' + b.getDate(); }

/* ---------- Übersicht klein (Ring) ---------- */
function small(m, data, stale) {
  const w = new ListWidget(); base(w, 'small'); w.setPadding(14, 14, 12, 14);
  const top = w.addStack(); top.layoutHorizontally(); top.centerAlignContent();
  txt(top, 'SABRLY', Font.heavySystemFont(10), COL.accent); top.addSpacer();
  if (m.best > 0) txt(top, '🔥 ' + m.best, Font.boldRoundedSystemFont(12), COL.fg);
  w.addSpacer();
  centered(w, ringImage(m.score, 180, 16, 34), 82);
  w.addSpacer();
  txt(w, m.total ? m.done + ' von ' + m.total + ' Habits' : 'Keine Habits heute', Font.semiboldSystemFont(13), COL.fg);
  footer(w, data, stale);
  return w;
}
// nur anzeigen, wenn die Daten nicht frisch sind
function staleNote(stack, data, stale) { if (stale) { stack.addSpacer(4); txt(stack, 'Offline · Stand ' + hhmm(data.at), Font.mediumSystemFont(10), COL.faint); } }
const isBig = fam => fam === 'large' || fam === 'extraLarge';
const serif = s => { try { return new Font('Georgia', s); } catch (e) { return Font.italicSystemFont(s); } };

/* ---------- Heute: alle Habits auf einen Blick ---------- */
function todayRows() {
  const t = today();
  return S.habits.filter(h => !h.archived && h.created <= t && scheduled(h, t)).map(h => {
    const wk = h.freq === 'weekly', td = isDone(h, t), T = wk ? h.target : tgt(h), v = wk ? weekCount(h, weekStart(t), t) : hv(h, t);
    return { h, td, T, v, done: td || (wk && v >= T), p: wk ? (td ? 1 : 0) : frac(h, t) };
  });
}
function listRow(stack, r, fs, ds, counts) {
  const row = stack.addStack(); row.layoutHorizontally(); row.centerAlignContent();
  if (!r.done) row.url = run({ a: 'tick', h: r.h.id });
  txt(row, r.h.emoji, Font.systemFont(fs), COL.fg); row.addSpacer(fs > 13 ? 9 : 6);
  txt(row, r.h.name, Font.semiboldSystemFont(fs), r.done ? COL.muted : COL.fg);
  row.addSpacer();
  if (counts && r.T > 1 && !r.done) { txt(row, r.v + '/' + r.T, Font.mediumRoundedSystemFont(fs - 2), COL.muted); row.addSpacer(7); }
  const im = row.addImage(dotImage(r.done ? 'done' : r.p > 0 ? 'part' : 'today', r.done ? 0 : r.p)); im.imageSize = new Size(ds, ds);
  return row;
}
function listWidget(fam, data, stale) {
  const rows = todayRows(), n = rows.filter(r => r.done).length, big = isBig(fam), sm = fam === 'small';
  const w = new ListWidget(); base(w, fam);
  if (big) w.setPadding(18, 18, 16, 18); else if (sm) w.setPadding(14, 13, 12, 13); else w.setPadding(14, 16, 12, 16);
  const head = w.addStack(); head.layoutHorizontally(); head.centerAlignContent();
  txt(head, 'Heute', Font.boldSystemFont(big ? 22 : sm ? 15 : 17), COL.fg); head.addSpacer();
  if (rows.length) txt(head, n + '/' + rows.length, Font.semiboldRoundedSystemFont(big ? 16 : 13), n === rows.length ? COL.accent : COL.muted);
  w.addSpacer(big ? 14 : sm ? 8 : 10);
  if (!rows.length) { txt(w, 'Heute keine Habits geplant', Font.mediumSystemFont(13), COL.muted, 2); w.addSpacer(); staleNote(w, data, stale); return w; }
  if (fam === 'medium') {
    const max = 6, list = rows.length > max ? rows.slice(0, max - 1) : rows;
    const cols = w.addStack(); cols.layoutHorizontally(); cols.topAlignContent();
    [list.slice(0, 3), list.slice(3, 6)].forEach((part, ci) => {
      if (ci) cols.addSpacer(16);
      const col = cols.addStack(); col.layoutVertically(); col.size = new Size(137, 0);
      part.forEach((r, i) => { if (i) col.addSpacer(8); listRow(col, r, 13, 18, false); });
      if (ci === 1 && rows.length > max) { if (part.length) col.addSpacer(8); txt(col, '+' + (rows.length - list.length) + ' weitere', Font.mediumSystemFont(12), COL.muted); }
    });
  } else {
    const max = big ? 9 : 4, list = rows.length > max ? rows.slice(0, max - 1) : rows;
    // groß: bei wenigen Habits mehr Luft zwischen den Zeilen
    const gap = big ? Math.round(Math.min(20, Math.max(9, (250 - list.length * 22) / Math.max(1, list.length - 1)))) : 6;
    list.forEach((r, i) => { if (i) w.addSpacer(gap); listRow(w, r, big ? 15 : 12, big ? 22 : 15, big); });
    if (rows.length > max) { w.addSpacer(big ? 9 : 6); txt(w, '+' + (rows.length - list.length) + ' weitere', Font.mediumSystemFont(big ? 13 : 11), COL.muted); }
  }
  w.addSpacer();
  staleNote(w, data, stale);
  return w;
}

/* ---------- Vers / Satz des Tages ---------- */
function quoteWidget(fam, data, stale) {
  const t = today(), qq = pickQuote(t), big = isBig(fam), sm = fam === 'small';
  const vers = !!qq && qq.type === 'vers', tint = new Color(vers ? '#E3BE76' : '#46E0AE');
  const w = new ListWidget(); base(w, fam, qq ? (vers ? '#A87C2E' : '#1C8F69') : null);
  w.setPadding(big ? 22 : 15, big ? 22 : sm ? 14 : 18, big ? 20 : 14, big ? 22 : sm ? 14 : 18);
  txt(w, vers ? 'VERS DES TAGES' : 'SATZ DES TAGES', Font.heavySystemFont(sm ? 9 : 10), tint);
  w.addSpacer();
  if (!qq) {
    txt(w, 'Noch keine Sätze', Font.boldSystemFont(14), COL.fg); w.addSpacer(4);
    txt(w, 'Füge in Sabrly unter Mehr → Sätze & Verse welche hinzu.', Font.mediumSystemFont(11), COL.muted, 4);
    w.addSpacer(); return w;
  }
  const L = qq.t.length;
  const fs = big ? (L < 90 ? 27 : L < 170 ? 22 : L < 260 ? 18 : 15) : sm ? (L < 50 ? 16 : L < 90 ? 14 : 12) : (L < 70 ? 20 : L < 130 ? 16 : L < 200 ? 14 : 12);
  const tx = txt(w, qq.t, serif(fs), COL.fg, big ? 14 : sm ? 8 : 6); tx.minimumScaleFactor = 0.6;
  if (qq.src) { w.addSpacer(big ? 12 : 7); txt(w, '— ' + qq.src, Font.semiboldSystemFont(big ? 14 : sm ? 11 : 12), tint); }
  w.addSpacer();
  staleNote(w, data, stale);
  return w;
}

/* ---------- Monat ---------- */
function monthStats() {
  const t = today(), first = t.slice(0, 8) + '01', dim = new Date(+t.slice(0, 4), +t.slice(5, 7), 0).getDate();
  let sum = 0, cnt = 0, perfect = 0;
  for (let i = 0; i < dim; i++) { const d = addDays(first, i); if (d > t || !active(d).length) continue; const p = dayScore(d); sum += p; cnt++; if (p >= 0.999) perfect++; }
  return { t, first, dim, off: wd(first), avg: cnt ? sum / cnt : 0, perfect, month: MN[pdate(t).getMonth()] };
}
function monthImage(ms, cell, gap, labels, numbers) {
  const rows = Math.ceil((ms.off + ms.dim) / 7), lab = labels ? 18 : 0;
  const W = 7 * cell + 6 * gap, H = lab + rows * cell + (rows - 1) * gap, ctx = canvas(W, H), rad = Math.max(3, Math.round(cell * 0.3));
  if (labels) { ctx.setFont(Font.semiboldSystemFont(10)); ctx.setTextAlignedCenter(); ctx.setTextColor(COL.muted); ['M', 'D', 'M', 'D', 'F', 'S', 'S'].forEach((l, i) => ctx.drawTextInRect(l, new Rect(i * (cell + gap), 0, cell, 14))); }
  const fsz = Math.round(cell * 0.36);
  for (let i = 0; i < ms.dim; i++) {
    const d = addDays(ms.first, i), k = ms.off + i, x = (k % 7) * (cell + gap), y = lab + Math.floor(k / 7) * (cell + gap);
    const fut = d > ms.t, has = !fut && active(d).length > 0, p = has ? dayScore(d) : 0, full = p >= 0.999;
    const box = () => { const pa = new Path(); pa.addRoundedRect(new Rect(x + 0.75, y + 0.75, cell - 1.5, cell - 1.5), rad, rad); ctx.addPath(pa); };
    if (fut) { box(); ctx.setStrokeColor(new Color('#FFFFFF', 0.13)); ctx.setLineWidth(1); ctx.strokePath(); }
    else {
      box(); ctx.setFillColor(new Color('#FFFFFF', has ? 0.08 : 0.04)); ctx.fillPath();
      if (p > 0) { box(); ctx.setFillColor(new Color('#46E0AE', full ? 1 : 0.2 + 0.55 * p)); ctx.fillPath(); }
    }
    if (d === ms.t) { box(); ctx.setStrokeColor(COL.fg); ctx.setLineWidth(1.5); ctx.strokePath(); }
    if (numbers) {
      ctx.setFont(Font.semiboldSystemFont(fsz)); ctx.setTextAlignedCenter();
      ctx.setTextColor(full ? COL.ink : fut ? COL.faint : COL.fg);
      ctx.drawTextInRect(String(i + 1), new Rect(x, y + (cell - fsz * 1.25) / 2, cell, fsz * 1.3));
    }
  }
  return { img: ctx.getImage(), W, H };
}
function monthWidget(fam, data, stale) {
  const ms = monthStats(), big = isBig(fam), sm = fam === 'small', m = model();
  const w = new ListWidget(); base(w, fam);
  const pct = Math.round(ms.avg * 100) + '%';
  if (fam === 'medium') {
    w.setPadding(14, 16, 14, 16);
    const row = w.addStack(); row.layoutHorizontally();
    const left = row.addStack(); left.layoutVertically();
    txt(left, ms.month, Font.boldSystemFont(15), COL.fg); left.addSpacer(8);
    const g = monthImage(ms, 13, 4, false, false), im = left.addImage(g.img); im.imageSize = new Size(g.W, g.H);
    row.addSpacer();
    const right = row.addStack(); right.layoutVertically();
    txt(right, pct, Font.boldRoundedSystemFont(34), COL.fg);
    txt(right, 'Ø diesen Monat', Font.mediumSystemFont(11), COL.muted);
    right.addSpacer();
    if (m.best > 0) txt(right, '🔥 ' + m.best + ' Tage Serie', Font.semiboldSystemFont(12), COL.fg);
    txt(right, ms.perfect + (ms.perfect === 1 ? ' perfekter Tag' : ' perfekte Tage'), Font.mediumSystemFont(12), COL.muted);
    staleNote(right, data, stale);
    return w;
  }
  w.setPadding(big ? 18 : 14, big ? 18 : 14, big ? 16 : 12, big ? 18 : 14);
  const head = w.addStack(); head.layoutHorizontally(); head.centerAlignContent();
  txt(head, ms.month, Font.boldSystemFont(big ? 22 : 14), COL.fg); head.addSpacer();
  txt(head, 'Ø ' + pct, Font.semiboldRoundedSystemFont(big ? 16 : 12), COL.muted);
  w.addSpacer(big ? 12 : 8);
  const g = big ? monthImage(ms, 34, 6, true, true) : monthImage(ms, 14, 4, false, false);
  { const r = w.addStack(); r.layoutHorizontally(); r.addSpacer(); const im = r.addImage(g.img); im.imageSize = new Size(g.W, g.H); r.addSpacer(); }
  w.addSpacer();
  if (big) { txt(w, (m.best > 0 ? '🔥 ' + m.best + ' Tage Serie · ' : '') + ms.perfect + (ms.perfect === 1 ? ' perfekter Tag' : ' perfekte Tage'), Font.mediumSystemFont(12), COL.muted); }
  staleNote(w, data, stale);
  return w;
}

/* ---------- Serie ---------- */
function streakWidget(fam, data, stale, q) {
  const all = S.habits.filter(h => !h.archived && h.created <= today()).map(h => ({ h, n: streak(h), unit: h.freq === 'weekly' ? 'Wochen' : 'Tage' }))
    .sort((a, b) => b.n - a.n);
  const pick = q ? (all.find(x => x.h === findHabit(q)) || null) : all[0] || null;
  const w = new ListWidget(); base(w, fam, '#E8661C'); const big = isBig(fam);
  if (!pick) { w.setPadding(14, 14, 14, 14); txt(w, 'Kein Habit gefunden', Font.boldSystemFont(14), COL.fg, 2); return w; }
  if (fam === 'small') {
    w.setPadding(14, 14, 14, 14);
    const top = centerStack(w); txt(top, '🔥', Font.systemFont(22), COL.fg);
    w.addSpacer(2);
    const mid = centerStack(w); txt(mid, String(pick.n), Font.boldRoundedSystemFont(48), COL.fg);
    const cap = centerStack(w); txt(cap, pick.n ? pick.unit + ' Serie' : 'Heute starten', Font.mediumSystemFont(12), COL.muted);
    w.addSpacer();
    const bot = centerStack(w); txt(bot, pick.h.emoji + ' ' + pick.h.name, Font.semiboldSystemFont(12), COL.fg);
    return w;
  }
  w.setPadding(14, 16, 14, 16);
  const head = w.addStack(); head.layoutHorizontally(); head.centerAlignContent();
  txt(head, 'Serien', Font.boldSystemFont(big ? 22 : 17), COL.fg); head.addSpacer(); txt(head, '🔥', Font.systemFont(big ? 18 : 15), COL.fg);
  w.addSpacer(big ? 14 : 10);
  const list = q ? [pick].concat(all.filter(x => x !== pick)) : all;
  if (!big) {
    const row = w.addStack(); row.layoutHorizontally();
    list.slice(0, 3).forEach((x, i) => {
      if (i) row.addSpacer();
      const col = row.addStack(); col.layoutVertically();
      txt(col, String(x.n), Font.boldRoundedSystemFont(32), x.n ? COL.fg : COL.faint);
      txt(col, x.unit, Font.mediumSystemFont(11), COL.muted); col.addSpacer(6);
      txt(col, x.h.emoji + ' ' + x.h.name, Font.semiboldSystemFont(12), COL.fg);
    });
    if (list.length < 3) row.addSpacer();
  } else {
    list.slice(0, 9).forEach((x, i) => {
      if (i) w.addSpacer(10);
      const row = w.addStack(); row.layoutHorizontally(); row.centerAlignContent();
      txt(row, x.h.emoji, Font.systemFont(15), COL.fg); row.addSpacer(9);
      txt(row, x.h.name, Font.semiboldSystemFont(15), COL.fg); row.addSpacer();
      txt(row, String(x.n), Font.boldRoundedSystemFont(17), x.n ? COL.fg : COL.faint); row.addSpacer(4);
      txt(row, x.unit, Font.mediumSystemFont(12), COL.muted);
    });
  }
  w.addSpacer();
  staleNote(w, data, stale);
  return w;
}

/* ---------- Wochenraster ---------- */
function weekWidget(fam, data, stale) {
  const g = weekGrid(), big = fam === 'large' || fam === 'extraLarge', sm = fam === 'small';
  const w = new ListWidget(); base(w, fam); w.setPadding(14, 16, 12, 16);
  const cs = big ? 22 : sm ? 12 : 20, gap = big ? 7 : sm ? 3 : 7, maxRows = big ? 8 : sm ? 4 : 3;
  if (sm) w.setPadding(14, 12, 12, 12);
  const head = w.addStack(); head.layoutHorizontally(); head.centerAlignContent();
  if (!sm) txt(head, weekTitle(g.ws, g.we), Font.boldSystemFont(big ? 20 : 17), COL.fg);
  head.addSpacer();
  ['M', 'D', 'M', 'D', 'F', 'S', 'S'].forEach((l, i) => {
    if (i) head.addSpacer(gap);
    const isT = addDays(g.ws, i) === g.t;
    const box = head.addStack(); box.size = new Size(cs, cs); box.layoutHorizontally(); box.centerAlignContent();
    if (isT) { box.borderWidth = 1.5; box.borderColor = COL.fg; box.cornerRadius = sm ? 4 : 7; }
    box.addSpacer(); txt(box, l, Font.semiboldSystemFont(sm ? 9 : 11), isT ? COL.fg : COL.muted); box.addSpacer();
  });
  w.addSpacer(sm ? 6 : 10);
  const rows = g.rows.slice(0, maxRows);
  rows.forEach((r, ri) => {
    if (ri) w.addSpacer(big ? 11 : sm ? 4 : 6);
    const row = w.addStack(); row.layoutHorizontally(); row.centerAlignContent();
    if (r.open) row.url = run({ a: 'tick', h: r.id });
    txt(row, sm ? r.emoji : r.emoji + '  ' + r.name, sm ? Font.systemFont(12) : Font.semiboldSystemFont(big ? 15 : 14), COL.fg); row.addSpacer();
    r.cells.forEach((c, i) => { if (i) row.addSpacer(gap); const im = row.addImage(dotImage(c.k, c.p)); im.imageSize = new Size(cs, cs); });
  });
  if (!rows.length) txt(w, 'Noch keine Habits', Font.mediumSystemFont(13), COL.muted);
  if (g.rows.length > maxRows) { w.addSpacer(6); txt(w, '+' + (g.rows.length - maxRows) + ' weitere', Font.mediumSystemFont(11), COL.muted); }
  w.addSpacer();
  if (!sm) footer(w, data, stale);
  return w;
}

/* ---------- einzelner Habit ---------- */
function pickHabit(q) {
  const t = today(), hs = active(t), all = S.habits.filter(h => !h.archived);
  if (q) { const l = q.toLowerCase(); const f = all.find(h => h.name.toLowerCase() === l) || all.find(h => h.name.toLowerCase().includes(l)); if (f) return f; }
  return hs.find(h => !isDone(h, t)) || hs[0] || all[0] || null;
}
function habitWidget(fam, data, stale, q) {
  const h = pickHabit(q), w = new ListWidget(); base(w, fam, '#3B6DFF'); w.setPadding(14, 14, 14, 14);
  if (!h) { txt(w, 'Kein Habit gefunden', Font.boldSystemFont(14), COL.fg, 2); txt(w, 'Lege in Sabrly einen Habit an.', Font.mediumSystemFont(11), COL.muted, 3); return w; }
  const t = today(), planned = scheduled(h, t) && h.created <= t, done = planned && isDone(h, t), T = tgt(h), v = hv(h, t);
  w.url = planned && !done ? run({ a: 'tick', h: h.id }) : run({ a: 'heute' });
  const head = w.addStack(); head.layoutHorizontally(); head.centerAlignContent();
  txt(head, h.emoji, Font.systemFont(20), COL.fg); head.addSpacer(8);
  txt(head, h.name, Font.boldSystemFont(17), COL.fg); head.addSpacer();
  const st = streak(h); if (st > 0 && fam !== 'small') txt(head, '🔥 ' + st, Font.boldRoundedSystemFont(13), COL.fg);
  w.addSpacer();
  const state = done ? 'done' : 'open', label = !planned ? '–' : T > 1 ? v + '/' + T : '';
  centered(w, bigCircle(state, planned && T > 1 ? v / T : 0, done ? '' : label), fam === 'small' ? 62 : 76);
  w.addSpacer(10);
  const tg = prayerHabit() === h ? prayerTarget() : null;
  if (tg) {
    if (tg.lock || tg.done) w.url = run({ a: 'heute' });
    pill(centerStack(w), tg.done ? 'Alle verrichtet ✓' : tg.lock ? pLabel(tg.i) + ' ab ' + hmM(tg.s) : pLabel(tg.i) + (tg.yest ? ' (gestern)' : '') + ' abhaken');
    const stx = prayerStatus(t); if (stx && !tg.lock) { w.addSpacer(5); const r = centerStack(w); txt(r, stx.replace(/^[^·]+· /, ''), Font.semiboldSystemFont(10), new Color('#E3BE76')); }
    return w;
  }
  const nl = nextLabel(h, t);
  pill(centerStack(w), !planned ? 'Heute frei' : done ? 'Erledigt ✓' : nl ? nl + ' abhaken' : 'Abhaken');
  return w;
}

/* ---------- Stimmung ---------- */
function moodWidget(fam, data, stale) {
  const t = today(), e = dayGet(t) || {}, cur = +e.mood || 0, wide = fam !== 'small';
  const w = new ListWidget(); base(w, fam, '#F2A93B'); w.setPadding(14, 12, 14, 12); w.url = run({ a: 'mood' });
  const head = w.addStack(); head.layoutHorizontally(); head.centerAlignContent(); if (!wide) head.addSpacer(2);
  txt(head, '🎭', Font.systemFont(19), COL.fg); head.addSpacer(8); txt(head, 'Stimmung', Font.boldSystemFont(17), COL.fg);
  w.addSpacer();
  const row = centerStack(w); row.layoutHorizontally();
  const bs = wide ? 40 : 23;
  MOODS.forEach((m, i) => {
    if (i) row.addSpacer(wide ? 10 : 3);
    const b = row.addStack(); b.size = new Size(bs, bs); b.cornerRadius = bs / 2; b.layoutHorizontally(); b.centerAlignContent();
    b.backgroundColor = cur === i + 1 ? new Color('#FFFFFF', 0.24) : new Color('#FFFFFF', 0.07);
    if (cur === i + 1) { b.borderWidth = 1.5; b.borderColor = new Color('#FFFFFF', 0.7); }
    if (wide) b.url = run({ a: 'mood', v: i + 1 });
    b.addSpacer(); const tx = txt(b, m, Font.systemFont(wide ? 22 : 15), COL.fg); if (cur && cur !== i + 1) tx.textOpacity = 0.45; b.addSpacer();
  });
  w.addSpacer();
  pill(centerStack(w), cur ? 'Heute: ' + MOODS[cur - 1] : 'Wie fühlst du dich?', Font.mediumSystemFont(wide ? 13 : 11));
  return w;
}

/* ---------- Aufgaben ---------- */
function todoWidget(fam, data, stale) {
  const L = todoList(), big = fam === 'large' || fam === 'extraLarge', sm = fam === 'small';
  const w = new ListWidget(); base(w, fam); w.setPadding(14, 16, 12, 16); w.url = run({ a: 'aufgaben' });
  const head = w.addStack(); head.layoutHorizontally(); head.centerAlignContent();
  txt(head, 'Aufgaben', Font.boldSystemFont(sm ? 15 : 17), COL.fg); head.addSpacer();
  pill(head, L.now.length + ' offen', Font.semiboldSystemFont(11));
  w.addSpacer(sm ? 8 : 10);
  const max = big ? 8 : sm ? 3 : 3, list = L.list.slice(0, max), prc = { h: COL.amber, n: COL.blue, l: COL.green };
  list.forEach((x, i) => {
    if (i) w.addSpacer(big ? 9 : 7);
    const row = w.addStack(); row.layoutHorizontally(); row.centerAlignContent();
    if (!sm) row.url = run({ a: 'todo', t: x.id });
    const bar = row.addStack(); bar.size = new Size(3, 15); bar.cornerRadius = 1.5; bar.backgroundColor = prc[x.prio] || COL.blue;
    row.addSpacer(9);
    const tc = row.addStack(); tc.layoutVertically();
    txt(tc, x.title, Font.semiboldSystemFont(sm ? 12 : 14), COL.fg);
    if (big && (x.due || x.time)) { const over = x.due && x.due < L.t; txt(tc, (over ? 'überfällig' : x.due && x.due > L.t ? DN[wd(x.due)] + ', ' + pdate(x.due).getDate() + '.' : 'heute') + (x.time ? ' · ' + x.time : ''), Font.mediumSystemFont(11), over ? COL.crit : COL.muted); }
    row.addSpacer();
    if (!sm) { const im = row.addImage(dotImage('today')); im.imageSize = new Size(22, 22); }
  });
  if (!list.length) { const r = w.addStack(); r.layoutHorizontally(); txt(r, '✓', Font.boldSystemFont(14), COL.accent); r.addSpacer(6); txt(r, 'Alles erledigt', Font.semiboldSystemFont(14), COL.fg); }
  if (L.list.length > max) { w.addSpacer(6); txt(w, '+' + (L.list.length - max) + ' weitere', Font.mediumSystemFont(11), COL.muted); }
  w.addSpacer();
  if (!sm) footer(w, data, stale);
  return w;
}

/* ---------- Sperrbildschirm ---------- */
function accCircular(m) { const w = new ListWidget(); w.addAccessoryWidgetBackground = true; w.url = run({ a: 'heute' }); centered(w, ringImage(m.score, 120, 12, 26), 58); return w; }
function accRect(m) {
  const w = new ListWidget(); w.url = run({ a: 'heute' });
  txt(w, 'Sabrly · ' + Math.round(m.score * 100) + '%', Font.boldSystemFont(14), Color.white());
  txt(w, m.total ? m.done + ' von ' + m.total + ' Habits erledigt' : 'Heute keine Habits', Font.mediumSystemFont(12), Color.white());
  if (m.best > 0) txt(w, '🔥 ' + m.best + ' Tage Serie', Font.mediumSystemFont(12), Color.white());
  return w;
}
function accInline(m) { const w = new ListWidget(); w.url = run({ a: 'heute' }); txt(w, 'Sabrly ' + Math.round(m.score * 100) + '% · ' + (m.total - m.done) + ' offen', Font.mediumSystemFont(12), Color.white()); return w; }
function messageWidget(fam, title, msg) {
  const w = new ListWidget(); if (!String(fam).startsWith('accessory')) { base(w, fam); w.setPadding(14, 14, 14, 14); }
  w.url = run();
  txt(w, 'SABRLY', Font.heavySystemFont(10), COL.accent); w.addSpacer(6);
  txt(w, title, Font.boldSystemFont(14), COL.fg, 2); w.addSpacer(4);
  txt(w, msg, Font.mediumSystemFont(11), COL.muted, 4);
  return w;
}

/* ---------- Auswahl ---------- */
function variant(param) {
  const p = String(param || '').trim(), l = p.toLowerCase();
  if (!l || ['übersicht', 'uebersicht', 'ring'].includes(l)) return { v: 'overview' };
  if (['heute', 'liste', 'habits', 'alle'].includes(l)) return { v: 'list' };
  if (['woche', 'week', 'wochenraster'].includes(l)) return { v: 'week' };
  if (['aufgaben', 'aufgabe', 'todos', 'todo'].includes(l)) return { v: 'todos' };
  if (['stimmung', 'mood'].includes(l)) return { v: 'mood' };
  if (['vers', 'verse', 'satz', 'sätze', 'saetze', 'spruch', 'zitat'].includes(l)) return { v: 'quote' };
  if (['monat', 'kalender', 'month'].includes(l)) return { v: 'month' };
  const s = p.match(/^(serie|serien|streak)\s*:?\s*(.*)$/i);
  if (s) return { v: 'streak', q: s[2].trim() };
  const m = p.match(/^(habit|gewohnheit)\s*:?\s*(.*)$/i);
  return { v: 'habit', q: m ? m[2].trim() : p };
}
function build(fam, data, stale, param) {
  S = normalizeState(data.state); LOGS = data.logs || {};
  const m = model();
  if (fam === 'accessoryCircular') return accCircular(m);
  if (fam === 'accessoryRectangular') return accRect(m);
  if (fam === 'accessoryInline') return accInline(m);
  const V = variant(param);
  if (V.v === 'list') return listWidget(fam, data, stale);
  if (V.v === 'week') return weekWidget(fam, data, stale);
  if (V.v === 'habit') return habitWidget(fam, data, stale, V.q);
  if (V.v === 'mood') return moodWidget(fam, data, stale);
  if (V.v === 'todos') return todoWidget(fam, data, stale);
  if (V.v === 'quote') return quoteWidget(fam, data, stale);
  if (V.v === 'month') return monthWidget(fam, data, stale);
  if (V.v === 'streak') return streakWidget(fam, data, stale, V.q);
  // Standard: klein = Ring, mittel/groß = schlichte Liste aller Habits von heute
  return fam === 'small' ? small(m, data, stale) : listWidget(fam, data, stale);
}
async function present(w, fam) {
  if (fam === 'small') return w.presentSmall();
  if (fam === 'large') return w.presentLarge();
  if (fam === 'accessoryCircular') return w.presentAccessoryCircular();
  if (fam === 'accessoryRectangular') return w.presentAccessoryRectangular();
  if (fam === 'accessoryInline') return w.presentAccessoryInline();
  return w.presentMedium();
}
async function info(title, msg) { const a = new Alert(); a.title = title; a.message = msg; a.addAction('OK'); await a.presentAlert(); }

/* ---------- Ablauf ---------- */
async function getWidget(fam, param) {
  let data = null, stale = false;
  try { data = await loadRemote(); if (!data.state) return messageWidget(fam, 'Noch keine Daten', 'Öffne Sabrly und lege einen Habit an.'); saveCache(data); }
  catch (e) {
    if (String(e.message) === 'LOGIN') return messageWidget(fam, 'Anmeldung nötig', 'Öffne Scriptable, tippe auf das Sabrly-Skript und melde dich an.');
    data = readCache(); stale = true;
    if (!data) return messageWidget(fam, 'Keine Verbindung', 'Das Widget lädt deine Daten, sobald du online bist.');
  }
  S = normalizeState(data.state); LOGS = data.logs || {};
  await ensureTimes(); if (!stale) { await syncPrayerNotifs(); await syncWeekNotif(); await garminAuto(); }
  return build(fam, data, stale, param);
}
/* ---------- Aktionen in der Scriptable-App (nach einem Tipp aufs Widget) ---------- */
function errText(e) {
  const m = String((e && e.message) || '');
  if (m === 'NODATA') return 'Öffne Sabrly und lege zuerst einen Habit an.';
  if (m === 'CONFLICT') return 'Gerade wurde gleichzeitig gespeichert. Probier es bitte nochmal.';
  return 'Prüfe die Internetverbindung und probier es nochmal.' + (m && m !== 'LOGIN' ? '\n(' + m + ')' : '');
}
async function act(fn) {
  for (let i = 0; i < 2; i++) {
    try { return await fn(); }
    catch (e) {
      if (String(e.message) === 'LOGIN' && i === 0) { if (!(await login())) return null; continue; }
      await info('Hat nicht geklappt', errText(e)); return null;
    }
  }
  return null;
}
async function showResult(r) {
  if (!r) return;
  const a = new Alert(); a.title = r.title; a.message = r.msg || '';
  a.addAction('OK'); if (r.undo) a.addDestructiveAction('Rückgängig');
  const i = await a.presentAlert();
  if (r.undo && i === 1) {
    try { await undo(r.undo); await info('Rückgängig gemacht', ''); }
    catch (e) { await info('Rückgängig ging nicht', String(e.message) === 'CONFLICT' ? 'In der Zwischenzeit wurde in Sabrly etwas geändert. Mach es bitte dort.' : errText(e)); }
  }
}
async function loadAll() { const d = await loadRemote(); if (!d.state) throw new Error('NODATA'); saveCache(d); S = normalizeState(d.state); LOGS = d.logs || {}; await ensureTimes(); await syncPrayerNotifs(); await syncWeekNotif(); return d; }
const openToday = t => active(t).filter(h => !isDone(h, t) && !(h.freq === 'weekly' && weekCount(h, weekStart(t), t) >= h.target));
function habitLabel(h, t) {
  if (prayerHabit() === h) { const tg = prayerTarget(); if (tg && !tg.done) return h.emoji + '  ' + h.name + ' · ' + pLabel(tg.i) + (tg.lock ? ' ab ' + hmM(tg.s) : tg.yest ? ' (gestern)' : '') + '  (' + hv(h, t) + '/5)'; }
  const nl = nextLabel(h, t), T = tgt(h);
  return h.emoji + '  ' + h.name + (nl ? ' · ' + nl : '') + (h.freq === 'weekly' ? '  (' + weekCount(h, weekStart(t), t) + '/' + h.target + ' diese Woche)' : T > 1 ? '  (' + hv(h, t) + '/' + T + ')' : '');
}
// Liste: heute offene Habits abhaken
async function pickToday() {
  if (!(await act(loadAll))) return;
  const t = today(), open = openToday(t).slice(0, 12);
  const a = new Alert(); a.title = 'Heute abhaken';
  a.message = dateLine(t) + (open.length ? '' : '\nAlles für heute erledigt ✓');
  for (const h of open) a.addAction(habitLabel(h, t));
  a.addAction('🎭  Stimmung eintragen'); a.addAction('📝  Aufgaben');
  a.addCancelAction('Fertig');
  const i = await a.presentAlert();
  if (i < 0) return;
  if (i < open.length) return showResult(await act(() => actTick(open[i].id)));
  const k = i - open.length;
  if (k === 0) return pickMood();
  if (k === 1) return pickTodo();
}
async function pickMood() {
  if (!(await act(loadAll))) return;
  const t = today(), e = dayGet(t) || {}, cur = +e.mood || 0;
  const a = new Alert(); a.title = 'Wie fühlst du dich?'; a.message = cur ? 'Heute bisher: ' + MOODS[cur - 1] : '';
  MOODS.forEach((m, i) => a.addAction(m + (cur === i + 1 ? '  ✓' : '')));
  a.addCancelAction('Abbrechen');
  const i = await a.presentAlert();
  if (i < 0) return;
  return showResult(await act(() => actMood(i + 1)));
}
async function pickTodo() {
  if (!(await act(loadAll))) return;
  const L = todoList(), list = L.list.slice(0, 12);
  const a = new Alert(); a.title = 'Aufgaben'; a.message = list.length ? 'Tippe auf eine Aufgabe, um sie zu erledigen.' : 'Keine offenen Aufgaben ✓';
  for (const x of list) a.addAction(x.title + (x.due && x.due < L.t ? '  · überfällig' : x.due && x.due > L.t ? '  · ' + DN[wd(x.due)] + ', ' + pdate(x.due).getDate() + '.' : ''));
  a.addCancelAction('Fertig');
  const i = await a.presentAlert();
  if (i < 0) return;
  if (i < list.length) return showResult(await act(() => actTodo(list[i].id)));
}
/* ---------- Kurzbefehle: abhaken im Hintergrund, ohne dass sich etwas öffnet ----------
   Kurzbefehl mit der Aktion „Run Script“ (Scriptable): Script = Sabrly, Parameter = Habit-Name
   (oder „stimmung: 4“), „Run In App“ aus. Erfolg → Häkchen im Kurzbefehle-Widget, Fehler → Meldung. */
function findHabit(q) {
  const l = String(q || '').trim().toLowerCase(); if (!l) return null;
  const all = S.habits.filter(h => !h.archived);
  return all.find(h => h.name.toLowerCase() === l) || all.find(h => h.name.toLowerCase().startsWith(l)) || all.find(h => h.name.toLowerCase().includes(l)) || null;
}
function shortcutText() {
  const sp = args.shortcutParameter;
  if (typeof sp === 'string' && sp.trim()) return sp.trim();
  if (typeof sp === 'number') return String(sp);
  if (sp && typeof sp === 'object') { const v = sp.habit || sp.text || sp.name; if (v) return String(v).trim(); }
  const pt = args.plainTexts; if (Array.isArray(pt) && pt.length && String(pt[0]).trim()) return String(pt[0]).trim();
  return '';
}
async function shortcutRun(text) {
  if (!kget(K.refresh)) throw new Error('Nicht angemeldet. Öffne Scriptable und tippe einmal auf das Sabrly-Skript.');
  let r;
  try {
    const m = text.match(/^(stimmung|mood)\s*:?\s*([1-5])$/i);
    if (m) r = await actMood(+m[2]);
    else {
      const q = text.replace(/^(habit|gewohnheit)\s*:?\s*/i, '');
      await stateFor(null); let h = findHabit(q);
      if (!h) { await readState(); h = findHabit(q); }
      if (!h) throw new Error('NOTFOUND');
      r = await actTick(h.id);
    }
  } catch (e) {
    const m = String(e.message);
    if (m === 'NOTFOUND') throw new Error('Habit „' + text + '“ gibt es in Sabrly nicht. Prüfe den Parameter im Kurzbefehl.');
    if (m === 'LOGIN') throw new Error('Anmeldung abgelaufen. Öffne Scriptable und tippe einmal auf das Sabrly-Skript.');
    throw new Error(errText(e));
  }
  const out = r.title + (r.msg ? ' – ' + r.msg : '');
  Script.setShortcutOutput(out);
  return out;
}

// Tipp aufs Widget: eintragen, kurze Bestätigung mit „Rückgängig“
async function prayerFromNotif(d, i) {
  return showResult(await act(async () => {
    await stateFor(null); const h = prayerHabit();
    if (!h) return { title: 'Gebet', msg: 'In Sabrly ist kein Gebets-Habit eingerichtet.' };
    return (await actPrayer(h, { d, i })) || { title: 'Gebet', msg: 'Für diesen Tag gibt es keine Gebetszeiten.' };
  }));
}
async function handleLink(P) {
  if (P.a === 'ptick' && P.d && P.i != null) return prayerFromNotif(String(P.d), +P.i);
  if (P.a === 'tick' && P.h) return showResult(await act(() => actTick(P.h)));
  if (P.a === 'todo' && P.t) return showResult(await act(() => actTodo(P.t)));
  if (P.a === 'mood' && P.v) return showResult(await act(() => actMood(P.v)));
  if (P.a === 'mood') return pickMood();
  if (P.a === 'aufgaben') return pickTodo();
  return pickToday();
}
/* ---------- Garmin (Personal API): Schlüssel nur im Schlüsselbund dieses iPhones ---------- */
const GK = { key: 'sabrly.garmin.key', tok: 'sabrly.garmin.tok', texp: 'sabrly.garmin.texp' };
const GBASE = 'https://personal.connectapi.garmin.com';
function garminForget() { for (const k of Object.values(GK)) if (Keychain.contains(k)) Keychain.remove(k); }
function jwtExp(t) {
  try { let s = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const j = JSON.parse(Data.fromBase64String(s).toRawString()); if (j && +j.exp > 0) return +j.exp * 1000; } catch (e) {}
  return Date.now() + 20 * 3600e3;
}
async function gToken(force) {
  const t = kget(GK.tok), exp = Number(kget(GK.texp) || 0);
  if (!force && t && exp - 3600e3 > Date.now()) return t;
  const key = kget(GK.key); if (!key) throw new Error('GKEY 0');
  const r = new Request(GBASE + '/personalapitoken-service/personal-api/personal-api-key/token');
  r.method = 'POST'; r.headers = { Accept: '*/*', Authorization: 'ApiKey ' + key }; r.timeoutInterval = 20;
  const txt = String((await r.loadString()) || '').trim(), st = r.response ? r.response.statusCode : 0;
  if (st === 400 || st === 401 || st === 403) throw new Error('GKEY ' + st);
  if (st !== 200) throw new Error('Garmin antwortet mit Status ' + st + (txt ? ': ' + txt.slice(0, 160) : ''));
  if (txt.split('.').length !== 3) throw new Error('Garmin hat kein gültiges Token geliefert.');
  Keychain.set(GK.tok, txt); Keychain.set(GK.texp, String(jwtExp(txt)));
  return txt;
}
async function gReq(path, accept, bin) {
  for (let n = 0; n < 2; n++) {
    const tok = await gToken(n > 0);
    const r = new Request(GBASE + path); r.headers = { Accept: accept || 'application/json', Authorization: 'Bearer ' + tok }; r.timeoutInterval = 40;
    const body = bin ? await r.load() : await r.loadString();
    const st = r.response ? r.response.statusCode : 0;
    if (st === 401 && n === 0) { if (Keychain.contains(GK.tok)) Keychain.remove(GK.tok); continue; }
    return { status: st, body };
  }
}
async function gJSON(path) { const r = await gReq(path); let json = null; try { json = JSON.parse(r.body); } catch (e) {} return { status: r.status, json, text: String(r.body || '') }; }

// ZIP + inflate (RFC 1951), klein und ohne Bibliothek – Garmin liefert die Aufzeichnung als ZIP
const ZL = { lb: [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258], le: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0],
  db: [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577], de: [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13] };
function inflateRaw(src, start, size) {
  let pos = start; const end = start + size; let bb = 0, bc = 0; const out = [];
  const bits = n => { while (bc < n) { if (pos >= end) throw new Error('ZIP unvollständig'); bb |= src[pos++] << bc; bc += 8; } const v = bb & ((1 << n) - 1); bb >>>= n; bc -= n; return v; };
  const huff = lens => { const count = new Array(16).fill(0), offs = new Array(16).fill(0), symbol = []; for (const l of lens) count[l]++; count[0] = 0;
    for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + count[i - 1]; lens.forEach((l, s) => { if (l) symbol[offs[l]++] = s; }); return { count, symbol }; };
  const dec = h => { let code = 0, first = 0, index = 0; for (let len = 1; len < 16; len++) { code |= bits(1); const c = h.count[len]; if (code - c < first) return h.symbol[index + code - first]; index += c; first = (first + c) << 1; code <<= 1; } throw new Error('ZIP beschädigt'); };
  let fixL = null, fixD = null, last = 0;
  while (!last) {
    last = bits(1); const type = bits(2);
    if (type === 0) {
      bb = 0; bc = 0; if (pos + 4 > end) throw new Error('ZIP unvollständig');
      const len = src[pos] | src[pos + 1] << 8; pos += 4; if (pos + len > end) throw new Error('ZIP unvollständig');
      for (let i = 0; i < len; i++) out.push(src[pos++]);
      continue;
    }
    let L, D;
    if (type === 1) {
      if (!fixL) { const l = []; for (let i = 0; i < 288; i++) l.push(i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8); fixL = huff(l); fixD = huff(new Array(30).fill(5)); }
      L = fixL; D = fixD;
    } else if (type === 2) {
      const nl = bits(5) + 257, nd = bits(5) + 1, nc = bits(4) + 4, ord = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], cl = new Array(19).fill(0);
      for (let i = 0; i < nc; i++) cl[ord[i]] = bits(3);
      const ch = huff(cl), lens = [];
      while (lens.length < nl + nd) {
        const s = dec(ch);
        if (s < 16) lens.push(s);
        else if (s === 16) { if (!lens.length) throw new Error('ZIP beschädigt'); const p = lens[lens.length - 1]; for (let r = 3 + bits(2); r > 0; r--) lens.push(p); }
        else { for (let r = s === 17 ? 3 + bits(3) : 11 + bits(7); r > 0; r--) lens.push(0); }
      }
      L = huff(lens.slice(0, nl)); D = huff(lens.slice(nl, nl + nd));
    } else throw new Error('ZIP beschädigt');
    for (;;) {
      const s = dec(L);
      if (s < 256) out.push(s);
      else if (s === 256) break;
      else {
        const li = s - 257; if (li >= 29) throw new Error('ZIP beschädigt');
        const len = ZL.lb[li] + bits(ZL.le[li]), di = dec(D); if (di >= 30) throw new Error('ZIP beschädigt');
        const dist = ZL.db[di] + bits(ZL.de[di]); if (dist > out.length) throw new Error('ZIP beschädigt');
        for (let i = 0; i < len; i++) out.push(out[out.length - dist]);
      }
    }
  }
  return out;
}
const u16 = (b, p) => b[p] | b[p + 1] << 8, u32 = (b, p) => b[p] + b[p + 1] * 256 + b[p + 2] * 65536 + b[p + 3] * 16777216;
// liefert die erste .fit-Datei aus einem ZIP (oder die Bytes selbst, wenn es schon eine FIT-Datei ist)
function unzipFit(b) {
  const isFit = (a, p) => a.length > p + 12 && String.fromCharCode(a[p + 8], a[p + 9], a[p + 10], a[p + 11]) === '.FIT';
  if (isFit(b, 0)) return { name: '(direkt)', bytes: b };
  if (u32(b, 0) !== 0x04034b50) throw new Error('Keine ZIP- und keine FIT-Datei');
  let e = -1; for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { e = i; break; }
  const files = [];
  if (e >= 0) {
    let p = u32(b, e + 16); const n = u16(b, e + 10);
    for (let k = 0; k < n && u32(b, p) === 0x02014b50; k++) {
      const nl = u16(b, p + 28), xl = u16(b, p + 30), cl = u16(b, p + 32);
      files.push({ m: u16(b, p + 10), cs: u32(b, p + 20), us: u32(b, p + 24), lo: u32(b, p + 42), name: String.fromCharCode(...b.slice(p + 46, p + 46 + nl)) });
      p += 46 + nl + xl + cl;
    }
  } else files.push({ m: u16(b, 8), cs: u32(b, 18), us: u32(b, 22), lo: 0, name: String.fromCharCode(...b.slice(30, 30 + u16(b, 26))) });
  const f = files.find(x => /\.fit$/i.test(x.name)) || files[0]; if (!f) throw new Error('ZIP ist leer');
  const d = f.lo + 30 + u16(b, f.lo + 26) + u16(b, f.lo + 28);
  if (f.m === 0) return { name: f.name, bytes: b.slice(d, d + f.cs) };
  if (f.m !== 8) throw new Error('ZIP-Verfahren ' + f.m + ' wird nicht unterstützt');
  return { name: f.name, bytes: inflateRaw(b, d, f.cs) };
}

// FIT-Datei lesen: alle Nachrichten als { n: Nachrichtennummer, f: { Feldnummer: Wert } }
const FIT_EPOCH = 631065600;
// rec: true sammelt die Datensätze kompakt als [Zeit, Distanz (cm), Puls]
function fitParse(b, keep, rec) {
  const SZ = [1, 1, 1, 2, 2, 4, 4, 1, 4, 8, 1, 2, 4, 1, 8, 8, 8], msgs = [], counts = {}, recFields = {}, R = [];
  let p = 0, firstRec = null, recs = 0, lastTs = null;
  const num = (q, t, le) => {
    const s = SZ[t]; if (s === 1) { const v = b[q]; if (t === 1) return v === 0x7F ? null : (v << 24 >> 24); if (t === 10) return v === 0 ? null : v; return v === 0xFF ? null : v; }
    if (t === 8 || t === 9) { let all = true; for (let i = 0; i < s; i++) if (b[q + i] !== 0xFF) all = false; if (all) return null; const dv = new DataView(new ArrayBuffer(s)); for (let i = 0; i < s; i++) dv.setUint8(i, b[q + i]); return t === 8 ? dv.getFloat32(0, le) : dv.getFloat64(0, le); }
    if (s === 8) return null;
    let v = 0; for (let i = 0; i < s; i++) v += b[q + (le ? i : s - 1 - i)] * Math.pow(256, i);
    if (t === 3) return v === 0x7FFF ? null : (v >= 0x8000 ? v - 0x10000 : v);
    if (t === 5) return v === 0x7FFFFFFF ? null : (v >= 0x80000000 ? v - 0x100000000 : v);
    if (t === 11 || t === 12) return v === 0 ? null : v;
    return v === Math.pow(256, s) - 1 ? null : v;
  };
  const str = (q, n) => { const a = []; for (let i = 0; i < n && b[q + i]; i++) a.push(b[q + i]); let s = String.fromCharCode(...a); try { s = decodeURIComponent(escape(s)); } catch (e) {} return s; };
  while (p + 12 <= b.length) {
    const hs = b[p]; if ((hs !== 12 && hs !== 14) || String.fromCharCode(b[p + 8], b[p + 9], b[p + 10], b[p + 11]) !== '.FIT') break;
    let q = p + hs; const end = Math.min(b.length, q + u32(b, p + 4)), defs = {};
    while (q < end) {
      const h = b[q++];
      if (!(h & 0x80) && (h & 0x40)) {
        const le = b[q + 1] === 0, n = le ? u16(b, q + 2) : (b[q + 2] << 8 | b[q + 3]), nf = b[q + 4]; q += 5;
        const fields = []; for (let i = 0; i < nf; i++) { fields.push([b[q], b[q + 1], b[q + 2] & 0x1F]); q += 3; }
        let dev = 0; if (h & 0x20) { const nd = b[q++]; for (let i = 0; i < nd; i++) { dev += b[q + 1]; q += 3; } }
        defs[h & 0x0F] = { n, le, fields, dev };
        continue;
      }
      const d = defs[(h & 0x80) ? (h >> 5) & 3 : h & 0x0F]; if (!d) throw new Error('FIT beschädigt');
      counts[d.n] = (counts[d.n] || 0) + 1;
      const want = keep(d.n), isRec = d.n === 20, f = want || isRec ? {} : null;
      for (const [fn, size, t] of d.fields) {
        if (f) {
          const es = SZ[t] || 1;
          if (t === 7) f[fn] = str(q, size);
          else if (t !== 13 && size >= es && size % es === 0) {
            if (size === es) { const v = num(q, t, d.le); if (v !== null) f[fn] = v; }
            else { const a = []; for (let i = 0; i < size; i += es) { const v = num(q + i, t, d.le); if (v !== null) a.push(v); } if (a.length) f[fn] = a; }
          }
        }
        q += size;
      }
      q += d.dev;
      // komprimierter Zeitstempel im Kopf: 5 Bit Versatz zur letzten vollen Zeit
      if (f && (h & 0x80) && lastTs != null && f[253] == null) { const o = h & 0x1F; let ts = (lastTs & ~0x1F) + o; if (o < (lastTs & 0x1F)) ts += 0x20; f[253] = ts; }
      if (f && f[253] != null) lastTs = f[253];
      if (isRec) { recs++; for (const k of Object.keys(f)) recFields[k] = 1; if (!firstRec) firstRec = f; if (rec) R.push([f[253], f[5], f[3], f[4] != null ? f[4] + (f[53] || 0) / 128 : null, f[78] != null ? f[78] / 5 - 500 : f[2] != null ? f[2] / 5 - 500 : null]); }
      if (want) msgs.push({ n: d.n, f });
    }
    p = end + 2;
  }
  return { msgs, counts, recs, recFields: Object.keys(recFields).map(Number), firstRec, rec: R };
}

const GMS = { 0: 'file_id', 12: 'sport', 18: 'session', 19: 'lap', 20: 'record', 21: 'event', 22: 'source', 23: 'device_info', 26: 'workout', 27: 'workout_step', 34: 'activity', 49: 'file_creator', 72: 'training_file', 78: 'hrv', 101: 'length', 104: 'device_aux_battery', 113: 'gps_metadata?', 140: 'physiological?', 141: 'mesg141', 206: 'field_description', 207: 'developer_data_id', 216: 'time_in_zone', 225: 'set', 227: 'stress_level', 285: 'jump', 312: 'split', 313: 'split_summary', 325: 'mesg325' };
const GPOS = { 0: [3], 18: [3, 4, 29, 30, 31, 32, 38, 39], 19: [3, 4, 5, 6, 27, 28, 29, 30], 20: [0, 1], 312: [17, 18, 19, 20, 21, 22, 23, 24] };
const gClean = (n, f) => { const o = {}; for (const [k, v] of Object.entries(f)) if (!(GPOS[n] || []).includes(+k)) o[k] = v; return o; };
const gT = s => { const d = new Date((s + FIT_EPOCH) * 1000); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '. ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); };
const gDur = s => { if (s == null || isNaN(s)) return '–'; s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + pad(m) : m) + ':' + pad(x); };
const gPace = v => v > 0.3 ? gDur(1000 / v) + '/km' : '–';
const INT = ['active', 'rest', 'warmup', 'cooldown', 'recovery', 'interval', 'other'], TRIG = ['manual', 'time', 'distance', 'posStart', 'posLap', 'posWpt', 'posMarked', 'sessionEnd', 'equipment'];
function lapLine(i, f) {
  const sp = f[110] != null ? f[110] / 1000 : f[13] != null ? f[13] / 1000 : null, dist = f[9] != null ? f[9] / 100 : null, tt = f[8] != null ? f[8] / 1000 : f[7] != null ? f[7] / 1000 : null;
  return '#' + (i + 1) + ' ' + (INT[f[23]] || (f[23] == null ? '?' : f[23])) + '/' + (TRIG[f[24]] || (f[24] == null ? '?' : f[24])) + ' · ' + (dist != null ? Math.round(dist) + ' m' : '– m') + ' · ' + gDur(tt) + ' · ' + gPace(sp)
    + ' · HF ' + (f[15] != null ? f[15] : '–') + '/' + (f[16] != null ? f[16] : '–') + (f[17] != null ? ' · Kad ' + (f[17] * 2 + (f[80] ? Math.round(f[80] / 64) : 0)) : '') + (f[71] != null ? ' · Schritt ' + f[71] : '') + (f[2] != null ? ' · ' + gT(f[2]) : '');
}
function fitReport(bytes) {
  const z = unzipFit(bytes), keepN = new Set([0, 12, 18, 19, 26, 27, 216, 225, 312, 313]), F = fitParse(z.bytes, n => keepN.has(n)), L = [];
  L.push('FIT: ' + z.name + ' · ' + z.bytes.length + ' B · ' + Object.entries(F.counts).map(([n, c]) => (GMS[n] || 'mesg' + n) + ' ' + c).join(', '));
  const by = n => F.msgs.filter(m => m.n === n).map(m => m.f);
  for (const f of by(0)) { const o = gClean(0, f); delete o[3]; L.push('file_id: ' + JSON.stringify(o)); }
  for (const f of by(12)) L.push('sport: ' + JSON.stringify(f));
  for (const f of by(18)) L.push('session: ' + JSON.stringify(gClean(18, f)));
  const laps = by(19); L.push('Runden: ' + laps.length);
  laps.slice(0, 60).forEach((f, i) => L.push('  ' + lapLine(i, f)));
  laps.slice(0, 2).forEach((f, i) => L.push('  roh #' + (i + 1) + ': ' + JSON.stringify(gClean(19, f))));
  for (const n of [26, 27, 312, 313, 216]) { const a = by(n); if (a.length) { L.push(GMS[n] + ' (' + a.length + '):'); a.slice(0, 40).forEach(f => L.push('  ' + JSON.stringify(gClean(n, f)))); } }
  const sets = by(225); if (sets.length) { L.push('set (' + sets.length + '):'); sets.slice(0, 80).forEach(f => L.push('  ' + JSON.stringify(f))); }
  L.push('record: ' + F.recs + ' · Felder ' + F.recFields.join(',') + (F.firstRec ? ' · erstes ' + JSON.stringify(gClean(20, F.firstRec)) : ''));
  return L.join('\n');
}

// Bericht für Claude: Felder ohne Standort, Namen von Personen oder Geräte-IDs
const GRED = /latitude|longitude|polyline|owner|userprofile|profileid|^userid$|displayname|fullname|deviceid|serialnumber|uuid|locationname|geopoint|image|email|^(start|end|nec|swc)?(lat|lon|long|lng)$|Lat$|Lon$|Long$/i;
function gRedact(x, d) {
  if (Array.isArray(x)) return x.slice(0, 60).map(v => gRedact(v, (d || 0) + 1));
  if (x && typeof x === 'object') { const o = {}; for (const [k, v] of Object.entries(x)) if (!GRED.test(k) && v !== null) o[k] = gRedact(v, (d || 0) + 1); return o; }
  return x;
}
const gCut = (s, n) => s.length > n ? s.slice(0, n) + ' …(' + (s.length - n) + ' Zeichen gekürzt)' : s;
const gKind = a => { const t = String((a.activityType && a.activityType.typeKey) || ''); return /run/.test(t) ? 'run' : /strength/.test(t) ? 'str' : 'other'; };
async function garminReport() {
  const L = [], now = new Date();
  L.push('SABRLY GARMIN-TEST v1 · ' + iso(now) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()));
  await gToken(false);
  L.push('Token: ok · gültig bis ' + new Date(Number(kget(GK.texp) || 0)).toISOString());
  const list = await gJSON('/activitylist-service/activities/search/activities?start=0&limit=20');
  L.push('Liste: Status ' + list.status);
  const acts = Array.isArray(list.json) ? list.json : [];
  if (!acts.length) { L.push(gCut(list.text, 800)); return L.join('\n'); }
  for (const a of acts) L.push('  ' + String(a.startTimeLocal || '').slice(0, 16) + ' | ' + ((a.activityType && a.activityType.typeKey) || '?') + ' | ' + (a.activityName || '') + ' | '
    + (a.distance ? (a.distance / 1000).toFixed(2) + ' km' : '–') + ' | ' + gDur(a.duration) + ' | HF ' + (a.averageHR || '–') + '/' + (a.maxHR || '–') + ' | Runden ' + (a.lapCount == null ? '–' : a.lapCount) + ' | id ' + a.activityId);
  const pick = [], add = a => { if (a && !pick.includes(a)) pick.push(a); };
  add(acts.find(a => gKind(a) === 'run'));
  add(acts.find(a => gKind(a) === 'run' && ((a.lapCount || 0) > 1 && (a.splitSummaries || []).some(s => /INTERVAL/.test(String(s.splitType || ''))) || a.workoutId)));
  add(acts.find(a => gKind(a) === 'str'));
  add(acts.find(a => gKind(a) === 'other'));
  for (const a of pick.slice(0, 4)) {
    const id = a.activityId;
    L.push('', '=== ' + ((a.activityType && a.activityType.typeKey) || '?') + ' · ' + (a.activityName || '') + ' · ' + String(a.startTimeLocal || '') + ' · id ' + id + ' ===');
    L.push('[Liste] ' + gCut(JSON.stringify(gRedact(a)), 6000));
    for (const [lab, path, n] of [['Detail', '', 5000], ['workouts', '/workouts', 1500], ['splits', '/splits', 1500], ['typedsplits', '/typedsplits', 1500], ['exerciseSets', '/exerciseSets', 2500], ['hrTimeInZones', '/hrTimeInZones', 800]]) {
      try { const r = await gJSON('/activity-service/activity/' + id + path); L.push('[' + lab + '] Status ' + r.status + ' · ' + gCut(r.json != null ? JSON.stringify(gRedact(r.json)) : r.text, n)); }
      catch (e) { L.push('[' + lab + '] Fehler: ' + e.message); }
    }
    try {
      const r = await gReq('/download-service/files/activity/' + id, 'application/zip, application/x-zip-compressed, application/octet-stream', true);
      if (r.status !== 200 || !r.body) L.push('[Aufzeichnung] Status ' + r.status);
      else { const bytes = r.body.getBytes(); L.push('[Aufzeichnung] Status 200 · ' + bytes.length + ' B'); L.push(fitReport(bytes)); }
    } catch (e) { L.push('[Aufzeichnung] Fehler: ' + e.message); }
  }
  return L.join('\n');
}
async function garminAskKey() {
  const a = new Alert(); a.title = '⌚ Garmin-Schlüssel';
  a.message = 'Füge den Schlüssel aus Garmin Connect ein (Einstellungen → Personal API Key). Er wird nur im Schlüsselbund dieses iPhones gespeichert.';
  a.addSecureTextField('Schlüssel', ''); a.addAction('Speichern'); a.addAction('Aus Zwischenablage einfügen'); a.addCancelAction('Abbrechen');
  const i = await a.presentAlert(); if (i === -1) return false;
  let k = i === 1 ? String(Pasteboard.pasteString() || '') : String(a.textFieldValue(0) || '');
  k = k.replace(/\s+/g, '');
  if (k.length < 16) { await info('Kein Schlüssel', 'Das sieht nicht nach einem Garmin-Schlüssel aus. Kopiere ihn vollständig und versuche es nochmal.'); return false; }
  if (i === 1) Pasteboard.copyString(' ');
  garminForget(); Keychain.set(GK.key, k);
  return true;
}
async function garminTest() {
  let rep;
  try { rep = await garminReport(); }
  catch (e) {
    const m = String(e.message || e);
    if (/^GKEY/.test(m)) {
      const a = new Alert(); a.title = 'Schlüssel abgelehnt'; a.message = 'Garmin nimmt den Schlüssel nicht an (' + m.replace('GKEY ', 'Status ') + '). Vielleicht ist er unvollständig kopiert oder abgelaufen.';
      a.addAction('Neuen Schlüssel eingeben'); a.addCancelAction('Abbrechen');
      if (await a.presentAlert() === 0 && await garminAskKey()) return garminTest();
      return;
    }
    rep = 'SABRLY GARMIN-TEST v1\nFehler: ' + m;
  }
  Pasteboard.copyString(rep);
  const a = new Alert(); a.title = '✓ Bericht kopiert';
  a.message = 'Füge ihn jetzt im Chat bei Claude ein (lange tippen → Einsetzen). Er enthält deine letzten Trainings, aber keine Standortdaten und nicht deinen Schlüssel.';
  a.addAction('OK'); a.addAction('Bericht ansehen');
  if (await a.presentAlert() === 1) await QuickLook.present(rep, true);
}

/* ---------- Garmin → Sabrly: Läufe als Lauf-Einträge, Kraft und Sonstiges als ga-Einträge ---------- */
const GTN = { running: 'Laufen', treadmill_running: 'Laufband', trail_running: 'Trailrun', track_running: 'Bahnlauf', indoor_running: 'Laufband', virtual_run: 'Virtueller Lauf', strength_training: 'Krafttraining',
  cycling: 'Radfahren', indoor_cycling: 'Indoor-Radfahren', road_biking: 'Rennrad', mountain_biking: 'Mountainbike', gravel_cycling: 'Gravel', virtual_ride: 'Virtuelles Radfahren', hiit: 'HIIT', indoor_cardio: 'Cardio',
  elliptical: 'Crosstrainer', stair_climbing: 'Treppensteigen', indoor_rowing: 'Rudergerät', rowing: 'Rudern', lap_swimming: 'Schwimmen', open_water_swimming: 'Freiwasser', yoga: 'Yoga', pilates: 'Pilates',
  hiking: 'Wandern', boxing: 'Boxen', soccer: 'Fußball', basketball: 'Basketball', tennis: 'Tennis', padel: 'Padel', bouldering: 'Bouldern', rock_climbing: 'Klettern', jump_rope: 'Seilspringen', mobility: 'Mobility' };
const GSKIP = /^(walking|casual_walking|speed_walking|floor_climbing|transition|multi_sport|uncategorized)$/;
const GDAYS = 14;
const gTyp = a => String((a.activityType && a.activityType.typeKey) || '');
function gClass(a) {
  const t = gTyp(a), km = (+a.distance || 0) / 1000, dur = +a.duration || 0;
  if (/run/.test(t) && km >= 0.3) return 'run';
  if (/strength/.test(t)) return dur >= 300 ? 'str' : null;
  if (!t || GSKIP.test(t)) return null;
  return dur >= 20 * 60 ? 'oth' : null;
}
function gStart(a) { const m = /^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)/.exec(String(a.startTimeLocal || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null; }
function gDay(a) { const d = gStart(a); return d ? iso(new Date(d.getTime() - (S.settings.dayStart || 0) * 3600e3)) : null; }
const r1 = v => v == null || isNaN(v) ? null : Math.round(+v * 10) / 10, ri = v => v == null || isNaN(v) ? 0 : Math.round(+v);
function gBase(a) {
  const st = gStart(a), z = [1, 2, 3, 4, 5].map(i => ri(a['hrTimeInZone_' + i])), o = { id: String(a.activityId), n: String(a.activityName || GTN[gTyp(a)] || 'Training').slice(0, 60), typ: gTyp(a) };
  if (st) { o.st = pad(st.getHours()) + ':' + pad(st.getMinutes()); o.ts = st.getTime(); }
  const add = (k, v) => { if (v != null && v !== 0 && v !== '' && !(typeof v === 'number' && isNaN(v))) o[k] = v; };
  add('kcal', ri(a.calories)); add('te', r1(a.aerobicTrainingEffect)); add('ate', r1(a.anaerobicTrainingEffect)); add('load', ri(a.activityTrainingLoad)); add('lbl', a.trainingEffectLabel ? String(a.trainingEffectLabel) : '');
  if (z.some(Boolean)) o.z = z;
  return o;
}
// km-Splits aus den Datensätzen: bewegte Zeit (Lücken > 10 s = Pause), Ø-Puls, Kadenz (Schritte/min) und Höhenänderung je Kilometer
function kmSplits(rec) {
  const out = []; let mt = 0, pt = null, pd = 0, segT = 0, hs = 0, hn = 0, cs = 0, cn = 0, a0 = null, la = null, next = 1000;
  const one = (t, x) => { const o = { t: Math.round(t), h: hn ? Math.round(hs / hn) : 0 }; if (cn) o.c = Math.round(cs / cn * 2); if (a0 != null && la != null) o.e = Math.round(la - a0); return Object.assign(o, x || {}); };
  for (const [t, dc, h, c, al] of rec) {
    if (t == null) continue;
    const dt = pt != null ? t - pt : 0, step = dt > 0 && dt <= 10 ? dt : 0;
    if (h) { hs += h; hn++; }
    if (c > 20) { cs += c; cn++; }
    if (al != null) { la = al; if (a0 == null) a0 = al; }
    if (dc == null) { mt += step; pt = t; continue; }
    const d = dc / 100;
    while (d >= next) { const fr = d > pd ? (next - pd) / (d - pd) : 1, at = mt + step * fr; out.push(one(at - segT)); segT = at; hs = 0; hn = 0; cs = 0; cn = 0; a0 = la; next += 1000; }
    mt += step; pt = t; pd = Math.max(pd, d);
  }
  const rest = pd - (next - 1000); if (rest >= 50 && out.length < 200) out.push(one(mt - segT, { m: Math.round(rest) }));
  return out.slice(0, 200);
}
// Verlauf für die Auswertung: je Minute bewegter Zeit (bei langen Läufen gröber, höchstens 120 Punkte) Pace, Puls, Kadenz, Höhe
function gCurve(rec) {
  let total = 0, pt = null;
  for (const r of rec) { const t = r[0]; if (t == null) continue; if (pt != null) { const dt = t - pt; if (dt > 0 && dt <= 10) total += dt; } pt = t; }
  if (total < 300) return null;
  const s = 60 * Math.max(1, Math.ceil(total / 60 / 120)), P = [], H = [], C = [], A = [];
  let mt = 0, bEnd = s, d0 = null, ld = null, hs = 0, hn = 0, cs = 0, cn = 0, la = null; pt = null;
  const flush = len => { const dist = ld != null && d0 != null ? (ld - d0) / 100 : 0; P.push(dist >= 15 ? Math.round(len / (dist / 1000)) : 0); H.push(hn ? Math.round(hs / hn) : 0); C.push(cn ? Math.round(cs / cn * 2) : 0); A.push(la != null ? Math.round(la) : 0); d0 = ld; hs = 0; hn = 0; cs = 0; cn = 0; };
  for (const [t, dc, h, c, al] of rec) {
    if (t == null) continue;
    if (pt != null) { const dt = t - pt; if (dt > 0 && dt <= 10) mt += dt; }
    pt = t;
    if (dc != null) { if (d0 == null) d0 = dc; ld = dc; }
    if (h) { hs += h; hn++; } if (c > 20) { cs += c; cn++; } if (al != null) la = al;
    while (mt >= bEnd) { flush(s); bEnd += s; }
  }
  if (mt - (bEnd - s) >= 20) flush(mt - (bEnd - s));
  const o = { s, p: P, h: H }; if (C.some(Boolean)) o.c = C; if (A.some(Boolean)) o.a = A;
  return o;
}
// Aerobe Entkopplung (Pace:Puls): Effizienz der 2. Hälfte gegenüber der 1. (ohne die ersten 5 min). Positiv = Puls driftet hoch.
function gDecouple(rec) {
  const pts = []; let mt = 0, pt = null;
  for (const [t, dc, h] of rec) { if (t == null) continue; if (pt != null) { const dt = t - pt; if (dt > 0 && dt <= 10) mt += dt; } pt = t; if (dc != null && h) pts.push([mt, dc / 100, h]); }
  if (pts.length < 10) return null;
  const T = pts[pts.length - 1][0], skip = T >= 25 * 60 ? 300 : 0;
  if (T - skip < 20 * 60) return null;
  const mid = skip + (T - skip) / 2, ef = A => { if (A.length < 2) return null; const dt = A[A.length - 1][0] - A[0][0], dd = A[A.length - 1][1] - A[0][1], hr = A.reduce((x, p) => x + p[2], 0) / A.length; return dt > 0 && dd > 0 && hr > 0 ? dd / dt / hr : null; };
  const e1 = ef(pts.filter(p => p[0] >= skip && p[0] < mid)), e2 = ef(pts.filter(p => p[0] >= mid));
  return e1 && e2 ? Math.round((e1 - e2) / e1 * 1000) / 10 : null;
}
// Puls zu einem Zeitpunkt (nächster Datensatz)
function hrAt(rec, ts) { let lo = 0, hi = rec.length - 1; if (hi < 0) return null; while (lo < hi) { const m = (lo + hi) >> 1; if ((rec[m][0] || 0) < ts) lo = m + 1; else hi = m; } for (let k = lo; k >= Math.max(0, lo - 5); k--) if (rec[k][2]) return rec[k][2]; return rec[lo][2] || null; }
// Lauf/Geh-Abschnitte, die die Uhr selbst erkennt (split 17 Laufen, 18 Gehen)
function gSegs(F) {
  const R = F.rec || [];
  const L = F.msgs.filter(m => m.n === 312 && (m.f[0] === 17 || m.f[0] === 18)).map(m => m.f).sort((a, b) => (a[9] || 0) - (b[9] || 0))
    .map(f => { const x = { k: f[0] === 17 ? 'r' : 'w', t: ri((f[2] != null ? f[2] : f[1]) / 1000), m: ri((f[3] || 0) / 100), h: ri(f[15]) };
      if (x.k === 'w' && x.t >= 30 && f[9] != null && R.length) { const el = (f[1] != null ? f[1] : f[2] || 0) / 1000, a = hrAt(R, f[9]), b = hrAt(R, f[9] + Math.min(60, el)); if (a && b) x.d = a - b; }
      return x; }).filter(x => x.t > 0);
  return L.some(x => x.k === 'w' && x.t >= 20) && L.some(x => x.k === 'r') ? L.slice(0, 60) : null;
}
function gLaps(F) {
  return F.msgs.filter(m => m.n === 19).map(m => m.f).map(f => ({ t: ri((f[8] != null ? f[8] : f[7]) / 1000), m: ri((f[9] || 0) / 100), h: ri(f[15]), x: ri(f[16]), i: f[23] == null ? 0 : f[23], tr: f[24] == null ? 0 : f[24] })).filter(x => x.t > 0).slice(0, 80);
}
const med = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
const gMin = s => { const m = Math.round(s / 30) / 2; return (m < 1 ? Math.round(s) + ' s' : String(m).replace('.', ',') + ' min'); };
// Intervalle erkennen (Version GV). Zwei Quellen:
// 1) Runden mit Pause (strukturiertes Workout der Uhr)
// 2) Lauf/Geh-Abschnitte: nur echte Gehpausen (≥ 40 s) zählen, und mindestens zwei gleich lange Läufe müssen direkt
//    aufeinander folgen. Kurzes Gehen an der Ampel macht aus einem lockeren Lauf keine Intervalle.
// Was vor dem ersten bzw. nach dem letzten Intervall liegt, ist Ein- bzw. Auslaufen (roles).
const GV = 3, GMINW = 40;
const spread = (L, k) => { const v = L.map(x => +x[k] || 0), m = med(v); return m > 0 ? (Math.max(...v) - Math.min(...v)) / m : 9; };
const within = (L, k, tol) => { const m = med(L.map(x => +x[k] || 0)); return m > 0 && L.every(x => Math.abs((+x[k] || 0) - m) <= m * tol); };
const alike = L => L.length >= 2 && (within(L, 't', 0.25) || within(L, 'm', 0.15));
function gAnalyze(laps, seg, minReps) {
  laps = laps || []; minReps = minReps || 2;
  const mk = (reps, rests, how) => {
    const dm = med(reps.map(x => x.m)), sm = spread(reps, 'm'), st = spread(reps, 't'), roundM = Math.abs(dm - Math.round(dm / 50) * 50) <= dm * 0.01;
    // Strecken-Intervalle, wenn die Strecke deutlich gleichmäßiger ist als die Zeit (bei exaktem Gleichstand: runde Meterzahl)
    const byDist = dm >= 100 && (sm < st / 2 || (sm <= 0.01 && st <= 0.01 && roundM));
    const iv = { p: 'own', n: Math.min(30, reps.length), u: byDist ? 'm' : 'min', len: byDist ? Math.round(dm / 50) * 50 : Math.max(1, Math.round(med(reps.map(x => x.t)) / 60)),
      pz: rests.length ? gMin(med(rests)) + ' ' + how : '', r: [] };
    iv.r = reps.slice(0, 30).map(x => ({ v: byDist ? msx(x.t) : (x.m > 0 ? msx(x.t / (x.m / 1000)) : ''), h: x.h || 0 }));
    return iv;
  };
  const work = laps.filter(l => l.i === 0 || l.i === 5), rest = laps.filter(l => l.i === 1 || l.i === 4);
  if (rest.length && work.length >= 2) return { iv: mk(work, rest.map(l => l.t), 'Pause'), roles: null };
  if (!seg || !seg.length) return { iv: null, roles: null };
  // Ketten von Läufen, die nur durch echte Gehpausen getrennt sind
  const chains = []; let cur = [];
  seg.forEach((x, i) => { if (x.k === 'r') cur.push(i); else if (x.t < GMINW && cur.length) { chains.push(cur); cur = []; } });
  if (cur.length) chains.push(cur);
  let best = null;
  for (const c of chains) for (let a = 0; a < c.length; a++) for (let b = a + 1; b < c.length; b++) {
    const sub = c.slice(a, b + 1), L = sub.map(i => seg[i]);
    if (sub.length < minReps || !alike(L)) continue;
    const tot = L.reduce((s, x) => s + x.t, 0), rest = seg.slice(sub[0] + 1, sub[sub.length - 1]).filter(x => x.k !== 'r').reduce((s, x) => s + x.t, 0);
    if (rest < tot * 0.08) continue; // eine einzelne Minute Gehen in einem langen Lauf ist keine Intervallpause
    if (!best || sub.length > best.sub.length || (sub.length === best.sub.length && tot > best.tot)) best = { sub, tot };
  }
  if (!best) return { iv: null, roles: null };
  const A = best.sub[0], B = best.sub[best.sub.length - 1], reps = best.sub.map(i => seg[i]), rests = [];
  for (let k = 0; k < best.sub.length - 1; k++) rests.push(seg.slice(best.sub[k] + 1, best.sub[k + 1]).reduce((s, x) => s + x.t, 0));
  const jog = seg.slice(A + 1, B).some(x => x.k === 'j');
  return { iv: mk(reps, rests, jog ? 'traben' : 'gehen'), roles: { a: A, b: B } };
}
// Intervalle mit Trabpausen: die Uhr erkennt nur Gehen, darum zusätzlich am Tempo – schnelle und langsame Blöcke.
// Zwei klar getrennte Tempos (≥ 22 % Unterschied), Blöcke unter 25 s werden dem Nachbarn zugeschlagen.
function gPaceSegs(rec) {
  const P = []; let mt = 0, pt = null;
  for (const [t, dc, h] of rec) { if (t == null || dc == null) continue; if (pt != null) { const dt = t - pt; if (dt > 0 && dt <= 10) mt += dt; } pt = t; P.push([mt, dc / 100, h || 0]); }
  const n = P.length; if (n < 300 || mt < 900) return null;
  const v = new Array(n); let a = 0, b = 0;
  for (let i = 0; i < n; i++) { while (P[i][0] - P[a][0] > 10) a++; if (b < i) b = i; while (b + 1 < n && P[b + 1][0] - P[i][0] <= 10) b++; const dt = P[b][0] - P[a][0]; v[i] = dt >= 6 ? (P[b][1] - P[a][1]) / dt : null; }
  const vs = v.filter(x => x != null && x > 0.8).sort((x, y) => x - y); if (vs.length < 200) return null;
  let c1 = vs[Math.floor(vs.length * 0.25)], c2 = vs[Math.floor(vs.length * 0.75)];
  for (let k = 0; k < 15; k++) { const th = (c1 + c2) / 2; let s1 = 0, n1 = 0, s2 = 0, n2 = 0; for (const x of vs) { if (x < th) { s1 += x; n1++; } else { s2 += x; n2++; } } if (!n1 || !n2) return null; c1 = s1 / n1; c2 = s2 / n2; }
  if ((c2 - c1) / c2 < 0.22) return null;
  const th = (c1 + c2) / 2; let B = [];
  for (let i = 0; i < n; i++) { const L = B[B.length - 1], f = v[i] == null ? (L ? L.f : false) : v[i] >= th; if (L && L.f === f) L.e = i; else B.push({ f, s: i, e: i }); }
  const dur = x => P[x.e][0] - P[x.s][0] + 1, join = A => A.reduce((acc, x) => { const l = acc[acc.length - 1]; if (l && l.f === x.f) l.e = x.e; else acc.push(Object.assign({}, x)); return acc; }, []);
  for (let guard = 0; guard < 5000 && B.length > 1; guard++) {
    let k = -1, md = 25; for (let i = 0; i < B.length; i++) { const d = dur(B[i]); if (d < md) { md = d; k = i; } }
    if (k < 0) break;
    const j = k === 0 ? 1 : k === B.length - 1 ? k - 1 : (dur(B[k - 1]) >= dur(B[k + 1]) ? k - 1 : k + 1), lo = Math.min(k, j), hi = Math.max(k, j);
    B.splice(lo, 2, { f: B[j].f, s: B[lo].s, e: B[hi].e }); B = join(B);
  }
  const seg = B.map((x, k) => { const e = k + 1 < B.length ? B[k + 1].s : n - 1, t = P[e][0] - P[x.s][0], m = P[e][1] - P[x.s][1]; let hs = 0, hn = 0; for (let i = x.s; i < Math.max(e, x.s + 1); i++) if (P[i][2]) { hs += P[i][2]; hn++; }
    return { k: x.f ? 'r' : (t > 0 && m / t < 1.75 ? 'w' : 'j'), t: Math.round(t), m: Math.round(m), h: hn ? Math.round(hs / hn) : 0 }; }).filter(x => x.t > 0);
  return seg.length >= 3 ? seg.slice(0, 80) : null;
}
function gRoles(seg, roles) { if (!seg) return seg; seg.forEach((x, i) => { delete x.p; if (roles && i < roles.a) x.p = 'e'; else if (roles && i > roles.b) x.p = 'a'; }); return seg; }
const msx = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + pad(s % 60); };
function gPlanned(d) { const T = S.training, w = T && T.weeks && T.weeks[weekStart(d)], a = w && w.d && w.d[wd(d)]; return Array.isArray(a) ? a : []; }
const GFIT = ['km', 'seg', 'lap', 'zb', 'mhr', 'rhr', 'ivx', 'cv', 'dc'];
function gFitParts(F, planI) {
  const o = {}, km = kmSplits(F.rec); if (km.length) o.km = km;
  let seg = gSegs(F);
  const laps = gLaps(F); if (laps.length > 1) o.lap = laps;
  const tz = F.msgs.find(m => m.n === 216 && m.f[0] === 18);
  if (tz) { if (Array.isArray(tz.f[6])) o.zb = tz.f[6].slice(0, 6); if (tz.f[11]) o.mhr = tz.f[11]; if (tz.f[12]) o.rhr = tz.f[12]; }
  let A = gAnalyze(laps, seg);
  if (!A.iv) {
    const ps = gPaceSegs(F.rec), B = ps ? gAnalyze([], ps, planI ? 2 : 3) : null;
    if (B && B.iv) { const part = ps.slice(B.roles.a, B.roles.b + 1), R = part.filter(x => x.k === 'r'), J = part.filter(x => x.k !== 'r'), sp = L => L.reduce((s, x) => s + x.m, 0) / Math.max(1, L.reduce((s, x) => s + x.t, 0));
      if (J.length && (sp(R) - sp(J)) / sp(R) >= 0.22) { seg = ps; A = B; } }
  }
  if (seg) o.seg = seg;
  gRoles(seg, A.roles); if (A.iv) o.ivx = A.iv;
  const cv = gCurve(F.rec); if (cv) o.cv = cv;
  if (!A.iv) { const dc = gDecouple(F.rec); if (dc != null) o.dc = dc; }
  return o;
}
function gRun(a, F, d) {
  const g = gBase(a), add = (k, v) => { if (v) g[k] = v; };
  add('cad', ri(a.averageRunningCadenceInStepsPerMinute)); add('asc', ri(a.elevationGain)); add('stl', ri(a.avgStrideLength)); add('vo2', ri(a.vO2MaxValue));
  const P = gPlanned(d), pI = P.includes('@I'), pL = P.includes('@L');
  if (F) Object.assign(g, gFitParts(F, pI));
  const iv = g.ivx || null;
  g.v = GV;
  const t = pI && !pL ? 'iv' : pL && !pI ? 'easy' : iv ? 'iv' : 'easy';
  const r = { id: 'g-' + g.id, t, dur: ri(a.duration), km: Math.round((+a.distance || 0) / 10) / 100, hr: ri(a.averageHR), max: ri(a.maxHR), g };
  if (t === 'iv') r.iv = iv || { p: 'own', n: 1, len: Math.max(1, Math.round(r.dur / 60)), u: 'min', pz: '', r: [{ v: r.km ? msx(r.dur / r.km) : '', h: r.hr }] };
  return r;
}
// schon importierte Läufe mit der aktuellen Erkennung neu auswerten (aus den gespeicherten Abschnitten, ohne Download).
// Typ und Intervalle ändern sich nur, wenn sie noch automatisch gesetzt waren – nicht, wenn du sie selbst geändert hast.
function gRedo(r, d, F) {
  const g = r && r.g; if (!g || g.v === GV) return null;
  let ng = JSON.parse(JSON.stringify(g)), A;
  if (F) { for (const k of GFIT) delete ng[k]; Object.assign(ng, gFitParts(F, gPlanned(d).includes('@I'))); A = { iv: ng.ivx || null }; }
  else { A = gAnalyze(ng.lap, ng.seg); gRoles(ng.seg, A.roles); if (A.iv) ng.ivx = A.iv; else delete ng.ivx; }
  ng.v = GV;
  const nr = Object.assign({}, r, { g: ng }), auto = r.t === 'iv' && g.ivx && JSON.stringify(r.iv) === JSON.stringify(g.ivx);
  if (auto) {
    if (A.iv) nr.iv = A.iv;
    else if (!gPlanned(d).includes('@I')) { nr.t = 'easy'; delete nr.iv; }
  }
  return nr;
}
async function gFix(d, id, F) {
  const mk = mkey(d);
  return retry(async () => {
    const md = await getDoc(mk); if (!md) return false;
    const obj = asObj(md), day = (obj.days || {})[d] || {}, runs = Array.isArray(day.run) ? day.run.slice() : [], i = runs.findIndex(r => r && r.id === id);
    if (i < 0) return false;
    const nr = gRedo(runs[i], d, F); if (!nr) return false;
    runs[i] = nr;
    await patchFields(mk, [[['days', d, 'run'], tval(runs)]], md.updateTime);
    obj.days[d] = Object.assign({}, day, { run: runs }); LOGS[mk] = obj;
    return true;
  });
}
function gOther(a, k) {
  const o = gBase(a); o.k = k; o.dur = ri(a.duration); o.hr = ri(a.averageHR); o.max = ri(a.maxHR);
  const km = Math.round((+a.distance || 0) / 10) / 100; if (km >= 0.1) o.km = km;
  return o;
}
// lokaler Merkzettel: wann zuletzt geprüft, Fehlerzustand. Ob eine Einheit schon da ist, entscheidet allein Sabrly
// (so kommt ein Import zurück, falls die App ihn beim gleichzeitigen Speichern überschrieben hat)
const gLP = () => { const fm = FileManager.local(); return fm.joinPath(fm.documentsDirectory(), 'sabrly-garmin.json'); };
function gLoad() { try { const fm = FileManager.local(), p = gLP(); const j = fm.fileExists(p) ? JSON.parse(fm.readString(p)) : null; if (j && typeof j === 'object') { delete j.ids; return j; } } catch (e) {} return {}; }
function gStore(o) { try { FileManager.local().writeString(gLP(), JSON.stringify(o)); } catch (e) {} }
function gKnownIn(day, id) {
  if (!day) return false;
  if ((day.run || []).some(r => r && (r.id === 'g-' + id || (r.g && String(r.g.id) === id)))) return true;
  if ((day.ga || []).some(x => x && String(x.id) === id)) return true;
  return Array.isArray(day.gdel) && day.gdel.map(String).includes(id);
}
function trHabitW(kind) {
  const T = S.training; if (!T) return null; const hs = S.habits.filter(h => !h.archived);
  if (kind === 'run') { if (T.rhabit === '-') return null; const r = hs.find(h => h.id === T.rhabit) || (!T.rhabit ? hs.find(h => /lauf|laufen|joggen|running/i.test(h.name)) : null); if (r) return r; }
  if (T.habit === '-') return null;
  return hs.find(h => h.id === T.habit) || (!T.habit ? hs.find(h => /training|gym|sport|workout|fitness|kraft/i.test(h.name)) : null) || null;
}
// eine Einheit in den Monat schreiben (frisch gelesen, mit Vorbedingung)
async function gWrite(d, kind, item) {
  const mk = mkey(d);
  return retry(async () => {
    const md = await getDoc(mk), obj = md ? asObj(md) : { days: {} }; if (!obj.days) obj.days = {};
    const day = obj.days[d] || {}, id = String(kind === 'run' ? item.g.id : item.id);
    if (gKnownIn(day, id)) return 'known';
    const ops = [];
    if (kind === 'run') {
      const runs = Array.isArray(day.run) ? day.run.slice() : [];
      // selbst eingetragener Lauf am selben Tag: Garmin-Werte übernehmen, Typ und Intervalle behalten
      const man = runs.map((r, i) => ({ r, i })).filter(x => x.r && !x.r.g);
      let hit = null;
      if (man.length) hit = man.slice().sort((x, y) => Math.abs((+x.r.km || 0) - item.km) - Math.abs((+y.r.km || 0) - item.km))[0];
      if (hit) {
        const o = hit.r, m = Object.assign({}, o, { dur: item.dur, km: item.km, hr: item.hr || o.hr || 0, max: item.max || o.max || 0, g: item.g });
        if (!(o.t === 'iv' && o.iv && (o.iv.r || []).some(x => x.v || x.h))) { m.t = item.t; if (item.iv) m.iv = item.iv; else delete m.iv; }
        runs[hit.i] = m;
      } else runs.push(item);
      ops.push([['days', d, 'run'], tval(runs)]);
    } else {
      const ga = Array.isArray(day.ga) ? day.ga.slice() : []; ga.push(item); ga.sort((x, y) => (x.ts || 0) - (y.ts || 0));
      ops.push([['days', d, 'ga'], tval(ga)]);
    }
    // Habit wie in der App abhaken – nur für heute und gestern, nicht beim Nachholen älterer Tage
    const hk = kind === 'run' ? 'run' : kind === 'str' ? 'tr' : null, h = hk ? trHabitW(hk) : null;
    let ticked = null;
    LOGS[mk] = obj;
    if (h && d <= today() && d >= addDays(today(), -1) && h.created <= d && !isDone(h, d)) { const nv = stepVal(h, d); ops.push([['days', d, 'h', h.id], tval(nv)]); ticked = h.name; }
    await patchFields(mk, ops, md ? md.updateTime : null);
    if (kind === 'run') obj.days[d] = Object.assign({}, day, { run: fv(ops[0][1]) }); else obj.days[d] = Object.assign({}, day, { ga: fv(ops[0][1]) });
    if (ticked) { obj.days[d].h = Object.assign({}, day.h || {}); obj.days[d].h[h.id] = fv(ops[ops.length - 1][1]); }
    LOGS[mk] = obj;
    return ticked ? 'ok:' + ticked : 'ok';
  });
}
function gLine(d, kind, x) {
  const dd = pdate(d), w = DN[wd(d)] + ' ' + dd.getDate() + '.' + (dd.getMonth() + 1) + '.';
  if (kind === 'run') return w + ' · ' + (x.t === 'iv' ? 'Intervalle' : 'Lauf') + ' ' + String(x.km).replace('.', ',') + ' km · ' + gDur(x.dur);
  return w + ' · ' + (x.k === 'str' ? 'Krafttraining' : (GTN[x.typ] || x.n)) + ' · ' + gDur(x.dur) + (x.hr ? ' · Ø ' + x.hr : '');
}
// Status für die App (eigenes Dokument „garmin“, das die App nur liest)
async function gStatus(L, patch) {
  const now = Date.now(), changed = (patch.err || '') !== (L.err || '');
  if (!changed && !patch.n && L.wrote && now - L.wrote < 3 * 3600e3) return;
  const o = { at: new Date(now).toISOString(), err: patch.err || '', n: (L.total || 0), last: (L.recent || []).slice(0, 6) };
  try { await patchFields('garmin', [[['at'], tval(o.at)], [['err'], tval(o.err)], [['n'], tval(o.n)], [['last'], tval(o.last)]]); L.wrote = now; } catch (e) {}
}
// force: in der App (alles Neue, ohne Wartezeit) · sonst im Widget: höchstens alle 20 min, 2 Einheiten
async function garminSync(force) {
  if (!kget(GK.key) || !kget(K.uid)) return null;
  const L = gLoad(), now = Date.now(), wait = L.err === 'key' ? 6 * 3600e3 : 20 * 60e3;
  if (!force && L.last && now - L.last < wait) return null;
  L.last = now; gStore(L);
  const res = { added: [], ticked: [], skipped: 0, err: '' }, t0 = Date.now();
  try {
    const list = await gJSON('/activitylist-service/activities/search/activities?start=0&limit=' + (force ? 40 : 10));
    if (list.status === 429) throw new Error('Garmin bremst gerade (zu viele Anfragen). Später nochmal.');
    if (list.status !== 200 || !Array.isArray(list.json)) throw new Error('Garmin-Liste: Status ' + list.status);
    const min = addDays(today(), -GDAYS), todo = [];
    for (const a of list.json) {
      const k = gClass(a), d = gDay(a), id = String(a.activityId || '');
      if (!k || !d || !id || d < min || d > today()) continue;
      if (gKnownIn(dayGet(d), id)) continue;
      todo.push({ a, k, d, id });
    }
    todo.reverse();
    for (const x of todo.slice(0, force ? 30 : 2)) {
      if (!force && Date.now() - t0 > 12000) break;
      let item;
      if (x.k === 'run') {
        let F = null;
        try { const r = await gReq('/download-service/files/activity/' + x.id, 'application/zip, application/x-zip-compressed, application/octet-stream', true);
          if (r.status === 200 && r.body) F = fitParse(unzipFit(r.body.getBytes()).bytes, n => n === 19 || n === 216 || n === 312, true); } catch (e) {}
        item = gRun(x.a, F, x.d);
      } else item = gOther(x.a, x.k);
      const w = await gWrite(x.d, x.k, item);
      if (w === 'known') { res.skipped++; continue; }
      res.added.push(gLine(x.d, x.k, item));
      if (/^ok:/.test(w)) res.ticked.push(w.slice(3));
    }
    // ältere Auswertung? neu auswerten (letzte 60 Tage)
    const fixes = [];
    for (let i = 0; i <= 60; i++) { const d = addDays(today(), -i); for (const r of ((dayGet(d) || {}).run || [])) if (r && r.g && r.g.id && r.g.v !== GV) fixes.push({ d, id: r.id, gid: String(r.g.id) }); }
    for (const f of fixes.slice(0, force ? 40 : 1)) {
      if (!force && Date.now() - t0 > 12000) break;
      let F = null;
      try { const r = await gReq('/download-service/files/activity/' + f.gid, 'application/zip, application/x-zip-compressed, application/octet-stream', true);
        if (r.status === 200 && r.body) F = fitParse(unzipFit(r.body.getBytes()).bytes, n => n === 19 || n === 216 || n === 312, true); } catch (e) {}
      if (await gFix(f.d, f.id, F)) res.fixed = (res.fixed || 0) + 1;
    }
    L.total = (L.total || 0) + res.added.length; L.recent = res.added.concat(L.recent || []).slice(0, 6);
    await gStatus(L, { n: res.added.length, err: '' }); L.err = '';
  } catch (e) {
    const m = String(e.message || e), ne = /^GKEY/.test(m) ? 'key' : 'net'; res.err = ne === 'key' ? 'key' : m;
    if (ne === 'key' || L.err === 'key') await gStatus(L, { err: ne });
    L.err = ne;
  }
  gStore(L);
  return res;
}
async function garminAuto() { try { await garminSync(false); } catch (e) {} }
async function garminNow() {
  const r = await garminSync(true);
  if (!r) return;
  if (r.err === 'key') {
    const a = new Alert(); a.title = 'Schlüssel abgelehnt'; a.message = 'Garmin nimmt den Schlüssel nicht mehr an. Vermutlich ist er abgelaufen. Erstelle in Garmin Connect einen neuen und gib ihn hier ein.';
    a.addAction('Neuen Schlüssel eingeben'); a.addCancelAction('Abbrechen');
    if (await a.presentAlert() === 0 && await garminAskKey()) return garminNow();
    return;
  }
  if (r.err) { await info('Garmin', 'Abruf hat nicht geklappt.\n(' + r.err + ')'); return; }
  const fx = r.fixed ? '\n\n' + r.fixed + (r.fixed === 1 ? ' Lauf' : ' Läufe') + ' neu ausgewertet.' : '';
  const msg = (r.added.length ? r.added.join('\n') + (r.ticked.length ? '\n\nAbgehakt: ' + r.ticked.filter((v, i, s) => s.indexOf(v) === i).join(', ') : '') + '\n\nIn Sabrly unter Training zu sehen.'
    : 'Alle Trainings der letzten ' + GDAYS + ' Tage sind schon in Sabrly.') + fx;
  await info(r.added.length ? '⌚ ' + r.added.length + (r.added.length === 1 ? ' Einheit' : ' Einheiten') + ' übernommen' : '⌚ Nichts Neues', msg);
}
async function garminMenu() {
  if (!kget(GK.key)) { if (await garminAskKey()) return garminNow(); return; }
  const L = gLoad(), a = new Alert(); a.title = '⌚ Garmin';
  a.message = 'Neue Läufe und Trainings kommen automatisch in Sabrly, sobald das Widget aktualisiert. ' + (L.last ? 'Zuletzt geprüft: ' + pad(new Date(L.last).getHours()) + ':' + pad(new Date(L.last).getMinutes()) + ' Uhr.' : '') + '\nDein Schlüssel bleibt auf diesem iPhone.';
  a.addAction('Jetzt abrufen'); a.addAction('Bericht für Claude (Test)'); a.addAction('Schlüssel ersetzen'); a.addDestructiveAction('Schlüssel löschen'); a.addCancelAction('Abbrechen');
  const i = await a.presentAlert();
  if (i === 0) return garminNow();
  if (i === 1) return garminTest();
  if (i === 2) { if (await garminAskKey()) return garminNow(); return; }
  if (i === 3) { garminForget(); await info('Gelöscht', 'Der Garmin-Schlüssel ist von diesem iPhone entfernt. Bereits übernommene Trainings bleiben in Sabrly.'); }
}

async function main() {
  const inWidget = config.runsInWidget || config.runsInAccessoryWidget;
  if (inWidget) {
    const fam = config.widgetFamily || 'medium';
    const w = await getWidget(fam, args.widgetParameter);
    const np = nextPrayerAt();
    w.refreshAfterDate = new Date(Math.min(Date.now() + 15 * 60 * 1000, np ? np + 60 * 1000 : Infinity));
    Script.setWidget(w);
    return;
  }
  const st = shortcutText();
  if (st) { await shortcutRun(st); return; }
  // in der Scriptable-App: anmelden, Aktion vom Widget ausführen oder Vorschau zeigen
  if (!kget(K.refresh)) { if (!(await login())) return; }
  // Tipp auf eine Adhan-Mitteilung: kurz nachfragen
  const N = args.notification, ui = N && N.userInfo;
  if (ui && ui.sabrly === 'p') {
    const a = new Alert(); a.title = '🕌 ' + String(N.title || 'Gebet').replace(/^🕌\s*/, ''); a.message = 'Hast du gebetet?';
    a.addAction('Gebetet ✓'); a.addCancelAction('Später');
    if (await a.presentAlert() === 0) return prayerFromNotif(String(ui.d), +ui.i);
    return;
  }
  if (ui && ui.sabrly === 'w') {
    const a = new Alert(); a.title = '📅 Woche planen'; a.message = String(N.body || '') + '\n\nDie Planung machst du in Sabrly: Training → Woche planen → Nächste.';
    a.addAction('OK'); await a.presentAlert(); return;
  }
  const P = (args && args.queryParameters) || {};
  if (P.a) return handleLink(P);
  // Daten laden und Adhan-Mitteilungen planen (beim ersten Mal fragt iOS nach der Erlaubnis)
  try { await loadAll(); } catch (e) {}
  const a = new Alert();
  a.title = 'Sabrly-Widget';
  a.message = 'Angemeldet als ' + (kget(K.email) || '…') + '.\nWähle eine Vorschau oder füge das Widget auf dem Home-Bildschirm hinzu.';
  const opts = [['Heute (groß)', 'large', 'heute'], ['Heute (mittel)', 'medium', 'heute'], ['Woche (mittel)', 'medium', 'woche'], ['Habit (klein)', 'small', 'habit'],
    ['Übersicht (klein)', 'small', ''], ['Aufgaben (mittel)', 'medium', 'aufgaben'], ['Vers (mittel)', 'medium', 'vers'], ['Vers (groß)', 'large', 'vers'], ['Monat (mittel)', 'medium', 'monat'],
    ['Monat (groß)', 'large', 'monat'], ['Serie (klein)', 'small', 'serie'], ['Stimmung (klein)', 'small', 'stimmung'], ['Sperrbildschirm', 'accessoryRectangular', '']];
  a.addAction('✓  Heute abhaken');
  a.addAction('⌚  Garmin');
  for (const [l] of opts) a.addAction('Vorschau: ' + l);
  a.addDestructiveAction('Abmelden');
  a.addCancelAction('Fertig');
  const i = await a.presentAlert();
  if (i === -1) return;
  if (i === 0) return pickToday();
  if (i === 1) return garminMenu();
  if (i === opts.length + 2) { logout(); await info('Abgemeldet', 'Das Widget zeigt nichts mehr an, bis du dich wieder anmeldest.'); return; }
  const [, fam, param] = opts[i - 2];
  await present(await getWidget(fam, param), fam);
}
await main();
Script.complete();
