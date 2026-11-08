// Holt die offiziellen Diyanet-Gebetszeiten und legt sie als JSON neben die App.
// Läuft täglich als GitHub Action (.github/workflows/gebetszeiten.yml). Ohne Abhängigkeiten, Node 20+.
//
// Ausgabe:
//   gebetszeiten/orte.json    { countries: [{ id, name, states: [{ id, name, cities: [[id, name, lat, lon], …] }] }] }
//   gebetszeiten/z/<id>.json  { id, name, region, country, checked, days: { 'YYYY-MM-DD': 'HHMMHHMMHHMMHHMMHHMMHHMM' } }
//                             (imsak, sonnenaufgang, dhuhr, asr, maghrib, isha – Ortszeit der Stadt)
//
// Eine Stadt wird nur neu geladen, wenn ihre Daten weniger als 45 Tage in die Zukunft reichen
// (Diyanet veröffentlicht ein ganzes Jahr auf einmal). Ohne neue Tage wird sie 7 Tage lang nicht erneut versucht.
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const BASE = 'https://namazvakitleri.diyanet.gov.tr/de-DE';
const UA = 'Mozilla/5.0 (compatible; Sabrly-Gebetszeiten/1.0; +https://github.com/ZetZet38/Sabrly)';
const ALL = [{ id: 13, name: 'Deutschland' }];
const EXTRA = [
  { id: 2, name: 'Türkei', cities: ['ISTANBUL', 'ANKARA', 'IZMIR'] },
  { id: 64, name: 'Saudi-Arabien', cities: ['MEKKE', 'MEDINE'] },
  { id: 116, name: 'Japan', cities: ['TOKYO'] }
];
// bekannte Koordinaten für die Orte im Ausland (für „Standort verwenden“)
const EXTRA_COORDS = { ANKARA: [39.92, 32.85], ISTANBUL: [41.01, 28.98], IZMIR: [38.42, 27.14], MEKKE: [21.42, 39.83], MEDINE: [24.47, 39.61], TOKYO: [35.68, 139.69] };
// GeoNames-Bundesland-Codes (admin1) für die Diyanet-Bundesländer
const ADMIN1 = { 'baden wurttemberg': '01', 'bayern': '02', 'bremen': '03', 'hamburg': '04', 'hessen': '05', 'niedersachsen': '06', 'nordrhein westfalen': '07',
  'rheinland pfalz': '08', 'saarland': '09', 'schleswig holstein': '10', 'brandenburg': '11', 'mecklenburg vorpommern': '12', 'sachsen': '13', 'sachsen anhalt': '14', 'thuringen': '15', 'berlin': '16' };
const KEEP_DAYS = 400, AHEAD = 45, RETRY_DAYS = 7;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const only = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null; // nur diese Stadt-IDs (zum Testen)
const GEONAMES = process.env.GEONAMES || ''; // Pfad zu DE.txt von GeoNames (optional)

async function get(url, json) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'de-DE,de;q=0.9' } });
      if (r.ok) return json ? await r.json() : await r.text();
      if (r.status === 404) return null;
      console.log('HTTP', r.status, url);
    } catch (e) { console.log('Fehler', e.message, url); }
    await sleep(1500 * (i + 1));
  }
  throw new Error('Nicht erreichbar: ' + url);
}
const regList = (type, country, state) =>
  get(`${BASE}/home/GetRegList?ChangeType=${type}&CountryId=${country}${state ? '&StateId=' + state : ''}&Culture=de-DE`, true);
const title = s => String(s || '').toLowerCase().replace(/(^|[\s\-/.(])\p{L}/gu, m => m.toUpperCase());
const norm = s => String(s || '').toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function parseTimes(htmlText) {
  const out = {};
  for (const tr of htmlText.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []) {
    const cells = (tr.match(/<td[^>]*>[\s\S]*?<\/td>/g) || []).map(c => c.replace(/<[^>]+>/g, '').trim());
    if (cells.length < 8) continue;
    const m = cells[0].match(/^(\d\d)\.(\d\d)\.(\d{4})$/); if (!m) continue;
    const t = cells.slice(2, 8);
    if (!t.every(x => /^\d\d:\d\d$/.test(x))) continue;
    out[`${m[3]}-${m[2]}-${m[1]}`] = t.map(x => x.replace(':', '')).join('');
  }
  return out;
}
async function readJson(p, fallback) { try { return JSON.parse(await readFile(p, 'utf8')); } catch (e) { return fallback; } }
const iso = d => d.toISOString().slice(0, 10);

async function geonames() {
  if (!GEONAMES) return null;
  let txt; try { txt = await readFile(GEONAMES, 'utf8'); } catch (e) { console.log('GeoNames fehlt'); return null; }
  const idx = new Map(), idx2 = new Map(); // "admin1|name" → [lat, lon, pop]; idx2: Kurzformen (erstes Wort, ohne Zusatz)
  const put = (m, k, v) => { const cur = m.get(k); if (!cur || v[2] > cur[2]) m.set(k, v); };
  for (const line of txt.split('\n')) {
    const f = line.split('\t'); if (f.length < 15 || f[6] !== 'P') continue;
    const v = [+f[4], +f[5], +f[14] || 0], a1 = f[10];
    const names = new Set([norm(f[1]), norm(f[2])]);
    if (v[2] >= 1000) for (const alt of f[3].split(',')) names.add(norm(alt)); // z. B. Nürnberg (Hauptname „Nuremberg“)
    for (const n of names) {
      if (!n) continue; put(idx, a1 + '|' + n, v);
      const short = n.replace(/ (am|an der|im|bei|in|ob|vor der) .*$/, ''), first = n.split(' ')[0];
      if (short !== n) put(idx2, a1 + '|' + short, v);
      if (first !== n && first.length > 3) put(idx2, a1 + '|' + first, v);
    }
  }
  return { idx, idx2 };
}
function coordsFor(geo, stateName, cityRaw) {
  if (!geo) return null;
  const a1 = ADMIN1[norm(stateName)]; if (!a1) return null;
  const n = norm(cityRaw).replace(/\bb\b/g, 'bei').replace(/\ba d\b/g, 'an der').replace(/\bi\b/g, 'im');
  const tries = [n, n.replace(/ bei .*| an der .*| im .*| am .*/, ''), n.split(' ')[0]];
  for (const m of [geo.idx, geo.idx2]) for (const t of tries) { const c = m.get(a1 + '|' + t); if (c) return [Math.round(c[0] * 1e4) / 1e4, Math.round(c[1] * 1e4) / 1e4]; }
  return null;
}

async function main() {
  await mkdir('gebetszeiten/z', { recursive: true });
  const geo = await geonames();
  const countries = [];
  let noCoords = 0;
  for (const c of ALL.concat(EXTRA)) {
    const st = await regList('country', c.id);
    const states = [];
    for (const s of (st && st.StateList) || []) {
      await sleep(200);
      const cl = await regList('state', c.id, s.SehirID);
      let list = ((cl && cl.StateRegionList) || []).map(x => ({ id: Number(x.IlceID), raw: String(x.IlceAdi || '').toUpperCase() }));
      if (c.cities) list = list.filter(x => c.cities.includes(x.raw));
      const cities = list.map(x => {
        const co = c.cities ? EXTRA_COORDS[x.raw] || null : coordsFor(geo, title(s.SehirAdi), x.raw);
        if (!co) noCoords++;
        return co ? [x.id, title(x.raw), co[0], co[1]] : [x.id, title(x.raw)];
      }).sort((a, b) => a[1].localeCompare(b[1], 'de'));
      if (cities.length) states.push({ id: Number(s.SehirID), name: title(s.SehirAdi), cities });
    }
    console.log(c.name + ':', states.length, 'Regionen,', states.reduce((n, s) => n + s.cities.length, 0), 'Städte');
    if (states.length) countries.push({ id: c.id, name: c.name, states });
  }
  if (!countries.some(c => c.id === 13)) throw new Error('Keine deutschen Städte gefunden – Abbruch, nichts wird überschrieben.');
  console.log('Ohne Koordinaten:', noCoords);
  const old = await readJson('gebetszeiten/orte.json', null), orte = { countries };
  if (!old || JSON.stringify(old) !== JSON.stringify(orte)) await writeFile('gebetszeiten/orte.json', JSON.stringify(orte));

  const today = iso(new Date()), cut = iso(new Date(Date.now() - KEEP_DAYS * 864e5)), need = iso(new Date(Date.now() + AHEAD * 864e5));
  const retry = iso(new Date(Date.now() - RETRY_DAYS * 864e5));
  let fetched = 0, changed = 0, skipped = 0, failed = 0;
  for (const c of countries) for (const s of c.states) for (const [id, name] of s.cities) {
    if (only && !only.includes(id)) continue;
    const p = `gebetszeiten/z/${id}.json`, prev = await readJson(p, null);
    const last = prev ? Object.keys(prev.days).sort().pop() || '' : '';
    if (prev && !only && (last >= need || (prev.checked && prev.checked > retry))) { skipped++; continue; }
    await sleep(300);
    let days = {};
    try { const h = await get(`${BASE}/${id}/gebetszeit`); days = h ? parseTimes(h) : {}; } catch (e) { console.log(e.message); }
    fetched++;
    if (Object.keys(days).length < 7) { failed++; console.log('Keine Zeiten:', id, name); continue; }
    const merged = Object.assign({}, prev ? prev.days : {}, days);
    for (const k of Object.keys(merged)) if (k < cut) delete merged[k];
    const keys = Object.keys(merged).sort(), gotNew = !prev || keys.pop() > last;
    const next = { id, name, region: s.name, country: c.name, checked: gotNew ? '' : today,
      days: Object.fromEntries(Object.keys(merged).sort().map(k => [k, merged[k]])) };
    if (JSON.stringify(prev) !== JSON.stringify(next)) { await writeFile(p, JSON.stringify(next)); changed++; }
  }
  console.log(`Fertig: ${fetched} geladen, ${changed} geändert, ${skipped} aktuell, ${failed} ohne Zeiten`);
  if (fetched && failed === fetched) throw new Error('Keine einzige Stadt geladen.');
}
if (process.argv[1] && process.argv[1].endsWith('gebetszeiten.mjs')) main().catch(e => { console.error(e); process.exit(1); });
