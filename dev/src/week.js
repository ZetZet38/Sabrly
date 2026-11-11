
/* ---------- Pausenende: Ton, kurzes Aufleuchten, Bildschirm bleibt an ---------- */
let AC=null,WL=null;
// Audio muss auf dem iPhone einmal durch einen Tipp freigeschaltet werden (passiert beim Abhaken eines Satzes)
function acUnlock(){try{if(navigator.audioSession)navigator.audioSession.type='transient'}catch(e){}
  try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume();const b=AC.createBuffer(1,1,22050),s=AC.createBufferSource();s.buffer=b;s.connect(AC.destination);s.start(0)}catch(e){}}
function beep(force){if(!force&&(!TR()||TR().snd===false))return;try{if(!AC)return;if(AC.state==='suspended')AC.resume();const t0=AC.currentTime+.02;
  [[0,880],[.24,880],[.48,1320]].forEach(([dt,f])=>{const o=AC.createOscillator(),g=AC.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.0001,t0+dt);g.gain.exponentialRampToValueAtTime(.55,t0+dt+.02);g.gain.exponentialRampToValueAtTime(.0001,t0+dt+(dt>.4?.42:.2));o.connect(g);g.connect(AC.destination);o.start(t0+dt);o.stop(t0+dt+.45)})}catch(e){}}
function tflash(){document.body.classList.remove('tflash');void document.body.offsetWidth;document.body.classList.add('tflash');setTimeout(()=>document.body.classList.remove('tflash'),1000)}
async function wakeOn(){if(!TR()||TR().wake===false||!('wakeLock' in navigator))return;try{if(!WL||WL.released)WL=await navigator.wakeLock.request('screen')}catch(e){}}
function wakeOff(){try{if(WL)WL.release()}catch(e){}WL=null}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&UI.w&&!UI.w.edit)wakeOn()});

/* ---------- Wochenrückblick ---------- */
function weekReview(ws){const t=today(),end=addDays(ws,6),last=end<t?end:t,days=[];for(let i=0;i<7;i++){const d=addDays(ws,i);if(d<=last)days.push(d)}
  const pct=w=>{const L=[];for(let i=0;i<7;i++){const d=addDays(w,i);if(d>t)break;if(active(d).length)L.push(dayScore(d))}return L.length?Math.round(L.reduce((a,b)=>a+b,0)/L.length*100):null};
  const per=S.habits.filter(x=>!x.archived&&x.created<=last).map(x=>{if(x.freq==='weekly'){const c=weekCount(x,ws,last);return {x,v:c,T:x.target,p:c/x.target}}
    let v=0,T=0;for(const d of days)if(x.created<=d&&scheduled(x,d)){T++;v+=frac(x,d)}return {x,v:Math.round(v*10)/10,T,p:T?v/T:1}}).filter(o=>o.T>0);
  const pl=days.map(d=>prayerDay(d)).filter(Boolean),pa=pl.map(p=>p.avg).filter(v=>v!=null);
  const ms=days.map(d=>dayGet(d)?.mood).filter(Boolean);
  let km=0;for(const d of days)for(const r of runsOf(d))km+=+r.km||0;
  return {ws,days,hp:pct(ws),hpPrev:pct(addDays(ws,-7)),per,good:per.filter(o=>o.p>=1),weak:per.filter(o=>o.p<.6).sort((a,b)=>a.p-b.p).slice(0,3),
    pr:pa.length?Math.round(pa.reduce((a,b)=>a+b,0)/pa.length*100):null,mood:ms.length?ms.reduce((a,b)=>a+b,0)/ms.length:null,
    todos:S.todos.filter(x=>x.done&&x.doneAt&&x.doneAt>=ws&&x.doneAt<=end).length,C:TR()?weekCounts(ws):null,km:Math.round(km*10)/10}}
function weekCard(ws){const R=weekReview(ws),C=R.C,nws=addDays(ws,7),M=R.mood?MOODS[Math.max(0,Math.min(4,Math.round(R.mood)-1))]:'–';
  const good=R.good.map(o=>o.x.name),weak=R.weak.map(o=>`${o.x.name} ${fk(o.v)}/${o.T}`);
  if(C&&C.kp){if(C.kd>=C.kp)good.push('alle Krafteinheiten');else weak.push(`Kraft ${C.kd}/${C.kp}`)}
  if(C&&C.lp){if(C.ld>=C.lp)good.push('alle Läufe');else weak.push(`Laufen ${C.ld}/${C.lp}`)}
  const dh=R.hp!=null&&R.hpPrev!=null?R.hp-R.hpPrev:null;
  return `<section class="sec"><div class="card glass stack wrev" style="gap:12px"><div class="row between"><span class="label">Wochenrückblick · KW ${kw(ws)}</span><button type="button" class="link muted" data-a="revhide" data-ws="${ws}" style="font-size:13px">Ausblenden</button></div>
    <div class="wrk"><div><b class="num">${R.hp??'–'}${R.hp!=null?'<small>%</small>':''}</b><span>Habits${dh!=null?` <em class="${dh>=0?'up':'dn'}">${dh>=0?'+':''}${dh}</em>`:''}</span></div>
      ${C?`<div><b class="num">${C.kp?C.kd+'/'+C.kp:C.kd}</b><span>Kraft</span></div><div><b class="num">${fk(R.km)||'0'}<small>km</small></b><span>Laufen</span></div>`:''}<div><b>${M}</b><span>Stimmung</span></div></div>
    ${good.length?`<div class="wrl"><b>👍 Lief gut</b><span>${esc(good.slice(0,5).join(', '))}</span></div>`:''}
    ${weak.length?`<div class="wrl"><b>👎 Ausbaufähig</b><span>${esc(weak.slice(0,4).join(', '))}</span></div>`:''}
    ${R.pr!=null?`<div class="wrl"><b>🕌 Gebete</b><span>Ø ${R.pr} % pünktlich</span></div>`:''}${R.todos?`<div class="wrl"><b>✅ Aufgaben</b><span>${R.todos} erledigt</span></div>`:''}
    <div class="btns">${TR()&&!hasPlan(nws)?`<button type="button" class="btn pri" data-a="tplan" data-ws="${nws}">Nächste Woche planen</button>`:''}<button type="button" class="btn" data-a="copyweek" data-ws="${ws}">Für Claude kopieren</button></div></div></section>`}
// Sonntag: diese Woche · Montag: die vergangene (bis ausgeblendet)
function weekCardHeute(t){const w=wd(t),ws=w===6?weekStart(t):w===0?addDays(weekStart(t),-7):null;if(!ws||S.settings.revSeen===ws)return '';if(!S.habits.some(x=>!x.archived)&&!TR())return '';return weekCard(ws)}

/* ---------- Für Claude kopieren: kompakter Text statt Screenshots ---------- */
const dmy=d=>{const x=pdate(d);return `${DN[wd(d)]} ${x.getDate()}.${x.getMonth()+1}.`};
function setLine(e,sets){const D=EXD(e);return (sets||[]).map(s=>`${D.t==='bw'?(+s.k?'+'+fk(s.k)+' kg':'KG'):fk(+s.k||0)+' kg'} × ${s.r}${D.t==='time'?' s':''}${s.q!=null?` (RIR ${s.q>=4?'4+':s.q})`:''}`).join(' · ')+(D.sd?' (je Seite)':'')+(D.du?' (Gewicht je Hand)':'')}
function sessText(d,s){const mins=s.en&&s.st?Math.round((s.en-s.st)/60000):0,L=[`${dmy(d)} – ${s.n}${mins>0&&mins<400?' · '+mins+' min':''}${s.feel!=null?' · Gefühl: '+['leicht','okay','hart'][s.feel]:''}`];
  const wu=s.wu?wuTxt(s.wu.m,s.wu.t):'';if(wu)L.push('  Aufwärmen: '+wu);
  for(const x of s.x||[]){const b=blockOf(s.day,x.b);
    if(x.em){const em=x.em;L.push(`  EMOM alle ${msx(em.v)} min, ${em.n} Runden (${em.it.map(t=>`${t.r} ${EXD(t.e).n}${t.k?' +'+fk(t.k)+' kg':''}`).join(' / ')}): ${em.ok.filter(Boolean).length}/${em.n} Runden geschafft`);continue}
    const nt=noteTxt(x.nq,x.n);
    L.push(`  ${EXD(x.e).n}: ${setLine(x.e,x.s)}${b&&b.e===x.e?` (Ziel ${b.lo}${b.hi>b.lo?'–'+b.hi:''}${EXD(x.e).t==='time'?' s':''})`:''}${Array.isArray(x.ws)&&x.ws.length?' · Aufwärmsätze: '+setLine(x.e,x.ws):''}${nt?' · Notiz: '+nt:''}`)}
  const gx=gaPair(d).bySess.get(s.id);if(gx)L.push('  '+gaLine(gx));
  return L.join('\n')}
// Garmin-Werte als Text: Dauer, Puls, Kalorien, Trainingseffekt, Zonen
function gaLine(x){const P=[x.dur?hmsx(x.dur):'',x.km?fk(x.km)+' km':'',x.hr?'Ø-Puls '+x.hr:'',x.max?'max '+x.max:'',x.kcal?x.kcal+' kcal':'',x.te!=null?'Trainingseffekt '+fk(x.te)+(x.ate?' / anaerob '+fk(x.ate):'')+(x.lbl?' ('+gLbl(x.lbl)+')':''):'',x.load?'Belastung '+x.load:''].filter(Boolean);
  return `Garmin${x.st?' ab '+x.st:''}: ${P.join(' · ')}${Array.isArray(x.z)&&x.z.some(Boolean)?' · Zonen '+x.z.map((v,i)=>`Z${i+1} ${msx(v)}`).join(' '):''}`}
function gaText(d,x){return `${dmy(d)} – ${gaName(x)}${x.k==='str'?' (nur Garmin, keine Sätze in Sabrly)':''}\n  ${gaLine(x)}`}
function runText(d,r){const pace=r.km>0&&r.dur?hmsx(r.dur/r.km)+' /km':'';
  const L=[`${dmy(d)} – ${r.t==='iv'?'Intervalle'+(r.iv?' '+ivName(r.iv):''):'Lauf locker/lang'} · ${fk(r.km)} km · ${hmsx(r.dur)}${pace?' · Ø '+pace:''}${r.hr?' · Ø-Puls '+r.hr:''}${r.max?' · max '+r.max:''}`];
  if(r.t==='iv'&&r.iv){L.push(`  Pause dazwischen: ${r.iv.pz||'–'}`);r.iv.r.forEach((x,i)=>{if(!x.v&&!x.h)return;const ps=ivPace(r.iv,x.v);L.push(`  ${i+1}) ${r.iv.len} ${r.iv.u}: ${r.iv.u==='m'?x.v+' min ('+(ps?msx(ps)+' /km':'–')+')':(x.v||'–')+' /km'}${x.h?' · Ø-Puls '+x.h:''}`)})}
  const g=r.g;if(g){const P=[g.st?'Start '+g.st:'',g.cad?'Kadenz '+g.cad+'/min':'',g.stl?'Schrittlänge '+g.stl+' cm':'',g.asc?g.asc+' Hm':'',g.kcal?g.kcal+' kcal':'',
      g.te!=null?'Trainingseffekt '+fk(g.te)+(g.ate?' / anaerob '+fk(g.ate):'')+(g.lbl?' ('+gLbl(g.lbl)+')':''):'',g.load?'Belastung '+g.load:'',g.vo2?'VO2max '+g.vo2:''].filter(Boolean);
    L.push('  Garmin: '+P.join(' · '));
    if(Array.isArray(g.z)&&g.z.some(Boolean))L.push('  Pulszonen: '+g.z.map((v,i)=>`Z${i+1}${zRange(g.zb,i)?' ('+zRange(g.zb,i)+')':''} ${msx(v)}`).join(' · ')+(g.mhr?' · HFmax '+g.mhr:'')+(g.rhr?' · Ruhepuls '+g.rhr:''));
    if(g.km&&g.km.length){const hc=g.km.some(x=>x.c),he=g.km.some(x=>x.e!=null);
      L.push(`  km-Splits (Pace, Ø-Puls${hc?', Kadenz':''}${he?', Höhe ±m':''}): `+g.km.map((x,i)=>{const v=[x.h||'',hc&&x.c?x.c:'',he&&x.e!=null?(x.e>0?'+':'')+x.e:''].filter(z=>z!=='');
        return `${x.m?fk(Math.round(x.m/10)/100)+' km':'km '+(i+1)} ${msx(x.m?x.t*1000/x.m:x.t)}${v.length?' ('+v.join(', ')+')':''}`}).join(' · '))}
    const GW=(g.seg||[]).filter(x=>x.k==='w');
    if(g.seg&&g.seg.length&&r.t!=='iv'){if(GW.length)L.push(`  Kurze Gehpausen: ${GW.map(x=>msx(x.t)).join(', ')} (zusammen ${msx(GW.reduce((a,x)=>a+x.t,0))})`)}
    else if(g.seg&&g.seg.length){const {E,M,A}=segParts(g);if(E.length)L.push('  '+segLine('Einlaufen:',E));
      L.push(`  ${E.length||A.length?'Hauptteil ':''}${M.some(x=>x.k==='j')?'Intervalle/Traben (am Tempo erkannt':'Laufen/Gehen (von der Uhr erkannt'}, Zeit/Strecke, Ø-Puls): `+M.map(x=>`${SEGN[x.k]||'Laufen'} ${msx(x.t)}/${x.m} m${x.h?' ('+x.h+(x.d!=null?', Puls '+(x.d>=0?'−':'+')+Math.abs(x.d)+' nach '+Math.min(60,x.t)+' s':'')+')':''}`).join(' · '));
      if(A.length)L.push('  '+segLine('Auslaufen:',A))}
    if(g.lap&&g.lap.length>1&&g.lap.some(l=>l.i===1||l.i===4||l.tr===0))L.push('  Runden: '+g.lap.map((x,i)=>`${i+1}) ${x.m} m in ${msx(x.t)}${x.h?' ('+x.h+')':''}`).join(' · '));
    if(g.dc!=null)L.push(`  Aerobe Entkopplung (Pace:Puls, 2. zu 1. Hälfte, ohne erste 5 min): ${fk(g.dc)} %`);
    if(r.hr&&r.km&&r.dur)L.push(`  Effizienz: ${fk(Math.round(r.km*1000/(r.dur/60)/r.hr*100)/100)} m/min je Herzschlag`);
    const C=g.cv;if(C&&Array.isArray(C.p)&&C.p.length){const st=C.s||60,rows=C.p.map((p,i)=>`${Math.round((i+1)*st/60)}′ ${p?msx(p):'–'}/${(C.h&&C.h[i])||'–'}${C.c?'/'+(C.c[i]||'–'):''}${C.a?'/'+C.a[i]:''}`);
      L.push(`  Verlauf je ${st%60?st+' s':st/60+' min'} (Minute: Pace/Puls${C.c?'/Kadenz':''}${C.a?'/Höhe m':''}):`);for(let i=0;i<rows.length;i+=10)L.push('   '+rows.slice(i,i+10).join(' · '))}}
  return L.join('\n')}
function weekText(ws){const R=weekReview(ws),end=addDays(ws,6),T=TR(),L=[`Sabrly – Woche KW ${kw(ws)} (${pdate(ws).getDate()}.${pdate(ws).getMonth()+1}.–${pdate(end).getDate()}.${pdate(end).getMonth()+1}.${pdate(end).getFullYear()})`,''];
  if(R.per.length){L.push(`Habits: ${R.hp??'–'} % erfüllt${R.hpPrev!=null?' (Vorwoche '+R.hpPrev+' %)':''}`);R.per.forEach(o=>L.push(`- ${o.x.name}: ${fk(o.v)}/${o.T}${o.x.freq==='weekly'?' (Wochenziel)':''}`))}
  if(R.pr!=null)L.push(`Gebete pünktlich: Ø ${R.pr} %`);
  const md=R.days.map(d=>{const m=dayGet(d)?.mood;return m?`${DN[wd(d)]} ${MOODS[m-1]}`:null}).filter(Boolean);if(md.length)L.push(`Stimmung: ${md.join(' · ')} (Ø ${fk(Math.round(R.mood*10)/10)} von 5)`);
  if(R.todos)L.push(`Aufgaben erledigt: ${R.todos}`);
  if(T){const plan=[];for(let i=0;i<7;i++){const P=planDay(ws,i);if(P.length)plan.push(`${DN[i]} ${P.map(itemName).join(' + ')}`)}
    L.push('',`Training${plan.length?' (Plan: '+plan.join(' · ')+')':''}`);let any=false;
    for(let i=0;i<7;i++){const d=addDays(ws,i);for(const s of sessOf(d)){L.push(sessText(d,s));any=true}for(const r of runsOf(d)){L.push(runText(d,r));any=true}for(const x of gaPair(d).free){L.push(gaText(d,x));any=true}}
    if(!any)L.push('Keine Einheiten eingetragen.');else L.push(`Kraft ${R.C.kd}${R.C.kp?'/'+R.C.kp:''} · Läufe ${R.C.ld}${R.C.lp?'/'+R.C.lp:''} · ${fk(R.km)||0} km`)}
  return L.join('\n')}
function copyText(txt){let ok=false;try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(()=>toast('Kopiert – jetzt im Claude-Chat einfügen'),()=>copyFallback(txt));ok=true}}catch(e){}
  if(!ok)copyFallback(txt)}
function copyFallback(txt){sheet(`<h3>Für Claude</h3><span class="hint">Text markieren, kopieren und im Claude-Chat einfügen.</span><textarea class="area" readonly style="min-height:260px;font-size:13px;font-family:ui-monospace,Menlo,monospace">${esc(txt)}</textarea>`);const ta=$('#sheet textarea');if(ta){ta.focus();ta.select()}}
Object.assign(ACT,{
  revhide:el=>{S.settings.revSeen=el.dataset.ws;touch('state',300);render()},
  copyweek:el=>copyText(weekText(el.dataset.ws||weekStart(today()))),
  copysess:el=>{const s=sessOf(el.dataset.d).find(x=>x.id===el.dataset.id);if(s)copyText(sessText(el.dataset.d,s))},
  copyrun:el=>{const r=runsOf(el.dataset.d).find(x=>x.id===el.dataset.id);if(r)copyText(runText(el.dataset.d,r))},
  wsavecopy:()=>{const d=UI.w&&UI.w.d,s=wSave();if(s&&s.id)copyText(sessText(d,s))},
  tsnd:()=>{const T=TR();T.snd=T.snd===false;touch('state',300);if(T.snd){acUnlock();beep(true)}render()},
  twake:()=>{const T=TR();T.wake=T.wake===false;touch('state',300);render()},
  tsndtest:()=>{acUnlock();setTimeout(()=>beep(true),60);tflash()},
  weeknotify:()=>{S.settings.weekNotify=S.settings.weekNotify===false;touch('state',300);render()},
  gahide:el=>gaHide(el.dataset.d,el.dataset.id)});
