// Tempo-Erkennung mit verrauschten Datensätzen
import { loadGarmin } from './garmin_block.mjs';
const G = loadGarmin(['gFitParts','gPaceSegs']);
let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
function recOf(blocks, noise = 0.12) { const R = []; let t = 1e9, d = 0; for (const [sec, v, hr] of blocks) for (let i = 0; i < sec; i++) { d += v * (1 + (rnd() - 0.5) * 2 * noise); R.push([t++, Math.round(d * 100), Math.round(hr + (rnd() - 0.5) * 6), 80, 40]); } return R; }
const pace = p => 1000 / p; // s/km → m/s
let f = 0; const ok = (n, c, i) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (i ? ' :: ' + i : '')); if (!c) f++; };
// 10 min Einlaufen 7:30, 5 × (3 min 5:00 / 2 min traben 8:30), 5 min Auslaufen 8:00
const jog = [[600, pace(450), 140], ...Array.from({ length: 5 }, () => [[180, pace(300), 172], [120, pace(510), 150]]).flat(), [300, pace(480), 145]];
let o = G.gFitParts({ rec: recOf(jog), msgs: [] }, false);
ok('jog intervals: 5 × 3 min, 2 min traben', o.ivx && o.ivx.n === 5 && o.ivx.len === 3 && o.ivx.u === 'min' && o.ivx.pz === '2 min traben', JSON.stringify(o.ivx));
ok('jog intervals: warm-up + cool-down roles', o.seg && o.seg[0].p === 'e' && o.seg[o.seg.length - 1].p === 'a' && o.seg.filter(x => !x.p && x.k === 'r').length === 5, JSON.stringify(o.seg));
ok('jog intervals: rep pace ≈ 5:00', o.ivx && o.ivx.r.every(x => /^(4:5\d|5:0\d)$/.test(x.v)), o.ivx && o.ivx.r.map(x => x.v).join());
ok('jog intervals: no decoupling', o.dc === undefined);
// 4 × 4 min schnell / 3 min traben, ohne Ein-/Auslaufen
const fff = Array.from({ length: 4 }, () => [[240, pace(285), 175], [180, pace(500), 150]]).flat();
o = G.gFitParts({ rec: recOf(fff), msgs: [] }, false); ok('4 × 4 min traben', o.ivx && o.ivx.n === 4 && o.ivx.len === 4 && o.ivx.pz === '3 min traben', JSON.stringify(o.ivx));
// lockerer Lauf mit leichtem Abfall der Pace (wie 7.11.): keine Intervalle
const z2 = [[500, pace(396), 149], [185, pace(460), 151], [1405, pace(460), 155], [918, pace(492), 153], [528, pace(454), 153]];
o = G.gFitParts({ rec: recOf(z2), msgs: [] }, false); ok('z2 drift → no intervals', !o.ivx, JSON.stringify(o.ivx)); ok('z2 → decoupling present', typeof o.dc === 'number', String(o.dc));
// Hügellauf: Pace schwankt stark, aber unregelmäßig
const hills = [[400, pace(420), 150], [90, pace(560), 160], [300, pace(400), 152], [150, pace(570), 162], [600, pace(430), 150], [60, pace(540), 158], [500, pace(410), 151]];
o = G.gFitParts({ rec: recOf(hills), msgs: [] }, false); ok('hilly easy run → no intervals', !o.ivx, JSON.stringify(o.ivx));
// nur 2 Wiederholungen: ohne Plan nein, mit Plan „Intervalle“ ja
const two = [[600, pace(450), 140], [480, pace(300), 172], [180, pace(520), 150], [480, pace(300), 174], [300, pace(480), 145]];
ok('2 reps unplanned → no', !G.gFitParts({ rec: recOf(two), msgs: [] }, false).ivx);
const tw = G.gFitParts({ rec: recOf(two), msgs: [] }, true).ivx; ok('2 reps planned → 2 × 8 min', tw && tw.n === 2 && tw.len === 8, JSON.stringify(tw));
// sehr verrauscht (GPS unter Bäumen)
seed = 99; o = G.gFitParts({ rec: recOf(jog, 0.3), msgs: [] }, false); ok('noisy jog intervals still found', o.ivx && o.ivx.n === 5, JSON.stringify(o.ivx));
seed = 5; o = G.gFitParts({ rec: recOf([[3600, pace(450), 150]], 0.3), msgs: [] }, false); ok('noisy steady run → nothing', !o.ivx, JSON.stringify(o.ivx));
console.log(f ? 'FAILS ' + f : 'ALL OK'); process.exitCode = f ? 1 : 0;
