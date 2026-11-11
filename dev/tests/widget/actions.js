// Tests for the new widget variants and the in-app actions, against a small Firestore REST emulator
// that applies updateMask / currentDocument preconditions like the real service.
module.exports = async ({ run, ok, makeEnv, runScript, code, state, logs, tv, T, ad, loggedIn, goodRoute }) => {
  const clone = x => JSON.parse(JSON.stringify(x));
  const fv = v => { if (!v) return undefined; if ('stringValue' in v) return v.stringValue; if ('integerValue' in v) return Number(v.integerValue); if ('doubleValue' in v) return v.doubleValue; if ('booleanValue' in v) return v.booleanValue; if ('nullValue' in v) return null;
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(fv); if ('mapValue' in v) { const o = {}; for (const [k, x] of Object.entries(v.mapValue.fields || {})) o[k] = fv(x); return o; } };
  function makeStore(mut) {
    const s = clone(state), l = clone(logs); if (mut) mut(s, l);
    const docs = new Map(); let clock = 1; const ts = () => '2026-11-08T10:00:00.' + String(clock++).padStart(6, '0') + 'Z';
    docs.set('state', { fields: tv(s).mapValue.fields, updateTime: ts() });
    for (const [k, v] of Object.entries(l)) docs.set(k, { fields: tv(v).mapValue.fields, updateTime: ts() });
    return { docs, ts, failNext: 0, netFail: false, patches: [], gets: [] };
  }
  function parsePath(p) {
    const segs = []; let cur = '', inq = false, quoted = false;
    const push = () => { if (!quoted && !/^[A-Za-z_][A-Za-z_0-9]*$/.test(cur)) throw new Error('INVALID path segment ' + cur); segs.push(cur); cur = ''; quoted = false; };
    for (let i = 0; i < p.length; i++) { const c = p[i];
      if (inq) { if (c === '\\') cur += p[++i]; else if (c === '`') inq = false; else cur += c; }
      else if (c === '`') { inq = true; quoted = true; } else if (c === '.') push(); else cur += c; }
    push(); return segs;
  }
  const getAt = (fields, segs) => { let f = fields; for (let i = 0; i < segs.length; i++) { const v = f && f[segs[i]]; if (!v) return undefined; if (i === segs.length - 1) return v; f = v.mapValue && v.mapValue.fields; } };
  const setAt = (fields, segs, val) => { let f = fields; for (let i = 0; i < segs.length - 1; i++) { let v = f[segs[i]]; if (!v || !v.mapValue) v = f[segs[i]] = { mapValue: { fields: {} } }; if (!v.mapValue.fields) v.mapValue.fields = {}; f = v.mapValue.fields; } f[segs[segs.length - 1]] = val; };
  const delAt = (fields, segs) => { let f = fields; for (let i = 0; i < segs.length - 1; i++) { const v = f[segs[i]]; if (!v || !v.mapValue || !v.mapValue.fields) return; f = v.mapValue.fields; } delete f[segs[segs.length - 1]]; };
  const storeRoute = st => async r => {
    if (!r.url.includes('firestore.googleapis.com')) return goodRoute(r);
    const u = new URL(r.url);
    if (!/Bearer ID/.test(r.headers.Authorization || '')) return { status: 401, json: { error: { code: 401, status: 'UNAUTHENTICATED' } } };
    const m = u.pathname.match(/\/users\/u1\/data(?:\/([^/]+))?$/); if (!m) return { status: 403, json: { error: { code: 403, status: 'PERMISSION_DENIED' } } };
    const id = m[1] && decodeURIComponent(m[1]);
    if (r.method === 'GET' && !id) return { status: 200, json: { documents: [...st.docs].map(([k, d]) => ({ name: 'projects/p/databases/(default)/documents/users/u1/data/' + k, fields: clone(d.fields), updateTime: d.updateTime })) } };
    if (r.method === 'GET') { st.gets.push(id); const d = st.docs.get(id); if (!d) return { status: 404, json: { error: { code: 404, status: 'NOT_FOUND', message: 'no' } } }; return { status: 200, json: { name: 'x/' + id, fields: clone(d.fields), updateTime: d.updateTime } }; }
    if (r.method === 'PATCH') {
      if (st.netFail) return { throw: true };
      if (st.failNext) { st.failNext--; return { status: 400, json: { error: { code: 400, status: 'FAILED_PRECONDITION', message: 'changed' } } }; }
      const masks = u.searchParams.getAll('updateMask.fieldPaths'), pre = u.searchParams.get('currentDocument.updateTime'), ex = u.searchParams.get('currentDocument.exists');
      let segsList; try { segsList = masks.map(parsePath); } catch (e) { return { status: 400, json: { error: { code: 400, status: 'INVALID_ARGUMENT', message: e.message } } }; }
      if (!masks.length) return { status: 400, json: { error: { code: 400, status: 'INVALID_ARGUMENT', message: 'no mask (would replace whole doc)' } } };
      const d = st.docs.get(id);
      if (pre && (!d || d.updateTime !== pre)) return { status: 400, json: { error: { code: 400, status: 'FAILED_PRECONDITION', message: 'pre' } } };
      if (ex === 'false' && d) return { status: 409, json: { error: { code: 409, status: 'ALREADY_EXISTS' } } };
      const body = JSON.parse(r.body), doc = d || { fields: {} };
      for (const segs of segsList) { const v = getAt(body.fields || {}, segs); if (v === undefined) delAt(doc.fields, segs); else setAt(doc.fields, segs, clone(v)); }
      doc.updateTime = st.ts(); st.docs.set(id, doc); st.patches.push({ id, masks, pre, ex });
      return { status: 200, json: { name: 'x/' + id, fields: clone(doc.fields), updateTime: doc.updateTime } };
    }
    return { status: 405, json: { error: { code: 405, status: 'X' } } };
  };
  const val = (st, id, segs) => { const d = st.docs.get(id); return d ? fv(getAt(d.fields, segs)) : undefined; };
  const mk = 'm-' + T.slice(0, 7);
  const A = async (name, opts, check) => { const st = opts.store || makeStore(); const log = []; const full = [];
    await run(name, Object.assign({ keychain: loggedIn, route: storeRoute(st), alertLog: log, fullLog: full }, opts), ctx => check(ctx, st, log, full)); };
  const titles = log => log.map(a => a.title).join(' | ');
  const RUN = 'scriptable:///run/Sabrly';

  // ---------- actions ----------
  const quietOpen = (n, ctx, log, title) => ok(n + ': result window, nothing opened', log.length === 1 && ctx.opened.length === 0 && (!title || log[0].title === title), ctx.opened.join() + ' / ' + titles(log));
  const BET = st => JSON.stringify(val(st, mk, ['days', T, 'h', 'h-beten']));
  await A('tick multi-step', { query: { a: 'tick', h: 'h-beten' } }, (ctx, st, log) => {
    ok('beten → [0,1,2]', BET(st) === '[0,1,2]', BET(st));
    quietOpen('tick', ctx, log, '„Beten“: Asr ✓');
    ok('result msg', log[0].message === '3 von 5 geschafft.' && log[0].actions.includes('Rückgängig'), JSON.stringify(log[0]));
    ok('patch uses precondition', st.patches.length === 1 && !!st.patches[0].pre);
    ok('mask quoted', st.patches[0].masks[0] === 'days.`' + T + '`.h.`h-beten`', st.patches[0].masks[0]);
    ok('other fields untouched', JSON.stringify(val(st, mk, ['days', T, 'h', 'h-lesen'])) === '1' && val(st, mk, ['days', T, 'mood']) === 4);
  });
  { const cache = JSON.stringify({ state, logs: {}, at: Date.now() });
    await A('tick uses cached habits', { files: [['/docs/sabrly-widget-data.json', cache]], query: { a: 'tick', h: 'h-beten' } }, (ctx, st, log) => {
      ok('cache: no state read', !st.gets.includes('state') && BET(st) === '[0,1,2]', JSON.stringify(st.gets));
    });
    await A('tick new habit not in cache', { files: [['/docs/sabrly-widget-data.json', cache]], store: makeStore((s, l) => { s.habits.push({ id: 'h-neu', name: 'Neu', emoji: '⭐', freq: 'daily', target: 1, labels: [], days: [0, 1, 2, 3, 4, 5, 6], time: '', created: ad(-1), archived: false }); }), query: { a: 'tick', h: 'h-neu' } }, (ctx, st, log) => {
      ok('cache miss → fresh state', st.gets.includes('state') && val(st, mk, ['days', T, 'h', 'h-neu']) === 1, JSON.stringify(st.gets));
    }); }
  await A('tick done habit', { query: { a: 'tick', h: 'h-lesen' } }, (ctx, st, log) => { ok('done → no write', st.patches.length === 0); quietOpen('done', ctx, log, '„1 Seite lesen“ ✓'); });
  await A('tick single', { store: makeStore((s, l) => { delete l[mk].days[T].h['h-lesen']; }), query: { a: 'tick', h: 'h-lesen' } }, (ctx, st, log) => {
    ok('lesen → 1', val(st, mk, ['days', T, 'h', 'h-lesen']) === 1); quietOpen('single', ctx, log, '„1 Seite lesen“ abgehakt ✓');
    ok('open count', log[0].message === 'Heute noch 1 offen.', log[0].message);
  });
  await A('tick new month doc', { store: makeStore((s, l) => { delete l[mk]; }), query: { a: 'tick', h: 'h-beten' } }, (ctx, st, log) => {
    ok('doc created with exists=false', st.patches[0] && st.patches[0].ex === 'false', JSON.stringify(st.patches));
    ok('new doc value [0]', BET(st) === '[0]');
  });
  { const st = makeStore(); st.failNext = 1;
    await A('tick conflict retry', { store: st, query: { a: 'tick', h: 'h-beten' } }, (ctx, st2, log) => {
      ok('retry after conflict', BET(st) === '[0,1,2]' && st.patches.length === 1, titles(log));
      ok('re-read month doc on retry', st.gets.filter(g => g === mk).length === 2, JSON.stringify(st.gets));
      quietOpen('retry', ctx, log);
    }); }
  { const st = makeStore(); st.failNext = 9;
    await A('tick conflict gives up', { store: st, query: { a: 'tick', h: 'h-beten' }, alerts: [{ index: 0 }] }, (ctx, s2, log) => {
      ok('gives up: message, stays in Scriptable', titles(log).includes('Hat nicht geklappt') && st.patches.length === 0 && ctx.opened.length === 0, titles(log));
    }); }
  { const st = makeStore(); st.netFail = true;
    await A('tick offline', { store: st, query: { a: 'tick', h: 'h-beten' }, alerts: [{ index: 0 }] }, (ctx, s2, log) => {
      ok('offline error shown, no open', titles(log).includes('Hat nicht geklappt') && log.some(a => /Internetverbindung/.test(a.message)) && ctx.opened.length === 0, JSON.stringify(log));
    }); }
  await A('tick unknown', { query: { a: 'tick', h: 'nope' } }, (ctx, st, log) => { ok('unknown habit: no write', !st.patches.length); quietOpen('unknown', ctx, log, 'Nicht gefunden'); });
  await A('tick archived', { query: { a: 'tick', h: 'h-alt' } }, (ctx, st, log) => ok('archived habit: no write', !st.patches.length && titles(log) === 'Nicht gefunden'));
  await A('tick not planned', { store: makeStore(s => { const wdT = (new Date().getDay() + 6) % 7; s.habits[1].days = [0, 1, 2, 3, 4, 5, 6].filter(d => d !== wdT); }), query: { a: 'tick', h: 'h-lesen' } },
    (ctx, st, log) => ok('not planned today: no write', !st.patches.length && /nicht geplant/.test(log[0].message)));
  await A('tick needs login', { keychain: [], query: { a: 'tick', h: 'h-beten' }, alerts: [{ index: 0, fields: ['z@x.de', 'geheim1'] }] }, (ctx, st, log) => {
    ok('login then tick', titles(log) === 'Bei Sabrly anmelden | „Beten“: Asr ✓' && BET(st) === '[0,1,2]', titles(log));
  });
  await A('tick login cancelled', { keychain: [], query: { a: 'tick', h: 'h-beten' }, alerts: [] }, (ctx, st) => ok('cancel login → nothing', !st.patches.length && !ctx.opened.length));
  await A('mood value', { query: { a: 'mood', v: '2' } }, (ctx, st, log) => {
    ok('mood → 2', val(st, mk, ['days', T, 'mood']) === 2 && BET(st) === '[0,1]'); quietOpen('mood', ctx, log, 'Stimmung gespeichert 😕');
  });
  await A('mood bad value', { query: { a: 'mood', v: '9' } }, (ctx, st, log) => ok('mood 9 ignored', !st.patches.length && val(st, mk, ['days', T, 'mood']) === 4));
  await A('todo', { query: { a: 'todo', t: 't1' } }, (ctx, st, log) => {
    const td = val(st, 'state', ['todos'])[0];
    ok('todo done', td.done === true && td.doneAt === T && td.prio === 'h' && td.title === 'Reifen' && td.due === T, JSON.stringify(td));
    ok('todo mask only todos', st.patches[0].masks.join() === 'todos' && !!st.patches[0].pre);
    ok('habits untouched', val(st, 'state', ['habits']).length === 4 && val(st, 'state', ['settings', 'userName']) === 'Zeynel');
    quietOpen('todo', ctx, log, '„Reifen“ erledigt ✓');
  });
  await A('todo already done', { store: makeStore(s => { s.todos[0].done = true; }), query: { a: 'todo', t: 't1' } }, (ctx, st, log) => ok('todo already done', !st.patches.length && /schon erledigt/.test(log[0].message)));
  await A('direct tick + undo', { query: { a: 'tick', h: 'h-beten' }, alerts: [{ index: 1 }, { index: 0 }] }, (ctx, st, log) => ok('direct undo restores', BET(st) === '[0,1]' && titles(log).includes('Rückgängig gemacht'), titles(log)));
  await A('direct todo + undo', { query: { a: 'todo', t: 't1' }, alerts: [{ index: 1 }, { index: 0 }] }, (ctx, st) => ok('direct todo undo', val(st, 'state', ['todos'])[0].done === false));
  await A('no Safari anywhere', { query: { a: 'heute' }, alerts: [] }, (ctx, st, log) => ok('picker has no open-app item', !log[0].actions.some(x => /öffnen/.test(x)), JSON.stringify(log[0].actions)));
  // pickers (when run in Scriptable itself) still show a result with undo
  await A('menu → Heute abhaken', { alerts: [{ index: 0 }, { index: 0 }, { index: 0 }] }, (ctx, st, log) => {
    ok('menu first item ticks', BET(st) === '[0,1,2]', titles(log));
    ok('picker result window', titles(log).includes('„Beten“: Asr ✓') && log.some(a => a.message === '3 von 5 geschafft.') && !ctx.opened.length, titles(log));
  });
  await A('picker tick + undo', { query: { a: 'heute' }, alerts: [{ index: 0 }, { index: 1 }, { index: 0 }] }, (ctx, st, log) => {
    ok('undo restores [0,1]', BET(st) === '[0,1]', BET(st)); ok('undo confirmed', titles(log).includes('Rückgängig gemacht'), titles(log));
  });
  await A('picker single + undo deletes', { store: makeStore((s, l) => { delete l[mk].days[T].h['h-lesen']; }), query: { a: 'heute' }, alerts: [{ index: 1 }, { index: 1 }, { index: 0 }] }, (ctx, st, log) => {
    ok('picked lesen then undo deletes field', val(st, mk, ['days', T, 'h', 'h-lesen']) === undefined && BET(st) === '[0,1]' && st.patches.length === 2, titles(log));
  });
  await A('today picker lists', { query: { a: 'heute' }, alerts: [] }, (ctx, st, log) => {
    ok('today lists only open', log[0].actions[0] === '🤲  Beten · Asr  (2/5)' && !log[0].actions.some(x => /lesen|Training/.test(x)), JSON.stringify(log[0].actions));
  });
  await A('today picker → mood', { query: { a: 'heute' }, alerts: [{ index: 1 }, { index: 0 }, { index: 0 }] }, (ctx, st) => ok('today → mood 1', val(st, mk, ['days', T, 'mood']) === 1));
  await A('today picker → todos', { query: { a: 'heute' }, alerts: [{ index: 2 }, { index: 0 }, { index: 0 }] }, (ctx, st) => ok('today → todo done', val(st, 'state', ['todos'])[0].done === true));
  await A('today all done', { store: makeStore((s, l) => { l[mk].days[T].h['h-beten'] = [0, 1, 2, 3, 4]; }), query: { a: 'heute' }, alerts: [] }, (ctx, st, log) => ok('all done message', /Alles für heute erledigt/.test(log[0].message), log[0].message));
  await A('mood picker', { query: { a: 'mood' }, alerts: [{ index: 4 }, { index: 0 }] }, (ctx, st, log) => {
    ok('picker marks current', log[0].actions.includes('🙂  ✓'), JSON.stringify(log[0])); ok('picker → 5', val(st, mk, ['days', T, 'mood']) === 5);
  });
  await A('mood picker undo', { query: { a: 'mood' }, alerts: [{ index: 0 }, { index: 1 }, { index: 0 }] }, (ctx, st) => ok('mood undo → 4', val(st, mk, ['days', T, 'mood']) === 4));
  await A('todo picker', { store: makeStore(s => { s.todos.push({ id: 't2', title: 'Später', prio: 'l', due: ad(3), time: '', done: false }); }), query: { a: 'aufgaben' }, alerts: [{ index: 1 }, { index: 0 }] }, (ctx, st, log) => {
    ok('todo picker lists', log[0].actions[0] === 'Reifen' && /^Später  · \w\w, \d+\.$/.test(log[0].actions[1]), JSON.stringify(log[0].actions));
    ok('todo picker → t2 done', val(st, 'state', ['todos'])[1].done === true && val(st, 'state', ['todos'])[0].done === false);
  });
  await A('todo picker undo', { query: { a: 'aufgaben' }, alerts: [{ index: 0 }, { index: 1 }, { index: 0 }] }, (ctx, st) => {
    const td = val(st, 'state', ['todos'])[0]; ok('todo undo', td.done === false && td.doneAt === undefined, JSON.stringify(td));
  });
  await A('todo picker no open item', { query: { a: 'aufgaben' }, alerts: [] }, (ctx, st, log) => ok('todo picker: only todos', JSON.stringify(log[0].actions) === '["Reifen"]', JSON.stringify(log[0].actions)));


  // ---------- Kurzbefehle (background, no UI) ----------
  const S2 = async (name, opts, check) => { const out = []; let err = null; const st = opts.store || makeStore(); const log = [];
    const ctx = makeEnv(Object.assign({ keychain: loggedIn, route: storeRoute(st), alertLog: log, out, siri: true }, opts));
    try { await runScript(code, ctx); } catch (e) { err = e; }
    try { check({ ctx, st, log, out, err }); } catch (e) { ok(name, false, 'EXCEPTION ' + e.message); } };
  await S2('sc tick by name', { sp: 'Beten' }, ({ st, log, out, err }) => ok('shortcut ticks Beten silently', !err && BET(st) === '[0,1,2]' && log.length === 0 && out[0] === '„Beten“: Asr ✓ – 3 von 5 geschafft.', (err && err.message) + ' ' + JSON.stringify(out) + titles(log)));
  await S2('sc tick prefix + case', { sp: 'habit: 1 seite' , store: makeStore((s, l) => { delete l[mk].days[T].h['h-lesen']; }) }, ({ st, err, out }) => ok('shortcut partial name', !err && val(st, mk, ['days', T, 'h', 'h-lesen']) === 1 && /abgehakt/.test(out[0]), err && err.message));
  await S2('sc plainTexts', { texts: ['Beten'] }, ({ st, err }) => ok('shortcut via plainTexts', !err && BET(st) === '[0,1,2]', err && err.message));
  await S2('sc done', { sp: 'Beten', store: makeStore((s, l) => { l[mk].days[T].h['h-beten'] = [0, 1, 2, 3, 4]; }) }, ({ st, err, out }) => ok('shortcut done → no write, no error', !err && !st.patches.length && /schon erledigt/.test(out[0]), err && err.message));
  await S2('sc unknown', { sp: 'Joggen' }, ({ st, err, log }) => ok('shortcut unknown → error, no write, no window', err && /Joggen/.test(err.message) && !st.patches.length && !log.length, err && err.message));
  await S2('sc mood', { sp: 'Stimmung: 5' }, ({ st, err, out }) => ok('shortcut mood', !err && val(st, mk, ['days', T, 'mood']) === 5 && out[0] === 'Stimmung gespeichert 😄', err && err.message));
  await S2('sc logged out', { sp: 'Beten', keychain: [] }, ({ st, err, log }) => ok('shortcut logged out → error, no login window', err && /Nicht angemeldet/.test(err.message) && !log.length && !st.patches.length, err && err.message));
  { const st = makeStore(); st.netFail = true;
    await S2('sc offline', { sp: 'Beten', store: st }, ({ err, log }) => ok('shortcut offline → error', err && /Internetverbindung/.test(err.message) && !log.length, err && err.message)); }
  await S2('sc new habit not in cache', { sp: 'Neu', files: [['/docs/sabrly-widget-data.json', JSON.stringify({ state, logs: {}, at: Date.now() })]], store: makeStore(s => { s.habits.push({ id: 'h-neu', name: 'Neu', emoji: '⭐', freq: 'daily', target: 1, labels: [], days: [0, 1, 2, 3, 4, 5, 6], time: '', created: ad(-1), archived: false }); }) },
    ({ st, err }) => ok('shortcut finds new habit after fresh load', !err && val(st, mk, ['days', T, 'h', 'h-neu']) === 1, err && err.message));
  await S2('sc empty param → normal app', { sp: '', alerts: [] }, ({ log }) => ok('empty parameter shows menu', titles(log) === 'Sabrly-Widget', titles(log)));


  // ---------- Gebet (Uhrzeit, Sperre, Isha nach Mitternacht, Mitteilungen) ----------
  {
    const T0 = '050007001200143017001830', T1 = '050107011200142917001829';
    const at = (h, m, off = 0) => { const d = new Date(T + 'T00:00:00'); d.setDate(d.getDate() + off); return d.getTime() + (h * 60 + m) * 60000; };
    const day = off => { const d = new Date(T + 'T00:00:00'); d.setDate(d.getDate() + off); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const D0 = day(0), D1 = day(1), Dm1 = day(-1), mk0 = 'm-' + D0.slice(0, 7), mk1 = 'm-' + D1.slice(0, 7);
    const pStore = mut => makeStore((s, l) => {
      s.settings.prayer = { on: true, habit: '', city: { id: 99999, name: 'Teststadt' }, travel: null, buf: 30, notify: true, since: day(-3) };
      for (const d of [Dm1, D0, D1]) { const k = 'm-' + d.slice(0, 7); l[k] = l[k] || { days: {} }; l[k].days[d] = l[k].days[d] || {}; l[k].days[d].h = l[k].days[d].h || {}; delete l[k].days[d].h['h-beten']; }
      if (mut) mut(s, l);
    });
    const setDay = (l, d, v) => { const k = 'm-' + d.slice(0, 7); l[k] = l[k] || { days: {} }; l[k].days[d] = Object.assign(l[k].days[d] || {}, v); };
    const timesJson = { id: 99999, days: { [day(-2)]: T0, [Dm1]: T0, [D0]: T0, [D1]: T1, [day(2)]: T1 } };
    const pRoute = st => async r => r.url.includes('/gebetszeiten/z/99999.json') ? { status: 200, json: timesJson } : storeRoute(st)(r);
    const PA = async (name, opts, check) => { const st = opts.store; const log = [], out = [], notifs = opts.notifs || [], removed = [];
      await run(name, Object.assign({ keychain: loggedIn, alertLog: log, out, notifs, removed }, opts, { route: pRoute(st) }), ctx => check(ctx, st, log, out, notifs, removed)); };
    const hb = (st, d) => JSON.stringify(val(st, 'm-' + d.slice(0, 7), ['days', d, 'h', 'h-beten']));
    const ptv = (st, d, i) => val(st, 'm-' + d.slice(0, 7), ['days', d, 'pt', String(i)]);

    await PA('prayer tick current', { now: at(13, 0), query: { a: 'tick', h: 'h-beten' }, alerts: [{ index: 0 }],
      store: pStore((s, l) => setDay(l, D0, { h: Object.assign(l[mk0].days[D0].h, { 'h-beten': [0] }), pt: { 0: 340 }, pz: T0 + '|0501' })) }, (ctx, st, log) => {
      ok('prayer: Dhuhr ticked at 13:00', hb(st, D0) === '[0,1]' && ptv(st, D0, 1) === 780, hb(st, D0) + ' ' + ptv(st, D0, 1));
      ok('prayer: result 68 %', log[0] && log[0].title === '„Beten“: Dhuhr ✓' && log[0].message === 'Wertung 68 %', JSON.stringify(log[0]));
      const pa = st.patches[0]; ok('prayer: one patch, both fields', st.patches.length === 1 && pa.masks.includes('days.`' + D0 + '`.h.`h-beten`') && pa.masks.includes('days.`' + D0 + '`.pt.`1`') && pa.masks.length === 2 && !!pa.pre, JSON.stringify(pa));
      ok('prayer: earlier time kept', ptv(st, D0, 0) === 340);
    });
    const yDone = (s, l) => setDay(l, Dm1, { h: Object.assign(l['m-' + Dm1.slice(0, 7)].days[Dm1].h, { 'h-beten': [0, 1, 2, 3, 4] }) });
    await PA('prayer 4am yesterday Isha', { now: at(4, 0), query: { a: 'tick', h: 'h-beten' }, alerts: [{ index: 0 }], store: pStore() }, (ctx, st, log) =>
      ok('prayer: 04:00 offers yesterday Isha (last third = 10 %)', log[0] && log[0].title === '„Beten“: Isha (gestern) ✓' && log[0].message === 'Wertung 10 %', JSON.stringify(log[0])));
    await PA('prayer locked', { now: at(4, 0), query: { a: 'tick', h: 'h-beten' }, alerts: [{ index: 0 }], store: pStore(yDone) }, (ctx, st, log) =>
      ok('prayer: before Fajr locked', !st.patches.length && log[0] && log[0].message === 'Fajr beginnt um 05:00.', JSON.stringify(log[0])));
    await PA('prayer snapshot', { now: at(5, 40), query: { a: 'tick', h: 'h-beten' }, alerts: [{ index: 0 }], store: pStore() }, (ctx, st, log) => {
      ok('prayer: Fajr 75 % + snapshot', ptv(st, D0, 0) === 340 && val(st, mk0, ['days', D0, 'pz']) === T0 + '|0501' && val(st, mk0, ['days', D0, 'pc']) === 99999 && log[0].message === 'Wertung 75 %', JSON.stringify(log[0]) + ' ' + JSON.stringify(st.patches));
    });
    await PA('prayer Isha after midnight', { now: at(0, 30, 1), query: { a: 'tick', h: 'h-beten' }, alerts: [{ index: 0 }],
      store: pStore((s, l) => setDay(l, D0, { h: Object.assign(l[mk0].days[D0].h, { 'h-beten': [0, 1, 2, 3] }), pz: T0 + '|0501' })) }, (ctx, st, log) => {
      ok('prayer: yesterday Isha at 00:30 = 20 %', hb(st, D0) === '[0,1,2,3,4]' && ptv(st, D0, 4) === 1470 && log[0].title === '„Beten“: Isha (gestern) ✓' && log[0].message === 'Wertung 20 %', JSON.stringify(log[0]) + hb(st, D0));
      ok('prayer: today untouched', !st.patches.some(p => p.masks.some(m => m.includes(D1))));
    });
    await PA('prayer undo', { now: at(13, 0), query: { a: 'tick', h: 'h-beten' }, alerts: [{ index: 1 }, { index: 0 }],
      store: pStore((s, l) => setDay(l, D0, { h: Object.assign(l[mk0].days[D0].h, { 'h-beten': [0] }), pt: { 0: 340 }, pz: T0 + '|0501' })) }, (ctx, st) =>
      ok('prayer: undo removes tick + time', hb(st, D0) === '[0]' && ptv(st, D0, 1) === undefined && ptv(st, D0, 0) === 340));
    await PA('prayer notif action', { now: at(15, 0), query: { a: 'ptick', d: D0, i: '2' }, alerts: [{ index: 0 }],
      store: pStore((s, l) => setDay(l, D0, { h: Object.assign(l[mk0].days[D0].h, { 'h-beten': [0, 1] }) })) }, (ctx, st, log) =>
      ok('prayer: Asr from notification = 80 %', ptv(st, D0, 2) === 900 && hb(st, D0) === '[0,1,2]' && log[0].message === 'Wertung 80 %', JSON.stringify(log[0])));
    await PA('prayer notif action early', { now: at(15, 0), query: { a: 'ptick', d: D0, i: '3' }, alerts: [{ index: 0 }], store: pStore() }, (ctx, st, log) =>
      ok('prayer: Maghrib not yet', !st.patches.length && log[0].message === 'Maghrib beginnt um 17:00.', JSON.stringify(log[0])));
    await PA('prayer notif tap', { now: at(14, 40), notification: { title: '🕌 Asr · 14:30', userInfo: { sabrly: 'p', d: D0, i: 2 } }, alerts: [{ index: 0 }, { index: 0 }], store: pStore() }, (ctx, st, log) =>
      ok('prayer: tap asks, then ticks', log[0].title === '🕌 Asr · 14:30' && log[0].message === 'Hast du gebetet?' && ptv(st, D0, 2) === 880, JSON.stringify(log.map(a => a.title))));
    await PA('prayer notif tap later', { now: at(14, 40), notification: { title: '🕌 Asr · 14:30', userInfo: { sabrly: 'p', d: D0, i: 2 } }, alerts: [{ index: -1 }], store: pStore() }, (ctx, st) =>
      ok('prayer: Später = nothing', !st.patches.length));
    { await PA('prayer shortcut', { now: at(13, 0), siri: true, sp: 'Beten', store: pStore((s, l) => setDay(l, D0, { h: Object.assign(l[mk0].days[D0].h, { 'h-beten': [0] }), pt: { 0: 340 }, pz: T0 + '|0501' })) }, (ctx, st, log, o) =>
        ok('prayer: shortcut ticks Dhuhr', o[0] === '„Beten“: Dhuhr ✓ – Wertung 68 %' && !log.length, JSON.stringify(o))); }
    // Widget: Pille, Restzeit, Mitteilungen, Aktualisierung
    const notifs = [];
    await PA('prayer widget', { now: at(13, 0), inWidget: true, family: 'small', param: 'habit: Beten', notifs,
      store: pStore((s, l) => setDay(l, D0, { h: Object.assign(l[mk0].days[D0].h, { 'h-beten': [0] }), pt: { 0: 340 }, pz: T0 + '|0501' })) }, (ctx, st, log, out, ns) => {
      ok('prayer widget: pill + countdown', ctx.texts.includes('Dhuhr abhaken') && ctx.texts.includes('noch 1:30 h') && ctx.setW.url === RUN + '?a=tick&h=h-beten', ctx.texts.join('|'));
      const ids = ns.filter(n => n.id.startsWith('sabrly-p-')).map(n => n.id).sort();
      const exp = [2, 3, 4].map(i => 'sabrly-p-' + D0 + '-' + i).concat([0, 1, 2, 3, 4].map(i => 'sabrly-p-' + D1 + '-' + i)).sort();
      ok('prayer widget: 8 notifications', JSON.stringify(ids) === JSON.stringify(exp), JSON.stringify(ids));
      const asr = ns.find(n => n.id === 'sabrly-p-' + D0 + '-2');
      ok('prayer notif content', asr && asr.title === '🕌 Asr · 14:30' && asr.body === 'Zeit bis 16:30' && asr.at === at(14, 30) && asr.actions[0][0] === 'Gebetet ✓' && asr.actions[0][1] === RUN + '?a=ptick&d=' + D0 + '&i=2' && asr.userInfo.sabrly === 'p', JSON.stringify(asr));
      const fajr = ns.find(n => n.id === 'sabrly-p-' + D1 + '-0');
      ok('prayer notif Fajr text', fajr && fajr.body === 'Am besten 06:21–06:51 · Sonnenaufgang 07:01' && fajr.title === '🕌 Fajr · 05:01', JSON.stringify(fajr));
      ok('prayer widget refresh before next prayer', ctx.setW.refreshAfterDate.getTime() === at(13, 15), String(ctx.setW.refreshAfterDate.getTime() - at(13, 0)));
      ok('notif file saved', !!ctx.files.get('/docs/sabrly-notif.json'));
    });
    { const ns = [];
      await PA('prayer menu schedules', { now: at(13, 0), alerts: [], notifs: ns, store: pStore() }, (ctx, st, log, out, n) =>
        ok('prayer: opening the script plans notifications', n.filter(x => x.id.startsWith('sabrly-p-')).length === 8 && log[0] && log[0].title === 'Sabrly-Widget', n.length + ' ' + (log[0] && log[0].title))); }
    // Sonntags-Erinnerung „Woche planen“
    { const dd = new Date(D0 + 'T12:00:00'), wdi = (dd.getDay() + 6) % 7, ws = new Date(dd.getTime() - wdi * 864e5), sun = new Date(ws.getTime() + 6 * 864e5);
      const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), WS = iso(ws), NWS = iso(new Date(ws.getTime() + 7 * 864e5));
      const sunAt = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate(), 18, 0).getTime();
      await PA('week notif', { now: at(13, 0), inWidget: true, family: 'small', param: '', store: pStore((s, l) => { setDay(l, D0, { mood: 4 }); }) }, (ctx, st, log, out, ns) => {
        const w = ns.find(n => n.id === 'sabrly-week-' + WS);
        ok('week notif: Sunday 18:00 with review', w && w.at === sunAt && w.title === '📅 Woche planen' && /Habits \d+ %/.test(w.body) && w.body.includes('Stimmung 🙂') && w.userInfo.sabrly === 'w', JSON.stringify(w));
        ok('week notif file saved', !!ctx.files.get('/docs/sabrly-week.json'));
      });
      await PA('week notif off', { now: at(13, 0), inWidget: true, family: 'small', param: '', files: [['/docs/sabrly-week.json', JSON.stringify({ id: 'sabrly-week-' + WS, at: sunAt, body: 'x' })]],
        store: pStore(s => { s.settings.weekNotify = false; }) }, (ctx, st, log, out, ns, rm) =>
        ok('week notif: switched off removes it', rm.includes('sabrly-week-' + WS) && !ns.some(n => n.id.startsWith('sabrly-week')), JSON.stringify(rm)));
      await PA('week notif planned', { now: at(13, 0), inWidget: true, family: 'small', param: '', store: pStore(s => { s.training = { days: [], weeks: { [NWS]: { d: { 0: ['d-1'] } } } }; }) }, (ctx, st, log, out, ns) =>
        ok('week notif: none when next week is planned', !ns.some(n => n.id.startsWith('sabrly-week')), JSON.stringify(ns.map(n => n.id))));
      await PA('week notif tap', { now: at(18, 5), notification: { title: '📅 Woche planen', body: 'Habits 80 %', userInfo: { sabrly: 'w', ws: WS } }, alerts: [{ index: 0 }], store: pStore() }, (ctx, st, log) =>
        ok('week notif: tap shows review', log[0] && log[0].title === '📅 Woche planen' && log[0].message.includes('Habits 80 %') && !st.patches.length, JSON.stringify(log[0])));
    }
    await PA('prayer widget refresh hint', { now: at(14, 20), inWidget: true, family: 'small', param: 'habit: Beten', store: pStore() }, ctx =>
      ok('prayer widget: refresh at Asr start', ctx.setW.refreshAfterDate.getTime() === at(14, 31), String((ctx.setW.refreshAfterDate.getTime() - at(14, 20)) / 60000)));
    await PA('prayer widget locked', { now: at(4, 0), inWidget: true, family: 'small', param: 'habit: Beten', store: pStore(yDone) }, ctx =>
      ok('prayer widget: locked pill', ctx.texts.includes('Fajr ab 05:00') && ctx.setW.url === RUN + '?a=heute', ctx.texts.join('|')));
    await PA('prayer notify off', { now: at(13, 0), inWidget: true, family: 'small', param: '', files: [['/docs/sabrly-notif.json', JSON.stringify([{ id: 'sabrly-p-x-1', at: 1, title: 'a', body: 'b' }])]],
      store: pStore(s => { s.settings.prayer.notify = false; }) }, (ctx, st, log, out, ns, rm) =>
      ok('prayer: notify off removes pending', rm.includes('sabrly-p-x-1') && ctx.files.get('/docs/sabrly-notif.json') === '[]', JSON.stringify(rm)));
    await PA('prayer picker label', { now: at(13, 0), query: { a: 'heute' }, alerts: [], store: pStore((s, l) => setDay(l, D0, { h: Object.assign(l[mk0].days[D0].h, { 'h-beten': [0] }), pt: { 0: 340 } })) }, (ctx, st, log) =>
      ok('prayer: picker shows current prayer', log[0] && log[0].actions[0] === '🤲  Beten · Dhuhr  (1/5)', JSON.stringify(log[0] && log[0].actions)));
    await PA('prayer off fallback', { now: at(13, 0), query: { a: 'tick', h: 'h-beten' }, alerts: [{ index: 0 }], store: pStore((s, l) => { s.settings.prayer.on = false; setDay(l, D0, { h: Object.assign(l[mk0].days[D0].h, { 'h-beten': [0] }) }); }) }, (ctx, st) =>
      ok('prayer off: plain next step, no time', hb(st, D0) === '[0,1]' && ptv(st, D0, 1) === undefined));
  }
  // ---------- widget variants ----------
  const W = async (name, fam, param, check, store) => A(name, { inWidget: true, family: fam, param, store }, ctx => { ok(name + ' set', !!ctx.setW); check(ctx, ctx.texts.join(' | ')); });
  for (const fam of ['small', 'medium', 'large', 'extraLarge'])
    for (const p of ['woche', 'habit', 'habit: lesen', 'Training', 'stimmung', 'aufgaben', 'heute', 'Mood', 'WOCHE', 'vers', 'Satz', 'monat', 'serie', 'serie: lesen', 'übersicht', ''])
      await W('variant ' + fam + ' ' + p, fam, p, (ctx, t) => ok('variant ' + fam + ' ' + p + ' has bg', ctx.setW.backgroundImage && ctx.setW.backgroundImage.img === true));
  const wt = (() => { const ms = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']; const d = new Date(); const wd = (d.getDay() + 6) % 7; const a = new Date(d); a.setDate(d.getDate() - wd); const b = new Date(a); b.setDate(a.getDate() + 6);
    return a.getMonth() === b.getMonth() ? ms[a.getMonth()] + ' ' + a.getDate() + '–' + b.getDate() : ms[a.getMonth()] + ' ' + a.getDate() + ' – ' + ms[b.getMonth()] + ' ' + b.getDate(); })();

  // ---------- minimal variants ----------
  await W('list large', 'large', 'heute', (ctx, t) => {
    ok('list order = app order', t.indexOf('Beten') < t.indexOf('1 Seite lesen') && t.indexOf('1 Seite lesen') < t.indexOf('Training'), t);
    ok('list count + dots', ctx.texts.includes('2/3') && ctx.texts.includes('2/5') && ctx.placed.length === 3, t + ' ' + ctx.placed.length);
    ok('list tick only open', ctx.urls.includes(RUN + '?a=tick&h=h-beten') && !ctx.urls.some(u => /h=h-lesen|h=h-sport/.test(u)), ctx.urls.join(' '));
  });
  await W('list medium cols', 'medium', 'heute', (ctx, t) => ok('medium 2 columns, +weitere', ctx.placed.length === 5 && t.includes('+3 weitere'), ctx.placed.length + ' ' + t),
    makeStore(s => { for (let i = 0; i < 5; i++) s.habits.push({ id: 'x' + i, name: 'Extra ' + i, emoji: '⭐', freq: 'daily', target: 1, labels: [], days: [0, 1, 2, 3, 4, 5, 6], time: '', created: ad(-2), archived: false }); }));
  await W('list large many', 'large', '', (ctx, t) => ok('large 8 rows + weitere', ctx.placed.length === 8 && t.includes('+4 weitere'), ctx.placed.length + ' ' + t),
    makeStore(s => { for (let i = 0; i < 9; i++) s.habits.push({ id: 'x' + i, name: 'Extra ' + i, emoji: '⭐', freq: 'daily', target: 1, labels: [], days: [0, 1, 2, 3, 4, 5, 6], time: '', created: ad(-2), archived: false }); }));
  await W('list empty', 'large', 'heute', (ctx, t) => ok('list empty text', t.includes('Heute keine Habits geplant'), t), makeStore(s => { s.habits = []; }));
  await W('list stale', 'large', 'heute', (ctx, t) => ok('no stale note when fresh', !t.includes('Offline'), t));
  await W('quote medium', 'medium', 'vers', (ctx, t) => ok('quote shows verse + source', ctx.texts.includes('VERS DES TAGES') && t.includes('Wahrlich, mit der Erschwernis') && t.includes('— Sure 94:6'), t));
  await W('quote satz', 'large', 'satz', (ctx, t) => ok('quote satz label', ctx.texts.includes('SATZ DES TAGES') && t.includes('Klein anfangen') && !t.includes('—'), t),
    makeStore(s => { s.quotes = [{ id: 'q2', type: 'satz', t: 'Klein anfangen.', src: '' }]; }));
  await W('quote none', 'small', 'vers', (ctx, t) => ok('quote none hint', t.includes('Noch keine Sätze'), t), makeStore(s => { s.quotes = []; }));
  await W('quote long', 'small', 'vers', (ctx, t) => ok('long quote renders', t.includes('xxxx'), t), makeStore(s => { s.quotes = [{ id: 'q3', type: 'vers', t: 'x'.repeat(400), src: 'Lang' }]; }));
  await W('month medium', 'medium', 'monat', (ctx, t) => {
    const mn = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'][new Date().getMonth()];
    ok('month name + avg', ctx.texts.includes(mn) && ctx.texts.some(x => /^\d+%$/.test(x)) && t.includes('Ø diesen Monat'), t);
    ok('month grid image', ctx.images.length > 0 && ctx.placed.length === 1, ctx.placed.length);
  });
  await W('month large', 'large', 'monat', (ctx, t) => ok('month large stats line', /perfekte Tage|perfekter Tag/.test(t) && ctx.texts.includes('ring:1') && ctx.texts.includes('ring:30') && ctx.texts.includes('ring:M'), t));
  await W('month small', 'small', 'kalender', (ctx, t) => ok('month small', t.includes('Ø') && ctx.placed.length === 1, t));
  await W('streak small', 'small', 'serie', (ctx, t) => ok('streak best habit', ctx.texts.includes('5') && t.includes('Tage Serie') && t.includes('1 Seite lesen'), t));
  await W('streak named', 'small', 'serie: Beten', (ctx, t) => ok('streak named habit', t.includes('Beten') && !t.includes('lesen'), t));
  await W('streak weekly', 'small', 'serie: Training', (ctx, t) => ok('streak weekly unit', t.includes('Training') && (t.includes('Wochen Serie') || t.includes('Heute starten')), t));
  await W('streak medium', 'medium', 'serie', (ctx, t) => ok('streak medium top 3', t.includes('Serien') && t.includes('Beten') && t.includes('Training'), t));
  await W('streak large', 'large', 'serie', (ctx, t) => ok('streak large list', t.includes('Wochen') && t.includes('Tage'), t));
  await W('streak unknown', 'small', 'serie: Joggen', (ctx, t) => ok('streak unknown', t.includes('Kein Habit gefunden'), t));
  await W('default medium = list', 'medium', '', (ctx, t) => ok('default medium is list', ctx.texts.includes('Heute') && !ctx.texts.some(x => x.startsWith('ring:')), t));
  await W('default small = ring', 'small', '', (ctx, t) => ok('default small is ring', ctx.texts.some(x => x.startsWith('ring:')), t));

  await W('week medium', 'medium', 'woche', (ctx, t) => {
    ok('week title ' + wt, ctx.texts.includes(wt), t);
    ok('week letters', ['M', 'D', 'F', 'S'].every(l => ctx.texts.includes(l)) && ctx.texts.filter(x => x === 'M').length === 2);
    ok('week rows', t.includes('🤲  Beten') && t.includes('📚  1 Seite lesen') && t.includes('🏋️  Training') && !t.includes('Archiviert'), t);
    ok('week 21 dots', ctx.placed.length === 21, ctx.placed.length);
    ok('week row tick only open', ctx.urls.includes(RUN + '?a=tick&h=h-beten') && !ctx.urls.some(u => /h=h-lesen|h=h-sport/.test(u)), ctx.urls.join(' '));
    ok('week widget url', ctx.setW.url === RUN + '?a=heute', ctx.setW.url);
  });
  await W('week small', 'small', 'woche', (ctx, t) => ok('week small emoji only', !t.includes('Beten') && ctx.texts.includes('🤲') && ctx.placed.length === 21, t));
  await W('week large many', 'large', 'woche', (ctx, t) => ok('week large caps 8 rows', ctx.placed.length === 56 && t.includes('+4 weitere'), ctx.placed.length + ' ' + t),
    makeStore(s => { for (let i = 0; i < 9; i++) s.habits.push({ id: 'x' + i, name: 'Extra ' + i, emoji: '⭐', freq: 'daily', target: 1, labels: [], days: [0, 1, 2, 3, 4, 5, 6], time: '', created: ad(-2), archived: false }); }));
  await W('habit auto', 'small', 'habit', (ctx, t) => {
    ok('habit picks open Beten', t.includes('Beten') && ctx.texts.includes('Asr abhaken') && ctx.texts.includes('ring:2/5'), t);
    ok('habit url tick', ctx.setW.url === RUN + '?a=tick&h=h-beten', ctx.setW.url);
  });
  await W('habit named done', 'small', 'habit: lesen', (ctx, t) => ok('named done habit', t.includes('1 Seite lesen') && ctx.texts.includes('Erledigt ✓') && ctx.setW.url === RUN + '?a=heute', t + ' ' + ctx.setW.url));
  await W('habit bare name', 'medium', 'Training', (ctx, t) => ok('bare name finds Training', t.includes('Training') && ctx.texts.includes('Erledigt ✓'), t));
  await W('habit single open', 'small', 'habit: 1 Seite', (ctx, t) => ok('single open shows Abhaken', ctx.texts.includes('Abhaken') && ctx.setW.url === RUN + '?a=tick&h=h-lesen', t),
    makeStore((s, l) => { delete l[mk].days[T].h['h-lesen']; }));
  await W('habit none', 'small', 'habit', (ctx, t) => ok('no habits message', t.includes('Kein Habit gefunden'), t), makeStore(s => { s.habits = []; }));
  const MOODS5 = ctx => ['😞', '😕', '😐', '🙂', '😄'].every(m => ctx.texts.includes(m));
  await W('mood small', 'small', 'stimmung', (ctx, t) => ok('mood small', t.includes('Heute: 🙂') && ctx.setW.url === RUN + '?a=mood' && MOODS5(ctx), t));
  await W('mood medium', 'medium', 'stimmung', (ctx, t) => ok('mood chip urls', [1, 2, 3, 4, 5].every(n => ctx.urls.includes(RUN + '?a=mood&v=' + n)), ctx.urls.join(' ')));
  await W('mood empty', 'small', 'stimmung', (ctx, t) => ok('mood empty prompt', t.includes('Wie fühlst du dich?'), t), makeStore((s, l) => { delete l[mk].days[T].mood; }));
  await W('todos medium', 'medium', 'aufgaben', (ctx, t) => {
    ok('todos list', t.includes('Reifen') && t.includes('1 offen') && t.includes('Aufgaben'), t);
    ok('todo row url', ctx.urls.includes(RUN + '?a=todo&t=t1') && ctx.setW.url === RUN + '?a=aufgaben', ctx.urls.join(' '));
  });
  await W('todos large meta', 'large', 'aufgaben', (ctx, t) => ok('todos overdue + later', t.includes('überfällig') && t.includes('Alt') && t.includes('Neu') && t.indexOf('Alt') < t.indexOf('Reifen') && t.indexOf('Reifen') < t.indexOf('Neu'), t),
    makeStore(s => { s.todos.push({ id: 't3', title: 'Neu', prio: 'l', due: ad(2), time: '09:00', done: false }, { id: 't4', title: 'Alt', prio: 'n', due: ad(-2), time: '', done: false }, { id: 't5', title: 'Fertig', prio: 'n', due: null, time: '', done: true }); }));
  await W('todos empty', 'medium', 'aufgaben', (ctx, t) => ok('todos empty', t.includes('Alles erledigt') && t.includes('0 offen'), t), makeStore(s => { s.todos = []; }));
  await W('overview row urls', 'medium', '', (ctx, t) => ok('overview ticks open rows only', ctx.urls.includes(RUN + '?a=tick&h=h-beten') && !ctx.urls.some(u => /h=h-lesen|h=h-sport/.test(u)) && ctx.setW.url === RUN + '?a=heute', ctx.urls.join(' ')));
  await A('lock url', { inAccessory: true, family: 'accessoryCircular' }, ctx => ok('lock url runs script', ctx.setW.url === RUN + '?a=heute'));
  await A('login msg url', { inWidget: true, family: 'small', keychain: [] }, ctx => ok('login widget url', ctx.setW.url === RUN, ctx.setW.url));
  await require('./garmin_sync_tests.js')({ run, ok, makeStore, storeRoute, val, T, ad, loggedIn });
};
