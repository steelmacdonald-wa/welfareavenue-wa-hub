-- wave297b page: the org chart in the brand (Community green co-ED cards, cream team cards, gold count and rule), a once-per-visit
-- entrance (reduced-motion safe), press feedback, and the board row in governance order with the President of the Board leading.
-- Edits only the four places it changes, each of which must appear exactly once, so later releases (wave302) don't block it.
do $do$
declare whole text; k int;
begin
  select string_agg(content, '' order by part) into whole from public.site_files where path = 'index.html';
  if position('w297rank' in whole) > 0 then raise notice 'wave297b already on the page'; return; end if;
  if position('/* the org chart tree (parts133 treeHtml) */' in whole) = 0 then raise exception 'wave297 is not on the page. Nothing changed.'; end if;
  update public.site_files set content = replace(content, $w297b$    /* the org chart tree (parts133 treeHtml) */
    + '#w133 .w297row{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;align-items:start;}'
    + '#w133 .w297br{position:relative;min-width:0;}#w133 .w297top .w133c{padding:12px 14px;background:rgba(16,63,57,.06);}#w133 .w297top .w133c b{font-size:15.5px;}'
    + '#w133 .w297teams{margin:0 0 0 22px;padding:10px 0 0 12px;border-left:2px solid rgba(16,63,57,.18);display:flex;flex-direction:column;gap:10px;}'
    + '#w133 .w297tm{position:relative;background:#fff;border-radius:14px;border-top:3px solid var(--tc,#103F39);padding:8px 8px 10px;box-shadow:0 1px 2px rgba(16,63,57,.08);min-width:0;}'
    + '#w133 .w297tm::before{content:"";position:absolute;left:-14px;top:18px;width:12px;height:2px;background:rgba(16,63,57,.18);}'
    + '#w133 .w297tm h4{margin:2px 4px 6px;font-family:"Barlow Condensed",sans-serif;font-size:16px;font-weight:600;text-transform:uppercase;letter-spacing:.3px;color:var(--tc,#103F39);display:flex;gap:6px;align-items:baseline;flex-wrap:wrap;}'
    + '#w133 .w297tm h4 span{font-family:inherit;font-size:11.5px;font-weight:500;text-transform:none;letter-spacing:0;color:#797773;}'
    + '#w133 .w297shh{padding:12px 14px;border-radius:14px;border:1px dashed rgba(16,63,57,.3);display:flex;flex-direction:column;gap:2px;}#w133 .w297shh span{color:#797773;font-size:12.5px;}'
    + '#w133 .w297none{margin:8px 0 0 22px;color:#797773;font-size:13px;}'
    + '#w133 .w297tree .w297tm .w133tag:not(.tm){display:none;}';$w297b$, $w297b$    /* the org chart tree (parts133 treeHtml), in the brand: the co-EDs on Community green with Dignity cream type,
       a short Action gold rule under the heading, connectors at 20% green, muted text as Ground at 65% */
    + '#w133 .w297tree>h3{position:relative;padding-bottom:10px;}#w133 .w297tree>h3::after{content:"";position:absolute;left:0;bottom:0;width:40px;height:3px;border-radius:2px;background:#DCA527;}'
    + '#w133 .w297row{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;align-items:start;margin-top:4px;}'
    + '#w133 .w297br{position:relative;min-width:0;}'
    + '#w133 .w297top .w133c{padding:14px 16px;background:#103F39;color:#FFFAF2;border-radius:14px;box-shadow:0 2px 10px rgba(16,63,57,.18);}'
    + '#w133 .w297top .w133c b{font-size:16px;color:#FFFAF2;}#w133 .w297top .w133c .tx>span{color:rgba(255,250,242,.78);}'
    + '#w133 .w297top .w133c .cnt{background:#DCA527;color:#103F39;min-width:22px;height:22px;padding:0 7px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;font-size:12px;margin-top:0;}'
    + '#w133 .w297teams{position:relative;margin:0 0 0 24px;padding:12px 0 0 14px;display:flex;flex-direction:column;gap:10px;}'
    + '#w133 .w297teams::before{content:"";position:absolute;left:0;top:0;bottom:22px;width:2px;border-radius:2px;background:rgba(16,63,57,.2);transform-origin:top;}'
    + '#w133 .w297tm{position:relative;background:#FFFAF2;border-radius:12px;border:1px solid rgba(16,63,57,.12);border-top:3px solid var(--tc,#103F39);padding:8px 8px 10px;min-width:0;}'
    + '#w133 .w297tm::before{content:"";position:absolute;left:-15px;top:19px;width:13px;height:2px;border-radius:2px;background:rgba(16,63,57,.2);transform-origin:left;}'
    + '#w133 .w297tm h4{margin:2px 4px 6px;font-family:"Barlow Condensed","Arial Narrow",sans-serif;font-size:17px;font-weight:500;text-transform:uppercase;letter-spacing:.4px;color:#103F39;display:flex;gap:6px;align-items:baseline;flex-wrap:wrap;}'
    + '#w133 .w297tm h4::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--tc,#103F39);align-self:center;}'
    + '#w133 .w297tm h4 span{font-family:"Space Grotesk",sans-serif;font-size:11.5px;font-weight:500;text-transform:none;letter-spacing:0;color:rgba(31,32,30,.65);}'
    + '#w133 .w297shh{padding:13px 16px;border-radius:14px;border:1.5px dashed rgba(16,63,57,.35);background:#FFFAF2;display:flex;flex-direction:column;gap:2px;}'
    + '#w133 .w297shh b{font-family:"Barlow Condensed","Arial Narrow",sans-serif;font-weight:500;font-size:17px;text-transform:uppercase;letter-spacing:.4px;color:#103F39;}#w133 .w297shh span{color:rgba(31,32,30,.65);font-size:12.5px;}'
    + '#w133 .w297none{margin:10px 0 0 24px;color:rgba(31,32,30,.65);font-size:13px;}'
    + '#w133 .w297tree .w297tm .w133tag:not(.tm){display:none;}'
    /* the President of the Board leads the board row: Community green with a gold ring, cream type */
    + '#w133 .w133bchip.lead{background:#103F39;border-color:#DCA527;box-shadow:0 0 0 2px rgba(220,165,39,.35);}#w133 .w133bchip.lead b{color:#FFFAF2;}#w133 .w133bchip.lead .r{color:#DCA527;}'
    /* press feedback on every card (they open a sheet); hover lift only with a real pointer; none while rearranging */
    + '#w133 .w133c{transition:transform 160ms cubic-bezier(.23,1,.32,1),box-shadow 200ms ease;}'
    + '#w133:not(.arr) .w133c:active{transform:scale(.98);}'
    + '@media (hover:hover) and (pointer:fine){#w133:not(.arr) .w297tm .w133c:hover{box-shadow:0 3px 12px rgba(16,63,57,.12);}}'
    /* the first look at the chart: the columns rise in, then each line draws down to its teams; once per visit */
    + '@keyframes w297up{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}'
    + '@keyframes w297down{from{transform:scaleY(0);}to{transform:scaleY(1);}}'
    + '@keyframes w297across{from{transform:scaleX(0);}to{transform:scaleX(1);}}'
    + '#w133 .w297in .w297br{animation:w297up 320ms cubic-bezier(.23,1,.32,1) both;animation-delay:calc(var(--i,0) * 60ms);}'
    + '#w133 .w297in .w297teams::before{animation:w297down 420ms cubic-bezier(.23,1,.32,1) both;animation-delay:calc(var(--i,0) * 60ms + 140ms);}'
    + '#w133 .w297in .w297tm{animation:w297up 280ms cubic-bezier(.23,1,.32,1) both;animation-delay:calc(var(--i,0) * 60ms + 200ms + var(--j,0) * 45ms);}'
    + '#w133 .w297in .w297tm::before{animation:w297across 220ms cubic-bezier(.23,1,.32,1) both;animation-delay:calc(var(--i,0) * 60ms + 200ms + var(--j,0) * 45ms);}'
    + '@media (prefers-reduced-motion:reduce){#w133 .w297in .w297br,#w133 .w297in .w297tm{animation:w297fade 200ms ease both;animation-delay:0ms;}#w133 .w297in .w297teams::before,#w133 .w297in .w297tm::before{animation:none;}#w133 .w133c{transition:none;}}'
    + '@keyframes w297fade{from{opacity:0;}to{opacity:1;}}';$w297b$), updated_at = now()
    where path = 'index.html' and (length(content) - length(replace(content, $w297b$    /* the org chart tree (parts133 treeHtml) */
    + '#w133 .w297row{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;align-items:start;}'
    + '#w133 .w297br{position:relative;min-width:0;}#w133 .w297top .w133c{padding:12px 14px;background:rgba(16,63,57,.06);}#w133 .w297top .w133c b{font-size:15.5px;}'
    + '#w133 .w297teams{margin:0 0 0 22px;padding:10px 0 0 12px;border-left:2px solid rgba(16,63,57,.18);display:flex;flex-direction:column;gap:10px;}'
    + '#w133 .w297tm{position:relative;background:#fff;border-radius:14px;border-top:3px solid var(--tc,#103F39);padding:8px 8px 10px;box-shadow:0 1px 2px rgba(16,63,57,.08);min-width:0;}'
    + '#w133 .w297tm::before{content:"";position:absolute;left:-14px;top:18px;width:12px;height:2px;background:rgba(16,63,57,.18);}'
    + '#w133 .w297tm h4{margin:2px 4px 6px;font-family:"Barlow Condensed",sans-serif;font-size:16px;font-weight:600;text-transform:uppercase;letter-spacing:.3px;color:var(--tc,#103F39);display:flex;gap:6px;align-items:baseline;flex-wrap:wrap;}'
    + '#w133 .w297tm h4 span{font-family:inherit;font-size:11.5px;font-weight:500;text-transform:none;letter-spacing:0;color:#797773;}'
    + '#w133 .w297shh{padding:12px 14px;border-radius:14px;border:1px dashed rgba(16,63,57,.3);display:flex;flex-direction:column;gap:2px;}#w133 .w297shh span{color:#797773;font-size:12.5px;}'
    + '#w133 .w297none{margin:8px 0 0 22px;color:#797773;font-size:13px;}'
    + '#w133 .w297tree .w297tm .w133tag:not(.tm){display:none;}';$w297b$, ''))) / length($w297b$    /* the org chart tree (parts133 treeHtml) */
    + '#w133 .w297row{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;align-items:start;}'
    + '#w133 .w297br{position:relative;min-width:0;}#w133 .w297top .w133c{padding:12px 14px;background:rgba(16,63,57,.06);}#w133 .w297top .w133c b{font-size:15.5px;}'
    + '#w133 .w297teams{margin:0 0 0 22px;padding:10px 0 0 12px;border-left:2px solid rgba(16,63,57,.18);display:flex;flex-direction:column;gap:10px;}'
    + '#w133 .w297tm{position:relative;background:#fff;border-radius:14px;border-top:3px solid var(--tc,#103F39);padding:8px 8px 10px;box-shadow:0 1px 2px rgba(16,63,57,.08);min-width:0;}'
    + '#w133 .w297tm::before{content:"";position:absolute;left:-14px;top:18px;width:12px;height:2px;background:rgba(16,63,57,.18);}'
    + '#w133 .w297tm h4{margin:2px 4px 6px;font-family:"Barlow Condensed",sans-serif;font-size:16px;font-weight:600;text-transform:uppercase;letter-spacing:.3px;color:var(--tc,#103F39);display:flex;gap:6px;align-items:baseline;flex-wrap:wrap;}'
    + '#w133 .w297tm h4 span{font-family:inherit;font-size:11.5px;font-weight:500;text-transform:none;letter-spacing:0;color:#797773;}'
    + '#w133 .w297shh{padding:12px 14px;border-radius:14px;border:1px dashed rgba(16,63,57,.3);display:flex;flex-direction:column;gap:2px;}#w133 .w297shh span{color:#797773;font-size:12.5px;}'
    + '#w133 .w297none{margin:8px 0 0 22px;color:#797773;font-size:13px;}'
    + '#w133 .w297tree .w297tm .w133tag:not(.tm){display:none;}';$w297b$) = 1;
  get diagnostics k = row_count; if k <> 1 then raise exception 'wave297b: edit 1 matched % parts. Nothing changed.', k; end if;
  update public.site_files set content = replace(content, $w297b$  window.w297 = { state: function () { return S; }, paint: paint, reload: function () { return load(true); } };$w297b$, $w297b$  /* the org chart's entrance: once per visit to #orgchart. The chart redraws two or three times in the first few
     milliseconds as data lands, so any tree drawn within 250ms of the first one gets the entrance too (invisible
     restart); after that, redraws from search, filters and Show more stay still. */
  var orgT0 = 0, orgLast = null;
  function orgIn() {
    if (String(location.hash || '').indexOf('#orgchart') !== 0) { orgT0 = 0; orgLast = null; return; }
    var tree = document.querySelector('#w133 .w297tree'); if (!tree || tree === orgLast) return;
    orgLast = tree;
    var now = Date.now(); if (!orgT0) orgT0 = now;
    if (now - orgT0 > 250) return;
    tree.querySelectorAll('.w297br').forEach(function (b, i) {
      b.style.setProperty('--i', String(i));
      b.querySelectorAll('.w297tm').forEach(function (t, j) { t.style.setProperty('--j', String(Math.min(j, 6))); });
    });
    tree.classList.add('w297in');
    setTimeout(function () { tree.classList.remove('w297in'); }, 1400);
  }
  new MutationObserver(orgIn).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', orgIn);
  window.w297 = { state: function () { return S; }, paint: paint, reload: function () { return load(true); } };$w297b$), updated_at = now()
    where path = 'index.html' and (length(content) - length(replace(content, $w297b$  window.w297 = { state: function () { return S; }, paint: paint, reload: function () { return load(true); } };$w297b$, ''))) / length($w297b$  window.w297 = { state: function () { return S; }, paint: paint, reload: function () { return load(true); } };$w297b$) = 1;
  get diagnostics k = row_count; if k <> 1 then raise exception 'wave297b: edit 2 matched % parts. Nothing changed.', k; end if;
  update public.site_files set content = replace(content, $w297b$(board.length ? board.map(function (m) { return '<button type="button" class="w133bchip" data-w133m=$w297b$, $w297b$(board.length ? board.slice().sort(function (a, b) { return w297rank(a) - w297rank(b); }).map(function (m) { return '<button type="button" class="w133bchip' + (w297rank(m) === 0 ? ' lead' : '') + '" data-w133m=$w297b$), updated_at = now()
    where path = 'index.html' and (length(content) - length(replace(content, $w297b$(board.length ? board.map(function (m) { return '<button type="button" class="w133bchip" data-w133m=$w297b$, ''))) / length($w297b$(board.length ? board.map(function (m) { return '<button type="button" class="w133bchip" data-w133m=$w297b$) = 1;
  get diagnostics k = row_count; if k <> 1 then raise exception 'wave297b: edit 3 matched % parts. Nothing changed.', k; end if;
  update public.site_files set content = replace(content, $w297b$  /* wave297 (09/11/26): the tree.$w297b$, $w297b$  /* wave297b: the board row in governance order. The President of the Board leads, then the officers, then members and advisers. */
  function w297rank(m) { var r = String(m.role || '').toLowerCase(); if (r.indexOf('president') >= 0) return 0; if (/chair|treasurer|secretary|vice/.test(r)) return 1; if (r.indexOf('advis') >= 0) return 3; return 2; }
  /* wave297 (09/11/26): the tree.$w297b$), updated_at = now()
    where path = 'index.html' and (length(content) - length(replace(content, $w297b$  /* wave297 (09/11/26): the tree.$w297b$, ''))) / length($w297b$  /* wave297 (09/11/26): the tree.$w297b$) = 1;
  get diagnostics k = row_count; if k <> 1 then raise exception 'wave297b: edit 4 matched % parts. Nothing changed.', k; end if;
  select string_agg(content, '' order by part) into whole from public.site_files where path = 'index.html';
  if position('w297rank' in whole) = 0 or position('w297in' in whole) = 0 or position('/* the org chart tree (parts133 treeHtml) */' in whole) > 0 then raise exception 'wave297b: unexpected result. Rolled back.'; end if;
  insert into public.change_log (entity_type, entity_id, field, old_value, new_value, changed_by) values ('release', 'wave297b', 'index.html', md5(whole), 'the org chart in the WA brand with a once-per-visit entrance; board row led by the President of the Board.', 'wave297b');
end $do$;
select public.call_edge('host-sync', '{}'::jsonb);
