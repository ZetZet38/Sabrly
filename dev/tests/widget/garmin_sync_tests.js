// Garmin-Import ins Firestore-Emulat: Läufe, Kraft, Sonstiges, Abgleich, Habits, Drosselung, Fehler.
const fs = require('fs'), path = require('path');
module.exports = async ({ run, ok, makeStore, storeRoute, val, T, ad, loggedIn }) => {
  const FX = f => fs.readFileSync(path.join(__dirname, 'fixtures', f));
  const KEY = 'gpk_TESTKEY_0123456789abcdefABCDEF';
  const b64u = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const JWT = b64u({ alg: 'RS256' }) + '.' + b64u({ exp: Math.floor(Date.now() / 1000) + 86400 }) + '.c2ln';
  const wdx = d => (new Date(d + 'T12:00:00').getDay() + 6) % 7, wsOf = d => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() - wdx(d)); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const mkOf = d => 'm-' + d.slice(0, 7);
  const act = (id, n, d, time, typ, o) => Object.assign({ activityId: id, activityName: n, startTimeLocal: d + ' ' + time, activityType: { typeKey: typ }, duration: 1800, averageHR: 140, maxHR: 170 }, o || {});
  const RUN_A = act(25018176793, 'Dormagen Laufen', T, '11:58:38', 'running', { distance: 5053.6, duration: 2034.519, averageHR: 164, maxHR: 181, calories: 427, averageRunningCadenceInStepsPerMinute: 174.64, elevationGain: 18.8,
    aerobicTrainingEffect: 3.799999952316284, anaerobicTrainingEffect: 0, activityTrainingLoad: 89.67, trainingEffectLabel: 'LACTATE_THRESHOLD', avgStrideLength: 85.36, hrTimeInZone_1: 0, hrTimeInZone_2: 205, hrTimeInZone_3: 400.998, hrTimeInZone_4: 1260.505, hrTimeInZone_5: 167.994, startLatitude: 51.09 });
  const STR_B = act(25010583664, 'Krafttraining', ad(-1), '15:19:47', 'strength_training', { duration: 3603.516, averageHR: 115, maxHR: 168, calories: 394, aerobicTrainingEffect: 2.1, anaerobicTrainingEffect: 1.4, activityTrainingLoad: 30.9, hrTimeInZone_1: 1564, hrTimeInZone_2: 1048, hrTimeInZone_3: 369, hrTimeInZone_4: 38, hrTimeInZone_5: 0 });
  const RUN_H = act(24964446330, 'Dormagen Laufen', ad(-2), '15:17:00', 'running', { distance: 4240, duration: 1960, averageHR: 147, maxHR: 162 });
  const RUN_C = act(24995649438, 'Dormagen Laufen', ad(-3), '10:47:00', 'running', { distance: 7850, duration: 3609, averageHR: 153, maxHR: 181 });
  const CYC_D = act(24913489352, 'Indoor-Radfahren', ad(-4), '09:43:41', 'indoor_cycling', { distance: 21500, duration: 2402.8, averageHR: 132, maxHR: 149 });
  const CYC_E = act(24890299697, 'Dormagen Radfahren', ad(-4), '13:24:00', 'cycling', { distance: 2600, duration: 1057, averageHR: 113.86, maxHR: 139 });
  const WALK = act(24890299649, 'Gehen', ad(-4), '12:21:00', 'walking', { distance: 160, duration: 1047 });
  const OLD = act(24798923025, 'Laufen', ad(-20), '10:03:00', 'running', { distance: 8000, duration: 3422 });
  const LIST = [RUN_A, STR_B, RUN_H, RUN_C, CYC_D, CYC_E, WALK, OLD];
  const garmin = (o = {}) => { const c = { token: 0, list: 0, dl: [] };
    const route = r => { const u = r.url; if (!u.startsWith('https://personal.connectapi.garmin.com/')) return null; const p = u.slice(38);
      if (p.endsWith('/personal-api-key/token')) { c.token++; return o.badKey || r.headers.Authorization !== 'ApiKey ' + KEY ? { status: 401, text: '' } : { status: 200, text: JWT }; }
      if (r.headers.Authorization !== 'Bearer ' + JWT) return { status: 401, text: '' };
      if (p.startsWith('/activitylist-service/activities/search/activities?')) { c.list++; return { status: 200, json: o.list || LIST }; }
      const m = p.match(/^\/download-service\/files\/activity\/(\d+)$/); if (m) { c.dl.push(m[1]); const f = (o.fit || { 25018176793: 'rwd.zip' })[m[1]]; return f ? { status: 200, bytes: FX(f) } : { status: 404, bytes: [] }; }
      return { status: 404, text: '' }; };
    return { c, route }; };
  const training = plan => ({ days: [{ id: 'd-push', name: 'Push', sub: '', col: 'g', blocks: [] }], ex: {}, weeks: plan ? { [wsOf(T)]: { d: { [wdx(T)]: plan }, s: {} } } : {}, habit: '', rhabit: '', hr: 150 });
  const storeWith = (plan, mut) => makeStore((s, l) => { s.training = training(plan);
    const d2 = ad(-2), k2 = mkOf(d2); l[k2] = l[k2] || { days: {} }; l[k2].days[d2] = Object.assign(l[k2].days[d2] || {}, { run: [{ id: 'r-man', t: 'easy', dur: 1900, km: 4.2, hr: 145, max: 0 }] });
    if (mut) mut(s, l); });
  const G = async (name, opts, check) => { const st = opts.store || storeWith(['@I']), g = opts.g || garmin(), log = [], sr = storeRoute(st);
    await run(name, Object.assign({ keychain: loggedIn.concat([['sabrly.garmin.key', KEY]]), alertLog: log, route: async r => g.route(r) || sr(r) }, opts), ctx => check(ctx, st, log, g.c)); };
  const day = (st, d) => val(st, mkOf(d), ['days', d]) || {};
  const files = ctx => [...ctx.files.entries()];

  // 1) erster Abruf in der App: Schlüssel eingeben → alles Neue der letzten 14 Tage
  let afterFirst = null;
  await G('garmin sync first', { keychain: loggedIn, alerts: [{ index: 1 }, { index: 0, fields: [KEY] }, { index: 0 }] }, (ctx, st, log, c) => {
    afterFirst = { st, files: files(ctx) };
    const A = day(st, T), r = (A.run || [])[0] || {}, g = r.g || {};
    ok('gsync: result title', log.some(a => a.title === '⌚ 5 Einheiten übernommen'), log.map(a => a.title + ': ' + a.message).join(' || '));
    ok('gsync: run A imported as interval (planned @I)', r.id === 'g-25018176793' && r.t === 'iv' && r.km === 5.05 && r.dur === 2035 && r.hr === 164 && r.max === 181, JSON.stringify(r).slice(0, 300));
    ok('gsync: intervals from run/walk', r.iv && r.iv.n === 3 && r.iv.len === 8 && r.iv.u === 'min' && r.iv.pz === '2 min gehen' && r.iv.r.length === 3 && r.iv.r.every(x => /^\d+:\d\d$/.test(x.v) && x.h > 160), JSON.stringify(r.iv));
    ok('gsync: interval pace ≈ 5:54/km', r.iv && r.iv.r[0].v === '5:54', r.iv && r.iv.r[0].v);
    ok('gsync: km splits', Array.isArray(g.km) && g.km.length === 6 && g.km[5].m === 55 && g.km[0].t >= 410 && g.km[0].t <= 430 && Math.abs(g.km.reduce((a, x) => a + x.t, 0) - 2034) <= 3, JSON.stringify(g.km));
    ok('gsync: segments without stand', Array.isArray(g.seg) && g.seg.length === 7 && g.seg[0].k === 'r' && g.seg[1].k === 'w' && g.seg[0].t === 223, JSON.stringify(g.seg));
    ok('gsync: warm-up marked, analysis version', g.seg.map(x => x.p || '-').join('') === 'ee-----' && g.v === 3, g.seg.map(x => x.p || '-').join('') + ' v' + g.v);
    ok('gsync: minute curve', g.cv && g.cv.s === 60 && g.cv.p.length === 34 && g.cv.h.length === 34 && g.cv.c && g.cv.c[5] === 173 && g.cv.a && g.cv.a.length === 34 && g.cv.p[10] > 300 && g.cv.p[10] < 400, JSON.stringify(g.cv).slice(0, 300));
    ok('gsync: km cadence + elevation', g.km[1].c >= 160 && g.km[1].c <= 175 && typeof g.km[1].e === 'number', JSON.stringify(g.km[1]));
    ok('gsync: HR recovery in walk breaks', g.seg.filter(x => x.k === 'w').every(x => typeof x.d === 'number') && g.seg.filter(x => x.k === 'r').every(x => x.d === undefined), JSON.stringify(g.seg));
    ok('gsync: no decoupling for interval run', g.dc === undefined);
    ok('gsync: laps + zones + extras', g.lap && g.lap.length === 4 && JSON.stringify(g.z) === '[0,205,401,1261,168]' && JSON.stringify(g.zb) === '[99,118,138,158,177,197]' && g.mhr === 197 && g.rhr === 78 && g.kcal === 427 && g.te === 3.8 && g.load === 90 && g.cad === 175 && g.asc === 19 && g.st === '11:58' && g.lbl === 'LACTATE_THRESHOLD', JSON.stringify(g).slice(0, 600));
    ok('gsync: no location stored', !JSON.stringify(st.docs.get(mkOf(T)).fields).includes('51.09') && !JSON.stringify(g).includes('612345678'));
    const B = (day(st, ad(-1)).ga || [])[0] || {};
    ok('gsync: strength as ga', B.k === 'str' && B.id === '25010583664' && B.dur === 3604 && B.hr === 115 && B.max === 168 && B.kcal === 394 && B.st === '15:19' && B.z.length === 5, JSON.stringify(B));
    ok('gsync: strength ticks training habit yesterday', val(st, mkOf(ad(-1)), ['days', ad(-1), 'h', 'h-sport']) === 1);
    const H = day(st, ad(-2)).run || [];
    ok('gsync: manual run merged, not duplicated', H.length === 1 && H[0].id === 'r-man' && H[0].km === 4.24 && H[0].dur === 1960 && H[0].g && H[0].g.id === '24964446330' && H[0].t === 'easy', JSON.stringify(H));
    ok('gsync: no habit tick on older days', val(st, mkOf(ad(-2)), ['days', ad(-2), 'h', 'h-sport']) === undefined && val(st, mkOf(ad(-3)), ['days', ad(-3), 'h', 'h-sport']) === undefined);
    const C = (day(st, ad(-3)).run || [])[0] || {};
    ok('gsync: run without recording → easy, no splits', C.id === 'g-24995649438' && C.t === 'easy' && !C.iv && !C.g.km && C.km === 7.85, JSON.stringify(C));
    const D = day(st, ad(-4));
    ok('gsync: indoor cycling as other, short ride + walk skipped', (D.ga || []).length === 1 && D.ga[0].k === 'oth' && D.ga[0].km === 21.5 && D.ga[0].n === 'Indoor-Radfahren', JSON.stringify(D.ga));
    ok('gsync: older than 14 days ignored', !JSON.stringify([...st.docs.values()].map(d => d.fields)).includes('24798923025'));
    ok('gsync: only runs downloaded', c.dl.length === 3 && !c.dl.includes('25010583664') && !c.dl.includes('24913489352'), c.dl.join());
    const S2 = { at: val(st, 'garmin', ['at']), n: val(st, 'garmin', ['n']), err: val(st, 'garmin', ['err']), last: val(st, 'garmin', ['last']) };
    ok('gsync: status doc', S2.n === 5 && S2.err === '' && /^\d{4}-/.test(S2.at) && S2.last.length === 5, JSON.stringify(S2));
    ok('gsync: month writes use precondition', st.patches.filter(p => p.id.startsWith('m-')).every(p => p.pre || p.ex === 'false'), JSON.stringify(st.patches));
    const L = JSON.parse(ctx.files.get('/docs/sabrly-garmin.json') || '{}');
    ok('gsync: local note keeps only time/status', L.last > 0 && !L.ids && L.total === 5, JSON.stringify(L));
  });
  // 2) gleich nochmal: nichts Neues, keine Schreibvorgänge
  if (afterFirst) await G('garmin sync again', { store: afterFirst.st, files: afterFirst.files, alerts: [{ index: 1 }, { index: 0 }, { index: 0 }] }, (ctx, st, log) => {
    const n0 = afterFirst.st.patches.length;
    ok('gsync again: nothing new', log.some(a => a.title === '⌚ Nichts Neues'), log.map(a => a.title).join(' | '));
    ok('gsync again: no month writes', !st.patches.slice(n0).some(p => p.id.startsWith('m-')), JSON.stringify(st.patches.slice(n0)));
  });
  // 3) ohne lokalen Merkzettel (neu installiert): Firestore-Daten verhindern Doppelte
  if (afterFirst) await G('garmin sync no local file', { store: afterFirst.st, alerts: [{ index: 1 }, { index: 0 }, { index: 0 }] }, (ctx, st, log) => {
    ok('gsync fresh install: no duplicates', log.some(a => a.title === '⌚ Nichts Neues') && (day(st, T).run || []).length === 1 && (day(st, ad(-1)).ga || []).length === 1, log.map(a => a.title).join(' | '));
  });
  // 3b) App hat den Monat gleichzeitig gespeichert und den Import überschrieben → nächster Abruf holt ihn wieder
  if (afterFirst) { const st = afterFirst.st, m = st.docs.get(mkOf(T)); const f = JSON.parse(JSON.stringify(m.fields)); delete f.days.mapValue.fields[T].mapValue.fields.run; st.docs.set(mkOf(T), { fields: f, updateTime: st.ts() });
    await G('garmin sync after overwrite', { store: st, files: afterFirst.files, alerts: [{ index: 1 }, { index: 0 }, { index: 0 }] }, (ctx, s2, log) =>
      ok('gsync: overwritten import comes back', ((day(st, T).run || [])[0] || {}).id === 'g-25018176793' && log.some(a => /1 Einheit übernommen/.test(a.title)), log.map(a => a.title).join('|'))); }
  // 4) Widget: automatisch, höchstens 2 Einheiten, dann 20 min Pause
  { const st = storeWith(['@I']), g = garmin(); let fl = null;
    await G('garmin widget auto', { store: st, g, inWidget: true, family: 'medium' }, (ctx, st2) => { fl = files(ctx);
      const n = [T, ad(-1), ad(-2), ad(-3), ad(-4)].reduce((a, d) => a + (day(st, d).run || []).filter(r => r.g).length + (day(st, d).ga || []).length, 0);
      ok('gwidget: imports 2 oldest first', n === 2 && (day(st, ad(-4)).ga || []).length === 1 && ((day(st, ad(-3)).run || [])[0] || {}).id === 'g-24995649438', String(n));
      ok('gwidget: widget still renders', !!ctx.setW && ctx.texts.includes('Beten'), ctx.texts.join('|')); });
    await G('garmin widget throttle', { store: st, g, inWidget: true, family: 'medium', files: fl }, (ctx) => ok('gwidget: second refresh within 20 min skips Garmin', g.c.list === 1, String(g.c.list)));
    const L = JSON.parse(new Map(fl).get('/docs/sabrly-garmin.json')); L.last = Date.now() - 21 * 60e3;
    await G('garmin widget later', { store: st, g, inWidget: true, family: 'medium', files: fl.map(([k, v]) => [k, k.endsWith('sabrly-garmin.json') ? JSON.stringify(L) : v]) }, () => {
      ok('gwidget: after 20 min continues with next 2', g.c.list === 2 && ((day(st, ad(-2)).run || [])[0] || {}).g && (day(st, ad(-1)).ga || []).length === 1, JSON.stringify(day(st, ad(-2)).run)); }); }
  // 5) gelöscht in Sabrly (gdel) → kommt nicht wieder
  await G('garmin tombstone', { store: storeWith(['@I'], (s, l) => { l[mkOf(T)].days[T].gdel = ['25018176793']; }), alerts: [{ index: 1 }, { index: 0 }, { index: 0 }] }, (ctx, st) =>
    ok('gsync: deleted run stays deleted', !(day(st, T).run || []).length, JSON.stringify(day(st, T).run)));
  // 6) geplant „Lauf locker“: bleibt locker, Intervalle nur als Vorschlag
  await G('garmin plan easy', { store: storeWith(['@L']), alerts: [{ index: 1 }, { index: 0 }, { index: 0 }] }, (ctx, st) => {
    const r = (day(st, T).run || [])[0] || {}; ok('gsync: planned easy stays easy, ivx kept', r.t === 'easy' && !r.iv && r.g && r.g.ivx && r.g.ivx.n === 3, JSON.stringify(r).slice(0, 200)); });
  // 7) nicht geplant: Lauf/Geh-Struktur → Intervalle; ohne Struktur → locker
  await G('garmin unplanned', { store: storeWith(null), alerts: [{ index: 1 }, { index: 0 }, { index: 0 }] }, (ctx, st) => {
    ok('gsync: unplanned run/walk → intervals', ((day(st, T).run || [])[0] || {}).t === 'iv'); ok('gsync: unplanned plain run → easy', ((day(st, ad(-3)).run || [])[0] || {}).t === 'easy'); });
  // 7b) Zone-2/3-Lauf mit kurzen Gehpausen (wie am 7.11.): nicht geplant → locker, keine Intervalle
  await G('garmin zone2 run', { store: storeWith(null), g: garmin({ list: [RUN_C], fit: { 24995649438: 'z2.zip' } }), alerts: [{ index: 1 }, { index: 0 }, { index: 0 }] }, (ctx, st) => {
    const r = (day(st, ad(-3)).run || [])[0] || {};
    ok('gsync: short walks are no intervals', r.t === 'easy' && !r.iv && r.g && !r.g.ivx && r.g.seg && r.g.seg.length === 9 && !r.g.seg.some(x => x.p) && r.g.km.length === 8, JSON.stringify(r).slice(0, 400));
    ok('gsync: decoupling for steady run', typeof r.g.dc === 'number' && r.g.dc > 0 && r.g.cv.p.length === 60, String(r.g.dc) + ' ' + (r.g.cv && r.g.cv.p.length)); });
  // 7c) schon importierte Läufe (alte Auswertung) werden neu ausgewertet – selbst geänderte bleiben
  { const S7 = [{ k: 'r', t: 499, m: 1261, h: 149 }, { k: 'w', t: 15, m: 25, h: 142 }, { k: 'r', t: 185, m: 402, h: 151 }, { k: 'w', t: 35, m: 53, h: 163 }, { k: 'r', t: 1405, m: 3051, h: 155 }, { k: 'w', t: 3, m: 4, h: 148 }, { k: 'r', t: 918, m: 1864, h: 153 }, { k: 'w', t: 12, m: 17, h: 157 }, { k: 'r', t: 528, m: 1164, h: 153 }];
    const oldIv = { p: 'own', n: 2, u: 'min', len: 9, pz: '14 s gehen', r: [{ v: '6:36', h: 149 }, { v: '7:34', h: 153 }] };
    const S9 = [{ k: 'r', t: 223, m: 544, h: 148 }, { k: 'w', t: 65, m: 98, h: 152 }, { k: 'r', t: 492, m: 1391, h: 171 }, { k: 'w', t: 133, m: 217, h: 144 }, { k: 'r', t: 495, m: 1289, h: 172 }, { k: 'w', t: 126, m: 197, h: 140 }, { k: 'r', t: 492, m: 1308, h: 170 }];
    const iv9 = { p: 'own', n: 3, u: 'min', len: 8, pz: '2 min gehen', r: [{ v: '5:54', h: 171 }, { v: '6:24', h: 172 }, { v: '6:16', h: 170 }] };
    const old = (s, l) => { const put = (d, runs) => { const k = mkOf(d); l[k] = l[k] || { days: {} }; l[k].days[d] = Object.assign(l[k].days[d] || {}, { run: runs }); };
      put(ad(-3), [{ id: 'g-24995649438', t: 'iv', dur: 3609, km: 7.85, hr: 153, max: 181, iv: oldIv, g: { id: '24995649438', seg: S7, ivx: oldIv } }]);
      put(ad(-5), [{ id: 'g-111', t: 'iv', dur: 3000, km: 7, hr: 150, max: 170, iv: Object.assign({}, oldIv, { pz: 'selbst geändert' }), g: { id: '111', seg: S7, ivx: oldIv } }]);
      put(ad(-1), [{ id: 'g-25018176793', t: 'iv', dur: 2035, km: 5.05, hr: 164, max: 181, iv: iv9, g: { id: '25018176793', seg: S9, ivx: iv9 } }]); };
    await G('garmin reanalyse', { store: storeWith(null, old), g: garmin({ list: [] }), alerts: [{ index: 1 }, { index: 0 }, { index: 0 }] }, (ctx, st, log) => {
      const a = (day(st, ad(-3)).run || [])[0], b = (day(st, ad(-5)).run || [])[0], c = (day(st, ad(-1)).run || [])[0];
      ok('gredo: 7.11.-run becomes easy', a.t === 'easy' && !a.iv && !a.g.ivx && a.g.v === 3, JSON.stringify(a).slice(0, 300));
      ok('gredo: edited intervals stay', b.t === 'iv' && b.iv.pz === 'selbst geändert' && !b.g.ivx && b.g.v === 3, JSON.stringify(b).slice(0, 300));
      ok('gredo: 9.11. keeps intervals, gets warm-up + curve from new download', c.t === 'iv' && c.iv.n === 3 && c.g.seg.map(x => x.p || '-').join('') === 'ee-----' && c.g.v === 3 && c.g.cv && c.g.km && c.g.km.length === 6, JSON.stringify(c).slice(0, 300));
      ok('gredo: result mentions re-analysis', log.some(x => /3 Läufe neu ausgewertet/.test(x.message)), log.map(x => x.message).join(' | ').slice(0, 300));
    });
    await G('garmin reanalyse once', { store: storeWith(null, (s, l) => { old(s, l); for (const k of Object.keys(l)) for (const d of Object.keys(l[k].days)) for (const r of (l[k].days[d].run || [])) if (r.g) r.g.v = 3; }), g: garmin({ list: [] }), alerts: [{ index: 1 }, { index: 0 }, { index: 0 }] }, (ctx, st) =>
      ok('gredo: already current → no writes', !st.patches.some(p => p.id.startsWith('m-')), JSON.stringify(st.patches))); }
  // 7d) Widget: Neu-Auswertung mit Download höchstens 1 pro Aktualisierung
  { const g = garmin({ list: [] }); const st = storeWith(null, (s, l) => { for (const [d, id] of [[ad(-1), '25018176793'], [ad(-2), '24964446330']]) { const k = mkOf(d); l[k] = l[k] || { days: {} }; l[k].days[d] = Object.assign(l[k].days[d] || {}, { run: [{ id: 'g-' + id, t: 'easy', dur: 2000, km: 5, hr: 150, max: 170, g: { id, v: 2 } }] }); } });
    await G('garmin widget redo budget', { store: st, g, inWidget: true, family: 'small' }, () => ok('gwidget: one re-download per refresh', g.c.dl.length === 1, g.c.dl.join())); }
  // 7e) Intervalle mit Trabpausen (kein Gehen): am Tempo erkannt
  await G('garmin jog intervals', { store: storeWith(null), g: garmin({ list: [act(40001, 'Intervalle', ad(-6), '10:00:00', 'running', { distance: 6900, duration: 2400, averageHR: 155, maxHR: 180 })], fit: { 40001: 'jog.zip' } }), alerts: [{ index: 1 }, { index: 0 }, { index: 0 }] }, (ctx, st) => {
    const r = (day(st, ad(-6)).run || []).find(x => x.id === 'g-40001') || {};
    ok('gsync: jog intervals detected by pace', r.t === 'iv' && r.iv && r.iv.n === 5 && r.iv.len === 3 && r.iv.pz === '2 min traben' && r.g.seg.some(x => x.k === 'j') && r.g.seg[0].p === 'e' && r.g.seg[r.g.seg.length - 1].p === 'a', JSON.stringify(r.iv) + ' ' + JSON.stringify(r.g && r.g.seg)); });
  // 8) strukturierte Runden (Workout mit Pausen) → Strecken-Intervalle
  await G('garmin structured laps', { store: storeWith(null), g: garmin({ list: [act(20001, 'Intervalle', T, '18:00:00', 'running', { distance: 3390, duration: 1320 })], fit: { 20001: 'run.zip' } }), alerts: [{ index: 1 }, { index: 0 }, { index: 0 }] }, (ctx, st) => {
    const r = (day(st, T).run || [])[0] || {}; ok('gsync: laps with rest → 2 × 400 m', r.t === 'iv' && r.iv && r.iv.u === 'm' && r.iv.len === 400 && r.iv.n === 2 && r.iv.pz === '1,5 min Pause' && r.iv.r[0].v === '2:00' && r.iv.r[0].h === 170, JSON.stringify(r.iv)); });
  // 9) Tagesbeginn 4 Uhr: Lauf um 2:30 zählt zum Vortag
  await G('garmin day start', { store: storeWith(null, s => { s.settings.dayStart = 4; }), g: garmin({ list: [act(30001, 'Nachtlauf', T, '02:30:00', 'running', { distance: 5000, duration: 1800 })], fit: {} }), alerts: [{ index: 1 }, { index: 0 }, { index: 0 }] }, (ctx, st) =>
    ok('gsync: night run counts for previous day', ((day(st, ad(-1)).run || [])[0] || {}).id === 'g-30001' && !(day(st, T).run || []).some(r => r.id === 'g-30001')));
  // 10) Konflikt beim Schreiben → frisch lesen und nochmal
  { const st = storeWith(null); st.failNext = 1;
    await G('garmin conflict', { store: st, g: garmin({ list: [RUN_C] }), alerts: [{ index: 1 }, { index: 0 }, { index: 0 }] }, (ctx, s2, log) =>
      ok('gsync: retries after conflict', ((day(st, ad(-3)).run || [])[0] || {}).id === 'g-24995649438' && log.some(a => /1 Einheit übernommen/.test(a.title)), log.map(a => a.title).join('|'))); }
  // 11) Schlüssel abgelaufen im Widget → Status „key“, dann 6 h Ruhe
  { const st = storeWith(null), g = garmin({ badKey: true }); let fl = null;
    await G('garmin bad key widget', { store: st, g, inWidget: true, family: 'small' }, ctx => { fl = files(ctx);
      ok('gwidget: bad key → status err key', val(st, 'garmin', ['err']) === 'key' && !!ctx.setW, JSON.stringify(val(st, 'garmin', ['err']))); });
    const L = JSON.parse(new Map(fl).get('/docs/sabrly-garmin.json')); L.last = Date.now() - 30 * 60e3;
    await G('garmin bad key backoff', { store: st, g, inWidget: true, family: 'small', files: fl.map(([k, v]) => [k, k.endsWith('sabrly-garmin.json') ? JSON.stringify(L) : v]) }, () =>
      ok('gwidget: bad key waits 6 h', g.c.token === 1, String(g.c.token))); }
  // 12) Schlüssel abgelaufen in der App → Hinweis mit neuem Schlüssel
  await G('garmin bad key app', { store: storeWith(null), g: garmin({ badKey: true }), alerts: [{ index: 1 }, { index: 0 }, { index: -1 }] }, (ctx, st, log) =>
    ok('gsync app: bad key → ask for new key', log.some(a => a.title === 'Schlüssel abgelehnt') && val(st, 'garmin', ['err']) === 'key', log.map(a => a.title).join('|')));
  // 13) ohne Schlüssel ruft das Widget Garmin nie auf
  { const g = garmin(); await G('garmin widget no key', { keychain: loggedIn, g, inWidget: true, family: 'small' }, () => ok('gwidget: no key → no Garmin call', g.c.token === 0 && g.c.list === 0)); }
};
