/* =====================================================================
   WA v277 the Connections page (02/11/26)
   =====================================================================
   One list of every account the Hub posts to, read from the platform registry (studio_platforms, through social-connect
   status): a row per account in registry order (Instagram and Facebook share the Meta row), a status pill from the
   connection's health, the capability chips, and one action. Pressing a row opens its disclosure: who connected it and
   when, when it expires, scopes asked against granted, the console, the redirect address, the keys, and for LinkedIn the
   Make hook under Advanced. An attention strip lists what expires or fails. The Hub modal replaces confirm and prompt.

   wave225 keeps the page, the route and the state. It hands over through three hooks: its paint asks
   window.w277.connectHtml for the connections section, its connAct passes every action to window.w277.connAct, and its
   loadConn keeps the registry in S.platforms. wave277 reads that state through window.w225.state() and repaints with
   window.w225.paint(). Test: test/w277drive.js with test/fx_w277.json.
   ===================================================================== */
(function () {
  if (window.__wa277) return; window.__wa277 = true;
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var GREEN = 'var(--wa-green,#103F39)', GOLD = 'var(--wa-gold,#DCA527)', CARD = 'var(--wa-card,#FFFAF2)', MUTED = 'var(--wa-muted,#797773)', FLAG = 'var(--wa-flag,#b3402f)';
  var INK = '#1F201E', TEAL = '#2A8C7A', WARN = '#8a5a00';   /* wave225's ink, teal and reminder brown */
  var OUT = 'cubic-bezier(.23,1,.32,1)', LINE = 'rgba(16,63,57,.11)', SURF = 'rgba(16,63,57,.05)', SURF2 = 'rgba(16,63,57,.1)';
  var DAY = 86400000;
  var LINE_TEXT = 'Every account the Hub posts to, and what each one can carry.';
  var META = ['instagram', 'facebook'];

  /* wave277's own state: which row is open, which actions are running, the last pill text per row */
  var S277 = { open: null, busy: {}, pills: {}, held: null };

  /* ---------- small helpers (copied, not imported: wave225 keeps its own closure) ---------- */
  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toastS(m) { try { if (typeof toast === 'function') toast(m); } catch (e) { /* fine */ } }
  function dateOf(iso) { if (!iso) return ''; try { return new Date(iso).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return String(iso).slice(0, 10); } }
  function ago(iso) { if (!iso) return ''; var m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago'; var h = Math.round(m / 60); if (h < 24) return h + ' h ago'; var d = Math.round(h / 24); return d === 1 ? 'yesterday' : d + ' days ago'; }
  function who(email) {
    try { var m = ((typeof DB_MEMBERS !== 'undefined' && DB_MEMBERS) || []).filter(function (x) { return x && x.email && String(x.email).toLowerCase() === String(email || '').toLowerCase(); })[0]; if (m && m.name) return m.name; } catch (e) { /* below */ }
    return String(email || '').split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function fn(name, body) {
    var call = typeof window.__WA_INVOKE === 'function' ? Promise.resolve().then(function () { return window.__WA_INVOKE(name, { body: body }); }) : db.functions.invoke(name, { body: body });
    return Promise.resolve(call).then(function (r) {
      r = r || {};
      if (r.error) { var m = r.error.message || String(r.error); try { if (r.error.context && r.error.context.json) return r.error.context.json().then(function (j) { throw new Error((j && j.error) || m); }); } catch (x) { /* below */ } throw new Error(m); }
      if (r.data && r.data.error) throw new Error(r.data.error);
      return r.data;
    });
  }

  /* ---------- wave225's state, through its test hook ---------- */
  function w() { return window.w225 || null; }
  function St() { var x = w(); return x && x.state ? x.state() : null; }
  function paint() { var x = w(); if (x && x.paint) x.paint(); }
  function W121() { var x = w(); return x && x.W ? x.W() : (window.w121 || null); }
  function loadConn() { var x = w(); return x && x.loadConn ? x.loadConn() : Promise.resolve(); }
  async function loadCap() { var c = W121(); if (c && c.loadCap) { try { await c.loadCap(); } catch (e) { /* the page still reads */ } } }
  function conn() { var S = St(); return (S && S.conn) || null; }
  function connOf(k) { var c = conn(); return (c && c.connections && c.connections[k]) || {}; }
  function canChange() { var c = conn(); return !!(c && c.can_change); }
  function canMeta() { var c = conn(); return !!(c && c.can_meta); }
  function platforms() {
    var S = St(), list = (S && S.platforms && S.platforms.length ? S.platforms : (conn() && conn().platforms)) || [];
    return list.filter(function (p) { return p && p.key && p.active !== false; }).slice().sort(function (a, b) { return (a.sort || 0) - (b.sort || 0); });
  }
  function platOf(k) { return platforms().filter(function (p) { return p.key === k; })[0] || null; }
  function labelOf(k) { var p = platOf(k); return p ? p.label : k === 'meta' ? 'Meta' : k === 'make' ? 'the Make route' : k; }
  function redirect() { var c = conn(); return (c && c.redirect_uri) || 'https://zwnmulmnvopclzcvytce.supabase.co/functions/v1/social-connect'; }
  function metaCap() { var c = W121(); var x = c && c.cap ? c.cap() : null; if (!x) { var S = St(); x = S && S.cap; } return x || {}; }

  /* ---------- health and the pill ---------- */
  function daysTo(iso) { return Math.ceil((new Date(iso).getTime() - Date.now()) / DAY); }
  function healthOf(c) {
    if (!c || c.status !== 'connected') return 'not_connected';
    var h = c.health && c.health !== 'not_connected' ? c.health : 'ok';
    if (c.expires_at && daysTo(c.expires_at) <= 0) return 'expired';
    return h;
  }
  function expiresText(c) { var n = Math.max(1, daysTo(c.expires_at)); return 'Expires in ' + n + (n === 1 ? ' day' : ' days'); }
  function metaState() {
    var c = connOf('meta'), cx = metaCap(), missing = c.missing || cx.missing || [];
    if (c.token === false || (c.token == null && cx.token === false)) return 'none';
    return missing.length ? 'missing' : 'ok';
  }
  /* [text, tone]: tone is ok, warn, flag or quiet */
  function pillOf(k) {
    if (k === 'meta') { var m = metaState(); return m === 'none' ? ['Not connected', 'quiet'] : m === 'missing' ? ['Needs attention', 'flag'] : ['Connected', 'ok']; }
    var c = connOf(k), h = healthOf(c), p = platOf(k) || {};
    if (h === 'expired') return ['Expired', 'flag'];
    if (h === 'expiring') return [c.expires_at ? expiresText(c) : 'Expires soon', 'warn'];
    if (h === 'error') return ['Needs attention', 'flag'];
    if (c.mode === 'drafts' && (p.modes || {}).drafts) return ['To ' + p.label + ' drafts', 'ok'];
    if (c.mode === 'make' && (p.modes || {}).make) return ['Through Make', 'ok'];
    return h === 'not_connected' ? ['Not connected', 'quiet'] : ['Connected', 'ok'];
  }
  /* scopes the registry asks for against the ones the platform granted */
  function scopesOf(k) {
    var p = platOf(k), c = connOf(k); if (!p || c.status !== 'connected') return null;
    var asked = p.scopes || []; if (!asked.length) return null;
    if (!Array.isArray(c.scopes_granted)) return null;   /* not reported: nothing to compare */
    var got = c.scopes_granted;
    return { n: asked.length, m: asked.filter(function (s) { return got.indexOf(s) >= 0; }).length };
  }
  function attention() {
    return platforms().filter(function (p) { return p.auth === 'oauth'; }).map(function (p) {
      var c = connOf(p.key), h = healthOf(c);
      if (h === 'expiring') return { k: p.key, label: p.label, why: c.expires_at ? expiresText(c) : 'Expires soon', act: 'reconnect', btn: 'Reconnect' };
      if (h === 'expired') return { k: p.key, label: p.label, why: 'Expired', act: 'reconnect', btn: 'Reconnect' };
      if (h === 'error') return { k: p.key, label: p.label, why: c.last_error || 'The last check failed', act: 'health', btn: 'Check again' };
      return null;
    }).filter(Boolean);
  }
