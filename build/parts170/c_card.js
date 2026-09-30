  /* ---------- Home: the card ---------- */
  function cardHtml() {
    var o = S.owner; if (!o) return '';
    var nr = toReply().length, nt = forTeam().length, ns = sortedToday().length;
    var when0 = o.last_sort_at ? 'Sorted ' + ago(o.last_sort_at) : 'Not sorted yet';
    var sched = o.auto_sort ? 'every 15 minutes' : 'when you press Check now';
    return '<h3>Your inbox</h3>'
      + '<p class="sub">Your Welfare Avenue mail, sorted into your folders. What needs your reply, and what a team should handle, waits here for you.</p>'
      + '<div class="w170tiles">'
      + '<button type="button" class="' + (nr ? 'hot' : '') + '" data-w170open="reply"><b>' + nr + '</b><span>to reply</span></button>'
      + '<button type="button" data-w170open="team"><b>' + nt + '</b><span>for a team</span></button>'
      + '<button type="button" data-w170open="sorted"><b>' + ns + '</b><span>sorted today</span></button></div>'
      + '<div class="w170foot"><span>' + E(when0) + ' · ' + E(sched) + (o.last_error ? ' · <span style="color:' + FLAG + '">the last run stopped</span>' : '') + '</span>'
      + '<button type="button" class="w170btn sm" data-w170open="' + (nr ? 'reply' : nt ? 'team' : 'sorted') + '">Open your inbox</button></div>';
  }
  function paintCard() {
    var body = document.getElementById('mpBody'), el = document.getElementById('w170card');
    var html = S.owner ? cardHtml() : '';
    if (!body || !html) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div'); el.id = 'w170card'; el.className = 'mp-sec';
      var a = document.getElementById('w166lead') || document.getElementById('w112wrap') || body.querySelector('.mp-online') || body.querySelector('.mp-chips') || body.querySelector('.mp-head');
      if (a && a.parentNode === body) body.insertBefore(el, a.nextSibling); else body.insertBefore(el, body.firstChild);
    }
    if (el.__h !== html) { el.innerHTML = html; el.__h = html; }
  }
  function refreshCard(force) {
    return loadOwner(force).then(function (o) { if (!o) { paintCard(); return; } return loadRows(force).then(function () { paintCard(); }); });
  }

