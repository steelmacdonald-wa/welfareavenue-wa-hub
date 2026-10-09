/* w222probe.js: measure the Hub's start on a slow load. For each page: when startApp resolved, when the
   veil lifted (html.wa-ready) and why, and how much of the visible page still changed after the veil
   lifted (DOM mutations outside the veil, in 500 ms buckets, with the first few changed elements named).
   NODE_PATH=... CAND=build/candidate.html node test/w222probe.js [lat] [who] [width] [hashes...] */
const { launch, fresh } = require('./boot');
const LAT = Number(process.argv[2] || 150), WHO = process.argv[3] || 'admin', W = Number(process.argv[4] || 1366);
const HASHES = process.argv.slice(5).length ? process.argv.slice(5) : ['#mypage', '#dashboard', '#opsmtl', '#hr', '#training', '#orggoals'];
const init = `window.__WA_LAT = ${LAT}; window.__w222 = { t0: performance.now(), sa: null, ready: null, buckets: {}, samples: [], total: 0 };
  (function(){
    var G = window.__w222;
    function tag(n){ try { var e = n.nodeType === 1 ? n : n.parentElement; if (!e) return '?'; var id = e.id ? '#' + e.id : ''; var c = e.className && typeof e.className === 'string' ? '.' + e.className.split(' ').filter(Boolean).slice(0,2).join('.') : ''; var anc = e.closest('[id]'); return e.tagName.toLowerCase() + id + c + (anc && anc !== e ? ' in #' + anc.id : ''); } catch (e) { return '?'; } }
    document.addEventListener('DOMContentLoaded', function(){
      new MutationObserver(function(list){
        if (G.ready === null) return;
        list.forEach(function(m){
          var t = m.target; if (t && t.closest && t.closest('#wa110veil')) return;
          if (t && t.nodeType === 1 && t.id === 'wa110veil') return;
          if (t === document.documentElement || t === document.head || (t && t.closest && t.closest('head'))) return;
          var e = t.nodeType === 1 ? t : t.parentElement; if (!e) return;
          /* only what the reader can see */
          var r; try { if (!e.isConnected) return; var cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return; r = e.getBoundingClientRect(); if (!r.width && !r.height) return; } catch (x) { return; }
          var dt = Math.round(performance.now() - G.ready), b = Math.floor(dt / 500) * 500;
          G.buckets[b] = (G.buckets[b] || 0) + 1; G.total++;
          if (G.samples.length < 60) G.samples.push(dt + 'ms ' + m.type + ' ' + tag(t));
        });
      }).observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true, attributeFilter: ['class', 'style', 'hidden'] });
      new MutationObserver(function(){ if (G.ready === null && document.documentElement.classList.contains('wa-ready')) { G.ready = performance.now(); G.readyAt = Math.round(G.ready - G.t0); G.saDone = G.sa !== null; } }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    });
    var wrapTries = 0;
    (function wrap(){ if (typeof startApp === 'function' && !window.__w222wrapped) { window.__w222wrapped = true; var o = startApp; startApp = async function(){ try { return await o.apply(this, arguments); } finally { G.sa = Math.round(performance.now() - G.t0); } }; } })();
    window.addEventListener('load', function(){ /* wrap the outermost startApp after every wave has wrapped it */
      if (typeof startApp === 'function') { var o = startApp; startApp = async function(){ try { return await o.apply(this, arguments); } finally { G.sa = Math.round(performance.now() - G.t0); } }; }
    }, { once: true });
  })();`;
(async () => {
  const browser = await launch();
  console.log('latency ' + LAT + ' ms, ' + WHO + ' at ' + W + ' px');
  for (const h of HASHES) {
    const f = await fresh(browser, { who: WHO, width: W, hash: h, init, wait: 14000 });
    const s = await f.ev(() => { const G = window.__w222; return { sa: G.sa, readyAt: G.readyAt, saDone: G.saDone, total: G.total, buckets: G.buckets, samples: G.samples.slice(0, 24), w163: window.w163 && window.w163.state && window.w163.state(), w222: window.w222 && window.w222.state() }; });
    const b = Object.keys(s.buckets).sort((a, c) => a - c).map(k => k + ':' + s.buckets[k]).join(' ');
    console.log('\n' + h + '  startApp resolved at ' + s.sa + ' ms; veil lifted at ' + s.readyAt + ' ms (startApp done first: ' + s.saDone + '); menu at ' + (s.w163 && s.w163.at) + ' ms (' + (s.w163 && s.w163.why) + ')');
    console.log('  w222 ' + JSON.stringify(s.w222)); console.log('  visible changes after the veil lifted: ' + s.total + '  by 500 ms: ' + b);
    s.samples.forEach(x => console.log('    ' + x));
    if (f.errs.length) console.log('  page errors: ' + f.errs.join(' | '));
    await f.close();
  }
  await browser.close();
})();
