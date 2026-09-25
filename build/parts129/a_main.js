/* =====================================================================
   WA v129 analytics depth (25/09/26): every number the platforms keep, as far back as they keep it
   =====================================================================
   Steel: "more granular data from Instagram and Facebook", "even do WhatsApp maybe", and "look as far
   back as possible in time for analytics and have all analytics, as many as possible, visible to me."
   - Ranges (wave120 edited): 7, 30 and 90 days, 6 months, 1 year, 2 years, all time, or two dates;
     longer ranges chart by week or by month (social_range() in wa129).
   - History: social-pull v1.6 walks Facebook and Instagram back two years (the most Meta keeps),
     every Facebook post and every Instagram post and reel with its numbers, and the website since
     the property started. The coverage card shows how far back each platform goes, with Load more
     history for staff.
   - Every post: a table of every post in the range with reach, views, likes, comments, shares,
     saves and the engagement rate; filter by platform, type and words, sort by any column, and
     download it as a CSV. The daily numbers download as a CSV too.
   - Audience: Instagram followers by age, gender, city and country (weekly, from the API); LinkedIn
     followers and visitors by industry, seniority, function, location and company size (the export).
     Meta no longer gives Facebook Page audiences.
   - LinkedIn: set the follower total once and the Hub rebuilds the year of totals from the daily
     new followers in the export.
   - WhatsApp: the check says whether a WhatsApp Business account is shared with the Hub and what to
     do if not.
   ===================================================================== */
(function () {
  if (window.__wa129) return; window.__wa129 = true;
  var GREEN = '#103F39', CREAM = '#FFFAF2', GOLD = '#DCA527', FLAG = '#B3402F', TEAL = '#2A8C7A', PURPLE = '#6F64AB', INK = '#1F201E';
  var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
  var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
  var PL = {
    instagram: ['Instagram', '#C13584', 'IG'], facebook: ['Facebook', '#1877F2', 'f'], linkedin: ['LinkedIn', '#0A66C2', 'in'],
    tiktok: ['TikTok', '#111111', 'TT'], ga4: ['Website', TEAL, 'W'], youtube: ['YouTube', '#FF0000', 'YT'], whatsapp: ['WhatsApp', '#25D366', 'WA']
  };
  var COLS = [['published_at', 'Date'], ['reach', 'Reach'], ['views', 'Views'], ['likes', 'Likes'], ['comments', 'Comments'], ['shares', 'Shares'], ['saves', 'Saves'], ['clicks', 'Clicks'], ['engagement', 'Engaged'], ['rate', 'Rate']];
  var X = { q: '', plat: '', kind: '', sort: 'published_at', dir: -1, show: 25, busy: {}, wa: null, liTotal: '', aud: 'followers', open: { coverage: true, explorer: true, audience: true }, run: null };
  function E(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function num(v) { v = Number(v); if (!isFinite(v)) return '–'; var a = Math.abs(v); if (a >= 1e6) return (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'; if (a >= 1e4) return Math.round(v / 1e3) + 'k'; if (a >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'k'; return String(Math.round(v)); }
  function staff() { try { return typeof isStaff === 'function' && isStaff(); } catch (e) { return false; } }
  function toastS(m) { try { if (typeof toast === 'function') toast(m); } catch (e) { /* fine */ } }
  function data() { try { return (window.w120 && window.w120.data()) || null; } catch (e) { return null; } }
  function mk(p) { var c = PL[p] || [p, GREEN, '?']; return '<span class="w129mk" style="background:' + c[1] + '">' + E(c[2]) + '</span>'; }
  function label(p) { return (PL[p] || [p])[0]; }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function day(iso) { if (!iso) return ''; var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso)); return m ? MON[Number(m[2]) - 1] + ' ' + Number(m[3]) + ', ' + m[1] : String(iso); }
  function monthY(iso) { var m = /^(\d{4})-(\d{2})/.exec(String(iso || '')); return m ? MON[Number(m[2]) - 1] + ' ' + m[1] : ''; }
  function engOf(p) { var e = Number(p.engagement); if (p.engagement != null && isFinite(e) && e > 0) return e; var s = 0, any = false; ['likes', 'comments', 'shares', 'saves'].forEach(function (k) { if (p[k] != null && isFinite(Number(p[k]))) { s += Number(p[k]); any = true; } }); return any ? s : null; }
  function rateOf(p) { var e = engOf(p), r = Number(p.reach) || Number(p.views) || 0; return e != null && r > 0 ? e / r : null; }
  function csvCell(v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function download(name, rows) {
    var text = rows.map(function (r) { return r.map(csvCell).join(','); }).join('\n');
    try { var blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }); var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400); toastS('Downloaded ' + name); }
    catch (e) { toastS('Could not download it'); }
  }

  /* ---------- styles ---------- */
  var css = document.createElement('style'); css.id = 'wa129css';
  css.textContent = ''
    + '#w129{font-family:' + BODY + ';}'
    + '#w129 .cardy h4 .sub{font-family:' + BODY + ';font-size:12px;font-weight:500;color:var(--wa-muted);}'
    + '#w129 .cardy h4 .sp{flex:1;}'
    + '.w129mk{width:24px;height:24px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-family:' + HEAD + ';font-size:11.5px;font-weight:800;color:#fff;flex:none;text-transform:none;letter-spacing:0;}'
    + '.w129btn{display:inline-flex;align-items:center;gap:6px;font-family:' + BODY + ';font-size:12.5px;font-weight:700;background:' + GREEN + ';color:' + CREAM + ' !important;border:1px solid ' + GREEN + ';border-radius:9px;padding:6px 11px;cursor:pointer;text-decoration:none !important;white-space:nowrap;}'
    + '.w129btn.ghost{background:transparent;color:' + GREEN + ' !important;border-color:rgba(16,63,57,.22);}'
    + '.w129btn[disabled]{opacity:.55;cursor:default;}'
    /* coverage */
    + '.w129cov{display:grid;grid-template-columns:28px minmax(150px,.9fr) minmax(0,2fr) auto;column-gap:12px;}'
    + '.w129cov .r{display:grid;grid-column:1/-1;grid-template-columns:subgrid;align-items:center;padding:10px 0;border-top:1px solid rgba(16,63,57,.07);}'
    + '.w129cov .r:first-child{border-top:none;}'
    + '.w129cov .r b{font-size:13.5px;}'
    + '.w129cov .r .m{font-size:12.5px;color:#5c5a56;line-height:1.45;}'
    + '.w129cov .r .m em{font-style:normal;font-weight:700;color:' + INK + ';}'
    + '.w129cov .st{font-size:11px;font-weight:700;letter-spacing:.3px;border-radius:999px;padding:3px 9px;white-space:nowrap;background:rgba(42,140,122,.14);color:#1c6b5d;}'
    + '.w129cov .st.run{background:rgba(220,165,39,.22);color:#6b4d05;}'
    + '.w129cov .st.csv{background:rgba(16,63,57,.08);color:' + GREEN + ';}'
    + '.w129cov .st.off{background:rgba(121,119,115,.14);color:#5c5a56;}'
    + '.w129cov .act{display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end;}'
    + '.w129cov .act input{width:132px;font-size:12.5px;padding:5px 8px;border:1px solid rgba(16,63,57,.2);border-radius:8px;}'
    + '.w129bar{height:6px;border-radius:3px;background:rgba(16,63,57,.08);overflow:hidden;margin-top:6px;}'
    + '.w129bar i{display:block;height:100%;background:' + GOLD + ';}'
    + '.w129foot{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px;font-size:12px;color:var(--wa-muted);}'
    + '.w129foot .sp{flex:1;}'
    /* explorer */
    + '.w129tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 10px;}'
    + '.w129tools .chips{display:flex;gap:5px;flex-wrap:wrap;}'
    + '.w129tools .chips a{font-size:12px;font-weight:600;border-radius:999px;padding:5px 11px;background:rgba(16,63,57,.06);color:' + GREEN + ';cursor:pointer;text-decoration:none;}'
    + '.w129tools .chips a.on{background:' + GREEN + ';color:' + CREAM + ';}'
    + '.w129tools input[type=search],.w129tools select{font-size:12.5px;padding:6px 9px;border:1px solid rgba(16,63,57,.2);border-radius:9px;background:#fff;}'
    + '.w129tools input[type=search]{min-width:180px;flex:1 1 180px;}'
    + '.w129tbl{width:100%;border-collapse:collapse;font-size:12.8px;}'
    + '.w129wrap{overflow-x:auto;}'
    + '.w129tbl th{text-align:right;font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--wa-muted);padding:7px 8px;border-bottom:1px solid rgba(16,63,57,.12);cursor:pointer;white-space:nowrap;user-select:none;}'
    + '.w129tbl th:first-child,.w129tbl th.l{text-align:left;}'
    + '.w129tbl th.on{color:' + GREEN + ';}'
    + '.w129tbl td{padding:8px;border-bottom:1px solid rgba(16,63,57,.06);text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;}'
    + '.w129tbl td.p{text-align:left;white-space:normal;min-width:280px;}'
    + '.w129tbl td.p .in{display:flex;gap:10px;align-items:flex-start;}'
    + '.w129tbl td.p img,.w129tbl td.p .ph{width:44px;height:44px;border-radius:8px;object-fit:cover;flex:none;background:rgba(16,63,57,.06);display:flex;align-items:center;justify-content:center;}'
    + '.w129tbl td.p .cap{font-size:12.8px;line-height:1.4;color:' + INK + ';display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}'
    + '.w129tbl td.p .mt{font-size:11.5px;color:var(--wa-muted);margin-top:3px;display:flex;gap:6px;align-items:center;}'
    + '.w129tbl td.p .mt .w129mk{width:16px;height:16px;border-radius:5px;font-size:8.5px;}'
    + '.w129tbl tr:hover td{background:rgba(220,165,39,.06);}'
    + '.w129tbl td a{color:inherit;text-decoration:none;}'
    + '.w129tbl td.rt b{color:' + GREEN + ';}'
    + '.w129tools .w129ss{display:none;}'
    + '@media (max-width:640px){.w129tools .w129ss{display:inline-block;}.w129tbl thead{display:none;}.w129tbl,.w129tbl tbody{display:block;}.w129tbl tr{display:flex;flex-wrap:wrap;gap:4px 14px;padding:10px 0;border-bottom:1px solid rgba(16,63,57,.08);}.w129tbl td{display:none;border:0;padding:0;}.w129tbl td.p{display:block;width:100%;min-width:0;}.w129tbl td.k{display:inline-block;font-size:12.5px;}.w129tbl td.k::before{content:attr(data-l) " ";font-size:11px;color:var(--wa-muted);}.w129tbl tr:hover td{background:none;}}'
    + '.w129sum{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:#5c5a56;margin:0 0 10px;}'
    + '.w129sum b{font-family:' + HEAD + ';font-size:17px;color:' + GREEN + ';margin-right:3px;}'
    /* audience */
    + '.w129aud{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;}'
    + '.w129aud .b{background:rgba(16,63,57,.035);border-radius:14px;padding:12px 14px;}'
    + '.w129aud .b h5{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:' + GREEN + ';margin:0 0 8px;}'
    + '.w129aud .row{display:grid;grid-template-columns:minmax(0,1fr) 44px;gap:8px;align-items:center;font-size:12.5px;margin:0 0 5px;}'
    + '.w129aud .row .t{min-width:0;}'
    + '.w129aud .row .t span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}'
    + '.w129aud .row .t i{display:block;height:6px;border-radius:3px;background:var(--c,' + GREEN + ');margin-top:3px;}'
    + '.w129aud .row b{text-align:right;font-variant-numeric:tabular-nums;}'
    + '#w129 .w129note{font-size:12px;color:var(--wa-muted);line-height:1.45;margin:6px 0 0;background:none;padding:0;border:0;box-shadow:none;}'
    + '.w129seg{display:inline-flex;background:rgba(16,63,57,.08);border-radius:10px;padding:3px;gap:2px;}'
    + '.w129seg a{font-size:12px;font-weight:600;color:' + GREEN + ';padding:5px 10px;border-radius:8px;cursor:pointer;text-decoration:none;}'
    + '.w129seg a.on{background:#fff;box-shadow:0 1px 2px rgba(16,63,57,.12);}'
    + '@media (max-width:760px){.w129cov{grid-template-columns:28px minmax(0,1fr);}.w129cov .r{row-gap:6px;}.w129cov .r .m,.w129cov .r .act{grid-column:2;}.w129cov .act{justify-content:flex-start;}}';
  document.head.appendChild(css);
