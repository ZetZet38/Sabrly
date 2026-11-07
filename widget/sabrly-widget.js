// SABRLY_WIDGET v1
// Sabrly-Widget für die App „Scriptable“.
// Liest deine Sabrly-Daten aus Firebase und zeigt Tagesfortschritt, Habits, Woche und Tagesspruch.
// Einmal in Scriptable ausführen → anmelden. Danach als Widget auf dem Home- oder Sperrbildschirm hinzufügen.

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
  amber: new Color('#F2A93B'), crit: new Color('#FF5F6D')
};
const DN = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const DL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const MN = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

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
  return {
    habits, todos: Array.isArray(s.todos) ? s.todos : [], quotes: Array.isArray(s.quotes) ? s.quotes : [],
    settings: { dayStart: Math.max(0, Math.min(6, +((s.settings || {}).dayStart) || 0)), userName: String((s.settings || {}).userName || '') }
  };
}

function model() {
  const t = today(), hs = active(t);
  const items = hs.map(h => ({
    emoji: h.emoji, name: h.name, time: h.time, weekly: h.freq === 'weekly', done: h.freq === 'weekly' ? weekCount(h, weekStart(t), t) >= h.target : isDone(h, t),
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

/* ---------- Darstellung ---------- */
const hhmm = ms => { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
function ringImage(p, size, lw, fontSize) {
  const ctx = new DrawContext(); ctx.size = new Size(size, size); ctx.opaque = false; ctx.respectScreenScale = true;
  const r = size / 2 - lw / 2 - 1, cx = size / 2, cy = size / 2;
  ctx.setStrokeColor(COL.track); ctx.setLineWidth(lw); ctx.strokeEllipse(new Rect(cx - r, cy - r, 2 * r, 2 * r));
  if (p > 0) {
    const path = new Path(), n = Math.max(2, Math.ceil(140 * p));
    for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + 2 * Math.PI * Math.min(p, 0.9999) * i / n, pt = new Point(cx + r * Math.cos(a), cy + r * Math.sin(a)); if (i === 0) path.move(pt); else path.addLine(pt); }
    ctx.addPath(path); ctx.setStrokeColor(COL.accent); ctx.setLineWidth(lw); ctx.strokePath();
    ctx.setFillColor(COL.accent);
    for (const a of [-Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * Math.min(p, 0.9999)]) ctx.fillEllipse(new Rect(cx + r * Math.cos(a) - lw / 2, cy + r * Math.sin(a) - lw / 2, lw, lw));
  }
  if (fontSize) {
    ctx.setFont(Font.boldRoundedSystemFont(fontSize)); ctx.setTextColor(COL.fg); ctx.setTextAlignedCenter();
    const th = fontSize * 1.3; ctx.drawTextInRect(Math.round(p * 100) + '%', new Rect(0, cy - th / 2, size, th));
  }
  return ctx.getImage();
}
function base(w) {
  const g = new LinearGradient(); g.colors = [COL.top, COL.bottom]; g.locations = [0, 1];
  g.startPoint = new Point(0.5, 0); g.endPoint = new Point(0.5, 1);
  w.backgroundGradient = g; w.url = CFG.appUrl;
}
function txt(stack, s, font, color, lines) { const t = stack.addText(s); t.font = font; t.textColor = color || COL.fg; t.lineLimit = lines || 1; t.minimumScaleFactor = 0.75; return t; }
function centered(stack, img, size) { const row = stack.addStack(); row.layoutHorizontally(); row.addSpacer(); const i = row.addImage(img); i.imageSize = new Size(size, size); row.addSpacer(); return row; }
function footer(stack, data, stale) { txt(stack, (stale ? 'Offline · ' : '') + 'Stand ' + hhmm(data.at), Font.mediumSystemFont(10), COL.faint); }
function statusText(i) { return i.done ? '✓' : (i.T > 1 ? i.v + '/' + i.T : ''); }
function habitRows(stack, m, max, fs) {
  const list = m.items.slice(0, max);
  list.forEach((i, idx) => {
    if (idx) stack.addSpacer(fs > 13 ? 6 : 4);
    const row = stack.addStack(); row.layoutHorizontally(); row.centerAlignContent();
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
function greeting(name) { const h = new Date().getHours(); const g = h >= 5 && h < 11 ? 'Guten Morgen' : h >= 17 && h < 23 ? 'Guten Abend' : 'Hallo'; return name ? g + ', ' + name : g; }
function dateLine(t) { const d = pdate(t); return DL[wd(t)] + ', ' + d.getDate() + '. ' + MN[d.getMonth()]; }

function small(m, data, stale) {
  const w = new ListWidget(); base(w); w.setPadding(14, 14, 12, 14);
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
  const w = new ListWidget(); base(w); w.setPadding(14, 16, 12, 16);
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
  const w = new ListWidget(); base(w); w.setPadding(16, 18, 14, 18);
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
function accCircular(m) { const w = new ListWidget(); w.addAccessoryWidgetBackground = true; w.url = CFG.appUrl; centered(w, ringImage(m.score, 120, 12, 26), 58); return w; }
function accRect(m) {
  const w = new ListWidget(); w.url = CFG.appUrl;
  txt(w, 'Sabrly · ' + Math.round(m.score * 100) + '%', Font.boldSystemFont(14), Color.white());
  txt(w, m.total ? m.done + ' von ' + m.total + ' Habits erledigt' : 'Heute keine Habits', Font.mediumSystemFont(12), Color.white());
  if (m.best > 0) txt(w, '🔥 ' + m.best + ' Tage Serie', Font.mediumSystemFont(12), Color.white());
  return w;
}
function accInline(m) { const w = new ListWidget(); w.url = CFG.appUrl; txt(w, 'Sabrly ' + Math.round(m.score * 100) + '% · ' + (m.total - m.done) + ' offen', Font.mediumSystemFont(12), Color.white()); return w; }
function messageWidget(fam, title, msg) {
  const w = new ListWidget(); if (!String(fam).startsWith('accessory')) { base(w); w.setPadding(14, 14, 14, 14); }
  txt(w, 'SABRLY', Font.heavySystemFont(10), COL.accent); w.addSpacer(6);
  txt(w, title, Font.boldSystemFont(14), COL.fg, 2); w.addSpacer(4);
  txt(w, msg, Font.mediumSystemFont(11), COL.muted, 4);
  return w;
}
function build(fam, data, stale) {
  S = normalizeState(data.state); LOGS = data.logs || {};
  const m = model();
  if (fam === 'accessoryCircular') return accCircular(m);
  if (fam === 'accessoryRectangular') return accRect(m);
  if (fam === 'accessoryInline') return accInline(m);
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
async function getWidget(fam) {
  let data = null, stale = false;
  try { data = await loadRemote(); if (!data.state) return messageWidget(fam, 'Noch keine Daten', 'Öffne Sabrly und lege einen Habit an.'); saveCache(data); }
  catch (e) {
    if (String(e.message) === 'LOGIN') return messageWidget(fam, 'Anmeldung nötig', 'Öffne Scriptable, tippe auf das Sabrly-Skript und melde dich an.');
    data = readCache(); stale = true;
    if (!data) return messageWidget(fam, 'Keine Verbindung', 'Das Widget lädt deine Daten, sobald du online bist.');
  }
  return build(fam, data, stale);
}
async function main() {
  const inWidget = config.runsInWidget || config.runsInAccessoryWidget;
  if (inWidget) {
    const fam = config.widgetFamily || 'medium';
    const w = await getWidget(fam);
    w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
    Script.setWidget(w);
    return;
  }
  // in der Scriptable-App: anmelden bzw. Vorschau
  if (!kget(K.refresh)) { if (!(await login())) return; }
  const a = new Alert();
  a.title = 'Sabrly-Widget';
  a.message = 'Angemeldet als ' + (kget(K.email) || '…') + '.\nWähle eine Vorschau oder füge das Widget auf dem Home-Bildschirm hinzu.';
  const opts = [['Vorschau klein', 'small'], ['Vorschau mittel', 'medium'], ['Vorschau groß', 'large'], ['Vorschau Sperrbildschirm', 'accessoryRectangular']];
  for (const [l] of opts) a.addAction(l);
  a.addDestructiveAction('Abmelden');
  a.addCancelAction('Fertig');
  const i = await a.presentAlert();
  if (i === -1) return;
  if (i === opts.length) { logout(); await info('Abgemeldet', 'Das Widget zeigt nichts mehr an, bis du dich wieder anmeldest.'); return; }
  const fam = opts[i][1];
  await present(await getWidget(fam), fam);
}
await main();
Script.complete();
