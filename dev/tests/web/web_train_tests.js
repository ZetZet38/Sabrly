(async function(){
const R=[];const ok=(n,c,i='')=>R.push((c?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const click=s=>{const el=typeof s==='string'?q(s):s;if(!el)throw new Error('missing '+s);el.click()};
const typeIn=(s,v)=>{const el=typeof s==='string'?q(s):s;if(!el)throw new Error('missing '+s);el.focus();el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));el.blur()};
const cloud=k=>__store.get('users/u1/data/'+k);
const step=async(name,fn)=>{try{await fn()}catch(e){R.push('FAIL '+name+' :: EXCEPTION '+e.message+' '+(e.stack||'').split('\n')[1])}};
await wait(400);
const t=today(),mk=mkey(t),ti=wd(t),ws=weekStart(t);
// Habit „Training“ zum automatischen Abhaken
S.habits.push(normHabit({id:'h-train',name:'Training',emoji:'🏋️',freq:'weekly',target:3,created:addDays(t,-30)}));touch('state');render();

await step('habit sort',async()=>{
  click('#tab-habits');const before=S.habits.filter(x=>!x.archived).map(x=>x.id);ok('sort button',!!q('[data-a="hsort"]'));
  click('[data-a="hsort"]');ok('sort mode rows',qa('.hsrow').length===before.length&&!!q('[data-a="hsort"]').textContent.includes('Fertig'));
  const g=q('.hsrow .hgrip'),r=g.getBoundingClientRect(),step=qa('.hsrow')[1].getBoundingClientRect().top-qa('.hsrow')[0].getBoundingClientRect().top;
  const pe=(t,y,el)=>(el||document).dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,pointerId:7,clientX:r.left+10,clientY:y,pointerType:'touch'}));
  pe('pointerdown',r.top+10,g);pe('pointermove',r.top+10+step*0.6);pe('pointermove',r.top+10+step*(before.length-1)+4);
  ok('neighbours shift while dragging',qa('.hsrow')[1].style.transform.includes('translateY(-'));pe('pointerup',r.top+10+step*(before.length-1)+4);
  const after=S.habits.filter(x=>!x.archived).map(x=>x.id);ok('first moved to last',after.join()===[...before.slice(1),before[0]].join(),after.join());
  await wait(800);ok('order in cloud',cloud('state').habits.filter(x=>!x.archived).map(x=>x.id).join()===after.join());
  click('[data-a="hsort"]');ok('done leaves sort mode',!q('.hsrow')&&!!q('.hcard'));
  click('#tab-heute');ok('Heute follows order',qa('#view .hrow .hname').map(x=>x.firstChild.textContent).join('|')===after.map(id=>H(id).name).join('|'),qa('#view .hrow .hname').map(x=>x.firstChild.textContent).join('|'));
});
await step('tabs',async()=>{
  ok('5 tabs with training in the middle',qa('#tabbar .tab').map(b=>b.dataset.t).join()==='heute,habits,training,aufgaben,mehr',qa('#tabbar .tab').map(b=>b.dataset.t).join());
  click('#tab-training');ok('setup shown',qa('[data-a="tsetup"]').length===5&&!S.training);
});
await step('setup ppc',async()=>{
  click('[data-a="tsetup"][data-v="ppc"]');await wait(700);
  ok('3 days',S.training&&S.training.days.map(d=>d.name).join()==='Push,Pull,Tag C');
  ok('cloud has training',cloud('state')?.training?.days?.length===3);
  ok('push first block dips 27.5',S.training.days[0].blocks[0].e==='dips'&&S.training.days[0].blocks[0].p[0].k===27.5);
  ok('tag C has emom',S.training.days[2].blocks[0].k==='emom'&&S.training.days[2].blocks[0].it.length===2);
  ok('unplanned card',!!qa('#view b').find(b=>/noch nicht geplant/.test(b.textContent)));
});
const P=()=>S.training.days[0],PU=()=>S.training.days[1],C=()=>S.training.days[2];
await step('plan week',async()=>{
  click('[data-a="tplan"]');ok('plan page',UI.page?.t==='plan'&&UI.page.ws===ws);
  click(`[data-a="padd"][data-i="${ti}"]`);ok('sheet opened',!!q('#sheet .tsheet'));
  click(`#sheet [data-a="paddk"][data-k="${P().id}"]`);await wait(50);
  ok('push planned today',planDay(ws,ti)[0]===P().id&&!q('#sheet .tsheet'));
  click(`[data-a="padd"][data-i="${ti}"]`);click(`#sheet [data-a="paddk"][data-k="@L"]`);
  const j=(ti+2)%7;click(`[data-a="padd"][data-i="${j}"]`);click(`#sheet [data-a="paddk"][data-k="${C().id}"]`);
  click(`[data-a="pshift"][data-i="${ti}"]`);click(`[data-a="pshift"][data-i="${ti}"]`);
  ok('shift spät',wkOf(ws).s[ti]==='S');
  ok('two hard warning absent (push+lauf ok)',!q('.twarn')||![...qa('.twarn')].some(w=>/Zwei harte/.test(w.textContent)));
  click(`[data-a="padd"][data-i="${ti}"]`);click(`#sheet [data-a="paddk"][data-k="${PU().id}"]`);
  ok('two hard warning',qa('.twarn').some(w=>/Zwei harte/.test(w.textContent)));
  click(`[data-a="pdel"][data-i="${ti}"][data-j="2"]`);ok('removed pull',planDay(ws,ti).join()===P().id+',@L',planDay(ws,ti).join());
  await wait(900);ok('weeks in cloud (no nested arrays)',JSON.stringify(cloud('state')?.training?.weeks?.[ws]?.d?.[ti])===JSON.stringify([P().id,'@L']),JSON.stringify(cloud('state')?.training?.weeks));
  click('[data-a="pws"]:not(.on)');ok('next week tab',UI.page.ws===addDays(ws,7));
  click('[data-a="tplancopy"]');ok('copied to next week',planDay(addDays(ws,7),ti).join()===P().id+',@L');
  click('[data-a="back"]');
});
await step('training view',async()=>{
  ok('week strip 7 days',qa('.twd').length===7);
  ok('today tags',qa('.twd.t .ttag').map(x=>x.textContent).join()==='Push,Lauf',qa('.twd.t .ttag').map(x=>x.textContent).join());
  ok('hero push + run',qa('.thero h3').map(h=>h.textContent).join('|').startsWith('Push|Lauf locker'),qa('.thero h3').map(h=>h.textContent).join('|'));
  ok('muscle bars incl. Bizeps/Trizeps',qa('.mbar span').map(x=>x.textContent).join()==='Brust,Rücken,Schultern,Bizeps,Trizeps,Beine,Core');
  ok('planned tags tinted',getComputedStyle(q('.twd.t .ttag')).backgroundColor!=='rgba(0, 0, 0, 0)'&&getComputedStyle(q('.twd.t .ttag')).boxShadow==='none');
  q('.thero.tap h3').click();ok('tap card opens day editor',UI.page&&UI.page.t==='dayed'&&UI.page.id===P().id);click('[data-a="back"]');
  ok('grid buttons',qa('.tgrid .btn').length===4);
});
await step('heute section',async()=>{
  click('#tab-heute');const secs=qa('#view > .sec').map(x=>x.querySelector('h2')?.textContent);
  ok('Training between Aufgaben and Rückblick',secs.indexOf('Training')===secs.indexOf('Aufgaben')+1&&secs.indexOf('Rückblick')===secs.indexOf('Training')+1,secs.join(','));
  ok('two rows',qa('.tday').length===2);ok('start button',!!q('.tday [data-a="wstart"]'));
});
let x0;
await step('workout push',async()=>{
  click('.tday [data-a="wstart"]');ok('work page',UI.page?.t==='work'&&UI.w&&UI.w.day===P().id);
  ok('6 cards',qa('.texc').length===6);
  ok('prefilled from plan',q('[data-ws="k"][data-i="0"][data-j="0"]').value==='27,5'&&q('[data-ws="r"][data-i="0"][data-j="0"]').value==='8');
  ok('note shown',q('.tnote').textContent.includes('Satz 1 Stopp bei 8'));
  ok('no last yet',q('.tlast').textContent.includes('Startwerte'));
  click('[data-a="wset"][data-i="0"][data-j="0"]');await wait(50);
  ok('set done',UI.w.it[0].sets[0].done&&q('.tsrow.done'));
  ok('rest bar 2:00',q('#restbar .rt')?.textContent==='2:00',q('#restbar .rt')?.textContent);
  click('#restbar [data-a="restm"]');ok('rest -10',q('#restbar .rt').textContent==='1:50');
  click('#restbar [data-a="restp"]');click('#restbar [data-a="restp"]');ok('rest +20',q('#restbar .rt').textContent==='2:10');
  click('#restbar [data-a="restskip"]');ok('rest skipped',!q('#restbar .trest'));
  const tw=q('.tw-in[data-tw="rest"][data-i="0"]');ok('time wheel input',tw&&tw.type==='time'&&tw.value==='02:00');
  typeIn(tw,'01:30');await wait(50);ok('rest 1:30 item+template',UI.w.it[0].rest===90&&P().blocks[0].rest===90);
  typeIn('[data-ws="k"][data-i="0"][data-j="1"]','30');ok('kg typed',UI.w.it[0].sets[1].k===30);
  typeIn('[data-ws="r"][data-i="0"][data-j="1"]','9');ok('reps typed',UI.w.it[0].sets[1].r===9);
  click('[data-a="wset"][data-i="0"][data-j="1"]');ok('rest 1:30 now',q('#restbar .rt')?.textContent==='1:30',q('#restbar .rt')?.textContent);
  click('[data-a="waddset"][data-i="0"]');ok('4 sets',UI.w.it[0].sets.length===4);click('[data-a="wdelset"][data-i="0"]');ok('3 sets',UI.w.it[0].sets.length===3);
  ok('persisted locally',!!localStorage.getItem(lsKey()+':wo'));
});
await step('info + swap',async()=>{
  click('[data-a="exinfo"][data-e="dips"]');ok('info sheet',q('#sheet h3')?.textContent==='Dips'&&qa('#sheet li').length===3&&!!q('#sheet a.btn[href*="youtube"]'));
  q('#sheet h3').click();ok('inner tap keeps sheet',!!q('#sheet .tsheet'));
  q('#sheet .tovl').click();ok('overlay tap closes',!q('#sheet .tsheet'));
  click('[data-a="wswap"][data-i="2"]');ok('swap sheet alts',qa('#sheet [data-a="swapto"]').length===3);
  click('#sheet [data-a="swapto"][data-e="khbank"]');ok('swapped today',UI.w.it[2].e==='khbank'&&UI.w.it[2].sw&&P().blocks[2].e==='brustpresse');
  ok('card shows swap',qa('.texc')[2].textContent.includes('Kurzhantel-Bankdrücken')&&qa('.texc')[2].textContent.includes('heute getauscht'));
  click('[data-a="wswap"][data-i="2"]');click('#sheet [data-a="swapto"][data-e="brustpresse"]');ok('swapped back',UI.w.it[2].e==='brustpresse'&&!UI.w.it[2].sw);
  click('[data-a="wswap"][data-i="5"]');click('#swperm');click('#sheet [data-a="swapto"][data-e="trizeps"]');ok('perm swap changes plan',P().blocks[5].e==='trizeps'&&!UI.w.it[5].sw);
  click('[data-a="wswap"][data-i="5"]');click('#sheet [data-a="swapsearch"]');ok('picker in swap mode',UI.page.t==='pick'&&UI.page.m==='swap');
  typeIn('#pk-q','katana e');ok('search filters',qa('#pk-list .tlrow').length>=1&&qa('#pk-list .tlrow b').every(b=>/katana/i.test(b.textContent)));
  click('#pk-list [data-a="pkset"][data-e="katana"]');ok('back on work, swapped',UI.page.t==='work'&&UI.w.it[5].e==='katana');
  click('.texc [data-a="exd"]');ok('exercise detail from work',UI.page.t==='exd');click('[data-a="back"]');ok('back to work',UI.page.t==='work'&&UI.w.it[0].sets[0].done);
});
await step('finish + save',async()=>{
  for(let k=0;k<60;k++){const b=qa('[data-a="wset"]').find(b=>!b.closest('.tsrow').classList.contains('done'));if(!b)break;b.click();await wait(2)}
  click('.ptopbar [data-a="wfinish"]');ok('done page',UI.page.t==='wdone'&&qa('.kpi').length===3);
  ok('suggestions',qa('.tsg div').length===6);ok('habit hint',q('#view').textContent.includes('„Training“ wird beim Speichern abgehakt'));
  click('[data-a="wfeel"][data-v="1"]');ok('feel okay',UI.w.feel===1);
  click('.ptopbar [data-a="wsave"]');await wait(800);
  const ss=sessOf(t);ok('session saved',ss.length===1&&ss[0].day===P().id&&ss[0].x.length===6&&ss[0].feel===1);
  ok('sets objects',ss[0].x[0].s.length===3&&ss[0].x[0].s[1].k===30&&ss[0].x[0].s[1].r===9,JSON.stringify(ss[0].x[0].s));
  ok('cloud month has tr',cloud(mk)?.days?.[t]?.tr?.length===1);
  ok('habit ticked',isDone(H('h-train'),t)||hv(H('h-train'),t)>=1);
  ok('workout cleared',!UI.w&&!localStorage.getItem(lsKey()+':wo')&&!UI.page);
});
await step('history + edit',async()=>{
  click('#tab-training');ok('hero done',qa('.thero .btn').some(b=>/Erledigt/.test(b.textContent)));
  ok('strip tag done = same tint + check',!!q('.twd.t .ttag.ok')&&q('.twd.t .ttag.ok').textContent.startsWith('✓ ')&&getComputedStyle(q('.twd.t .ttag.ok')).backgroundColor===getComputedStyle(qa('.twd.t .ttag')[0]).backgroundColor);
  ok('last trainings',qa('.swipe .tt[data-a="wview"]').length===1);
  ok('swipe still has edit',!!q('.swipe-actions [data-a="wedit"]'));
  click('.swipe .tt[data-a="wview"]');ok('tap opens summary',UI.page.t==='wsum'&&qa('.kpi').length===3&&!!q('.ptopbar [data-a="wedit"]')&&q('#view').textContent.includes('Übungen')&&q('#view').textContent.includes('Dips'),q('#view').textContent.slice(0,200));
  click('.ptopbar [data-a="wedit"]');ok('edit page',UI.page.t==='work'&&UI.w.edit===sessOf(t)[0].id&&qa('.tsrow.done').length===sessOf(t)[0].x.reduce((n,x)=>n+x.s.length,0));
  ok('no rest wheel in edit',!q('.tw-in[data-tw="rest"]'));
  typeIn('[data-ws="r"][data-i="0"][data-j="0"]','9');click('.ptopbar [data-a="wsave"]');await wait(300);
  ok('edited',sessOf(t).length===1&&sessOf(t)[0].x[0].s[0].r===9);ok('save returns to summary',UI.page.t==='wsum');click('.ptopbar [data-a="back"]');
  const id=sessOf(t)[0].id;q(`.swipe-actions [data-a="wdel"]`).click();await wait(50);ok('deleted',sessOf(t).length===0);
  click('[data-a="undo"]');ok('undo',sessOf(t).length===1&&sessOf(t)[0].id===id);
  click('.thero [data-a="wview"]');ok('hero opens summary',UI.page.t==='wsum');click('.ptopbar [data-a="wedit"]');click('.ptopbar [data-a="wcancel"]');ok('cancel edit returns to summary',!UI.w&&UI.page.t==='wsum');
  click('.ptopbar [data-a="back"]');ok('back to training',!UI.page);
});
await step('second workout uses history',async()=>{
  ACT.wstart({dataset:{day:P().id,d:t}});
  ok('last shown',qa('.tlast')[0].textContent.includes('Letztes Mal')&&qa('.tlast')[0].textContent.includes('27,5 · 30 · 22,5 kg'),qa('.tlast')[0].textContent);
  ok('prefill from last',q('[data-ws="k"][data-i="0"][data-j="1"]').value==='30');
  ok('suggestion',/→/.test(q('.tsug').textContent));
  click('.ptopbar [data-a="wcancel"]');ok('cancel without sets',!UI.w);
});
await step('rir per set',async()=>{
  // Progression mit RIR (reine Logik): dips = bw, 2,5-kg-Schritte bei Maschinen
  const S3=(r,q)=>[0,1,2].map(i=>({k:20,r,...(q&&q[i]!=null?{q:q[i]}:{})}));
  ok('suggest without rir unchanged',suggest(8,12,'brustpresse',S3(12))==='25 kg · wieder ab 8',suggest(8,12,'brustpresse',S3(12)));ok('big step doubles',suggest(8,12,'brustpresse',S3(12,[4,4,4]))==='30 kg (viel Luft) · wieder ab 8',suggest(8,12,'brustpresse',S3(12,[4,4,4])));
  ok('rir 0 at top → hold',/halten/.test(suggest(8,12,'brustpresse',S3(12,[2,1,0])))&&/RIR 0/.test(suggest(8,12,'brustpresse',S3(12,[2,1,0]))),suggest(8,12,'brustpresse',S3(12,[2,1,0])));
  ok('lots of air → bigger step',suggest(8,12,'brustpresse',S3(12,[4,4,4]))!==suggest(8,12,'brustpresse',S3(12,[2,2,2]))&&/viel Luft/.test(suggest(8,12,'brustpresse',S3(12,[4,4,4]))),suggest(8,12,'brustpresse',S3(12,[4,4,4])));
  ok('mid rir normal step',suggest(8,12,'brustpresse',S3(12,[2,2,2]))===suggest(8,12,'brustpresse',S3(12)));
  ok('reps not at top + air → +2',/\+2 Wdh/.test(suggest(8,12,'brustpresse',S3(10,[3,3,4]))),suggest(8,12,'brustpresse',S3(10,[3,3,4])));
  ok('reps not at top + rir 0 → hold reps',/halten/.test(suggest(8,12,'brustpresse',S3(10,[1,1,0]))),suggest(8,12,'brustpresse',S3(10,[1,1,0])));
  ok('reps not at top normal +1',/\+1 Wdh/.test(suggest(8,12,'brustpresse',S3(10,[2,2,2]))));
  ok('hard feel still holds',/hart/.test(suggest(8,12,'brustpresse',S3(12,[4,4,4]),2)));
  // Training: RIR-Reihe erscheint erst nach dem Abhaken
  const d0=t;ACT.wstart({dataset:{day:PU().id,d:d0}});
  ok('no rir row before done',!q('.trir'));
  click('[data-a="wset"][data-i="0"][data-j="0"]');
  ok('rir row after done',qa('.trir').length===1&&qa('.trir button').length===5&&qa('.trir button')[4].textContent==='4+');
  ok('no preselect without history',UI.w.it[0].sets[0].q==null&&!q('.trir button.on'));
  click('.trir [data-a="wrir"][data-v="2"]');ok('rir 2 set',UI.w.it[0].sets[0].q===2&&q('.trir button.on').textContent==='2'&&q('.trir button.on').getAttribute('aria-pressed')==='true');
  click('[data-a="wset"][data-i="0"][data-j="1"]');ok('next set preselected with last value',UI.w.it[0].sets[1].q===2);
  click(qa('.trir [data-a="wrir"][data-v="1"]')[1]);ok('rir changed on set 2',UI.w.it[0].sets[1].q===1&&UI.w.it[0].sets[0].q===2);
  click(qa('.trir [data-a="wrir"][data-v="1"]')[1]);ok('tap again clears',UI.w.it[0].sets[1].q==null);
  click(qa('.trir [data-a="wrir"][data-v="4"]')[1]);ok('4+ stored as 4',UI.w.it[0].sets[1].q===4);
  click('[data-a="wset"][data-i="0"][data-j="1"]');ok('undone clears rir',UI.w.it[0].sets[1].q===undefined&&qa('.trir').length===1);
  ok('rir persisted locally',JSON.parse(localStorage.getItem(lsKey()+':wo')).it[0].sets[0].q===2);
  click('[data-a="wset"][data-i="0"][data-j="1"]');click('[data-a="wset"][data-i="0"][data-j="2"]');
  ok('third preselected from set 2',UI.w.it[0].sets[2].q===2);
  // Gefühl aus RIR vorschlagen: alle RIR 0 → hart
  for(const x of UI.w.it)for(const st of x.sets)if(st.done)st.q=0;
  click('.ptopbar [data-a="wfinish"]');ok('feel suggested hard',UI.w.feel===2&&UI.w.feelAuto&&q('#view').textContent.includes('Vorschlag aus deiner Reserve'));
  ok('hard button on',q('[data-a="wfeel"][data-v="2"]').classList.contains('on'));
  ok('next-time suggestion holds',/halten/.test(qa('.tsg div b')[0].textContent),qa('.tsg div b')[0].textContent);
  click('[data-a="wfeel"][data-v="0"]');ok('manual feel overrides',UI.w.feel===0&&!UI.w.feelAuto);
  click('.ptopbar [data-a="back"]');for(const st of UI.w.it[0].sets)st.q=4;click('.ptopbar [data-a="wfinish"]');
  ok('manual feel kept on re-finish',UI.w.feel===0);
  click('[data-a="wfeel"][data-v="0"]');ok('feel cleared',UI.w.feel===null);click('.ptopbar [data-a="back"]');click('.ptopbar [data-a="wfinish"]');
  ok('avg rir 4 → easy suggested',UI.w.feel===0&&UI.w.feelAuto);
  click('.ptopbar [data-a="wsave"]');await wait(600);
  const sv=sessOf(d0).find(x=>x.day===PU().id);
  ok('saved with q',sv&&sv.x[0].s.every(z=>z.q===4)&&sv.feel===0&&!('feelAuto' in sv),JSON.stringify(sv&&sv.x[0].s));
  ok('sets without rir have no q key',sv.x.slice(1).every(o=>o.s.every(z=>!('q' in z))));
  ok('no undefined in cloud',!JSON.stringify(cloud(mk)).includes('undefined'));
  ok('claude text has RIR',/RIR 4\+/.test(sessText(d0,sv)),sessText(d0,sv));
  // nächstes Mal: Letzter Wert vorbelegt, Bearbeiten zeigt RIR
  ACT.wstart({dataset:{day:PU().id,d:d0}});click('[data-a="wset"][data-i="0"][data-j="0"]');
  ok('preselect from last session',UI.w.it[0].sets[0].q===4&&q('.trir button.on').textContent==='4+');
  click('.ptopbar [data-a="wcancel"]');click('.ptopbar [data-a="wcancel"]');
  ACT.wedit({dataset:{d:d0,id:sv.id}});ok('edit shows rir rows',qa('.trir').length===sv.x[0].s.length&&UI.w.it[0].sets[0].q===4);
  click(qa('.trir [data-a="wrir"][data-v="0"]')[0]);click('.ptopbar [data-a="wsave"]');await wait(400);
  ok('edit changes rir',sessOf(d0).find(x=>x.id===sv.id).x[0].s[0].q===0);
  // Aufräumen: Test-Einheit entfernen
  const e0=dayEnsure(d0);e0.tr=e0.tr.filter(z=>z.id!==sv.id);touch(mkey(d0));UI.page=null;UI.stack=[];render();
});
await step('times + summary',async()=>{
  const base=Date.now();let off=0;window.__now=()=>base+off*1000;
  ACT.wstart({dataset:{day:PU().id,d:t}});ok('live workout is not late',UI.w.lt===0&&UI.w.it[0].sets.length>=3&&UI.w.it[1].k==='ex');
  const done=(i,j,sec)=>{off=sec;click(`[data-a="wset"][data-i="${i}"][data-j="${j}"]`)};
  done(0,0,240);done(0,1,330);done(0,2,470);done(1,0,560);
  ok('t = seconds since start',UI.w.it[0].sets.slice(0,3).map(s=>s.t).join()==='240,330,470'&&UI.w.it[1].sets[0].t===560,JSON.stringify(UI.w.it.slice(0,2).map(x=>x.sets.map(s=>s.t))));
  click('[data-a="wset"][data-i="0"][data-j="2"]');ok('undo removes t',!('t' in UI.w.it[0].sets[2]));done(0,2,500);
  const T=wTimes(UI.w);
  ok('lead',T.lead===240);ok('rest avg',T.rest===130,T.rest);ok('change avg',T.wech===60,T.wech);ok('exercise time',T.by.get(0).dur===260&&T.by.get(0).rest===130&&T.by.get(1).n===1,JSON.stringify([...T.by]));
  ok('plan rest known',T.by.get(0).plan>0);
  off=620;click('.ptopbar [data-a="wfinish"]');ok('done page shows times',q('#view').textContent.includes('Bis zum ersten Satz')&&q('#view').textContent.includes('4:00')&&q('#view').textContent.includes('Pause zwischen Sätzen Ø')&&q('#view').textContent.includes('2:10'),q('#view').textContent.slice(0,500));
  click('.ptopbar [data-a="wsave"]');await wait(600);
  const sv=sessOf(t).slice(-1)[0];
  ok('t saved in sets',sv.x[0].s.map(z=>z.t).join()==='240,330,500'&&sv.x[1].s[0].t===560&&!('lt' in sv),JSON.stringify(sv.x[0].s));
  ok('no undefined in cloud',!JSON.stringify(cloud(mk)).includes('undefined'));
  const tx=sessText(t,sv);ok('claude text has times',tx.includes('Zeiten: bis erster Satz 4:00')&&tx.includes('Pause Ø 2:10')&&tx.includes('Wechsel Ø 1:00')&&/Zeit 4:20, Pause Ø 2:10/.test(tx),tx);
  ok('history before excludes itself',histFor(sv.x[0].e,null,{d:t,st:sv.st}).length<histFor(sv.x[0].e).length);
  // Zusammenfassung ansehen
  ACT.wview({dataset:{d:t,id:sv.id}});
  ok('summary page',UI.page.t==='wsum'&&qa('.kpi').length===3&&q('#view').textContent.includes('Bis zum ersten Satz')&&q('#view').textContent.includes('Vorschlag fürs nächste Mal')&&!!q('[data-a="copysess"]')&&!q('.kpi span').textContent.includes('geschätzt'),q('#view').textContent.slice(0,300));
  ok('summary lists exercises with sets',qa('.tnxt.tex div').some(d=>d.textContent.includes(EXD(sv.x[0].e).n)));
  click('.ptopbar [data-a="wedit"]');ok('edit from summary',UI.page.t==='work'&&UI.w.edit===sv.id&&UI.w.it[0].sets[0].t===240);
  click('[data-a="wset"][data-i="0"][data-j="2"]');click('[data-a="wset"][data-i="0"][data-j="2"]');ok('edit: re-checked set has no time',UI.w.it[0].sets[2].t===undefined);
  typeIn('[data-ws="r"][data-i="0"][data-j="0"]','7');click('.ptopbar [data-a="wsave"]');await wait(400);
  ok('save in edit returns to summary',UI.page&&UI.page.t==='wsum'&&UI.page.id===sv.id&&UI.stack.length===0,JSON.stringify(UI.page));
  const sv2=sessOf(t).find(x=>x.id===sv.id);ok('edit keeps times',sv2.x[0].s[0].r===7&&sv2.x[0].s[0].t===240&&sv2.x[0].s[1].t===330&&!('t' in sv2.x[0].s[2]),JSON.stringify(sv2.x[0].s));
  click('.ptopbar [data-a="back"]');ok('back from summary',!UI.page);
  // Nachtragen: keine Zeiten, Minuten geschätzt
  const dl=addDays(t,-2);ACT.wstart({dataset:{day:PU().id,d:dl}});ok('late flag',UI.w.lt===1);
  click('[data-a="wset"][data-i="0"][data-j="0"]');click('[data-a="wset"][data-i="0"][data-j="1"]');ok('late sets have no t',UI.w.it[0].sets.every(s=>!('t' in s)));
  click('.ptopbar [data-a="wfinish"]');click('.ptopbar [data-a="wsave"]');await wait(400);
  const lv=sessOf(dl).slice(-1)[0];ok('late saved with lt',lv&&lv.lt===1&&lv.x[0].s.every(z=>!('t' in z)),JSON.stringify(lv));
  ACT.wview({dataset:{d:dl,id:lv.id}});ok('late summary: estimated, no times card',q('.kpi span').textContent.includes('geschätzt')&&!q('#view').textContent.includes('Bis zum ersten Satz'));
  click('.ptopbar [data-a="wedit"]');click('.ptopbar [data-a="wsave"]');await wait(300);ok('lt survives edit',sessOf(dl).find(x=>x.id===lv.id).lt===1);
  ACT.wview({dataset:{d:'2000-01-01',id:'nope'}});ok('missing session does not crash',!!q('#view'));
  // Aufräumen
  window.__now=null;for(const [d,id] of [[t,sv.id],[dl,lv.id]]){const e=dayEnsure(d);e.tr=e.tr.filter(z=>z.id!==id);if(!e.tr.length)delete e.tr;touch(mkey(d))}UI.page=null;UI.stack=[];render();
});
await step('notiz + aufwärmen',async()=>{
  const d0=t,base=Date.now();window.__now=()=>base;
  ACT.wstart({dataset:{day:PU().id,d:d0}});
  ok('warm card with 4 chips',!!q('.twu')&&qa('.twu .chip').length===4&&!!q('#wwu'));
  ok('note link per exercise',qa('[data-a="wnote"]').length===UI.w.it.filter(x=>x.k==='ex').length&&!q('.tnp'));
  click('[data-a="wwarm"][data-i="0"][data-j="0"]');
  ok('set 1 is warm',UI.w.it[0].sets[0].w===1&&q('[data-a="wwarm"][data-i="0"][data-j="0"]').textContent==='A'&&q('[data-a="wwarm"][data-i="0"][data-j="1"]').textContent==='1'&&UI.w.wt.includes('sets'));
  click('[data-a="wset"][data-i="0"][data-j="0"]');
  ok('warm done: no RIR row, clock still running',!q('.trir')&&!UI.w.fs&&UI.w.it[0].sets[0].done);
  ok('warm set does not count',wStats(UI.w).sets===0);
  window.__now=()=>base+8*60000+20000;
  click('[data-a="wset"][data-i="0"][data-j="1"]');
  ok('first working set stops warmup clock',UI.w.fs===base+8*60000+20000&&q('#wwu').textContent==='8:20');
  window.__now=()=>base+20*60000;await wait(700);ok('clock stays',q('#wwu').textContent==='8:20');
  ok('rir row only for working set',qa('.trir').length===1);
  ok('stats count working only',wStats(UI.w).sets===1);
  click('[data-a="wwu"][data-k="rad"]');click('[data-a="wwu"][data-k="mob"]');click('[data-a="wwu"][data-k="mob"]');
  ok('chips toggle',UI.w.wt.join()==='sets,rad'&&qa('.twu .chip.on').length===2);
  click('[data-a="waddwu"][data-i="1"]');const w1=UI.w.it[1].sets;
  ok('added warm set at front',w1[0].w===1&&!w1[1].w&&(w1[0].k==null||w1[0].k<=(+w1[1].k||0)),JSON.stringify(w1[0])+JSON.stringify(w1[1]));
  click('[data-a="wnote"][data-i="1"]');ok('panel open',!!q('.tnp')&&qa('.tnp .chip').length===3);
  click('[data-a="wnote"][data-i="1"]');ok('panel closed again',!q('.tnp'));
  click('[data-a="wnote"][data-i="0"]');
  click('.tnp [data-a="wnq"][data-k="1"]');click('.tnp [data-a="wnq"][data-k="2"]');click('.tnp [data-a="wnq"][data-k="2"]');
  ok('chip on/off',UI.w.it[0].nq.join()==='1'&&qa('.tnp .chip.on').length===1&&qa('.tnp .chip.on')[0].textContent==='links/rechts ungleich');
  typeIn('[data-wn]','Griff nass');ok('free text stored',UI.w.it[0].nt==='Griff nass');
  click('[data-a="wnote"][data-i="0"]');ok('closed shows note line',q('.tnl')&&q('.tnl').textContent.includes('links/rechts ungleich · Griff nass')&&!q('.tnp'));
  await wait(500);
  ok('note + warm persisted locally',(()=>{const w=JSON.parse(localStorage.getItem(WKEY()));return w.it[0].nt==='Griff nass'&&w.wt.includes('rad')&&w.fs>0})());
  window.__now=()=>base+9*60000+20000;click('[data-a="wset"][data-i="0"][data-j="2"]');
  ok('times ignore warm set: lead = first working set',wTimes(UI.w)&&wTimes(UI.w).lead===500&&wTimes(UI.w).by.get(0).n===2,JSON.stringify(wTimes(UI.w)&&wTimes(UI.w).lead));
  click('.ptopbar [data-a="wfinish"]');const txt=q('#view').textContent;
  ok('summary shows warmup + notes',txt.includes('Aufwärmen')&&txt.includes('8 min')&&txt.includes('Rad')&&txt.includes('Notizen')&&txt.includes('Griff nass'),txt.slice(0,300));
  ok('kpi sets = working sets',+qa('.kpi b')[1].textContent===2);
  click('.ptopbar [data-a="wsave"]');await wait(600);
  const sv=sessOf(d0).find(x=>x.day===PU().id);
  ok('saved wu',sv&&sv.wu&&sv.wu.m===8&&sv.wu.t.join()==='sets,rad',JSON.stringify(sv&&sv.wu));
  ok('saved working sets separate from warm',sv.x[0].s.length===2&&sv.x[0].ws.length===1&&!('w' in sv.x[0].s[0]),JSON.stringify(sv.x[0]));
  ok('saved note',sv.x[0].nq.join()==='1'&&sv.x[0].n==='Griff nass');
  ok('no undefined in cloud',!JSON.stringify(cloud(mk)).includes('undefined'));
  const T=sessText(d0,sv);
  ok('claude text warmup',/Aufwärmen: 8 min · Aufwärmsätze · Rad/.test(T),T);
  ok('claude text warm sets + note',/Aufwärmsätze: .*kg × \d+/.test(T)&&/Notiz: links\/rechts ungleich · Griff nass/.test(T),T);
  const L=lastFor(sv.x[0].b,sv.x[0].e);ok('progression history ignores warm sets',L&&L.x.s.length===2);
  ACT.wview({dataset:{d:d0,id:sv.id}});const sm=q('#view').textContent;
  ok('saved summary shows warmup, notes, warm sets',sm.includes('Aufwärmen')&&sm.includes('8 min')&&sm.includes('Rad')&&sm.includes('Griff nass')&&sm.includes('Bis zum ersten Satz')&&/Aufwärmen: .*kg/.test(sm),sm.slice(0,400));
  ok('claude text keeps times without warm sets',/Zeiten: bis erster Satz 8:20/.test(T),T);
  click('.ptopbar [data-a="back"]');
  window.__now=()=>base+30*60000;
  ACT.wstart({dataset:{day:PU().id,d:d0}});ok('note from last time shown',q('#view').textContent.includes('Notiz letztes Mal: links/rechts ungleich · Griff nass'));
  click('.ptopbar [data-a="wcancel"]');
  ACT.wedit({dataset:{d:d0,id:sv.id}});
  ok('edit restores warm/notes',UI.w.it[0].sets[0].w===1&&UI.w.it[0].sets[0].done&&UI.w.it[0].nt==='Griff nass'&&UI.w.wm===8&&UI.w.wt.join()==='sets,rad'&&q('#wwu').textContent==='8 min'&&qa('.tnl').length===1);
  ok('edit: working numbering',q('[data-a="wwarm"][data-i="0"][data-j="1"]').textContent==='1');
  click('.ptopbar [data-a="wsave"]');await wait(500);
  const s2=sessOf(d0).find(x=>x.id===sv.id);
  ok('edit keeps everything',s2.wu.m===8&&s2.x[0].ws.length===1&&s2.x[0].s.length===2&&s2.x[0].n==='Griff nass'&&s2.x[0].nq.join()==='1',JSON.stringify(s2.x[0]));
  ACT.wedit({dataset:{d:d0,id:sv.id}});click('[data-a="wwarm"][data-i="0"][data-j="0"]');ok('warm → working',!UI.w.it[0].sets[0].w);click('.ptopbar [data-a="wcancel"]');
  window.__now=null;const e0=dayEnsure(d0);e0.tr=e0.tr.filter(z=>z.id!==sv.id);touch(mkey(d0));UI.page=null;UI.stack=[];render();
  ACT.wstart({dataset:{day:PU().id,d:d0}});click('[data-a="wset"][data-i="0"][data-j="0"]');click('.ptopbar [data-a="wfinish"]');click('.ptopbar [data-a="wsave"]');await wait(500);
  const s3=sessOf(d0).find(x=>x.day===PU().id);
  ok('plain session without extras',s3&&!('ws' in s3.x[0])&&!('nq' in s3.x[0])&&!('n' in s3.x[0]),JSON.stringify(s3&&s3.x[0]));
  const e1=dayEnsure(d0);e1.tr=e1.tr.filter(z=>z.id!==s3.id);touch(mkey(d0));UI.page=null;UI.stack=[];render();
});
await step('emom tag C',async()=>{
  ACT.wstart({dataset:{day:C().id,d:t}});ok('emom card',!!q('.temom')&&qa('.tdots button').length===10);
  click('[data-a="wemset"][data-i="0"]');ok('blk page emom',UI.page.t==='blk'&&UI.page.b.k==='emom');
  const sel=q('select[data-bk="n"]');sel.value='8';sel.dispatchEvent(new Event('change',{bubbles:true}));
  typeIn('.tw-in[data-tw="bv"]','01:30');ok('emom draft',UI.page.b.n===8&&UI.page.b.v===90);
  click('[data-a="bidel"][data-i="1"]');ok('only chin-ups',UI.page.b.it.length===1);
  click('[data-a="tpick"][data-m="blkemom"]');click('#pk-list [data-a="pkset"][data-e="dips"]');ok('dips added again',UI.page.t==='blk'&&UI.page.b.it.length===2&&UI.page.b.it[1].e==='dips');
  typeIn('[data-bi="r"][data-i="1"]','5');click('.ptopbar [data-a="blksave"]');
  ok('template updated',C().blocks[0].n===8&&C().blocks[0].v===90&&C().blocks[0].it[1].r===5);
  ok('workout item updated',UI.page.t==='work'&&UI.w.it[0].n===8&&UI.w.it[0].v===90&&qa('.tdots button').length===8);
  click('[data-a="wemdot"][data-k="0"]');click('[data-a="wemdot"][data-k="1"]');ok('manual rounds',UI.w.it[0].ok.filter(Boolean).length===2&&UI.w.it[0].r===2);
  click('[data-a="wemgo"]');ok('running',UI.w.it[0].run);const base=Date.now();window.__now=()=>base+92000;await wait(800);
  ok('round advanced by timer',UI.w.it[0].r===3&&UI.w.it[0].ok[2],JSON.stringify({r:UI.w.it[0].r,ok:UI.w.it[0].ok}));
  click('[data-a="wemgo"]');ok('paused',!UI.w.it[0].run);window.__now=null;
  click('.ptopbar [data-a="wfinish"]');click('.ptopbar [data-a="wsave"]');await wait(500);
  const s=sessOf(t).find(x=>x.day===C().id);ok('emom saved',s&&s.x[0].em&&s.x[0].em.ok.filter(Boolean).length===3&&s.x[0].em.it.length===2);
});
await step('day editor + picker + custom',async()=>{
  click('#tab-training');click('[data-a="tdays"]');ok('days page',UI.page.t==='days'&&qa('.tdaycard').length===3);
  click(`.tdaycard[data-id="${P().id}"]`);ok('day editor',UI.page.t==='dayed'&&qa('.tbrow').length===6);
  typeIn('#dy-n','Push A');ok('renamed',P().name==='Push A');
  click('[data-a="daycol"][data-v="p"]');ok('color',P().col==='p');click('[data-a="back"]');ok('days list dot follows color',getComputedStyle(q(`.tdaycard[data-id="${P().id}"] .tdot`)).backgroundColor==='rgb(180, 140, 255)',getComputedStyle(q(`.tdaycard[data-id="${P().id}"] .tdot`)).backgroundColor);click(`.tdaycard[data-id="${P().id}"]`);
  click('[data-a="tpick"][data-m="add"]');click('[data-a="pkmu"][data-v="Beine"]');ok('muscle filter',qa('#pk-list .tlrow').length>5&&!qa('#pk-list b').some(b=>/Bankdrücken/.test(b.textContent)));
  click('#pk-list [data-a="pkset"][data-e="kreuzheben"]');ok('added',UI.page.t==='dayed'&&P().blocks.length===7&&P().blocks[6].e==='kreuzheben');
  click('[data-a="blkmv"][data-i="6"][data-dir="-1"]');ok('moved up',P().blocks[5].e==='kreuzheben');
  click('[data-a="blked"][data-i="5"]');ok('blk ex page',UI.page.t==='blk'&&!!q('.tw-in[data-tw="brest"]'));
  click('[data-a="bksets"][data-dir="1"]');typeIn('[data-bk="k"]','100');typeIn('[data-bk="lo"]','5');typeIn('[data-bk="hi"]','8');typeIn('#bk-note','Technik vor Gewicht');
  click('.ptopbar [data-a="blksave"]');const b=P().blocks[5];ok('block saved',b.p.length===4&&b.p.every(x=>x.k===100)&&b.lo===5&&b.hi===8&&b.note==='Technik vor Gewicht',JSON.stringify(b));
  click('[data-a="blked"][data-i="0"]');ok('dips: per-set start auto',UI.page.per===true&&qa('[data-bp="k"]').length===3);
  typeIn('[data-bp="k"][data-j="1"]','26');typeIn('[data-bp="r"][data-j="2"]','12');click('.ptopbar [data-a="blksave"]');
  ok('per-set saved',P().blocks[0].p[1].k===26&&P().blocks[0].p[2].r===12&&P().blocks[0].p[0].k===27.5,JSON.stringify(P().blocks[0].p));
  click('[data-a="blked"][data-i="2"]');ok('brustpresse: single start',UI.page.per===false&&!!q('[data-bk="k"]')&&!q('[data-bp="k"]'));
  click('[data-a="bkper"][data-v="1"]');ok('switch to per set',qa('[data-bp="k"]').length===3&&q('[data-bp="k"][data-j="2"]').value==='105');
  typeIn('[data-bp="k"][data-j="2"]','95');click('[data-a="bkper"][data-v="0"]');ok('back to equal uses set 1',UI.page.b.p.every(x=>x.k===105));
  click('[data-a="bkper"][data-v="1"]');typeIn('[data-bp="k"][data-j="2"]','95');click('.ptopbar [data-a="blksave"]');ok('drop set saved',P().blocks[2].p.map(x=>x.k).join()==='105,105,95');
  click('[data-a="tpick"][data-m="add"]');click('.ptopbar [data-a="cexnew"]');ok('custom form',UI.page.t==='cex');
  typeIn('#cx-n','Sandbag Clean');click('[data-a="cxm"][data-v="Beine"]');click('[data-a="cxm"][data-v="Rücken"]');click('[data-a="cxsd"]');
  typeIn('#cx-tp','Explosiv aus der Hüfte\nSack nah am Körper');click('.ptopbar [data-a="cexsave"]');
  const ce=Object.values(S.training.ex)[0];ok('custom saved',ce&&ce.n==='Sandbag Clean'&&ce.sd===1&&ce.tp.length===2&&ce.m.Beine===1);
  ok('back on picker with search',UI.page.t==='pick'&&qa('#pk-list b')[0]?.textContent.includes('Sandbag'));
  click('#pk-list .tlrow');ok('custom in day',P().blocks.length===8&&EXD(P().blocks[7].e).n==='Sandbag Clean');
  click('[data-a="back"]');click('[data-a="back"]');ok('back to training',!UI.page);
  click('[data-a="texl"]');ok('exercise list with own',q('#view').textContent.includes('Eigene Übungen')&&q('#view').textContent.includes('Sandbag Clean'));
  click('[data-a="exd"][data-e="dips"]');ok('detail kpis',qa('.kpi').length===3);click('[data-a="back"]');click('[data-a="back"]');
});
await step('runs',async()=>{
  click('#tab-training');ok('big header',q('.ttop h1')?.textContent==='Training'&&parseFloat(getComputedStyle(q('.ttop h1')).fontSize)>=30);click('.thero [data-a="runnew"]');ok('run page easy',UI.page.t==='run'&&UI.page.r.t==='easy');
  await wait(400);{const di=q('#rn-d'),card=di.closest('.card');ok('date field inside card',di.getBoundingClientRect().right<=card.getBoundingClientRect().right+0.5,di.getBoundingClientRect().right+' '+card.getBoundingClientRect().right)}
  ok('format placeholders',q('#rn-dur').placeholder==='h:mm:ss'&&q('#rn-hr').placeholder==='–');
  typeIn('#rn-dur','10130');ok('auto clock',q('#rn-dur').value==='1:01:30');
  typeIn('#rn-km','8,1');typeIn('#rn-hr','146');ok('pace live',q('#rn-pace').textContent==='7:36',q('#rn-pace').textContent);
  ok('hr ok',q('#rn-hrok').textContent.includes('unter 150'));
  click('.ptopbar [data-a="runsave"]');await wait(300);const r=runsOf(t)[0];ok('run saved',r&&r.dur===3690&&r.km===8.1&&r.hr===146&&r.t==='easy',JSON.stringify(r));
  ok('hero run done',qa('.thero.run .meta').some(m=>m.textContent.includes('✓')));
  click('[data-a="truns"]');ok('runs page',UI.page.t==='runs'&&qa('.tkm .pbcol small').length===8&&q('.tkm .pbcol small').textContent.startsWith('KW '));
  click('.ptopbar [data-a="runnew"]');click('[data-a="rtype"][data-v="iv"]');click('[data-a="ivp"][data-v="6x400"]');
  ok('6 rows, time column',qa('.tivrow:not(.hd)').length===6&&q('.tivrow.hd').textContent.includes('Zeit'));
  typeIn('[data-iv="0"][data-f="v"]','152');ok('interval time formatted + pace',q('[data-iv="0"][data-f="v"]').value==='1:52'&&q('#ivp-0').textContent==='= 4:40 /km',q('#ivp-0').textContent);
  typeIn('[data-iv="0"][data-f="h"]','165');
  click('[data-a="ivp"][data-v="own"]');typeIn('[data-io="n"]','2');ok('own 2 rows',qa('.tivrow:not(.hd)').length===2);
  click('[data-a="ivu"][data-v="min"]');typeIn('[data-io="len"]','20');ok('own 20 min pace column',q('.tivrow.hd').textContent.includes('Pace')&&q('.tivrow .lb b').textContent.includes('20 min'));
  typeIn('[data-iv="0"][data-f="v"]','455');typeIn('#rn-dur','4600');typeIn('#rn-km','8,4');typeIn('[data-io="pz"]','3 min gehen');
  click('.ptopbar [data-a="runsave"]');await wait(300);const iv=runsOf(t).find(x=>x.t==='iv');
  ok('interval saved',iv&&iv.iv.n===2&&iv.iv.len===20&&iv.iv.u==='min'&&iv.iv.r[0].v==='4:55'&&iv.iv.pz==='3 min gehen',JSON.stringify(iv&&iv.iv));
  ok('back on runs page',UI.page.t==='runs');
  await wait(600);ok('runs in cloud',cloud(mk)?.days?.[t]?.run?.length===2);
  click('.swipe .tt[data-a="runedit"]');ok('edit run',UI.page.t==='run'&&!!UI.page.r.id);typeIn('#rn-hr','150');click('.ptopbar [data-a="runsave"]');
  q('.swipe-actions [data-a="rundelq"]').click();await wait(50);ok('run deleted',runsOf(t).length===1);click('[data-a="undo"]');ok('run undo',runsOf(t).length===2);
  click('[data-a="back"]');
});
await step('settings + statistik tab',async()=>{
  click('[data-a="tset"]');ok('settings page',UI.page.t==='tset'&&!!q('#ts-h'));
  click('[data-a="thr"][data-dir="-1"]');ok('hr 149',S.training.hr===149);click('[data-a="thr"][data-dir="1"]');
  const sel=q('#ts-h');sel.value='-';sel.dispatchEvent(new Event('change',{bubbles:true}));ok('habit none',S.training.habit==='-'&&trHabit('tr')===null);
  sel.value='';sel.dispatchEvent(new Event('change',{bubbles:true}));click('[data-a="back"]');
  click('#tab-mehr');ok('Ansicht folded by default',!q('[data-a="stattab"]')&&!!q('[data-a="fold"][data-k="a"]'));click('[data-a="fold"][data-k="a"]');click('[data-a="stattab"]');ok('6 tabs',qa('#tabbar .tab').length===6&&!!q('#tab-statistik'));
  click('#tab-statistik');ok('stats tab',UI.tab==='statistik'&&q('h1').textContent==='Statistik');
  click('#tab-mehr');click('[data-a="stattab"]');ok('back to 5 tabs',qa('#tabbar .tab').length===5&&UI.tab==='mehr');
  click('#tab-habits');click('[data-a="hseg"][data-v="s"]');ok('stats inside habits',q('h1').textContent==='Statistik'&&!!q('.bars'));
  click('[data-a="hseg"][data-v="h"]');ok('habits again',q('h1').textContent==='Habits');
});
await step('restore running workout',async()=>{
  click('#tab-training');ACT.wstart({dataset:{day:PU().id,d:t}});click('[data-a="wset"][data-i="0"][data-j="0"]');
  const saved=localStorage.getItem(lsKey()+':wo');UI.w=null;UI.wTried=null;UI.page=null;UI.stack=[];render();
  ok('banner after restore',!!q('.trun')&&UI.w&&UI.w.day===PU().id&&!!saved);
  click('.trun');ok('resumed with set done',UI.page.t==='work'&&UI.w.it[0].sets[0].done);
  click('.ptopbar [data-a="wcancel"]');ok('arm first',UI.w&&q('.ptopbar [data-a="wcancel"]').classList.contains('arm'));
  click('.ptopbar [data-a="wcancel"]');ok('discarded',!UI.w&&!localStorage.getItem(lsKey()+':wo'));
});
await step('ios details',async()=>{
  click('#tab-training');ACT.wstart({dataset:{day:P().id,d:t}});
  const cs=el=>parseFloat(getComputedStyle(el).fontSize);await wait(450);
  ok('all inputs >=16px in workout',qa('#view input').every(i=>cs(i)>=16),qa('#view input').filter(i=>cs(i)<16).map(i=>i.className+i.dataset.ws).join());
  ok('no horizontal scroll',document.documentElement.scrollWidth<=innerWidth,document.documentElement.scrollWidth+' '+qa('#view *').filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,4).map(e=>e.tagName+'.'+e.className+':'+Math.round(e.getBoundingClientRect().right)).join(', '));
  click('.ptopbar [data-a="wcancel"]');
  for(const p of ['runs','exl','days','tset']){ACT['t'+(p==='runs'?'runs':p==='exl'?'exl':p==='days'?'days':'set')]();await wait(450);ok('no overflow '+p,document.documentElement.scrollWidth<=innerWidth&&qa('#view input').every(i=>cs(i)>=16),qa('body *').filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,4).map(e=>e.tagName+'.'+e.className+':'+Math.round(e.getBoundingClientRect().right)).join(', '));click('[data-a="back"]')}
});
click('#tab-aufgaben');await wait(300);ok('short page still scrollable (bounce)',document.documentElement.scrollHeight>innerHeight,document.documentElement.scrollHeight+' '+innerHeight);
await step('rest signal + settings',async()=>{
  click('#tab-training');ACT.wstart({dataset:{day:P().id,d:t}});click('[data-a="wset"][data-i="0"][data-j="0"]');
  ok('rest running',!!UI.rest);UI.rest.end=Date.now()-10;restbar();ok('flash at rest end',document.body.classList.contains('tflash')&&!UI.rest);
  click('.ptopbar [data-a="wcancel"]');click('.ptopbar [data-a="wcancel"]');
  ACT.tset();ok('sound + wake switches',!!q('[data-a="tsnd"].on')&&!!q('[data-a="twake"].on'));click('[data-a="tsnd"]');ok('sound off',S.training.snd===false&&!q('[data-a="tsnd"].on'));click('[data-a="tsnd"]');ok('sound on',S.training.snd===true);
  click('[data-a="tsndtest"]');click('[data-a="back"]');
});
await step('copy for Claude',async()=>{
  let got=null;const orig=navigator.clipboard&&navigator.clipboard.writeText;try{Object.defineProperty(navigator,'clipboard',{value:{writeText:txt=>{got=txt;return Promise.resolve()}},configurable:true})}catch(e){}
  click('#tab-training');click('[data-a="copyweek"]');await wait(50);
  ok('week text',got&&got.startsWith('Sabrly – Woche KW')&&got.includes('Habits:')&&got.includes('Dips:')&&got.includes('EMOM alle')&&got.includes('Intervalle')&&got.includes('Ø-Puls'),String(got).slice(0,400));
  ok('toast after copy',q('#toast').textContent.includes('Kopiert'));
  got=null;click('.swipe .tt[data-a="wview"]');click('[data-a="copysess"]');await wait(30);ok('session text',got&&/^\S+ \d+\.\d+\. – /.test(got)&&(got.includes('kg ×')||got.includes('EMOM alle')),String(got).slice(0,200));click('.ptopbar [data-a="back"]');
  got=null;ACT.wstart({dataset:{day:P().id,d:t}});click('[data-a="wset"][data-i="1"][data-j="0"]');click('.ptopbar [data-a="wfinish"]');click('[data-a="wsavecopy"]');await wait(50);
  ok('save + copy',got&&got.includes('Landmine Press')&&!UI.w,String(got).slice(0,160));
  got=null;click('[data-a="truns"]');click('.swipe .tt[data-a="runedit"]');click('[data-a="copyrun"]');await wait(30);ok('run text',got&&/km/.test(got),String(got));click('[data-a="back"]');click('[data-a="back"]');
});
await step('week review card',async()=>{
  const sun=addDays(ws,6),real=Date.now();window.__now=()=>pdate(sun).getTime()+12*3600e3+(Date.now()-real);UI.sel=null;click('#tab-heute');await wait(50);
  ok('review card on Sunday',!!q('.wrev')&&q('.wrev .label').textContent.includes('KW '+kw(ws))&&qa('.wrk>div').length===4,q('.wrev')?.textContent.slice(0,200));
  ok('plan button only if next week unplanned',!!q('.wrev [data-a="tplan"][data-ws="'+addDays(ws,7)+'"]')===!hasPlan(addDays(ws,7)));
  {const old=clone(S.training.weeks[addDays(ws,7)]);delete S.training.weeks[addDays(ws,7)];render();ok('plan next week button',!!q('.wrev [data-a="tplan"][data-ws="'+addDays(ws,7)+'"]'));S.training.weeks[addDays(ws,7)]=old;render()}
  click('.wrev [data-a="revhide"]');await wait(30);ok('hidden for this week',!q('.wrev')&&S.settings.revSeen===ws);
  window.__now=()=>pdate(addDays(ws,7)).getTime()+9*3600e3;S.settings.revSeen='';render();ok('Monday shows last week',!!q('.wrev')&&q('.wrev .label').textContent.includes('KW '+kw(ws)));
  window.__now=null;render();ok('no card on Tuesday',!q('.wrev')||wd(today())===6||wd(today())===0);
  click('#tab-mehr');if(!q('[data-a="weeknotify"]'))click('[data-a="fold"][data-k="a"]');ok('reminder switch on',!!q('[data-a="weeknotify"].on'));click('[data-a="weeknotify"]');ok('reminder off',S.settings.weekNotify===false);click('[data-a="weeknotify"]');
});
await step('garmin',async()=>{
  let got=null;try{Object.defineProperty(navigator,'clipboard',{value:{writeText:txt=>{got=txt;return Promise.resolve()}},configurable:true})}catch(e){}
  window.__now=null;
  // ein Tag ohne Einträge (das Widget schreibt dorthin)
  let d1=null;for(let i=1;i<20;i++){const d=addDays(t,-i),e=dayGet(d);if(!e||(!(e.tr||[]).length&&!(e.run||[]).length)){d1=d;break}}
  const k1=mkey(d1),ts0=pdate(d1).getTime()+15*3600e3+19*60e3;
  const runG={id:'g-777',t:'easy',dur:2035,km:5.05,hr:164,max:181,g:{id:'777',n:'Dormagen Laufen',typ:'running',st:'11:58',ts:ts0-3*3600e3,kcal:427,te:3.8,ate:0,load:90,lbl:'LACTATE_THRESHOLD',z:[0,205,401,1261,168],cad:175,asc:19,stl:85,
    km:[{t:419,h:155},{t:354,h:171},{t:432,h:164},{t:432,h:162},{t:376,h:170},{t:21,h:166,m:55}],seg:[{k:'r',t:223,m:544,h:148,p:'e'},{k:'w',t:65,m:98,h:152,p:'e'},{k:'r',t:492,m:1391,h:171},{k:'w',t:133,m:217,h:144,d:28},{k:'r',t:495,m:1289,h:172}],cv:{s:60,p:[419,354,0],h:[150,170,160],c:[170,172,118],a:[44,45,45]},
    lap:[{t:622,m:1609,h:159,x:181,i:5,tr:2},{t:664,m:1609,h:166,x:177,i:5,tr:2}],zb:[99,118,138,158,177,197],mhr:197,rhr:78,ivx:{p:'own',n:3,u:'min',len:8,pz:'2 min gehen',r:[{v:'5:54',h:171},{v:'6:24',h:172},{v:'6:15',h:170}]}}};
  const gaS={id:'888',k:'str',n:'Krafttraining',typ:'strength_training',st:'15:19',ts:ts0,dur:3604,hr:115,max:168,kcal:394,te:2.1,ate:1.4,load:31,z:[1564,1048,369,38,0]};
  const gaO={id:'999',k:'oth',n:'Indoor-Radfahren',typ:'indoor_cycling',st:'09:43',ts:ts0-6*3600e3,dur:2403,hr:132,max:149,km:21.5,te:3};
  for(let i=0;i<50&&pendingKeys().length;i++)await wait(100);
  const doc=clone(LOGS[k1]||{days:{}});doc.days=doc.days||{};doc.days[d1]=Object.assign(doc.days[d1]||{},{run:[runG],ga:[gaO,gaS]});
  __store.set('users/u1/data/'+k1,doc);__store.set('users/u1/data/garmin',{at:new Date(Date.now()-5*60e3).toISOString(),err:'',n:3,last:['Mo 9.11. · Lauf 5,05 km · 33:55']});
  __emit({fromCache:false,hasPendingWrites:false});await wait(80);
  ok('garmin: widget data arrives in app',runsOf(d1).some(r=>r.id==='g-777')&&gaOf(d1).length===2&&GST&&GST.n===3,JSON.stringify({d1,k1,pend:localPending(k1),keys:pendingKeys(),gst:!!GST,ga:gaOf(d1).length,runs:runsOf(d1).length,deny:!!window.__denyWrites}));
  click('#tab-training');UI.tsel=d1;render();await wait(30);
  ok('garmin: two Garmin cards (strength + other)',qa('.thero.gah').length===2&&q('#view').textContent.includes('Indoor-Radfahren')&&qa('.thero.gah h3').some(h=>h.textContent==='Krafttraining'),qa('.thero.gah h3').map(h=>h.textContent).join());
  ok('garmin: strength card offers to add sets',!!q('.thero.gah [data-a="wfree"]'));
  ok('garmin: zone bar on strength card',qa('.thero.gah .gz i').length===4);
  ok('garmin: run card marked ⌚',qa('.thero.run .meta').some(m=>m.textContent.includes('⌚')));
  // Lauf-Seite
  ACT.runedit({dataset:{d:d1,id:'g-777'}});await wait(20);
  ok('garmin: run page shows Garmin card',!!q('.gcard')&&!!q('.gtop')&&q('.gtop .gtd').textContent.includes('11:58')&&q('.gtop .gtd b').textContent==='Dormagen Laufen');
  ok('garmin: overview on top',q('#view .gtop')===q('#view .card')&&q('.gtop .gbig b').textContent==='5,05'&&['164','6:43','33:55','427'].every(v=>q('.gtop .gq').textContent.includes(v)),q('.gtop')&&q('.gtop').textContent);
  ok('garmin: km rows',qa('.gkm>div:not(.hd)').length===6&&qa('.gkm>div:not(.hd) b')[1].textContent==='5:54',qa('.gkm>div:not(.hd) b').map(b=>b.textContent).join());
  ok('garmin: last partial km',qa('.gkm>div:not(.hd)')[5].firstElementChild.textContent==='0,06'&&qa('.gkm>div:not(.hd) b')[5].textContent==='6:22',qa('.gkm>div:not(.hd)')[5].textContent);
  ok('garmin: easy run shows no run/walk table, only a hint',!q('.gseg')&&q('.gcard').textContent.includes('2 kurze Gehpausen, zusammen 3:18'),q('.gcard').textContent.slice(-300));
  click('[data-a="rtype"][data-v="iv"]');await wait(10);
  ok('garmin: run/walk table has headers',qa('.gseg>div.hd span').map(x=>x.textContent).join('|')==='|Zeit|Strecke|Pace|Puls');
  ok('garmin: warm-up shown as side info, not in table',qa('.gseg>div:not(.hd)').length===3&&qa('.gseg>div.w').length===1&&q('.gside')&&q('.gside').textContent.includes('Einlaufen')&&q('.gside').textContent.includes('3:43 · 544 m · 6:50 /km · Ø 148 · dazu 1:05 gehen'),q('.gside')&&q('.gside').textContent);
  ok('garmin: kpis',q('.gcard .gk').textContent.includes('175')&&q('.gcard .gk').textContent.includes('3,8')&&q('.gcard .gk').textContent.includes('90'),q('.gcard .gk').textContent);
  ok('garmin: TE label german',q('.gcard').textContent.includes('Laktatschwelle'));
  ok('garmin: zones with ranges',qa('.gcard .gz i').length===4&&q('.gcard .gzl').textContent.includes('159–177'),q('.gcard .gzl').textContent);
  ok('garmin: watch laps collapsible',!!q('.gcard details.glap')&&q('.gcard details.glap summary').textContent.includes('(2)'));
  ok('garmin: hint says values came from watch',q('#view').textContent.includes('kamen von deiner Garmin-Uhr'));
  got=null;click('[data-a="copyrun"]');await wait(30);
  ok('garmin: easy run text: only short walk note',!!got&&got.includes('Lauf locker/lang')&&got.includes('Kurze Gehpausen: 1:05, 2:13 (zusammen 3:18)')&&!got.includes('Hauptteil')&&got.includes('Garmin: Start 11:58')&&got.includes('km-Splits (Pace, Ø-Puls): km 1 6:59 (155) · km 2 5:54 (171)')&&got.includes('Verlauf je 1 min'),String(got));
  // Typ auf Intervalle: Vorschlag aus den Lauf/Geh-Abschnitten
  click('[data-a="rtype"][data-v="iv"]');await wait(10);
  ok('garmin: switching to intervals prefills from watch',qa('.tivrow:not(.hd)').length===3&&qa('[data-iv="0"][data-f="v"]')[0].value==='5:54'&&q('#view').textContent.includes('2 min gehen'),qa('.tivrow').length);
  click('[data-a="runsave"]');await wait(600);
  const r2=runsOf(d1).find(r=>r.id==='g-777');ok('garmin: saving keeps watch data',r2&&r2.t==='iv'&&r2.g&&r2.g.km.length===6&&r2.iv.n===3&&cloud(k1).days[d1].run.find(r=>r.id==='g-777').g.seg.length===5&&r2.g.seg[0].p==='e',JSON.stringify(r2).slice(0,200));
  got=null;ACT.copyrun({dataset:{d:d1,id:'g-777'}});await wait(30);
  ok('garmin: interval run text for Claude',!!got&&got.includes('Garmin: Start 11:58')&&got.includes('km-Splits (Pace, Ø-Puls): km 1 6:59 (155) · km 2 5:54 (171)')&&got.includes('Einlaufen: 3:43 · 544 m · 6:50 /km · Ø 148 · dazu 1:05 gehen')&&got.includes('Hauptteil Laufen/Gehen')&&got.includes('Gehen 2:13/217 m (144, Puls −28 nach 60 s)')&&got.includes('Verlauf je 1 min (Minute: Pace/Puls/Kadenz/Höhe m):\n   1′ 6:59/150/170/44 · 2′ 5:54/170/172/45 · 3′ –/160/118/45')&&got.includes('Effizienz: 0,91 m/min je Herzschlag')&&!got.includes('Laufen 3:43')&&got.includes('Pulszonen: Z1 (100–118) 0:00 · Z2 (119–138) 3:25')&&got.includes('Ruhepuls 78')&&got.includes('Laktatschwelle')&&!got.includes('Runden:'),String(got));
  // Löschen merkt sich die Garmin-ID, Rückgängig nimmt sie wieder raus
  runDel(d1,'g-777');await wait(500);ok('garmin: delete remembers id',(dayGet(d1).gdel||[]).includes('777')&&(cloud(k1).days[d1].gdel||[]).includes('777')&&!runsOf(d1).some(r=>r.id==='g-777'));
  click('#toast [data-a="undo"]');await wait(500);ok('garmin: undo restores and forgets id',runsOf(d1).some(r=>r.id==='g-777'&&r.g)&&!(dayGet(d1).gdel||[]).length&&!cloud(k1).days[d1].gdel,JSON.stringify(dayGet(d1).gdel));
  // Woche als Text
  got=null;ACT.copyweek({dataset:{ws:weekStart(d1)}});await wait(30);
  ok('garmin: week text lists Garmin-only units',!!got&&got.includes('Indoor-Radfahren\n  Garmin ab 09:43: 40:03 · 21,5 km · Ø-Puls 132')&&got.includes('Krafttraining (nur Garmin, keine Sätze in Sabrly)'),String(got).slice(-700));
  // Sätze in Sabrly → Garmin-Kraft wird der Session zugeordnet
  const e1=dayEnsure(d1);e1.tr=[{id:'s-g1',day:P().id,n:'Push',st:ts0+2*60e3,en:ts0+60*60e3,feel:1,x:[{b:P().blocks[0].id,e:P().blocks[0].e,s:[{k:20,r:8}]}]}];touch(k1);UI.page=null;UI.stack=[];UI.tsel=d1;click('#tab-training');render();await wait(30);
  ok('garmin: strength attached to session',qa('.thero.gah').length===1&&q('.thero.gah h3').textContent==='Indoor-Radfahren'&&qa('.gmeta').some(m=>m.textContent.includes('Ø 115 / max 168')),qa('.gmeta').map(m=>m.textContent).join('|'));
  got=null;ACT.copysess({dataset:{d:d1,id:'s-g1'}});await wait(30);
  ok('garmin: session text has Garmin line',!!got&&got.includes('Garmin ab 15:19: 1:00:04 · Ø-Puls 115 · max 168 · 394 kcal · Trainingseffekt 2,1 / anaerob 1,4')&&got.includes('Zonen Z1 26:04'),String(got));
  ok('garmin: last trainings row shows watch pulse',qa('.swipe .tt').some(b=>b.textContent.includes('⌚ Ø 115')));
  // Ausblenden
  click('.thero.gah [data-a="gahide"]');await wait(500);ok('garmin: hide other unit',!gaOf(d1).some(x=>x.id==='999')&&(cloud(k1).days[d1].gdel||[]).includes('999')&&!q('.thero.gah'));
  // Heute-Seite für diesen Tag
  UI.sel=d1;click('#tab-heute');UI.sel=d1;render();await wait(30);ok('garmin: heute row run',!!qa('.tday').find(r=>r.textContent.includes('Lauf')||r.textContent.includes('Intervalle')));
  // Einstellungen: Status
  click('#tab-training');click('[data-a="tset"]');await wait(20);
  ok('garmin: settings show connected',q('#view').textContent.includes('Verbunden · geprüft vor 5 min')&&q('#view').textContent.includes('Lauf 5,05 km'),q('#view').textContent.slice(-400));
  __store.set('users/u1/data/garmin',{at:new Date().toISOString(),err:'key',n:3,last:[]});__emit({fromCache:false,hasPendingWrites:false});await wait(80);
  ok('garmin: settings show expired key',q('#view').textContent.includes('Schlüssel abgelaufen oder ungültig'));
  click('[data-a="back"]');UI.sel=null;UI.tsel=null;
});
await wait(900);
ok('no JS errors',__errors.length===0,__errors.join(' | '));
ok('state doc size < 100 KB',JSON.stringify(cloud('state')).length<100000,JSON.stringify(cloud('state')).length);
const pre=document.createElement('pre');pre.id='results';pre.textContent=R.join('\n');document.body.appendChild(pre);
})();
