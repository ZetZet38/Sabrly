// Erzeugt Test-Aufzeichnungen für tests/widget/fixtures. Aufruf aus dev/tests/garmin: node gen_fixtures.mjs
import fs from 'fs'; import { Encoder, Profile } from '@garmin/fitsdk'; import { zipSync } from 'fflate';
const OUT = '../widget/fixtures/'; fs.mkdirSync(OUT, { recursive: true });
const D = s => new Date(s * 1000); const t0 = Date.UTC(2026, 10, 9, 17, 0, 0) / 1000;
{ const enc = new Encoder();
  enc.onMesg(Profile.MesgNum.FILE_ID, { type: 'activity', manufacturer: 'garmin', product: 4315, timeCreated: D(t0), serialNumber: 3456789012 });
  const laps = [['warmup', 600, 1500, 2.5, 130], ['active', 120, 400, 3.33, 170], ['rest', 90, 150, 1.6, 140], ['active', 120, 400, 3.4, 174], ['rest', 90, 140, 1.5, 138], ['cooldown', 300, 800, 2.6, 135]];
  for (let i = 0; i < 60; i++) enc.onMesg(Profile.MesgNum.RECORD, { timestamp: D(t0 + i), heartRate: 120 + (i % 40), distance: i * 2.5, enhancedSpeed: 2.5, cadence: 82, positionLat: 612345678, positionLong: 81234567 });
  let t = t0; for (const [int, dur, dist, sp, hr] of laps) { enc.onMesg(Profile.MesgNum.LAP, { timestamp: D(t + dur), startTime: D(t), totalElapsedTime: dur, totalTimerTime: dur, totalDistance: dist, enhancedAvgSpeed: sp, avgHeartRate: hr, maxHeartRate: hr + 6, avgCadence: 84, intensity: int, lapTrigger: 'time', startPositionLat: 612345678, startPositionLong: 81234567 }); t += dur; }
  enc.onMesg(Profile.MesgNum.SESSION, { timestamp: D(t), startTime: D(t0), sport: 'running', subSport: 'generic', totalElapsedTime: t - t0, totalTimerTime: t - t0, totalDistance: 3390, enhancedAvgSpeed: 2.6, avgHeartRate: 148, maxHeartRate: 180, numLaps: 6, startPositionLat: 612345678, startPositionLong: 81234567 });
  fs.writeFileSync(OUT + 'run.zip', Buffer.from(zipSync({ '20001_ACTIVITY.fit': new Uint8Array(enc.close()) }))); }
{ const enc = new Encoder();
  enc.onMesg(Profile.MesgNum.FILE_ID, { type: 'activity', manufacturer: 'garmin', product: 4315, timeCreated: D(t0) });
  [[1, 10, 60, [0]], [0, null, null, null], [1, 8, 62.5, [0]]].forEach(([type, reps, w, cat], i) => enc.onMesg(Profile.MesgNum.SET, { timestamp: D(t0 + i * 60), startTime: D(t0 + i * 60), duration: 40, setType: type, ...(reps != null ? { repetitions: reps, weight: w, category: cat, categorySubtype: [1] } : {}), messageIndex: i }));
  enc.onMesg(Profile.MesgNum.SESSION, { timestamp: D(t0 + 600), startTime: D(t0), sport: 'training', subSport: 'strengthTraining', totalElapsedTime: 600, totalTimerTime: 600, avgHeartRate: 110, maxHeartRate: 150, totalCalories: 210 });
  fs.writeFileSync(OUT + 'strength.zip', Buffer.from(zipSync({ '20002_ACTIVITY.fit': new Uint8Array(enc.close()) }))); }
console.log(fs.readdirSync(OUT).map(f => f + ' ' + fs.statSync(OUT + f).size).join('\n'));
