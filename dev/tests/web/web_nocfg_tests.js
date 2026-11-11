(async()=>{await new Promise(r=>setTimeout(r,200));const R=[];const ok=(n,c)=>R.push((c?'PASS ':'FAIL ')+n);
ok('no config → device mode, no login screen',MODE==='guest'&&!document.querySelector('#a-mail')&&!!document.querySelector('#tab-heute'));
document.querySelector('#tab-mehr').click();ok('notice shown',document.querySelector('#view').textContent.includes('noch nicht eingerichtet'));
const p=document.createElement('pre');p.id='results';p.textContent=R.join('\n');document.body.appendChild(p)})()