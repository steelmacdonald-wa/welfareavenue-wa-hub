  /* ---------- the studio's own checks (no AI): what would go out wrong or unfinished ----------
     stop: the email cannot go out until it is fixed (anything left in [brackets], no subject, a button with no link, a weekday
     that is not that date); warn: worth a look, the writer decides; note: a reminder. Each one points at its block. */
  var MONTHS = { january: 0, jan: 0, janvier: 0, janv: 0, february: 1, feb: 1, fevrier: 1, 'février': 1, fevr: 1, 'févr': 1, march: 2, mar: 2, mars: 2, april: 3, apr: 3, avril: 3, avr: 3,
    may: 4, mai: 4, june: 5, jun: 5, juin: 5, july: 6, jul: 6, juillet: 6, juil: 6, august: 7, aug: 7, aout: 7, 'août': 7, september: 8, sep: 8, sept: 8, septembre: 8,
    october: 9, oct: 9, octobre: 9, november: 10, nov: 10, novembre: 10, december: 11, dec: 11, decembre: 11, 'décembre': 11, 'déc': 11 };
  var DAYS = { sunday: 0, sun: 0, dimanche: 0, monday: 1, mon: 1, lundi: 1, tuesday: 2, tue: 2, tues: 2, mardi: 2, wednesday: 3, wed: 3, mercredi: 3,
    thursday: 4, thu: 4, thur: 4, thurs: 4, jeudi: 4, friday: 5, fri: 5, vendredi: 5, saturday: 6, sat: 6, samedi: 6 };
  var DAYNAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONNAME = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  /* words Welfare Avenue does not use (wa-brand: we say / we do not say), with what to say instead */
  var AVOID = [
    [/\bthe homeless\b|\bhomeless people\b/i, 'the homeless', 'people we serve, our community'], [/\bbeneficiar(y|ies)\b/i, 'beneficiaries', 'people we serve'],
    [/\bpeople in need\b|\bthose in need\b|\bthe needy\b/i, 'people in need', 'people we serve, our community'], [/\bless fortunate\b/i, 'the less fortunate', 'people we serve'],
    [/\bfeed(ing)? (the|people|them)\b/i, 'feed people', 'serve meals, share a meal'], [/\bhand(ing)? out food\b|\bgive away (food|snacks)\b/i, 'hand out food', 'serve meals; food as a starting point'],
    [/\bstudent club\b/i, 'student club', 'youth-powered movement'], [/\bjust volunteers\b/i, 'just volunteers', 'our volunteers, future leaders'],
    [/\bmaking a difference together\b|\bin these (challenging|difficult|uncertain) times\b/i, 'charity boilerplate', 'say what happened, specifically'],
    [/\bles sans-abri\b|\bles itinérants\b/i, 'les sans-abri', 'les personnes que nous servons, notre communauté'], [/\bles démunis\b|\bles plus démunis\b|\bles pauvres\b/i, 'les démunis', 'les personnes que nous servons'],
    [/\bbénéficiaires\b/i, 'bénéficiaires', 'les personnes que nous servons']
  ];
  function todayParts() {
    try { var p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).split('-'); return { y: +p[0], m: +p[1] - 1, d: +p[2] }; }
    catch (e) { var n = new Date(); return { y: n.getFullYear(), m: n.getMonth(), d: n.getDate() }; }
  }
  function strip(s) { return str(s).toLowerCase().normalize ? str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') : str(s).toLowerCase(); }
  /* "Sunday 12 October", "Sunday, October 12", "Sun Oct 12 2026", "dimanche 12 octobre 2026": weekday, day, month, year? */
  function datesIn(s) {
    var out = [], t = str(s);
    var dn = '(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|wed|thu(?:rs?)?|fri|sat|dimanche|lundi|mardi|mercredi|jeudi|vendredi|samedi)';
    var mn = '(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec|janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre|janv|f[eé]vr|avr|juil|d[eé]c)';
    var re1 = new RegExp('\\b' + dn + '\\.?,?\\s+(?:le\\s+)?(\\d{1,2})(?:st|nd|rd|th|er)?\\s+' + mn + '\\.?(?:,?\\s+(\\d{4}))?', 'gi');
    var re2 = new RegExp('\\b' + dn + '\\.?,?\\s+' + mn + '\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?', 'gi');
    var m;
    while ((m = re1.exec(t))) out.push({ text: m[0], dow: DAYS[strip(m[1]).replace(/\.$/, '')], day: +m[2], mon: MONTHS[strip(m[3]).replace(/\.$/, '')], year: m[4] ? +m[4] : null });
    while ((m = re2.exec(t))) out.push({ text: m[0], dow: DAYS[strip(m[1]).replace(/\.$/, '')], day: +m[3], mon: MONTHS[strip(m[2]).replace(/\.$/, '')], year: m[4] ? +m[4] : null });
    return out.filter(function (x) { return x.dow != null && x.mon != null && x.day >= 1 && x.day <= 31; });
  }
  function checkDate(x) {
    var t = todayParts(), y = x.year;
    if (!y) { y = t.y; var cand = new Date(Date.UTC(y, x.mon, x.day)), today = new Date(Date.UTC(t.y, t.m, t.d)); if (cand < new Date(today.getTime() - 30 * 86400000)) y = t.y + 1; }
    var dt = new Date(Date.UTC(y, x.mon, x.day));
    if (dt.getUTCMonth() !== x.mon) return { bad: x.day + ' ' + MONNAME[x.mon] + ' does not exist' };
    var past = dt < new Date(Date.UTC(t.y, t.m, t.d));
    if (dt.getUTCDay() !== x.dow) return { bad: x.day + ' ' + MONNAME[x.mon] + ' ' + y + ' is a ' + DAYNAME[dt.getUTCDay()] + ', not a ' + DAYNAME[x.dow] };
    return { past: past && x.year ? true : false, y: y };
  }
  function where(i) { var e = SS.d; var b = e && e.design && e.design.blocks[i]; return b ? (MAIL202.LABEL[b.type] || b.type) : ''; }
  function checks(e) {
    e = e || SS.d; if (!e) return [];
    var out = [], seen = {};
    var add = function (lvl, msg, i, key) { var k = key || (lvl + msg); if (seen[k]) return; seen[k] = 1; out.push({ lvl: lvl, msg: msg, i: i == null ? null : i }); };
    var subject = str(e.subject).trim(), pre = str(e.preheader).trim(), d = e.design || { blocks: [] };
    if (!subject) add('stop', 'Write a subject: it is what people see first in their inbox.', null);
    else {
      if (subject.length > 70) add('warn', 'The subject is ' + subject.length + ' characters: phones cut it after about 40 to 60.', null);
      if (/[A-Z]{4}/.test(subject) && !/[a-z]/.test(subject.replace(/\{\{[^}]*\}\}/g, ''))) add('warn', 'The subject is all capitals, which reads as shouting (and as spam to some inboxes).', null);
    }
    if (!pre) add('warn', 'Add a preview line: it shows after the subject in most inboxes.', null);
    else if (lower(pre) === lower(subject)) add('warn', 'The preview line repeats the subject: use it to add something.', null);
    if (!d.blocks.length) add('stop', 'The email is empty: add a block or ask the Hub to put it together.', null);
    /* [brackets] the writer still has to fill in */
    var all = [{ i: null, text: subject }, { i: null, text: pre }].concat(MAIL202.texts(d));
    d.blocks.forEach(function (b, i) { if (b.type === 'button' || b.type === 'video') all.push({ i: i, text: str(b.url) }); (b.links || []).forEach(function (l) { if (l) all.push({ i: i, text: str(l.url) }); }); });
    all.forEach(function (t) {
      var re = /\[([^\]\n]{1,90})\](?!\()/g, m;
      while ((m = re.exec(t.text))) add('stop', 'Fill in: ' + m[1] + (t.i != null ? ' (' + where(t.i) + ')' : ' (the subject or preview line)'), t.i, 'br' + m[1] + t.i);
    });
    /* placeholders */
    var ph = MAIL202.placeholders(subject + ' ' + pre + ' ' + MAIL202.render(d));
    ph.filter(function (p) { return MAIL202.KNOWN.indexOf(p) < 0; }).forEach(function (p) { add('warn', '{{' + p + '}} is not something the Hub fills in, so it will be empty. Write it out instead.', null, 'ph' + p); });
    var allText = all.map(function (t) { return t.text; }).join('\n');
    if (/\{\{\s*first_name\s*\}\}/.test(allText)) add('note', 'Give {{first_name}} a fallback, like {{first_name|there}}, for people without a first name in the CRM.', null);
    var trig = ['amount', 'gift_date', 'gift_date_line', 'campaign', 'event_day', 'event_when', 'event_title', 'role', 'form_title'].filter(function (p) { return ph.indexOf(p) >= 0; });
    if (trig.length) add('note', 'It uses ' + trig.map(function (p) { return '{{' + p + '}}'; }).join(', ') + ', which only an automation fills (a gift, a serving or a form). Sent any other way, the fallback words show.', null);
    /* links and pictures */
    MAIL202.links(d).forEach(function (l) {
      var u = str(l.url).trim();
      if (!u) { if (l.need) add('stop', (l.label ? '“' + l.label + '”' : 'A button') + ' has no link (' + where(l.i) + ').', l.i); return; }
      if (/^\[/.test(u)) return;
      if (!MAIL202.safeUrl(u)) add('stop', '“' + u + '” is not a web address (' + where(l.i) + ').', l.i);
      else if (/example\.(com|org)|yourlink|lien ici|link here/i.test(u)) add('warn', '“' + u + '” looks like a stand-in link (' + where(l.i) + ').', l.i);
      else if (/^http:\/\//i.test(u)) add('note', u + ' is not https: a secure link is safer and fewer inboxes flag it.', l.i);
      if (l.inText && /^(click here|here|ici|cliquez ici)$/i.test(str(l.label).trim())) add('warn', 'Say where a link goes instead of “' + l.label + '”: it reads better and is clearer for screen readers.', l.i);
    });
    var imgs = MAIL202.images(d);
    imgs.forEach(function (p) {
      if (!str(p.alt).trim()) add('warn', 'A photo has no description (alt text): people using screen readers, and inboxes that block images, get nothing (' + where(p.i) + ').', p.i, 'alt' + p.i + '.' + p.k);
      if (p.usage && p.usage !== 'ready') add('warn', 'A Photo library picture is marked “' + p.usage + '”, not ready for public use: check it first (' + where(p.i) + ').', p.i, 'use' + p.i + '.' + p.k);
    });
    if (imgs.some(function (p) { return !p.lib; })) add('note', 'Uploaded photos: no close-ups of the people we serve, and anyone recognizable has said yes (the Photo library’s rule).', null);
    d.blocks.forEach(function (b, i) { if ((b.type === 'photo' && !str(b.src).trim()) || (b.type === 'photos' && !(b.items || []).some(function (x) { return x && str(x.src).trim(); }))) add('warn', 'A photo block has no photo yet, so it will not show (' + where(i) + ').', i); });
    /* dates */
    all.forEach(function (t) {
      datesIn(t.text).forEach(function (x) {
        var r = checkDate(x);
        if (r.bad) add('stop', '“' + x.text.trim() + '”: ' + r.bad + '. Which is right?', t.i, 'dt' + x.text);
        else if (r.past) add('warn', '“' + x.text.trim() + '” has passed.', t.i, 'dp' + x.text);
      });
    });
    /* Welfare Avenue's words */
    all.forEach(function (t) {
      if (/—|\s–\s/.test(t.text)) add('warn', 'An em dash: Welfare Avenue writes without them. Use a comma, a colon or a full stop' + (t.i != null ? ' (' + where(t.i) + ')' : '') + '.', t.i, 'dash' + t.i);
      AVOID.forEach(function (a) { if (a[0].test(t.text)) add('warn', '“' + a[1] + '”: we say ' + a[2] + '.', t.i, 'av' + a[1]); });
      if ((t.text.match(/!/g) || []).length > 2) add('note', 'Lots of exclamation marks: one is plenty.', t.i, 'excl');
    });
    /* the kind under CASL */
    var asks = MAIL202.links(d).some(function (l) { return /\/donate|\/give|\bdon\b|donner/i.test(str(l.url)); });
    if (e.kind === 'transactional' && asks) add('warn', 'It asks for gifts, which makes it an appeal under Canada’s anti-spam law: choose “An appeal for gifts” as its kind.', null);
    d.blocks.forEach(function (b, i) { if (b.type === 'hero') (b.lines || []).forEach(function (l) { if (str(l).replace(/\{\{[^}]*\}\}/g, 'xxxxxxxx').length > 20) add('note', 'A headline line over 20 letters wraps on a phone (' + where(i) + ').', i, 'hl' + i); }); });
    if (!d.blocks.some(function (b) { return b.type === 'signoff'; }) && d.blocks.length) add('note', 'No sign-off: people reply more to an email signed by a person.', null);
    var order = { stop: 0, warn: 1, note: 2 };
    return out.sort(function (a, b) { return order[a.lvl] - order[b.lvl]; });
  }
  function stops(e) { return checks(e).filter(function (c) { return c.lvl === 'stop'; }); }
