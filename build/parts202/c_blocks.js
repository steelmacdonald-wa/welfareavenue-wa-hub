  /* ---------- the email itself: blocks in the brand, rendered for email clients (MAIL202) ----------
     Self-contained (no page, no db), so the seeding script and the tests load the same code: node runs this file alone.
     Every tag the renderer writes carries its own inline style, and links put style before href, so mail-send's styleInner
     (which only rewrites bare <p>, <h1>, <a href=...>, <strong> and the like) leaves the studio's HTML exactly as it is.
     The anatomy follows the Rally Paper 2026 emails (Steel's example): a hero with a doodle and the E that moves, section
     headings with the gold rule, a details table, a dot list, the gold button with a purple caption, photos with captions,
     video cards, a dark green band of links, the sign-off. Inside mail-send's layout (600px, the green header with the logo,
     the CASL footer) the green pieces are rounded cards on the cream body. */
  var MAIL202 = (function () {
    var GREEN = '#103F39', CREAM = '#FFFAF2', INK = '#1F201E', PURPLE = '#6F64AB', GOLD = '#DCA527', RULE = '#E6DFD3';
    var HEAD = "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif";
    var BODY = "'Space Grotesk','Helvetica Neue',Arial,sans-serif";
    var ST = 'https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/';
    var W = 528;   /* the body's inner width: 600 less mail-send's 36px either side */
    var DOODLE = {
      star: { gold: ST + 'brand/doodle-star-gold.png', purple: ST + 'brand/doodle-star-purple.png', cream: ST + 'brand/doodle-star-cream.png', w: 224, h: 238 },
      heart: { gold: ST + 'brand/doodle-heart-gold.png', purple: ST + 'brand/doodle-heart-purple.png', cream: ST + 'brand/doodle-heart-cream.png', w: 243, h: 267 },
      flowers: { gold: ST + 'brand/doodle-flowers-gold.png', purple: ST + 'brand/doodle-flowers-purple.png', w: 172, h: 203 }
    };
    var EIMG = { gold: ST + 'brand/e-large-gold-600.png', cream: ST + 'brand/e-large-cream-600.png', green: ST + 'brand/e-large-green-600.png' };
    var TYPES = ['hero', 'text', 'heading', 'details', 'list', 'button', 'photo', 'photos', 'video', 'band', 'quote', 'stats', 'signoff', 'divider'];
    var LABEL = { hero: 'Headline', text: 'Text', heading: 'Section heading', details: 'Details', list: 'Dot list', button: 'Button', photo: 'Photo', photos: 'Photos in a row',
      video: 'Video card', band: 'Green band of links', quote: 'Quote', stats: 'Numbers', signoff: 'Sign-off', divider: 'Divider' };
    /* the placeholders mail-send fills: a contact's own, then what an automation's trigger adds (wa157) */
    var KNOWN = ['first_name', 'full_name', 'email', 'hub_url', 'site_url', 'from_name', 'form_title', 'amount', 'gift_date', 'gift_date_line', 'campaign', 'event_day', 'event_when', 'event_title', 'role', 'event_location'];
    var SAMPLE = { first_name: 'Alex', full_name: 'Alex Tremblay', email: 'alex@example.org', hub_url: 'https://hub.welfareavenue.com', site_url: 'https://welfareavenue.com', from_name: 'Welfare Avenue',
      form_title: 'Volunteer with Welfare Avenue', amount: '$25.00', gift_date: '28 Sep 2026', gift_date_line: ' on 28 Sep 2026', campaign: 'Fall 2026', event_day: 'Sunday',
      event_when: 'Sunday 4 October 2026', event_title: 'the serving on Sunday 4 October', role: 'a server' };

    function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function str(s) { return String(s == null ? '' : s); }
    function uid() { return 'b' + Math.random().toString(36).slice(2, 9); }
    /* a link the email may carry: http(s), mailto, tel or a placeholder; a bare domain gets https:// */
    function safeUrl(u) {
      u = str(u).trim();
      if (!u) return '';
      if (/^(https?:\/\/|mailto:|tel:)/i.test(u) || /^\{\{\s*[a-z_]+\s*(\|[^}]*)?\}\}/i.test(u)) return u;
      if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(u)) return 'https://' + u;
      return '';
    }
    function safeImg(u) { u = str(u).trim(); return /^https:\/\//i.test(u) ? u : ''; }
    /* **bold** and [words](link) inside a line; everything else is text */
    function inline(s, o) {
      o = o || {};
      var linkC = o.link || PURPLE, boldC = o.bold || GREEN;
      var out = '', re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g, last = 0, m;
      s = str(s);
      while ((m = re.exec(s))) {
        out += E(s.slice(last, m.index));
        if (m[1] != null) out += '<strong style="color:' + boldC + ';font-weight:700;">' + E(m[1]) + '</strong>';
        else { var u = safeUrl(m[3]); out += u ? '<a style="color:' + linkC + ';font-weight:700;text-decoration:underline;" href="' + E(u) + '" target="_blank">' + E(m[2]) + '</a>' : E(m[2]); }
        last = re.lastIndex;
      }
      return out + E(s.slice(last));
    }
    function plainInline(s) { return str(s).replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_m, a, b) { var u = safeUrl(b); return u ? a + ' (' + u + ')' : a; }); }
    function paras(s) { return str(s).replace(/\r/g, '').split(/\n\s*\n/).map(function (p) { return p.replace(/^\s+|\s+$/g, ''); }).filter(Boolean); }
    function rule(m) { return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:' + (m || '8px 0 14px') + ';"><tr><td style="width:40px;height:3px;background-color:' + GOLD + ';font-size:0;line-height:0;">&nbsp;</td></tr></table>'; }
    function tbl(inner, style) { return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="' + (style || 'margin:0 0 18px;') + '">' + inner + '</table>'; }
    function P(html, o) {
      o = o || {};
      return '<p style="margin:' + (o.m || '0 0 16px') + ';font-family:' + BODY + ';font-size:' + (o.size || 16) + 'px;line-height:' + (o.lh || 26) + 'px;color:' + (o.color || INK) + ';' + (o.align ? 'text-align:' + o.align + ';' : '') + '">' + html + '</p>';
    }
    /* the E that moves: one E of a headline line becomes the long E in the line's colour (the last E that ends a word, as
       in the Rally Paper's "cause", else the last E, as in the brand book's EV≡RY), never inside a {{placeholder}} or an entity */
    function moveE(lineHtml, color, px) {
      var src = EIMG[color]; if (!src) return { html: lineHtml, done: false };
      var h = Math.round(px * 0.7), w = Math.round(h * 600 / 172);
      var parts = lineHtml.split(/(\{\{[^}]*\}\}|&[a-z#0-9]+;|<[^>]+>)/i), cands = [];
      parts.forEach(function (p, pi) {
        if (!p || /^(\{\{|&|<)/.test(p)) return;
        for (var k = 0; k < p.length; k++) {
          if (p.charAt(k) !== 'e' && p.charAt(k) !== 'E') continue;
          var next = p.charAt(k + 1);
          var end = next === '' ? !(parts[pi + 1] && /^[a-z0-9]/i.test(parts[pi + 1])) : !/[a-z0-9]/i.test(next);
          cands.push([pi, k, end]);
        }
      });
      if (!cands.length) return { html: lineHtml, done: false };
      var ends = cands.filter(function (c) { return c[2]; }), pick = ends.length ? ends[ends.length - 1] : cands[cands.length - 1];
      var word = parts[pick[0]], before = word.slice(0, pick[1]), after = word.slice(pick[1] + 1);
      var wsB = before.search(/\S*$/), wsA = after.search(/\s|$/);
      parts[pick[0]] = before.slice(0, wsB) + '<span style="white-space:nowrap;">' + before.slice(wsB) + '<img src="' + src + '" width="' + w + '" height="' + h + '" alt="E" style="display:inline-block;width:' + w + 'px;height:' + h +
        'px;vertical-align:baseline;margin:0 2px;border:0;">' + after.slice(0, wsA) + '</span>' + after.slice(wsA);
      return { html: parts.join(''), done: true };
    }
    function doodleImg(name, color, size, align) {
      var d = DOODLE[name]; if (!d) return '';
      var src = d[color] || d.gold, w = size || 64, h = Math.round(w * d.h / d.w);
      return '<div style="text-align:' + (align || 'right') + ';line-height:0;font-size:0;"><img src="' + src + '" width="' + w + '" height="' + h + '" alt="" style="display:inline-block;width:' + w + 'px;height:' + h + 'px;border:0;"></div>';
    }

    /* ---------- one block to HTML ---------- */
    var R = {};
    R.hero = function (b, ctx) {
      var green = b.style === 'green', lines = (b.lines || []).map(str).filter(function (x) { return x.trim(); });
      if (!lines.length && !b.lead) return '';
      var accent = b.accent === 'purple' ? PURPLE : GOLD, base = green ? CREAM : GREEN, gi = b.gold == null ? lines.length - 1 : Number(b.gold);
      var lineHtml = lines.map(function (l, i) {
        var c = i === gi ? accent : base, inner = E(l);
        if (b.moveE !== false && i === gi && !ctx.eDone) {
          var key = c === GOLD ? 'gold' : c === CREAM ? 'cream' : c === GREEN ? 'green' : '';
          var r = moveE(inner, key, 44); inner = r.html; if (r.done) ctx.eDone = true;
        }
        return '<div style="font-family:' + HEAD + ';font-weight:500;font-size:44px;line-height:46px;text-transform:uppercase;letter-spacing:.5px;color:' + c + ';">' + inner + '</div>';
      }).join('');
      var kicker = b.kicker ? '<div style="font-family:' + BODY + ';font-weight:700;font-size:11px;line-height:14px;letter-spacing:2px;text-transform:uppercase;color:' + (green ? GOLD : PURPLE) + ';padding:0 0 12px;">' + E(b.kicker) + '</div>' : '';
      var doodle = b.doodle && b.doodle !== 'none' ? doodleImg(b.doodle, green ? 'gold' : (b.doodleColor === 'purple' ? 'purple' : 'gold'), 62) : '';
      var lead = b.lead ? '<div style="font-family:' + BODY + ';font-size:17px;line-height:27px;color:' + (green ? CREAM : INK) + ';padding-top:16px;">' + inline(b.lead, green ? { link: GOLD, bold: GOLD } : {}) + '</div>' : '';
      var cell = (doodle ? '<div style="margin:-6px 0 -22px;">' + doodle + '</div>' : '') + kicker + lineHtml + lead;
      return green ? tbl('<tr><td style="background-color:' + GREEN + ';border-radius:8px;padding:26px 28px 28px;">' + cell + '</td></tr>', 'margin:0 0 24px;border-collapse:separate;')
        : tbl('<tr><td style="padding:0 0 4px;">' + cell + '</td></tr>', 'margin:0 0 22px;');
    };
    R.text = function (b) { return paras(b.text).map(function (p) { return P(inline(p).replace(/\n/g, '<br>')); }).join(''); };
    R.heading = function (b) {
      if (!str(b.text).trim()) return '';
      return '<div style="font-family:' + HEAD + ';font-weight:600;font-size:26px;line-height:28px;text-transform:uppercase;letter-spacing:.5px;color:' + GREEN + ';padding:10px 0 0;">' + E(b.text) + '</div>' + rule();
    };
    R.details = function (b) {
      var rows = (b.rows || []).filter(function (r) { return r && (str(r.label).trim() || str(r.value).trim()); });
      if (!rows.length) return '';
      var td = 'font-family:' + BODY + ';font-size:15px;line-height:22px;vertical-align:top;border-bottom:1px solid ' + RULE + ';';
      return tbl(rows.map(function (r, i) {
        var top = i === 0 ? 'border-top:1px solid ' + RULE + ';' : '';
        return '<tr><td style="' + td + top + 'padding:10px 14px 10px 0;width:34%;font-weight:700;color:' + GREEN + ';">' + E(r.label) + '</td><td style="' + td + top + 'padding:10px 0;color:' + PURPLE + ';">' + inline(r.value, { bold: PURPLE }).replace(/\n/g, '<br>') + '</td></tr>';
      }).join(''), 'margin:0 0 20px;border-collapse:collapse;');
    };
    R.list = function (b) {
      var items = (b.items || []).filter(function (x) { return x && (str(x.text).trim() || str(x.lead).trim()); });
      if (!items.length) return '';
      var dots = [GOLD, PURPLE, GREEN];
      return tbl(items.map(function (x, i) {
        return '<tr><td style="padding:3px 12px 3px 0;vertical-align:top;width:10px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0;"><tr><td style="width:10px;height:10px;border-radius:5px;background-color:' + dots[i % 3] +
          ';font-size:0;line-height:0;">&nbsp;</td></tr></table></td><td style="font-family:' + BODY + ';font-size:15px;line-height:24px;color:' + INK + ';padding:3px 0;">' +
          (str(x.lead).trim() ? '<strong style="color:' + GREEN + ';font-weight:700;">' + E(x.lead) + '</strong> ' : '') + inline(x.text) + '</td></tr>';
      }).join(''), 'margin:0 0 18px;');
    };
    R.button = function (b) {
      var u = safeUrl(b.url) || '#', label = str(b.label).trim() || 'Find out more';
      return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:10px auto ' + (b.caption ? '6px' : '24px') + ';"><tr><td style="background-color:' + GOLD + ';border-radius:6px;" align="center">' +
        '<a style="display:inline-block;padding:15px 34px;font-family:' + HEAD + ';font-weight:600;font-size:20px;line-height:22px;letter-spacing:1px;text-transform:uppercase;color:' + GREEN + ';text-decoration:none;" href="' + E(u) + '" target="_blank">' + E(label) + '</a></td></tr></table>' +
        (b.caption ? P(inline(b.caption, { bold: PURPLE }), { m: '0 0 24px', size: 12, lh: 18, color: PURPLE, align: 'center' }) : '');
    };
    function imgTag(src, alt, w, round) {
      return '<img src="' + E(src) + '" width="' + w + '" alt="' + E(alt || '') + '" style="display:block;width:100%;max-width:' + w + 'px;height:auto;border:0;' + (round === false ? '' : 'border-radius:8px;') + '">';
    }
    R.photo = function (b) {
      var src = safeImg(b.src); if (!src) return '';
      var img = imgTag(src, b.alt, W), link = safeUrl(b.link);
      return tbl('<tr><td style="padding:0;">' + (link ? '<a style="display:block;text-decoration:none;" href="' + E(link) + '" target="_blank">' + img + '</a>' : img) + '</td></tr>' +
        (b.caption ? '<tr><td style="font-family:' + BODY + ';font-size:13px;line-height:20px;color:' + INK + ';padding:10px 0 0;">' + inline(b.caption) + '</td></tr>' : ''), 'margin:4px 0 22px;');
    };
    R.photos = function (b) {
      var items = (b.items || []).filter(function (x) { return x && safeImg(x.src); }).slice(0, 3);
      if (!items.length) return '';
      if (items.length === 1) return R.photo(items[0]);
      var n = items.length, gap = 10, w = Math.floor((W - gap * (n - 1)) / n), pct = Math.floor(100 / n);
      var pad = function (i) { return 'padding:0 ' + (i === n - 1 ? 0 : gap / 2) + 'px 0 ' + (i === 0 ? 0 : gap / 2) + 'px;'; };
      var imgs = items.map(function (x, i) { return '<td width="' + pct + '%" valign="top" style="' + pad(i) + '">' + imgTag(safeImg(x.src), x.alt, w) + '</td>'; }).join('');
      var caps = items.some(function (x) { return str(x.caption).trim(); }) ? '<tr>' + items.map(function (x, i) {
        return '<td width="' + pct + '%" valign="top" style="' + pad(i) + 'font-family:' + BODY + ';font-size:13px;line-height:20px;color:' + INK + ';padding-top:10px;">' + inline(x.caption) + '</td>';
      }).join('') + '</tr>' : '';
      return tbl('<tr>' + imgs + '</tr>' + caps, 'margin:4px 0 22px;');
    };
    R.video = function (b) {
      var u = safeUrl(b.url) || '#';
      return '<a style="display:block;text-decoration:none;margin:4px 0 22px;" href="' + E(u) + '" target="_blank">' +
        tbl('<tr><td align="center" style="padding:22px 16px 6px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="background-color:' + GOLD + ';border-radius:32px;width:64px;height:64px;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:64px;color:' + GREEN + ';font-weight:bold;">&#9654;</td></tr></table></td></tr>' +
          '<tr><td align="center" style="font-family:' + HEAD + ';font-weight:600;font-size:22px;line-height:24px;text-transform:uppercase;color:' + CREAM + ';padding:4px 16px 4px;">' + E(str(b.title).trim() || 'Watch the video') + '</td></tr>' +
          '<tr><td align="center" style="font-family:' + BODY + ';font-size:12px;line-height:18px;color:' + GOLD + ';padding:0 16px 22px;">' + E(str(b.caption).trim() || 'Tap to watch') + '</td></tr>',
          'background-color:' + GREEN + ';border-radius:8px;border-collapse:separate;') + '</a>';
    };
    R.band = function (b) {
      var links = (b.links || []).filter(function (l) { return l && str(l.label).trim() && safeUrl(l.url); });
      if (!str(b.title).trim() && !str(b.text).trim() && !links.length) return '';
      var inner = (str(b.title).trim() ? '<div style="font-family:' + HEAD + ';font-weight:600;font-size:26px;line-height:28px;text-transform:uppercase;letter-spacing:.5px;color:' + GOLD + ';">' + E(b.title) + '</div>' + rule() : '') +
        paras(b.text).map(function (p) { return P(inline(p, { link: GOLD, bold: GOLD }).replace(/\n/g, '<br>'), { size: 14, lh: 22, color: CREAM, m: '0 0 12px' }); }).join('') +
        (links.length ? tbl(links.map(function (l) {
          return '<tr><td style="padding:0 0 8px;"><a style="display:block;border:1px solid ' + CREAM + ';border-radius:6px;padding:11px 16px;font-family:' + HEAD + ';font-weight:600;font-size:18px;line-height:22px;letter-spacing:.5px;color:' + CREAM +
            ';text-decoration:none;text-transform:uppercase;" href="' + E(safeUrl(l.url)) + '" target="_blank">&#8594;&nbsp; ' + E(l.label) + '</a></td></tr>';
        }).join(''), 'margin:4px 0 0;') : '');
      return tbl('<tr><td style="background-color:' + GREEN + ';border-radius:8px;padding:24px 28px 16px;">' + inner + '</td></tr>', 'margin:4px 0 24px;border-collapse:separate;');
    };
    R.quote = function (b) {
      if (!str(b.quote).trim()) return '';
      return tbl('<tr><td style="border-left:3px solid ' + PURPLE + ';padding:4px 0 4px 18px;">' +
        P(inline(b.quote), { m: '0', size: 18, lh: 28, color: GREEN }) +
        (str(b.by).trim() ? '<div style="font-family:' + BODY + ';font-weight:700;font-size:12px;line-height:18px;letter-spacing:1px;text-transform:uppercase;color:' + PURPLE + ';padding-top:8px;">' + E(b.by) + '</div>' : '') +
        '</td></tr>', 'margin:6px 0 22px;');
    };
    R.stats = function (b) {
      var items = (b.items || []).filter(function (x) { return x && str(x.n).trim(); }).slice(0, 3);
      if (!items.length) return '';
      var green = b.style !== 'cream', n = items.length, pct = Math.floor(100 / n);
      var cells = items.map(function (x) {
        return '<td width="' + pct + '%" align="center" valign="top" style="padding:0 6px;"><div style="font-family:' + HEAD + ';font-weight:600;font-size:40px;line-height:42px;color:' + (green ? GOLD : GREEN) + ';">' + E(x.n) + '</div>' +
          '<div style="font-family:' + BODY + ';font-size:13px;line-height:18px;color:' + (green ? CREAM : INK) + ';padding-top:6px;">' + E(x.label) + '</div></td>';
      }).join('');
      var head = str(b.title).trim() ? '<tr><td colspan="' + n + '" align="center" style="font-family:' + BODY + ';font-weight:700;font-size:11px;line-height:14px;letter-spacing:2px;text-transform:uppercase;color:' + (green ? GOLD : PURPLE) + ';padding:0 0 14px;">' + E(b.title) + '</td></tr>' : '';
      var note = str(b.note).trim() ? '<tr><td colspan="' + n + '" align="center" style="font-family:' + BODY + ';font-size:11px;line-height:16px;color:' + (green ? CREAM : INK) + ';padding:14px 6px 0;opacity:.85;">' + E(b.note) + '</td></tr>' : '';
      var t = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + head + '<tr>' + cells + '</tr>' + note + '</table>';
      return green ? tbl('<tr><td style="background-color:' + GREEN + ';border-radius:8px;padding:24px 14px 22px;">' + t + '</td></tr>', 'margin:6px 0 24px;border-collapse:separate;')
        : tbl('<tr><td style="border-top:1px solid ' + RULE + ';border-bottom:1px solid ' + RULE + ';padding:20px 0 18px;">' + t + '</td></tr>', 'margin:6px 0 24px;');
    };
    R.signoff = function (b) {
      var closing = str(b.closing).trim() || 'Warmly,';
      return P(E(closing) + (str(b.name).trim() ? '<br><strong style="color:' + GREEN + ';font-weight:700;">' + E(b.name) + '</strong>' : '') +
        (str(b.role).trim() ? '<br><span style="color:' + PURPLE + ';">' + E(b.role) + '</span>' : ''), { m: '8px 0 16px' }) +
        paras(b.ps).map(function (p, i) { return P((i === 0 && !/^p\.?\s*s\.?/i.test(p) ? '<strong style="color:' + GREEN + ';font-weight:700;">P.S.</strong> ' : '') + inline(p), { size: 15, lh: 24 }); }).join('');
    };
    R.divider = function (b) {
      return b.style === 'space' ? '<div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>' : rule('6px 0 22px');
    };

    /* ---------- one block to plain text ---------- */
    var TX = {};
    TX.hero = function (b) { return [str(b.kicker).trim(), (b.lines || []).map(str).filter(function (x) { return x.trim(); }).join(' ').toUpperCase(), plainInline(b.lead)].filter(Boolean).join('\n\n'); };
    TX.text = function (b) { return paras(b.text).map(plainInline).join('\n\n'); };
    TX.heading = function (b) { return str(b.text).trim().toUpperCase(); };
    TX.details = function (b) { return (b.rows || []).filter(function (r) { return r && (str(r.label).trim() || str(r.value).trim()); }).map(function (r) { return str(r.label).trim() + ': ' + plainInline(r.value).replace(/\n/g, ' '); }).join('\n'); };
    TX.list = function (b) { return (b.items || []).filter(function (x) { return x && (str(x.text).trim() || str(x.lead).trim()); }).map(function (x) { return '- ' + (str(x.lead).trim() ? str(x.lead).trim() + ' ' : '') + plainInline(x.text); }).join('\n'); };
    TX.button = function (b) { var u = safeUrl(b.url); return (str(b.label).trim() || 'Find out more') + (u ? ': ' + u : '') + (b.caption ? '\n' + plainInline(b.caption) : ''); };
    TX.photo = function (b) { return str(b.caption).trim() ? plainInline(b.caption) : ''; };
    TX.photos = function (b) { return (b.items || []).filter(function (x) { return x && str(x.caption).trim(); }).map(function (x) { return plainInline(x.caption); }).join('\n'); };
    TX.video = function (b) { var u = safeUrl(b.url); return (str(b.title).trim() || 'Watch the video') + (u ? ': ' + u : ''); };
    TX.band = function (b) {
      return [str(b.title).trim().toUpperCase(), paras(b.text).map(plainInline).join('\n\n'), (b.links || []).filter(function (l) { return l && str(l.label).trim() && safeUrl(l.url); }).map(function (l) { return str(l.label).trim() + ': ' + safeUrl(l.url); }).join('\n')].filter(Boolean).join('\n\n');
    };
    TX.quote = function (b) { return str(b.quote).trim() ? '"' + plainInline(b.quote) + '"' + (str(b.by).trim() ? '\n' + str(b.by).trim() : '') : ''; };
    TX.stats = function (b) { return [str(b.title).trim()].concat((b.items || []).filter(function (x) { return x && str(x.n).trim(); }).map(function (x) { return str(x.n).trim() + ' ' + str(x.label).trim(); }), [str(b.note).trim()]).filter(Boolean).join('\n'); };
    TX.signoff = function (b) { return [str(b.closing).trim() || 'Warmly,', str(b.name).trim(), str(b.role).trim()].filter(Boolean).join('\n') + (paras(b.ps).length ? '\n\n' + paras(b.ps).map(function (p, i) { return (i === 0 && !/^p\.?\s*s\.?/i.test(p) ? 'P.S. ' : '') + plainInline(p); }).join('\n\n') : ''); };
    TX.divider = function () { return ''; };

    function render(design) {
      var ctx = { eDone: false };
      return ((design && design.blocks) || []).map(function (b) { return b && R[b.type] ? R[b.type](b, ctx) : ''; }).join('');
    }
    /* the same, with each block marked for the studio's preview (a click opens that block); never sent */
    function renderMarked(design) {
      var ctx = { eDone: false };
      return ((design && design.blocks) || []).map(function (b, i) { var h = b && R[b.type] ? R[b.type](b, ctx) : ''; return '<div data-w202b="' + i + '">' + (h || '') + '</div>'; }).join('');
    }
    function renderText(design) {
      return ((design && design.blocks) || []).map(function (b) { return b && TX[b.type] ? TX[b.type](b) : ''; }).filter(function (t) { return str(t).trim(); }).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
    }
    /* the placeholders an email uses ({{name}} or {{name|fallback}}), in order */
    function placeholders(s) {
      var out = [], re = /\{\{\s*([a-zA-Z0-9_]+)\s*(?:\|[^}]*)?\}\}/g, m;
      s = str(s);
      while ((m = re.exec(s))) if (out.indexOf(m[1]) < 0) out.push(m[1]);
      return out;
    }
    /* every piece of text in a design, with where it is (for the checks) */
    function texts(design) {
      var out = [];
      ((design && design.blocks) || []).forEach(function (b, i) {
        if (!b) return;
        var add = function (field, v) { if (str(v).trim()) out.push({ i: i, field: field, text: str(v) }); };
        ['kicker', 'lead', 'text', 'label', 'caption', 'title', 'quote', 'by', 'closing', 'name', 'role', 'ps', 'note', 'alt'].forEach(function (f) { add(f, b[f]); });
        (b.lines || []).forEach(function (l, k) { add('lines.' + k, l); });
        (b.rows || []).forEach(function (r, k) { if (r) { add('rows.' + k + '.label', r.label); add('rows.' + k + '.value', r.value); } });
        (b.items || []).forEach(function (x, k) { if (x) { add('items.' + k + '.lead', x.lead); add('items.' + k + '.text', x.text); add('items.' + k + '.caption', x.caption); add('items.' + k + '.label', x.label); add('items.' + k + '.n', x.n); add('items.' + k + '.alt', x.alt); } });
        (b.links || []).forEach(function (l, k) { if (l) add('links.' + k + '.label', l.label); });
      });
      return out;
    }
    /* every link and picture in a design */
    function links(design) {
      var out = [];
      ((design && design.blocks) || []).forEach(function (b, i) {
        if (!b) return;
        if (b.type === 'button') out.push({ i: i, field: 'url', url: str(b.url), label: str(b.label), need: true });
        if (b.type === 'video') out.push({ i: i, field: 'url', url: str(b.url), label: str(b.title), need: true });
        if (b.type === 'photo' && str(b.link).trim()) out.push({ i: i, field: 'link', url: str(b.link), label: 'the photo' });
        (b.links || []).forEach(function (l, k) { if (l) out.push({ i: i, field: 'links.' + k + '.url', url: str(l.url), label: str(l.label), need: !!str(l.label).trim() }); });
        texts({ blocks: [b] }).forEach(function (t) { var re = /\[([^\]]+)\]\(([^)\s]+)\)/g, m; while ((m = re.exec(t.text))) out.push({ i: i, field: t.field, url: m[2], label: m[1], inText: true }); });
      });
      return out;
    }
    function images(design) {
      var out = [];
      ((design && design.blocks) || []).forEach(function (b, i) {
        if (!b) return;
        if (b.type === 'photo' && str(b.src).trim()) out.push({ i: i, k: null, src: str(b.src), alt: str(b.alt), lib: b.lib || null, usage: b.usage || null });
        if (b.type === 'photos') (b.items || []).forEach(function (x, k) { if (x && str(x.src).trim()) out.push({ i: i, k: k, src: str(x.src), alt: str(x.alt), lib: x.lib || null, usage: x.usage || null }); });
      });
      return out;
    }
    /* a new block of a type, with sensible starting words */
    function blank(type) {
      var b = { id: uid(), type: type };
      if (type === 'hero') { b.style = 'cream'; b.lines = ['Your headline', 'goes here']; b.lead = ''; b.doodle = 'star'; b.kicker = ''; b.accent = 'gold'; b.moveE = true; }
      if (type === 'text') b.text = 'Hi {{first_name|there}},\n\n';
      if (type === 'heading') b.text = 'What to know';
      if (type === 'details') b.rows = [{ label: 'When', value: '' }, { label: 'Where', value: '' }];
      if (type === 'list') b.items = [{ lead: '', text: '' }, { lead: '', text: '' }];
      if (type === 'button') { b.label = 'Sign up'; b.url = ''; b.caption = ''; }
      if (type === 'photo') { b.src = ''; b.alt = ''; b.caption = ''; }
      if (type === 'photos') b.items = [{ src: '', alt: '', caption: '' }, { src: '', alt: '', caption: '' }, { src: '', alt: '', caption: '' }];
      if (type === 'video') { b.url = ''; b.title = ''; b.caption = 'Tap to watch'; }
      if (type === 'band') { b.title = ''; b.text = ''; b.links = [{ label: '', url: '' }]; }
      if (type === 'quote') { b.quote = ''; b.by = ''; }
      if (type === 'stats') { b.style = 'green'; b.title = ''; b.items = [{ n: '', label: '' }, { n: '', label: '' }, { n: '', label: '' }]; b.note = ''; }
      if (type === 'signoff') { b.closing = 'Warmly,'; b.name = ''; b.role = 'Welfare Avenue'; b.ps = ''; }
      if (type === 'divider') b.style = 'rule';
      return b;
    }
    /* a design from anywhere (the AI, a saved row) made safe and complete: known types and fields only, text as text */
    function clean(d) {
      d = d && typeof d === 'object' ? d : {};
      var S = function (v, n) { return str(v).slice(0, n || 4000); };
      var blocks = (Array.isArray(d.blocks) ? d.blocks : []).filter(function (b) { return b && TYPES.indexOf(b.type) >= 0; }).slice(0, 40).map(function (b) {
        var o = { id: /^b[a-z0-9]{3,12}$/.test(str(b.id)) ? b.id : uid(), type: b.type };
        if (b.type === 'hero') { o.style = b.style === 'green' ? 'green' : 'cream'; o.kicker = S(b.kicker, 80); o.lines = (Array.isArray(b.lines) ? b.lines : [b.lines]).map(function (x) { return S(x, 60); }).filter(function (x) { return x.trim(); }).slice(0, 4); o.lead = S(b.lead, 800);
          o.doodle = ['star', 'heart', 'flowers', 'none'].indexOf(b.doodle) >= 0 ? b.doodle : 'star'; o.accent = b.accent === 'purple' ? 'purple' : 'gold'; o.moveE = b.moveE !== false; if (b.gold != null && !isNaN(Number(b.gold))) o.gold = Number(b.gold); }
        if (b.type === 'text' || b.type === 'heading') o.text = S(b.text, b.type === 'text' ? 6000 : 120);
        if (b.type === 'details') o.rows = (Array.isArray(b.rows) ? b.rows : []).slice(0, 12).map(function (r) { return { label: S(r && r.label, 60), value: S(r && r.value, 400) }; });
        if (b.type === 'list') o.items = (Array.isArray(b.items) ? b.items : []).slice(0, 12).map(function (x) { return { lead: S(x && x.lead, 80), text: S(x && x.text, 600) }; });
        if (b.type === 'button') { o.label = S(b.label, 60); o.url = S(b.url, 800); o.caption = S(b.caption, 200); }
        if (b.type === 'photo') { o.src = S(b.src, 800); o.alt = S(b.alt, 200); o.caption = S(b.caption, 400); o.link = S(b.link, 800); if (b.lib) o.lib = S(b.lib, 40); if (b.usage) o.usage = S(b.usage, 20); }
        if (b.type === 'photos') o.items = (Array.isArray(b.items) ? b.items : []).slice(0, 3).map(function (x) { var y = { src: S(x && x.src, 800), alt: S(x && x.alt, 200), caption: S(x && x.caption, 300) }; if (x && x.lib) y.lib = S(x.lib, 40); if (x && x.usage) y.usage = S(x.usage, 20); return y; });
        if (b.type === 'video') { o.url = S(b.url, 800); o.title = S(b.title, 80); o.caption = S(b.caption, 120); }
        if (b.type === 'band') { o.title = S(b.title, 80); o.text = S(b.text, 1200); o.links = (Array.isArray(b.links) ? b.links : []).slice(0, 6).map(function (l) { return { label: S(l && l.label, 60), url: S(l && l.url, 800) }; }); }
        if (b.type === 'quote') { o.quote = S(b.quote, 600); o.by = S(b.by, 120); }
        if (b.type === 'stats') { o.style = b.style === 'cream' ? 'cream' : 'green'; o.title = S(b.title, 80); o.items = (Array.isArray(b.items) ? b.items : []).slice(0, 3).map(function (x) { return { n: S(x && x.n, 16), label: S(x && x.label, 60) }; }); o.note = S(b.note, 200); }
        if (b.type === 'signoff') { o.closing = S(b.closing, 40); o.name = S(b.name, 80); o.role = S(b.role, 120); o.ps = S(b.ps, 600); }
        if (b.type === 'divider') o.style = b.style === 'space' ? 'space' : 'rule';
        return o;
      });
      var asks = (Array.isArray(d.asks) ? d.asks : []).slice(0, 12).map(function (a) { return { id: S(a && a.id, 40).replace(/[^a-z0-9_]/gi, '') || uid(), label: S(a && a.label, 160), hint: S(a && a.hint, 200) }; }).filter(function (a) { return a.label; });
      var out = { v: 1, blocks: blocks };
      if (asks.length) out.asks = asks;
      if (d.source) out.source = S(d.source, 20);
      if (d.from) out.from = S(d.from, 40);
      return out;
    }

    /* ---------- mail-send's own rendering, ported for the live preview (fn/mail-send/index.ts v5: fill, styleInner, layout) ---------- */
    var RAW_KEYS = ['body_html', 'extra_html'];
    function fill(tpl, vars, html) {
      return str(tpl).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*(?:\|([^}]*))?\}\}/g, function (_m, key, fb) {
        var v = vars[key], has = v != null && str(v).trim() !== '';
        if (has) return html && RAW_KEYS.indexOf(key) < 0 ? E(v) : str(v);
        return fb != null ? fb : '';
      });
    }
    function styleInner(html) {
      var Pst = 'margin:0 0 16px;font-family:' + BODY + ';font-size:16px;line-height:26px;color:' + INK + ';';
      var rl = '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;"><tr><td style="width:40px;height:3px;background-color:' + GOLD + ';font-size:0;line-height:0;">&nbsp;</td></tr></table>';
      return str(html)
        .replace(/<a href="/g, '<a style="color:' + PURPLE + ';text-decoration:underline;" href="')
        .replace(/<a class="btn" href="([^"]*)">([\s\S]*?)<\/a>/g, function (_m, href, label) {
          return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:26px auto;"><tr><td style="background-color:' + GOLD + ';border-radius:6px;">' +
            '<a href="' + href + '" style="display:inline-block;padding:14px 28px;font-family:' + HEAD + ';font-weight:600;font-size:18px;letter-spacing:1px;text-transform:uppercase;color:' + GREEN + ';text-decoration:none;">' + label + '</a></td></tr></table>';
        })
        .replace(/<h1>/g, '<h1 style="margin:0 0 18px;font-family:' + HEAD + ';font-weight:500;font-size:40px;line-height:44px;text-transform:uppercase;letter-spacing:.5px;color:' + GREEN + ';">')
        .replace(/<h2>/g, '<h2 style="margin:24px 0 8px;font-family:' + HEAD + ';font-weight:500;font-size:26px;line-height:30px;text-transform:uppercase;letter-spacing:.5px;color:' + GREEN + ';">')
        .replace(/<\/h2>/g, '</h2>' + rl)
        .replace(/<h3>/g, '<h3 style="margin:22px 0 8px;font-family:' + BODY + ';font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:' + GREEN + ';">')
        .replace(/<p>/g, '<p style="' + Pst + '">')
        .replace(/<(ul|ol)>/g, '<$1 style="margin:0 0 16px 22px;padding:0;">')
        .replace(/<li>/g, '<li style="margin:0 0 8px;font-family:' + BODY + ';font-size:16px;line-height:26px;color:' + INK + ';">')
        .replace(/<strong>/g, '<strong style="color:' + GREEN + ';font-weight:700;">')
        .replace(/<mark>/g, '<span style="background-color:' + GOLD + ';color:' + GREEN + ';padding:0 4px;">').replace(/<\/mark>/g, '</span>')
        .replace(/<hr\s*\/?>/g, rl);
    }
    var REASON = {
      transactional: 'of your relationship with Welfare Avenue: a sign-up, a serving or a gift.',
      newsletter: 'you said yes to our news, or gave or volunteered with us in the last two years.',
      fundraising: 'you said yes to our news, or gave or volunteered with us in the last two years.',
      volunteer: 'you applied to volunteer, or volunteered, with Welfare Avenue.',
      test: 'it is a test the Hub sent to a team address.'
    };
    var OVERLINE = { transactional: 'From the Welfare Avenue team', newsletter: 'News from Welfare Avenue', fundraising: 'From Welfare Avenue', volunteer: 'Volunteering at Welfare Avenue', test: 'A Hub test' };
    var BULK = ['newsletter', 'fundraising', 'volunteer'];
    var LOGO_CREAM = ST + 'brand/logo-primary-cream-600.png', LOCKUP_CREAM = ST + 'brand/logo-lockup-cream-600.png';
    function layout(o) {
      var bulk = BULK.indexOf(o.kind) >= 0, cfg = o.cfg || {};
      var addr = cfg.mail_postal_address || 'Welfare Avenue, 8200 av Bloomfield, Montreal QC H3N 2H9';
      var charity = cfg.mail_charity_number || '713048502RR0001';
      var small = 'font-family:' + BODY + ';font-size:13px;line-height:20px;color:' + CREAM + ';';
      return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge"><title>' + E(o.title) + '</title>' +
        '<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">' +
        '<style>body{margin:0;padding:0;background:' + CREAM + ';}table{border-collapse:collapse;}img{border:0;line-height:100%;}@media only screen and (max-width:620px){.wa-wrap{width:100% !important;}.wa-pad{padding-left:20px !important;padding-right:20px !important;}h1{font-size:32px !important;line-height:36px !important;}}</style></head>' +
        '<body style="margin:0;padding:0;background-color:' + CREAM + ';">' +
        (o.preheader ? '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:' + CREAM + ';font-size:1px;line-height:1px;">' + E(o.preheader) + '</div>' : '') +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:' + CREAM + ';"><tr><td align="center" style="padding:24px 12px;">' +
        '<table role="presentation" class="wa-wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">' +
        '<tr><td class="wa-pad" style="background-color:' + GREEN + ';border-radius:8px 8px 0 0;padding:28px 36px 24px 36px;">' +
        '<img src="' + LOGO_CREAM + '" width="170" height="57" alt="Welfare Avenue" style="display:block;border:0;width:170px;height:auto;">' +
        '<div style="padding:20px 0 0;font-family:' + BODY + ';font-weight:700;font-size:11px;line-height:14px;letter-spacing:2px;color:' + GOLD + ';text-transform:uppercase;">' + E(OVERLINE[o.kind] || OVERLINE.transactional) + '</div></td></tr>' +
        '<tr><td class="wa-pad" style="background-color:' + CREAM + ';padding:32px 36px 20px 36px;border-left:1px solid rgba(16,63,57,.12);border-right:1px solid rgba(16,63,57,.12);">' + o.inner + '</td></tr>' +
        '<tr><td class="wa-pad" style="background-color:' + GREEN + ';border-radius:0 0 8px 8px;padding:26px 36px 28px 36px;">' +
        '<img src="' + LOCKUP_CREAM + '" width="140" height="63" alt="Welfare Avenue, building pathways in our community" style="display:block;border:0;width:140px;height:auto;">' +
        '<div style="padding:16px 0 0;' + small + 'opacity:.85;">Welfare Avenue is a registered charity, no. ' + E(charity) + '. ' + E(addr) + '.<br>You are receiving this email because ' + E(REASON[o.kind] || REASON.transactional) + '</div>' +
        '<div style="padding-top:12px;' + small + '"><a href="https://welfareavenue.com" style="color:' + CREAM + ';text-decoration:underline;">welfareavenue.com</a>' +
        (o.unsub ? ' &nbsp;&middot;&nbsp; <a href="' + o.unsub + '" style="color:' + CREAM + ';text-decoration:underline;">' + (bulk ? 'Unsubscribe' : 'Email preferences') + '</a>' : '') +
        '</div></td></tr></table></td></tr></table></body></html>';
    }
    /* the whole email as an inbox would show it, with sample values for the placeholders */
    function preview(o) {
      var vars = Object.assign({}, SAMPLE, o.vars || {});
      var inner = styleInner(fill(o.html != null ? o.html : render(o.design), vars, true));
      return layout({ inner: inner, preheader: fill(o.preheader || '', vars, false).trim(), kind: o.kind || 'newsletter', unsub: '#', cfg: o.cfg || {}, title: fill(o.subject || '', vars, false) });
    }

    return { TYPES: TYPES, LABEL: LABEL, KNOWN: KNOWN, SAMPLE: SAMPLE, DOODLE: DOODLE, EIMG: EIMG, ST: ST, W: W,
      COLORS: { GREEN: GREEN, CREAM: CREAM, INK: INK, PURPLE: PURPLE, GOLD: GOLD, RULE: RULE },
      E: E, safeUrl: safeUrl, safeImg: safeImg, inline: inline, plainInline: plainInline, paras: paras, uid: uid,
      render: render, renderMarked: renderMarked, renderText: renderText, renderBlock: function (b) { return R[b.type] ? R[b.type](b, { eDone: false }) : ''; },
      placeholders: placeholders, texts: texts, links: links, images: images, blank: blank, clean: clean,
      fill: fill, styleInner: styleInner, layout: layout, preview: preview };
  })();
