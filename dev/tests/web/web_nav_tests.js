(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));const R=[];const ok=(n,c,i='')=>R.push((c?'PASS ':'FAIL ')+n+(i?' :: '+i:''));
try{
await w(400);
const want=window.__WANT;
const tabW=want==='statistik'?'habits':want;ok('link opens tab '+want,UI.tab===tabW&&!!document.querySelector('#tab-'+tabW+'.on')&&(want!=='statistik'||UI.hseg==='s'),UI.tab);
ok('hash cleared',location.hash==='',location.hash);
ok('view rendered',document.querySelector('#view').textContent.length>20);
location.hash='#statistik';await w(150);ok('hashchange → statistik',UI.tab==='habits'&&UI.hseg==='s'&&document.querySelector('h1').textContent==='Statistik',UI.tab);
location.hash='#mood';await w(250);ok('hashchange #mood → heute + mood card',UI.tab==='heute'&&!!document.getElementById('moodcard'),UI.tab);
location.hash='#tick=h-beten';await w(150);ok('unknown action → heute, no write',UI.tab==='heute'&&!__writes.length,JSON.stringify(__writes));
ok('no JS errors',__errors.length===0,__errors.join(' | '));
}catch(e){ok('nav exception',false,e.message)}
const p=document.createElement('pre');p.id='results';p.textContent=R.join('\n')+'\nTOTAL '+R.length+' FAIL '+R.filter(x=>x.startsWith('FAIL')).length;document.body.appendChild(p)})();
