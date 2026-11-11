const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const base = 'http://127.0.0.1:' + (process.env.PORT || 8765) + '/';
  const pages = [['web_train.html', 60000], ['web_run.html', 120000], ['web_auth.html', 15000], ['web_nocfg.html', 8000], ['web_nav_aufgaben.html#aufgaben', 8000], ['web_nav_statistik.html#statistik', 8000], ['web_nav_heute.html#mood', 8000]];
  let fails = 0, total = 0;
  for (const [p, to] of pages) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const pg = await ctx.newPage();
    // block real network (gstatic in nocfg) so the no-config path is exercised
    await pg.route(/gstatic|googleapis/, r => r.abort());
    const errs = []; pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(base + p);
    try { await pg.waitForSelector('#results', { timeout: to, state: 'attached' }); } catch (e) { console.log('TIMEOUT', p, errs.join(' | ')); fails++; await ctx.close(); continue; }
    const txt = await pg.$eval('#results', e => e.textContent);
    const lines = txt.split('\n').filter(l => /^(PASS|FAIL)/.test(l)); total += lines.length;
    const f = lines.filter(l => l.startsWith('FAIL')); fails += f.length;
    console.log(p, lines.length, 'tests', f.length, 'fail'); f.forEach(l => console.log('   ', l));
    if (errs.length) console.log('   pageerrors:', errs.join(' | '));
    await ctx.close();
  }
  console.log('ALL', total, 'FAIL', fails); await b.close();
})();
