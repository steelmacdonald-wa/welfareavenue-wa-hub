  /* ---------- wave204 (04/10/26): your content first. Steel: "ensure that it is important to come with their content first. It
     is unacceptable to only use AI. Bad input = bad output." The Hub shapes what the writer brings; it never writes the email
     for them. Tell the Hub asks for at least 40 words of the writer's own (three or four sentences, links not counted) before it
     calls the AI, with a meter under the box (the words, a date or day, a link); Fill it in with the Hub needs every detail the
     template asks for (a template with nothing to fill needs 20 words of your own); the prompt tells the model to build from
     the writer's content and never pad thin input. Building by hand stays open to everyone, any time. ---------- */
  var CONTENT_MIN = 40, EXTRA_MIN = 20;
  function ownWords(s) {
    return (str(s).replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+|www\.\S+/gi, ' ').match(/[A-Za-z0-9À-ɏ][A-Za-z0-9À-ɏ'’-]*/g) || []).length;
  }
  function contentFacts(s) {
    s = str(s);
    return { words: ownWords(s),
      date: datesIn(s).length > 0 || /\b(today|tomorrow|tonight|(sun|mon|tues|wednes|thurs|fri|satur)days?|\d{1,2}(st|nd|rd|th)?\s+(of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}|dimanche|lundi|mardi|mercredi|jeudi|vendredi|samedi|demain|aujourd)/i.test(s),
      link: /https?:\/\/\S+|www\.\S+|\b[a-z0-9-]+\.(com|org|ca|net|io)\b/i.test(s) };
  }
  function meterHtml() {
    var f = contentFacts(SS.start.brief), ok = f.words >= CONTENT_MIN, pct = Math.min(100, Math.round(f.words / CONTENT_MIN * 100));
    return '<div class="w204meter' + (ok ? ' ok' : '') + '" id="w204meter" aria-live="polite"><span class="w204bar" aria-hidden="true"><i style="width:' + pct + '%"></i></span>' +
      '<span><b>' + (ok ? 'Your content is in' : 'Your content first') + ':</b> ' + E(plural(f.words, 'word', 'words')) + (ok ? '' : ' of at least ' + CONTENT_MIN) +
      ' · ' + (f.date ? '✓ a date or day' : '○ no date yet') + ' · ' + (f.link ? '✓ a link' : '○ no link yet') + '</span></div>';
  }
  function updateMeter() {
    var el = document.getElementById('w204meter'); if (el) el.outerHTML = meterHtml();
    var btn = SS.root && SS.root.querySelector('[data-w202startai]'); if (btn) btn.classList.toggle('notyet', ownWords(SS.start.brief) < CONTENT_MIN);
  }
  function contentShort(n) {
    return 'Bring your content first: write or paste at least ' + CONTENT_MIN + ' words of your own, about three or four sentences (you have ' + n + '). What is happening, why it matters, the facts and what people should do. The Hub shapes what you bring; it does not write the email for you. Bad input, bad output.';
  }
  /* Fill it in with the Hub: every detail the template asks for, or (nothing to fill) a few sentences of your own */
  function tplShort(t, s) {
    var asks = (t.design && t.design.asks) || [];
    var missing = asks.filter(function (a) { return str(s.asks[a.id]).trim().length < 2; });
    if (asks.length && missing.length) return 'Give the template your details first: ' + missing.length + ' of ' + asks.length + ' still empty (' + missing.map(function (a) { return a.label; }).join(' / ') + '). The Hub fills in your content; it does not make it up. Or choose Fill it in myself.';
    if (!asks.length && ownWords(s.extra) < EXTRA_MIN) return 'This template is ready as it is. For the Hub to work your own words in, write a few sentences under Anything else to say (' + EXTRA_MIN + ' words or more), or choose Fill it in myself.';
    return '';
  }
