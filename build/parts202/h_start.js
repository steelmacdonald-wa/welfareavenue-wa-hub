  /* ---------- starting an email: Tell the Hub (words and photos), Start from a template (details), Build it yourself ---------- */
  function segHtml(attr, opts, cur) {
    return '<div class="w202seg" role="group">' + opts.map(function (o) { return '<button class="' + (o[0] === cur ? 'on' : '') + '" ' + attr + '="' + o[0] + '" aria-pressed="' + (o[0] === cur) + '">' + E(o[1]) + '</button>'; }).join('') + '</div>';
  }
  function kindSel(attr, cur) {
    return '<select class="w152sel" ' + attr + ' aria-label="What kind of email">' + Object.keys(KIND).map(function (k) { return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + E(KIND[k].l) + '</option>'; }).join('') + '</select>';
  }
  function langSel(attr, cur) { return '<select class="w152sel" ' + attr + ' aria-label="Language"><option value="en"' + (cur !== 'fr' ? ' selected' : '') + '>English</option><option value="fr"' + (cur === 'fr' ? ' selected' : '') + '>Français</option></select>'; }
  function startPhotosHtml() {
    var ps = SS.start.photos;
    return '<div class="w155lb">Photos <span class="m">Up to six. The Hub places them and describes them; you can change everything after.</span>' +
      '<div class="w202sph" data-w198skip>' + ps.map(function (p, i) {
        return '<div class="w202spc"><img src="' + E(p.thumb || p.src) + '" alt="' + E(p.alt || p.title || 'Photo ' + (i + 1)) + '"><button class="w202x sm" data-w202sdel="' + i + '" aria-label="Remove this photo">' + I('x') + '</button>' +
          '<input class="w152in" data-w202scap="' + i + '" value="' + E(p.caption || '') + '" placeholder="What is in it? (optional)" aria-label="What is in photo ' + (i + 1) + '"></div>';
      }).join('') + (ps.length < 6 ? '<button class="w202spadd" data-w202pickstart>' + I('image') + '<span>Add photos</span></button>' : '') + '</div></div>';
  }
  function startBar(title) {
    return '<div class="w202bar"><button class="w152btn sm ghost" data-w202go="#crm/studio">' + I('back') + ' The studio</button><h2>' + E(title) + '</h2></div>';
  }
  function aiStartHtml() {
    var s = SS.start, k = KIND[s.kind] || KIND.newsletter;
    return '<div class="w202">' + startBar('Tell the Hub') + (SS.startNote && SS.startNote.view === 'ai' ? '<div class="w154msg">' + E(SS.startNote.text) + '</div>' : '') +
      '<div class="w202cols st"><div class="w154card w202form" data-w202sec="ai">' +
      '<div class="w155lb">Who is it for?' + segHtml('data-w202aud', [['volunteers', 'Volunteers'], ['donors', 'Donors'], ['everyone', 'Everyone']], s.audience) + '</div>' +
      '<label class="w155lb">What kind of email?' + kindSel('data-w202kind="start"', s.kind) + '<span class="m">' + E(k.s) + '</span></label>' +
      '<label class="w155lb">Language' + langSel('data-w202lang="start"', s.lang) + '</label>' +
      voiceCtl(s.voice) +
      '<label class="w155lb">What do you want to say? <span class="m">Paste your text from a doc or an email (bold and links come along), or write it here. No HTML needed: the Hub designs the email.</span><textarea class="w152in w202say" data-w202say="brief" data-w202s="brief" rows="10" placeholder="Your content, in your own words: what is happening, why it matters, the day and date, the times, the place, and what people should do (with the link). The Hub shapes what you bring; it never makes up the facts.">' + E(s.brief) + '</textarea></label>' +
      meterHtml() +
      startPhotosHtml() +
      (SS.err ? '<div class="w152err">' + E(SS.err) + '</div>' : '') +
      '<div class="w154acts"><button class="w152btn' + (ownWords(s.brief) < CONTENT_MIN ? ' notyet' : '') + '" data-w202startai' + (SS.busy ? ' disabled' : '') + '>' + I('spark') + ' Put it together ' + aboutStep() + '</button>' +
      '<button class="w152btn ghost" data-w202startself>Build it myself with these words ' + aboutStep(true) + '</button></div>' +
      (SS.busy ? busyHtml(SS.busy) : '') + '</div>' +
      '<aside class="w202tips"><h4>Your content first</h4><p class="m">The Hub shapes what you bring; it does not write the email for you. Bad input, bad output: thin words make a thin email, and each try costs about 2¢.</p><ul><li><b>Your own words:</b> what is happening and why it matters, three or four sentences at least.</li><li><b>The facts:</b> the day and date, the times, the place, how many people you need, the link to sign up or give.</li>' +
      '<li><b>Who signs it,</b> if not you.</li><li><b>One thing to do:</b> what should people do after reading?</li><li><b>Photos</b> of our volunteers, food and setups (no close-ups of the people we serve).</li></ul>' +
      '<p class="m">The Hub writes it in the voice you pick (Welfare Avenue’s house voice, or your own when you have a writing guide), leaves [brackets] where something is missing and asks you about it. Nothing is sent until you choose to.</p></aside></div>' +
      pickerHtml() + voicesHtml() + '</div>';
  }
  function tplStartHtml() {
    var s = SS.start, t = s.tpl ? tplByKey(s.tpl) : null;
    var asks = t && t.design && t.design.asks ? t.design.asks : [];
    return '<div class="w202">' + startBar('Start from a template') + (SS.startNote && SS.startNote.view === 'tpl' ? '<div class="w154msg">' + E(SS.startNote.text) + '</div>' : '') +
      '<div class="w202cols st"><div class="w202pickcol" data-w202sec="pick">' + filterHtml() + shelvesHtml(studioTemplates(), true) + '</div>' +
      '<div class="w154card w202form" data-w202sec="details">' + (!t ? '<p class="m">Pick a template. Then give it your details, and the Hub fills it in.</p>' :
        '<div class="w202tsel">' + miniHero(t) + '<div data-w198skip><h3>' + E(t.name) + '</h3><p class="m">' + E(t.description || '') + '</p></div></div>' +
        '<button class="w152btn sm ghost" data-w202peek="' + E(t.key) + '">' + I('eye') + ' Look at the template</button>' +
        (asks.length ? '<h4 class="w202h4">Your details</h4>' + asks.map(function (a) {
          return '<label class="w155lb" data-w198skip>' + E(a.label) + '<input class="w152in" data-w202ask="' + E(a.id) + '" value="' + E(s.asks[a.id] || '') + '" placeholder="' + E(a.hint ? 'For example: ' + a.hint : '') + '"></label>';
        }).join('') : '<p class="m">This one is ready as it is. Add anything you want to say, or use it straight away.</p>') +
        '<label class="w155lb">Anything else to say? <span class="m">Optional</span><textarea class="w152in w202say" data-w202say="extra" data-w202s="extra" rows="4" placeholder="A story, a thank-you, a detail the template does not ask for.">' + E(s.extra) + '</textarea></label>' +
        '<label class="w155lb">Language' + langSel('data-w202lang="start"', s.lang) + '</label>' +
        voiceCtl(s.voice) +
        startPhotosHtml() +
        (SS.err ? '<div class="w152err">' + E(SS.err) + '</div>' : '') +
        '<p class="m">Your details first: the Hub fills in what you give it and never makes up the rest.</p>' +
        '<div class="w154acts"><button class="w152btn" data-w202starttpl="ai"' + (SS.busy ? ' disabled' : '') + '>' + I('spark') + ' Fill it in with the Hub ' + aboutStep() + '</button>' +
        '<button class="w152btn ghost" data-w202starttpl="self">Fill it in myself ' + aboutStep(true) + '</button></div>' + (SS.busy ? busyHtml(SS.busy) : '')) + '</div></div>' +
      pickerHtml() + peekHtml() + voicesHtml() + '</div>';
  }
  /* a new email in memory, then saved (it needs a subject to be saved) */
  function draftFrom(o) {
    return { key: null, name: o.name || 'New email', kind: o.kind || 'newsletter', audience: o.audience || null, lang: o.lang || 'en', subject: o.subject || '', preheader: o.preheader || '',
      design: MAIL202.clean(o.design || { blocks: [] }), one_off: true, category: null, description: '', active: true, created_by: myEmail(), updated_at: null };
  }
  function photosForAi(ps) { return ps.map(function (p) { return { src: p.src, alt: p.alt || '', title: p.title || '', lib: p.lib || null, usage: p.usage || null, caption: p.caption || '', data: p.data || '' }; }); }
  async function openDraft(d, opts) {
    SS.d = d; SS.questions = (opts && opts.questions) || []; SS.notes = (opts && opts.notes) || ''; SS.open = {}; SS.send = null; SS.ro = false; SS.err = ''; SS.msg = '';
    histReset(); SS.startNote = null;   /* wave204: a new history; the step before, when the Hub made it from what you gave */
    SS.back = opts && opts.back ? Object.assign({ d: d }, opts.back) : null;
    if (d.design.blocks[0]) SS.open[d.design.blocks[0].id] = !SS.questions.length && !!(opts && opts.openFirst);
    SS.view = 'edit'; SS.busy = '';
    var key = str(d.subject).trim() ? await saveNow() : null;
    go('#crm/studio/e/' + (key || 'new'));
    if (SS.to) openSend('person'); else paint();
  }
  async function startAi() {
    var s = SS.start;
    var nw = ownWords(s.brief);
    if (nw < CONTENT_MIN) { SS.err = contentShort(nw); paint(); return; }   /* wave204: your content first */
    SS.startNote = null;
    SS.err = ''; SS.busy = 'The Hub is putting your email together. This takes about half a minute…'; paint();
    var photos = photosForAi(s.photos), back = { view: 'ai', brief: s.brief, photos: s.photos.slice(), audience: s.audience, kind: s.kind, lang: s.lang, voice: s.voice };
    var r = await aiCall({ mode: 'new', brief: s.brief, audience: s.audience, kind: s.kind, lang: s.lang, photos: photos, voice: s.voice });
    if (r.error) { SS.busy = ''; SS.err = r.error; paint(); return; }
    var res = fromAi(r.input, r.photos);
    if (!res.design.blocks.length) { SS.busy = ''; SS.err = 'The Hub sent back an empty email. Try again with a few more details, or build it yourself.'; paint(); return; }
    res.design.source = 'ai'; res.design.voice = s.voice === 'mine' && SS.voices.mine ? 'mine' : 'wa'; res.design.ai = addCost(null, r.cost);
    await openDraft(draftFrom({ name: res.name || 'New email', kind: s.kind, audience: s.audience, lang: s.lang, subject: res.subject, preheader: res.preheader, design: res.design }), { questions: res.questions, notes: res.notes, back: back });
    SS.start.brief = ''; SS.start.photos = []; paint();
  }
  function startSelf() {
    var s = SS.start, blocks = [MAIL202.blank('hero')];
    var text = str(s.brief).trim();
    var t = MAIL202.blank('text'); t.text = 'Hi {{first_name|there}},' + (text ? '\n\n' + text : '\n\n'); blocks.push(t);
    s.photos.forEach(function (p) { var b = MAIL202.blank('photo'); b.src = p.src; b.alt = p.alt || ''; b.caption = p.caption || ''; if (p.lib) b.lib = p.lib; if (p.usage) b.usage = p.usage; blocks.push(b); });
    var btn = MAIL202.blank('button'); btn.label = s.kind === 'fundraising' ? 'Give today' : s.kind === 'volunteer' ? 'Sign up to serve' : 'Find out more'; btn.url = s.kind === 'fundraising' ? 'https://welfareavenue.com/donate/' : s.kind === 'volunteer' ? 'https://welfareavenue.com/volunteer/' : ''; blocks.push(btn);
    var so = MAIL202.blank('signoff'); so.name = myName(); blocks.push(so);
    var d = draftFrom({ name: 'New email', kind: s.kind, audience: s.audience, lang: s.lang, subject: '', preheader: '', design: { blocks: blocks, source: 'blocks', voice: s.voice === 'mine' && SS.voices.mine ? 'mine' : 'wa' } });
    var back = { view: 'ai', brief: s.brief, photos: s.photos.slice(), audience: s.audience, kind: s.kind, lang: s.lang, voice: s.voice };
    SS.start.brief = ''; SS.start.photos = [];
    openDraft(d, { openFirst: true, back: back });
  }
  function startBlank() {
    var s = SS.start, so = MAIL202.blank('signoff'); so.name = myName();
    openDraft(draftFrom({ name: 'New email', kind: s.kind, audience: s.audience, lang: s.lang, design: { blocks: [MAIL202.blank('hero'), MAIL202.blank('text'), MAIL202.blank('button'), so], source: 'blocks', voice: s.voice === 'mine' && SS.voices.mine ? 'mine' : 'wa' } }), { openFirst: true });
  }
  function copyOf(t, o) {
    var d = JSON.parse(JSON.stringify(t.design || { blocks: [] }));
    d.from = t.key; d.source = (o && o.source) || 'template'; delete d.asks; delete d.ai;   /* wave204: a copy starts with nothing spent */
    (d.blocks || []).forEach(function (b) { b.id = MAIL202.uid(); });
    return draftFrom({ name: (o && o.name) || t.name, kind: t.kind === 'test' ? 'newsletter' : t.kind, audience: t.audience, lang: t.lang || 'en', subject: t.subject, preheader: t.preheader || '', design: d });
  }
  async function startTpl(useAi) {
    var s = SS.start, t = tplByKey(s.tpl); if (!t) return;
    var asks = (t.design && t.design.asks) || [], back = { view: 'tpl', tpl: t.key, asks: Object.assign({}, s.asks), extra: s.extra, photos: s.photos.slice(), lang: s.lang, voice: s.voice };
    if (!useAi) { var d0 = copyOf(t); d0.design.voice = s.voice === 'mine' && SS.voices.mine ? 'mine' : 'wa'; s.photos.forEach(function (p) { var b = MAIL202.blank('photo'); b.src = p.src; b.alt = p.alt || ''; if (p.lib) b.lib = p.lib; if (p.usage) b.usage = p.usage; d0.design.blocks.splice(Math.max(1, d0.design.blocks.length - 1), 0, b); }); SS.start.photos = []; await openDraft(d0, { openFirst: false, back: back }); return; }
    var given = asks.map(function (a) { return { label: a.label, answer: s.asks[a.id] || '' }; });
    var short = tplShort(t, s); if (short) { SS.err = short; paint(); return; }   /* wave204: your content first */
    SS.err = ''; SS.busy = 'The Hub is filling in “' + t.name + '”. This takes about half a minute…'; paint();
    var photos = photosForAi(s.photos);
    var r = await aiCall({ mode: 'template', design: t.design, subject: t.subject, preheader: t.preheader, tplName: t.name, asks: given, brief: s.extra, audience: t.audience, kind: t.kind, lang: s.lang || t.lang, photos: photos, voice: s.voice });
    if (r.error) { SS.busy = ''; SS.err = r.error; paint(); return; }
    var res = fromAi(r.input, r.photos);
    if (!res.design.blocks.length) { SS.busy = ''; SS.err = 'The Hub sent back an empty email. Try again, or fill it in yourself.'; paint(); return; }
    res.design.from = t.key; res.design.source = 'template+ai'; res.design.voice = s.voice === 'mine' && SS.voices.mine ? 'mine' : 'wa'; res.design.ai = addCost(null, r.cost);
    keepMoving(t.design, res.design);   /* wave204: a template's moving preview stays */
    await openDraft(draftFrom({ name: res.name || t.name, kind: t.kind, audience: t.audience, lang: s.lang || t.lang, subject: res.subject || t.subject, preheader: res.preheader || t.preheader, design: res.design }), { questions: res.questions, notes: res.notes, back: back });
    SS.start.asks = {}; SS.start.extra = ''; SS.start.photos = []; paint();
  }
