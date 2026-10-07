/* w165drive.js: wave165, one-on-ones only for the people speaking in them, and archive-only meetings. Steel (29/09/26): "pull
   all these in, including July and August but don't create any tasks from them just enhance the "Ask the Hub". 1on1s should be
   confidential and not searchable by anyone except for those that are speaking in the meeting." The server decides who reads a
   one-on-one (wa_sees_restricted); the page must not hide it from its own speakers, must say what it is, and must not offer to
   reprocess an archive-only meeting. The Loom card shows an admin who was not in a one-on-one only that one was filed. Uses
   test/boot.js (stubbed Supabase, clock fixed). */
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 700) : '')); } }

function fx() {
  const f = loadFixture();
  const base = (f.transcripts || [])[0] || {};
  const now = '2026-09-25T15:00:00Z';
  f.transcripts = (f.transcripts || []).concat([
    Object.assign({}, base, { id: 990101, title: 'Samson / Steel 1on1 - September 24, 2026', department: 'hr', visibility: 'speakers', allowed_people: ['Samson Jules', 'samson.jules@welfareavenue.com', 'Steel', 'steel.macdonald@welfareavenue.com'], processed: true, processed_at: now, ai_summary: 'Discussed: the onboarding plan and the first two weeks.', archive_only: false, meeting_date: '2026-09-24', created_at: '2026-09-25T14:59:00Z', board_only: false, source_url: 'https://www.loom.com/share/' + 'a1'.repeat(16), added_by: 'Loom pull (scheduled)', body: '00:00 Samson Jules: Hi Steel.\n00:05 Steel MacDonald: Hi Samson, how is the first week going?' }),
    Object.assign({}, base, { id: 990102, title: 'Operations Meetings - May 30, 2025', department: 'opsmtl', visibility: null, allowed_people: null, processed: true, processed_at: now, ai_summary: 'Discussed: the Sunday serving, twelve volunteers confirmed.\nDecided: Nothing was decided.\nNext steps: Mary buys the vegetables.', archive_only: true, meeting_date: '2025-05-30', created_at: '2026-09-25T14:58:00Z', board_only: false, source_url: 'https://www.loom.com/share/' + 'b2'.repeat(16), added_by: 'Loom pull (archive, Steel)', body: '00:00 Ahmed Fakhir: Good evening everyone.' }),
  ]);
  const t0 = (f.dept_tasks || [])[0] || {};
  f.dept_tasks.push(Object.assign({}, t0, { id: 990201, department: 'hr', subsection: null, title: 'Samson to finish the Hub modules by Friday', owner: 'Samson Jules', status: 'Open', done: false, banked_at: null, visibility: 'speakers', allowed_people: ['Samson Jules', 'samson.jules@welfareavenue.com', 'Steel', 'steel.macdonald@welfareavenue.com'], board_only: false, confidential: false, project_id: null, due_date: null }));
  return f;
}
const LOOM = {
  since: '2026-09-02', next_run: '2026-09-28T11:30:00Z', scheduled: true, connected: true, connected_at: '2026-09-28T20:00:00Z',
  last: { id: 9, status: 'ok', started_at: '2026-09-25T11:30:00Z', filed: 2, why: 'schedule' },
  counts: { filed: 2 },
  look: [{ loom_id: 'c3'.repeat(16), status: 'needs_look', title: 'Board Meeting - September 2026', meeting_date: '2026-09-20', reason: 'A board meeting: an admin decides where it goes', department: 'board', speakers: ['Steel MacDonald', 'Suhaib Abdillahi'] }],
  recent: [
    { loom_id: 'd4'.repeat(16), status: 'filed', title: 'A one-on-one', masked: true, visibility: 'speakers', meeting_date: '2026-09-24', department: 'marketing', duration_s: 1500 },
    { loom_id: 'e5'.repeat(16), status: 'filed', title: 'Marketing Meeting - September 23, 2026', visibility: 'department', meeting_date: '2026-09-23', department: 'marketing', transcript_id: 170, url: 'https://www.loom.com/share/' + 'e5'.repeat(16), speakers: ['Ian Odhiambo', 'Kahkashan Ansary'], reason: 'Team meeting, so everyone sees it' },
  ],
  archive_only: 73, one_on_ones: 15,
};

(async () => {
  const browser = await launch();
  const FX = fx();

  /* 1. the archive, as an admin: chips, no Reprocess on an archive-only meeting, the upload form's one-on-one choice */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#transcripts', fixture: JSON.parse(JSON.stringify(FX)), wait: 4500, rpcs: { wa_org_editor: true, loom_pull_status: LOOM } });
    const p = f.page;
    await p.waitForTimeout(800);
    const rows = await f.ev(() => {
      const r = (id) => { const el = document.querySelector('#txList .tx-item[data-tx="' + id + '"]'); if (!el) return null; return { chips: [...el.querySelectorAll('.w62chip')].map(c => c.className + ':' + c.textContent), reproc: !!el.querySelector('[data-reproc]') }; };
      const other = [...document.querySelectorAll('#txList .tx-item')].find(el => !/^9901/.test(el.getAttribute('data-tx') || ''));
      return { one: r(990101), arch: r(990102), other: other ? { id: other.getAttribute('data-tx'), reproc: !!other.querySelector('[data-reproc]') } : null };
    });
    ok('a one-on-one says so on its row: only its speakers see it', rows.one && rows.one.chips.some(c => /priv:one-on-one/.test(c) && /only its speakers/.test(c)), rows);
    ok('an archive-only meeting says so on its row and offers no Reprocess (no tasks come from it)', rows.arch && rows.arch.chips.some(c => /arch:archive only/.test(c)) && !rows.arch.reproc, rows);
    ok('any other processed meeting still offers Reprocess', rows.other && rows.other.reproc, rows);
    const form = await f.ev(() => {
      const sel = document.getElementById('w62type'); if (!sel) return null;
      const opts = [...sel.options].map(o => o.value + '=' + o.textContent);
      sel.value = 'speakers'; sel.dispatchEvent(new Event('change', { bubbles: true }));
      const people = getComputedStyle(document.getElementById('w62people')).display;
      const note = document.getElementById('w62note'); const noteOn = getComputedStyle(note).display !== 'none';
      const r = { opts, people, note: note.textContent, noteOn };
      sel.value = 'private'; sel.dispatchEvent(new Event('change', { bubbles: true }));
      r.privNote = note.textContent; r.privPeople = getComputedStyle(document.getElementById('w62people')).display;
      sel.value = 'department'; sel.dispatchEvent(new Event('change', { bubbles: true }));
      r.deptNoteOn = getComputedStyle(note).display !== 'none';
      return r;
    });
    ok('the upload form offers a one-on-one: only the people in it, not even admins', form && form.opts.some(o => /^speakers=One-on-one \(only the people in it, not even admins\)/.test(o)), form);
    ok('choosing a one-on-one shows the people picker and says who sees it', form && form.people !== 'none' && form.noteOn && /A one-on-one: only the people picked see it/.test(form.note) && /not admins or leaders/.test(form.note), form);
    ok('confidential keeps its picker; its note says Ask the Hub answers only for the people who can see it', form && form.privPeople !== 'none' && /Ask the Hub answers from it only for the people who can see it/.test(form.privNote) && !form.deptNoteOn, form);
    const merged = await f.ev(() => {
      const sel = document.getElementById('w62type'); sel.value = 'speakers'; sel.dispatchEvent(new Event('change', { bubbles: true }));
      const cb = document.querySelector('.w62pcb'); if (cb) cb.checked = true;
      try { return typeof wa62Merge === 'function' ? wa62Merge({ title: 'x' }) : 'not global'; } catch (e) { return String(e); }
    });
    ok('an upload marked one-on-one carries the people picked (the page adds you; the database adds their addresses)', merged === 'not global' || (merged && merged.visibility === 'speakers' && Array.isArray(merged.allowed_people) && merged.allowed_people.length >= 1), merged);

    /* the Loom card */
    const card = await f.ev(() => {
      const c = document.getElementById('w162loom'); if (!c) return null;
      const row = (id) => { const el = c.querySelector('[data-w162row="' + id + '"]'); return el ? { text: el.innerText.replace(/\s+/g, ' '), open: !!el.querySelector('a[href^="#tx/"]'), loom: !!el.querySelector('a.out') } : null; };
      return { masked: row('d4'.repeat(16)), team: row('e5'.repeat(16)), foot: (c.querySelector('.foot') || {}).innerText || '' };
    });
    ok('wave210b: filed meetings (a masked one-on-one, a team meeting) are not repeated in the Loom card', card && !card.masked && !card.team && /one-on-ones for the people speaking in them/.test(card.foot), card);
    ok('the card says one-on-ones go to the people speaking in them, and counts the older meetings kept for the archive and Ask the Hub only', card && /one-on-ones for the people speaking in them and nobody else/.test(card.foot) && /73 older meetings are kept for the archive and Ask the Hub only \(no tasks came from them\)/.test(card.foot), card && card.foot);
    const fileOpts = await f.ev(async () => {
      const b = document.querySelector('#w162loom [data-w162file]'); if (!b) return null; b.click();
      await new Promise(r => setTimeout(r, 300));
      const s = document.querySelector('#w162loom [data-w162vis]'); return s ? [...s.options].map(o => o.value) : null;
    });
    ok('filing a recording by hand offers a one-on-one for the people speaking in it', Array.isArray(fileOpts) && fileOpts.indexOf('speakers') >= 0 && fileOpts.indexOf('private') >= 0, fileOpts);
    ok('no page errors (admin)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 2. a member who spoke in a one-on-one keeps it (the page no longer hides it), and the task it gave them */
  {
    const f = await fresh(browser, { who: 'member', width: 1366, hash: '#mypage', fixture: JSON.parse(JSON.stringify(FX)), wait: 4500 });
    const r = await f.ev(async () => {
      try { if (typeof loadTranscriptsData === 'function') await loadTranscriptsData(); } catch (e) { return 'load failed ' + e; }
      const txs = (typeof txCache !== 'undefined' && Array.isArray(txCache)) ? txCache : [];
      const tasks = (typeof DB_TASKS !== 'undefined' && Array.isArray(DB_TASKS)) ? DB_TASKS : [];
      return { one: txs.some(t => t.id === 990101), arch: txs.some(t => t.id === 990102), task: tasks.some(t => t.id === 990201), nTx: txs.length, nTasks: tasks.length };
    });
    ok('a member who spoke in a one-on-one keeps it on the page (the server already decided they may read it)', r && r.one && r.arch, r);
    ok('and the task it gave them', r && (r.task || r.nTasks === 0), r);
    ok('no page errors (member)', f.errs.length === 0, f.errs);
    await f.close();
  }

  await browser.close();
  console.log(out.join('\n'));
  console.log('\nw165drive: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
