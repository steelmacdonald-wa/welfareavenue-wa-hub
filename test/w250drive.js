/* w250drive.js: waves 250 to 254, the Meta additions in the Content Studio. Messages (#studio/messages: the list, a
   conversation, the 24-hour window, Reply, Remove for leads only, the Instagram limit note), Paid and organic (#studio/ads),
   Connections' Meta live and WhatsApp cards (admins: Check, the switches saved to app_config; members: no switches), the
   rail's Messages count, a phone width. Uses test/boot.js. CAND=build/candidate.html node test/w250drive.js */
const { launch, fresh, loadFixture } = require('./boot');
let pass = 0, fail = 0; const out = [];
function ok(name, cond, extra) { if (cond) { pass++; out.push('PASS ' + name); } else { fail++; out.push('FAIL ' + name + (extra !== undefined ? ' :: ' + String(typeof extra === 'string' ? extra : JSON.stringify(extra)).slice(0, 600) : '')); } }
const at = (d, t) => new Date(d + 'T' + (t || '12:00') + ':00-04:00').toISOString();
function fx() {
  const f = loadFixture();
  (f.hub_access_profiles || []).forEach(p => { p.pages = p.pages || {}; p.pages.studio = ({ marketing: 'all', fundraising: 'all', executive: 'all', admin: 'all', board: 'none' })[p.key] || 'lead'; });
  f.content_posts = []; f.content_tags = []; f.content_snippets = [{ id: 7, kind: 'reply', name: 'Thanks', body: 'Thank you {name}!', uses: 0 }]; f.content_slots = []; f.short_links = []; f.short_link_clicks = []; f.social_comments = [];
  f.social_posts = [{ id: 1, platform: 'instagram', external_id: 'm1', url: 'https://instagram.com/p/1', kind: 'post', caption: 'Sunday serving', published_at: at('2026-09-20'), reach: 900, views: 1200, likes: 80, comments: 5, shares: 2, saves: 3, engagement: 90 }];
  f.social_threads = [
    { id: 11, platform: 'instagram', external_id: 'c11', participant_id: '901', participant_name: 'Maya Lee', participant_handle: 'mayalee', last_message_at: at('2026-09-25', '15:00'), last_inbound_at: at('2026-09-25', '15:00'), last_from_us: false, last_snippet: 'Can I volunteer this Sunday?', message_count: 2, unread: 1, status: 'open', assigned_to: null },
    { id: 12, platform: 'facebook', external_id: 't_12', participant_id: '902', participant_name: 'Jean Tremblay', participant_handle: null, last_message_at: at('2026-09-20', '10:00'), last_inbound_at: at('2026-09-20', '09:00'), last_from_us: true, last_snippet: 'Merci beaucoup!', message_count: 3, unread: 0, status: 'resolved', assigned_to: 'Joy Dumansi' }
  ];
  f.social_messages = [
    { id: 101, thread_id: 11, platform: 'instagram', external_id: 'mid1', from_us: false, author_name: 'mayalee', text: 'Hi! Are you serving this weekend?', attachments: [], sent_at: at('2026-09-25', '14:50') },
    { id: 102, thread_id: 11, platform: 'instagram', external_id: 'mid2', from_us: false, author_name: 'mayalee', text: 'Can I volunteer this Sunday?', attachments: [{ type: 'image', name: null, url: 'https://lookaside.fbsbx.com/x.jpg' }], sent_at: at('2026-09-25', '15:00') },
    { id: 103, thread_id: 12, platform: 'facebook', external_id: 'mid3', from_us: false, author_name: 'Jean Tremblay', text: 'Bonjour, horaire?', attachments: [], sent_at: at('2026-09-20', '09:00') },
    { id: 104, thread_id: 12, platform: 'facebook', external_id: 'mid4', from_us: true, author_name: 'Welfare Avenue', text: 'Dimanche à midi!', attachments: [], sent_at: at('2026-09-20', '09:30'), sent_by: 'Joy Dumansi' }
  ];
  f.social_ad_daily = [{ account_id: 'act_570313852513008', campaign_id: '1', day: '2026-09-14', spend: 20, results: 30, reach: 1000, clicks: 30 }, { account_id: 'act_570313852513008', campaign_id: '1', day: '2026-09-15', spend: 40, results: 50, reach: 2000, clicks: 50 }];
  f.hub_settings = (f.hub_settings || []).concat([
    { key: 'content_studio', value: { goals: {}, tz: 'America/Toronto' }, updated_at: '2026-09-20T00:00:00Z' },
    { key: 'studio_dm_sync', value: { at: at('2026-09-25', '15:55'), result: { facebook: { conversations: 1, added: 0 }, instagram: { conversations: 1, added: 1, limited: 'needs_advanced_access' } } }, updated_at: '2026-09-25T19:55:00Z' }
  ]);
  f.app_config = (f.app_config || []).concat([{ key: 'sms_whatsapp_mode', value: 'off' }, { key: 'sms_whatsapp_channel', value: 'off' }, { key: 'sms_whatsapp_test_phones', value: '' }]);
  return f;
}
const ADS = { at: at('2026-09-25', '03:40'), accounts: [{ id: 'act_570313852513008', name: '570313852513008', currency: 'CAD', status: 1, lifetime_spend: 136.96,
  last7: { spend: 0, reach: 0, impressions: 0, clicks: 0, results: 0, campaigns: [] },
  last30: { spend: 60, reach: 2800, impressions: 5400, clicks: 80, results: 80, campaigns: [{ id: '1', name: 'Instagram post: 10 DAYS AWAY!!', objective: 'LINK_CLICKS', spend: 60, reach: 2800, impressions: 5400, clicks: 80, results: 80, result_type: 'link_click' }] },
  last90: { spend: 136.96, reach: 5100, impressions: 9000, clicks: 116, results: 116, campaigns: [] } }] };
const META = { app_secret: true, verify_token: true, page_token: true, page_subscription: { subscribed: true, fields: ['feed', 'messages', 'leadgen'] }, messenger: { readable: true, conversations: 25 }, instagram_dm: { error: 'reduce the amount of data' }, lead_forms: [], ad_accounts: [{ id: 'act_570313852513008', name: '570313852513008' }], events_7d: { 'page feed done': 3 }, last_event: at('2026-09-25', '15:30') };
const WA = { ok: true, mode: 'off', channel: 'off', test_phones: 0, is_admin: true, number: { display_phone_number: '+1 555-676-5057', verified_name: 'Test Number' }, account: { business_verification_status: 'pending_submission' }, templates: [{ name: 'wa_serving_reminder', language: 'en', status: 'PENDING' }, { name: 'wa_still_in', language: 'fr', status: 'APPROVED' }], last_30_days: {} };
const INIT = `
  window.confirm = function () { return true; };
  try { localStorage.setItem('wa84tour', '1'); localStorage.setItem('wa262.seen', '1'); } catch (e) {}
  window.__CALLS = [];
  window.__WA_INVOKE = function (name, opts) { var b = (opts && opts.body) || {}; window.__CALLS.push([name, b]);
    if (name === 'social-ads') return { data: b.action === 'summary' ? { ok: true, summary: ${JSON.stringify(ADS)} } : { ok: true, rows: 2, accounts: [] }, error: null };
    if (name === 'meta-events') return { data: b.action === 'status' ? ${JSON.stringify(META)} : { ok: true }, error: null };
    if (name === 'whatsapp-send') return { data: b.action === 'status' ? ${JSON.stringify(WA)} : { ok: true }, error: null };
    if (name === 'social-dms') return { data: b.action === 'dm_sync' ? { ok: true, messages: { facebook: { added: 0 }, instagram: { added: 0 } } } : { ok: true }, error: null };
    if (name === 'social-connect') return { data: { ok: true, meta: {}, apps: {} }, error: null };
    return { data: { ok: true }, error: null }; };
  window.__REC = function () {
    if (window.__RECON || typeof db === 'undefined') return; window.__RECON = true; window.__W = [];
    var of = db.from.bind(db);
    db.from = function (t) { var b = of(t); ['insert', 'update', 'delete', 'upsert'].forEach(function (m) { var o = b[m]; b[m] = function (p) { window.__W.push([t, m, p === undefined ? null : JSON.parse(JSON.stringify(p))]); return o.call(b, p); }; }); return b; };
  };`;
const HOST = () => { const h = document.getElementById('w225host'); return h ? h.innerText.replace(/\s+/g, ' ').trim() : null; };
const CALLS = (n, a) => (window.__CALLS || []).filter(c => c[0] === n && (!a || c[1].action === a));

(async () => {
  const browser = await launch();
  const FX = fx();
  /* 1. an admin (a publisher) */
  {
    const f = await fresh(browser, { who: 'admin', width: 1366, hash: '#studio/messages', fixture: JSON.parse(JSON.stringify(FX)), rpcs: { wa225_publisher: true, wa225_marketing: true, wa_org_editor: true }, init: INIT, wait: 5000 });
    const p = f.page; await f.ev(() => window.__REC());
    let t = await f.ev(HOST);
    ok('Messages: the heading and one waiting', /Messages/.test(await f.ev(() => document.body.innerText)) && /1 waiting for us/i.test(t), t && t.slice(0, 300));
    ok('the Instagram limit note with the Meta Business Suite link', /App Review/.test(t) && !!(await f.ev(() => document.querySelector('#w225host a[href="https://business.facebook.com/latest/inbox/all"]'))), t && t.slice(0, 400));
    ok('Open lists Maya, not the answered Jean', /Maya Lee|@mayalee/.test(t) && !/Jean Tremblay/.test(t), t && t.slice(0, 500));
    await f.ev(() => { document.querySelector('#w225host [data-w250f="all"]').click(); }); await p.waitForTimeout(400);
    t = await f.ev(HOST);
    ok('Everything lists both', /@mayalee/.test(t) && /Jean Tremblay/.test(t));
    await f.ev(() => { document.querySelector('#w225host [data-w250open="11"]').click(); }); await p.waitForTimeout(900);
    t = await f.ev(HOST);
    ok('the conversation: both messages, the image link, the open window', /Are you serving this weekend/.test(t) && /Can I volunteer this Sunday/.test(t) && !!(await f.ev(() => document.querySelector('#w225host .w250conv a[href="https://lookaside.fbsbx.com/x.jpg"]'))) && /You can answer here until/.test(t), t && t.slice(0, 900));
    ok('opening an unread conversation marks it read', CALLS.length >= 0 && (await f.ev(() => (window.__CALLS || []).some(c => c[0] === 'social-dms' && c[1].action === 'dm_read' && c[1].id === 11))));
    await f.ev(() => { document.querySelector('#w225host [data-w250rp="11"]').click(); }); await p.waitForTimeout(300);
    await f.ev(() => { const ta = document.querySelector('#w225host [data-w250rtext="11"]'); ta.value = 'Yes! See you Sunday at noon.'; ta.dispatchEvent(new Event('input', { bubbles: true })); });
    await f.ev(() => { document.querySelector('#w225host [data-w250send="11"]').click(); }); await p.waitForTimeout(900);
    const rep = await f.ev(() => (window.__CALLS || []).filter(c => c[0] === 'social-dms' && c[1].action === 'dm_reply')[0]);
    ok('Send calls social-dms dm_reply with the text', rep && rep[1].id === 11 && rep[1].text === 'Yes! See you Sunday at noon.', rep);
    ok('a lead sees Remove', !!(await f.ev(() => document.querySelector('#w225host [data-w250act="dm_archive|11"]'))));
    await f.ev(() => { document.querySelector('#w225host [data-w250act="dm_archive|11"]').click(); }); await p.waitForTimeout(800);
    ok('Remove calls dm_archive', await f.ev(() => (window.__CALLS || []).some(c => c[0] === 'social-dms' && c[1].action === 'dm_archive' && c[1].id === 11)));
    await f.ev(() => { document.querySelector('#w225host [data-w250open="12"]').click(); }); await p.waitForTimeout(800);
    t = await f.ev(HOST);
    ok('an old conversation: no Reply, the window closed, Meta Business Suite', !(await f.ev(() => document.querySelector('#w225host [data-w250rp="12"]'))) && /More than 24 hours/.test(t), t && t.slice(0, 600));
    /* the rail */
    const rail = await f.ev(() => document.body.innerText);
    ok('the app menu lists Messages and Paid and organic', /Messages/.test(rail) && /Paid and organic/.test(rail));
    /* Paid and organic */
    await f.hash('#studio/ads', 1600);
    t = await f.ev(HOST);
    ok('Paid and organic: organic and paid side by side, 30 days', /Organic/i.test(t) && /Paid/i.test(t) && /\$60/.test(t) && /Instagram post: 10 DAYS AWAY/.test(t) && /link clicks/.test(t), t && t.slice(0, 700));
    await f.ev(() => { document.querySelector('#w225host [data-w250per="last7"]').click(); }); await p.waitForTimeout(400);
    t = await f.ev(HOST);
    ok('7 days: no ads ran, lifetime spend', /No ads ran in the last 7 days/.test(t) && /136\.96/.test(t), t && t.slice(0, 500));
    await f.ev(() => { document.querySelector('#w225host [data-w250adsync]').click(); }); await p.waitForTimeout(900);
    ok('Refresh asks social-ads to read 30 days', await f.ev(() => (window.__CALLS || []).some(c => c[0] === 'social-ads' && c[1].action === 'sync' && c[1].days === 30)));
    /* Connections */
    await f.hash('#studio/connections', 2000);
    await f.ev(() => { const a = document.querySelector('#w225host [data-w250cx="meta"]'); if (a) a.click(); }); await p.waitForTimeout(800);
    await f.ev(() => { const a = document.querySelector('#w225host [data-w250cx="wa"]'); if (a) a.click(); }); await p.waitForTimeout(800);
    t = await f.ev(HOST);
    ok('Meta, live: on, signed, Messenger readable, Instagram limited', /Meta, live/.test(t) && /On: feed, messages, leadgen/.test(t) && /Checked/.test(t) && /Limited until App Review/.test(t), t && t.slice(0, 900));
    ok('WhatsApp: the test number, off, the templates', /WhatsApp/.test(t) && /Meta’s test number/.test(t) && /serving reminder en: pending/.test(t) && /still in fr: approved/.test(t), t && t.slice(t.indexOf('WhatsApp'), t.indexOf('WhatsApp') + 600));
    await f.ev(() => { document.getElementById('w250wmode').value = 'test'; document.getElementById('w250wmode').dispatchEvent(new Event('change', { bubbles: true })); const i = document.getElementById('w250wtest'); i.value = '(514) 555-0123'; i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#w225host [data-w250cx="wasave"]').click(); });
    await p.waitForTimeout(900);
    const ups = await f.ev(() => (window.__W || []).filter(w => w[0] === 'app_config' && w[1] === 'update').map(w => w[2].value));
    ok('Save writes the mode, the channel and the test phone', JSON.stringify(ups) === JSON.stringify(['test', 'off', '5145550123']), ups);
    ok('no page errors (admin)', f.errs.length === 0, f.errs);
    await f.close();
  }
  /* 2. a marketing member: reads and answers, no Remove, no WhatsApp switches */
  {
    const f = await fresh(browser, { who: 'plain', width: 1366, hash: '#studio/messages', fixture: JSON.parse(JSON.stringify(FX)), rpcs: { wa225_publisher: false, wa225_marketing: true }, init: INIT, wait: 5000 });
    const p = f.page;
    await f.ev(() => { document.querySelector('#w225host [data-w250open="11"]').click(); }); await p.waitForTimeout(800);
    ok('a member: Reply yes, Remove no', !!(await f.ev(() => document.querySelector('#w225host [data-w250rp="11"]'))) && !(await f.ev(() => document.querySelector('#w225host [data-w250act="dm_archive|11"]'))));
    await f.hash('#studio/connections', 2000);
    await f.ev(() => { const a = document.querySelector('#w225host [data-w250cx="wa"]'); if (a) a.click(); }); await p.waitForTimeout(800);
    const t = await f.ev(HOST);
    ok('a member: WhatsApp without the switches; Meta details for admins', /An admin changes these/.test(t) && !(await f.ev(() => document.getElementById('w250wmode'))) && /Admins see the details here/.test(t), t && t.slice(0, 600));
    ok('no page errors (member)', f.errs.length === 0, f.errs);
    await f.close();
  }
  /* 3. a phone */
  {
    const f = await fresh(browser, { who: 'admin', width: 390, hash: '#studio/messages', fixture: JSON.parse(JSON.stringify(FX)), rpcs: { wa225_publisher: true, wa225_marketing: true }, init: INIT, wait: 5000 });
    const p = f.page;
    await f.ev(() => { document.querySelector('#w225host [data-w250open="11"]').click(); }); await p.waitForTimeout(800);
    const w = await f.ev(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    ok('phone: no sideways scroll on Messages', w.sw <= w.cw + 1, w);
    await f.hash('#studio/ads', 1500);
    const w2 = await f.ev(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    ok('phone: no sideways scroll on Paid and organic', w2.sw <= w2.cw + 1, w2);
    ok('no page errors (phone)', f.errs.length === 0, f.errs);
    await f.close();
  }
  console.log(out.join('\n'));
  console.log('w250drive: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
