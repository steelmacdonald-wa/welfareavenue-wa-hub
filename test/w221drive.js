/* w221drive.js: wave221, the Hub speaks as "the Hub", not "AI" (everywhere but the Admin centre).
   Checks waWho() and walks the Hub's pages as an admin and as a member, looking for the word AI in what is on screen.
   Uses test/boot.js (stubbed Supabase, clock fixed 25/09/26). CAND=<file>. */
const { launch, fresh } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 900) : '')); } }
const PAGES = ['#mypage', '#dashboard', '#overview', '#team/marketing', '#team/opsmtl', '#transcripts', '#requests', '#orggoals', '#projects', '#agendas', '#decisions', '#calendar', '#training', '#finances', '#content', '#photos', '#orgchart', '#person/17', '#importantinfo', '#crm', '#crm/studio', '#volunteering', '#fund', '#hr', '#bank'];
const ADMIN = /^#(adminpanel|activity)/;

async function walk(f, who) {
  const found = [];
  for (const h of PAGES) {
    if (ADMIN.test(h)) continue;
    await f.hash(h, 1600);
    const hit = await f.ev(() => {
      const t = document.body.innerText || '';
      /* typed content in the fixture (meeting summaries about the Hub project itself) is people's words, not the interface */
      const m = (t.match(/.{0,50}\bAI\b.{0,40}/g) || []).filter(x => !/AI-powered|uses AI to track/.test(x));
      return m.length ? m.slice(0, 3) : null;
    });
    if (hit) found.push([h, hit]);
  }
  ok(who + ': no "AI" on screen on ' + PAGES.length + ' pages', found.length === 0, found);
}

(async () => {
  const browser = await launch();
  const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#mypage', wait: 4200 });
  const w = await f.ev(() => ({
    a: waWho('AI: Weekly Operations Meeting - October 8, 2026'), b: waWho('Meeting AI'), c: waWho('Slack AI'),
    d: waWho('Meeting AI (accepted by Steel MacDonald)'), e: waWho('AI agenda (steel.macdonald)'), g: waWho('AI recommendation (system)'),
    h: waWho('Valex Sanon'), i: waWho(null), j: waWho('AI')
  }));
  ok('waWho: a meeting marker', w.a === 'the Hub, from Weekly Operations Meeting - October 8, 2026', w);
  ok('waWho: comment authors', w.b === 'The Hub, from the meeting' && w.c === 'The Hub, from Slack', w);
  ok('waWho: accepted request', w.d === 'Steel MacDonald (from a meeting)', w);
  ok('waWho: agenda and recommendation', w.e === 'the Hub’s agenda (steel.macdonald)' && w.g === 'the Hub’s recommendation (system)', w);
  ok('waWho: people and empties unchanged', w.h === 'Valex Sanon' && w.i === '' && w.j === 'the Hub', w);
  await walk(f, 'admin');
  ok('admin: no page errors', f.errs.length === 0, f.errs);
  await f.close();

  const g = await fresh(browser, { who: 'plain', width: 1366, hash: '#mypage', wait: 4200 });
  await walk(g, 'member');
  ok('member: no page errors', g.errs.length === 0, g.errs);
  await g.close();

  await browser.close();
  console.log(out.join('\n'));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
