(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));const R=[];const ok=(n,c,i='')=>R.push((c?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
const q=s=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
const type=(s,v)=>{const el=q(s);el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}))};
try{
await w(300);
ok('auth screen first',MODE==='auth'&&!!q('#a-mail')&&document.body.classList.contains('authmode'));
ok('tabbar hidden',getComputedStyle(q('.tabbar')).display==='none');
type('#a-mail','z@x.de');type('#a-pw','falsch');q('[data-a="asubmit"]').click();await w(150);
ok('wrong password message',q('#a-err')?.textContent==='E-Mail oder Passwort stimmt nicht.',q('#a-err')?.textContent);
ok('email kept after error',q('#a-mail').value==='z@x.de');
q('[data-a="amode"][data-v="signup"]').click();ok('signup mode keeps email',q('#a-mail').value==='z@x.de'&&q('#a-pw').autocomplete==='new-password');
type('#a-mail','neu@x.de');type('#a-pw','123');q('[data-a="asubmit"]').click();await w(150);ok('weak password',q('#a-err')?.textContent.includes('6 Zeichen'));
type('#a-mail','z@x.de');type('#a-pw','123456');q('[data-a="asubmit"]').click();await w(150);ok('existing email',q('#a-err')?.textContent.includes('schon ein Konto'));
q('[data-a="amode"][data-v="login"]').click();q('[data-a="areset"]').click();await w(100);ok('reset mail',window.__reset==='z@x.de'&&!!q('#a-info'));
// guest
q('[data-a="aguest"]').click();await w(50);
ok('guest mode app visible',MODE==='guest'&&!!q('#tab-heute')&&getComputedStyle(q('.tabbar')).display!=='none'&&getLast()==='guest');
q('#tab-habits').click();q('[data-a="hnew"]').click();type('#h-name','Gast Habit');q('.ptopbar [data-a="hsave"]').click();await w(100);
ok('guest habit stored on device',(localStorage.getItem('sabrly-v1:guest')||'').includes('Gast Habit'));
q('#tab-mehr').click();ok('guest sees account offer',!!q('[data-a="alogin"]')&&q('#syncline').textContent.includes('Ohne Konto'));
// signup from guest adopts data
q('[data-a="alogin"]').click();ok('signup screen',MODE==='auth'&&q('[data-a="amode"][data-v="signup"]').classList.contains('on'));
type('#a-mail','freund@x.de');type('#a-pw','sport123');q('[data-a="asubmit"]').click();await w(700);
ok('signed in as new user',MODE==='cloud'&&USER&&USER.email==='freund@x.de');
const st=__store.get('users/'+USER.uid+'/data/state');ok('guest habit uploaded',!!st&&st.habits.some(h=>h.name==='Gast Habit'),JSON.stringify(st&&st.habits.map(h=>h.name)));
ok('guest store cleared',!localStorage.getItem('sabrly-v1:guest'));
ok('sync ok',SYNC==='cloud',SYNC);
// tick + persists
q('#tab-heute').click();const b=q('[data-a="tog"][data-h="h-lesen"]');b.click();await w(500);
const mk=mkey(today());ok('tick saved to cloud',__store.get('users/'+USER.uid+'/data/'+mk)?.days?.[today()]?.h?.['h-lesen']===1);
const uid2=USER.uid;
// logout
q('#tab-mehr').click();q('[data-a="alogout"]').click();ok('logout needs confirm',MODE==='cloud');q('[data-a="alogout"]').click();await w(100);
ok('logged out → auth screen',MODE==='auth'&&!USER&&!!q('#a-mail'));
ok('local cache removed',!localStorage.getItem('sabrly-v1:'+uid2)&&getLast()===null);
// login other user: no leak
type('#a-mail','z@x.de');type('#a-pw','geheim1');q('[data-a="asubmit"]').click();await w(700);
ok('login u1',MODE==='cloud'&&USER.uid==='u1'&&SYNC==='cloud',SYNC);
ok('u1 data loaded',S.todos.some(x=>x.id==='t-old'));
ok('no data leak from other account',!S.habits.some(h=>h.name==='Gast Habit')&&!(LOGS[mk]?.days?.[today()]?.h?.['h-lesen']));
ok('u1 cloud untouched by guest',!__store.get('users/u1/data/state').habits.some(h=>h.name==='Gast Habit'));
// write error shows
window.__denyWrites=true;q('#tab-heute').click();q('[data-a="mood"][data-v="5"]').click();await w(600);
ok('write error visible',SYNC==='err'&&!q('#toast').hidden,SYNC);window.__denyWrites=false;
ok('no JS errors',__errors.length===0,__errors.join(' | '));
}catch(e){R.push('FAIL EXCEPTION '+e.message+' '+e.stack)}
const p=document.createElement('pre');p.id='results';p.textContent=R.join('\n')+'\nTOTAL '+R.length+' FAIL '+R.filter(x=>x.startsWith('FAIL')).length;document.body.appendChild(p)})()