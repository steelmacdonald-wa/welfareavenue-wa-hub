/* w277drive.js: wave277, the Connections page. One list of accounts in registry order (Meta carries Instagram and Facebook),
   the attention strip, the status pills, the capability chips, the row disclosure (scopes asked against granted, keys,
   Advanced with the Make hook), the Hub modal in place of confirm(), the member view, the 480px layout and an ASCII seg.
   Uses test/boot.js with test/fx_w277.json. CAND=build/candidate.html node test/w277drive.js */
const path = require('path');
const fs = require('fs');
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 600) : '')); } }
const ADD = JSON.parse(fs.readFileSync(path.join(__dirname, 'fx_w277.json'), 'utf8'));
function fx() {
  const f = loadFixture();
  (f.hub_access_profiles || []).forEach(p => { p.pages = p.pages || {}; p.pages.studio = ({ marketing: 'all', fundraising: 'all', executive: 'all', admin: 'all', board: 'none' })[p.key] || 'lead'; });
  f.studio_platforms = ADD.studio_platforms;
  f.hub_settings = (f.hub_settings || []).filter(s => s.key !== 'content_studio').concat(ADD.hub_settings);
  f.content_posts = []; f.content_tags = []; f.content_snippets = []; f.content_slots = []; f.short_links = []; f.short_link_clicks = []; f.social_comments = [];
  return f;
}
const CAP = { ok: true, token: true, accounts: [{ platform: 'facebook' }, { platform: 'instagram' }], granted: ['pages_manage_posts', 'instagram_content_publish'], missing: [], can: { facebook: true, instagram: true, linkedin: false }, mode: { facebook: 'direct', instagram: 'direct', linkedin: 'reminder' }, settings: {}, studio: {}, connections: {} };
/* wave277: the registry rows and the limits the composer reads */
CAP.platforms = ADD.studio_platforms.filter(p => p.active).map(p => ({ key: p.key, label: p.label, short: p.short, colour: p.colour, sort: p.sort, caps: p.caps, modes: p.modes }));
CAP.caps = { linkedin: { text: true, images: true, max_images: 20, video: true, max_video_s: 0, comments: true, analytics: true, link_in_caption: true }, instagram: { text: true, images: true, max_images: 10, video: true, max_video_s: 900, comments: true, analytics: true, link_in_caption: false }, tiktok: { text: false, images: false, max_images: 0, video: true, max_video_s: 600, comments: false, analytics: false, link_in_caption: false }, youtube: { text: false, images: false, max_images: 0, video: true, max_video_s: 180, comments: false, analytics: false, link_in_caption: false } };
function status(canChange) {
  return { ok: true, platforms: ADD.studio_platforms.filter(p => p.active), connections: JSON.parse(JSON.stringify(ADD.connections)), redirect_uri: 'https://x/social-connect', can_change: canChange, can_meta: canChange };
}
const INIT = (st, cap) => `
  window.__CONFIRMS = 0;
  window.confirm = function () { window.__CONFIRMS++; throw new Error('confirm used'); };
  window.prompt = function () { window.__CONFIRMS++; throw new Error('prompt used'); };
  try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa262.seen', '1'); } catch (e) {}
  window.__CALLS = [];
  window.__WA_INVOKE = function (name, opts) { var b = (opts && opts.body) || {}; window.__CALLS.push([name, b]);
    if (name === 'social-publish' && b.action === 'capabilities') return { data: ${JSON.stringify(cap || CAP)}, error: null };
    if (name === 'social-connect' && b.action === 'status') return { data: ${JSON.stringify(st)}, error: null };
    return { data: { ok: true }, error: null }; };`;
const RP = { wa225_publisher: true, wa225_marketing: true, wa_org_editor: true };
const ROWS = () => Array.from(document.querySelectorAll('#w277conn [data-w277row]')).map(r => r.getAttribute('data-w277row'));
const PILLS = () => { const o = {}; document.querySelectorAll('#w277conn [data-w277pill]').forEach(p => { o[p.getAttribute('data-w277pill')] = p.textContent.trim(); }); return o; };
const calls = (f, a) => f.ev(a => (window.__CALLS || []).filter(c => c[0] === 'social-connect' && c[1].action === a), a);

(async () => {
  const browser = await launch();
  const FX = fx();
  let adminPills = null;

  /* 1. an admin at 1366 */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#studio/connections', fixture: JSON.parse(JSON.stringify(FX)), rpcs: RP, init: INIT(status(true)), wait: 5000 });
    const p = f.page;
    const root = await f.ev(() => !!document.getElementById('w277conn'));
    ok('#w277conn exists', root);
    if (!root) { console.log(out.join('\n')); console.log('w277drive: ' + pass + ' passed, ' + fail + ' failed'); await browser.close(); process.exit(1); }
    const rows = await f.ev(ROWS);
    ok('one row per account in registry order, Meta carrying Instagram and Facebook, YouTube inactive', JSON.stringify(rows) === '["meta","threads","linkedin","tiktok"]', rows);
    const head = await f.ev(() => { const m = document.querySelector('#studio > .w118mast'); return m ? m.innerText.replace(/\s+/g, ' ').trim() : ''; });
    ok('the masthead line', /Connections/i.test(head) && /Every account the Hub posts to, and what each one can carry\./.test(head), head);
    const attn = await f.ev(() => { const a = document.getElementById('w277attn'); return a ? { t: a.innerText.replace(/\s+/g, ' '), b: Array.from(a.querySelectorAll('[data-w277act]')).map(b => b.textContent.trim() + '|' + b.getAttribute('data-w277act') + '|' + b.getAttribute('data-w277k')) } : null; });
    ok('the attention strip names LinkedIn, Expires in 5 days, with Reconnect', attn && /LinkedIn/.test(attn.t) && /Expires in 5 days/.test(attn.t) && attn.b.some(x => /^Reconnect\|reconnect\|linkedin$/.test(x)), attn);
    adminPills = await f.ev(PILLS);
    ok('pills: LinkedIn Expires in 5 days, TikTok To TikTok drafts, Threads Not connected, Meta Connected', adminPills.linkedin === 'Expires in 5 days' && adminPills.tiktok === 'To TikTok drafts' && adminPills.threads === 'Not connected' && adminPills.meta === 'Connected', adminPills);
    const lefts = await f.ev(() => Array.from(document.querySelectorAll('#w277conn [data-w277pill]')).map(p => Math.round(p.getBoundingClientRect().left)));
    ok('the pills line up in one column across the rows', lefts.length === 4 && lefts.every(x => x === lefts[0]), lefts);
    const chipL = await f.ev(() => Array.from(document.querySelectorAll('#w277conn .w277ch')).map(p => Math.round(p.getBoundingClientRect().left)));
    ok('the chips line up in one column across the rows', chipL.every(x => x === chipL[0]), chipL);
    const chips = await f.ev(() => { const r = document.querySelector('#w277conn [data-w277row="linkedin"]'); return r ? r.innerText.replace(/\s+/g, ' ') : ''; });
    ok('LinkedIn chips: Photos 20, Video, Comments', /Photos 20/.test(chips) && /Video/.test(chips) && /Comments/.test(chips), chips);
    /* the disclosure */
    await p.click('#w277conn [data-w277row="linkedin"] .w277nm'); await p.waitForTimeout(400);
    const disc = await f.ev(() => { const r = document.querySelector('#w277conn [data-w277row="linkedin"]'), d = document.querySelector('#w277conn [data-w277disc="linkedin"]'); return { exp: r.getAttribute('aria-expanded'), open: d.classList.contains('open'), t: d.innerText.replace(/\s+/g, ' '), re: Array.from(d.querySelectorAll('[data-w277act="reconnect"]')).map(b => b.textContent.trim()) }; });
    ok('the LinkedIn disclosure opens on click, shows Asked for 6, granted 1 and Reconnect', disc.exp === 'true' && disc.open && /Asked for 6, granted 1/.test(disc.t) && disc.re.indexOf('Reconnect') >= 0, disc);
    const adv = await f.ev(() => { const i = document.getElementById('w277mkhook'); if (!i) return null; const d = i.closest('details'); return { inLi: !!i.closest('[data-w277disc="linkedin"]'), sum: d && d.querySelector('summary') ? d.querySelector('summary').textContent.trim() : null }; });
    ok('no Make card; the hook sits in the LinkedIn disclosure under Advanced', adv && adv.inLi && adv.sum === 'Advanced' && !(await f.ev(() => /Make\.com/.test(document.getElementById('w277conn').innerText) || !!document.querySelector('#w225host [data-w225cx="make_hook"]'))), adv);
    const extra = await f.ev(() => { const x = document.querySelector('#w277conn .w277extra'); return x ? x.innerText.replace(/\s+/g, ' ') : null; });
    ok('wave250 cards stay: WhatsApp under the list', extra && /WhatsApp/.test(extra), extra && extra.slice(0, 200));
    /* Enter on a row toggles; one open at a time */
    await f.ev(() => { const r = document.querySelector('#w277conn [data-w277row="threads"]'); r.focus(); });
    await p.keyboard.press('Enter'); await p.waitForTimeout(300);
    const one = await f.ev(() => Array.from(document.querySelectorAll('#w277conn [data-w277row]')).filter(r => r.getAttribute('aria-expanded') === 'true').map(r => r.getAttribute('data-w277row')));
    ok('Enter opens Threads and closes LinkedIn (one open at a time)', JSON.stringify(one) === '["threads"]', one);
    /* Save keys */
    await p.fill('#w277id-threads', '1234567890123'); await p.fill('#w277sec-threads', 'a-threads-secret-value');
    await p.click('#w277conn [data-w277act="save_keys"][data-w277k="threads"]'); await p.waitForTimeout(700);
    const sv = await calls(f, 'save_app');
    const empty = await f.ev(() => (document.getElementById('w277id-threads') || {}).value === '' && (document.getElementById('w277sec-threads') || {}).value === '');
    ok('Save keys sends save_app for threads with the id and secret, and both fields empty after', sv.length === 1 && sv[0][1].platform === 'threads' && sv[0][1].id === '1234567890123' && sv[0][1].secret === 'a-threads-secret-value' && empty, { sv, empty });
    ok('the secret is not echoed on the page', !(await f.ev(() => document.body.innerHTML.indexOf('a-threads-secret-value') >= 0)));
    /* Disconnect through the Hub modal */
    await p.click('#w277conn [data-w277row="tiktok"] .w277nm'); await p.waitForTimeout(300);
    await p.click('#w277conn [data-w277act="disconnect"][data-w277k="tiktok"]'); await p.waitForTimeout(400);
    const modal = await f.ev(() => { const m = document.getElementById('w277modal'); return m ? { vis: !!(m.offsetWidth || m.offsetHeight), t: m.innerText.replace(/\s+/g, ' ') } : null; });
    ok('Disconnect opens #w277modal (no confirm)', modal && modal.vis && /TikTok/.test(modal.t), modal);
    ok('a destructive modal focuses Cancel, so Enter does not disconnect', await f.ev(() => !!(document.activeElement && document.activeElement.hasAttribute('data-w277cancel'))));
    ok('nothing sent before the modal is answered', (await calls(f, 'disconnect')).length === 0);
    await p.click('#w277modal [data-w277ok]'); await p.waitForTimeout(700);
    const dc = await calls(f, 'disconnect');
    ok('[data-w277ok] sends disconnect for tiktok', dc.length === 1 && dc[0][1].platform === 'tiktok', dc);
    ok('window.confirm and window.prompt never called', (await f.ev(() => window.__CONFIRMS)) === 0);
    /* Reconnect from the strip starts the OAuth flow */
    await f.ev(() => { window.__WA_INVOKE0 = window.__WA_INVOKE; window.__WA_INVOKE = function (n, o) { if (n === 'social-connect' && o.body.action === 'start') { window.__CALLS.push([n, o.body]); return { data: { url: '#studio/connections?started=1' }, error: null }; } return window.__WA_INVOKE0(n, o); }; });
    await p.click('#w277attn [data-w277act="reconnect"]'); await p.waitForTimeout(600);
    const st = await calls(f, 'start');
    ok('Reconnect sends start for linkedin', st.length === 1 && st[0][1].platform === 'linkedin', st);
    await f.hash('#studio/connections', 1500);
    /* a connected record with no health reads Connected (Review Focus 3) */
    await f.ev(() => { const S = window.w225.state(); S.conn.connections.threads = { status: 'connected' }; window.w225.paint(); });
    await p.waitForTimeout(300);
    ok('a connected record with no health reads Connected', (await f.ev(PILLS)).threads === 'Connected', await f.ev(PILLS));
    /* 480 wide: the action is full width */
    await p.setViewportSize({ width: 480, height: 900 }); await p.waitForTimeout(500);
    const w = await f.ev(() => { const r = document.querySelector('#w277conn [data-w277row="linkedin"]'), b = r && r.querySelector('.w277act .w277btn'); return r && b ? { row: r.offsetWidth, btn: b.offsetWidth } : null; });
    ok('at 480 the LinkedIn action button is full width', w && w.row - w.btn <= 24 && w.btn > 0, w);
    const hs = await f.ev(() => { const c = document.getElementById('w277conn'); return c.scrollWidth <= c.clientWidth + 1; });
    ok('at 480 nothing in the page runs sideways', hs);
    ok('no page errors (admin)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 2. a marketing member: the same list, nothing to change */
  {
    const f = await fresh(browser, { who: 'plain', width: 1366, hash: '#studio/connections', fixture: JSON.parse(JSON.stringify(FX)), rpcs: { wa225_publisher: false, wa225_marketing: true }, init: INIT(status(false)), wait: 5000 });
    const v = await f.ev(() => ({ root: !!document.getElementById('w277conn'), keys: !!document.getElementById('w277id-threads'), tok: !!document.getElementById('w277metatok'), connect: Array.from(document.querySelectorAll('#w277conn [data-w277act]')).map(b => b.getAttribute('data-w277act')).filter(a => /^(connect|reconnect|disconnect|save_keys|meta_save|make_hook)$/.test(a)) }));
    ok('member: rows render', v.root && JSON.stringify(await f.ev(ROWS)) === '["meta","threads","linkedin","tiktok"]', v);
    ok('member: no key fields, no token field, no Connect, Reconnect or Disconnect', !v.keys && !v.tok && v.connect.length === 0, v);
    const mp = await f.ev(PILLS);
    ok('member: pill texts unchanged', JSON.stringify(mp) === JSON.stringify(adminPills), { mp, adminPills });
    ok('no page errors (member)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 3. no registry in the status answer: wave225's own list, every action still there */
  {
    const st = status(true); delete st.platforms;
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#studio/connections', fixture: JSON.parse(JSON.stringify(FX)), rpcs: RP, init: INIT(st), wait: 5000 });
    const v = await f.ev(() => ({ rows: Array.from(document.querySelectorAll('#w277conn [data-w277row]')).map(r => r.getAttribute('data-w277row')), note: (document.querySelector('#w277conn .w277note') || {}).textContent || '', chips: document.querySelectorAll('#w277conn .w277ch span').length, keys: ['threads', 'linkedin', 'tiktok', 'youtube'].every(k => document.getElementById('w277id-' + k) && document.getElementById('w277sec-' + k)), tok: !!document.getElementById('w277metatok'), acts: Array.from(new Set(Array.from(document.querySelectorAll('#w277conn [data-w277act]')).map(b => b.getAttribute('data-w277act')))) }));
    ok('no registry: rows from the wave225 list (Meta, Threads, LinkedIn, TikTok, YouTube), no chips', JSON.stringify(v.rows) === '["meta","threads","linkedin","tiktok","youtube"]' && v.chips === 0, v);
    ok('no registry: the quiet note under the masthead', v.note === 'Platform details are unavailable right now; the accounts below still work.', v.note);
    ok('no registry: keys, Connect, Disconnect, Save keys and the Meta token all reachable', v.keys && v.tok && ['connect', 'disconnect', 'save_keys', 'meta_check', 'meta_save', 'reconnect'].every(a => v.acts.indexOf(a) >= 0), v.acts);
    await f.ev(() => { document.getElementById('w277id-youtube').value = 'yt-id-12345'; document.getElementById('w277sec-youtube').value = 'yt-secret-12345'; document.querySelector('#w277conn [data-w277act="save_keys"][data-w277k="youtube"]').click(); });
    await f.page.waitForTimeout(600);
    ok('no registry: Save keys still sends save_app', (await calls(f, 'save_app')).some(c => c[1].platform === 'youtube'));
    ok('no page errors (no registry)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 3b. the composer reads the registry limits (Task 7) */
  {
    const CAPM = JSON.parse(JSON.stringify(CAP)); CAPM.mode.linkedin = 'make'; CAPM.can.linkedin = true;
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#contentcal', fixture: JSON.parse(JSON.stringify(FX)), rpcs: RP, init: INIT(status(true), CAPM), wait: 4000 });
    const img = i => ({ url: 'https://x/i' + i + '.jpg', kind: 'image', alt: 'a photo', w: 1080, h: 1350 });
    const vid = i => ({ url: 'https://x/v' + i + '.mp4', kind: 'video', alt: '', w: 1080, h: 1920, dur: 20 });
    const panel = pre => f.ev(pre => { window.w121.compose(pre); return new Promise(r => setTimeout(() => r(Array.from(document.querySelectorAll('#w121dr .val div')).map(d => d.textContent)), 600)); }, pre);
    let v = await panel({ platforms: ['linkedin'], media: [img(1), img(2)] });
    ok('LinkedIn with two photos: no first photo only warning', v.length > 0 && !v.some(t => /first photo only/.test(t)), v);
    v = await panel({ platforms: ['linkedin'], media: [vid(1), vid(2), vid(3)] });
    ok('LinkedIn with three videos: the one video message', v.some(t => /one video/.test(t)), v);
    v = await panel({ platforms: ['instagram'], media: Array.from({ length: 11 }, (_, i) => img(i)) });
    ok('Instagram with eleven photos: up to 10 photos', v.some(t => /up to 10 photos/.test(t)), v);
    ok('no page errors (composer limits)', f.errs.length === 0, f.errs);
    await f.close();
  }

  /* 3c. approvers picked from the marketing team (Task 8) */
  {
    const REC = `
      window.__REC = function () {
        if (window.__RECON || typeof db === 'undefined') return; window.__RECON = true; window.__W = [];
        var orpc = db.rpc.bind(db);
        db.rpc = function (n, a) { if (/^studio_/.test(n)) window.__W.push(['rpc', n, a]); return orpc(n, a); };
      };`;
    const AP = JSON.parse(JSON.stringify(FX));
    const mem = (id, name, email, dept, nick) => ({ id, name, email, department: dept, role: 'Member', active: true, nicknames: nick });
    AP.team_members = [mem(9001, 'Ian Odhiambo', 'ian.odhiambo@welfareavenue.com', 'marketing', []), mem(9002, 'Kahkashan Ansary', 'kahkashan.ansary@welfareavenue.com', 'marketing', ['KK']), mem(9003, 'Fiona Finance', 'fiona.finance@welfareavenue.com', 'finance', [])];
    AP.hub_settings = AP.hub_settings.filter(s => s.key !== 'content_studio').concat([{ key: 'content_studio', value: { hashtag_cap: 5, approvers: ['ian.odhiambo@welfareavenue.com', 'kahkashan.ansary@welfareavenue.com'] }, updated_at: '2026-11-02T00:00:00Z' }]);
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#studio/approvals', fixture: AP, rpcs: Object.assign({ studio_settings_save: { ok: true } }, RP), init: INIT(status(true)) + REC, wait: 5000 });
    const p = f.page; await f.ev(() => window.__REC());
    const v = await f.ev(() => ({ boxes: Array.from(document.querySelectorAll('#w225host [data-w277ap]')).map(b => ({ e: b.getAttribute('data-w277ap'), c: b.checked, l: b.closest('label') ? b.closest('label').textContent.replace(/\s+/g, ' ').trim() : '' })), old: !!document.querySelector('#w225host [data-w241approvers]'), save: !!document.querySelector('#w225host [data-w277apsave]'), t: document.getElementById('w225host').innerText }));
    ok('approvers: two checkboxes, both ticked', v.boxes.length === 2 && v.boxes.every(b => b.c), v.boxes);
    ok('approvers: the finance member is not listed', !/Fiona/.test(v.t) && !v.boxes.some(b => /finance/.test(b.e)), v.boxes);
    ok('approvers: KK shows the nickname, Ian shows none', v.boxes.some(b => /Kahkashan Ansary/.test(b.l) && /KK/.test(b.l)) && v.boxes.some(b => /Ian Odhiambo/.test(b.l) && !/\(/.test(b.l)), v.boxes);
    ok('approvers: Save approvers button present, old text input absent', v.save && !v.old, v);
    await f.ev(() => { document.querySelector('#w225host [data-w277ap="kahkashan.ansary@welfareavenue.com"]').click(); document.querySelector('#w225host [data-w277apsave]').click(); }); await p.waitForTimeout(800);
    const sv = await f.ev(() => (window.__W || []).filter(w => w[0] === 'rpc' && w[1] === 'studio_settings_save'));
    ok('approvers: unticking KK and saving records approvers for Ian only, other settings kept', sv.length === 1 && sv[0][2].p_key === 'content_studio' && JSON.stringify(sv[0][2].p_value.approvers) === '["ian.odhiambo@welfareavenue.com"]' && sv[0][2].p_value.hashtag_cap === 5, sv);
    ok('approvers: after saving KK stays unticked', await f.ev(() => document.querySelector('#w225host [data-w277ap="kahkashan.ansary@welfareavenue.com"]').checked === false));
    ok('no page errors (approvers)', f.errs.length === 0, f.errs);
    await f.close();
  }
  /* 3d. no marketing members: the old text input stays */
  {
    const AP = JSON.parse(JSON.stringify(FX)); AP.team_members = (AP.team_members || []).filter(m => m.department !== 'marketing');
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#studio/approvals', fixture: AP, rpcs: Object.assign({ studio_settings_save: { ok: true } }, RP), init: INIT(status(true)), wait: 4500 });
    const v = await f.ev(() => ({ old: !!document.querySelector('#w225host [data-w241approvers]'), old2: !!document.querySelector('#w225host [data-w241apsave]'), boxes: document.querySelectorAll('#w225host [data-w277ap]').length }));
    ok('approvers: with no marketing members the text input and its Save stay', v.old && v.old2 && v.boxes === 0, v);
    await f.close();
  }

  /* 4. the seg is ASCII with no dashes */
  {
    const seg = fs.readFileSync(path.join(__dirname, '../build/src/277_wave277.seg'), 'utf8');
    ok('the seg has no em or en dash (raw or escaped)', !/[\u2013\u2014]/.test(seg) && !/\\u201[34]/i.test(seg) && !/&mdash;|&ndash;/.test(seg));
    ok('the seg is ASCII', /^[\x00-\x7f]*$/.test(seg));
    ok('the seg never calls confirm or prompt', !/\b(confirm|prompt)\s*\(/.test(seg));
  }
  console.log(out.join('\n'));
  console.log('w277drive: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
