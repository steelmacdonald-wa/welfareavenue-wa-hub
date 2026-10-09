  /* ---------- wave204 (04/10/26): what the Hub's AI costs. Steel: "Could you add these costs somewhere in the studio so they
     know how much they are spending". Every call through the llm router reports its cost (_wa.cost, US dollars from
     OpenRouter). The studio adds each call to the email it was for (design.ai: calls and cost, saved with the email, kept
     out of Undo since the money is spent), shows that beside Ask the Hub to change it, puts "about 2¢" by every button that
     calls the AI ("free" by the ones that do not), and the front page's What it costs panel shows the price of each step,
     what the whole studio spent this month, last month and in 90 days (email_studio_costs(), from ai_calls, for staff with
     the CRM; admins can read ai_calls themselves until that function is there), and what the emails here have cost, the
     writer's own among them. Measured on 04/10/26 with the voice code in the prompt: 1.6 to 1.9 cents a call. ---------- */
  SS.costs = { open: false, loaded: false, p: null, data: null };
  function money(d) {
    d = Number(d) || 0;
    if (d >= 1) return '$' + d.toFixed(2);
    var c = d * 100;
    return (c === 0 ? '0' : c < 0.1 ? 'under 0.1' : c < 10 ? String(Math.round(c * 10) / 10) : String(Math.round(c))) + '¢';
  }
  function aboutStep(free) { return '<span class="w204about' + (free ? ' free' : '') + '" title="' + (free ? 'Done by hand: nothing to pay' : 'One call to the Hub, in US dollars') + '">' + (free ? 'free' : 'about 2¢') + '</span>'; }
  function addCost(ai, cost) {
    ai = ai && typeof ai === 'object' ? ai : {};
    return { calls: (Number(ai.calls) || 0) + 1, cost: Math.round(((Number(ai.cost) || 0) + (Number(cost) || 0)) * 1e6) / 1e6 };
  }
  /* a call that changed nothing still cost something: on the email, saved, not a step for Undo */
  function spent(e, cost) {
    if (!e || cost == null) return;
    e.design.ai = addCost(e.design.ai, cost); SS.dirty = true; updateSaveState();
    later('save', 2500, function () { if (SS.dirty) saveNow(); });
  }
  function emailCostLine(e) {
    var ai = e && e.design && e.design.ai;
    return ai && ai.calls ? 'The Hub’s work on this email so far: <b>' + money(ai.cost) + '</b> (' + plural(ai.calls, 'call', 'calls') + ').' : 'Nothing spent on this email yet.';
  }
  function torontoMonth(ts) { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit' }).format(new Date(ts)).slice(0, 7); } catch (e) { return str(ts).slice(0, 7); } }
  function loadCosts(force) {
    var C = SS.costs; if (C.p) return C.p; if (C.loaded && !force) return Promise.resolve(C);
    C.p = (async function () {
      var d = null;
      try { var r = await db.rpc('email_studio_costs', {}); if (r && !r.error && r.data && r.data.month) d = r.data; } catch (e) { d = null; }
      if (!d && amAdmin()) {
        try {
          var q = await db.from('ai_calls').select('created_at, cost, ok').eq('task', 'email_studio').gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString()).limit(5000);
          if (q && !q.error && Array.isArray(q.data)) {
            var now = torontoMonth(Date.now()), y = Number(now.slice(0, 4)), m = Number(now.slice(5, 7)), prev = (m === 1 ? (y - 1) + '-12' : y + '-' + ('0' + (m - 1)).slice(-2));
            d = { month: { calls: 0, cost: 0 }, last_month: { calls: 0, cost: 0 }, d90: { calls: 0, cost: 0 } };
            q.data.forEach(function (row) { var c = Number(row.cost) || 0, mo = torontoMonth(row.created_at); d.d90.calls++; d.d90.cost += c; if (mo === now) { d.month.calls++; d.month.cost += c; } else if (mo === prev) { d.last_month.calls++; d.last_month.cost += c; } });
          }
        } catch (e) { d = null; }
      }
      C.data = d; C.loaded = true; C.p = null;
      var chip = document.getElementById('w204costchip'); if (chip && d) chip.textContent = money(d.month.cost) + ' this month';
      return C;
    })();
    return C.p;
  }
  function costsChip() {
    var C = SS.costs; if (!C.loaded) loadCosts();
    return '<button class="w202vbtn" data-w204costs>' + I('coin') + ' What it costs <span id="w204costchip">' + (C.data ? E(money(C.data.month.cost) + ' this month') : 'about 2¢ a step') + '</span></button>';
  }
  function costsHtml() {
    var C = SS.costs; if (!C.open) return '';
    var d = C.data, me = myEmail(), team = 0, teamn = 0, mine = 0, minen = 0;
    templates().forEach(function (t) { var ai = t.design && t.design.ai, c = ai ? Number(ai.cost) || 0 : 0; if (!c) return; team += c; teamn++; if (lower(t.created_by) === me) { mine += c; minen++; } });
    var rows = [['Tell the Hub: putting it together from your content', 'about 2¢'], ['A round of answers (Put my answers in)', 'about 2¢'], ['Ask the Hub to change it', 'about 2¢ each time'],
      ['Start from a template, filled in by the Hub', 'about 2¢'], ['A photo the Hub looks at', 'about 0.1¢ more'], ['A typical email: Tell the Hub, one round of answers, one change', 'about 5¢'],
      ['Build it yourself, Fill it in myself, Use it, any editing by hand, a moving preview', 'free']];
    var spend = !C.loaded ? busyHtml('Adding it up…') : d ? '<div class="w204spend"><div><b>' + E(money(d.month.cost)) + '</b><span>this month so far, ' + E(plural(d.month.calls, 'call', 'calls')) + '</span></div>' +
      '<div><b>' + E(money(d.last_month.cost)) + '</b><span>last month, ' + E(plural(d.last_month.calls, 'call', 'calls')) + '</span></div><div><b>' + E(money(d.d90.cost)) + '</b><span>the last 90 days</span></div></div>'
      : '<p class="m">The studio’s totals are not open to this account yet; each email still shows its own.</p>';
    return '<div class="w202modal" role="dialog" aria-modal="true" aria-label="What it costs"><div class="w202mbox wide w204costs">' +
      '<div class="w202mh"><h3>' + I('coin') + ' What it costs</h3><button class="w202x" data-w204costsx aria-label="Close">' + I('x') + '</button></div>' +
      '<p class="w204first">' + I('alert') + ' <span><b>Your content first.</b> The Hub shapes what you bring: your own words, the facts and your photos. It does not write the email for you, and thin input costs the same and makes a weaker email: bad input, bad output.</span></p>' +
      '<p class="m">The Hub’s writing help is paid for by use (Claude Sonnet 5 through OpenRouter, in US dollars), not by subscription: each call costs a little, and anything done by hand is free.</p>' +
      '<h4 class="w202h4">Each step</h4><table class="w204ct">' + rows.map(function (r) { return '<tr><td>' + E(r[0]) + '</td><td>' + E(r[1]) + '</td></tr>'; }).join('') + '</table>' +
      '<h4 class="w202h4">What the studio has spent</h4>' + spend +
      '<p class="m">On the emails here now: ' + E(money(team)) + ' across ' + E(plural(teamn, 'email', 'emails')) + (minen ? ', yours ' + E(money(mine)) + ' across ' + E(plural(minen, 'email', 'emails')) : ', none of them yours') + '. Deleted emails and drafts never saved show only in the totals above.</p>' +
      '<h4 class="w202h4">Sending</h4><p class="m">Sending is separate from the writing help: Resend’s free plan covers 3,000 emails a month and 100 a day, and the Hub’s daily cap is set to match.</p></div></div>';
  }
  function openCosts() { SS.costs.open = true; loadCosts(true).then(function () { paint(); }); paint(); }
