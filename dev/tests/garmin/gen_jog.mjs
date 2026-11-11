// Erzeugt Test-Aufzeichnungen für tests/widget/fixtures. Aufruf aus dev/tests/garmin: node gen_jog.mjs
// Intervalle mit Trabpausen: 10 min Einlaufen, 5 × (3 min schnell / 2 min traben), 5 min Auslaufen – kein Gehen
import fs from 'fs'; import { Encoder, Profile } from '@garmin/fitsdk'; import { zipSync } from 'fflate';
const D = s => new Date(s * 1000), t0 = Date.UTC(2026, 10, 8, 9, 0, 0) / 1000, pace = p => 1000 / p;
const blocks = [[600, pace(450), 140], ...Array.from({ length: 5 }, () => [[180, pace(300), 172], [120, pace(510), 150]]).flat(), [300, pace(480), 145]];
let seed = 3; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const enc = new Encoder(); enc.onMesg(Profile.MesgNum.FILE_ID, { type: 'activity', manufacturer: 'garmin', product: 5019, timeCreated: D(t0) });
let t = t0, d = 0;
for (const [sec, v, hr] of blocks) for (let i = 0; i < sec; i++) { d += v * (1 + (rnd() - 0.5) * 0.2); enc.onMesg(Profile.MesgNum.RECORD, { timestamp: D(t), distance: d, heartRate: Math.round(hr + (rnd() - 0.5) * 6), cadence: 84, enhancedAltitude: 42 }); t++; }
enc.onMesg(312, { splitType: 'rwdRun', totalElapsedTime: t - t0, totalTimerTime: t - t0, totalDistance: d, avgHeartRate: 155, startTime: D(t0), messageIndex: 0 });
enc.onMesg(Profile.MesgNum.LAP, { timestamp: D(t), startTime: D(t0), totalElapsedTime: t - t0, totalTimerTime: t - t0, totalDistance: d, avgHeartRate: 155, intensity: 'active', lapTrigger: 'sessionEnd' });
enc.onMesg(Profile.MesgNum.SESSION, { timestamp: D(t), startTime: D(t0), sport: 'running', totalElapsedTime: t - t0, totalTimerTime: t - t0, totalDistance: d, avgHeartRate: 155 });
fs.writeFileSync('../widget/fixtures/jog.zip', Buffer.from(zipSync({ '40001_ACTIVITY.fit': new Uint8Array(enc.close()) })));
console.log('jog', (t - t0), 's', d.toFixed(0), 'm');
