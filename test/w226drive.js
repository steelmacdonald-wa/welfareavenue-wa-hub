/* w226drive: Ask the Hub renders the WA voice (Markdown made safe, brand emojis, labelled links, source chips, the
   confidential card). CAND=build/candidate.html node test/w226drive.js */
const { launch, fresh } = require('./boot');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('ok   ' + m); } else { fail++; console.log('FAIL ' + m); } }
const ANS = "**Rally Paper recap work is moving** :wa-e-moves:\n\nThree things are open:\n- Recap video, Ian\n- LinkedIn post, Robert\n- Newsletter, Soraya\n\nThe plan is in [the project doc](https://docs.google.com/document/d/abc/edit) and on [Fundraising](#fundraising). Also https://www.loom.com/share/xyz. Thanks team :wa-heart-beat: :wa-unknown-thing:\n\n<img src=x onerror=alert(1)> [bad](javascript:alert(1))";
const CONF = "That one's not something I can share here :wa-heart-purple:\n\nSome conversations stay with the people they belong to: leadership changes, board matters and anyone's personal or HR situation. If it's something you need, the right person will bring it to you directly.\n\nAnything else I can dig up for you?";
(async () => {
  const browser = await launch();
  for (const width of [1366, 390]) {
    const f = await fresh(browser, { who: 'admin', width, hash: '#mypage', init: `window.__WA_ASKN = 0; window.__WA_INVOKE = function (name, opts) { if (name !== 'ask') return { data: null, error: null }; window.__WA_ASKN++; var q = (opts && opts.body && opts.body.question) || ''; return new Promise(function (res) { setTimeout(function () { res({ data: /steel leaving/i.test(q) ? { answer: ${JSON.stringify(CONF)}, sources: [], proposals: [], confidential: true } : { answer: ${JSON.stringify(ANS)}, sources: ['Rally Paper 2026 project plan', 'Marketing meeting, Oct 6'], proposals: [] } }); }, 300); }); };` });
    const p = f.page;
    await p.evaluate(() => { const b = document.getElementById('waChatBtn'); const pnl = document.getElementById('waChatPanel'); if (pnl) pnl.style.display = 'flex'; else if (b) b.click(); });
    await p.waitForTimeout(800);
    const welcome = await p.evaluate(() => { const s = document.querySelector('#wacMsgs .wac-m.bot span'); return s ? s.innerHTML : ''; });
    ok(/Hey! Ask me anything/.test(welcome) && /w226e/.test(welcome), width + ' welcome in the WA voice with a brand emoji');
    async function ask(q) {
      await p.fill('#w38in', q); await p.press('#w38in', 'Enter');
      await p.waitForFunction(n => document.querySelectorAll('#wacMsgs .wac-m.bot[data-w226="1"]').length >= n, 2, { timeout: 8000 }).catch(() => {});
      await p.waitForTimeout(900);
      return p.evaluate(() => { const all = document.querySelectorAll('#wacMsgs .wac-m.bot'); const d = all[all.length - 1]; const s = d.querySelector('span'); const src = d.querySelector('.wac-src'); return { html: s ? s.innerHTML : '', cls: d.className, src: src ? src.innerHTML : '', text: d.textContent }; });
    }
    const r = await ask('What is happening with Rally Paper?');
    ok(/<b>Rally Paper recap work is moving<\/b>/.test(r.html), width + ' bold');
    ok(/<ul><li>Recap video, Ian<\/li>/.test(r.html), width + ' bullet list');
    ok(/<a class="w226a" href="https:\/\/docs\.google\.com\/document\/d\/abc\/edit" target="_blank" rel="noopener noreferrer">the project doc<\/a>/.test(r.html), width + ' Markdown link with a label, new tab');
    ok(/<a class="w226a w226in" href="#fundraising">Fundraising<\/a>/.test(r.html), width + ' Hub page link stays in the Hub');
    ok(/>the Loom<\/a>/.test(r.html) && !/>https?:\/\//.test(r.html), width + ' bare address becomes "the Loom", no raw address shown');
    ok(/w226moves/.test(r.html) && /w226beat/.test(r.html), width + ' animated brand emojis (moving E, heartbeat)');
    ok(!/wa-unknown-thing/.test(r.text), width + ' unknown emoji code left out');
    ok(!/<img src="?x/.test(r.html) && /&lt;img/.test(r.html) && !/javascript:/.test(r.html.replace(/\[bad\]\(javascript:alert\(1\)\)/, '')) && !/href="javascript/.test(r.html), width + ' HTML and javascript: links stay inert');
    ok(/w226chip/.test(r.src) && /Rally Paper 2026 project plan/.test(r.src), width + ' sources as chips');
    ok(/data-w198skip/.test(await p.evaluate(() => { const all = document.querySelectorAll('#wacMsgs .wac-m.bot'); return all[all.length - 1].outerHTML; })), width + ' answer skipped by the French layer');
    const c = await ask('is steel leaving?');
    ok(/w226conf/.test(c.cls) && /not something I can share/.test(c.text), width + ' confidential reply in its own card');
    const geo = await p.evaluate(() => { const s = [...document.querySelectorAll('#wacMsgs span.w226rich')].pop(); const pn = document.getElementById('waChatPanel').getBoundingClientRect(); const r = s.getBoundingClientRect(); return { inside: r.right <= pn.right + 1 && r.left >= pn.left - 1, scroll: document.documentElement.scrollWidth <= window.innerWidth + 1 }; });
    ok(geo.inside, width + ' bubble fits the drawer');
    ok(f.errs.length === 0, width + ' no page errors' + (f.errs.length ? ': ' + f.errs.join(' | ') : ''));
    await p.screenshot({ path: '/tmp/w226_' + width + '.png' });
    await f.close();
  }
  await browser.close();
  console.log('w226drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
