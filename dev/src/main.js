/* ---------- Training: Datenmodell ----------
   S.training: {days:[{id,name,sub,col,blocks}], ex:{eigene Übungen}, weeks:{Montag:{d:{0..6:[ids]},s:{0..6:'F'|'S'|'N'}}}, habit, rhabit, hr}
   Baustein: {k:'ex',id,e,p:[{k,r}],lo,hi,rest,note} oder {k:'emom',id,v(Sek.),n(Runden),it:[{e,r,k}],note}
   Pro Tag in LOGS: tr:[{id,day,n,st,en,feel,wu?:{m?,t:[…]},x:[{b,e,s:[{k,r,q?}],ws?:[{k,r}],nq?:[Index],n?:Text} | {b,em:{v,n,it,ok}}]}]  (ws = Aufwärmsätze, zählen nirgends mit; wu = Aufwärmen: Minuten bis zum 1. Arbeitssatz + was gemacht wurde; nq/n = Notiz zur Übung), run:[{id,t,dur,km,hr,max,iv,g}]
   Garmin (vom Widget): run[].g = Werte der Uhr (km-Splits, Zonen …), ga:[{id,k:'str'|'oth',n,st,ts,dur,hr,max,kcal,te,z}], gdel:[gelöschte Garmin-IDs]
   Firestore kennt keine Arrays in Arrays – darum überall Objekte in Listen. */
const TCOL={g:'#46E0AE',b:'#6FA4FF',o:'#FF9F4A',p:'#B48CFF',r:'#FF7A85',y:'#E3D26F'};
// Orange und Gelb wirken als getönte Fläche auf dunklem Grund bräunlich – etwas mehr Tönung gleicht das aus
const TTA={o:'22%',y:'22%'};
const RUNK={'@L':{n:'Lauf locker',s:'Lauf',col:'b'},'@I':{n:'Intervalle',s:'Int.',col:'o'}};
const clampI=(v,a,b,d)=>{v=Math.round(+v);return Number.isFinite(v)?Math.max(a,Math.min(b,v)):d};
const fk=v=>v==null||v===''?'':String(Math.round(+v*100)/100).replace('.',',');
const pnum=v=>{const n=parseFloat(String(v??'').replace(',','.'));return Number.isFinite(n)?n:null};
const msx=s=>{s=Math.max(0,Math.round(s||0));return Math.floor(s/60)+':'+pad(s%60)};
const hmsx=s=>{s=Math.max(0,Math.round(s||0));const h=Math.floor(s/3600);return h?h+':'+pad(Math.floor(s/60)%60)+':'+pad(s%60):msx(s)};
const TR=()=>S.training;
const EXD=id=>(TR()&&TR().ex&&TR().ex[id])||LIB[id]||{n:'Übung',t:'kg',m:{},i:2.5,tp:[],er:'',al:[]};
const TDAY=id=>(TR()&&TR().days.find(x=>x.id===id))||null;
const ICTR='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/></svg>';
function normBlock(b){b=b&&typeof b==='object'?b:{};
  if(b.k==='emom'){const it=(Array.isArray(b.it)?b.it:[]).filter(x=>x&&x.e).slice(0,6).map(x=>({e:String(x.e),r:clampI(x.r,1,200,6),k:pnum(x.k)||0}));
    return {k:'emom',id:String(b.id||'b-'+newId()),v:clampI(b.v,10,900,60),n:clampI(b.n,1,60,10),it:it.length?it:[{e:'chinup',r:6,k:0}],note:String(b.note||'').slice(0,140)}}
  const p=(Array.isArray(b.p)?b.p:[]).filter(x=>x&&typeof x==='object').slice(0,12).map(x=>({k:x.k==null||x.k===''?null:pnum(x.k),r:clampI(x.r,0,999,8)}));
  const lo=clampI(b.lo,1,999,8);
  return {k:'ex',id:String(b.id||'b-'+newId()),e:String(b.e||'bank'),p:p.length?p:[{k:null,r:lo},{k:null,r:lo},{k:null,r:lo}],lo,hi:Math.max(lo,clampI(b.hi,1,999,12)),rest:clampI(b.rest,0,1800,90),note:String(b.note||'').slice(0,140)}}
function normCustom(v,id){const m={};if(v.m&&typeof v.m==='object'){for(const k of MUS)if(+v.m[k]>0)m[k]=Math.min(1,+v.m[k]);if(+v.m.Arme>0&&!m.Bizeps&&!m.Trizeps){m.Bizeps=m.Trizeps=Math.min(1,+v.m.Arme)}}
  return {n:String(v.n||'Übung').slice(0,40),t:['kg','bw','time'].includes(v.t)?v.t:'kg',sd:v.sd?1:0,du:v.du?1:0,m,i:pnum(v.i)||2.5,tp:(Array.isArray(v.tp)?v.tp:[]).map(String).filter(Boolean).slice(0,6),er:String(v.er||'').slice(0,200),vid:String(v.vid||'').slice(0,300),al:(Array.isArray(v.al)?v.al:[]).map(String).slice(0,6),own:1,id}}
function normTraining(t){if(!t||typeof t!=='object')return null;
  const days=(Array.isArray(t.days)?t.days:[]).filter(d=>d&&typeof d==='object').slice(0,14).map(d=>({id:String(d.id||'d-'+newId()),name:String(d.name||'Training').slice(0,24),sub:String(d.sub||'').slice(0,30),col:TCOL[d.col]?d.col:'g',blocks:(Array.isArray(d.blocks)?d.blocks:[]).slice(0,24).map(normBlock)}));
  const ex={};if(t.ex&&typeof t.ex==='object')for(const [k,v] of Object.entries(t.ex))if(v&&typeof v==='object'&&v.n)ex[k]=normCustom(v,k);
  const weeks={},old=addDays(weekStart(iso(new Date())),-7*20);
  if(t.weeks&&typeof t.weeks==='object')for(const [k,v] of Object.entries(t.weeks)){if(!/^\d{4}-\d\d-\d\d$/.test(k)||k<old||!v||typeof v!=='object')continue;
    const d={},s={};for(let i=0;i<7;i++){const a=v.d&&v.d[i];if(Array.isArray(a)&&a.length)d[i]=a.map(String).slice(0,4);const sh=v.s&&v.s[i];if(['F','S','N'].includes(sh))s[i]=sh}
    weeks[k]={d,s}}
  return {days,ex,weeks,habit:String(t.habit||''),rhabit:String(t.rhabit||''),hr:clampI(t.hr,100,200,150),snd:t.snd!==false,wake:t.wake!==false}}

/* ---------- Vorlagen ---------- */
const TB=(e,p,lo,hi,rest,note)=>({k:'ex',e,p,lo,hi,rest,note:note||''});
const TP=(n,k,r)=>Array.from({length:n},()=>({k,r}));
const TPLS=[
 {id:'ppc',n:'Push · Pull · Tag C',d:'Funktional: Kraft, Core und Laufen zusammen. 3 Krafttage.',days:[
   {name:'Push',col:'g',blocks:[TB('dips',[{k:27.5,r:8},{k:25,r:10},{k:22.5,r:11}],8,12,120,'Satz 1 Stopp bei 8 · Satz 2–3 bis RIR 1'),TB('landmine',TP(3,12.5,10),10,12,90),TB('brustpresse',TP(3,105,10),8,12,90),TB('swings',TP(5,28,8),8,10,60,'Explosiv – Kraft vor Wiederholungen'),TB('carry',TP(3,24,40),40,50,60,'Sekunden je Seite'),TB('katana',TP(3,50,10),10,12,60)]},
   {name:'Pull',col:'b',blocks:[TB('klimmzug',[{k:25,r:8},{k:22.5,r:8},{k:20,r:8}],6,10,150,'Satz 1 = 8 anstreben'),TB('tbar',TP(3,60,10),8,10,120),TB('stepups',TP(3,16,6),6,8,90,'RIR 2–3 · geht es locker → 2 × 20 kg'),TB('lrot',TP(4,10,5),5,5,60,'+5 kg, wenn du jede Wdh. sauber abbremst'),TB('facepull',TP(4,32.5,15),12,15,60,'RIR 2 · Gewicht 30–35 kg'),TB('curls',TP(3,65,10),10,12,60)]},
   {name:'Tag C',sub:'Oberkörper',col:'o',blocks:[{k:'emom',v:60,n:10,it:[{e:'chinup',r:6,k:0},{e:'dips',r:6,k:0}],note:'Im Wechsel, Körpergewicht'},TB('brustpresse',TP(3,95,10),10,12,90),TB('kelso',TP(3,60,10),10,12,90),TB('kcurls',TP(3,60,10),10,12,60,'2–3 Sätze'),TB('katanag',TP(3,45,10),10,12,60),TB('facepull',TP(3,32.5,15),12,15,60,'Gewicht 30–35 kg')]}]},
 {id:'ppl',n:'Push · Pull · Beine',d:'Klassischer Split, 3 Tage, für Muskelaufbau.',days:[
   {name:'Push',col:'g',blocks:[TB('bank',TP(4,null,8),6,10,150),TB('schraeg',TP(3,null,10),8,12,90),TB('schulterkh',TP(3,null,10),8,12,90),TB('seitheben',TP(3,null,12),12,15,60),TB('trizeps',TP(3,null,12),10,15,60)]},
   {name:'Pull',col:'b',blocks:[TB('latzug',TP(3,null,10),8,12,120),TB('tbar',TP(3,null,10),8,12,120),TB('kabelrudern',TP(3,null,10),10,12,90),TB('facepull',TP(3,null,15),12,15,60),TB('szcurls',TP(3,null,10),10,12,60),TB('hammer',TP(2,null,10),10,12,60)]},
   {name:'Beine',col:'p',blocks:[TB('squat',TP(4,null,8),6,10,180),TB('rdl',TP(3,null,8),8,10,150),TB('beinpresse',TP(3,null,10),10,12,120),TB('beinbeuger',TP(3,null,10),10,12,90),TB('waden',TP(3,null,12),12,15,60),TB('plank',TP(3,0,45),45,60,60)]}]},
 {id:'ou',n:'Oberkörper · Unterkörper',d:'2 Tage im Wechsel, gut für 2–4 Einheiten pro Woche.',days:[
   {name:'Oberkörper',col:'g',blocks:[TB('bank',TP(4,null,8),6,10,150),TB('kabelrudern',TP(4,null,10),8,12,120),TB('schulterkh',TP(3,null,10),8,12,90),TB('latzug',TP(3,null,10),8,12,90),TB('trizeps',TP(2,null,12),10,15,60),TB('szcurls',TP(2,null,10),10,12,60)]},
   {name:'Unterkörper',col:'p',blocks:[TB('squat',TP(4,null,8),6,10,180),TB('rdl',TP(3,null,8),8,10,150),TB('bulgarian',TP(3,null,10),8,12,90),TB('beinbeuger',TP(3,null,10),10,12,90),TB('waden',TP(3,null,12),12,15,60),TB('pallof',TP(3,null,10),10,12,60)]}]},
 {id:'gk',n:'Ganzkörper A · B',d:'Alles an einem Tag, 2 Varianten im Wechsel.',days:[
   {name:'Ganzkörper A',col:'g',blocks:[TB('squat',TP(3,null,8),6,10,150),TB('bank',TP(3,null,8),6,10,150),TB('kabelrudern',TP(3,null,10),8,12,90),TB('seitheben',TP(2,null,12),12,15,60),TB('plank',TP(3,0,45),45,60,60)]},
   {name:'Ganzkörper B',col:'b',blocks:[TB('kreuzheben',TP(3,null,6),5,8,180),TB('schulterkh',TP(3,null,10),8,12,90),TB('latzug',TP(3,null,10),8,12,90),TB('ausfall',TP(2,null,10),8,12,90),TB('carry',TP(3,null,40),40,50,60)]}]},
 {id:'leer',n:'Leer',d:'Du stellst deine Tage selbst zusammen.',days:[]}];
function tplDays(t){return clone(t.days).map(d=>({...d,id:'d-'+newId(),blocks:d.blocks.map(b=>({...b,id:'b-'+newId()}))}))}

/* ---------- Abfragen ---------- */
const wkOf=ws=>(TR()&&TR().weeks[ws])||null;
const planDay=(ws,i)=>{const w=wkOf(ws),a=w&&w.d[i];return Array.isArray(a)?a.filter(x=>RUNK[x]||TDAY(x)):[]};
const hasPlan=ws=>{const w=wkOf(ws);return !!w&&Object.values(w.d).some(a=>a&&a.length)};
const sessOf=d=>{const a=dayGet(d)?.tr;return Array.isArray(a)?a:[]};
const runsOf=d=>{const a=dayGet(d)?.run;return Array.isArray(a)?a:[]};
/* ---------- Garmin: Werte von der Uhr (das Sabrly-Widget in Scriptable übernimmt sie) ---------- */
var GST=null; // Status-Dokument „garmin“: {at,err,n,last}
const gaOf=d=>{const a=dayGet(d)?.ga;return Array.isArray(a)?a.filter(x=>x&&typeof x==='object'&&x.id):[]};
// Garmin-Krafttraining den Sabrly-Sessions zuordnen: nächste Startzeit (≤ 3 h), bei je einer immer
function gaPair(d){const ses=sessOf(d).slice().sort((a,b)=>(a.st||0)-(b.st||0)),G=gaOf(d).filter(x=>x.k==='str'),m=new Map(),used=new Set(),one=ses.length===1&&G.length===1;
  for(const s of ses){let best=null,bd=Infinity;for(const g of G){if(used.has(g.id))continue;const dd=g.ts&&s.st?Math.abs(g.ts-s.st):0;if(dd<bd){bd=dd;best=g}}
    if(best&&(bd<=3*3600e3||one)){m.set(s.id,best);used.add(best.id)}}
  return {bySess:m,free:gaOf(d).filter(x=>!used.has(x.id))}}
const GTEL={RECOVERY:'Erholung',BASE:'Grundlage',AEROBIC_BASE:'Grundlage',TEMPO:'Tempo',LACTATE_THRESHOLD:'Laktatschwelle',THRESHOLD:'Schwelle',VO2MAX:'VO2max',ANAEROBIC_CAPACITY:'anaerobe Kapazität',SPEED:'Schnelligkeit',SPRINT:'Sprint',NO_BENEFIT:'kein Effekt'};
const gLbl=l=>l?(GTEL[l]||String(l).toLowerCase().replace(/_/g,' ')):'';
const ZC=['#8A9391','#6FA4FF','#46E0AE','#FF9F4A','#FF5F6D'];
const zRange=(zb,i)=>zb&&zb[i]!=null&&zb[i+1]!=null?`${zb[i]+1}–${zb[i+1]}`:'';
function zoneBar(z,zb){if(!Array.isArray(z))return '';const tot=z.reduce((a,b)=>a+(+b||0),0);if(!tot)return '';
  return `<div class="gz" role="img" aria-label="Zeit in Pulszonen">${z.map((v,i)=>v?`<i style="flex:${v};background:${ZC[i]}"></i>`:'').join('')}</div><div class="gzl">${z.map((v,i)=>`<span><b style="color:${ZC[i]}">Z${i+1}</b> ${Math.round((+v||0)/60)} min${zRange(zb,i)?`<small>${zRange(zb,i)}</small>`:''}</span>`).join('')}</div>`}
const gaMeta=x=>[x.dur?hmsx(x.dur):'',x.km?fk(x.km)+' km':'',x.hr?'Ø '+x.hr+(x.max?' / max '+x.max:''):'',x.kcal?x.kcal+' kcal':''].filter(Boolean).join(' · ');
const gaName=x=>x.k==='str'?'Krafttraining':(x.n||'Training');
function gaHero(d,x,lbl){const str=x.k==='str';
  return `<div class="thero gah" style="--c:${str?TCOL.g:TCOL.p}"><span class="label">${esc(lbl)} · ⌚ Garmin${x.st?' · '+esc(x.st):''}</span><h3>${esc(gaName(x))}</h3><span class="meta">${esc(gaMeta(x))}${x.te!=null?' · TE '+fk(x.te):''}</span>${zoneBar(x.z)}
    <div class="btns">${str&&d<=today()?`<button type="button" class="btn" data-a="wfree" data-d="${d}">Sätze nachtragen</button>`:''}<button type="button" class="btn" data-a="gahide" data-d="${d}" data-id="${esc(x.id)}">Ausblenden</button></div></div>`}
// Ein-/Auslaufen und Hauptteil aus den Lauf/Geh-Abschnitten (p: 'e' Einlaufen, 'a' Auslaufen)
const SEGN={r:'Laufen',w:'Gehen',j:'Traben'};
// Laufen und Traben zählen als Bewegung, Gehen getrennt
const segSum=L=>{const R=L.filter(x=>x.k!=='w'),W=L.filter(x=>x.k==='w'),t=R.reduce((a,x)=>a+x.t,0),m=R.reduce((a,x)=>a+x.m,0);
  return {t,m,h:t?Math.round(R.reduce((a,x)=>a+(x.h||0)*x.t,0)/t):0,w:W.reduce((a,x)=>a+x.t,0)}};
function segParts(g){const S=Array.isArray(g&&g.seg)?g.seg:[];return {E:S.filter(x=>x.p==='e'),M:S.filter(x=>!x.p),A:S.filter(x=>x.p==='a')}}
const segLine=(lb,L)=>{const s=segSum(L);return `${lb} ${msx(s.t)} · ${s.m} m${s.m&&s.t?' · '+msx(s.t/(s.m/1000))+' /km':''}${s.h?' · Ø '+s.h:''}${s.w?` · dazu ${msx(s.w)} gehen`:''}`};
// Übersicht ganz oben: das Wichtigste auf einen Blick
function gTop(R,sec,km){const g=R.g;if(!g)return '';const d=pdate(R.d),hr=+R.hr||0;
  return `<div class="card glass gtop"><div class="gtd"><span>🏃 ${DL[wd(R.d)]}, ${d.getDate()}. ${MS[d.getMonth()]}${g.st?' · '+esc(g.st)+' Uhr':''}</span><b>${esc(g.n||'Lauf')}</b></div>
    <div class="gbig"><b class="num">${km?fk(km):'–'}</b><span>km</span></div>
    <div class="gq"><div><b class="num">${hr||'–'}<small> bpm</small></b><span>Ø Herzfrequenz</span></div><div><b class="num">${sec&&km?hmsx(sec/km):'–'}<small> /km</small></b><span>Ø Pace</span></div>
      <div><b class="num">${sec?hmsx(sec):'–'}</b><span>Gesamtzeit</span></div><div><b class="num">${g.kcal||'–'}</b><span>Kalorien</span></div></div></div>`}
// Lauf-Seite: alles, was die Uhr gemessen hat
function gRunCard(r){const g=r.g;if(!g)return '';
  const k=(v,l)=>v||v===0?`<div><b class="num">${v}</b><span>${l}</span></div>`:'';
  let h=`<div class="card glass stack gcard" style="gap:12px"><span class="label">⌚ Werte der Uhr</span>
    <div class="gk">${k(g.cad||'','Schritte/min')}${k(g.asc?g.asc+' m':'','Höhenmeter')}${k(g.te!=null?fk(g.te):'','Trainingseffekt')}${k(g.load||'','Belastung')}</div>
    ${g.lbl?`<span class="hint">Wirkung laut Garmin: ${esc(gLbl(g.lbl))}${g.ate?' · anaerob '+fk(g.ate):''}</span>`:''}`;
  if(g.z)h+=`<span class="label">Pulszonen</span>${zoneBar(g.z,g.zb)}`;
  if(g.km&&g.km.length){const P=g.km.map(x=>x.m?x.t*1000/x.m:x.t),full=P.filter((p,i)=>!g.km[i].m),mx=Math.max(...full,1),mn=Math.min(...full,mx);
    h+=`<span class="label">Kilometer</span><div class="gkm"><div class="hd"><span>km</span><span></span><span>Pace</span><span>Puls</span></div>${g.km.map((x,i)=>{const p=P[i],w=x.m?20:mx===mn?100:40+(mx-p)/(mx-mn)*60;
      return `<div><span class="num">${x.m?fk(Math.round(x.m/10)/100):i+1}</span><i style="width:${w.toFixed(0)}%"></i><b class="num">${msx(p)}</b><small class="num">${x.h||'–'}</small></div>`}).join('')}</div>`}
  const W=(g.seg||[]).filter(x=>x.k==='w');
  if(g.seg&&g.seg.length&&r.t!=='iv'){if(W.length)h+=`<span class="hint">${W.length} kurze Gehpause${W.length>1?'n':''}, zusammen ${msx(W.reduce((a,x)=>a+x.t,0))} – bei lockeren Läufen zählt der Lauf als Ganzes.</span>`}
  else if(g.seg&&g.seg.length){const {E,M,A}=segParts(g);
    h+=`<span class="label">${M.some(x=>x.k==='j')?'Intervalle und Traben':'Laufen und Gehen'}</span>${E.length?`<div class="gside"><b>Einlaufen</b><span>${esc(segLine('',E).trim())}</span></div>`:''}
      <div class="gseg"><div class="hd"><span></span><span>Zeit</span><span>Strecke</span><span>Pace</span><span>Puls</span></div>${M.map(x=>`<div class="${x.k==='r'?'r':'w'}"><span>${SEGN[x.k]||'Laufen'}</span><span class="num">${msx(x.t)}</span><span class="num">${x.m} m</span><span class="num">${x.m&&x.t?msx(x.t/(x.m/1000)):''}</span><span class="num">${x.h||''}</span></div>`).join('')}</div>
      ${A.length?`<div class="gside"><b>Auslaufen</b><span>${esc(segLine('',A).trim())}</span></div>`:''}
      <span class="hint">Pace in min/km, Puls in bpm. ${M.some(x=>x.k==='j')?'Schnelle Abschnitte und Traben erkennt Sabrly am Tempo.':'Die Uhr erkennt selbst, wann du gehst.'}${g.ivx?` Erkannt: ${ivName(g.ivx)}${g.ivx.pz?', dazwischen '+esc(g.ivx.pz):''}${E.length||A.length?' – Ein- und Auslaufen stehen getrennt':''}.`:''}</span>`}
  if(g.lap&&g.lap.length>1){const LI={1:'Pause',2:'Einlaufen',3:'Auslaufen',4:'Erholung'};
    h+=`<details class="glap"><summary>Runden der Uhr (${g.lap.length})</summary><div class="hd"><span></span><span>Strecke</span><span>Zeit</span><span>Pace</span><span>Puls</span></div>${g.lap.map((x,i)=>`<div${LI[x.i]?' class="w"':''}><span>${LI[x.i]?LI[x.i]:i+1+'.'}</span><span class="num">${fk(Math.round(x.m/10)/100)} km</span><span class="num">${msx(x.t)}</span><span class="num">${x.m?msx(x.t/(x.m/1000)):''}</span><span class="num">${x.h||''}</span></div>`).join('')}</details>`}
  return h+'</div>'}
function allSess(kind){const out=[];for(const k of Object.keys(LOGS).sort().reverse()){const days=LOGS[k]?.days||{};
  for(const d of Object.keys(days).sort().reverse()){const a=days[d]&&days[d][kind];if(Array.isArray(a))for(let i=a.length-1;i>=0;i--)if(a[i])out.push({d,s:a[i]})}}return out}
const itemName=id=>RUNK[id]?RUNK[id].n:(TDAY(id)?.name||'Training');
const itemCol=id=>TCOL[RUNK[id]?RUNK[id].col:(TDAY(id)?.col||'g')];
const shortName=n=>n.length>6?n.slice(0,5)+'.':n;
function dayMin(D){let s=0;for(const b of D.blocks)s+=(b.k==='emom'?b.n*b.v:b.p.length*(b.rest+60))+120;return Math.max(5,Math.round(s/300)*5)}
// jüngste Einheit dieses Bausteins (sonst dieser Übung): {d,x,f}
function lastFor(b,e,skip){let byE=null;for(const {d,s} of allSess('tr')){if(skip&&s.id===skip)continue;
  for(const x of s.x||[]){if(!Array.isArray(x.s)||!x.s.length)continue;if(x.b===b&&x.e===e)return {d,x,f:s.feel};if(!byE&&x.e===e)byE={d,x,f:s.feel}}}return byE}
function histFor(e,b){const L=[];for(const {d,s} of allSess('tr'))for(const x of s.x||[])if(x.e===e&&(!b||x.b===b)&&Array.isArray(x.s)&&x.s.length)L.push({d,s:x.s,f:s.feel});return L}
function setsTxt(sets,e){const D=EXD(e);if(!sets||!sets.length)return '';const ks=sets.map(s=>+s.k||0),rs=sets.map(s=>s.r),same=ks.every(k=>k===ks[0]);
  const kt=D.t==='bw'&&!ks.some(Boolean)?'KG':same?(sets.length>1?sets.length+' × ':'')+(D.t==='bw'?'+':'')+fk(ks[0])+' kg':ks.map(fk).join(' · ')+' kg';
  return kt+' × '+rs.join(' · ')+(D.t==='time'?' s':'')+(D.sd?' je Seite':'')}
const topOf=sets=>{let b=null;for(const s of sets||[]){const k=+s.k||0;if(!b||k>b.k||(k===b.k&&s.r>b.r))b={k,r:+s.r||0}}return b};
// doppelte Progression: erst Wiederholungen bis zum oberen Ende, dann Gewicht. „Hart“ hält das Gewicht.
// RIR (Wiederholungen in Reserve, q 0–4; 4 = „4+“): RIR 0 → halten, überall Luft (≥ 3) → mehr steigern.
const rirOf=sets=>(sets||[]).filter(s=>s.q!=null).map(s=>+s.q);
function suggest(lo,hi,e,sets,feel){const D=EXD(e);if(!sets||!sets.length)return '';const top=Math.max(...sets.map(s=>+s.k||0)),inc=D.i||2.5,q=rirOf(sets),zero=q.includes(0),air=q.length>0&&Math.min(...q)>=3,big=q.length>0&&Math.min(...q)>=4;
  if(sets.every(s=>s.r>=hi)){if(feel===2)return `${fk(top)} kg halten – letztes Mal war es hart`;if(zero)return `${fk(top)} kg halten – letztes Mal ohne Reserve (RIR 0)`;
    const st=big?inc*2:inc;return D.t==='bw'&&!top?`Ziel erreicht → ${fk(st)} kg Zusatzgewicht`:`${fk(top+st)} kg${D.t==='bw'?' Zusatz':''}${big?' (viel Luft)':''} · wieder ab ${lo}${D.t==='time'?' s':''}`}
  if(sets.some(s=>s.r<lo))return `${fk(top)} kg halten · Ziel ${lo}–${hi}${D.t==='time'?' s':' Wdh.'}`;
  if(zero)return `${fk(top)} kg · Wdh. halten (RIR 0)`;
  if(air)return D.t==='time'?`${fk(top)} kg · +10 s (viel Luft)`:`${fk(top)} kg · +2 Wdh. (viel Luft)`;
  return D.t==='time'?`${fk(top)} kg · +5 s`:`${fk(top)} kg · +1 Wdh.`}
// „Wie schwer war's?“ aus RIR: Ø ≤ 1 → hart, Ø ≥ 3 → leicht, sonst okay (null ohne RIR)
function feelFromRir(W){const q=[];for(const x of W.it)if(x.k==='ex')for(const s of x.sets)if(wDone(s)&&s.q!=null)q.push(+s.q);if(!q.length)return null;const a=q.reduce((u,v)=>u+v,0)/q.length;return a<=1?2:a>=3?0:1}
// Plateau: mindestens 5 Einheiten, die letzten 5 ohne Fortschritt
function plateau(b,e){const H=histFor(e,b).slice(0,5);if(H.length<5)return '';const sc=H.map(h=>{const t=topOf(h.s);return t.k*1000+h.s.filter(s=>(+s.k||0)===t.k).reduce((a,s)=>a+(+s.r||0),0)});
  if(Math.max(...sc.slice(0,4))>sc[4])return '';const t=topOf(H[0].s);
  return `Seit 5 Einheiten kein Fortschritt (${fk(t.k)} kg × ${t.r}). Tipp: eine Woche etwa 10 % leichter (Deload) oder über ⇄ eine Variante.`}
function trHabit(kind){const T=TR();if(!T)return null;const hs=S.habits.filter(h=>!h.archived);
  if(kind==='run'){if(T.rhabit==='-')return null;const r=hs.find(h=>h.id===T.rhabit)||(!T.rhabit?hs.find(h=>/lauf|laufen|joggen|running/i.test(h.name)):null);if(r)return r}
  if(T.habit==='-')return null;return hs.find(h=>h.id===T.habit)||(!T.habit?hs.find(h=>/training|gym|sport|workout|fitness|kraft/i.test(h.name)):null)||null}
function tickHabit(d,kind){const x=trHabit(kind);if(!x||d>today()||isDone(x,d))return null;const e=dayEnsure(d);if(!e.h||typeof e.h!=='object')e.h={};
  e.h[x.id]=stepVal(x,d);if(d<x.created){x.created=d;touch('state')}return x}
// Sätze pro Muskelgruppe einer Woche: erledigt und geplant
function muscleWeek(ws){const done={},plan={};MUS.forEach(m=>{done[m]=0;plan[m]=0});
  const add=(o,e,n)=>{for(const [m,f] of Object.entries(EXD(e).m||{}))if(o[m]!=null)o[m]+=n*f};
  for(let i=0;i<7;i++){const d=addDays(ws,i);
    for(const s of sessOf(d))for(const x of s.x||[]){if(x.em){x.em.ok.forEach((ok,k)=>{if(ok&&x.em.it.length)add(done,x.em.it[k%x.em.it.length].e,1)})}else add(done,x.e,(x.s||[]).length)}
    for(const id of planDay(ws,i)){const D=TDAY(id);if(!D)continue;for(const b of D.blocks){if(b.k==='emom')b.it.forEach((t,k)=>add(plan,t.e,Math.ceil((b.n-k)/b.it.length)));else add(plan,b.e,b.p.length)}}}
  return {done,plan}}
const MRANGE={Brust:[10,20],Rücken:[10,20],Schultern:[8,16],Bizeps:[6,14],Trizeps:[6,14],Beine:[10,20],Core:[6,12]};

/* ---------- Zeitrad: iOS-Zeitauswahl als Minuten | Sekunden ---------- */
function twheel(sec,attrs,cls){sec=Math.max(0,Math.round(sec||0));const m=Math.min(23,Math.floor(sec/60)),s=sec%60;
  return `<span class="tw ${cls||''}"><b class="num">${m}:${pad(s)}</b><input type="time" class="tw-in" value="${pad(m)}:${pad(s)}" ${attrs} aria-label="Dauer wählen, Minuten und Sekunden"></span>`}
const twVal=v=>{const m=/^(\d{1,2}):(\d{2})/.exec(v||'');return m?+m[1]*60+ +m[2]:null};
// Dauer wie von der Uhr: 10130 → 1:01:30, 536 → 5:36
function fmtClock(v){v=String(v||'').trim();if(!v)return '';let p;
  if(/^\d+$/.test(v)){const s=v.slice(-2),m=v.slice(-4,-2),h=v.slice(0,-4);p=[+h||0,+m||0,+s||0]}
  else{const a=v.split(/[:.,]/).map(x=>+x||0);p=a.length>=3?a.slice(-3):[0,a[0]||0,a[1]||0]}
  let [h,m,s]=p;m+=Math.floor(s/60);s%=60;h+=Math.floor(m/60);m%=60;return h?`${h}:${pad(m)}:${pad(s)}`:`${m}:${pad(s)}`}
const clockSec=v=>{const a=String(v||'').split(':').map(x=>+x||0);return a.length===3?a[0]*3600+a[1]*60+a[2]:a.length===2?a[0]*60+a[1]:+a[0]||0};

/* ---------- Training: Ansichten ---------- */
const itemKey=id=>RUNK[id]?RUNK[id].col:(TDAY(id)?.col||'g');
function tagHTML(id,done){const k=itemKey(id);return `<span class="ttag${done?' ok':''}" style="--c:${TCOL[k]}${TTA[k]?';--ta:'+TTA[k]:''}">${done?'✓ ':''}${esc(RUNK[id]?RUNK[id].s:shortName(itemName(id)))}</span>`}
const doneItem=(d,id)=>RUNK[id]?runsOf(d).some(r=>(r.t==='iv')===(id==='@I')):sessOf(d).some(s=>s.day===id);
function weekCounts(ws){let kp=0,kd=0,lp=0,ld=0;for(let i=0;i<7;i++){const d=addDays(ws,i);for(const id of planDay(ws,i)){if(RUNK[id])lp++;else kp++}kd+=sessOf(d).length;ld+=runsOf(d).length}return {kp,kd,lp,ld}}
function vTSetup(){
  return `<div class="sec-h" style="margin-top:6px"><h1>Training</h1></div>
  <div class="card glass stack" style="gap:8px"><b style="font-size:17px">Wie trainierst du?</b><span class="hint" style="font-size:14px">Wähle eine Vorlage. Danach kannst du alles ändern: Tage, Übungen, Sätze, Pausen und eigene Übungen.</span></div>
  ${TPLS.map(t=>`<button type="button" class="tpl-big glass press" data-a="tsetup" data-v="${t.id}"><b>${esc(t.n)}</b><span>${esc(t.d)}</span>${t.days.length?`<span class="ttags">${t.days.map(d=>`<span class="ttag" style="--c:${TCOL[d.col]}${TTA[d.col]?';--ta:'+TTA[d.col]:''}">${esc(d.name)}</span>`).join('')}</span>`:''}</button>`).join('')}`}
function vTraining(){const T=TR();if(!T)return vTSetup();wRestore();
  const t=today(),sel=UI.tsel||t,ws=weekStart(sel),de=pdate(addDays(ws,6)),dsd=pdate(ws);
  let h=`<div class="ttop"><div style="min-width:0"><h1>Training</h1><span class="sub">KW ${kw(ws)} · ${dsd.getDate()}. ${MS[dsd.getMonth()]} – ${de.getDate()}. ${MS[de.getMonth()]}</span></div><div class="wknav"><button type="button" class="rbtn" data-a="tweek" data-dir="-1" aria-label="Vorherige Woche">‹</button><button type="button" class="rbtn" data-a="tweek" data-dir="1" aria-label="Nächste Woche">›</button><button type="button" class="rbtn" data-a="tset" aria-label="Einstellungen">⚙︎</button></div></div>`;
  if(UI.w&&!UI.w.edit)h+=`<button type="button" class="banner good trun" data-a="wresume"><b>Training läuft: ${esc(UI.w.n)}</b><span class="bs">Seit ${msx((NOW()-UI.w.st)/1000)} min · Tippen zum Fortsetzen</span></button>`;
  let days='';for(let i=0;i<7;i++){const d=addDays(ws,i),L=planDay(ws,i),extra=sessOf(d).filter(s=>!L.includes(s.day)).length+runsOf(d).filter(r=>!L.includes(r.t==='iv'?'@I':'@L')).length+gaPair(d).free.length;
    days+=`<button type="button" class="twd${d===t?' t':''}${d===sel?' sel':''}" data-a="tsel" data-d="${d}" aria-label="${fmtLong(d)}"><small>${DN[i]}</small><b class="num">${pdate(d).getDate()}</b>${L.length?L.map(id=>tagHTML(id,doneItem(d,id))).join(''):extra?'<span class="ttag ok" style="--c:var(--accent)">✓</span>':'<span class="ttag rest">–</span>'}</button>`}
  const C=weekCounts(ws);
  h+=`<section class="sec" style="gap:10px"><div class="twk">${days}</div>${C.kp||C.lp||C.kd||C.ld?`<div class="row" style="justify-content:center;gap:8px"><span class="pill num">Kraft ${C.kd}/${C.kp}</span><span class="pill num">Laufen ${C.ld}/${C.lp}</span></div>`:''}</section>`;
  if(!hasPlan(ws)){const pv=hasPlan(addDays(ws,-7));
    h+=`<div class="card glass stack" style="gap:10px"><b>${ws===weekStart(t)?'Diese Woche':'KW '+kw(ws)} ist noch nicht geplant</b><span class="hint" style="font-size:14px">Leg fest, an welchem Tag du was trainierst. Deine Schichten kannst du dabei mit eintragen.</span>
      <div class="btns"><button type="button" class="btn pri" data-a="tplan" data-ws="${ws}">Woche planen</button>${pv?`<button type="button" class="btn" data-a="tplancopy" data-ws="${ws}">Wie Vorwoche</button>`:''}</div></div>`}
  h+=dayCards(sel);
  // Sätze pro Muskelgruppe (erledigt / geplant)
  const M=muscleWeek(ws);if(MUS.some(m=>M.done[m]||M.plan[m])){const mx=Math.max(22,...MUS.map(m=>Math.max(M.done[m],M.plan[m])));
    h+=`<section class="sec"><div class="sec-h"><h2>${ws===weekStart(t)?'Diese Woche':'KW '+kw(ws)}</h2></div><div class="card glass stack" style="gap:14px"><span class="label">Sätze pro Muskelgruppe</span><div class="mbars">${MUS.map(m=>{const [a,b]=MRANGE[m],v=M.done[m],p=M.plan[m];
      return `<div class="mbar${p&&p<a?' lo':''}"><span>${m}</span><div class="tr"><u style="left:${a/mx*100}%;width:${(b-a)/mx*100}%"></u><s style="width:${Math.min(100,p/mx*100)}%"></s><i style="width:${Math.min(100,v/mx*100)}%"></i></div><b class="num">${Math.round(v)}<small>/${Math.round(p)}</small></b></div>`}).join('')}</div>
      <span class="hint">Voll = erledigt, hell = geplant, gestrichelt = sinnvoller Bereich für Muskelaufbau.${MUS.filter(m=>M.plan[m]&&M.plan[m]<MRANGE[m][0]).length?' Unter dem Bereich: '+MUS.filter(m=>M.plan[m]&&M.plan[m]<MRANGE[m][0]).join(', ')+'.':''}</span></div></section>`}
  h+=`<div class="tgrid"><button type="button" class="btn" data-a="tplan" data-ws="${ws}">📅 Woche planen<small>Tage zuweisen</small></button><button type="button" class="btn" data-a="truns">🏃 Laufen<small>Puls &amp; Pace</small></button>
    <button type="button" class="btn" data-a="tdays">🗂️ Trainingstage<small>${T.days.length} ${T.days.length===1?'Tag':'Tage'} bearbeiten</small></button><button type="button" class="btn" data-a="texl">🏋️ Übungen<small>Verlauf &amp; Bestwerte</small></button></div>
    <button type="button" class="btn" data-a="copyweek" data-ws="${ws}">📋 Woche für Claude kopieren</button>`;
  const L=allSess('tr').slice(0,6);
  if(L.length)h+=`<section class="sec"><div class="sec-h"><h2>Letzte Trainings</h2></div>${L.map(({d,s})=>sessRow(d,s)).join('')}<span class="hint">Tippen zum Bearbeiten · nach links wischen zum Löschen</span></section>`;
  return h}
function sessRow(d,s){const D=TDAY(s.day),sets=(s.x||[]).reduce((n,x)=>n+(x.em?x.em.ok.filter(Boolean).length:(x.s||[]).length),0),mins=s.en&&s.st?Math.round((s.en-s.st)/60000):0,gx=gaPair(d).bySess.get(s.id);
  return swipeRow(`<div class="todo solid"><span class="tdot" style="--c:${TCOL[D?.col||'g']}"></span><button type="button" class="tt" data-a="wedit" data-d="${d}" data-id="${esc(s.id)}"><b>${esc(s.n||D?.name||'Training')}</b><span>${fmtShort(d)} · ${(s.x||[]).length} Übungen · ${sets} Sätze${mins>0&&mins<400?' · '+mins+' min':''}${gx&&gx.hr?' · ⌚ Ø '+gx.hr:''}</span></button></div>`,
    sa('sa-del','wdel',`data-d="${d}" data-id="${esc(s.id)}"`,IC.del,'Löschen')+sa('sa-edit','wedit',`data-d="${d}" data-id="${esc(s.id)}"`,IC.edit,'Ändern'))}
function dayCards(sel){const t=today(),ws=weekStart(sel),L=planDay(ws,wd(sel)),lbl=sel===t?'Heute':dayTitle(sel);let h='';
  const ses=sessOf(sel),runs=runsOf(sel),usedS=new Set(),usedR=new Set(),GP=gaPair(sel),gm=s=>{const x=s&&GP.bySess.get(s.id);return x?`<span class="meta gmeta">⌚ ${esc(gaMeta(x))}${x.te!=null?' · TE '+fk(x.te):''}</span>`:''};
  for(const id of L){if(RUNK[id]){const iv=id==='@I',r=runs.find(x=>(x.t==='iv')===iv&&!usedR.has(x.id));if(r)usedR.add(r.id);const T=TR();
      h+=`<div class="thero run" style="--c:${itemCol(id)}"><span class="label">${esc(lbl)}</span><h3>${esc(RUNK[id].n)}</h3><span class="meta">${r?'✓ '+esc(runLine(r))+(r.g?' · ⌚':''):iv?'Intervalle, z. B. 4 × 4 min oder 3 × 8 min':'Puls unter '+T.hr}</span>
        ${r?`<button type="button" class="btn" data-a="runedit" data-d="${sel}" data-id="${esc(r.id)}">Ansehen / ändern</button>`:sel<=t?`<button type="button" class="btn pri" data-a="runnew" data-d="${sel}" data-k="${iv?'iv':'easy'}">Lauf eintragen</button>`:'<span class="pill">geplant</span>'}</div>`;continue}
    const D=TDAY(id),s=ses.find(x=>x.day===id&&!usedS.has(x.id));if(s)usedS.add(s.id);const run=UI.w&&!UI.w.edit&&UI.w.d===sel&&UI.w.day===id;
    h+=`<div class="thero tap" style="--c:${TCOL[D.col]}" data-a="dayed" data-id="${esc(id)}" role="button" tabindex="0" aria-label="${esc(D.name)} bearbeiten"><div class="row between"><span class="label">${esc(lbl)}</span><span class="tedit">✎ Bearbeiten</span></div><h3>${esc(D.name)}${D.sub?` <small>· ${esc(D.sub)}</small>`:''}</h3><span class="meta">${D.blocks.length} Übungen · ca. ${dayMin(D)} min</span>
      <div class="exl">${D.blocks.map(b=>`<span>${esc(b.k==='emom'?'EMOM '+b.it.map(x=>EXD(x.e).n).join(' / '):EXD(b.e).n)}</span>`).join('')}</div>${gm(s)}
      ${run?`<button type="button" class="btn pri" data-a="wresume">Fortsetzen</button>`:s?`<button type="button" class="btn" data-a="wedit" data-d="${sel}" data-id="${esc(s.id)}">✓ Erledigt · ansehen / ändern</button>`:sel<=t?`<button type="button" class="btn pri" data-a="wstart" data-day="${id}" data-d="${sel}">${sel===t?'Training starten':'Nachtragen'}</button>`:'<span class="pill">geplant</span>'}</div>`}
  for(const s of ses)if(!usedS.has(s.id))h+=`<div class="thero${TDAY(s.day)?' tap':''}" style="--c:${TCOL[TDAY(s.day)?.col||'g']}"${TDAY(s.day)?` data-a="dayed" data-id="${esc(s.day)}" role="button" tabindex="0"`:''}><span class="label">${esc(lbl)} · zusätzlich</span><h3>${esc(s.n)}</h3>${gm(s)}<button type="button" class="btn" data-a="wedit" data-d="${sel}" data-id="${esc(s.id)}">✓ Erledigt · ansehen / ändern</button></div>`;
  for(const r of runs)if(!usedR.has(r.id))h+=`<div class="thero run" style="--c:${TCOL[r.t==='iv'?'o':'b']}"><span class="label">${esc(lbl)} · zusätzlich</span><h3>${r.t==='iv'?'Intervalle':'Lauf'}</h3><span class="meta">✓ ${esc(runLine(r))}${r.g?' · ⌚':''}</span><button type="button" class="btn" data-a="runedit" data-d="${sel}" data-id="${esc(r.id)}">Ansehen / ändern</button></div>`;
  for(const x of GP.free)h+=gaHero(sel,x,lbl);
  if(!L.length&&!ses.length&&!runs.length&&!GP.free.length)h+=`<div class="thero rest"><span class="label">${esc(lbl)}</span><h3>${hasPlan(ws)?'Ruhetag':'Nichts geplant'}</h3><span class="meta">${hasPlan(ws)?'Erholung gehört zum Training.':'Plane die Woche oder starte einfach.'}</span>${sel<=t?`<div class="btns"><button type="button" class="btn" data-a="wfree" data-d="${sel}">Training starten</button><button type="button" class="btn" data-a="runnew" data-d="${sel}" data-k="easy">Lauf eintragen</button></div>`:''}</div>`;
  return h}
// Abschnitt auf der Heute-Seite
function heuteTraining(sel){if(!TR())return '';wRestore();const t=today(),fut=sel>t,L=planDay(weekStart(sel),wd(sel)),ses=sessOf(sel),runs=runsOf(sel),rows=[],usedS=new Set(),usedR=new Set();
  const run=UI.w&&!UI.w.edit&&UI.w.d===sel;
  const row=(cls,col,ic,name,meta,btn)=>`<div class="tday glass${cls}" style="--c:${col}"><span class="ic">${ic}</span><span class="tx"><b>${esc(name)}</b><span>${esc(meta)}</span></span>${btn}</div>`;
  for(const id of L){if(RUNK[id]){const iv=id==='@I',r=runs.find(x=>(x.t==='iv')===iv&&!usedR.has(x.id));if(r)usedR.add(r.id);
      rows.push(row(r?' ok':'',itemCol(id),'🏃',RUNK[id].n,r?runLine(r):iv?'Intervalle':'Puls unter '+TR().hr,r?`<button type="button" class="go" data-a="runedit" data-d="${sel}" data-id="${esc(r.id)}" aria-label="Lauf ansehen">✓</button>`:fut?'<span class="pill">geplant</span>':`<button type="button" class="go" data-a="runnew" data-d="${sel}" data-k="${iv?'iv':'easy'}">Eintragen</button>`));continue}
    const D=TDAY(id),s=ses.find(x=>x.day===id&&!usedS.has(x.id));if(s)usedS.add(s.id);const live=run&&UI.w.day===id;
    rows.push(row(s?' ok':'',TCOL[D.col],ICTR,D.name+(D.sub?' · '+D.sub:''),s?'Erledigt':`${D.blocks.length} Übungen · ca. ${dayMin(D)} min`,
      live?`<button type="button" class="go" data-a="wresume">Weiter</button>`:s?`<button type="button" class="go" data-a="wedit" data-d="${sel}" data-id="${esc(s.id)}" aria-label="Training ansehen">✓</button>`:fut?'<span class="pill">geplant</span>':`<button type="button" class="go" data-a="wstart" data-day="${id}" data-d="${sel}">${sel===t?'Starten':'Nachtragen'}</button>`))}
  for(const s of ses)if(!usedS.has(s.id))rows.push(row(' ok',TCOL[TDAY(s.day)?.col||'g'],ICTR,s.n,'Erledigt',`<button type="button" class="go" data-a="wedit" data-d="${sel}" data-id="${esc(s.id)}" aria-label="Training ansehen">✓</button>`));
  for(const x of gaPair(sel).free)rows.push(row(' ok',x.k==='str'?TCOL.g:TCOL.p,'⌚',gaName(x),gaMeta(x),'<span class="pill">Garmin</span>'));
  for(const r of runs)if(!usedR.has(r.id))rows.push(row(' ok',TCOL[r.t==='iv'?'o':'b'],'🏃',r.t==='iv'?'Intervalle':'Lauf',runLine(r),`<button type="button" class="go" data-a="runedit" data-d="${sel}" data-id="${esc(r.id)}" aria-label="Lauf ansehen">✓</button>`));
  if(run&&!rows.some(r=>r.includes('data-a="wresume"')))rows.unshift(row('',TCOL.g,ICTR,UI.w.n,'läuft gerade','<button type="button" class="go" data-a="wresume">Weiter</button>'));
  if(!rows.length)return '';
  return `<section class="sec hl"><div class="sec-h"><h2>Training</h2><button type="button" class="link" data-a="tab" data-t="training">Alle ›</button></div>${rows.join('')}</section>`}

/* ---------- Trainingsmodus ---------- */
function blockOf(dayId,bid){const D=TDAY(dayId);return D?D.blocks.find(b=>b.id===bid)||null:null}
const NQ=['Pause verlängert','links/rechts ungleich','Technik unsauber'];
const WUK={rad:'Rad',band:'Laufband',mob:'Mobility',sets:'Aufwärmsätze'};
const noteTxt=(q,t)=>[...(Array.isArray(q)?q:[]).map(i=>NQ[i]).filter(Boolean),String(t||'').trim()].filter(Boolean).join(' · ');
const wuTxt=(m,t)=>[m>0?m+' min':'',...(Array.isArray(t)?t:[]).map(k=>WUK[k]).filter(Boolean)].filter(Boolean).join(' · ');
const wDone=s=>s.done&&!s.w;                    // abgehakter Arbeitssatz (Aufwärmsätze zählen nicht)
const wNo=(x,j)=>x.sets.slice(0,j).filter(s=>!s.w).length;   // Index unter den Arbeitssätzen
// Zeit bis zum ersten abgehakten Arbeitssatz = Aufwärmzeit
function wFs(W){if(W.edit)return;const any=W.it.some(x=>x.k==='ex'&&x.sets.some(wDone));if(any&&!W.fs)W.fs=NOW();else if(!any)W.fs=null}
function wItemFromBlock(b,skip){if(b.k==='emom')return {k:'emom',b:b.id,v:b.v,n:b.n,its:clone(b.it),ok:Array(b.n).fill(false),r:0,run:false,end:0,left:null,note:b.note};
  const L=lastFor(b.id,b.e,skip),src=j=>(L?(L.x.s[j]||L.x.s[L.x.s.length-1]):null)||b.p[j]||b.p[b.p.length-1]||{k:null,r:b.lo};
  return {k:'ex',b:b.id,e:b.e,orig:b.e,sets:b.p.map((_,j)=>({k:src(j).k,r:src(j).r,done:false})),rest:b.rest,lo:b.lo,hi:b.hi,note:b.note,last:L?L.x.s:null,lf:L?L.f:null,plat:plateau(b.id,b.e),nq:[],nt:'',ln:L?noteTxt(L.x.nq,L.x.n):''}}
function wStart(dayId,d){const D=TDAY(dayId);if(!D)return;if(!D.blocks.length){toast('Dieser Tag hat noch keine Übungen.');go({t:'dayed',id:dayId});return}
  UI.w={d,day:dayId,n:D.name+(D.sub?' · '+D.sub:''),st:NOW(),edit:null,feel:null,wt:[],wm:null,fs:null,it:D.blocks.map(b=>wItemFromBlock(b))};UI.rest=null;wPersist();acUnlock();wakeOn();go({t:'work'})}
function wEdit(d,id){const s=sessOf(d).find(x=>x.id===id);if(!s)return;
  UI.w={d,day:s.day,n:s.n,st:s.st||NOW(),en:s.en||null,edit:s.id,feel:s.feel??null,wt:s.wu&&Array.isArray(s.wu.t)?s.wu.t.slice():[],wm:s.wu&&s.wu.m!=null?s.wu.m:null,fs:null,it:(s.x||[]).map(x=>{const b=blockOf(s.day,x.b);
    if(x.em)return {k:'emom',b:x.b,v:x.em.v,n:x.em.n,its:clone(x.em.it),ok:x.em.ok.slice(),r:x.em.n,run:false,end:0,left:null,note:''};
    return {k:'ex',b:x.b,e:x.e,orig:x.e,sets:[...(x.ws||[]).map(q=>({k:q.k,r:q.r,done:true,w:1})),...(x.s||[]).map(q=>({k:q.k,r:q.r,done:true,...(q.q!=null?{q:q.q}:{})}))],rest:b?b.rest:90,lo:b?b.lo:8,hi:b?b.hi:12,note:'',last:null,nq:Array.isArray(x.nq)?x.nq.slice():[],nt:x.n||'',ln:''}})};UI.rest=null;go({t:'work'})}
const WKEY=()=>lsKey()+':wo';
function wPersist(){try{if(UI.w&&!UI.w.edit)localStorage.setItem(WKEY(),JSON.stringify(UI.w));else localStorage.removeItem(WKEY())}catch(e){}}
function wRestore(){if(UI.w||UI.wTried===lsKey())return;UI.wTried=lsKey();try{const w=JSON.parse(localStorage.getItem(WKEY())||'null');if(w&&w.it&&w.d>=addDays(today(),-1)){if(!Array.isArray(w.wt))w.wt=[];w.it.forEach(x=>{if(x.k==='ex'&&!Array.isArray(x.nq)){x.nq=[];x.nt=x.nt||''}if(x.k==='emom'&&x.run){x.left=Math.max(1,Math.ceil((x.end-NOW())/1000));x.run=false}});UI.w=w}}catch(e){}}
function wClear(){UI.w=null;UI.rest=null;try{localStorage.removeItem(WKEY())}catch(e){}restbar();wakeOff()}
function notePanel(x,i){const t=noteTxt(x.nq,x.nt),open=UI.wno===i;
  if(open)return `<div class="tnp" role="group" aria-label="Notiz zur Übung"><div class="twc">${NQ.map((q,k)=>`<button type="button" class="chip${(x.nq||[]).includes(k)?' on':''}" data-a="wnq" data-i="${i}" data-k="${k}" aria-pressed="${(x.nq||[]).includes(k)}">${q}</button>`).join('')}</div>
    <input class="tinput" value="${esc(x.nt||'')}" placeholder="Eigene Notiz …" maxlength="200" autocomplete="off" enterkeyhint="done" data-wn="1" data-i="${i}" aria-label="Notiz"><button type="button" class="link" data-a="wnote" data-i="${i}" style="align-self:flex-start;font-size:13.5px">Notiz schließen</button></div>`;
  return t?`<button type="button" class="tnl" data-a="wnote" data-i="${i}" aria-label="Notiz bearbeiten"><span>📝</span> ${esc(t)}</button>`:''}
function warmCard(W){const ed=!!W.edit,retro=W.d<today(),t=Array.isArray(W.wt)?W.wt:[];
  const tm=ed?(W.wm>0?W.wm+' min':''):retro?'':msx(((W.fs||NOW())-W.st)/1000);
  return `<div class="card glass stack twu" style="gap:10px"><div class="row between"><span class="label">Aufwärmen</span>${tm?`<span class="num tclock" id="wwu">${tm}</span>`:''}</div>
    <div class="twc">${Object.entries(WUK).map(([k,v])=>`<button type="button" class="chip${t.includes(k)?' on':''}" data-a="wwu" data-k="${k}" aria-pressed="${t.includes(k)}">${v}</button>`).join('')}</div>
    ${ed||retro?'':`<span class="hint">${W.fs?'Aufwärmzeit gemessen – bis zu deinem ersten Arbeitssatz.':'Die Zeit läuft bis zu deinem ersten abgehakten Arbeitssatz. Satznummer antippen = Aufwärmsatz.'}</span>`}</div>`}
function exCard(x,i,cur,ed){const D=EXD(x.e),R=D.t==='time'?'s':'Wdh.';
  let h=`<div class="texc glass${cur?' cur':''}"><div class="texh"><button type="button" class="nm" data-a="exd" data-e="${esc(x.e)}">${esc(D.n)}${x.sw?' <small>· heute getauscht</small>':''}</button><button type="button" class="tib" data-a="exinfo" data-e="${esc(x.e)}" aria-label="Ausführung und Tipps">i</button><button type="button" class="tib" data-a="wswap" data-i="${i}" aria-label="Alternative">⇄</button></div>`;
  if(!ed){if(x.last)h+=`<span class="tlast">Letztes Mal: ${esc(setsTxt(x.last,x.e))}</span>`;else h+=`<span class="tlast">${x.sw?'Neu für dich – noch keine Werte':'Noch keine Einheit – Startwerte aus dem Plan'}</span>`;
    const sg=x.last&&!x.sw?suggest(x.lo,x.hi,x.e,x.last,x.lf):'';if(sg)h+=`<span class="tsug">→ ${esc(sg)}</span>`;else if(!x.last)h+=`<span class="tsug">→ Ziel ${x.lo}${x.hi>x.lo?'–'+x.hi:''} ${R}${D.sd?' je Seite':''}</span>`;
    if(x.ln&&!x.sw)h+=`<span class="tlast">Notiz letztes Mal: ${esc(x.ln)}</span>`;if(x.note)h+=`<span class="tnote">${esc(x.note)}</span>`;if(x.plat&&!x.sw)h+=`<div class="tplat">⚠︎ ${esc(x.plat)}</div>`}
  h+=`<div class="tsets">${x.sets.map((s,j)=>`<div class="tsrow${s.done?' done':''}${s.w?' warm':''}"><button type="button" class="no num" data-a="wwarm" data-i="${i}" data-j="${j}" aria-pressed="${!!s.w}" aria-label="${s.w?'Aufwärmsatz':'Satz '+(wNo(x,j)+1)} – antippen: Aufwärmsatz ein oder aus">${s.w?'A':wNo(x,j)+1}</button>
    <label>${D.t==='bw'?'<span>+</span>':''}<input inputmode="decimal" value="${fk(s.k)}" placeholder="0" data-ws="k" data-i="${i}" data-j="${j}" aria-label="Gewicht ${s.w?'Aufwärmsatz':'Satz '+(wNo(x,j)+1)}" enterkeyhint="done"><span>kg${D.du?' ×2':''}</span></label>
    <label><input inputmode="numeric" value="${s.r??''}" placeholder="0" data-ws="r" data-i="${i}" data-j="${j}" aria-label="${R} ${s.w?'Aufwärmsatz':'Satz '+(wNo(x,j)+1)}" enterkeyhint="done"><span>${R}${D.sd?' / Seite':''}</span></label>
    <button type="button" class="ck" data-a="wset" data-i="${i}" data-j="${j}" aria-label="${s.w?'Aufwärmsatz':'Satz '+(wNo(x,j)+1)} erledigt" aria-pressed="${!!s.done}">${CHECK}</button></div>${s.done&&!s.w?`<div class="trir" role="group" aria-label="Reserve Satz ${wNo(x,j)+1}"><span>Reserve</span>${[0,1,2,3,4].map(v=>`<button type="button" class="${s.q===v?'on':''}" data-a="wrir" data-i="${i}" data-j="${j}" data-v="${v}" aria-pressed="${s.q===v}" aria-label="${v>=4?'4 oder mehr':v} Wiederholungen übrig">${v>=4?'4+':v}</button>`).join('')}</div>`:''}`).join('')}</div>
    ${notePanel(x,i)}
    <div class="texf"><span class="row" style="gap:6px 16px;flex-wrap:wrap"><button type="button" class="link" data-a="waddset" data-i="${i}">+ Satz</button><button type="button" class="link" data-a="waddwu" data-i="${i}">+ Aufwärmsatz</button>${!noteTxt(x.nq,x.nt)&&UI.wno!==i?`<button type="button" class="link" data-a="wnote" data-i="${i}">+ Notiz</button>`:''}${x.sets.length>1?`<button type="button" class="link muted" data-a="wdelset" data-i="${i}">− Satz</button>`:''}</span>${ed?'':`<span class="trctl">Pause ${twheel(x.rest,`data-tw="rest" data-i="${i}"`)}</span>`}</div></div>`;
  return h}
function emomCard(x,i,cur,ed){const done=x.ok.filter(Boolean).length,fin=x.r>=x.n,its=x.its,ci=its.length?its[Math.min(x.r,x.n-1)%its.length]:null;
  const left=x.run?Math.max(0,Math.ceil((x.end-NOW())/1000)):(x.left??x.v),names=its.map(t=>EXD(t.e).n).join(' / ');
  let h=`<div class="texc glass${cur?' cur':''}"><div class="texh"><span class="nm">EMOM <small>${esc(names)}</small></span><button type="button" class="tib" data-a="wemset" data-i="${i}" aria-label="EMOM einstellen">✎</button></div>
    <span class="tlast">Alle ${msx(x.v)} min · ${x.n} Runden · ${its.map(t=>`${t.r} ${esc(EXD(t.e).n)}${t.k?' +'+fk(t.k)+' kg':''}`).join(' / ')}</span>${x.note&&!ed?`<span class="tnote">${esc(x.note)}</span>`:''}`;
  if(!ed)h+=`<div class="temom"><span class="rnd">${fin?'Fertig':`Runde ${x.r+1} von ${x.n}`}</span><span class="big num" id="em-${i}">${fin?done+'/'+x.n:msx(left)}</span>${fin?'':`<span class="cur">${ci?esc(EXD(ci.e).n)+' · '+ci.r+' Wdh.':''}</span>`}</div>`;
  h+=`<div class="tdots">${Array.from({length:x.n},(_,k)=>`<button type="button" class="${x.ok[k]?'on':k<x.r?'miss':''}" data-a="wemdot" data-i="${i}" data-k="${k}" aria-label="Runde ${k+1}${x.ok[k]?' geschafft':''}">${k+1}</button>`).join('')}</div>`;
  if(!ed)h+=fin?`<span class="hint" style="text-align:center">${done} von ${x.n} Runden geschafft. Runde antippen, um sie zu korrigieren.</span>`
    :`<div class="btns"><button type="button" class="btn${x.run?'':' pri'}" data-a="wemgo" data-i="${i}">${x.run?'Pause':x.r||x.left!=null?'Weiter':'EMOM starten'}</button>${(x.r||x.left!=null)&&!x.run?`<button type="button" class="btn" data-a="wemreset" data-i="${i}">Neu starten</button>`:''}</div><span class="hint" style="text-align:center">Ohne Timer: Runden einfach antippen.</span>`;
  else h+=`<span class="hint" style="text-align:center">${done} von ${x.n} Runden · antippen zum Ändern</span>`;
  return h+'</div>'}
function pWork(){const W=UI.w;if(!W){UI.page=null;UI.stack=[];return vTraining()}
  const ed=!!W.edit;
  let h=`<div class="ptopbar"><button type="button" class="txtbtn sec2" data-a="wcancel">Abbrechen</button><h2>${esc(W.n)}${ed?'':` · <span class="num tclock" id="wtime">${msx((NOW()-W.st)/1000)}</span>`}</h2><button type="button" class="r txtbtn pri" data-a="${ed?'wsave':'wfinish'}">${ed?'Sichern':'Fertig'}</button></div>`;
  if(ed)h+=`<span class="hint" style="text-align:center;margin-top:-10px">${fmtLong(W.d)} · nachträglich ändern</span><button type="button" class="btn" data-a="copysess" data-d="${W.d}" data-id="${esc(W.edit)}">📋 Für Claude kopieren</button>`;
  h+=warmCard(W);
  const cur=ed?-1:W.it.findIndex(x=>x.k==='ex'?x.sets.some(s=>!s.done):x.r<x.n);
  W.it.forEach((x,i)=>{h+=x.k==='ex'?exCard(x,i,i===cur,ed):emomCard(x,i,i===cur,ed)});
  h+=`<button type="button" class="btn" data-a="waddex">+ Übung für heute</button>`;
  h+=ed?`<button type="button" class="btn danger" data-a="wdel" data-d="${W.d}" data-id="${esc(W.edit)}">Training löschen</button>`:`<button type="button" class="btn pri" data-a="wfinish">Training beenden</button>`;
  return h}
function wStats(W){let sets=0,vol=0;for(const x of W.it){if(x.k==='emom'){sets+=x.ok.filter(Boolean).length;continue}for(const s of x.sets)if(wDone(s)){sets++;vol+=(+s.k||0)*(EXD(x.e).t==='time'?0:(+s.r||0))*(EXD(x.e).du?2:1)}}return {sets,vol}}
function wPRs(W){const out=[];for(const x of W.it){if(x.k!=='ex')continue;const D=EXD(x.e),S2=x.sets.filter(wDone);if(!S2.length||D.t==='time')continue;const t=topOf(S2);if(!t||!t.k)continue;
    const H=histFor(x.e);if(!H.length)continue;let best=null;for(const h of H){const b=topOf(h.s);if(!best||b.k>best.k||(b.k===best.k&&b.r>best.r))best=b}
    if(t.k>best.k||(t.k===best.k&&t.r>best.r))out.push(`${D.n} ${fk(t.k)} kg × ${t.r}`)}return out}
function wMins(W){const D=TDAY(W.day);return W.d<today()?(D?dayMin(D):60):Math.max(1,Math.round((NOW()-W.st)/60000))}
function pWDone(){const W=UI.w;if(!W){UI.page=null;UI.stack=[];return vTraining()}
  const st=wStats(W),mins=wMins(W),pr=wPRs(W),hb=trHabit('tr');
  const N=W.it.filter(x=>x.k==='ex'&&x.sets.some(wDone)).map(x=>[EXD(x.e).n,suggest(x.lo,x.hi,x.e,x.sets.filter(wDone),W.feel)]),
    NT=W.it.filter(x=>x.k==='ex'&&noteTxt(x.nq,x.nt)&&x.sets.some(wDone)).map(x=>[EXD(x.e).n,noteTxt(x.nq,x.nt)]),wu=wuTxt(W.edit||W.d<today()?0:Math.round(((W.fs||NOW())-W.st)/60000),W.wt);
  return `<div class="ptopbar"><button type="button" class="txtbtn sec2" data-a="back">Zurück</button><h2>${esc(W.n)}</h2><button type="button" class="r txtbtn pri" data-a="wsave">Speichern</button></div>
   <div class="kpis"><div class="kpi glass"><b>${mins}</b><span>${W.d<today()?'Minuten (geschätzt)':'Minuten'}</span></div><div class="kpi glass"><b>${st.sets}</b><span>Sätze</span></div><div class="kpi glass"><b>${fk(Math.round(st.vol/100)/10)}</b><span>Tonnen bewegt</span></div></div>
   ${pr.map(p=>`<div class="banner good"><b>🏆 Neuer Bestwert:</b> ${esc(p)}</div>`).join('')}
   <div class="card glass stack" style="gap:10px"><span class="label">Wie schwer war's?</span><div class="seg">${['Leicht','Okay','Hart'].map((t,i)=>`<button type="button" class="${W.feel===i?'on':''}" data-a="wfeel" data-v="${i}">${t}</button>`).join('')}</div>
   <span class="hint">${W.feelAuto?'Vorschlag aus deiner Reserve (RIR) – antippen zum Ändern. ':''}„Hart“ hält beim nächsten Mal das Gewicht, statt zu steigern.</span></div>
   ${wu?`<div class="card glass stack" style="gap:6px"><span class="label">Aufwärmen</span><span style="font-size:14.5px">${esc(wu)}</span></div>`:''}
   ${NT.length?`<div class="card glass stack" style="gap:10px"><span class="label">Notizen</span><div class="tnxt">${NT.map(([n,v])=>`<div><span>${esc(n)}</span><b>${esc(v)}</b></div>`).join('')}</div></div>`:''}
   ${N.length?`<div class="card glass stack" style="gap:10px"><span class="label">Vorschlag fürs nächste Mal</span><div class="tnxt">${N.map(([n,v])=>`<div><span>${esc(n)}</span><b>${esc(v)}</b></div>`).join('')}</div></div>`:''}
   <span class="hint">${hb?`Dein Habit „${esc(hb.name)}“ wird beim Speichern abgehakt.`:'Tipp: Leg einen Habit „Training“ an, dann wird er nach jedem Training automatisch abgehakt.'}</span>
   <button type="button" class="btn pri" data-a="wsave">Training speichern</button><button type="button" class="btn" data-a="wsavecopy">Speichern und für Claude kopieren</button>`}
function wSave(){const W=UI.w;if(!W)return;
  const x=W.it.map(it=>it.k==='ex'?{b:it.b,e:it.e,s:it.sets.filter(wDone).map(s=>({k:pnum(s.k)||0,r:clampI(s.r,0,9999,0),...(s.q!=null?{q:clampI(s.q,0,4,0)}:{})})),
      ...(it.sets.some(s=>s.done&&s.w)?{ws:it.sets.filter(s=>s.done&&s.w).map(s=>({k:pnum(s.k)||0,r:clampI(s.r,0,9999,0)}))}:{}),
      ...((it.nq&&it.nq.length)||String(it.nt||'').trim()?{nq:(it.nq||[]).filter(i=>NQ[i]),n:String(it.nt||'').trim().slice(0,200)}:{})}
    :{b:it.b,em:{v:it.v,n:it.n,it:it.its.map(t=>({e:t.e,r:t.r,k:+t.k||0})),ok:Array.from({length:it.n},(_,k)=>!!it.ok[k])}}).filter(o=>o.em?o.em.ok.some(Boolean):o.s.length);
  if(!x.length){toast('Hake mindestens einen Satz ab.');return false}
  const wm=W.edit?W.wm:(W.fs&&W.d>=today()?Math.max(0,Math.round((W.fs-W.st)/60000)):null),wt=(W.wt||[]).filter(k=>WUK[k]);
  const sess={id:W.edit||'s-'+newId(),day:W.day,n:W.n,st:W.st,en:W.edit?(W.en||W.st):W.st+wMins(W)*60000,feel:W.feel??null,...(wm!=null||wt.length?{wu:{...(wm!=null?{m:wm}:{}),t:wt}}:{}),x};
  const e=dayEnsure(W.d);if(!Array.isArray(e.tr))e.tr=[];const k=e.tr.findIndex(s=>s.id===sess.id);if(k>=0)e.tr[k]=sess;else e.tr.push(sess);
  const hb=W.edit?null:tickHabit(W.d,'tr');touch(mkey(W.d));const ed=!!W.edit;wClear();UI.page=null;UI.stack=[];render('enter');window.scrollTo(0,0);
  toast(ed?'Training geändert':hb?`Training gespeichert · „${hb.name}“ abgehakt`:'Training gespeichert');return sess}
function restbar(){const b=$('#restbar');if(!b)return;const R=UI.rest;if(!R||!UI.w||UI.w.edit||!UI.page||UI.page.t!=='work'){if(b.innerHTML)b.innerHTML='';return}
  const left=Math.max(0,Math.ceil((R.end-NOW())/1000));
  if(left<=0){UI.rest=null;b.innerHTML='';beep();tflash();try{if(navigator.vibrate)navigator.vibrate([60,60,60])}catch(e){}toast('Pause vorbei – nächster Satz');return}
  const html=`<div class="trest"><span class="rt num">${msx(left)}</span><div class="rb"><i style="width:${Math.min(100,left/R.total*100)}%"></i></div><button type="button" data-a="restm">−10 s</button><button type="button" data-a="restp">+10 s</button><button type="button" data-a="restskip">Weiter</button></div>`;
  const rt=b.querySelector('.rt');if(rt&&b.querySelector('.trest')){rt.textContent=msx(left);b.querySelector('.rb i').style.width=Math.min(100,left/R.total*100)+'%'}else{b.innerHTML=html;decorateHaptics(b)}}
setInterval(()=>{if(!UI.w||UI.w.edit)return;const onW=UI.page&&UI.page.t==='work';
  if(onW){const t=$('#wtime');if(t)t.textContent=msx((NOW()-UI.w.st)/1000);const wu=$('#wwu');if(wu&&!UI.w.fs)wu.textContent=msx((NOW()-UI.w.st)/1000);restbar()}
  let ch=false;UI.w.it.forEach((x,i)=>{if(x.k!=='emom'||!x.run)return;
    while(x.run&&NOW()>=x.end){x.ok[x.r]=true;x.r++;ch=true;if(x.r>=x.n){x.run=false;x.left=null;break}x.end+=x.v*1000}
    if(!ch&&onW){const el=document.getElementById('em-'+i);if(el)el.textContent=msx(Math.ceil((x.end-NOW())/1000))}});
  if(ch){wPersist();try{if(navigator.vibrate)navigator.vibrate(40)}catch(e){}if(onW&&!editing())render()}},500);

/* ---------- Seiten: Übungen ---------- */
function infoSheet(e){const D=EXD(e),url=D.vid||'https://www.youtube.com/results?search_query='+encodeURIComponent(D.n+' richtige Ausführung');
  sheet(`<h3>${esc(D.n)}</h3>${D.tp&&D.tp.length?`<span class="label">So geht's</span><ul>${D.tp.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:''}
    ${D.er?`<span class="label">Typischer Fehler</span><span style="font-size:14.5px">${esc(D.er)}</span>`:''}
    <span class="label">Muskeln</span><span class="hint" style="font-size:14px">${Object.keys(D.m||{}).join(', ')||'–'}</span>
    <a class="btn" href="${esc(url)}" target="_blank" rel="noopener">▶ Video ansehen</a>`)}
function pExl(){const T=TR(),own=Object.entries(T.ex);
  let h=`<div class="ptopbar"><button type="button" class="hbtn glass" data-a="back" aria-label="Zurück">${IC.back}</button><h2>Übungen</h2><button type="button" class="r txtbtn sec2" data-a="tpick" data-m="view">Suchen</button></div>`;
  for(const D of T.days){const ex=D.blocks.filter(b=>b.k==='ex');if(!ex.length)continue;
    h+=`<section class="sec"><div class="sec-h"><h2 style="font-size:22px">${esc(D.name)}</h2></div><div class="card glass" style="padding:4px 14px">${ex.map(b=>{const L=lastFor(b.id,b.e);
      return `<button type="button" class="tlrow" data-a="exd" data-e="${esc(b.e)}"><span><b>${esc(EXD(b.e).n)}</b><small>${L?fmtShort(L.d)+' · '+esc(setsTxt(L.x.s,b.e)):'noch keine Einheit'}</small></span><i>›</i></button>`}).join('')}</div></section>`}
  h+=`<section class="sec"><div class="sec-h"><h2 style="font-size:22px">Eigene Übungen</h2><button type="button" class="mini" data-a="cexnew" aria-label="Eigene Übung anlegen">+</button></div>${own.length?`<div class="card glass" style="padding:4px 14px">${own.map(([id,D])=>`<button type="button" class="tlrow" data-a="exd" data-e="${esc(id)}"><span><b>${esc(D.n)}</b><small>${esc(Object.keys(D.m).join(', ')||'eigene Übung')}</small></span><i>›</i></button>`).join('')}</div>`:'<span class="hint">Fehlt dir eine Übung? Mit + legst du sie selbst an.</span>'}</section>`;
  return h}
function pExd(){const e=UI.page.e,D=EXD(e),H=histFor(e).slice(0,12);
  let h=`<div class="ptopbar"><button type="button" class="hbtn glass" data-a="back" aria-label="Zurück">${IC.back}</button><h2>${esc(D.n)}</h2><button type="button" class="r tib big" data-a="exinfo" data-e="${esc(e)}" aria-label="Ausführung">i</button></div>`;
  if(!H.length)h+=`<div class="card glass empty"><b>Noch keine Einheit</b><span class="muted">Sobald du die Übung trainierst, siehst du hier Verlauf und Bestwert.</span></div>`;
  else{let best=null;for(const x of H){const b=topOf(x.s);if(!best||b.k>best.k||(b.k===best.k&&b.r>best.r))best={...b,d:x.d}}
    const pts=H.slice().reverse().map(x=>topOf(x.s).k),mx=Math.max(...pts),mn=Math.min(...pts),n=pts.length;
    const P=pts.map((v,i)=>[n>1?12+i*(296/(n-1)):160,mx===mn?60:100-(v-mn)/(mx-mn)*80]);
    const ld=pdate(H[0].d);h+=`<div class="kpis"><div class="kpi glass"><b>${D.t==='bw'?'+':''}${fk(best.k)}<small style="font-size:15px"> kg</small></b><span>Bestwert · ${best.r} ${D.t==='time'?'s':'Wdh.'}</span></div><div class="kpi glass"><b>${H.length}${H.length>=12?'+':''}</b><span>Einheiten</span></div><div class="kpi glass"><b>${ld.getDate()}.${pad(ld.getMonth()+1)}.</b><span>Zuletzt</span></div></div>`;
    if(n>1)h+=`<div class="card glass stack" style="gap:8px"><span class="label">Schwerster Satz · letzte ${n} Einheiten</span><svg class="tchart" viewBox="0 0 320 112"><polyline fill="none" stroke="${TCOL.g}" stroke-width="2.5" stroke-linejoin="round" points="${P.map(p=>p.map(q=>q.toFixed(1)).join(',')).join(' ')}"/>${P.map(p=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="${TCOL.g}"/>`).join('')}</svg><span class="hint">${fk(pts[0])} → ${fk(pts[n-1])} kg</span></div>`;
    h+=`<div class="card glass stack" style="gap:2px"><span class="label" style="margin-bottom:6px">Letzte Einheiten</span>${H.slice(0,8).map(x=>`<div class="row between tlh"><span>${fmtShort(x.d)}</span><span class="num">${esc(setsTxt(x.s,e))}</span></div>`).join('')}</div>`}
  if(D.own)h+=`<button type="button" class="btn" data-a="cexedit" data-e="${esc(e)}">Eigene Übung bearbeiten</button>`;
  return h}
// Auswahl aus Bibliothek + eigenen Übungen. m: view | add | blkex | blkemom | swap | wadd
function pPick(){const f=UI.page,T=TR(),q=pnorm(f.q||''),mu=f.mu||'';
  const all=[...Object.entries(T.ex).map(([id,D])=>({id,D})),...Object.entries(LIB).map(([id,D])=>({id,D}))];
  const L=all.filter(({D})=>(!mu||(D.m&&D.m[mu]>=1))&&(!q||pnorm(D.n).includes(q))).sort((a,b)=>(!!b.D.own-!!a.D.own)||a.D.n.localeCompare(b.D.n,'de'));
  const title={view:'Alle Übungen',add:'Übung hinzufügen',blkex:'Übung wählen',blkemom:'Übung für EMOM',swap:'Übung tauschen',wadd:'Übung für heute'}[f.m]||'Übungen';
  return `<div class="ptopbar"><button type="button" class="txtbtn sec2" data-a="back">Zurück</button><h2>${title}</h2><button type="button" class="r txtbtn sec2" data-a="cexnew">+ Eigene</button></div>
  <input class="tinput" id="pk-q" data-pk="q" value="${esc(f.q||'')}" placeholder="Suchen, z. B. Rudern" autocomplete="off" enterkeyhint="search">
  <div class="tchips">${['',...MUS].map(m=>`<button type="button" class="${mu===m?'on':''}" data-a="pkmu" data-v="${m}">${m||'Alle'}</button>`).join('')}</div>
  <div class="card glass" style="padding:4px 14px" id="pk-list">${pickList(L)}</div>`}
function pickList(L){return L.length?L.map(({id,D})=>`<button type="button" class="tlrow" data-a="pkset" data-e="${esc(id)}"><span><b>${esc(D.n)}${D.own?' <em class="town">eigene</em>':''}</b><small>${esc(Object.keys(D.m||{}).filter(k=>D.m[k]>=1).join(', '))} · ${D.t==='bw'?'Körpergewicht':D.t==='time'?'auf Zeit':'Gewicht'}${D.sd?' · je Seite':''}</small></span><i>›</i></button>`).join(''):'<span class="hint" style="display:block;padding:14px 0">Nichts gefunden. Mit „+ Eigene“ legst du die Übung selbst an.</span>'}
function pickApply(e){const f=UI.page,m=f.m;
  if(m==='view'){go({t:'exd',e});return}
  back();const P=UI.page;
  if(m==='add'){const D=TDAY(f.day);if(!D)return;const X=EXD(e),tm=X.t==='time';D.blocks.push(normBlock({k:'ex',e,p:TP(3,tm?0:null,tm?40:10),lo:tm?40:8,hi:tm?60:12,rest:90}));touch('state');render();toast(`${X.n} hinzugefügt`);return}
  if(m==='blkex'&&P&&P.t==='blk'){P.b.e=e;render();return}
  if(m==='blkemom'&&P&&P.t==='blk'){if(P.b.it.length>=6){toast('Höchstens 6 Übungen pro EMOM.');return}P.b.it.push({e,r:6,k:0});render();return}
  if(m==='swap'&&UI.w){const x=UI.w.it[f.i];if(!x)return;swapTo(x,e,f.perm);render();return}
  if(m==='wadd'&&UI.w){const X=EXD(e),tm=X.t==='time';UI.w.it.push({k:'ex',b:'w-'+newId(),e,orig:e,sets:TP(3,tm?0:null,tm?40:10).map(s=>({...s,done:false})),rest:90,lo:tm?40:8,hi:tm?60:12,note:'',nq:[],nt:'',ln:(()=>{const L=lastFor('',e);return L?noteTxt(L.x.nq,L.x.n):''})(),last:(()=>{const L=lastFor('',e);return L?L.x.s:null})()});wPersist();render();window.scrollTo(0,document.body.scrollHeight);toast(`${X.n} für heute hinzugefügt`)}}
function swapTo(x,e,perm){const L=lastFor(x.b,e);x.sets=x.sets.filter(s=>!s.w);x.ln=L?noteTxt(L.x.nq,L.x.n):'';x.e=e;x.sw=e!==x.orig;x.last=L?L.x.s:null;x.lf=L?L.f:null;x.plat='';
  x.sets.forEach((s,j)=>{s.done=false;delete s.q;const src=L?(L.x.s[j]||L.x.s[L.x.s.length-1]):null;s.k=src?src.k:null;s.r=src?src.r:x.lo});
  if(perm){const b=blockOf(UI.w.day,x.b);if(b){b.e=e;x.orig=e;x.sw=false;touch('state')}}wPersist();toast(perm?'Im Plan dauerhaft ersetzt':'Für heute getauscht')}
// eigene Übung anlegen/bearbeiten
function pCex(){const f=UI.page,d=f.x;
  return `<div class="ptopbar"><button type="button" class="txtbtn sec2" data-a="back">Abbrechen</button><h2>${f.id?'Übung bearbeiten':'Eigene Übung'}</h2><button type="button" class="r txtbtn pri" data-a="cexsave">Sichern</button></div>
  <div class="fgroup"><label class="label" for="cx-n">Name</label><input class="tinput" id="cx-n" data-cx="n" value="${esc(d.n)}" placeholder="z. B. Sandbag Clean" maxlength="40" autocomplete="off" enterkeyhint="done"></div>
  <div class="fgroup"><span class="label">Art</span><div class="seg">${[['kg','Gewicht × Wdh.'],['bw','Körpergewicht'],['time','Auf Zeit']].map(([k,t])=>`<button type="button" class="${d.t===k?'on':''}" data-a="cxt" data-v="${k}">${t}</button>`).join('')}</div>
    <span class="hint">${d.t==='bw'?'Du trägst Zusatzgewicht ein (0 = nur Körpergewicht) und Wiederholungen.':d.t==='time'?'Du trägst Gewicht und Sekunden ein, z. B. für Carries oder Planks.':'Du trägst Gewicht und Wiederholungen ein.'}</span></div>
  <div class="row between"><span>Je Seite (einarmig/einbeinig)</span><button type="button" class="switch${d.sd?' on':''}" data-a="cxsd" role="switch" aria-checked="${!!d.sd}" aria-label="Je Seite"></button></div>
  <div class="row between"><span>Zwei Hanteln (Gewicht je Hand)</span><button type="button" class="switch${d.du?' on':''}" data-a="cxdu" role="switch" aria-checked="${!!d.du}" aria-label="Zwei Hanteln"></button></div>
  <div class="fgroup"><span class="label">Muskeln (Hauptmuskeln antippen)</span><div class="tchips">${MUS.map(m=>`<button type="button" class="${d.m[m]?'on':''}" data-a="cxm" data-v="${m}" aria-pressed="${!!d.m[m]}">${m}</button>`).join('')}</div></div>
  <div class="fgroup"><label class="label" for="cx-i">Steigerung in kg</label><input class="tinput" id="cx-i" data-cx="i" value="${fk(d.i)}" inputmode="decimal" autocomplete="off"><span class="hint">Um so viel schlägt Sabrly vor zu steigern, z. B. 2,5 an der Langhantel oder 5 an Maschinen.</span></div>
  <div class="fgroup"><label class="label" for="cx-tp">Tipps zur Ausführung (optional, je Zeile einer)</label><textarea class="area" style="font-family:inherit;min-height:100px" id="cx-tp" data-cx="tp" maxlength="600">${esc(d.tp)}</textarea></div>
  <div class="fgroup"><label class="label" for="cx-v">Video-Link (optional)</label><input class="tinput" id="cx-v" data-cx="vid" value="${esc(d.vid)}" placeholder="https://…" inputmode="url" autocapitalize="off" autocomplete="off"></div>
  <button type="button" class="btn pri" data-a="cexsave">Sichern</button>${f.id?`<button type="button" class="btn danger" data-a="cexdel">Übung löschen</button>`:''}`}

/* ---------- Seiten: Trainingstage ---------- */
function pDays(){const T=TR();
  return `<div class="ptopbar"><button type="button" class="hbtn glass" data-a="back" aria-label="Zurück">${IC.back}</button><h2>Trainingstage</h2><button type="button" class="r txtbtn pri" data-a="daynew">+ Tag</button></div>
  ${T.days.length?T.days.map(D=>`<button type="button" class="tdaycard glass press" data-a="dayed" data-id="${esc(D.id)}" style="--c:${TCOL[D.col]}"><span class="tdot"></span><span class="tx"><b>${esc(D.name)}${D.sub?` <small>· ${esc(D.sub)}</small>`:''}</b><span>${D.blocks.length} Übungen · ca. ${dayMin(D)} min</span><small>${esc(D.blocks.map(b=>b.k==='emom'?'EMOM':EXD(b.e).n).join(' · '))}</small></span><i>›</i></button>`).join('')
    :`<div class="card glass empty"><b>Noch keine Trainingstage</b><span class="muted">Leg mit „+ Tag“ deinen ersten an.</span></div>`}
  <span class="hint">Ein Tag ist eine Vorlage, z. B. Push oder Oberkörper. Welcher Tag wann dran ist, legst du im Wochenplan fest.</span>
  <button type="button" class="btn" data-a="tresetup">Andere Vorlage wählen …</button>`}
function pDayEd(){const D=TDAY(UI.page.id);if(!D){UI.page=null;UI.stack=[];return vTraining()}
  return `<div class="ptopbar"><button type="button" class="hbtn glass" data-a="back" aria-label="Zurück">${IC.back}</button><h2>${esc(D.name)}</h2><span></span></div>
  <div class="fgroup"><label class="label" for="dy-n">Name</label><input class="tinput" id="dy-n" data-dy="name" value="${esc(D.name)}" maxlength="24" autocomplete="off" enterkeyhint="done"></div>
  <div class="fgroup"><label class="label" for="dy-s">Zusatz (optional)</label><input class="tinput" id="dy-s" data-dy="sub" value="${esc(D.sub)}" placeholder="z. B. Oberkörper" maxlength="30" autocomplete="off" enterkeyhint="done"></div>
  <div class="fgroup"><span class="label">Farbe</span><div class="tcols">${Object.entries(TCOL).map(([k,c])=>`<button type="button" class="${D.col===k?'on':''}" style="--c:${c}" data-a="daycol" data-v="${k}" aria-label="Farbe"></button>`).join('')}</div></div>
  <section class="sec"><div class="sec-h"><h2 style="font-size:22px">Übungen</h2><span class="pill num">ca. ${dayMin(D)} min</span></div>
  ${D.blocks.length?D.blocks.map((b,i)=>`<div class="tbrow glass"><button type="button" class="tt" data-a="blked" data-i="${i}"><b>${esc(b.k==='emom'?'EMOM · '+b.it.map(x=>EXD(x.e).n).join(' / '):EXD(b.e).n)}</b><span>${b.k==='emom'?`Alle ${msx(b.v)} · ${b.n} Runden`:`${b.p.length} × ${b.lo}${b.hi>b.lo?'–'+b.hi:''}${EXD(b.e).t==='time'?' s':''} · Pause ${msx(b.rest)}`}${b.note?' · '+esc(b.note):''}</span></button>
    <span class="tmv"><button type="button" data-a="blkmv" data-i="${i}" data-dir="-1" aria-label="Nach oben" ${i?'':'disabled'}>↑</button><button type="button" data-a="blkmv" data-i="${i}" data-dir="1" aria-label="Nach unten" ${i<D.blocks.length-1?'':'disabled'}>↓</button></span></div>`).join(''):'<span class="hint">Noch leer. Füge Übungen hinzu.</span>'}
  <div class="btns"><button type="button" class="btn pri" data-a="tpick" data-m="add">+ Übung</button><button type="button" class="btn" data-a="blkemomnew">+ EMOM</button></div></section>
  <button type="button" class="btn danger" data-a="daydel">Tag löschen</button>`}
// Baustein bearbeiten (Kopie in UI.page.b, gesichert mit „Sichern“)
function pBlk(){const f=UI.page,b=f.b,em=b.k==='emom',X=em?null:EXD(b.e),tm=X&&X.t==='time';
  if(!em&&f.per==null)f.per=!b.p.every(x=>x.k===b.p[0].k&&x.r===b.p[0].r);const per=!em&&f.per;
  let h=`<div class="ptopbar"><button type="button" class="txtbtn sec2" data-a="back">Abbrechen</button><h2>${em?'EMOM':esc(X.n)}</h2><button type="button" class="r txtbtn pri" data-a="blksave">Sichern</button></div>`;
  if(em){h+=`<div class="card glass stack" style="gap:14px">
    <div class="row between"><span>Takt (eine Runde)</span>${twheel(b.v,'data-tw="bv"','big')}</div>
    <div class="row between"><span>Runden</span><select class="tinput tsel" data-bk="n">${Array.from({length:40},(_,k)=>`<option value="${k+1}"${b.n===k+1?' selected':''}>${k+1}</option>`).join('')}</select></div>
    <span class="hint">Dauer gesamt: ${msx(b.v*b.n)} min. Jede Runde startet zum Takt, der Rest der Runde ist Pause.</span></div>
    <section class="sec"><div class="sec-h"><h2 style="font-size:22px">Übungen im Wechsel</h2></div>
    ${b.it.map((x,i)=>`<div class="tbrow glass"><span class="tt"><b>${i+1}. ${esc(EXD(x.e).n)}</b><span class="row" style="gap:8px;margin-top:6px"><label class="tmini"><input inputmode="numeric" value="${x.r}" data-bi="r" data-i="${i}" aria-label="Wiederholungen"><span>Wdh.</span></label><label class="tmini"><input inputmode="decimal" value="${fk(x.k)}" placeholder="0" data-bi="k" data-i="${i}" aria-label="Zusatzgewicht"><span>kg</span></label></span></span>
      <span class="tmv">${b.it.length>1?`<button type="button" data-a="bidel" data-i="${i}" aria-label="Entfernen">✕</button>`:''}</span></div>`).join('')}
    <button type="button" class="btn" data-a="tpick" data-m="blkemom">+ Übung</button>
    <span class="hint">Eine Übung = jede Runde dieselbe (z. B. nur Klimmzüge). Mehrere = sie wechseln sich ab.</span></section>`}
  else h+=`<div class="card glass stack" style="gap:14px">
    <div class="row between"><div style="min-width:0"><span class="label">Übung</span><div style="font-weight:650;margin-top:2px">${esc(X.n)}</div></div><button type="button" class="btn" data-a="tpick" data-m="blkex">Ändern</button></div>
    <div class="row between"><span>Sätze</span><div class="stepper"><button type="button" class="cbtn" data-a="bksets" data-dir="-1" aria-label="Weniger">−</button><b>${b.p.length}</b><button type="button" class="cbtn" data-a="bksets" data-dir="1" aria-label="Mehr">+</button></div></div>
    <div class="row between"><span>${tm?'Sekunden':'Wiederholungen'} von – bis</span><span class="row" style="gap:6px"><label class="tmini"><input inputmode="numeric" value="${b.lo}" data-bk="lo" aria-label="von"></label>–<label class="tmini"><input inputmode="numeric" value="${b.hi}" data-bk="hi" aria-label="bis"></label></span></div>
    ${per?`<div class="stack" style="gap:8px"><div class="row between"><span>Start pro Satz</span><button type="button" class="link" data-a="bkper" data-v="0">Alle gleich</button></div>
      ${b.p.map((x,j)=>`<div class="row between"><span class="muted">Satz ${j+1}</span><span class="row" style="gap:6px"><label class="tmini"><input inputmode="decimal" value="${fk(x.k)}" placeholder="–" data-bp="k" data-j="${j}" aria-label="Gewicht Satz ${j+1}"><span>kg</span></label><label class="tmini"><input inputmode="numeric" value="${x.r??''}" placeholder="–" data-bp="r" data-j="${j}" aria-label="${tm?'Sekunden':'Wiederholungen'} Satz ${j+1}"><span>${tm?'s':'Wdh.'}</span></label></span></div>`).join('')}</div>`
    :`<div class="row between"><div style="min-width:0"><span>Startgewicht</span><div><button type="button" class="link" data-a="bkper" data-v="1" style="font-size:13px;opacity:.75">Pro Satz einzeln ›</button></div></div><label class="tmini"><input inputmode="decimal" value="${fk(b.p[0]&&b.p[0].k)}" placeholder="–" data-bk="k" aria-label="Startgewicht"><span>kg</span></label></div>`}
    <div class="row between"><span>Pause nach jedem Satz</span>${twheel(b.rest,'data-tw="brest"','big')}</div>
    <span class="hint">Sabrly schlägt vor: erst Wiederholungen bis zum oberen Wert, dann mehr Gewicht. Die Startwerte gelten nur, solange es noch keine Einheit gibt – danach übernimmt jedes Training die Werte vom letzten Mal, und im Training kannst du jeden Satz einzeln ändern.</span></div>`;
  h+=`<div class="fgroup"><label class="label" for="bk-note">Notiz (optional)</label><input class="tinput" id="bk-note" data-bk="note" value="${esc(b.note)}" placeholder="z. B. Satz 1 Stopp bei 8" maxlength="140" autocomplete="off" enterkeyhint="done"></div>
  <button type="button" class="btn pri" data-a="blksave">Sichern</button>${f.i!=null?`<button type="button" class="btn danger" data-a="blkdel">Aus dem Tag entfernen</button>`:''}`;
  return h}

/* ---------- Seite: Woche planen ---------- */
function wkEnsure(ws){const T=TR();if(!T.weeks[ws])T.weeks[ws]={d:{},s:{}};return T.weeks[ws]}
function pPlan(){const ws=UI.page.ws,t=today(),tw=weekStart(t),w=wkOf(ws)||{d:{},s:{}},hard=id=>!!TDAY(id)||id==='@I';
  const legDay=id=>{const D=TDAY(id);return !!D&&D.blocks.some(b=>b.k==='ex'&&(EXD(b.e).m?.Beine||0)>=1)};
  let h=`<div class="ptopbar"><button type="button" class="hbtn glass" data-a="back" aria-label="Zurück">${IC.back}</button><h2>Woche planen</h2><span></span></div>
  <div class="seg">${[tw,addDays(tw,7)].map((x,i)=>`<button type="button" class="${ws===x?'on':''}" data-a="pws" data-v="${x}">${i?'Nächste':'Diese'} · KW ${kw(x)}</button>`).join('')}</div>
  <div class="btns"><button type="button" class="btn" data-a="tplancopy" data-ws="${ws}">↻ Wie Vorwoche</button><button type="button" class="btn" data-a="pclear">Leeren</button></div>`;
  for(let i=0;i<7;i++){const d=addDays(ws,i),L=planDay(ws,i),sh=w.s[i]||'',prev=i?planDay(ws,i-1):[];
    h+=`<div class="tprow glass${d===t?' t':''}"><div class="ph"><b>${DN[i]} ${pdate(d).getDate()}.</b><button type="button" class="tshift ${sh}" data-a="pshift" data-i="${i}">${sh==='F'?'Früh':sh==='S'?'Spät':sh==='N'?'Nacht':'frei'}</button></div>
      <div class="tchips2">${L.map((id,j)=>`<button type="button" class="tpchip" style="--c:${itemCol(id)}" data-a="pdel" data-i="${i}" data-j="${j}" aria-label="${esc(itemName(id))} entfernen">${esc(itemName(id))}<i>✕</i></button>`).join('')}<button type="button" class="tpadd" data-a="padd" data-i="${i}">+ Training</button></div>
      ${L.filter(hard).length>1?'<span class="twarn">⚠︎ Zwei harte Einheiten an einem Tag</span>':''}${L.includes('@I')&&prev.some(legDay)?'<span class="twarn">⚠︎ Intervalle direkt nach einem Beintag – die Beine sind evtl. noch müde</span>':''}${sh==='N'&&L.filter(hard).length?'<span class="twarn">⚠︎ Harte Einheit am Nachtschicht-Tag</span>':''}</div>`}
  return h+`<span class="hint">Schicht antippen: frei → Früh → Spät → Nacht. Alles wird sofort gespeichert.</span>`}

/* ---------- Seite: Einstellungen Training ---------- */
function pTSet(){const T=TR(),hs=S.habits.filter(h=>!h.archived),ah=trHabit('tr'),ar=trHabit('run');
  const opt=(cur,auto)=>`<option value=""${!cur?' selected':''}>Automatisch${auto?' ('+esc(auto.name)+')':' (keiner gefunden)'}</option><option value="-"${cur==='-'?' selected':''}>Keiner</option>${hs.map(h=>`<option value="${h.id}"${cur===h.id?' selected':''}>${esc(h.emoji)} ${esc(h.name)}</option>`).join('')}`;
  return `<div class="ptopbar"><button type="button" class="hbtn glass" data-a="back" aria-label="Zurück">${IC.back}</button><h2>Einstellungen</h2><span></span></div>
  <div class="card glass stack" style="gap:14px">
    <div class="fgroup"><label class="label" for="ts-h">Habit nach dem Krafttraining abhaken</label><select class="tinput" id="ts-h" data-ts="habit">${opt(T.habit,T.habit?null:ah)}</select></div>
    <div class="fgroup"><label class="label" for="ts-r">Habit nach dem Laufen abhaken</label><select class="tinput" id="ts-r" data-ts="rhabit">${opt(T.rhabit,T.rhabit?null:ar)}</select><span class="hint">Automatisch: ein Habit namens Laufen, sonst der Trainings-Habit.</span></div>
    <div class="row between"><div style="min-width:0"><span>Ton am Ende der Pause</span><div><button type="button" class="link" data-a="tsndtest" style="font-size:13px;opacity:.75">Testen ›</button></div></div><button type="button" class="switch${T.snd!==false?' on':''}" data-a="tsnd" role="switch" aria-checked="${T.snd!==false}" aria-label="Ton am Ende der Pause"></button></div>
    <div class="row between"><div style="min-width:0"><span>Bildschirm im Training anlassen</span><div class="hint">Damit Timer und Ton nicht durch die Sperre stoppen.</div></div><button type="button" class="switch${T.wake!==false?' on':''}" data-a="twake" role="switch" aria-checked="${T.wake!==false}" aria-label="Bildschirm anlassen"></button></div>
    <span class="hint">Ist dein iPhone auf lautlos, kann iOS den Ton unterdrücken. Dann leuchtet der Bildschirm am Pausenende kurz grün auf.</span>
    <div class="row between"><div style="min-width:0"><span>Pulsgrenze lockere Läufe</span><div class="hint">Darunter zählt ein Lauf für „Pace bei Puls unter …“.</div></div><div class="stepper"><button type="button" class="cbtn" data-a="thr" data-dir="-1" aria-label="Weniger">−</button><b>${T.hr}</b><button type="button" class="cbtn" data-a="thr" data-dir="1" aria-label="Mehr">+</button></div></div>
  </div>
  ${gSetCard()}
  <button type="button" class="btn" data-a="tdays">Trainingstage bearbeiten</button>`}
function gAgo(iso){const t=Date.parse(iso||'');if(!t)return '';const m=Math.round((NOW()-t)/60000);return m<2?'gerade eben':m<60?`vor ${m} min`:m<60*24?`vor ${Math.round(m/60)} h`:`vor ${Math.round(m/1440)} Tagen`}
function gSetCard(){const G=GST,how='In Scriptable das Sabrly-Skript öffnen → ⌚ Garmin';
  if(!G)return `<div class="card glass stack" style="gap:8px"><span class="label">⌚ Garmin</span><span>Läufe und Trainings automatisch von deiner Uhr</span><span class="hint">${how} und den Schlüssel aus Garmin Connect eingeben (im Browser: Einstellungen → Personal API Key). Danach übernimmt das Widget neue Einheiten selbst.</span></div>`;
  if(G.err==='key')return `<div class="card glass stack" style="gap:8px"><span class="label">⌚ Garmin</span><span style="color:var(--crit)">Schlüssel abgelaufen oder ungültig</span><span class="hint">In Garmin Connect einen neuen erstellen, dann: ${how} → Schlüssel ersetzen.</span></div>`;
  return `<div class="card glass stack" style="gap:8px"><span class="label">⌚ Garmin</span><span>Verbunden${G.at?' · geprüft '+esc(gAgo(G.at)):''}</span>${Array.isArray(G.last)&&G.last.length?`<div class="glast">${G.last.slice(0,4).map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}<span class="hint">Neue Läufe und Trainings kommen automatisch, sobald das Sabrly-Widget aktualisiert. Sofort: ${how} → Jetzt abrufen.</span></div>`}

/* ---------- Laufen ---------- */
const IVP={'4x4':{n:4,len:4,u:'min',pz:'3 min traben'},'3x8':{n:3,len:8,u:'min',pz:'2 min traben'},'6x400':{n:6,len:400,u:'m',pz:'200 m traben'},'8x200':{n:8,len:200,u:'m',pz:'200 m gehen'}};
const ivName=P=>`${P.n} × ${P.len} ${P.u}`;
function ivPace(P,v){const s=clockSec(v);if(!s)return 0;return P.u==='m'?s/(P.len/1000):s} // Sek. pro km
function runLine(r){const p=r.km>0&&r.dur?hmsx(r.dur/r.km):'';return r.t==='iv'&&r.iv?`${ivName(r.iv)}${r.km?' · '+fk(r.km)+' km':''}${r.hr?' · Ø '+r.hr:''}`:`${fk(r.km)} km${p?' · '+p+' /km':''}${r.hr?' · Ø '+r.hr:''}`}
function runDraft(d,k,r){if(r)return {d,id:r.id,t:r.t,dur:hmsx(r.dur),km:fk(r.km),hr:r.hr||'',max:r.max||'',g:r.g?clone(r.g):null,iv:r.iv?clone(r.iv):r.g&&r.g.ivx?clone(r.g.ivx):{...IVP['3x8'],p:'3x8',r:[{v:'',h:''},{v:'',h:''},{v:'',h:''}]}};
  return {d,id:null,t:k==='iv'?'iv':'easy',dur:'',km:'',hr:'',max:'',iv:{...IVP['3x8'],p:'3x8',r:Array.from({length:3},()=>({v:'',h:''}))}}}
function pRun(){const f=UI.page,R=f.r,iv=R.t==='iv',T=TR(),sec=clockSec(R.dur),km=pnum(R.km),pace=sec&&km?sec/km:0,hr=+R.hr||0;
  let h=`<div class="ptopbar"><button type="button" class="txtbtn sec2" data-a="back">Abbrechen</button><h2>${R.id?'Lauf ändern':'Lauf eintragen'}</h2><button type="button" class="r txtbtn pri" data-a="runsave">Sichern</button></div>
  ${gTop(R,sec,km)}
  <div class="seg">${[['easy','Locker / Lang'],['iv','Intervalle']].map(([k,t])=>`<button type="button" class="${R.t===k?'on':''}" data-a="rtype" data-v="${k}">${t}</button>`).join('')}</div>
  ${gRunCard(R)}
  <div class="card glass stack" style="gap:12px"><div class="fgroup"><label class="label" for="rn-d">Datum</label><input class="tinput" type="date" id="rn-d" data-rf="d" value="${esc(R.d)}" max="${today()}"></div>
    <div class="tfgrid"><div class="fgroup"><label class="label" for="rn-dur">Dauer${iv?' gesamt':''}</label><input class="tinput num" id="rn-dur" data-rf="dur" value="${esc(R.dur)}" placeholder="h:mm:ss" inputmode="numeric" autocomplete="off"></div>
    <div class="fgroup"><label class="label" for="rn-km">Distanz${iv?' gesamt':''} (km)</label><input class="tinput num" id="rn-km" data-rf="km" value="${esc(R.km)}" placeholder="0,0" inputmode="decimal" autocomplete="off"></div>
    <div class="fgroup"><label class="label" for="rn-hr">Ø-Puls</label><input class="tinput num" id="rn-hr" data-rf="hr" value="${esc(R.hr)}" placeholder="–" inputmode="numeric" autocomplete="off"></div>
    <div class="fgroup"><label class="label" for="rn-mx">Max-Puls</label><input class="tinput num" id="rn-mx" data-rf="max" value="${esc(R.max)}" placeholder="–" inputmode="numeric" autocomplete="off"></div></div>
    <div class="tpace"><b class="num" id="rn-pace">${pace?hmsx(pace):'–'}</b><span class="hint">min/km${iv?' inkl. Ein- und Auslaufen':''}</span><span style="flex:1"></span>${iv?'':`<span id="rn-hrok" class="pill" style="color:${hr?(hr<T.hr?'var(--accent)':'var(--amber)'):'var(--muted)'}">${hr?(hr<T.hr?'Puls unter '+T.hr+' ✓':'Puls über '+T.hr):'Puls unter '+T.hr+'?'}</span>`}</div>
    <span class="hint">Tipp: Dauer ohne Doppelpunkt tippen, z. B. 10130 für 1:01:30.</span></div>`;
  if(iv){const P=R.iv,dist=P.u==='m';
    h+=`<div class="card glass stack" style="gap:12px"><span class="label">Was bist du gelaufen?</span>
    <div class="tivp">${Object.keys(IVP).map(k=>`<button type="button" class="${P.p===k?'on':''}" data-a="ivp" data-v="${k}">${ivName(IVP[k])}</button>`).join('')}<button type="button" class="${P.p==='own'?'on':''}" data-a="ivp" data-v="own">Eigene</button></div>
    ${P.p==='own'?`<div class="tivcus"><label class="tmini"><input data-io="n" value="${P.n}" inputmode="numeric" aria-label="Anzahl"><span>×</span></label><label class="tmini"><input data-io="len" value="${P.len}" inputmode="numeric" aria-label="Länge"><span>${P.u}</span></label>
      <div class="seg"><button type="button" class="${P.u==='min'?'on':''}" data-a="ivu" data-v="min">min</button><button type="button" class="${P.u==='m'?'on':''}" data-a="ivu" data-v="m">m</button></div></div>
      <label class="tmini wide"><input data-io="pz" value="${esc(P.pz||'')}" placeholder="z. B. 2 min traben" aria-label="Pause dazwischen"><span>Pause</span></label>`:`<span class="hint">Dazwischen: ${esc(P.pz||'')}</span>`}
    <div class="tivrow hd"><span>Intervall</span><span>${dist?'Zeit':'Pace'}</span><span>Ø-Puls</span></div>
    ${P.r.map((v,i)=>{const ps=dist&&v.v?ivPace(P,v.v):0;return `<div class="tivrow"><span class="lb"><b>${i+1}. · ${P.len} ${P.u}</b>${dist?`<small id="ivp-${i}">${ps?'= '+msx(ps)+' /km':''}</small>`:''}</span>
      <label class="tmini"><input data-iv="${i}" data-f="v" value="${esc(v.v)}" placeholder="m:ss" inputmode="numeric" aria-label="${dist?'Zeit':'Pace'} Intervall ${i+1}"><span>${dist?'min':'/km'}</span></label>
      <label class="tmini"><input data-iv="${i}" data-f="h" value="${esc(v.h)}" placeholder="–" inputmode="numeric" aria-label="Ø-Puls Intervall ${i+1}"><span>bpm</span></label></div>`}).join('')}
    <span class="hint">Aus den Runden (Laps) deiner Uhr: bei Zeit-Intervallen die Pace, bei Strecken-Intervallen die Zeit – die Pace rechnet Sabrly aus. Ø-Puls = Durchschnittspuls in diesem Intervall. Ein Tempolauf ist „Eigene“ mit 1 × 20 min.</span></div>`}
  h+=`<span class="hint">${iv?'':'Lockere und lange Läufe landen zusammen in „Pace bei Puls unter '+T.hr+'“. '}${R.g?'Die Werte kamen von deiner Garmin-Uhr. Du kannst sie hier trotzdem ändern.':GST?'Läufe von deiner Garmin-Uhr kommen automatisch. Hier trägst du Läufe ohne Uhr ein.':'Werte aus Garmin Connect oder der Trainings-App der Apple Watch übernehmen.'}</span>`;
  if(R.id)h+=`<button type="button" class="btn" data-a="copyrun" data-d="${esc(f.od)}" data-id="${esc(R.id)}">📋 Für Claude kopieren</button><button type="button" class="btn danger" data-a="rundel" data-d="${esc(f.od)}" data-id="${esc(R.id)}">Lauf löschen</button>`;
  return h}
function runSave(){const f=UI.page,R=f.r;const dur=clockSec(fmtClock(R.dur)),km=pnum(R.km);
  if(!dur&&!km){toast('Trag mindestens Dauer oder Distanz ein.');return}
  if(!R.d||R.d>today()){toast('Bitte ein Datum bis heute wählen.');return}
  const run={id:R.id||'r-'+newId(),t:R.t,dur:dur||0,km:km||0,hr:clampI(R.hr,0,250,0),max:clampI(R.max,0,250,0)};if(R.g)run.g=R.g;
  if(R.t==='iv'){const P=R.iv;run.iv={p:P.p,n:clampI(P.n,1,30,1),len:clampI(P.len,1,50000,1),u:P.u==='m'?'m':'min',pz:String(P.pz||'').slice(0,40),r:P.r.slice(0,30).map(x=>({v:fmtClock(x.v),h:clampI(x.h,0,250,0)}))}}
  if(f.od&&f.od!==R.d){const o=dayGet(f.od);if(o&&Array.isArray(o.run)){o.run=o.run.filter(x=>x.id!==run.id);if(!o.run.length)delete o.run;touch(mkey(f.od))}}
  const e=dayEnsure(R.d);if(!Array.isArray(e.run))e.run=[];const k=e.run.findIndex(x=>x.id===run.id);if(k>=0)e.run[k]=run;else e.run.push(run);
  const hb=R.id?null:tickHabit(R.d,'run');touch(mkey(R.d));back();toast(R.id?'Lauf geändert':hb?`Lauf gespeichert · „${hb.name}“ abgehakt`:'Lauf gespeichert')}
function gTomb(e,id,on){const L=(Array.isArray(e.gdel)?e.gdel:[]).map(String).filter(x=>x!==String(id));if(on)L.push(String(id));if(L.length)e.gdel=L.slice(-60);else delete e.gdel}
function runDel(d,id){const e=dayGet(d);if(!e||!Array.isArray(e.run))return;const i=e.run.findIndex(x=>x.id===id);if(i<0)return;const [r]=e.run.splice(i,1);if(!e.run.length)delete e.run;if(r.g)gTomb(e,r.g.id,true);touch(mkey(d));
  if(UI.page&&UI.page.t==='run')back();else render();
  toast('Lauf gelöscht',()=>{const e2=dayEnsure(d);if(!Array.isArray(e2.run))e2.run=[];e2.run.splice(Math.min(i,e2.run.length),0,r);if(r.g)gTomb(e2,r.g.id,false);touch(mkey(d));render()})}
function gaHide(d,id){const e=dayGet(d);if(!e||!Array.isArray(e.ga))return;const i=e.ga.findIndex(x=>x&&String(x.id)===String(id));if(i<0)return;const [x]=e.ga.splice(i,1);if(!e.ga.length)delete e.ga;gTomb(e,id,true);touch(mkey(d));render();
  toast(gaName(x)+' ausgeblendet',()=>{const e2=dayEnsure(d);if(!Array.isArray(e2.ga))e2.ga=[];e2.ga.splice(Math.min(i,e2.ga.length),0,x);gTomb(e2,id,false);touch(mkey(d));render()})}
function pRuns(){const T=TR(),t=today(),tw=weekStart(t),all=allSess('run');
  let h=`<div class="ptopbar"><button type="button" class="hbtn glass" data-a="back" aria-label="Zurück">${IC.back}</button><h2>Laufen</h2><button type="button" class="r txtbtn pri" data-a="runnew" data-d="${t}" data-k="easy">+ Lauf</button></div>`;
  if(!all.length)return h+`<div class="card glass empty"><b>Noch keine Läufe</b><span class="muted">Trag deinen ersten Lauf ein. Danach siehst du hier, wie sich deine Pace bei gleichem Puls entwickelt.</span></div>`;
  // Pace bei Puls unter Grenze: Wochenmittel (nach km gewichtet), 8 Wochen
  const W=[];for(let k=7;k>=0;k--){const ws=addDays(tw,-7*k);let s=0,m=0;for(const {d,s:r} of all)if(d>=ws&&d<=addDays(ws,6)&&r.t==='easy'&&r.hr&&r.hr<T.hr&&r.km>0&&r.dur>0){s+=r.dur;m+=r.km}W.push({ws,p:m?s/m:null,km:0})}
  const P=W.filter(x=>x.p);
  if(P.length){const mx=Math.max(...P.map(x=>x.p)),mn=Math.min(...P.map(x=>x.p)),pts=W.map((x,i)=>x.p?[12+i*(296/7),mx===mn?60:12+(x.p-mn)/(mx-mn)*86]:null).filter(Boolean);
    const diff=P.length>1?Math.round(P[0].p-P[P.length-1].p):0;
    h+=`<div class="card glass stack" style="gap:8px"><span class="label">Pace bei Puls unter ${T.hr} · 8 Wochen</span><span class="tbig num">${hmsx(P[P.length-1].p)} <small>min/km</small></span>
      ${pts.length>1?`<svg class="tchart" viewBox="0 0 320 112"><polyline fill="none" stroke="${TCOL.b}" stroke-width="2.5" stroke-linejoin="round" points="${pts.map(p=>p.map(q=>q.toFixed(1)).join(',')).join(' ')}"/>${pts.map(p=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.5" fill="${TCOL.b}"/>`).join('')}</svg>`:''}
      <span class="hint"${diff>0?' style="color:var(--accent)"':''}>${P.length<2?'Ab zwei Wochen mit lockeren Läufen siehst du hier den Verlauf.':diff>0?`Bei gleichem Puls ${diff} s/km schneller als in KW ${kw(P[0].ws)} – deine Grundlagenausdauer wächst.`:diff<0?`Gerade ${-diff} s/km langsamer als in KW ${kw(P[0].ws)}. Schlaf, Hitze und Müdigkeit spielen mit rein.`:'Pace stabil.'} Oben = schneller.</span></div>`}
  else h+=`<div class="card glass stack" style="gap:6px"><span class="label">Pace bei Puls unter ${T.hr}</span><span class="hint">Trag bei lockeren Läufen den Ø-Puls ein. Läufe unter ${T.hr} zählen hier.</span></div>`;
  // Kilometer pro Woche mit KW
  const KM=[];for(let k=7;k>=0;k--){const ws=addDays(tw,-7*k);let s=0;for(const {d,s:r} of all)if(d>=ws&&d<=addDays(ws,6))s+=+r.km||0;KM.push({ws,v:Math.round(s*10)/10})}const kmx=Math.max(10,...KM.map(x=>x.v));
  h+=`<div class="card glass stack" style="gap:8px"><span class="label">Kilometer pro Woche</span><div class="pbars tkm">${KM.map((x,i)=>`<div class="pbcol"><b class="num">${x.v?fk(x.v):'–'}</b><div class="pbt"><i style="height:${x.v/kmx*100}%${i===7?';opacity:.6':''}"></i></div><small>KW ${kw(x.ws)}</small></div>`).join('')}</div><span class="hint">Letzte Säule = diese Woche.</span></div>`;
  // Intervalle: Verlauf für die zuletzt gelaufene Form
  const ivs=all.filter(x=>x.s.t==='iv'&&x.s.iv);
  if(ivs.length){const key=r=>ivName(r.iv),k0=key(ivs[0].s),same=ivs.filter(x=>key(x.s)===k0).slice(0,6);
    const avg=r=>{const L=r.iv.r.filter(x=>x.v),p=L.map(x=>ivPace(r.iv,x.v)).filter(Boolean),hh=r.iv.r.map(x=>+x.h).filter(Boolean);return {p:p.length?p.reduce((a,b)=>a+b,0)/p.length:0,h:hh.length?Math.round(hh.reduce((a,b)=>a+b,0)/hh.length):0,last:hh.length?hh[hh.length-1]:0}};
    h+=`<div class="card glass stack" style="gap:8px"><span class="label">Intervalle ${esc(k0)}</span>${same.map(x=>{const a=avg(x.s);return `<div class="row between tlh"><span>${fmtShort(x.d)}</span><span class="num">${a.p?msx(a.p)+' /km':'–'} · Ø ${a.h||'–'}${a.last?' · letztes '+a.last:''}</span></div>`}).join('')}
      ${same.length>1?(()=>{const a=avg(same[0].s),b=avg(same[same.length-1].s);return a.h&&b.h&&a.p&&b.p?`<span class="hint">Ø-Puls ${b.h} → ${a.h} bei ${msx(b.p)} → ${msx(a.p)} /km. ${a.h<b.h&&a.p<=b.p+3?'Gleiche Arbeit, weniger Puls – du wirst fitter.':''}</span>`:''})():''}</div>`}
  h+=`<section class="sec"><div class="sec-h"><h2>Letzte Läufe</h2></div>${all.slice(0,12).map(({d,s:r})=>swipeRow(`<div class="todo solid"><span class="tdot" style="--c:${TCOL[r.t==='iv'?'o':'b']}"></span><button type="button" class="tt" data-a="runedit" data-d="${d}" data-id="${esc(r.id)}"><b>${r.t==='iv'?'Intervalle':'Lauf'}${r.t!=='iv'&&r.hr&&r.hr<T.hr?' · locker':''}${r.g?' <span class="gtag">⌚</span>':''}</b><span>${fmtShort(d)} · ${esc(runLine(r))}${r.dur?' · '+hmsx(r.dur):''}</span></button></div>`,
    sa('sa-del','rundelq',`data-d="${d}" data-id="${esc(r.id)}"`,IC.del,'Löschen')+sa('sa-edit','runedit',`data-d="${d}" data-id="${esc(r.id)}"`,IC.edit,'Ändern'))).join('')}<span class="hint">Tippen zum Ändern · nach links wischen zum Löschen</span></section>`;
  return h}

/* ---------- Bottom-Sheet ---------- */
function sheet(h){const el=$('#sheet');if(!el)return;el.innerHTML=h?`<div class="tovl" data-a="shclose"><div class="tsheet" role="dialog" aria-modal="true"><div class="grab"></div>${h}</div></div>`:'';if(h)decorateHaptics(el)}

/* ---------- Training: Aktionen ---------- */
Object.assign(PAGES,{work:pWork,wdone:pWDone,exl:pExl,exd:pExd,pick:pPick,cex:pCex,days:pDays,dayed:pDayEd,blk:pBlk,plan:pPlan,tset:pTSet,run:pRun,runs:pRuns});
const curW=el=>UI.w&&UI.w.it[+el.dataset.i];
Object.assign(ACT,{
  shclose:(el,e)=>{if(!e||e.target===el)sheet('')},
  tsetup:el=>{const tp=TPLS.find(x=>x.id===el.dataset.v);if(!tp)return;const old=S.training;S.training=normTraining({...(old||{}),days:tplDays(tp),weeks:old?old.weeks:{}});touch('state');UI.page=null;UI.stack=[];render('enter');window.scrollTo(0,0);
    toast(tp.days.length?`${tp.n} übernommen – alles ist änderbar`:'Leg jetzt deine Tage an',old?()=>{S.training=old;touch('state');render()}:null);if(!tp.days.length)go({t:'days'})},
  tresetup:el=>{if(!el.classList.contains('arm')){el.classList.add('arm','danger');el.textContent='Ersetzt deine Tage – nochmal tippen';return}
    sheet(`<h3>Vorlage wählen</h3><span class="hint">Deine bisherigen Trainingstage werden ersetzt. Erledigte Trainings und Läufe bleiben.</span>${TPLS.map(t=>`<button type="button" class="tpl-big" data-a="tsetup2" data-v="${t.id}"><b>${esc(t.n)}</b><span>${esc(t.d)}</span></button>`).join('')}`)},
  tsetup2:el=>{sheet('');ACT.tsetup(el)},
  tsel:el=>{UI.tsel=el.dataset.d===today()?null:el.dataset.d;render()},
  tweek:el=>{UI.tsel=addDays(UI.tsel||today(),7*+el.dataset.dir);if(UI.tsel===today())UI.tsel=null;render();slideIn(+el.dataset.dir,false)},
  tset:()=>go({t:'tset'}),
  tdays:()=>go({t:'days'}),
  texl:()=>go({t:'exl'}),
  truns:()=>go({t:'runs'}),
  tplan:el=>go({t:'plan',ws:el.dataset.ws||weekStart(today())}),
  tplancopy:el=>{const ws=el.dataset.ws,pv=wkOf(addDays(ws,-7));if(!pv){toast('Die Vorwoche ist nicht geplant.');return}const old=wkOf(ws)?clone(wkOf(ws)):null;TR().weeks[ws]=clone(pv);touch('state');render();
    toast('Wie Vorwoche übernommen',()=>{if(old)TR().weeks[ws]=old;else delete TR().weeks[ws];touch('state');render()})},
  pws:el=>{UI.page.ws=el.dataset.v;render()},
  pclear:()=>{const ws=UI.page.ws,old=wkOf(ws);if(!old)return;const c=clone(old);old.d={};touch('state');render();toast('Woche geleert',()=>{TR().weeks[ws]=c;touch('state');render()})},
  pshift:el=>{const w=wkEnsure(UI.page.ws),i=el.dataset.i,o=['','F','S','N'],n=o[(o.indexOf(w.s[i]||'')+1)%4];if(n)w.s[i]=n;else delete w.s[i];touch('state',600);render()},
  pdel:el=>{const w=wkEnsure(UI.page.ws),i=el.dataset.i,id=planDay(UI.page.ws,+i)[+el.dataset.j],a=(w.d[i]||[]).slice(),k=a.indexOf(id);if(k<0)return;a.splice(k,1);if(a.length)w.d[i]=a;else delete w.d[i];touch('state',600);render()},
  padd:el=>{const i=+el.dataset.i,T=TR(),d=addDays(UI.page.ws,i);
    sheet(`<h3>${DL[i]}, ${pdate(d).getDate()}. ${MS[pdate(d).getMonth()]}</h3>${T.days.map(D=>`<button type="button" class="opt" data-a="paddk" data-i="${i}" data-k="${esc(D.id)}"><span class="tdot" style="--c:${TCOL[D.col]}"></span><span class="tx"><b>${esc(D.name)}</b><small>${D.blocks.length} Übungen · ca. ${dayMin(D)} min</small></span></button>`).join('')}
      ${Object.entries(RUNK).map(([k,v])=>`<button type="button" class="opt" data-a="paddk" data-i="${i}" data-k="${k}"><span class="tdot" style="--c:${TCOL[v.col]}"></span><span class="tx"><b>${v.n}</b><small>${k==='@I'?'z. B. 4 × 4 min oder 3 × 8 min':'Puls unter '+T.hr}</small></span></button>`).join('')}
      ${T.days.length?'':'<span class="hint">Leg zuerst unter „Trainingstage“ deine Tage an.</span>'}`)},
  paddk:el=>{const w=wkEnsure(UI.page.ws),i=el.dataset.i,a=(w.d[i]||[]).slice();if(a.length>=4){toast('Höchstens 4 Einheiten pro Tag.');return}a.push(el.dataset.k);w.d[i]=a;touch('state',600);sheet('');render()},
  wstart:el=>{if(UI.w&&!UI.w.edit){toast('Es läuft schon ein Training.');go({t:'work'});return}wStart(el.dataset.day,el.dataset.d||today())},
  wfree:el=>{const d=el.dataset.d||today(),T=TR();if(!T.days.length){go({t:'days'});return}
    sheet(`<h3>Welches Training?</h3>${T.days.map(D=>`<button type="button" class="opt" data-a="wfree2" data-day="${esc(D.id)}" data-d="${d}"><span class="tdot" style="--c:${TCOL[D.col]}"></span><span class="tx"><b>${esc(D.name)}</b><small>${D.blocks.length} Übungen · ca. ${dayMin(D)} min</small></span></button>`).join('')}`)},
  wfree2:el=>{sheet('');ACT.wstart(el)},
  wresume:()=>{wRestore();if(UI.w){acUnlock();wakeOn();go({t:'work'})}},
  wedit:el=>{if(UI.w&&!UI.w.edit){toast('Beende zuerst das laufende Training.');return}wEdit(el.dataset.d,el.dataset.id)},
  wdel:el=>{const d=el.dataset.d,id=el.dataset.id,e=dayGet(d);if(!e||!Array.isArray(e.tr))return;
    if(el.classList.contains('btn')&&!el.classList.contains('arm')){el.classList.add('arm');el.textContent='Wirklich löschen?';return}
    const i=e.tr.findIndex(s=>s.id===id);if(i<0)return;const [s]=e.tr.splice(i,1);if(!e.tr.length)delete e.tr;touch(mkey(d));if(UI.w&&UI.w.edit===id)wClear();
    if(UI.page&&UI.page.t==='work'){UI.page=null;UI.stack=[];render('enter')}else render();
    toast('Training gelöscht',()=>{const e2=dayEnsure(d);if(!Array.isArray(e2.tr))e2.tr=[];e2.tr.splice(Math.min(i,e2.tr.length),0,s);touch(mkey(d));render()})},
  wcancel:el=>{if(UI.w&&UI.w.edit){wClear();back();return}
    if(UI.w&&UI.w.it.some(x=>x.k==='ex'?x.sets.some(s=>s.done):x.ok.some(Boolean))&&!el.classList.contains('arm')){el.classList.add('arm');el.textContent='Verwerfen?';el.style.background='var(--crit)';el.style.color='#fff';return}
    wClear();UI.page=null;UI.stack=[];render('enter');window.scrollTo(0,0);toast('Training verworfen')},
  wfinish:()=>{if(!UI.w)return;if(!UI.w.it.some(x=>x.k==='ex'?x.sets.some(wDone):x.ok.some(Boolean))){toast('Hake mindestens einen Satz ab.');return}UI.rest=null;restbar();if(UI.w.feel==null||UI.w.feelAuto){const f=feelFromRir(UI.w);if(f!=null){UI.w.feel=f;UI.w.feelAuto=true}else if(UI.w.feelAuto){UI.w.feel=null;UI.w.feelAuto=false}}wPersist();go({t:'wdone'})},
  wfeel:el=>{UI.w.feel=UI.w.feel===+el.dataset.v?null:+el.dataset.v;UI.w.feelAuto=false;wPersist();render()},
  wrir:el=>{const x=curW(el);if(!x)return;const s=x.sets[+el.dataset.j];if(!s||!s.done)return;const v=+el.dataset.v;s.q=s.q===v?null:v;wPersist();render()},
  wsave:()=>{wSave()},
  wset:el=>{const x=curW(el);if(!x)return;const s=x.sets[+el.dataset.j];if(!s)return;s.done=!s.done;if(s.done&&!s.w){if(s.q==null){const j=+el.dataset.j,pv=x.sets.slice(0,j).reverse().find(t=>t.done&&t.q!=null),ls=x.last&&!x.sw?(x.last[wNo(x,j)]||x.last[x.last.length-1]):null,q0=pv?pv.q:ls&&ls.q!=null?ls.q:null;if(q0!=null)s.q=q0}}else delete s.q;wFs(UI.w);if(s.done&&!UI.w.edit){acUnlock();wakeOn()}
    if(s.done&&!UI.w.edit&&x.rest>0)UI.rest={end:NOW()+x.rest*1000,total:x.rest};else if(!s.done)UI.rest=null;wPersist();render()},
  wwarm:el=>{const x=curW(el);if(!x)return;const s=x.sets[+el.dataset.j];if(!s)return;
    if(s.w){delete s.w}else{s.w=1;delete s.q;if(!(UI.w.wt||(UI.w.wt=[])).includes('sets'))UI.w.wt.push('sets')}wFs(UI.w);wPersist();render()},
  waddwu:el=>{const x=curW(el);if(!x)return;const D=EXD(x.e),f=x.sets.find(s=>!s.w),st=D.i||2.5,k=f&&+f.k>0?Math.max(st,Math.round(f.k*.5/st)*st):null;
    x.sets.splice(x.sets.filter(s=>s.w).length,0,{k:D.t==='time'?0:k,r:D.t==='time'?20:8,done:false,w:1});if(!(UI.w.wt||(UI.w.wt=[])).includes('sets'))UI.w.wt.push('sets');wPersist();render()},
  wwu:el=>{const W=UI.w;if(!W)return;const t=W.wt||(W.wt=[]),k=el.dataset.k,i=t.indexOf(k);if(i>=0)t.splice(i,1);else t.push(k);wPersist();render()},
  wnote:el=>{const i=+el.dataset.i;UI.wno=UI.wno===i?null:i;render();if(UI.wno===i){const f=document.querySelector('[data-wn]');if(f&&!noteTxt(UI.w.it[i].nq,UI.w.it[i].nt))try{f.focus({preventScroll:true})}catch(e){}}},
  wnq:el=>{const x=curW(el);if(!x)return;const k=+el.dataset.k,q=x.nq||(x.nq=[]),j=q.indexOf(k);if(j>=0)q.splice(j,1);else q.push(k);q.sort((a,b)=>a-b);wPersist();render()},
  waddset:el=>{const x=curW(el);if(!x)return;const l=x.sets[x.sets.length-1];x.sets.push({k:l?l.k:null,r:l?l.r:x.lo,done:false});wPersist();render()},
  wdelset:el=>{const x=curW(el);if(!x||x.sets.length<2)return;x.sets.pop();wPersist();render()},
  restp:()=>{if(UI.rest){UI.rest.end+=10000;UI.rest.total+=10}restbar()},
  restm:()=>{if(UI.rest)UI.rest.end-=10000;restbar()},
  restskip:()=>{UI.rest=null;restbar()},
  wemgo:el=>{const x=curW(el);if(!x)return;if(x.run){x.left=Math.max(1,Math.ceil((x.end-NOW())/1000));x.run=false}else{x.end=NOW()+(x.left??x.v)*1000;x.left=null;x.run=true}wPersist();render()},
  wemreset:el=>{const x=curW(el);if(!x)return;x.r=0;x.ok=Array(x.n).fill(false);x.run=false;x.left=null;wPersist();render()},
  wemdot:el=>{const x=curW(el);if(!x)return;const k=+el.dataset.k;x.ok[k]=!x.ok[k];if(x.ok[k]&&k>=x.r&&!x.run)x.r=Math.min(x.n,k+1);wPersist();render()},
  wemset:el=>{const i=+el.dataset.i,x=UI.w.it[i],b=blockOf(UI.w.day,x.b);go({t:'blk',day:b?UI.w.day:null,i:b?TDAY(UI.w.day).blocks.indexOf(b):null,wi:i,b:clone(b||{k:'emom',id:x.b,v:x.v,n:x.n,it:x.its,note:x.note})})},
  waddex:()=>go({t:'pick',m:'wadd',q:'',mu:''}),
  wswap:el=>{const i=+el.dataset.i,x=UI.w.it[i],D=EXD(x.orig),al=(D.al||[]).filter(id=>LIB[id]||TR().ex[id]);UI.swapPerm=false;
    sheet(`<h3>Alternative zu ${esc(D.n)}</h3><span class="hint">Gleiches Bewegungsmuster, gleiche Muskeln.</span>
      ${al.map(id=>`<button type="button" class="opt" data-a="swapto" data-i="${i}" data-e="${id}"><span class="tx"><b>${esc(EXD(id).n)}</b><small>${esc(Object.keys(EXD(id).m||{}).join(', '))}</small></span>›</button>`).join('')}
      <button type="button" class="opt" data-a="swapsearch" data-i="${i}"><span class="tx"><b>Andere Übung suchen …</b></span>›</button>
      <div class="row between"><span>Dauerhaft im Plan ersetzen</span><button type="button" class="switch" id="swperm" data-a="swperm" role="switch" aria-checked="false" aria-label="Dauerhaft ersetzen"></button></div>
      ${x.sw?`<button type="button" class="btn" data-a="swapto" data-i="${i}" data-e="${esc(x.orig)}">Zurück zu ${esc(D.n)}</button>`:''}`)},
  swperm:el=>{UI.swapPerm=!UI.swapPerm;el.classList.toggle('on',UI.swapPerm);el.setAttribute('aria-checked',UI.swapPerm)},
  swapto:el=>{const x=curW(el);if(!x)return;swapTo(x,el.dataset.e,UI.swapPerm);sheet('');render()},
  swapsearch:el=>{const i=+el.dataset.i;sheet('');go({t:'pick',m:'swap',i,perm:UI.swapPerm,q:'',mu:''})},
  exinfo:el=>infoSheet(el.dataset.e),
  exd:el=>go({t:'exd',e:el.dataset.e}),
  tpick:el=>{const P=UI.page;go({t:'pick',m:el.dataset.m,day:P&&(P.t==='dayed'?P.id:P.day),q:'',mu:''})},
  pkmu:el=>{UI.page.mu=el.dataset.v;render()},
  pkset:el=>pickApply(el.dataset.e),
  cexnew:()=>{const q=UI.page&&UI.page.t==='pick'?UI.page.q:'';go({t:'cex',id:null,x:{n:q||'',t:'kg',sd:0,du:0,m:{},i:2.5,tp:'',vid:''}})},
  cexedit:el=>{const D=TR().ex[el.dataset.e];if(D)go({t:'cex',id:el.dataset.e,x:{n:D.n,t:D.t,sd:D.sd,du:D.du,m:{...D.m},i:D.i,tp:(D.tp||[]).join('\n'),vid:D.vid||''}})},
  cxt:el=>{UI.page.x.t=el.dataset.v;render()},
  cxsd:()=>{UI.page.x.sd=UI.page.x.sd?0:1;render()},
  cxdu:()=>{UI.page.x.du=UI.page.x.du?0:1;render()},
  cxm:el=>{const m=UI.page.x.m,k=el.dataset.v;if(m[k])delete m[k];else m[k]=1;render()},
  cexsave:()=>{const f=UI.page,x=f.x,n=(x.n||'').trim();if(!n){toast('Gib der Übung einen Namen.');$('#cx-n')?.focus();return}
    const id=f.id||'x-'+newId();TR().ex[id]=normCustom({...x,n,tp:String(x.tp||'').split('\n').map(s=>s.trim()).filter(Boolean)},id);touch('state');back();
    if(UI.page&&UI.page.t==='pick'){UI.page.q=n;render()}toast(f.id?'Übung gesichert':`„${n}“ angelegt`)},
  cexdel:el=>{const id=UI.page.id,used=TR().days.some(D=>D.blocks.some(b=>b.e===id||(b.it||[]).some(t=>t.e===id)));
    if(used){toast('Die Übung steckt noch in einem Trainingstag. Nimm sie dort zuerst raus.');return}
    if(!el.classList.contains('arm')){el.classList.add('arm');el.textContent='Wirklich löschen?';return}
    const old=TR().ex[id];delete TR().ex[id];touch('state');UI.stack=UI.stack.filter(p=>!(p.t==='exd'&&p.e===id));back();toast('Übung gelöscht',()=>{TR().ex[id]=old;touch('state');render()})},
  daynew:()=>{const T=TR();if(T.days.length>=14){toast('Höchstens 14 Trainingstage.');return}
    sheet(`<h3>Neuer Trainingstag</h3><button type="button" class="opt" data-a="daynew2" data-v=""><span class="tx"><b>Leer</b><small>Übungen selbst auswählen</small></span>›</button>
      ${TPLS.flatMap(t=>t.days.map((d,j)=>`<button type="button" class="opt" data-a="daynew2" data-v="${t.id}:${j}"><span class="tdot" style="--c:${TCOL[d.col]}"></span><span class="tx"><b>${esc(d.name)}</b><small>aus ${esc(t.n)} · ${d.blocks.length} Übungen</small></span>›</button>`)).join('')}`)},
  daynew2:el=>{sheet('');const [tid,j]=String(el.dataset.v).split(':'),tp=TPLS.find(x=>x.id===tid),T=TR(),cols=Object.keys(TCOL);
    const D=tp?tplDays({days:[tp.days[+j]]})[0]:{id:'d-'+newId(),name:'Neuer Tag',sub:'',col:cols[T.days.length%cols.length],blocks:[]};
    T.days.push(normTraining({days:[D]}).days[0]);touch('state');go({t:'dayed',id:T.days[T.days.length-1].id})},
  dayed:el=>go({t:'dayed',id:el.dataset.id}),
  daycol:el=>{const D=TDAY(UI.page.id);if(!D)return;D.col=el.dataset.v;touch('state');render()},
  daydel:el=>{const T=TR(),i=T.days.findIndex(x=>x.id===UI.page.id);if(i<0)return;
    if(!el.classList.contains('arm')){el.classList.add('arm');el.textContent='Wirklich löschen?';return}
    const [D]=T.days.splice(i,1);touch('state');back();toast(`„${D.name}“ gelöscht`,()=>{T.days.splice(Math.min(i,T.days.length),0,D);touch('state');render()})},
  blked:el=>{const D=TDAY(UI.page.id),i=+el.dataset.i;go({t:'blk',day:D.id,i,b:clone(D.blocks[i])})},
  blkemomnew:()=>{const D=TDAY(UI.page.id);go({t:'blk',day:D.id,i:null,b:normBlock({k:'emom',v:60,n:10,it:[{e:'chinup',r:6,k:0},{e:'dips',r:6,k:0}]})})},
  blkmv:el=>{const D=TDAY(UI.page.id),i=+el.dataset.i,j=i+ +el.dataset.dir;if(!D||j<0||j>=D.blocks.length)return;[D.blocks[i],D.blocks[j]]=[D.blocks[j],D.blocks[i]];touch('state');render()},
  bksets:el=>{const b=UI.page.b,n=Math.max(1,Math.min(12,b.p.length+ +el.dataset.dir));while(b.p.length<n)b.p.push({...b.p[b.p.length-1]});b.p.length=n;render()},
  bidel:el=>{UI.page.b.it.splice(+el.dataset.i,1);render()},
  bkper:el=>{const f=UI.page;f.per=el.dataset.v==='1';if(!f.per){const k=f.b.p[0]?f.b.p[0].k:null,r=f.b.p[0]?f.b.p[0].r:f.b.lo;f.b.p.forEach(x=>{x.k=k;x.r=r})}render()},
  blksave:()=>{const f=UI.page,D=TDAY(f.day);let b=normBlock(f.b);
    if(D){if(f.i!=null&&D.blocks[f.i]&&D.blocks[f.i].id===b.id)D.blocks[f.i]=b;else if(f.i==null&&!D.blocks.some(x=>x.id===b.id))D.blocks.push(b);else{const k=D.blocks.findIndex(x=>x.id===b.id);if(k>=0)D.blocks[k]=b}touch('state')}
    if(f.wi!=null&&UI.w){const x=UI.w.it[f.wi];if(x&&x.k==='emom'){const ok=x.ok;Object.assign(x,{v:b.v,n:b.n,its:clone(b.it),note:b.note,ok:Array.from({length:b.n},(_,k)=>!!ok[k])});x.r=Math.min(x.r,x.n);if(x.run){x.run=false;x.left=null}wPersist()}}
    back();toast('Gesichert')},
  blkdel:()=>{const f=UI.page,D=TDAY(f.day);if(!D||f.i==null)return;const [b]=D.blocks.splice(f.i,1);touch('state');back();toast('Entfernt',()=>{D.blocks.splice(Math.min(f.i,D.blocks.length),0,b);touch('state');render()})},
  thr:el=>{const T=TR();T.hr=Math.max(100,Math.min(200,T.hr+ +el.dataset.dir));touch('state',600);render()},
  runnew:el=>go({t:'run',od:null,r:runDraft(el.dataset.d||today(),el.dataset.k)}),
  runedit:el=>{const d=el.dataset.d,r=runsOf(d).find(x=>x.id===el.dataset.id);if(r)go({t:'run',od:d,r:runDraft(d,r.t,r)})},
  rtype:el=>{UI.page.r.t=el.dataset.v;render()},
  ivp:el=>{const P=UI.page.r.iv,k=el.dataset.v,old=P.r;if(k==='own'){P.p='own';P.pz=P.pz||'2 min traben'}else Object.assign(P,{...IVP[k],p:k});
    P.r=Array.from({length:clampI(P.n,1,30,1)},(_,i)=>old[i]||{v:'',h:''});render()},
  ivu:el=>{const P=UI.page.r.iv;P.u=el.dataset.v;P.len=P.u==='m'?1000:5;P.r=P.r.map(x=>({v:'',h:x.h}));render()},
  runsave:()=>runSave(),
  rundel:el=>{if(!el.classList.contains('arm')){el.classList.add('arm');el.textContent='Wirklich löschen?';return}runDel(el.dataset.d,el.dataset.id)},
  rundelq:el=>runDel(el.dataset.d,el.dataset.id),
  hseg:el=>{UI.hseg=el.dataset.v;render()},
  stattab:()=>{S.settings.statTab=!S.settings.statTab;if(!S.settings.statTab&&UI.tab==='statistik')UI.tab='habits';touch('state',200);render()}});
// nur kleine Abhak-Elemente und Schalter – auf Zeilen/Karten würde der Schalter das Scrollen blockieren
['wset','wsave','wfinish','wrir','wwarm','wwu','wnq','wemdot','restp','restm','restskip','cexsave','blksave','runsave','thr','stattab'].forEach(a=>HAPTIC.add(a));

/* ---------- Habits sortieren: am Griff ziehen ---------- */
const GRIP='<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.7"/><circle cx="15" cy="6" r="1.7"/><circle cx="9" cy="12" r="1.7"/><circle cx="15" cy="12" r="1.7"/><circle cx="9" cy="18" r="1.7"/><circle cx="15" cy="18" r="1.7"/></svg>';
const SORTIC='<svg viewBox="0 0 24 24" style="width:18px;height:18px" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4v15M4.5 7.5 8 4l3.5 3.5M16 20V5M12.5 16.5 16 20l3.5-3.5"/></svg>';
function vHabitSort(list){return `<span class="hint" style="margin-top:-10px">Am Griff ziehen. Die Reihenfolge gilt überall – auf Heute, in Habits und in den Widgets.</span>
  <div class="hsortl" id="hsortl">${list.map(x=>`<div class="hsrow glass" data-id="${x.id}"><span class="emo">${esc(x.emoji||'•')}</span><span class="hname">${esc(x.name)}</span><span class="hgrip" aria-label="${esc(x.name)} verschieben">${GRIP}</span></div>`).join('')}</div>`}
let HS=null;
document.addEventListener('pointerdown',e=>{const g=e.target.closest&&e.target.closest('.hgrip');if(!g)return;const row=g.closest('.hsrow'),rows=[...row.parentElement.children];if(rows.length<2)return;
  e.preventDefault();const r0=rows[0].getBoundingClientRect(),r1=rows[1].getBoundingClientRect();
  HS={row,rows,from:rows.indexOf(row),to:rows.indexOf(row),y0:e.clientY,step:r1.top-r0.top};row.classList.add('drag');try{g.setPointerCapture(e.pointerId)}catch(err){}
  try{if(navigator.vibrate)navigator.vibrate(10)}catch(err){}});
document.addEventListener('pointermove',e=>{if(!HS)return;e.preventDefault();const dy=e.clientY-HS.y0,n=HS.rows.length;
  HS.row.style.transform=`translateY(${dy}px) scale(1.02)`;const to=Math.max(0,Math.min(n-1,HS.from+Math.round(dy/HS.step)));
  if(to!==HS.to){HS.to=to;try{if(navigator.vibrate)navigator.vibrate(6)}catch(err){}}
  HS.rows.forEach((r,i)=>{if(r===HS.row)return;const sh=HS.from<i&&i<=to?-HS.step:to<=i&&i<HS.from?HS.step:0;r.style.transform=sh?`translateY(${sh}px)`:''})},{passive:false});
function hsEnd(){if(!HS)return;const {from,to}=HS;HS=null;
  if(from!==to){const act=S.habits.filter(x=>!x.archived),arc=S.habits.filter(x=>x.archived),[m]=act.splice(from,1);act.splice(to,0,m);S.habits=[...act,...arc];touch('state')}
  render()}
document.addEventListener('pointerup',hsEnd);document.addEventListener('pointercancel',hsEnd);
ACT.hsort=()=>{UI.hsort=!UI.hsort;render()};
