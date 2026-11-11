import subprocess,sys
# Baut ../index.html aus der Basis (dev/base/index.base.html) + den Modulen in dev/src/.
# Aufruf: python3 dev/build.py   (von überall)
import os
HERE=os.path.dirname(os.path.abspath(__file__))
D=os.path.join(HERE,'src')+os.sep
ROOT=os.path.dirname(HERE)
s=open(os.path.join(HERE,'base','index.base.html'),encoding='utf-8').read()  # = git show 529b25d:index.html (App vor dem Training-Modul)
def rep(a,b,c=1):
    global s
    n=s.count(a)
    if n!=c: sys.exit(f'COUNT {n}!={c}: {a[:100]}')
    s=s.replace(a,b)
css=open(D+'tr.css').read()+'\n'+open(D+'week.css').read()
js=open(D+'lib.js').read()+'\n'+open(D+'main.js').read()+'\n'+open(D+'week.js').read()

# 1 CSS
rep('/* Tab bar */',css+'\n/* Tab bar */')
# 2 Tabbar dynamisch + Sheet/Pausenleiste
a=s.index('<nav class="tabbar glass" aria-label="Bereiche">');b=s.index('</nav>',a)+len('</nav>')
s=s[:a]+'<nav class="tabbar glass" id="tabbar" aria-label="Bereiche"></nav>'+s[b:]
rep('<div class="toast" id="toast" hidden></div>','<div class="toast" id="toast" hidden></div>\n<div id="restbar"></div>\n<div id="sheet"></div>')
# 3 Zustand
rep("todos:[],quotes:[],plan:{text:'',days:{}},settings:{dayStart:0,v2:true,userName:'',trackerName:'',",
    "todos:[],quotes:[],plan:{text:'',days:{}},training:null,settings:{dayStart:0,v2:true,statTab:false,userName:'',trackerName:'',")
rep("plan:{text:String(s.plan?.text||''),days:(s.plan&&typeof s.plan.days==='object'&&s.plan.days)||{}},settings:{...d.settings,...(s.settings||{})}};",
    "plan:{text:String(s.plan?.text||''),days:(s.plan&&typeof s.plan.days==='object'&&s.plan.days)||{}},training:normTraining(s.training),settings:{...d.settings,...(s.settings||{})}};\n  out.settings.statTab=!!out.settings.statTab;")
# 4 Render
rep("const v=UI.page?PAGES[UI.page.t]:({heute:vHeute,habits:vHabits,aufgaben:vAufgaben,statistik:vStats,mehr:vMehr}[UI.tab]||vHeute);",
    "if(UI.tab==='statistik'&&!S.settings.statTab){UI.tab='habits';UI.hseg='s'}\n  const v=UI.page&&PAGES[UI.page.t]?PAGES[UI.page.t]:({heute:vHeute,habits:vHabits,training:vTraining,aufgaben:vAufgaben,statistik:vStats,mehr:vMehr}[UI.tab]||vHeute);\n  if(UI.page&&!PAGES[UI.page.t])UI.page=null;tabsRender();")
rep("  document.body.classList.toggle('paged',!!UI.page);\n  document.querySelectorAll('.tab')",
    "  document.body.classList.toggle('paged',!!UI.page);restbar();\n  document.querySelectorAll('.tab')")
rep("  document.body.classList.toggle('authmode',MODE==='auth');",
    "  document.body.classList.toggle('authmode',MODE==='auth');sheet('');")
# Tabs
rep("function ring(p,size=56,g=null){",
"""const TABIC={heute:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>',
  habits:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="7" r="3"/><path d="M4.7 7l1 1 1.7-2"/><circle cx="6" cy="17" r="3"/><path d="M12 7h9M12 17h9"/></svg>',
  training:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/></svg>',
  aufgaben:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="3.5"/><path d="M7 9h10M7 12.5h10M7 16h6"/></svg>',
  statistik:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="12" width="5" height="9" rx="1.6"/><rect x="9.5" y="7" width="5" height="14" rx="1.6"/><rect x="16" y="3" width="5" height="18" rx="1.6"/></svg>',
  mehr:'<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/></svg>'};
const TABN={heute:'Heute',habits:'Habits',training:'Training',aufgaben:'Aufgaben',statistik:'Statistik',mehr:'Mehr'};
// 5 Tabs (Statistik steckt in Habits) oder 6 Tabs – umschaltbar unter Mehr → Ansicht
function tabsRender(){const nav=$('#tabbar');if(!nav)return;const six=!!S.settings.statTab,L=six?['heute','habits','training','aufgaben','statistik','mehr']:['heute','habits','training','aufgaben','mehr'],key=L.join();
  if(nav.dataset.k!==key){nav.dataset.k=key;nav.className='tabbar glass'+(six?' six':'');nav.innerHTML=L.map(t=>`<button class="tab" data-a="tab" data-t="${t}" id="tab-${t}">${TABIC[t]}${TABN[t]}</button>`).join('')}}
function ring(p,size=56,g=null){""")
# 5 Heute: Training zwischen Aufgaben und Rückblick
rep("  // Rückblick\n  // Rückblick: Stimmung + ein Satz zum Tag\n","  h+=heuteTraining(sel);\n  // Rückblick: Stimmung + ein Satz zum Tag\n")
# 6 Habits mit Umschalter Statistik
rep("""function vHabits(){const t=today();
  const list=S.habits.filter(x=>!x.archived),arch=S.habits.filter(x=>x.archived);
  let h=`<div class="sec-h" style="margin-top:6px"><h1>Habits</h1><button type="button" class="iconbtn glass" data-a="hnew" aria-label="Neuer Habit">+</button></div>`;""",
"""function vHabits(){const t=today();
  const list=S.habits.filter(x=>!x.archived),arch=S.habits.filter(x=>x.archived),st=!S.settings.statTab&&UI.hseg==='s';
  let h=`<div class="sec-h" style="margin-top:6px"><h1>${st?'Statistik':'Habits'}</h1>${st?'':`<button type="button" class="iconbtn glass" data-a="hnew" aria-label="Neuer Habit">+</button>`}</div>`;
  if(!S.settings.statTab)h+=`<div class="seg" style="margin-top:-14px"><button type="button" class="${st?'':'on'}" data-a="hseg" data-v="h">Habits</button><button type="button" class="${st?'on':''}" data-a="hseg" data-v="s">Statistik</button></div>`;
  if(st)return h+vStats(true);
  if(UI.hsort&&list.length>1)return h+vHabitSort(list);""")
rep("""let h=`<div class="sec-h" style="margin-top:6px"><h1>${st?'Statistik':'Habits'}</h1>${st?'':`<button type="button" class="iconbtn glass" data-a="hnew" aria-label="Neuer Habit">+</button>`}</div>`;""",
    """let h=`<div class="sec-h" style="margin-top:6px"><h1>${st?'Statistik':'Habits'}</h1>${st?'':UI.hsort&&list.length>1?`<button type="button" class="txtbtn pri" data-a="hsort">Fertig</button>`:`<div class="row" style="gap:8px">${list.length>1?`<button type="button" class="iconbtn glass" data-a="hsort" aria-label="Reihenfolge ändern">${SORTIC}</button>`:''}<button type="button" class="iconbtn glass" data-a="hnew" aria-label="Neuer Habit">+</button></div>`}</div>`;""")
rep("""function vStats(){const t=today(),hs=S.habits.filter(x=>!x.archived);
  let h=`<div class="sec-h" style="margin-top:6px"><h1>Statistik</h1></div>`;""",
"""function vStats(noHead){const t=today(),hs=S.habits.filter(x=>!x.archived);
  let h=noHead?'':`<div class="sec-h" style="margin-top:6px"><h1>Statistik</h1></div>`;""")
# 7 Mehr: Ansicht
rep("""  h+=vGebet()+vQuotes()+vSit();""","""  h+=`<section class="sec"><h2>Ansicht</h2><div class="card glass stack" style="gap:10px"><div class="row between"><span>Statistik als eigener Tab</span><button type="button" class="switch${S.settings.statTab?' on':''}" data-a="stattab" role="switch" aria-checked="${!!S.settings.statTab}" aria-label="Statistik als eigener Tab"></button></div><span class="hint">Aus: Statistik steckt oben in Habits, die Leiste hat 5 Tabs. An: 6 Tabs.</span></div></section>`;
  h+=vGebet()+vQuotes()+vSit();""")
# 8 Klicks: Sheet schließen nur beim Tipp daneben, Event weiterreichen
rep("""  const el=e.target.closest('[data-a]');if(!el||el.disabled)return;""","""  const el=e.target.closest('[data-a]');if(!el||el.disabled)return;
  if(el.dataset.a==='shclose'&&e.target!==el)return;""")
rep("""  try{fn(el)}catch(err){""","""  try{fn(el,e)}catch(err){""")
rep("""  if(e.key==='Escape'&&UI.page)back();""","""  if(e.key==='Escape'){if($('#sheet')?.innerHTML){sheet('');return}if(UI.page)back()}""")
# 9 Eingaben
rep("""document.addEventListener('input',e=>{const el=e.target;
  if(el.dataset.af){""","""let wpT=null;const wPersistSoon=()=>{clearTimeout(wpT);wpT=setTimeout(wPersist,400)};
function trInput(el,commit){const P=UI.page;
  if(el.dataset.wn&&UI.w){const x=UI.w.it[+el.dataset.i];if(x)x.nt=String(el.value).slice(0,200);wPersistSoon();return true}
  if(el.dataset.ws&&UI.w){const x=UI.w.it[+el.dataset.i],q=x&&x.sets[+el.dataset.j];if(q){const v=String(el.value).trim();q[el.dataset.ws]=v===''?null:el.dataset.ws==='k'?pnum(v):clampI(v,0,9999,null)}wPersistSoon();return true}
  if(el.dataset.tw){const v=twVal(el.value);if(v==null)return true;const b=el.parentElement.querySelector('b');if(b)b.textContent=msx(v);const k=el.dataset.tw;
    if(k==='rest'&&UI.w){const x=UI.w.it[+el.dataset.i];if(x){x.rest=v;wPersistSoon();if(commit){const bl=blockOf(UI.w.day,x.b);if(bl&&bl.rest!==v){bl.rest=v;touch('state')}}}}
    else if(k==='bv'&&P&&P.b)P.b.v=Math.max(10,v);else if(k==='brest'&&P&&P.b)P.b.rest=v;return true}
  if(el.dataset.bk&&P&&P.b){const k=el.dataset.bk,v=el.value,b=P.b;if(k==='n'){b.n=clampI(v,1,60,10);if(commit)render()}else if(k==='note')b.note=v;else if(k==='k'){const n=pnum(v);b.p.forEach(x=>x.k=n)}else b[k]=clampI(v,1,999,b[k]);return true}
  if(el.dataset.bp&&P&&P.b&&P.b.p){const x=P.b.p[+el.dataset.j];if(x){const v=String(el.value).trim();x[el.dataset.bp]=el.dataset.bp==='k'?(v===''?null:pnum(v)):clampI(v,0,999,x.r)}return true}
  if(el.dataset.bi&&P&&P.b){const x=P.b.it[+el.dataset.i];if(x)x[el.dataset.bi]=el.dataset.bi==='k'?(pnum(el.value)||0):clampI(el.value,1,200,6);return true}
  if(el.dataset.rf&&P&&P.t==='run'){const R=P.r,k=el.dataset.rf;R[k]=el.value;if(commit&&k==='dur'){R.dur=fmtClock(el.value);el.value=R.dur}
    const sec=clockSec(fmtClock(R.dur)),km=pnum(R.km),pe=$('#rn-pace');if(pe)pe.textContent=sec&&km?hmsx(sec/km):'–';
    const ok=$('#rn-hrok'),hr=+R.hr||0,T=TR();if(ok){ok.textContent=hr?(hr<T.hr?'Puls unter '+T.hr+' ✓':'Puls über '+T.hr):'Puls unter '+T.hr+'?';ok.style.color=hr?(hr<T.hr?'var(--accent)':'var(--amber)'):'var(--muted)'}return true}
  if(el.dataset.iv&&P&&P.t==='run'){const I=P.r.iv,i=+el.dataset.iv,x=I.r[i];if(!x)return true;x[el.dataset.f]=el.value;if(commit&&el.dataset.f==='v'){x.v=fmtClock(el.value);el.value=x.v}
    const sm=document.getElementById('ivp-'+i);if(sm&&el.dataset.f==='v'){const ps=ivPace(I,fmtClock(x.v));sm.textContent=ps?'= '+msx(ps)+' /km':''}return true}
  if(el.dataset.io&&P&&P.t==='run'){const I=P.r.iv,k=el.dataset.io;if(k==='pz')I.pz=el.value;else{I[k]=clampI(el.value,1,k==='n'?30:50000,I[k]);if(commit&&k==='n'){I.r=Array.from({length:I.n},(_,i)=>I.r[i]||{v:'',h:''});render()}else if(commit)render()}return true}
  if(el.dataset.cx&&P&&P.x){P.x[el.dataset.cx]=el.dataset.cx==='i'?(pnum(el.value)||2.5):el.value;return true}
  if(el.dataset.dy&&P&&P.t==='dayed'){const D=TDAY(P.id);if(D){D[el.dataset.dy]=el.value.slice(0,el.dataset.dy==='name'?24:30);touch('state',900);if(commit&&el.dataset.dy==='name'&&!D.name.trim()){D.name='Training';el.value=D.name}}return true}
  if(el.dataset.ts&&TR()){TR()[el.dataset.ts]=el.value;touch('state',200);if(commit)render();return true}
  if(el.dataset.pk&&P&&P.t==='pick'){P.q=el.value;const l=$('#pk-list');if(l){const q=pnorm(P.q),mu=P.mu||'',T=TR(),all=[...Object.entries(T.ex).map(([id,D])=>({id,D})),...Object.entries(LIB).map(([id,D])=>({id,D}))];
    l.innerHTML=pickList(all.filter(({D})=>(!mu||(D.m&&D.m[mu]>=1))&&(!q||pnorm(D.n).includes(q))).sort((a,b)=>(!!b.D.own-!!a.D.own)||a.D.n.localeCompare(b.D.n,'de')))}return true}
  return false}
document.addEventListener('click',e=>{const t=e.target;if(t&&t.classList&&t.classList.contains('tw-in')&&t.showPicker){try{t.showPicker()}catch(err){}}},true);
document.addEventListener('input',e=>{const el=e.target;
  if(trInput(el,false))return;
  if(el.dataset.af){""")
rep("""document.addEventListener('change',e=>{const el=e.target;
  if(el.dataset.set){""","""document.addEventListener('change',e=>{const el=e.target;
  if(trInput(el,true))return;
  if(el.dataset.set){""")
# Habits-Tab öffnet immer die Liste
rep("  tab:el=>{const changed=UI.tab!==el.dataset.t||!!UI.page;","  tab:el=>{const changed=UI.tab!==el.dataset.t||!!UI.page;if(el.dataset.t==='habits'&&UI.tab!=='habits')UI.hseg='h';")
# 10 Links aus dem Widget
rep("""  UI.page=null;UI.stack=[];UI.sel=null;UI.tab=k==='aufgaben'?'aufgaben':k==='statistik'?'statistik':'heute';""",
    """  UI.page=null;UI.stack=[];UI.sel=null;UI.tab=k==='aufgaben'?'aufgaben':k==='training'?'training':k==='statistik'?(S.settings.statTab?'statistik':'habits'):'heute';if(k==='statistik')UI.hseg='s';""")
rep("""S.habits.some(h=>!['h-beten','h-lesen'].includes(h.id)))}""","""S.habits.some(h=>!['h-beten','h-lesen'].includes(h.id))||!!S.training)}""")
# Seiten federn beim Ziehen immer nach (auch wenn sie nicht lang genug zum Scrollen sind)
rep("  padding-block:0 calc(118px + env(safe-area-inset-bottom,0px));overflow-x:hidden}",
    "  padding-block:0 calc(118px + env(safe-area-inset-bottom,0px));overflow-x:hidden;\n  min-height:calc(100vh + 1px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));min-height:calc(100dvh + 1px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px))}")
# Bewegung reduzieren: weich einblenden statt hart umschalten (wie iOS selbst)
rep("@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}",
    "@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}\n  .wrap.enter,.wrap.push,.tovl,.toast,.trest{animation:rmfade .2s ease-out!important}}\n@keyframes rmfade{from{opacity:0}to{opacity:1}}")
rep("function slideIn(dir,week){const v=$('#view');if(!v||!v.animate)return;",
    "const RM=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}};\nfunction slideIn(dir,week){const v=$('#view');if(!v||!v.animate)return;\n  if(RM()){[...v.children].forEach(c=>c.animate([{opacity:.35},{opacity:1}],{duration:200,easing:'ease-out'}));return}")
rep("  if(st&&st.animate){const from=st.style.transform","  if(st&&st.animate&&!RM()){const from=st.style.transform")
# Mehr → Ansicht einklappbar
rep('''h+=`<section class="sec"><h2>Ansicht</h2><div class="card glass stack" style="gap:10px">''','''h+=`<section class="sec"><div class="sec-h">${foldBtn('a','Ansicht')}</div>${FOLD.a?`<div class="card glass stack" style="gap:10px">''')
rep('''<span class="hint">Aus: Statistik steckt oben in Habits, die Leiste hat 5 Tabs. An: 6 Tabs.</span></div></section>`;''','''<span class="hint">Aus: Statistik steckt oben in Habits, die Leiste hat 5 Tabs. An: 6 Tabs.</span></div>`:''}</section>`;''')
# Haptik-Schalter nur auf kleinen Elementen: auf Zeilen, Karten, Rastern und breiten Knöpfen hält iOS sonst
# die Wischbewegung für den Schalter fest und die Seite scrollt nicht
rep("const HAPTIC=new Set(['asubmit','qadd','qsug','qdel','sitoggle','mood','taskdone','ptick','tog','inc','dec','lab','hstep','quick','calday','hsave','tsave','tdone','nadd','ndel','hdelq','tdelq','harchq','undo','planapply','tpl','emo','hday','tprio','pfilter']);",
    "const HAPTIC=new Set(['asubmit','qdel','sitoggle','mood','taskdone','ptick','tog','inc','dec','lab','hstep','quick','hsave','tsave','tdone','nadd','ndel','hdelq','tdelq','harchq','undo']);")
rep("    if(getComputedStyle(el).position==='static')el.classList.add('hsw-host');",
    "    const r=el.getBoundingClientRect();if(!r.width||r.width>120||r.height>64)return;\n    if(getComputedStyle(el).position==='static')el.classList.add('hsw-host');")
rep(".hsw{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;opacity:0;z-index:6;cursor:pointer;-webkit-tap-highlight-color:transparent}",
    ".hsw{position:absolute;inset:0;width:100%;height:100%;margin:0;padding:0;opacity:0;z-index:6;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:pan-y}")
# Wochenrückblick auf Heute (Sonntag diese Woche, Montag die vergangene)
rep("  if(sel===t)h+=situationBox(t);","  if(sel===t)h+=situationBox(t);\n  if(sel===t)h+=weekCardHeute(t);")
# Mehr → Ansicht: Sonntags-Erinnerung
rep("""<span class="hint">Aus: Statistik steckt oben in Habits, die Leiste hat 5 Tabs. An: 6 Tabs.</span></div>`:''}</section>`;""",
    """<span class="hint">Aus: Statistik steckt oben in Habits, die Leiste hat 5 Tabs. An: 6 Tabs.</span><div class="row between"><div style="min-width:0"><span>Sonntags-Erinnerung „Woche planen“</span><div class="hint">Sonntag 18 Uhr mit kurzem Wochenrückblick. Kommt über das Sabrly-Widget (Scriptable).</div></div><button type="button" class="switch${S.settings.weekNotify!==false?' on':''}" data-a="weeknotify" role="switch" aria-checked="${S.settings.weekNotify!==false}" aria-label="Sonntags-Erinnerung"></button></div></div>`:''}</section>`;""")
# Garmin-Status (vom Widget geschrieben, die App liest ihn nur)
rep("function applyDoc(k,raw){const data=clone(raw);if(!data)return false;",
    "function applyDoc(k,raw){const data=clone(raw);if(!data)return false;\n  if(k==='garmin'){if(JSON.stringify(data)===JSON.stringify(GST))return false;GST=data;return true}")
rep("          else if(k.startsWith('m-')){const local=LOGS[k],merged={days:{...((data&&data.days)||{})}};",
    "          else if(k==='garmin')GST=data;\n          else if(k.startsWith('m-')){const local=LOGS[k],merged={days:{...((data&&data.days)||{})}};")
rep("function stopCloud(){if(unsub){try{unsub()}catch(e){}}unsub=null;cloudReady=false;clearTimeout(flushT)}",
    "function stopCloud(){if(unsub){try{unsub()}catch(e){}}unsub=null;cloudReady=false;clearTimeout(flushT);GST=null}")
# 11 Modul
rep("/* ---------- Wochenleiste: sauberes Wechseln von Woche und Tag ---------- */",js+"\n/* ---------- Wochenleiste: sauberes Wechseln von Woche und Tag ---------- */")
open(os.path.join(ROOT,'index.html'),'w',encoding='utf-8').write(s)
print('spliced',len(s))
