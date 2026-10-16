/* Welfare Avenue website: campaign pages (15/10/26, the Holiday Gift Basket Drive page). Draws a campaign's progress from
   the Hub (rpc www_campaign_totals: raised, donors, gifts, the goals; aggregates only, anonymous by design) into the block
   marked data-campaign="<slug>". The page's own words stay when the Hub cannot be reached. A bar shows only when the
   campaign has a money goal in the Hub (app_config donate_campaigns). After a gift in the donation popup (give/embed.js sends
   wa-donate-done), the progress is read again a few seconds later, once Stripe has told the Hub.
   No inline scripts or styles: the Content-Security-Policy allows neither. */
(function () {
  'use strict';
  var box = document.querySelector('[data-campaign]');
  if (!box || !window.fetch) return;
  var B = document.body, FR = (B.getAttribute('data-lang') || 'en') === 'fr', SUPA = B.getAttribute('data-supa') || '', KEY = B.getAttribute('data-key') || '';
  var slug = box.getAttribute('data-campaign') || '';
  if (!SUPA || !KEY || !/^[a-z0-9][a-z0-9-]{0,39}$/.test(slug)) return;
  var T = FR ? {
    first: 'Soyez parmi les premiers à donner à la collecte cette année.',
    people: function (n) { return n === 1 ? 'Une personne a donné jusqu’ici. Merci!' : num(n) + ' personnes ont donné jusqu’ici. Merci!'; },
    of: function (r, g) { return r + ' sur ' + g; }
  } : {
    first: 'Be one of the first to give to this year’s drive.',
    people: function (n) { return n === 1 ? 'One person has given so far. Thank you!' : num(n) + ' people have given so far. Thank you!'; },
    of: function (r, g) { return r + ' of ' + g; }
  };
  function num(n) { try { return Number(n || 0).toLocaleString(FR ? 'fr-CA' : 'en-CA'); } catch (e) { return String(n || 0); } }
  function money(n) {
    var v = Number(n) || 0;
    try { return v.toLocaleString(FR ? 'fr-CA' : 'en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
    catch (e) { return FR ? Math.floor(v) + ' $' : '$' + Math.floor(v); }
  }
  function el(k) { return box.querySelector('[data-dr="' + k + '"]'); }
  function paint(d) {
    var raised = Math.floor(Number(d.raised) || 0), donors = Number(d.donors) || 0, goal = Number(d.goal) || 0;
    var r = el('raised'), p = el('people'), bar = el('bar'), fill = el('fill');
    if (r) r.textContent = goal > 0 ? T.of(money(raised), money(goal)) : money(raised);
    if (p) p.textContent = donors > 0 ? T.people(donors) : T.first;
    if (bar && fill) {
      if (goal > 0) {
        var pct = Math.max(0, Math.min(100, Math.round(raised / goal * 100)));
        bar.hidden = false; bar.setAttribute('aria-valuenow', String(pct));
        fill.style.width = (raised > 0 ? Math.max(pct, 2) : 0) + '%';
      } else bar.hidden = true;
    }
    box.setAttribute('data-loaded', '1');
  }
  function load() {
    fetch(SUPA + '/rest/v1/rpc/www_campaign_totals', {
      method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_slug: slug })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && !d.error) paint(d); })
      .catch(function () { /* the page's own words stay */ });
  }
  load();
  window.addEventListener('wa-donate-done', function () { setTimeout(load, 5000); setTimeout(load, 20000); });
})();
