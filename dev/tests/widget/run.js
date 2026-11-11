// Strict mock of the Scriptable API: any unknown property access/assignment throws,
// so typos or non-existent methods surface here instead of on the iPhone.
const fs = require('fs');
const path = require('path');
const WIDGET = process.argv[2], LOADER = process.argv[3];
const results = []; const ok = (n, c, i = '') => results.push((c ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : ''));

function strict(name, obj) {
  return new Proxy(obj, {
    get(t, p) { if (typeof p === 'symbol' || p === 'then' || p === 'toJSON' || p === 'inspect' || p === 'constructor') return t[p]; if (!(p in t)) throw new Error(name + '.' + String(p) + ' existiert nicht'); return t[p]; },
    set(t, p, v) { if (!(p in t)) throw new Error(name + '.' + String(p) + ' kann nicht gesetzt werden'); t[p] = v; return true; }
  });
}
function makeEnv(opts) {
  const texts = [], images = [], urls = [], opened = [], placed = [];
  const withUrl = o => { let u = null; Object.defineProperty(o, 'url', { get: () => u, set: v => { if (typeof v !== 'string') throw new Error('url muss String sein'); u = v; urls.push(v); }, enumerable: true, configurable: true }); return o; }; const keychain = new Map(opts.keychain || []); const files = new Map(opts.files || []);
  const env = {};
  env.Color = function (hex, a) { if (!(this instanceof env.Color)) throw new Error('Color ohne new'); if (!/^#?[0-9a-fA-F]{6}$/.test(hex)) throw new Error('Color hex ungültig ' + hex); this.hex = hex; this.alpha = a == null ? 1 : a; };
  env.Color.white = () => new env.Color('#FFFFFF'); env.Color.black = () => new env.Color('#000000'); env.Color.clear = () => new env.Color('#000000', 0);
  const fontNames = ['systemFont', 'boldSystemFont', 'mediumSystemFont', 'semiboldSystemFont', 'heavySystemFont', 'blackSystemFont', 'lightSystemFont', 'italicSystemFont', 'regularRoundedSystemFont', 'boldRoundedSystemFont', 'mediumRoundedSystemFont', 'semiboldRoundedSystemFont', 'heavyRoundedSystemFont', 'regularMonospacedSystemFont', 'boldMonospacedSystemFont'];
  const Font = function (name, size) { if (!new.target) throw new Error('Font ohne new'); if (typeof name !== 'string' || typeof size !== 'number') throw new Error('new Font(name, size) falsch'); this.f = name; this.s = size; };
  for (const f of fontNames) Font[f] = s => { if (typeof s !== 'number') throw new Error('Font size fehlt'); return { f, s }; };
  env.Font = strict('Font', Font);
  env.Size = function (w, h) { this.width = w; this.height = h; };
  env.Point = function (x, y) { this.x = x; this.y = y; };
  env.Rect = function (x, y, w, h) { if ([x, y, w, h].some(v => typeof v !== 'number' || isNaN(v))) throw new Error('Rect NaN'); this.x = x; this.y = y; this.width = w; this.height = h; };
  env.Path = function () { return strict('Path', { move() {}, addLine() {}, addRoundedRect() {}, addRect() {}, addEllipse() {}, addCurve() {}, addQuadCurve() {}, closeSubpath() {} }); };
  env.DrawContext = function () { return strict('DrawContext', { size: null, opaque: true, respectScreenScale: false, setStrokeColor() {}, setFillColor() {}, setLineWidth() {}, strokeEllipse() {}, fillEllipse() {}, strokeRect() {}, fillRect() {}, addPath() {}, strokePath() {}, fillPath() {}, setFont() {}, setTextColor() {}, setTextAlignedCenter() {}, setTextAlignedLeft() {}, setTextAlignedRight() {}, drawTextInRect(s) { texts.push('ring:' + s); }, drawText() {}, getImage() { const i = { img: true }; images.push(i); return i; } }); };
  env.LinearGradient = function () { return strict('LinearGradient', { colors: [], locations: [], startPoint: null, endPoint: null }); };
  const wtext = s => strict('WidgetText', withUrl({ text: s, font: null, textColor: null, lineLimit: 0, minimumScaleFactor: 1, textOpacity: 1, shadowColor: null, shadowRadius: 0, shadowOffset: null, centerAlignText() {}, leftAlignText() {}, rightAlignText() {} }));
  const wimage = () => { placed.push(1); return strict('WidgetImage', withUrl({ image: null, imageSize: null, tintColor: null, cornerRadius: 0, imageOpacity: 1, resizable: true, containerRelativeShape: false, applyFittingContentMode() {}, applyFillingContentMode() {}, centerAlignImage() {}, leftAlignImage() {}, rightAlignImage() {} })); };
  function stackObj(name, extra) {
    const o = { backgroundColor: null, backgroundImage: null, backgroundGradient: null, spacing: 0, size: null, cornerRadius: 0, borderWidth: 0, borderColor: null,
      addText(s) { if (typeof s !== 'string') throw new Error('addText braucht String, bekam ' + typeof s); texts.push(s); return wtext(s); },
      addImage(i) { if (!i || !i.img) throw new Error('addImage ohne Bild'); return wimage(); },
      addStack() { return stackObj('WidgetStack'); }, addSpacer(n) { if (n != null && (typeof n !== 'number' || isNaN(n))) throw new Error('addSpacer NaN'); return {}; }, addDate() { return wtext('date'); },
      setPadding(a, b, c, d) { if ([a, b, c, d].some(v => typeof v !== 'number')) throw new Error('setPadding braucht 4 Zahlen'); },
      layoutHorizontally() {}, layoutVertically() {}, topAlignContent() {}, centerAlignContent() {}, bottomAlignContent() {}, useDefaultPadding() {} , ...extra };
    return strict(name, withUrl(o));
  }
  let presented = null, setW = null;
  const listWidget = () => stackObj('ListWidget', { refreshAfterDate: null, addAccessoryWidgetBackground: false,
    presentSmall() { presented = 'small'; }, presentMedium() { presented = 'medium'; }, presentLarge() { presented = 'large'; }, presentExtraLarge() { presented = 'extraLarge'; },
    presentAccessoryCircular() { presented = 'accessoryCircular'; }, presentAccessoryRectangular() { presented = 'accessoryRectangular'; }, presentAccessoryInline() { presented = 'accessoryInline'; } });
  env.ListWidget = function () { return listWidget(); };
  env.Keychain = strict('Keychain', { contains: k => keychain.has(k), get: k => { if (!keychain.has(k)) throw new Error('Keychain.get ohne Wert ' + k); return keychain.get(k); }, set: (k, v) => { if (typeof v !== 'string') throw new Error('Keychain.set braucht String: ' + k); keychain.set(k, v); }, remove: k => keychain.delete(k) });
  const fmObj = strict('FileManager', { documentsDirectory: () => '/docs', joinPath: (a, b) => a + '/' + b, fileExists: p => files.has(p), readString: p => files.get(p), writeString: (p, s) => files.set(p, s), remove: p => files.delete(p) });
  env.FileManager = strict('FileManagerStatic', { local: () => fmObj, iCloud: () => fmObj });
  const alerts = opts.alerts || []; const shownAlerts = [];
  env.Alert = function () { const st = { title: '', message: '', fields: [], actions: [] };
    return strict('Alert', { get title() { return st.title; }, set title(v) { st.title = v; }, get message() { return st.message; }, set message(v) { st.message = v; },
      addTextField(p, t) { st.fields.push(t || ''); }, addSecureTextField(p, t) { st.fields.push(t || ''); }, addAction(l) { st.actions.push(l); }, addDestructiveAction(l) { st.actions.push(l); }, addCancelAction() {},
      async presentAlert() { shownAlerts.push(st.title); (opts.alertLog || []).push({ title: st.title, message: st.message, actions: st.actions.slice() }); const a = alerts.shift(); if (!a) return -1; if (a.fields) st.fields = a.fields; return a.index; }, async present() { return this.presentAlert(); }, textFieldValue(i) { return st.fields[i]; } }); };
  const reqLog = [];
  env.Request = function (url) { const r = { url, method: 'GET', headers: {}, body: null, timeoutInterval: 60, response: null,
      async loadJSON() { reqLog.push(r.method + ' ' + r.url.split('?')[0]); (opts.fullLog || []).push(r.method + ' ' + r.url); const res = await opts.route(r); r.response = { statusCode: res.status }; if (res.throw) throw new Error('network'); return res.json; },
      async loadString() { reqLog.push(r.method + ' ' + r.url.split('?')[0]); (opts.fullLog || []).push(r.method + ' ' + r.url); const res = await opts.route(r); r.response = { statusCode: res.status }; if (res.throw) throw new Error('network'); return res.text != null ? res.text : (res.json !== undefined ? JSON.stringify(res.json) : ''); },
      async load() { reqLog.push(r.method + ' ' + r.url.split('?')[0]); (opts.fullLog || []).push(r.method + ' ' + r.url); const res = await opts.route(r); r.response = { statusCode: res.status }; if (res.throw) throw new Error('network'); const b = res.bytes || []; return strict('Data', { getBytes: () => Array.from(b), toRawString: () => Buffer.from(b).toString('utf8') }); } };
    return strict('Request', r); };
  env.config = strict('config', { runsInWidget: !!opts.inWidget, runsInAccessoryWidget: !!opts.inAccessory, runsInApp: !opts.inWidget && !opts.inAccessory, runsWithSiri: !!opts.siri, runsInActionExtension: false, runsInNotification: false, runsFromHomeScreen: false, widgetFamily: opts.family || null });
  env.args = strict('args', { widgetParameter: opts.param == null ? null : opts.param, queryParameters: opts.query || {}, shortcutParameter: opts.sp === undefined ? null : opts.sp, plainTexts: opts.texts || [], notification: opts.notification || null });
  if (opts.now) { const NOW = opts.now; env.Date = class extends Date { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } }; }
  const notifs = opts.notifs || [], removed = opts.removed || [];
  env.Notification = class { constructor() { Object.assign(this, { identifier: null, title: '', body: '', subtitle: '', threadIdentifier: '', sound: null, userInfo: {}, openURL: null, scriptName: '', _at: null, _actions: [] }); return strict('Notification', this); }
    setTriggerDate(d) { if (!(d instanceof Date) || isNaN(d)) throw new Error('setTriggerDate braucht Date'); this._at = d.getTime(); }
    addAction(title, url) { if (typeof title !== 'string' || typeof url !== 'string') throw new Error('addAction(title, url)'); this._actions.push([title, url]); }
    async schedule() { if (!this.identifier || !this._at) throw new Error('schedule ohne id/Zeit'); const i = notifs.findIndex(n => n.id === this.identifier); const o = { id: this.identifier, at: this._at, title: this.title, body: this.body, actions: this._actions, userInfo: this.userInfo }; if (i >= 0) notifs[i] = o; else notifs.push(o); }
    static removePending(ids) { if (!Array.isArray(ids)) throw new Error('removePending braucht Array'); removed.push(...ids); for (const id of ids) { const i = notifs.findIndex(n => n.id === id); if (i >= 0) notifs.splice(i, 1); } }
    static async allPending() { return notifs.slice(); } };
  env.Safari = strict('Safari', { open(u) { opened.push(u); }, openInApp(u) { opened.push(u); } });
  env.Script = strict('Script', { setWidget(w) { setW = w; }, complete() {}, name: () => 'Sabrly', setShortcutOutput(v) { (opts.out || []).push(v); } });
  env.Device = strict('Device', { locale: () => 'de_DE', isUsingDarkAppearance: () => true });
  const board = { v: opts.clipboard == null ? null : opts.clipboard, quick: [] };
  env.Pasteboard = strict('Pasteboard', { copyString(v) { if (typeof v !== 'string') throw new Error('copyString braucht String'); board.v = v; }, pasteString: () => board.v, copy(v) { board.v = String(v); }, paste: () => board.v });
  env.QuickLook = strict('QuickLook', { async present(v) { board.quick.push(v); } });
  env.Data = strict('DataStatic', { fromBase64String(s) { if (typeof s !== 'string' || s.length % 4) throw new Error('Base64 ungültig'); return strict('Data', { toRawString: () => Buffer.from(s, 'base64').toString('utf8'), getBytes: () => [...Buffer.from(s, 'base64')] }); }, fromString: v => strict('Data', { toRawString: () => v, getBytes: () => [...Buffer.from(v)] }) });
  return { env, texts, urls, opened, images, placed, keychain, files, board, get presented() { return presented; }, get setW() { return setW; }, reqLog, shownAlerts, alertsLeft: alerts };
}
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
async function runScript(code, ctx) { const names = Object.keys(ctx.env), glob = names.filter(n => n !== 'Date'); for (const n of glob) globalThis[n] = ctx.env[n]; try { const fn = new AsyncFunction(...names, code); await fn(...names.map(n => ctx.env[n])); } finally { for (const n of glob) delete globalThis[n]; } }

// ---------- data in the shape Firestore REST returns ----------
function tv(v) { if (v === null || v === undefined) return { nullValue: null }; if (typeof v === 'string') return { stringValue: v }; if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }; if (Array.isArray(v)) return { arrayValue: v.length ? { values: v.map(tv) } : {} };
  const f = {}; for (const [k, x] of Object.entries(v)) f[k] = tv(x); return { mapValue: { fields: f } }; }
const pad = n => String(n).padStart(2, '0'); const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const T = iso(new Date()); const ad = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const state = { v: 3, habits: [
  { id: 'h-beten', name: 'Beten', emoji: '🤲', freq: 'daily', target: 5, labels: ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'], days: [0, 1, 2, 3, 4, 5, 6], time: '', created: ad(-10), archived: false },
  { id: 'h-lesen', name: '1 Seite lesen', emoji: '📚', freq: 'daily', target: 1, labels: [], days: [0, 1, 2, 3, 4, 5, 6], time: '21:00', created: ad(-10), archived: false },
  { id: 'h-sport', name: 'Training', emoji: '🏋️', freq: 'weekly', target: 3, labels: [], days: [0, 1, 2, 3, 4, 5, 6], time: '', created: ad(-10), archived: false },
  { id: 'h-alt', name: 'Archiviert', emoji: '❌', freq: 'daily', target: 1, labels: [], days: [0, 1, 2, 3, 4, 5, 6], time: '', created: ad(-10), archived: true }],
  todos: [{ id: 't1', title: 'Reifen', prio: 'h', due: T, time: '', done: false }], quotes: [{ id: 'q1', type: 'vers', t: 'Wahrlich, mit der Erschwernis kommt Erleichterung.', src: 'Sure 94:6' }],
  plan: { text: '', days: {} }, settings: { dayStart: 0, userName: 'Zeynel', sit: { on: true, txt: {} } } };
const logs = {};
const put = (d, e) => { const k = 'm-' + d.slice(0, 7); logs[k] = logs[k] || { days: {} }; logs[k].days[d] = e; };
for (let i = 1; i <= 4; i++) put(ad(-i), { h: { 'h-beten': [0, 1, 2, 3, 4], 'h-lesen': 1 } });
put(T, { mood: 4, h: { 'h-beten': [0, 1], 'h-lesen': 1, 'h-sport': 1 }, n: [{ id: 'n1', t: 'Notiz' }] });
const docs = [{ name: 'projects/p/databases/(default)/documents/users/u1/data/state', fields: tv(state).mapValue.fields },
  ...Object.entries(logs).map(([k, v]) => ({ name: 'projects/p/databases/(default)/documents/users/u1/data/' + k, fields: tv(v).mapValue.fields }))];
const goodRoute = async r => {
  if (r.url.includes('accounts:signInWithPassword')) { const b = JSON.parse(r.body); if (b.password !== 'geheim1') return { status: 400, json: { error: { message: 'INVALID_LOGIN_CREDENTIALS' } } }; return { status: 200, json: { idToken: 'ID1', refreshToken: 'RT1', localId: 'u1', expiresIn: '3600' } }; }
  if (r.url.includes('securetoken.googleapis.com')) { if (!/refresh_token=RT/.test(r.body)) return { status: 400, json: { error: { message: 'INVALID_REFRESH_TOKEN' } } }; return { status: 200, json: { id_token: 'ID2', refresh_token: 'RT2', user_id: 'u1', expires_in: '3600' } }; }
  if (r.url.includes('firestore.googleapis.com')) { if (!/Bearer ID/.test(r.headers.Authorization || '')) return { status: 401, json: { error: { code: 401, status: 'UNAUTHENTICATED' } } }; if (!r.url.includes('/users/u1/data')) return { status: 403, json: { error: { code: 403, status: 'PERMISSION_DENIED' } } }; return { status: 200, json: { documents: docs } }; }
  return { status: 404, json: {} };
};
const loggedIn = [['sabrly.refresh', 'RT1'], ['sabrly.uid', 'u1'], ['sabrly.email', 'z@x.de']];

(async () => {
  const code = fs.readFileSync(WIDGET, 'utf8');
  const run = async (name, opts, check) => { const ctx = makeEnv(opts); try { await runScript(code, ctx); check(ctx); } catch (e) { ok(name, false, 'EXCEPTION ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n')); } };
  // widgets of every size
  for (const fam of ['small', 'medium', 'large', 'extraLarge']) {
    await run('widget ' + fam, { inWidget: true, family: fam, keychain: loggedIn, route: goodRoute }, ctx => {
      const t = ctx.texts.join(' | ');
      ok('widget ' + fam + ' set', !!ctx.setW && ctx.setW.refreshAfterDate instanceof Date);
      if (fam === 'small') { ok('small ring %', ctx.texts.some(x => /^ring:\d+%$/.test(x)), t); ok('small footer', /Stand \d\d:\d\d/.test(t), t); ok('small counts', t.includes('1 von 3 Habits'), t); }
      else { ok('widget ' + fam + ' habits listed', t.includes('Beten') && t.includes('Training') && t.includes('1 Seite lesen') && !t.includes('Archiviert'), t);
        ok('widget ' + fam + ' minimal: no footer/quote/greeting', !/Stand \d/.test(t) && !t.includes('Erschwernis') && !t.includes('Zeynel') && !ctx.texts.some(x => x.startsWith('ring:')), t);
        ok('widget ' + fam + ' header count', ctx.texts.includes('Heute') && ctx.texts.includes('2/3'), t); }
    });
  }
  // exact numbers: Beten 2/5, lesen done, sport weekly 1/3 → daily score (0.4+1)/2=70%; streak lesen 5
  await run('values small', { inWidget: true, family: 'small', keychain: loggedIn, route: goodRoute }, ctx => {
    ok('day score 70%', ctx.texts.includes('ring:70%'), ctx.texts.filter(x => x.startsWith('ring')).join());
    ok('best streak 5', ctx.texts.includes('🔥 5'), ctx.texts.join('|'));
  });
  await run('values', { inWidget: true, family: 'large', keychain: loggedIn, route: goodRoute }, ctx => {
    ok('beten progress 2/5', ctx.texts.includes('2/5'), ctx.texts.join('|'));
    ok('token refreshed and stored', ctx.keychain.get('sabrly.refresh') === 'RT2' && ctx.keychain.get('sabrly.idtoken') === 'ID2');
    ok('data cached', ctx.files.has('/docs/sabrly-widget-data.json'));
  });
  for (const fam of ['accessoryCircular', 'accessoryRectangular', 'accessoryInline'])
    await run('lock ' + fam, { inAccessory: true, family: fam, keychain: loggedIn, route: goodRoute }, ctx => ok('lock ' + fam, !!ctx.setW && ctx.texts.length > 0, ctx.texts.join('|')));
  // not logged in
  await run('no login', { inWidget: true, family: 'small', route: goodRoute }, ctx => ok('no login message', ctx.texts.join('|').includes('Anmeldung nötig')));
  // revoked refresh token
  await run('revoked', { inWidget: true, family: 'small', keychain: [['sabrly.refresh', 'BAD'], ['sabrly.uid', 'u1']], route: goodRoute }, ctx => ok('revoked → login message', ctx.texts.join('|').includes('Anmeldung nötig')));
  // offline with cache
  const cached = JSON.stringify({ state, logs, at: Date.now() - 3600e3 });
  await run('offline cache', { inWidget: true, family: 'medium', keychain: loggedIn, files: [['/docs/sabrly-widget-data.json', cached]], route: async () => ({ throw: true }) }, ctx => ok('offline shows cached', ctx.texts.join('|').includes('Offline · Stand') && ctx.texts.join('|').includes('Beten'), ctx.texts.join('|')));
  await run('offline no cache', { inWidget: true, family: 'medium', keychain: loggedIn, route: async () => ({ throw: true }) }, ctx => ok('offline no cache message', ctx.texts.join('|').includes('Keine Verbindung')));
  // empty account
  await run('empty', { inWidget: true, family: 'medium', keychain: loggedIn, route: async r => r.url.includes('firestore') ? { status: 200, json: {} } : goodRoute(r) }, ctx => ok('no data message', ctx.texts.join('|').includes('Noch keine Daten')));
  // app: login wrong pw, then correct + preview
  await run('app wrong pw', { route: goodRoute, alerts: [{ index: 0, fields: ['z@x.de', 'falsch'] }, { index: 0 }] }, ctx => ok('wrong password alert', ctx.shownAlerts.includes('Anmeldung fehlgeschlagen') && !ctx.keychain.has('sabrly.refresh')));
  await run('app login + preview', { route: goodRoute, alerts: [{ index: 0, fields: ['z@x.de', 'geheim1'] }, { index: 2 }] }, ctx => {
    ok('login stores token, not password', ctx.keychain.get('sabrly.refresh') === 'RT1' && ![...ctx.keychain.values()].includes('geheim1'));
    ok('preview large presented', ctx.presented === 'large');
  });
  await run('app logout', { keychain: loggedIn, files: [['/docs/sabrly-widget-data.json', cached]], route: goodRoute, alerts: [{ index: 15 }, { index: 0 }] }, ctx => ok('logout clears', !ctx.keychain.has('sabrly.refresh') && !ctx.files.has('/docs/sabrly-widget-data.json')));
  for (const [i, fam] of [[2, 'large'], [3, 'medium'], [4, 'medium'], [5, 'small'], [6, 'small'], [7, 'medium'], [8, 'medium'], [9, 'large'], [10, 'medium'], [11, 'large'], [12, 'small'], [13, 'small'], [14, 'accessoryRectangular']])
    await run('preview ' + fam, { keychain: loggedIn, route: goodRoute, alerts: [{ index: i }] }, ctx => ok('preview ' + fam, ctx.presented === fam));
  // loader: downloads, caches, runs; offline falls back to cache
  const lcode = fs.readFileSync(LOADER, 'utf8');
  const loaderRoute = async r => r.url.startsWith('https://zetzet38.github.io/Sabrly/widget/sabrly-widget.js') ? { status: 200, text: code } : goodRoute(r);
  { const ctx = makeEnv({ inWidget: true, family: 'medium', keychain: loggedIn, route: loaderRoute }); try { await runScript(lcode, ctx); ok('loader runs widget', !!ctx.setW && ctx.texts.includes('Beten')); ok('loader caches code', ctx.files.has('/docs/sabrly-widget-code.js')); } catch (e) { ok('loader', false, e.message); } }
  { const ctx = makeEnv({ inWidget: true, family: 'small', keychain: loggedIn, files: [['/docs/sabrly-widget-code.js', code], ['/docs/sabrly-widget-data.json', cached]], route: async () => ({ throw: true }) }); try { await runScript(lcode, ctx); ok('loader offline uses cache', !!ctx.setW && ctx.texts.join('|').includes('Offline')); } catch (e) { ok('loader offline', false, e.message); } }
  { const ctx = makeEnv({ inWidget: true, family: 'small', keychain: loggedIn, route: async r => r.url.includes('github.io') ? { status: 404, text: 'Not Found' } : goodRoute(r) }); try { await runScript(lcode, ctx); ok('loader 404 no cache errors', false); } catch (e) { ok('loader 404 no cache → clear error', /konnte nicht geladen/.test(e.message), e.message); } }
  await require('./actions.js')({ run, ok, makeEnv, runScript, code, state, logs, tv, T, ad, loggedIn, goodRoute });
  await require('./garmin_tests.js')({ run, ok, makeEnv, runScript, code, loggedIn, goodRoute });
  console.log(results.join('\n')); console.log('TOTAL', results.length, 'FAIL', results.filter(x => x.startsWith('FAIL')).length);
})();
