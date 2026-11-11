// Erzeugt Test-Aufzeichnungen für tests/widget/fixtures. Aufruf aus dev/tests/garmin: node gen_rwd.mjs z2
// FIT wie Zeynels Lauf vom 9.11.: Lauf/Geh-Abschnitte (split 17/18/22), Runden je Meile (Intensität „interval“), Zonen
import fs from 'fs'; import { Encoder, Profile } from '@garmin/fitsdk'; import { zipSync } from 'fflate';
const D = s => new Date(s * 1000), t0 = Date.UTC(2026, 10, 9, 10, 58, 38) / 1000;
const Z2 = process.argv[2] === 'z2';
const segs = Z2 ? [['r', 499, 1261, 149], ['w', 15, 25, 142], ['r', 185, 402, 151], ['w', 35, 53, 163], ['r', 1405, 3051, 155], ['w', 3, 4, 148], ['r', 918, 1864, 153], ['w', 12, 17, 157], ['r', 528, 1164, 153]]
  : [['s', 9, 9.78, 123], ['r', 223, 543.62, 148], ['w', 65, 97.84, 152], ['r', 492, 1391.1, 171], ['w', 133, 217.26, 144], ['r', 495, 1289.22, 172], ['w', 126, 196.66, 140], ['r', 491.5, 1308.12, 170]];
const enc = new Encoder();
enc.onMesg(Profile.MesgNum.FILE_ID, { type: 'activity', manufacturer: 'garmin', product: 5019, timeCreated: D(t0), serialNumber: 3399887766 });
let t = t0, dist = 0, i = 0; const recs = [];
for (const [k, dur, m, hr] of segs) { const n = Math.round(dur), v = m / dur; for (let s = 0; s < n; s++) { dist += v; const drift = Z2 ? i / 3600 * 6 : 0; recs.push([t + i, dist, Math.round(hr + drift + Math.sin(i / 30) * 4), k === 'r' ? 86 : k === 'w' ? 58 : 0, 40 + Math.sin(i / 300) * 6]); i++; } }
recs.forEach(([ts, d, h, c, al]) => enc.onMesg(Profile.MesgNum.RECORD, { timestamp: D(ts), distance: d, heartRate: h, cadence: c, fractionalCadence: c ? 0.5 : 0, enhancedAltitude: al, enhancedSpeed: 2.5, positionLat: 612345678, positionLong: 81234567 }));
// Runden je Meile
const total = dist, lapsAt = []; let next = 1609.34, last = 0, lastT = t0;
for (const [ts, d] of recs) if (d >= next) { lapsAt.push([lastT, ts, d - last]); last = d; lastT = ts; next += 1609.34; }
lapsAt.push([lastT, recs[recs.length - 1][0], total - last]);
lapsAt.forEach(([a, b, m], k) => enc.onMesg(Profile.MesgNum.LAP, { timestamp: D(b), startTime: D(a), totalElapsedTime: b - a, totalTimerTime: b - a, totalDistance: m, avgHeartRate: 160 + k, maxHeartRate: 180, intensity: 'interval', lapTrigger: k < lapsAt.length - 1 ? 'distance' : 'sessionEnd', messageIndex: k }));
let st = t0;
segs.forEach(([k, dur, m, hr], j) => { enc.onMesg(312, { splitType: k === 'r' ? 'rwdRun' : k === 'w' ? 'rwdWalk' : 'rwdStand', totalElapsedTime: dur, totalTimerTime: dur, totalDistance: m, avgHeartRate: hr, maxHeartRate: hr + 10, startTime: D(Math.round(st)), messageIndex: j }); st += dur; });
enc.onMesg(Profile.MesgNum.TIME_IN_ZONE, { timestamp: D(t0), referenceMesg: 'session', referenceIndex: 0, timeInHrZone: [0, 0, 205, 401, 1260.5, 168, 0], hrZoneHighBoundary: [99, 118, 138, 158, 177, 197], hrCalcType: 'percentMaxHr', maxHeartRate: 197, restingHeartRate: 78 });
enc.onMesg(Profile.MesgNum.SESSION, { timestamp: D(t), startTime: D(t0), sport: 'running', totalElapsedTime: i, totalTimerTime: i, totalDistance: total, avgHeartRate: 164, maxHeartRate: 181, numLaps: lapsAt.length });
fs.writeFileSync('../widget/fixtures/' + (Z2 ? 'z2.zip' : 'rwd.zip'), Buffer.from(zipSync({ [(Z2 ? '24995649438' : '25018176793') + '_ACTIVITY.fit']: new Uint8Array(enc.close()) })));
console.log('records', recs.length, 'dist', total.toFixed(1), 'laps', lapsAt.length);
