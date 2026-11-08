// SABRLY_WIDGET v5
// Sabrly-Widget für die App „Scriptable“.
// Einmal in Scriptable ausführen → anmelden. Danach als Widget hinzufügen.
// Ein Tipp auf das Widget öffnet kurz Scriptable und trägt direkt in Sabrly ein (ohne Safari).
// Welches Widget erscheint, steuerst du über das Feld „Parameter“ in den Widget-Einstellungen:
//   (leer)        Übersicht: Tagesring, Habits, Woche
//   woche         Wochenraster: jeder Habit mit Häkchen pro Tag
//   habit: Lesen  ein einzelner Habit zum Abhaken (Name aus Sabrly)
//   stimmung      Stimmung des Tages
//   aufgaben      offene Aufgaben

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
    settings: { dayStart: Math.max(0, Math.min(6, +((s.settings || {}).dayStart) || 0)), userName: String((s.settings || {}).userName || '') }
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
function logout() { for (const k of Object.values(K)) if (Keychain.contains(k)) Keychain.remove(k); const fm = FileManager.local(), p = cachePath(); if (fm.fileExists(p)) fm.remove(p); }
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
async function undo(u) { await patchField(u.doc, u.segs, u.val, u.pre); }

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
function statusText(i) { return i.done ? '✓' : (i.T > 1 ? i.v + '/' + i.T : ''); }
function greeting(name) { const h = new Date().getHours(); const g = h >= 5 && h < 11 ? 'Guten Morgen' : h >= 17 && h < 23 ? 'Guten Abend' : 'Hallo'; return name ? g + ', ' + name : g; }
function dateLine(t) { const d = pdate(t); return DL[wd(t)] + ', ' + d.getDate() + '. ' + MN[d.getMonth()]; }
function weekTitle(ws, we) { const a = pdate(ws), b = pdate(we); return a.getMonth() === b.getMonth() ? MS[a.getMonth()] + ' ' + a.getDate() + '–' + b.getDate() : MS[a.getMonth()] + ' ' + a.getDate() + ' – ' + MS[b.getMonth()] + ' ' + b.getDate(); }

/* ---------- Übersicht (Standard) ---------- */
function habitRows(stack, m, max, fs) {
  const list = m.items.slice(0, max);
  list.forEach((i, idx) => {
    if (idx) stack.addSpacer(fs > 13 ? 6 : 4);
    const row = stack.addStack(); row.layoutHorizontally(); row.centerAlignContent();
    if (!i.done && !i.td) row.url = run({ a: 'tick', h: i.id });
    txt(row, i.emoji, Font.systemFont(fs), COL.fg); row.addSpacer(6);
    txt(row, i.name, Font.semiboldSystemFont(fs), i.done ? COL.muted : COL.fg); row.addSpacer(6);
    const st = statusText(i);
    if (st) txt(row, st, i.done ? Font.boldSystemFont(fs) : Font.mediumRoundedSystemFont(fs - 1), i.done ? COL.accent : COL.muted);
  });
  if (m.items.length > max) { stack.addSpacer(4); txt(stack, '+' + (m.items.length - max) + ' weitere', Font.mediumSystemFont(fs - 2), COL.muted); }
  if (!m.items.length) txt(stack, 'Heute keine Habits geplant', Font.mediumSystemFont(fs), COL.muted, 2);
}
function weekBars(stack, m, h) {
  const row = stack.addStack(); row.layoutHorizontally(); row.bottomAlignContent();
  m.week.forEach((d, idx) => {
    if (idx) row.addSpacer();
    const col = row.addStack(); col.layoutVertically(); col.centerAlignContent();
    const track = col.addStack(); track.size = new Size(18, h); track.cornerRadius = 6; track.layoutVertically();
    track.backgroundColor = d.fut ? COL.chip : COL.track;
    const bh = Math.round(h * d.p);
    if (bh > 0) { track.addSpacer(); const bar = track.addStack(); bar.size = new Size(18, Math.max(6, bh)); bar.cornerRadius = 6; bar.backgroundColor = COL.accent; }
    else track.addSpacer();
    col.addSpacer(4);
    txt(col, d.label, d.today ? Font.boldSystemFont(10) : Font.mediumSystemFont(10), d.today ? COL.fg : COL.muted);
  });
}
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
function medium(m, data, stale) {
  const w = new ListWidget(); base(w, 'medium'); w.setPadding(14, 16, 12, 16);
  const row = w.addStack(); row.layoutHorizontally();
  const left = row.addStack(); left.layoutVertically(); left.size = new Size(104, 0);
  txt(left, 'SABRLY', Font.heavySystemFont(10), COL.accent); left.addSpacer(6);
  const ri = left.addImage(ringImage(m.score, 200, 18, 38)); ri.imageSize = new Size(92, 92);
  left.addSpacer(6);
  txt(left, m.best > 0 ? '🔥 ' + m.best + ' Tage' : m.done + '/' + m.total + ' erledigt', Font.semiboldSystemFont(12), COL.fg);
  row.addSpacer(14);
  const right = row.addStack(); right.layoutVertically();
  txt(right, 'Heute', Font.boldSystemFont(17), COL.fg);
  txt(right, dateLine(m.t), Font.mediumSystemFont(11), COL.muted);
  right.addSpacer(8);
  habitRows(right, m, 4, 13);
  right.addSpacer();
  footer(right, data, stale);
  return w;
}
function large(m, data, stale) {
  const w = new ListWidget(); base(w, 'large'); w.setPadding(16, 18, 14, 18);
  const head = w.addStack(); head.layoutHorizontally(); head.centerAlignContent();
  const hl = head.addStack(); hl.layoutVertically();
  txt(hl, 'SABRLY', Font.heavySystemFont(10), COL.accent);
  txt(hl, greeting(m.name), Font.boldSystemFont(19), COL.fg);
  txt(hl, dateLine(m.t), Font.mediumSystemFont(12), COL.muted);
  head.addSpacer();
  const ri = head.addImage(ringImage(m.score, 160, 14, 30)); ri.imageSize = new Size(66, 66);
  w.addSpacer(12);
  const hab = w.addStack(); hab.layoutVertically();
  habitRows(hab, m, 6, 14);
  w.addSpacer();
  const wk = w.addStack(); wk.layoutVertically();
  const wh = wk.addStack(); wh.layoutHorizontally();
  txt(wh, 'Diese Woche', Font.boldSystemFont(12), COL.fg); wh.addSpacer();
  if (m.best > 0) txt(wh, '🔥 ' + m.best + ' Tage Serie', Font.semiboldSystemFont(11), COL.muted);
  wk.addSpacer(6);
  weekBars(wk, m, 44);
  if (m.quote) { w.addSpacer(10); const q = txt(w, '„' + m.quote.t + '“' + (m.quote.src ? ' · ' + m.quote.src : ''), Font.italicSystemFont(12), COL.muted, 2); q.minimumScaleFactor = 0.85; }
  w.addSpacer(6);
  footer(w, data, stale);
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
  if (!l || ['übersicht', 'uebersicht', 'heute'].includes(l)) return { v: 'overview' };
  if (['woche', 'week', 'wochenraster'].includes(l)) return { v: 'week' };
  if (['aufgaben', 'aufgabe', 'todos', 'todo'].includes(l)) return { v: 'todos' };
  if (['stimmung', 'mood'].includes(l)) return { v: 'mood' };
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
  if (V.v === 'week') return weekWidget(fam, data, stale);
  if (V.v === 'habit') return habitWidget(fam, data, stale, V.q);
  if (V.v === 'mood') return moodWidget(fam, data, stale);
  if (V.v === 'todos') return todoWidget(fam, data, stale);
  if (fam === 'small') return small(m, data, stale);
  if (fam === 'large' || fam === 'extraLarge') return large(m, data, stale);
  return medium(m, data, stale);
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
async function loadAll() { const d = await loadRemote(); if (!d.state) throw new Error('NODATA'); saveCache(d); S = normalizeState(d.state); LOGS = d.logs || {}; return d; }
const openToday = t => active(t).filter(h => !isDone(h, t) && !(h.freq === 'weekly' && weekCount(h, weekStart(t), t) >= h.target));
function habitLabel(h, t) {
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
async function handleLink(P) {
  if (P.a === 'tick' && P.h) return showResult(await act(() => actTick(P.h)));
  if (P.a === 'todo' && P.t) return showResult(await act(() => actTodo(P.t)));
  if (P.a === 'mood' && P.v) return showResult(await act(() => actMood(P.v)));
  if (P.a === 'mood') return pickMood();
  if (P.a === 'aufgaben') return pickTodo();
  return pickToday();
}
async function main() {
  const inWidget = config.runsInWidget || config.runsInAccessoryWidget;
  if (inWidget) {
    const fam = config.widgetFamily || 'medium';
    const w = await getWidget(fam, args.widgetParameter);
    w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
    Script.setWidget(w);
    return;
  }
  const st = shortcutText();
  if (st) { await shortcutRun(st); return; }
  // in der Scriptable-App: anmelden, Aktion vom Widget ausführen oder Vorschau zeigen
  if (!kget(K.refresh)) { if (!(await login())) return; }
  const P = (args && args.queryParameters) || {};
  if (P.a) return handleLink(P);
  const a = new Alert();
  a.title = 'Sabrly-Widget';
  a.message = 'Angemeldet als ' + (kget(K.email) || '…') + '.\nWähle eine Vorschau oder füge das Widget auf dem Home-Bildschirm hinzu.';
  const opts = [['Übersicht (mittel)', 'medium', ''], ['Woche (mittel)', 'medium', 'woche'], ['Habit (klein)', 'small', 'habit'], ['Stimmung (klein)', 'small', 'stimmung'],
    ['Aufgaben (mittel)', 'medium', 'aufgaben'], ['Übersicht (groß)', 'large', ''], ['Übersicht (klein)', 'small', ''], ['Sperrbildschirm', 'accessoryRectangular', '']];
  a.addAction('✓  Heute abhaken');
  for (const [l] of opts) a.addAction('Vorschau: ' + l);
  a.addDestructiveAction('Abmelden');
  a.addCancelAction('Fertig');
  const i = await a.presentAlert();
  if (i === -1) return;
  if (i === 0) return pickToday();
  if (i === opts.length + 1) { logout(); await info('Abgemeldet', 'Das Widget zeigt nichts mehr an, bis du dich wieder anmeldest.'); return; }
  const [, fam, param] = opts[i - 1];
  await present(await getWidget(fam, param), fam);
}
await main();
Script.complete();
