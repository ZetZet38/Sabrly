(async function(){
const R=[];const ok=(n,c,i='')=>R.push((c?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const click=s=>{const el=typeof s==='string'?q(s):s;if(!el)throw new Error('missing '+s);el.click()};
const typeIn=(s,v)=>{const el=q(s);if(!el)throw new Error('missing '+s);el.focus();el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));el.blur()};
const cloud=k=>__store.get('users/u1/data/'+k);
const step=async(name,fn)=>{try{await fn()}catch(e){R.push('FAIL '+name+' :: EXCEPTION '+e.message)}};
await wait(400);
const t=today(),y=addDays(t,-1),tm=addDays(t,1),mk=mkey(t);

await step('boot',async()=>{
  ok('sync cloud',SYNC==='cloud',SYNC);
  ok('migration dayStart 0',S.settings.dayStart===0);
  ok('habits from cloud',S.habits.length===2);
  ok('state is mutable (not frozen)',!Object.isFrozen(S.habits)&&!Object.isFrozen(S.habits[0]));
  ok('day entry mutable',!Object.isFrozen(dayGet(t)));
  ok('title Heute',q('h1').textContent==='Heute');
  ok('no mood X button',!q('[data-a="moodhide"]'));
});
await step('mood',async()=>{
  click('[data-a="mood"][data-v="4"]');await wait(350);
  ok('mood 4 local',dayGet(t).mood===4);
  ok('mood 4 DOM',q('[data-a="mood"][data-v="4"]').classList.contains('on'));
  ok('mood 4 cloud',cloud(mk)?.days?.[t]?.mood===4);
  click('[data-a="mood"][data-v="2"]');await wait(350);
  ok('mood change to 2',dayGet(t).mood===2&&cloud(mk)?.days?.[t]?.mood===2);
});
await step('tagesaufgabe entfernt',async()=>{
  ok('no Tagesaufgabe section',!q('#f-task')&&!qa('#view h2').some(h=>h.textContent==='Tagesaufgabe'));
  ok('old task data kept',dayGet(y)?.task?.text==='Gestern-Aufgabe');
});
await step('rueckblick',async()=>{
  {const card=q('#moodcard');ok('mood + review in one card',card&&card.closest('.sec').querySelector('h2').textContent==='Rückblick'&&card.querySelector('.label').textContent==='Wie war dein Tag?'&&card.querySelectorAll('.mood button').length===5&&card.contains(q('#f-okay'))&&qa('#moodcard').length===1);
   const secs=qa('#view > .sec').map(x=>x.querySelector('h2')?.textContent);ok('Rückblick between Aufgaben and Notizen',secs.indexOf('Rückblick')===secs.indexOf('Notizen')-1&&secs.indexOf('Rückblick')>secs.indexOf('Aufgaben'),secs.join(','))}
  typeIn('#f-okay','Training war gut');await wait(400);
  ok('okay local+cloud',dayGet(t).okay==='Training war gut'&&cloud(mk)?.days?.[t]?.okay==='Training war gut');
});
await step('habit chips + toggle',async()=>{
  click('[data-a="lab"][data-h="h-beten"][data-i="1"]');await wait(50);
  click('[data-a="lab"][data-h="h-beten"][data-i="2"]');await wait(700);
  ok('beten 3 steps',hv(H('h-beten'),t)===3,JSON.stringify(hraw(H('h-beten'),t)));
  ok('beten cloud',(cloud(mk)?.days?.[t]?.h?.['h-beten']||[]).length===3);
  click('[data-a="lab"][data-h="h-beten"][data-i="0"]');await wait(300);
  ok('beten untoggle',hv(H('h-beten'),t)===2);
  click('[data-a="tog"][data-h="h-lesen"]');await wait(700);
  ok('lesen done',isDone(H('h-lesen'),t)&&cloud(mk)?.days?.[t]?.h?.['h-lesen']===1);
});
let newH;
await step('habit anlegen',async()=>{
  click('#tab-habits');click('[data-a="hnew"]');
  ok('form open',UI.page?.t==='hform'&&!!q('#h-name'));
  typeIn('#h-name','Training Test');
  for(const i of [1,3,5,6])click(`[data-a="hday"][data-i="${i}"]`);
  ok('days picked',JSON.stringify(UI.page.days)==='[0,2,4]',JSON.stringify(UI.page.days));
  ok('name survives rerender',q('#h-name').value==='Training Test');
  typeIn('#h-time','18:00');
  click('.ptopbar [data-a="hsave"]');await wait(400);
  newH=S.habits.find(x=>x.name==='Training Test');
  ok('habit created',!!newH);
  ok('habit days/time',newH&&JSON.stringify(newH.days)==='[0,2,4]'&&newH.time==='18:00');
  ok('habit in cloud',!!cloud('state').habits.find(x=>x.name==='Training Test'));
  ok('back to list',UI.page===null&&UI.tab==='habits');
  // bottom button too
  click('[data-a="hnew"]');click('[data-a="tpl"][data-i="1"]');click('.btn.pri[data-a="hsave"]');await wait(350);
  ok('template habit via bottom button',!!S.habits.find(x=>x.name==='Quran lesen'));
  // validation
  click('[data-a="hnew"]');click('.ptopbar [data-a="hsave"]');
  ok('empty name blocked',UI.page?.t==='hform'&&!q('#toast').hidden);
  click('[data-a="back"]');
});
await step('habit bearbeiten',async()=>{
  click(`[data-a="heditq"][data-h="${newH.id}"]`);
  ok('edit form',UI.page?.id===newH.id&&q('#h-name').value==='Training Test');
  typeIn('#h-name','Training');click('.ptopbar [data-a="hsave"]');await wait(350);
  ok('renamed',H(newH.id).name==='Training'&&cloud('state').habits.find(x=>x.id===newH.id)?.name==='Training');
});
await step('archiv + undo, löschen + undo',async()=>{
  click(`[data-a="harchq"][data-h="${newH.id}"]`);await wait(700);
  ok('archived',H(newH.id).archived===true&&cloud('state').habits.find(x=>x.id===newH.id)?.archived===true);
  click('#toast [data-a="undo"]');await wait(300);
  ok('unarchived',H(newH.id).archived===false);
  const n=S.habits.length;
  click(`[data-a="hdelq"][data-h="${newH.id}"]`);await wait(700);
  ok('deleted',!H(newH.id)&&S.habits.length===n-1&&!cloud('state').habits.find(x=>x.id===newH.id));
  click('#toast [data-a="undo"]');await wait(700);
  ok('restored',!!H(newH.id)&&!!cloud('state').habits.find(x=>x.id===newH.id));
});
await step('habit detail + kalender',async()=>{
  click(`[data-a="hopen"][data-h="h-lesen"]`);
  ok('detail page',UI.page?.t==='habit'&&qa('[data-a="calday"]').length>0);
  click(`[data-a="calday"][data-h="h-lesen"][data-d="${y}"]`);await wait(350);
  ok('yesterday marked',isDone(H('h-lesen'),y));
  ok('streak 2',streak(H('h-lesen'))===2,String(streak(H('h-lesen'))));
  ok('future not tappable',!q(`[data-a="calday"][data-d="${tm}"]`));
  click('[data-a="back"]');ok('back',UI.page===null);
});
let todoId;
await step('aufgaben',async()=>{
  click('#tab-aufgaben');ok('no prio icons',!q('.prio .pic'));
  click('.sec-h [data-a="tnew"]');typeIn('#t-title','Reifen abholen');click('[data-a="tdue"][data-v="0"]');
  ok('due set + title kept',UI.page.due===t&&q('#t-title').value==='Reifen abholen');
  typeIn('#t-time','17:30');click('[data-a="tprio"][data-p="h"]');
  ok('time kept after prio',q('#t-time').value==='17:30');
  click('.ptopbar [data-a="tsave"]');await wait(350);
  const x=S.todos.find(q=>q.title==='Reifen abholen');todoId=x&&x.id;
  ok('todo created',!!x&&x.due===t&&x.time==='17:30'&&x.prio==='h');
  ok('todo cloud',!!cloud('state').todos.find(q=>q.title==='Reifen abholen'));
  click(`[data-a="tdone"][data-id="${todoId}"]`);await wait(700);
  ok('todo done',S.todos.find(q=>q.id===todoId).done===true&&cloud('state').todos.find(q=>q.id===todoId).done===true);
  click(`[data-a="tdone"][data-id="t-old"]`);await wait(300);
  ok('old frozen todo tickable',S.todos.find(q=>q.id==='t-old').done===true);
  ACT.tdone({dataset:{id:'t-old'}});await wait(300);ok('old todo reopened',S.todos.find(q=>q.id==='t-old').done===false);
  click(`[data-a="tdelq"][data-id="t-old"]`);await wait(300);
  ok('todo deleted',!S.todos.find(q=>q.id==='t-old'));
  click('#toast [data-a="undo"]');await wait(300);ok('todo restored',!!S.todos.find(q=>q.id==='t-old'));
  click(`[data-a="tedit"][data-id="t-old"]`);typeIn('#t-title','Alte Aufgabe neu');click('.ptopbar [data-a="tsave"]');await wait(300);
  ok('todo edited',S.todos.find(q=>q.id==='t-old').title==='Alte Aufgabe neu');
});
await step('zukunft',async()=>{
  click('#tab-heute');ACT.sel({dataset:{d:tm}});render(); // tomorrow may be in next week's strip (Sunday)
  ok('tomorrow selected',curSel()===tm&&q('h1').textContent==='Morgen');
  ok('future note',!!q('.futnote'));
  ok('no mood in future',!q('[data-a="mood"]'));
  ok('habit controls disabled',qa('.hrow button').every(b=>b.disabled));
  ACT.tog({dataset:{h:'h-lesen',d:tm}});await wait(200);
  ok('future tick blocked',!isDone(H('h-lesen'),tm));
  click('.addrow[data-a="tnew"]');ok('todo form prefilled with tomorrow',UI.page?.due===tm);
  typeIn('#t-title','Arzt anrufen');click('.ptopbar [data-a="tsave"]');await wait(300);
  ok('back on tomorrow',curSel()===tm&&UI.page===null);
  const row=qa('.todo').find(r=>r.textContent.includes('Arzt anrufen'));
  ok('future todo shown, check disabled',!!row&&row.querySelector('[data-a="tdone"]').disabled);
  ACT.wk({dataset:{dir:1}});ok('week forward',curSel()===addDays(tm,7));
  ACT.wk({dataset:{dir:1}});ok('two weeks forward',curSel()===addDays(tm,14));
  click(`[data-a="sel"][data-d="${addDays(tm,14)}"]`);
  click('.link[data-a="sel"]');ok('back to today',curSel()===t&&UI.sel===null);
  click('[data-a="dstep"][data-dir="1"]');ok('arrow → next day',curSel()===tm&&q('h1').textContent==='Morgen');
  click('[data-a="dstep"][data-dir="-1"]');click('[data-a="dstep"][data-dir="-1"]');ok('arrow ← previous day',curSel()===addDays(t,-1)&&q('h1').textContent==='Gestern');
  click('[data-a="dstep"][data-dir="1"]');ok('arrow back to today',curSel()===t&&UI.sel===null&&!q('[data-a="wk"]'));
  ok('no planning hint / no 2-min pill',!q('#view').textContent.includes('Für morgen planen')&&!qa('#view .pill').some(p=>p.textContent.includes('2-Minuten')));
});
await step('vergangenheit',async()=>{
  ACT.wk({dataset:{dir:-1}});ok('week back',curSel()===addDays(t,-7));
  ACT.sel({dataset:{d:y}});
  ok('yesterday shows rückblick',q('#f-okay').value==='War okay');
  click(`[data-a="mood"][data-v="5"]`);await wait(300);
  ok('past mood set',dayGet(y).mood===5&&cloud(mkey(y))?.days?.[y]?.mood===5);
  ok('past task text kept',dayGet(y).task.text==='Gestern-Aufgabe');
  ACT.sel({dataset:{d:t}});
});
await step('tagesablauf + plan',async()=>{
  click('#tab-mehr');const dn=DN[wd(t)];
  ok('Wochenplan + Gebet folded by default',!q('#f-plan')&&!q('[data-a="pbuf"]')&&q('[data-a="fold"][data-k="w"]').getAttribute('aria-expanded')==='false'&&!!q('[data-a="fold"][data-k="g"]'));
  click('[data-a="fold"][data-k="w"]');ok('Wochenplan unfolds',!!q('#f-plan'));
  typeIn('#f-plan',`${dn}: 06:00 Fajr in der Moschee; 21:00 Lesen\n${DN[(wd(t)+1)%7]}\n- 16:30 Unterricht`);
  click('[data-a="planapply"]');await wait(300);
  ok('plan parsed',(S.plan.days[wd(t)]||[]).length===2&&(S.plan.days[(wd(t)+1)%7]||[]).length===1);
  ok('plan cloud',(cloud('state').plan.days[wd(t)]||[]).length===2);
  click('#tab-heute');const items=qa('.tl-item');
  {const secs=qa('#view > .sec'),ti=secs.findIndex(x=>x.querySelector('.tl')),ni=secs.findIndex(x=>x.querySelector('#nlist'));ok('Tagesablauf below Notizen',ti>ni&&ni>=0&&secs[secs.length-1]===secs[ti],ti+' '+ni)}
  const expT=['06:00','17:30','21:00',...active(t).filter(h=>h.time).map(h=>h.time)].sort();
  ok('timeline items',items.length===expT.length,items.length+' vs '+expT.length);
  ok('timeline sorted',items.map(i=>i.querySelector('.t').textContent).join(',')===expT.join(','),items.map(i=>i.querySelector('.t').textContent).join(','));
  click('.tl-item [data-a="ptick"][data-i="0"]');await wait(700);
  ok('plan tick',(dayGet(t).p||[]).includes(0)&&(cloud(mk).days[t].p||[]).includes(0));
  // habit with time on its weekday shows in timeline
  H(newH.id).days=[wd(t)];touch('state');render();
  ok('timed habit in timeline',qa('.tl-item').some(i=>i.textContent.includes('Training')));
  click(`.tl-item [data-a="hstep"][data-h="${newH.id}"]`);await wait(300);
  ok('timed habit tick from timeline',isDone(H(newH.id),t));
});
await step('wochentage-logik',async()=>{
  const x=H(newH.id);x.days=[(wd(t)+1)%7];x.created=addDays(t,-30);
  ok('not scheduled today',!active(t).includes(x)&&active(tm).includes(x));
  const prev=addDays(tm,-7);dayEnsure(prev).h??={};dayEnsure(prev).h[x.id]=1;
  ok('streak skips off days',streak(x)===1,String(streak(x)));
});
await step('statistik',async()=>{
  click('#tab-habits');click('[data-a="hseg"][data-v="s"]');
  ok('7 bars',qa('.bcol').length===7);
  ok('calendar days',qa('.mcell[data-a="openday"]').length>=28);
  ok('no tagebuch/emoji list',!q('.jentry')&&!q('#view').textContent.includes('Tippen zum Bearbeiten'));
  const bar=qa('.bcol').find(b=>b.dataset.d===t);ok('today bar has height',parseFloat(bar.querySelector('i').style.height)>0);
  click('[data-a="statw"][data-dir="-1"]');ok('week back in stats',UI.statW===addDays(weekStart(t),-7));
  click('[data-a="statw"][data-dir="1"]');
  click('[data-a="statm"][data-dir="1"]');ok('next month allowed',qa('.mcell.fut').length>0);
  click('[data-a="statm"][data-dir="-1"]');
  click(`.mcell[data-a="openday"][data-d="${y}"]`);
  ok('calendar opens day',UI.tab==='heute'&&curSel()===y&&q('#f-okay').value==='War okay');
  click(`[data-a="sel"][data-d="${t}"]`);
  click('#tab-habits');click('[data-a="hseg"][data-v="s"]');click(`.hstat[data-a="hopen"][data-h="h-beten"]`);ok('habit from stats',UI.page?.id==='h-beten');click('[data-a="back"]');
});
await step('anderes gerät',async()=>{
  await wait(900);ok('idle before remote',pendingKeys().length===0,pendingKeys().join(','));
  const st=JSON.parse(JSON.stringify(cloud('state')));st.todos.push({id:'t-remote',title:'Vom iPad',prio:'l',due:null,done:false});
  __store.set('users/u1/data/state',st);__emit({fromCache:false,hasPendingWrites:false});await wait(100);
  ok('remote change applied',!!S.todos.find(x=>x.id==='t-remote'));
  click('#tab-aufgaben');click('[data-a="tdone"][data-id="t-remote"]');await wait(700);
  ok('remote todo tickable',S.todos.find(x=>x.id==='t-remote').done===true&&cloud('state').todos.find(x=>x.id==='t-remote').done===true);
});
await step('swipe',async()=>{
  click('#tab-habits');const row=q('.swipe'),front=row.querySelector('.swipe-front');const r=front.getBoundingClientRect(),yy=r.top+r.height/2;
  const pe=(type,x)=>front.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:7,clientX:x,clientY:yy,pointerType:'touch'}));
  pe('pointerdown',r.right-20);pe('pointermove',r.right-60);pe('pointermove',r.right-200);pe('pointerup',r.right-200);
  ok('swipe opens actions',row.classList.contains('open'));
  await wait(350);document.querySelector('h1').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:8,clientX:10,clientY:10}));
  ok('tap outside closes',!row.classList.contains('open'));
  await wait(300);
  pe('pointerdown',r.right-20);pe('pointermove',r.right-200);pe('pointerup',r.right-200);
  front.firstElementChild.click();await wait(10);ok('click right after swipe swallowed',UI.page===null&&row.classList.contains('open'));
  await wait(350);
  click(row.querySelector('[data-a="heditq"]'));ok('swipe action edit opens form',UI.page?.t==='hform');click('[data-a="back"]');
  // tap on card (no swipe) opens detail
  await wait(350);click(q('.hcard'));ok('tap card opens detail',UI.page?.t==='habit');click('[data-a="back"]');
});
await step('mehr',async()=>{
  click('#tab-mehr');click('[data-a="ds"][data-dir="1"]');await wait(250);ok('daystart 1',S.settings.dayStart===1);
  click('[data-a="ds"][data-dir="-1"]');ok('daystart 0',S.settings.dayStart===0);
  click('[data-a="copy"]');await wait(200);ok('backup action ok',!!q('#f-bk')&&q('#f-bk').value.includes('"app":"sabrly"'));
});
await step('v5 neu',async()=>{
  click('#tab-heute');const t=today(),mk=mkey(t);
  // mood toggle off
  const cur=dayGet(t).mood;click(`[data-a="mood"][data-v="${cur}"]`);await wait(700);
  ok('mood deselect',!dayGet(t).mood&&!cloud(mk).days[t].mood);
  click('[data-a="mood"][data-v="3"]');await wait(300);ok('mood reselect',dayGet(t).mood===3);
  // notes
  const ni=q('#f-note');ok('notes field exists',!!ni);
  ni.focus();ni.value='Erster Punkt';ni.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  ok('note added via enter, field cleared, still focused',q('#f-note').value===''&&document.activeElement===q('#f-note')&&qa('#nlist li').length===1);
  ni.value='Zweiter Punkt';click('[data-a="nadd"]');await wait(700);
  ok('two notes local+cloud',(dayGet(t).n||[]).length===2&&(cloud(mk).days[t].n||[]).length===2);
  render();ok('notes persist after render',qa('#nlist li').length===2&&q('#nlist').textContent.includes('Zweiter Punkt'));
  const nid=dayGet(t).n[0].id;click(`[data-a="ndel"][data-id="${nid}"]`);await wait(700);
  ok('note deleted',(dayGet(t).n||[]).length===1&&cloud(mk).days[t].n.length===1);
  click('#toast [data-a="undo"]');await wait(700);ok('note restored',(dayGet(t).n||[]).length===2&&dayGet(t).n[0].id===nid);
  ACT.sel({dataset:{d:tm}});q('#f-note').value='Für morgen';click('[data-a="nadd"]');await wait(400);
  ok('note on future day',(dayGet(tm).n||[])[0]?.t==='Für morgen');ACT.sel({dataset:{d:t}});
  // add-row only when no tasks
  ok('today has tasks → no addrow',dayTodos(t).length>0&&!q('.addrow[data-a="tnew"]')&&!!q('.mini[data-a="tnew"]'));
  click('.mini[data-a="tnew"]');ok('mini + opens form',UI.page?.t==='tform');click('[data-a="back"]');
  ACT.sel({dataset:{d:addDays(t,10)}});ok('empty day → addrow',!!q('.addrow[data-a="tnew"]')&&!q('.mini[data-a="tnew"]'));ACT.sel({dataset:{d:t}});
  // custom emoji
  click('#tab-habits');click('[data-a="hnew"]');typeIn('#h-name','Eigenes Emoji');
  const ei=q('#h-emo');ei.focus();ei.value='🦁';ei.dispatchEvent(new Event('input',{bubbles:true}));
  ok('custom emoji set',UI.page.emoji==='🦁'&&q('#emo-prev').textContent==='🦁');
  ei.value='🦁🐺';ei.dispatchEvent(new Event('input',{bubbles:true}));ok('last emoji wins',UI.page.emoji==='🐺'&&ei.value==='🐺');
  ei.value='👨‍👩‍👧';ei.dispatchEvent(new Event('input',{bubbles:true}));ok('zwj emoji kept whole',UI.page.emoji==='👨‍👩‍👧',UI.page.emoji);
  click('[data-a="freq"][data-v="weekly"]');ok('emoji survives rerender',UI.page.emoji==='👨‍👩‍👧'&&q('#emo-prev').textContent==='👨‍👩‍👧');
  click('.ptopbar [data-a="hsave"]');await wait(400);
  ok('habit with custom emoji saved',S.habits.find(x=>x.name==='Eigenes Emoji')?.emoji==='👨‍👩‍👧');
  // names
  click('#tab-mehr');ok('personal section on top',q('#view .sec h2').textContent==='Persönlich');
  ok('no tracker name field',!q('#s-tname'));
  click('#tab-heute');ok('no eyebrow without name',!q('.eyebrow'));
  click('#tab-mehr');typeIn('#s-name','Zeynel');await wait(500);
  ok('name saved',S.settings.userName==='Zeynel'&&cloud('state').settings.userName==='Zeynel');
  click('#tab-heute');ok('eyebrow greets by name only',q('.eyebrow').textContent.includes('Zeynel')&&!q('.eyebrow').textContent.includes('Tageswerk'));
  // toast duration
  const t0=Date.now();toast('x',()=>{});await wait(3300);ok('undo toast hides after ~3s',q('#toast').hidden);
  ok('background layer present',!!q('.bgfx'));
});
await step('v6 neu',async()=>{
  click('#tab-heute');const cs=el=>parseFloat(getComputedStyle(el).fontSize);
  const h2=qa('.sec>.sec-h h2')[0];ok('section headings bigger',cs(h2)>=28,String(cs(h2)));
  ok('all inputs >=16px (no zoom)',qa('#view input').every(i=>cs(i)>=16),qa('#view input').map(cs).join(','));
  ok('Heute: habit names prominent',cs(q('.hl .hname'))>=17&&getComputedStyle(q('.hl .hname')).fontWeight>=700,String(cs(q('.hl .hname'))));
  ok('Heute: todo titles prominent',!q('.hl .todo .tt b')||cs(q('.hl .todo .tt b'))>=16.5,q('.hl .todo .tt b')?String(cs(q('.hl .todo .tt b'))):'none');
  ok('Heute: inputs still >=16px',qa('#view input').every(i=>cs(i)>=16));
  ok('habits + in header',!!q('.sec-h .mini[data-a="hnew"]'));
  click('.sec-h .mini[data-a="hnew"]');ok('habit + opens form',UI.page?.t==='hform');click('[data-a="back"]');ok('back to heute',UI.page===null&&UI.tab==='heute');
  let n=0;const orig=window.haptic;window.haptic=()=>{n++};
  click('[data-a="mood"][data-v="2"]');click(`[data-a="tog"][data-h="h-lesen"]`);await wait(50);
  ok('haptic fires on taps',n>=2,String(n));window.haptic=orig;
  haptic();ok('haptic runs without error',__errors.length===0);
});
await step('v7 sätze & situationen',async()=>{
  click('#tab-heute');const t=today();
  ok('no quote without entries',S.quotes.length===0&&!q('.quote'));
  // situation: both habits missed yesterday and day before → red box with default sentence
  let b=q('.banner');ok('one situation box',qa('.banner').length===1&&b.classList.contains('sit')&&parseFloat(getComputedStyle(b).fontSize)<15);
  ok('missed2 red with default sentence',b&&b.classList.contains('crit')&&b.querySelector('.bs').textContent===SIT_DEF.missed2.def,b&&b.outerHTML.slice(0,160));
  // Mehr: quotes
  click('#tab-mehr');const hs=qa('#view .sec h2').map(h=>h.textContent);
  ok('Mehr order',hs.slice(0,6).join('|')==='Persönlich|Ansicht|Gebet|Sätze & Verse|Situations-Sätze|Wochenplan',hs.join('|'));
  ok('quotes + situations folded by default',!q('#q-text')&&!q('#sit-missed2')&&q('[data-a="fold"][data-k="q"]').getAttribute('aria-expanded')==='false');
  click('[data-a="fold"][data-k="q"]');click('[data-a="fold"][data-k="s"]');
  ok('unfold shows both',!!q('#q-text')&&!!q('#sit-missed2')&&q('[data-a="fold"][data-k="q"]').getAttribute('aria-expanded')==='true');
  ok('fold remembered',JSON.parse(localStorage.getItem('sabrly-fold')).q===true);
  click('[data-a="fold"][data-k="q"]');ok('fold closes',!q('#q-text'));click('[data-a="fold"][data-k="q"]');
  click('[data-a="qsug"][data-i="1"]');await wait(500);
  ok('suggestion added',S.quotes.length===1&&S.quotes[0].t==='Allah ist der beste Planer.'&&cloud('state').quotes.length===1);
  ok('suggestion gone from list',!q('[data-a="qsug"][data-i="1"]'));
  typeIn('#q-text','Erst die Gebete, dann der Rest.');click('[data-a="qadd"]');await wait(300);
  ok('own satz added',S.quotes.some(x=>x.t==='Erst die Gebete, dann der Rest.'&&x.type==='satz'));
  click('[data-a="qtype"][data-v="vers"]');ok('vers mode shows source',!!q('#q-src'));
  typeIn('#q-text','Wahrlich, mit der Erschwernis kommt Erleichterung.');typeIn('#q-src','Sure 94:6');
  click('[data-a="qtype"][data-v="vers"]');ok('draft survives rerender',q('#q-text').value.startsWith('Wahrlich')&&q('#q-src').value==='Sure 94:6');
  const qt=q('#q-text');qt.focus();qt.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await wait(400);
  const v=S.quotes.find(x=>x.type==='vers');ok('vers added via enter with source',!!v&&v.src==='Sure 94:6'&&cloud('state').quotes.length===3);
  ok('empty add blocked',(()=>{const n=S.quotes.length;ACT.qadd();return S.quotes.length===n})());
  // Heute shows quote
  click('#tab-heute');const qb=q('.quote');ok('quote shown on Heute',!!qb&&S.quotes.some(x=>qb.textContent.includes(x.t)));
  const first=qb.querySelector('.qt').textContent;click('.quote');const second=q('.quote .qt').textContent;
  ok('title row, then quote',q('.weekbar').nextElementSibling===q('.titlebar')&&q('.titlebar').nextElementSibling===q('.quote'));
  ok('title row is small',parseFloat(getComputedStyle(q('.titlebar h1')).fontSize)<=19&&q('.titlebar .sub').textContent===DL[wd(t)]+', '+pdate(t).getDate()+'. '+MN[pdate(t).getMonth()]);
  ok('quote label',/^(Vers|Satz) des Tages$/.test(q('.quote .qh-lab').textContent)&&(q('.quote').classList.contains('vers')===(q('.quote .qh-lab').textContent.startsWith('Vers'))));
  ok('tap shows next',first!==second);click('.quote');click('.quote');ok('cycles back',q('.quote .qt').textContent===first);
  ok('vers source shown with dash',(()=>{const v=S.quotes.find(x=>x.type==='vers');for(let i=0;i<S.quotes.length;i++){if(q('.quote .qt').textContent===v.t)return q('.quote .qs').textContent==='— Sure 94:6';click('.quote')}return false})());
  for(let i=0;i<3;i++){if(q('.quote').classList.contains('vers'))break;click('.quote')}
  ok('vers shows source',q('.quote').classList.contains('vers')&&q('.quote .qs').textContent==='— Sure 94:6');
  ok('same quote for same day',pickQuote('2026-12-01')===pickQuote('2026-12-01'));
  // delete + undo
  click('#tab-mehr');const did=S.quotes[0].id;click(`[data-a="qdel"][data-id="${did}"]`);await wait(500);
  ok('quote deleted',!S.quotes.find(x=>x.id===did)&&!cloud('state').quotes.find(x=>x.id===did));
  click('#toast [data-a="undo"]');await wait(500);ok('quote restored',!!S.quotes.find(x=>x.id===did));
  // situation texts
  typeIn('#sit-missed2','Bismillah. Klein anfangen.');await wait(500);
  ok('custom sit saved',S.settings.sit.txt.missed2==='Bismillah. Klein anfangen.'&&cloud('state').settings.sit.txt.missed2==='Bismillah. Klein anfangen.');
  click('#tab-heute');ok('custom sentence shown',q('.banner .bs').textContent==='Bismillah. Klein anfangen.');
  click('#tab-mehr');typeIn('#sit-missed2','');await wait(400);ok('empty → default',!S.settings.sit.txt.missed2&&sitText('missed2')===SIT_DEF.missed2.def);
  click('[data-a="sitoggle"]');await wait(400);ok('toggle off saved',S.settings.sit.on===false&&cloud('state').settings.sit.on===false);
  click('#tab-heute');b=q('.banner');ok('off: missed info stays, no sentence',!!b&&b.classList.contains('crit')&&!b.querySelector('.bs'));
  // fill yesterday + day before → other situations
  const y2=addDays(t,-2);for(const x of active(addDays(t,-1)))if(x.freq==='daily'){for(const d of [addDays(t,-1),y2]){const e=dayEnsure(d);e.h??={};e.h[x.id]=fullVal(x);touch(mkey(d))}}render();
  ok('off: no other situation boxes',!q('.banner'));
  click('#tab-mehr');click('[data-a="sitoggle"]');await wait(300);click('#tab-heute');
  ok('missed gone after catching up',!q('.banner')||!['missed1','missed2'].includes(q('.banner').dataset.sit));
  const ogH=Date.prototype.getHours;
  const saveT=clone(dayGet(t).h||{});dayEnsure(t).h={};touch(mkey(t));
  Date.prototype.getHours=function(){return 8};render();ok('morning box',q('.banner')?.dataset.sit==='morning'&&q('.banner .bs').textContent===SIT_DEF.morning.def,q('.banner')?.dataset.sit);
  Date.prototype.getHours=function(){return 20};render();ok('evening box with count',q('.banner')?.dataset.sit==='evening'&&/Noch \d+ Habits? offen/.test(q('.banner').textContent),q('.banner')?.textContent);
  Date.prototype.getHours=function(){return 14};render();ok('afternoon: no box',!q('.banner'));
  Date.prototype.getHours=ogH;dayEnsure(t).h=saveT;touch(mkey(t));render();
  // all done → done or best (green)
  for(const x of active(t))if(x.freq==='daily'){const e=dayEnsure(t);e.h??={};e.h[x.id]=fullVal(x);touch(mkey(t))}render();
  const g=q('.banner');ok('all done → green box',!!g&&g.classList.contains('good'),g&&g.dataset.sit);
  // force best streak: 4-day streak on a fresh habit
  const hb=normHabit({id:'h-bs',name:'Serie',freq:'daily',target:1,created:addDays(t,-3)});S.habits.push(hb);for(let i=0;i<4;i++){const e=dayEnsure(addDays(t,-i));e.h??={};e.h['h-bs']=1;touch(mkey(addDays(t,-i)))}touch('state');render();
  ok('best streak box',q('.banner')?.dataset.sit==='best'&&q('.banner').textContent.includes('4 Tage Serie'),q('.banner')?.textContent);
  S.habits=S.habits.filter(x=>x.id!=='h-bs');touch('state');render();
  ok('only one box ever',qa('.banner').length<=1);
  // habits page sizes
  click('#tab-habits');const cs=el=>parseFloat(getComputedStyle(el).fontSize);
  ok('habit card name bigger',cs(q('.hcard .hname'))>=18,String(cs(q('.hcard .hname'))));
  ok('habit card number smaller',cs(q('.hcard .bignum'))<=24,String(cs(q('.hcard .bignum'))));
  ok('all inputs >=16px on Mehr',(()=>{click('#tab-mehr');return qa('#view input').every(i=>cs(i)>=16)})());
});
await step('altes Tageswerk-Backup',async()=>{
  click('#tab-mehr');click('[data-a="impopen"]');
  const old={app:'tageswerk',v:3,state:{...clone(S),todos:[...clone(S.todos),{id:'t-imp',title:'Aus altem Backup',prio:'n',due:null,done:false}]},logs:clone(LOGS)};
  q('#f-imp').value=JSON.stringify(old);click('[data-a="impdo"]');click('[data-a="impdo"]');await wait(600);
  ok('old Tageswerk backup imports',S.todos.some(x=>x.id==='t-imp')&&cloud('state').todos.some(x=>x.id==='t-imp'));
  q('#f-imp')&&(q('#f-imp').value='{"app":"andere","state":{}}');
});

await step('gebet',async()=>{
  const at=(h,m,off=0)=>()=>pdate(addDays(t,off)).getTime()+(h*60+m)*60000;
  // Beten-Habit mit 5 Teilen, Testzeiten für gestern, heute, morgen
  let x=S.habits.find(h=>h.labels&&h.labels.length===5);
  if(!x){x={id:'h-bet',name:'Beten',emoji:'🤲',freq:'daily',target:5,labels:['Fajr','Dhuhr','Asr','Maghrib','Isha'],days:[0,1,2,3,4,5,6],time:'',created:addDays(t,-5),archived:false,order:-1};S.habits.unshift(x);touch('state')}
  const T0='050007001200143017001830';
  PT[99999]={id:99999,name:'Teststadt',days:{[addDays(t,-1)]:T0,[t]:T0,[addDays(t,1)]:'050107011200142917001829'}};
  const P=PS();P.on=true;P.since=addDays(t,-2);P.city={id:99999,name:'Teststadt'};P.travel=null;P.buf=30;touch('state');
  for(const d of [addDays(t,-1),t,addDays(t,1)]){const e=dayEnsure(d);if(e.h)delete e.h[x.id];delete e.pt;delete e.pe;delete e.pz;delete e.pc;touch(mkey(d))}
  if(!scheduled(x,t)||x.created>addDays(t,-1)){x.days=[0,1,2,3,4,5,6];x.created=addDays(t,-5);touch('state')}
  // Kurven
  const z=pzParse(T0+'|0501');
  ok('pz parse',z.F===300&&z.S===420&&z.D===720&&z.A===870&&z.M===1020&&z.I===1110&&z.F2===1741,JSON.stringify(z));
  const sc=(i,m)=>pScore(z,i,m,30);
  ok('Fajr: start 50, best window 100, last 10 min down to 20, after 10',sc(0,299)===null&&sc(0,300)===50&&sc(0,340)===75&&sc(0,380)===100&&sc(0,409)===100&&sc(0,415)===60&&sc(0,420)===10,[sc(0,300),sc(0,340),sc(0,380),sc(0,415),sc(0,420)].join());
  ok('Dhuhr 100 → 20, then 10',sc(1,719)===null&&sc(1,720)===100&&sc(1,795)===60&&sc(1,869)===21&&sc(1,870)===10);
  ok('Asr ends 30 min before Maghrib',sc(2,870)===100&&sc(2,930)===60&&sc(2,989)===21&&sc(2,990)===10&&sc(2,1030)===10);
  ok('Maghrib 100 → 20',sc(3,1020)===100&&sc(3,1065)===60&&sc(3,1110)===10);
  ok('Isha → 20 at midnight, 20 until last third, then 10',sc(4,1110)===100&&sc(4,1380)===20&&sc(4,1400)===20&&sc(4,1500)===20&&sc(4,1501)===10&&sc(4,1745)===10,[sc(4,1380),sc(4,1500),sc(4,1501)].join());
  // gesperrt vor Beginn
  window.__now=at(4,0);click('#tab-heute');render();
  const chip=i=>q(`.chip[data-h="${x.id}"][data-d="${t}"][data-i="${i}"]`);
  ok('chips locked before start',chip(0).disabled&&chip(0).classList.contains('plock')&&chip(4).disabled,chip(0)&&chip(0).outerHTML.slice(0,140));
  ok('status before Fajr',q('.pstat').textContent==='Fajr ab 05:00',q('.pstat')&&q('.pstat').textContent);
  ACT.lab(chip(0));ok('locked tick blocked',!labelsOf(hraw(x,t)).includes(0)&&q('#toast').textContent.includes('beginnt um 05:00'));
  // abhaken mit Uhrzeit
  window.__now=at(5,40);render();
  ok('status best time',q('.pstat').textContent==='Fajr · beste Zeit ab 06:20',q('.pstat').textContent);
  click(chip(0));await wait(800);
  ok('Fajr ticked with time',labelsOf(hraw(x,t)).includes(0)&&dayGet(t).pt[0]===340&&dayGet(t).pz===T0+'|0501'&&dayGet(t).pc===99999,JSON.stringify(dayGet(t)));
  ok('time saved to cloud',cloud(mk).days[t].pt[0]===340&&cloud(mk).days[t].pz===T0+'|0501');
  ok('chip score bar 75',chip(0).querySelector('.pb').style.width==='75%');
  ok('gold ring',!!q('.weekbar .ring.hasg .gring')&&q('.ring.hasg').title==='Gebets-Pünktlichkeit 75 %',q('.ring')&&q('.ring').outerHTML.slice(0,200));
  ok('subtitle punctuality',q(`.hrow .hname small`)&&[...qa('.hrow .hname small')].some(e=>e.textContent.includes('Pünktlich 75 %')));
  window.__now=at(13,0);render();
  ok('status Dhuhr countdown',q('.pstat').textContent==='Dhuhr · noch 1:30 h',q('.pstat').textContent);
  ok('avg ignores running prayer',Math.round(prayerDay(t).avg*100)===75);
  window.__now=at(15,0);render();
  ok('missed Dhuhr counts 0, chip marked',Math.round(prayerDay(t).avg*100)===38&&chip(1).classList.contains('pmiss'),String(prayerDay(t).avg));
  click(chip(1));await wait(300);ok('late Dhuhr = 10',dayGet(t).pt[1]===900&&prayerDay(t).items[1].sc===10);
  click(chip(1));await wait(300);ok('untick removes time',!labelsOf(hraw(x,t)).includes(1)&&!(dayGet(t).pt&&1 in dayGet(t).pt));
  // Uhrzeit ändern (lange drücken)
  const c1=chip(1);c1.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:5,clientY:5}));await wait(650);
  ok('long press opens time page',UI.page&&UI.page.t==='ptime'&&UI.page.i===1,JSON.stringify(UI.page));
  c1.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));c1.click();ok('click after long press swallowed',UI.page&&UI.page.t==='ptime');await wait(450);
  typeIn('#pt-time','12:10');ok('preview',q('#pt-prev').textContent==='95 %',q('#pt-prev').textContent);
  typeIn('#pt-time','11:50');click('[data-a="ptsave"]');ok('before start refused',UI.page&&UI.page.t==='ptime'&&q('#toast').textContent.includes('beginnt erst'));
  typeIn('#pt-time','16:00');click('[data-a="ptsave"]');ok('future refused',UI.page&&q('#toast').textContent.includes('Zukunft'));
  typeIn('#pt-time','12:10');click('[data-a="ptsave"]');await wait(800);
  ok('edited time saved + marked',!UI.page&&dayGet(t).pt[1]===730&&dayGet(t).pe[1]===true&&labelsOf(hraw(x,t)).includes(1)&&cloud(mk).days[t].pe[1]===true);
  ok('edit mark on chip',!!chip(1).querySelector('.pe'));
  click(chip(1));await wait(300);ok('untick clears edit mark',!(dayGet(t).pe&&dayGet(t).pe[1]));
  // In der Moschee (lange drücken → Schalter)
  const lpress=async c=>{c.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:5,clientY:5}));await wait(650);c.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));await wait(450)};
  await lpress(chip(0));ok('mosque switch on time page, off',UI.page&&UI.page.t==='ptime'&&!!q('#pt-mosq')&&!q('#pt-mosq').classList.contains('on'));
  const pv0=q('#pt-prev').textContent;click('#pt-mosq');ok('mosque switch toggles, preview 100 %',UI.page.pm===true&&q('#pt-mosq').classList.contains('on')&&pv0==='75 %'&&q('#pt-prev').textContent==='100 %',pv0+' '+q('#pt-prev').textContent);
  click('[data-a="ptsave"]');await wait(800);
  ok('Fajr mosque saved, time untouched',!UI.page&&dayGet(t).pm[0]===true&&dayGet(t).pt[0]===340&&!(dayGet(t).pe&&dayGet(t).pe[0])&&cloud(mk).days[t].pm[0]===true,JSON.stringify(dayGet(t)));
  ok('mosque icon on chip',!!chip(0).querySelector('.pm')&&chip(0).getAttribute('aria-label').includes('Moschee')&&!chip(1).querySelector('.pm'));
  ok('mosque = 100 %',prayerDay(t).items[0].sc===100&&prayerDay(t).items[0].pm===true&&chip(0).querySelector('.pb').style.width==='100%');
  await lpress(chip(2));ok('Asr page, switch off',UI.page&&UI.page.i===2&&!UI.page.pm);
  click('#pt-mosq');click('[data-a="ptsave"]');await wait(800);
  ok('Asr ticked now in mosque, no edit mark',labelsOf(hraw(x,t)).includes(2)&&dayGet(t).pt[2]===900&&dayGet(t).pm[2]===true&&!(dayGet(t).pe&&dayGet(t).pe[2]),JSON.stringify(dayGet(t)));
  ok('week review counts mosque',weekReview(weekStart(t)).mq===2&&weekText(weekStart(t)).includes('2× in der Moschee'));
  click('#tab-habits');click('[data-a="hseg"][data-v="s"]');
  ok('stats: mosque line + per prayer',!!q('.pmstat')&&q('.pmstat').textContent.includes('2× in 7 Tagen')&&qa('.ptimes .pmq').length===2,q('.pmstat')&&q('.pmstat').textContent);
  click('#tab-heute');
  await lpress(chip(0));click('#pt-mosq');click('[data-a="ptsave"]');await wait(300);
  ok('mosque removed again, score back',!dayGet(t).pm[0]&&dayGet(t).pm[2]===true&&!chip(0).querySelector('.pm')&&prayerDay(t).items[0].sc===75&&prayerDay(t).items[2].sc===100);
  click(chip(2));await wait(300);ok('untick clears mosque',!dayGet(t).pm,JSON.stringify(dayGet(t)));
  // Isha nach Mitternacht: am nächsten Tag vor Fajr für gestern abhaken
  window.__now=at(0,30,1);
  const d1=addDays(t,1);UI.sel=null;render();ok('clock moved to next day',today()===d1&&q('h1').textContent==='Heute');
  const yl=q(`.link.pyest[data-d="${t}"][data-i="4"]`);ok('Isha von gestern link',!!yl,qa('.pyest').map(b=>b.outerHTML).join());
  if(yl){click(yl);await wait(300)}
  ok('Isha after midnight = 20',dayGet(t).pt[4]===1470&&prayerDay(t).items[4].sc===20,JSON.stringify(dayGet(t).pt));
  ok('today Fajr still locked',q(`.chip[data-d="${d1}"][data-i="0"]`).disabled);
  UI.sel=null;window.__now=at(13,0);render();ok('clock back',today()===t);
  // Unterwegs + Einstellungen
  click('#tab-mehr');if(!FOLD.g)click('[data-a="fold"][data-k="g"]');ok('Gebet settings show times',q('.ptimes')&&q('.ptimes').textContent.includes('05:00')&&q('.ptimes').textContent.includes('18:30'),q('.ptimes')&&q('.ptimes').textContent);
  click('[data-a="pbuf"][data-dir="5"]');ok('Asr buffer +5',PS().buf===35);click('[data-a="pbuf"][data-dir="-5"]');
  ORTE=[{id:10977,name:'Dormagen',state:'Nordrhein-Westfalen',country:'Deutschland',lat:51.0968,lon:6.8317,n:'dormagen'},{id:11019,name:'Koln',state:'Nordrhein-Westfalen',country:'Deutschland',lat:50.93,lon:6.95,n:'koln'},{id:14833,name:'Tokyo',state:'Japonya',country:'Japan',lat:35.68,lon:139.69,n:'tokyo'}];
  click('[data-a="pcity"][data-m="travel"]');ok('travel page',UI.page&&UI.page.t==='pcity'&&!!q('#pc-until'));
  typeIn('#pc-q','köl');ok('search with umlaut',q('#pc-list').textContent.includes('Koln')&&!q('#pc-list').textContent.includes('Dormagen'),q('#pc-list').textContent);
  typeIn('#pc-until',addDays(t,2));click('[data-a="pcset"][data-id="11019"]');await wait(800);
  ok('travel set',PS().travel&&PS().travel.id===11019&&PS().travel.until===addDays(t,2)&&!UI.page&&cloud('state').settings.prayer.travel.id===11019);
  ok('travel used for its days, past days keep snapshot',cityFor(addDays(t,1)).id===11019&&cityFor(addDays(t,3)).id===99999&&pzFor(t)&&dayGet(t).pc===99999);
  click('[data-a="ptend"]');ok('travel ended',!PS().travel);
  // aus: alles wie vorher
  click('[data-a="pon"]');ok('off: no lock, no ring',!PS().on&&!prayerDay(t)&&prayerLock(t,0)==='');click('#tab-heute');
  ok('off: no gold ring',!q('.ring.hasg'));
  click('#tab-mehr');click('[data-a="fold"][data-k="g"]');ok('Gebet folds, switch stays',!q('[data-a="pbuf"]')&&!!q('[data-a="pon"]'));
  click('[data-a="pon"]');ok('on again keeps since + opens section',PS().on&&PS().since===addDays(t,-2)&&!!q('[data-a="pbuf"]'));
  click('#tab-habits');click('[data-a="hseg"][data-v="s"]');ok('stats card',qa('#view .sec h2').some(h=>h.textContent==='Gebet')&&!!q('.pbars'));
  window.__now=null;click('#tab-heute');
});
await wait(1500);
ok('localStorage written',(localStorage.getItem(lsKey())||'').includes('Reifen abholen'));
ok('nothing pending',pendingKeys().length===0,pendingKeys().join(','));
ok('no JS errors',__errors.length===0,__errors.join(' | '));
const pre=document.createElement('pre');pre.id='results';pre.textContent=R.join('\n')+'\nTOTAL '+R.length+' FAIL '+R.filter(x=>x.startsWith('FAIL')).length;document.body.appendChild(pre);
})();
