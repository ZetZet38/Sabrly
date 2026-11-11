// Prüft inflateRaw / unzipFit / fitParse aus widget/sabrly-widget.js gegen zlib und den offiziellen Garmin FIT-SDK-Decoder.
import fs from 'fs'; import zlib from 'zlib'; import os from 'os'; import path from 'path'; import { execSync } from 'child_process';
import { loadGarmin } from './garmin_block.mjs';
import { Decoder, Stream, Profile, Encoder } from '@garmin/fitsdk';
import { zipSync, unzipSync } from 'fflate';
const G = loadGarmin(['inflateRaw', 'unzipFit', 'fitParse', 'fitReport', 'gRedact', 'lapLine']);
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sabrly-fit-')) + '/';
// optionale echte Garmin-Beispieldateien: git clone --depth 1 https://github.com/garmin/fit-javascript-sdk  und SAMPLES=<pfad>/test/data
const SAMPLES = process.env.SAMPLES || '';
const SAMPLE_FILES = SAMPLES ? ['Activity.fit', 'HrmPluginTestActivity.fit', 'WithGearChangeData.fit'].filter(f => fs.existsSync(path.join(SAMPLES, f))) : [];
if (!SAMPLE_FILES.length) console.log('Hinweis: ohne SAMPLES nur mit selbst erzeugten FIT-Dateien getestet');
let pass = 0, fail = 0; const ok = (n, c, i = '') => { if (c) pass++; else { fail++; console.log('FAIL', n, i); } };

// 1) inflate gegen zlib: zufällige und strukturierte Daten, alle Level/Strategien
const rnd = (n, seed) => { let x = seed; const a = Buffer.alloc(n); for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; a[i] = (x >> 16) & 0xff; } return a; };
const samples = [Buffer.alloc(0), Buffer.from('a'), Buffer.from('abcabcabcabcabcabcabc'.repeat(500)), rnd(70000, 7), Buffer.concat([rnd(3000, 3), Buffer.alloc(40000, 1), rnd(5000, 9)])];
for (const f of SAMPLE_FILES) samples.push(fs.readFileSync(path.join(SAMPLES, f)));
let k = 0;
for (const s of samples) for (const o of [{ level: 0 }, { level: 1 }, { level: 6 }, { level: 9 }, { level: 6, strategy: zlib.constants.Z_FIXED }, { level: 6, strategy: zlib.constants.Z_HUFFMAN_ONLY }, { level: 6, strategy: zlib.constants.Z_RLE }]) {
  const c = zlib.deflateRawSync(s, o); let out;
  try { out = G.inflateRaw(c, 0, c.length); } catch (e) { ok('inflate ' + k, false, e.message); k++; continue; }
  ok('inflate ' + (k++) + ' ' + JSON.stringify(o) + ' len ' + s.length, out.length === s.length && Buffer.from(out).equals(s));
}
// beschädigte Daten werfen statt endlos zu laufen
{ const c = zlib.deflateRawSync(samples[3]); let threw = false; try { G.inflateRaw(c.subarray(0, 100), 0, 100); } catch (e) { threw = /ZIP/.test(e.message); } ok('truncated throws', threw); }

// 2) ZIP-Varianten: fflate, Python zipfile, zip-Kommando, Java ZipOutputStream (Datendeskriptor), gespeichert
const FIXT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'widget', 'fixtures');
const fit = SAMPLE_FILES.includes('Activity.fit') ? fs.readFileSync(path.join(SAMPLES, 'Activity.fit')) : Buffer.from(Object.values(unzipSync(fs.readFileSync(path.join(FIXT, 'rwd.zip'))))[0]);
const zips = {};
zips.fflate = Buffer.from(zipSync({ '123456_ACTIVITY.fit': new Uint8Array(fit) }, { level: 6 }));
zips.stored = Buffer.from(zipSync({ '123456_ACTIVITY.fit': new Uint8Array(fit) }, { level: 0 }));
fs.writeFileSync(DIR + 'x.fit', fit);
execSync(`cd ${DIR} && rm -f py.zip cli.zip && python3 -c "import zipfile;z=zipfile.ZipFile('py.zip','w',zipfile.ZIP_DEFLATED);z.write('x.fit','999_ACTIVITY.fit');z.close()" && zip -q cli.zip x.fit`);
zips.python = fs.readFileSync(DIR + 'py.zip'); zips.cli = fs.readFileSync(DIR + 'cli.zip');
fs.writeFileSync(DIR + 'Z.java', 'import java.util.zip.*;import java.io.*;import java.nio.file.*;public class Z{public static void main(String[] a)throws Exception{ZipOutputStream z=new ZipOutputStream(new FileOutputStream("java.zip"));z.putNextEntry(new ZipEntry("readme.txt"));z.write("hi".getBytes());z.closeEntry();z.putNextEntry(new ZipEntry("777_ACTIVITY.fit"));z.write(Files.readAllBytes(Paths.get("x.fit")));z.closeEntry();z.close();}}');
try { execSync(`cd ${DIR} && rm -f java.zip && java Z.java`, { stdio: 'pipe' }); zips.java = fs.readFileSync(DIR + 'java.zip'); } catch (e) { console.log('java skipped', e.message.slice(0, 200)); }
for (const [n, z] of Object.entries(zips)) { try { const r = G.unzipFit([...z]); ok('unzip ' + n, Buffer.from(r.bytes).equals(fit) && /\.fit$/i.test(r.name), r.name + ' ' + r.bytes.length); } catch (e) { ok('unzip ' + n, false, e.message); } }
{ const r = G.unzipFit([...fit]); ok('raw fit passthrough', r.bytes.length === fit.length); }
{ let threw = false; try { G.unzipFit([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]); } catch (e) { threw = true; } ok('garbage throws', threw); }

// 3) FIT-Auslesen gegen den offiziellen Decoder (Rohwerte ohne Skalierung)
function sdkRaw(buf) {
  const d = new Decoder(Stream.fromBuffer(buf));
  const { messages, errors } = d.read({ applyScaleAndOffset: false, expandSubFields: false, expandComponents: false, convertTypesToStrings: false, convertDateTimesToDates: false, includeUnknownData: true, mergeHeartRates: false });
  return { messages, errors };
}
const nameToNum = mesgNum => { const m = Profile.messages[mesgNum]; const o = {}; for (const f of Object.values(m.fields)) o[f.name] = f.num; return o; };
function compare(label, buf) {
  const keep = new Set([0, 18, 19, 225, 312, 313, 216, 26, 27]);
  const F = G.fitParse([...buf], n => keep.has(n));
  const { messages, errors } = sdkRaw(buf);
  ok(label + ' sdk ok', errors.length === 0, String(errors[0]));
  for (const [key, mesgNum] of [['sessionMesgs', 18], ['lapMesgs', 19], ['setMesgs', 225], ['fileIdMesgs', 0]]) {
    const sdk = messages[key] || [], mine = F.msgs.filter(m => m.n === mesgNum); const map = nameToNum(mesgNum);
    ok(label + ' ' + key + ' count', sdk.length === mine.length, sdk.length + ' vs ' + mine.length);
    let bad = 0, checked = 0;
    sdk.forEach((s, i) => { for (const [name, v] of Object.entries(s)) { const num = map[name]; if (num == null || typeof v === 'object' && !Array.isArray(v)) continue; const m = mine[i] && mine[i].f[num];
      checked++; const eq = Array.isArray(v) ? JSON.stringify(v) === JSON.stringify(Array.isArray(m) ? m : [m]) : (typeof v === 'number' ? Math.abs(v - m) < 1e-3 : String(v) === String(m)); if (!eq) { bad++; if (bad < 4) console.log('  diff', label, key, i, name, num, v, m); } } });
    ok(label + ' ' + key + ' values (' + checked + ')', bad === 0, bad + ' Abweichungen');
  }
  ok(label + ' record count', (messages.recordMesgs || []).length === F.recs, (messages.recordMesgs || []).length + ' vs ' + F.recs);
  return F;
}
for (const f of SAMPLE_FILES) compare(f, fs.readFileSync(path.join(SAMPLES, f)));
for (const f of ['rwd.zip', 'z2.zip', 'jog.zip']) compare(f, Buffer.from(Object.values(unzipSync(fs.readFileSync(path.join(FIXT, f))))[0]));

// 4) eigene Testdatei: Lauf mit Intervallrunden (big endian gemischt nicht möglich im SDK-Encoder) + Krafttraining mit Sätzen
const toFit = (secs) => Math.round(secs - 631065600);
const t0 = toFit(Date.UTC(2026, 10, 9, 17, 0, 0) / 1000);
{
  const enc = new Encoder();
  enc.onMesg(Profile.MesgNum.FILE_ID, { type: 'activity', manufacturer: 'garmin', product: 4315, timeCreated: new Date((t0 + 631065600) * 1000), serialNumber: 1234567 });
  const laps = [['warmup', 600, 1500, 2.5, 130], ['active', 120, 400, 3.33, 170], ['rest', 90, 150, 1.6, 140], ['active', 120, 400, 3.4, 174], ['rest', 90, 140, 1.5, 138], ['cooldown', 300, 800, 2.6, 135]];
  let t = t0;
  for (let i = 0; i < 30; i++) enc.onMesg(Profile.MesgNum.RECORD, { timestamp: new Date((t + i + 631065600) * 1000), heartRate: 120 + i, distance: i * 2.5, speed: 2.5, cadence: 82, positionLat: 612345678, positionLong: 81234567 });
  for (const [int, dur, dist, sp, hr] of laps) { enc.onMesg(Profile.MesgNum.LAP, { timestamp: new Date((t + dur + 631065600) * 1000), startTime: new Date((t + 631065600) * 1000), totalElapsedTime: dur, totalTimerTime: dur, totalDistance: dist, enhancedAvgSpeed: sp, avgHeartRate: hr, maxHeartRate: hr + 6, avgCadence: 84, intensity: int, lapTrigger: 'time', startPositionLat: 612345678, startPositionLong: 81234567 }); t += dur; }
  enc.onMesg(Profile.MesgNum.SESSION, { timestamp: new Date((t + 631065600) * 1000), startTime: new Date((t0 + 631065600) * 1000), sport: 'running', subSport: 'generic', totalElapsedTime: t - t0, totalTimerTime: t - t0, totalDistance: 3390, enhancedAvgSpeed: 2.6, avgHeartRate: 148, maxHeartRate: 180, numLaps: 6, startPositionLat: 612345678 });
  const buf = Buffer.from(enc.close());
  const F = compare('enc-run', buf);
  const rep = G.fitReport([...Buffer.from(zipSync({ 'r.fit': new Uint8Array(buf) }))]);
  ok('report lists 6 laps', /Runden: 6/.test(rep) && /#2 active\/time · 400 m · 2:00 · 5:00\/km · HF 170\/176 · Kad 168/.test(rep), rep);
  ok('report has no positions', !/612345678|81234567/.test(rep), rep);
  ok('report hides serial', !/1234567\b/.test(rep.replace(/612345678|81234567/g, '')), rep);
  console.log(rep.split('\n').slice(0, 12).join('\n'));
}
{
  const enc = new Encoder();
  enc.onMesg(Profile.MesgNum.FILE_ID, { type: 'activity', manufacturer: 'garmin', product: 4315, timeCreated: new Date((t0 + 631065600) * 1000) });
  const sets = [[1, 10, 60, [0]], [0, null, null, null], [1, 8, 62.5, [0]], [1, 12, 20, [7, 7]]];
  sets.forEach(([type, reps, w, cat], i) => enc.onMesg(Profile.MesgNum.SET, { timestamp: new Date((t0 + i * 60 + 631065600) * 1000), startTime: new Date((t0 + i * 60 + 631065600) * 1000), duration: 40, setType: type, ...(reps != null ? { repetitions: reps } : {}), ...(w != null ? { weight: w } : {}), ...(cat ? { category: cat, categorySubtype: cat.map(() => 1) } : {}), messageIndex: i }));
  enc.onMesg(Profile.MesgNum.SESSION, { timestamp: new Date((t0 + 600 + 631065600) * 1000), startTime: new Date((t0 + 631065600) * 1000), sport: 'training', subSport: 'strengthTraining', totalElapsedTime: 600, totalTimerTime: 600, avgHeartRate: 110, maxHeartRate: 150, totalCalories: 210 });
  const buf = Buffer.from(enc.close());
  compare('enc-strength', buf);
  const rep = G.fitReport([...buf]);
  ok('strength sets in report', /set \(4\)/.test(rep) && /"3":10/.test(rep) && /"4":1000/.test(rep), rep);
  console.log(rep);
}
// 5) Schwärzen
{ const r = G.gRedact({ activityId: 1, startLatitude: 51.1, endLongitude: 6.8, ownerDisplayName: 'x', ownerFullName: 'y', userProfileId: 5, deviceId: 9, locationName: 'Dormagen', summaryDTO: { startLatitude: 1, averageHR: 150, elevationGain: 12, accumulatedPower: 3 }, activityUUID: { uuid: 'u' }, splitSummaries: [{ maxLat: 1, distance: 5 }] });
  ok('redact', JSON.stringify(r) === '{"activityId":1,"summaryDTO":{"averageHR":150,"elevationGain":12,"accumulatedPower":3},"splitSummaries":[{"distance":5}]}', JSON.stringify(r)); }
console.log('PASS', pass, 'FAIL', fail); process.exitCode = fail ? 1 : 0;
