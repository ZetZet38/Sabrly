// Garmin-Test im Widget: Schlüssel, Token, Liste, Detail-Endpunkte, Aufzeichnung (ZIP → FIT), Bericht.
const fs = require('fs'), path = require('path');
module.exports = async ({ run, ok, loggedIn, goodRoute }) => {
  const FX = f => fs.readFileSync(path.join(__dirname, 'fixtures', f));
  const KEY = 'gpk_TESTKEY_0123456789abcdefABCDEF';
  const b64u = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const EXP = Math.floor(Date.now() / 1000) + 86400;
  const JWT = b64u({ alg: 'RS256' }) + '.' + b64u({ exp: EXP, sub: 'x??>?~', scope: ['READ_FITNESS'] }) + '.c2lnbmF0dXJl';
  const JWT2 = JWT.replace('c2lnbmF0dXJl', 'bmV1ZXJUb2tlbg');
  const run1 = { activityId: 20001, activityName: 'Dormagen Intervalle', startTimeLocal: '2026-11-09 18:00:00', activityType: { typeKey: 'running' }, distance: 3390, duration: 1320, averageHR: 148, maxHR: 180, lapCount: 6,
    startLatitude: 51.0961, startLongitude: 6.8402, endLatitude: 51.0962, endLongitude: 6.8403, ownerDisplayName: 'zeynel_a', ownerFullName: 'Zeynel A', ownerProfileImageUrlSmall: 'https://img', userProfileId: 99, deviceId: 3456789012, locationName: 'Dormagen',
    splitSummaries: [{ splitType: 'INTERVAL_ACTIVE', noOfSplits: 2, distance: 800 }, { splitType: 'INTERVAL_RECOVERY', noOfSplits: 2 }], vO2MaxValue: 52 };
  const str1 = { activityId: 20002, activityName: 'Krafttraining', startTimeLocal: '2026-11-08 17:00:00', activityType: { typeKey: 'strength_training' }, duration: 600, averageHR: 110, maxHR: 150, lapCount: 1, totalSets: 2, totalReps: 18,
    summarizedExerciseSets: [{ category: 'BENCH_PRESS', reps: 18, volume: 1100, sets: 2 }] };
  const walk = { activityId: 20003, activityName: 'Gehen', startTimeLocal: '2026-11-07 12:00:00', activityType: { typeKey: 'walking' }, distance: 2100, duration: 1500 };
  const LIST = [run1, str1, walk];
  const mk = (over = {}) => {
    const calls = { token: 0, keys: [], bearer: [], paths: [] };
    const route = async r => {
      const u = r.url;
      if (u.startsWith('https://personal.connectapi.garmin.com/')) {
        const p = u.slice('https://personal.connectapi.garmin.com'.length); calls.paths.push(r.method + ' ' + p);
        if (p === '/personalapitoken-service/personal-api/personal-api-key/token') {
          calls.token++; calls.keys.push(r.headers.Authorization);
          if (r.method !== 'POST') return { status: 405, text: '' };
          if (over.tokenStatus) return { status: over.tokenStatus, text: 'Unauthorized' };
          if (r.headers.Authorization !== 'ApiKey ' + KEY) return { status: 401, text: 'Unauthorized' };
          return { status: 200, text: (calls.token > 1 ? JWT2 : JWT) + '\n' };
        }
        const auth = r.headers.Authorization || ''; calls.bearer.push(auth);
        if (!/^Bearer /.test(auth)) return { status: 401, text: '' };
        if (over.expireFirstBearer && auth === 'Bearer ' + JWT) return { status: 401, text: '' };
        if (r.headers.Accept !== (/download-service/.test(p) ? 'application/zip, application/x-zip-compressed, application/octet-stream' : 'application/json')) return { status: 406, text: 'bad accept' };
        if (p.startsWith('/activitylist-service/activities/search/activities?')) return over.list ? over.list() : { status: 200, json: LIST };
        let m;
        if ((m = p.match(/^\/activity-service\/activity\/(\d+)$/))) return { status: 200, json: { activityId: +m[1], locationName: 'Dormagen', summaryDTO: { startLatitude: 51.09, averageHR: 148, distance: 3390, elevationGain: 12 }, splitSummaries: run1.splitSummaries } };
        if ((m = p.match(/^\/activity-service\/activity\/(\d+)\/workouts$/))) return { status: 200, json: [] };
        if ((m = p.match(/^\/activity-service\/activity\/(\d+)\/splits$/))) return { status: 404, text: '' };
        if ((m = p.match(/^\/activity-service\/activity\/(\d+)\/(typedsplits|exerciseSets|hrTimeInZones)$/))) return over.probe500 ? { status: 500, text: '<html>Fehlerseite</html>' } : { status: 403, json: { message: 'not permitted' } };
        if ((m = p.match(/^\/download-service\/files\/activity\/(\d+)$/))) { if (over.dl404) return { status: 404, bytes: [] }; return { status: 200, bytes: m[1] === '20001' ? FX('run.zip') : m[1] === '20002' ? FX('strength.zip') : Buffer.from('not a zip at all ...') }; }
        return { status: 404, text: '' };
      }
      return goodRoute(r);
    };
    return { calls, route };
  };
  const keyed = extra => loggedIn.concat([['sabrly.garmin.key', KEY]], extra || []);
  const titles = ctx => ctx.shownAlerts.join(' > ');

  // 1) erster Start ohne Schlüssel: eingeben → Test → Bericht kopiert
  { const g = mk(), log = [];
    await run('garmin first run', { keychain: keyed(), route: g.route, alertLog: log, alerts: [{ index: 1 }, { index: 1 }, { index: 1 }] }, ctx => {
      const rep = ctx.board.v || ''; if (process.env.SHOWREP) require('fs').writeFileSync(process.env.SHOWREP, rep);
      ok('garmin: token via ApiKey header', g.calls.token === 1 && g.calls.keys[0] === 'ApiKey ' + KEY, JSON.stringify(g.calls.keys));
      ok('garmin: token cached with JWT exp', ctx.keychain.get('sabrly.garmin.tok') === JWT && Math.abs(Number(ctx.keychain.get('sabrly.garmin.texp')) - EXP * 1000) < 2, ctx.keychain.get('sabrly.garmin.texp'));
      ok('garmin: all GETs use Bearer token', g.calls.bearer.length > 10 && g.calls.bearer.every(b => b === 'Bearer ' + JWT), g.calls.bearer.length);
      ok('garmin: report copied', /^SABRLY GARMIN-TEST v1/.test(rep) && titles(ctx).includes('✓ Bericht kopiert'), titles(ctx));
      ok('garmin: report viewable', ctx.board.quick.length === 1 && ctx.board.quick[0] === rep);
      ok('garmin: list lines', rep.includes('2026-11-09 18:00 | running | Dormagen Intervalle | 3.39 km | 22:00 | HF 148/180 | Runden 6 | id 20001') && rep.includes('| strength_training |') && rep.includes('| walking |'), rep.slice(0, 900));
      ok('garmin: deep dives run+strength+other (no duplicate)', (rep.match(/^=== /gm) || []).length === 3, (rep.match(/^=== .*/gm) || []).join('\n'));
      ok('garmin: laps from FIT', /Runden: 6/.test(rep) && rep.includes('#2 active/time · 400 m · 2:00 · 5:00/km · HF 170/176 · Kad 168'), rep);
      ok('garmin: strength sets from FIT', /set \(3\):/.test(rep) && /"3":10/.test(rep), rep);
      ok('garmin: non-zip download reported, test continues', /\[Aufzeichnung\] Status 200 · \d+ B\n.*FIT-Fehler|Keine ZIP- und keine FIT-Datei/.test(rep), rep.split('=== walking')[1]);
      ok('garmin: probes reported', rep.includes('[splits] Status 404') && rep.includes('[exerciseSets] Status 403') && rep.includes('[workouts] Status 200 · []'), rep);
      ok('garmin: no location / owner / device id / key / token in report',
        !/51\.09|6\.840|612345678|81234567|zeynel_a|Zeynel A|https:\/\/img|3456789012|Dormagen"|userProfileId/.test(rep) && !rep.includes(KEY) && !rep.includes(JWT.split('.')[2]) && !rep.includes(JWT), rep.match(/51\.09|6\.840|612345678|81234567|zeynel_a|Zeynel A|img|3456789012|Dormagen"|userProfileId/g));
      ok('garmin: activity name kept', rep.includes('Dormagen Intervalle'));
      ok('garmin: list fetched with limit', g.calls.paths.includes('GET /activitylist-service/activities/search/activities?start=0&limit=20'), g.calls.paths.join('\n'));
    }); }
  // 2) Schlüssel aus der Zwischenablage, Zwischenablage danach geleert (vor dem Bericht)
  { const g = mk(), log = [];
    await run('garmin key from clipboard', { keychain: loggedIn, clipboard: KEY, route: g.route, alertLog: log, alerts: [{ index: 1 }, { index: 1 }, { index: 0 }] }, ctx => {
      ok('garmin: clipboard key stored', ctx.keychain.get('sabrly.garmin.key') === KEY);
      ok('garmin: clipboard cleared after reading key', ctx.board.v === ' ', JSON.stringify(ctx.board.v));
      ok('garmin: key entry starts a sync', g.calls.token === 1 && g.calls.paths.some(p => /activitylist/.test(p)), g.calls.paths.join(' '));
    }); }
  { const g = mk();
    await run('garmin key trimmed', { keychain: loggedIn, route: g.route, alerts: [{ index: 1 }, { index: 0, fields: ['  ' + KEY + '\n'] }, { index: 0 }] }, ctx =>
      ok('garmin: key stored trimmed', ctx.keychain.get('sabrly.garmin.key') === KEY, ctx.keychain.get('sabrly.garmin.key'))); }
  // 3) zu kurzer Schlüssel
  { const g = mk();
    await run('garmin short key', { keychain: loggedIn, route: g.route, alerts: [{ index: 1 }, { index: 0, fields: ['abc'] }, { index: 0 }] }, ctx => {
      ok('garmin: short key rejected locally', !ctx.keychain.has('sabrly.garmin.key') && titles(ctx).includes('Kein Schlüssel') && g.calls.token === 0, titles(ctx));
    }); }
  // 4) Garmin lehnt den Schlüssel ab → Hinweis, Abbrechen
  { const g = mk({ tokenStatus: 401 });
    await run('garmin rejected', { keychain: keyed(), route: g.route, alerts: [{ index: 1 }, { index: 1 }, { index: -1 }] }, ctx => {
      ok('garmin: rejected key → clear message', titles(ctx).includes('Schlüssel abgelehnt') && !titles(ctx).includes('Bericht kopiert') && ctx.board.v == null, titles(ctx));
    }); }
  // 5) abgelehnt → neuen Schlüssel eingeben → klappt
  { let n = 0; const g = mk(); const route = async r => { if (/personal-api-key\/token/.test(r.url) && n++ === 0) return { status: 403, text: '' }; return g.route(r); };
    await run('garmin rejected then new key', { keychain: loggedIn.concat([['sabrly.garmin.key', 'gpk_alterSchluessel_123456']]), route, alerts: [{ index: 1 }, { index: 1 }, { index: 0 }, { index: 0, fields: [KEY] }, { index: 0 }] }, ctx => {
      ok('garmin: retry with new key works', ctx.keychain.get('sabrly.garmin.key') === KEY && /^SABRLY GARMIN-TEST/.test(ctx.board.v || ''), titles(ctx));
    }); }
  // 6) gecachtes Token: kein neuer Token-Abruf
  { const g = mk();
    await run('garmin cached token', { keychain: keyed([['sabrly.garmin.tok', JWT], ['sabrly.garmin.texp', String((EXP - 10) * 1000)]]), route: g.route, alerts: [{ index: 1 }, { index: 1 }, { index: 0 }] }, ctx => {
      ok('garmin: cached token reused', g.calls.token === 0 && /Runden: 6/.test(ctx.board.v || ''), g.calls.token);
    }); }
  // 7) Token fast abgelaufen → neu holen
  { const g = mk();
    await run('garmin token near expiry', { keychain: keyed([['sabrly.garmin.tok', 'a.b.c'], ['sabrly.garmin.texp', String(Date.now() + 30 * 60e3)]]), route: g.route, alerts: [{ index: 1 }, { index: 1 }, { index: 0 }] }, ctx => {
      ok('garmin: token renewed within 1h of expiry', g.calls.token === 1 && ctx.keychain.get('sabrly.garmin.tok') === JWT);
    }); }
  // 8) Token wird mitten drin ungültig (401) → einmal neu holen
  { const g = mk({ expireFirstBearer: true });
    await run('garmin 401 refresh', { keychain: keyed(), route: g.route, alerts: [{ index: 1 }, { index: 1 }, { index: 0 }] }, ctx => {
      ok('garmin: 401 triggers one token refresh', g.calls.token === 2 && ctx.keychain.get('sabrly.garmin.tok') === JWT2 && /Runden: 6/.test(ctx.board.v || ''), g.calls.token + ' ' + (ctx.board.v || '').slice(0, 300));
    }); }
  // 9) Liste leer / Fehler, Download 404, Probe 500
  { const g = mk({ list: () => ({ status: 200, json: [] }) });
    await run('garmin empty list', { keychain: keyed(), route: g.route, alerts: [{ index: 1 }, { index: 1 }, { index: 0 }] }, ctx => ok('garmin: empty list still reports', /Liste: Status 200/.test(ctx.board.v || '') && !/===/.test(ctx.board.v), ctx.board.v)); }
  { const g = mk({ list: () => ({ status: 429, text: 'Too Many Requests' }) });
    await run('garmin rate limited', { keychain: keyed(), route: g.route, alerts: [{ index: 1 }, { index: 1 }, { index: 0 }] }, ctx => ok('garmin: 429 shown', /Liste: Status 429\nToo Many Requests/.test(ctx.board.v || ''), ctx.board.v)); }
  { const g = mk({ dl404: true, probe500: true });
    await run('garmin dl 404', { keychain: keyed(), route: g.route, alerts: [{ index: 1 }, { index: 1 }, { index: 0 }] }, ctx => ok('garmin: download 404 + html probe noted', /\[Aufzeichnung\] Status 404/.test(ctx.board.v || '') && /\[typedsplits\] Status 500 · <html>/.test(ctx.board.v || ''), ctx.board.v)); }
  // 10) Netzwerkfehler beim Token
  await run('garmin offline', { keychain: keyed(), route: async r => r.url.includes('garmin.com') ? { throw: true } : goodRoute(r), alerts: [{ index: 1 }, { index: 1 }, { index: 0 }] }, ctx => ok('garmin: offline → error report, no crash', /Fehler: network/.test(ctx.board.v || ''), ctx.board.v));
  // 11) Schlüssel löschen / ersetzen / Abbrechen
  await run('garmin delete key', { keychain: keyed([['sabrly.garmin.tok', JWT], ['sabrly.garmin.texp', '1']]), route: goodRoute, alerts: [{ index: 1 }, { index: 3 }, { index: 0 }] }, ctx =>
    ok('garmin: delete removes key+token', !ctx.keychain.has('sabrly.garmin.key') && !ctx.keychain.has('sabrly.garmin.tok') && !ctx.keychain.has('sabrly.garmin.texp') && titles(ctx).includes('Gelöscht'), titles(ctx)));
  { const g = mk();
    await run('garmin replace key', { keychain: loggedIn.concat([['sabrly.garmin.key', 'gpk_alterSchluessel_123456'], ['sabrly.garmin.tok', 'old.tok.en'], ['sabrly.garmin.texp', String(Date.now() + 9e7)]]), route: g.route, alerts: [{ index: 1 }, { index: 2 }, { index: 0, fields: [KEY] }, { index: 0 }] }, ctx =>
      ok('garmin: replacing key drops old token', ctx.keychain.get('sabrly.garmin.key') === KEY && g.calls.token === 1 && ctx.keychain.get('sabrly.garmin.tok') === JWT, g.calls.token)); }
  { const g = mk();
    await run('garmin cancel', { keychain: keyed(), route: g.route, alerts: [{ index: 1 }, { index: -1 }] }, ctx => ok('garmin: cancel does nothing', g.calls.paths.length === 0 && ctx.board.v == null)); }
  // 12) Abmelden entfernt auch den Garmin-Schlüssel
  await run('logout clears garmin', { keychain: keyed([['sabrly.garmin.tok', JWT], ['sabrly.garmin.texp', '1']]), route: goodRoute, alerts: [{ index: 15 }, { index: 0 }] }, ctx =>
    ok('logout clears garmin key', !ctx.keychain.has('sabrly.garmin.key') && !ctx.keychain.has('sabrly.garmin.tok') && !ctx.keychain.has('sabrly.refresh')));
};
