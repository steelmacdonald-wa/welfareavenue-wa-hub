  /* ---------- the Hub's AI: putting an email together, filling a template, changing it, asking what is missing ----------
     One tool (build_email) through the llm router (x-wa-task email_studio, x-wa-caller email-studio). The model returns the
     blocks, the subject and preview line, and questions about anything missing or doubtful; it never invents a date, a
     place, a number, a name or a link: it leaves a [bracket] where one goes and asks. Photos go by their index; uploaded
     ones are sent as small pictures so the model can describe them. */
  var BLOCK_PROPS = {
    type: { type: 'string', enum: ['hero', 'text', 'heading', 'details', 'list', 'button', 'photo', 'photos', 'video', 'band', 'quote', 'stats', 'signoff', 'divider'] },
    style: { type: 'string', description: 'hero: cream (default) or green; stats: green or cream' },
    kicker: { type: 'string', description: 'hero: a small line above the headline, 2 to 5 words (a date, a place, the occasion)' },
    lines: { type: 'array', items: { type: 'string' }, description: 'hero: the headline in 2 short lines (under 16 letters each); the last line is the coloured one' },
    lead: { type: 'string', description: 'hero: one sentence under the headline' },
    doodle: { type: 'string', enum: ['star', 'heart', 'flowers', 'none'] },
    text: { type: 'string', description: 'text: paragraphs separated by a blank line; **bold** and [words](https://link) allowed. heading: the heading words.' },
    title: { type: 'string', description: 'video, band and stats: the title' },
    rows: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, value: { type: 'string' } }, required: ['label', 'value'] }, description: 'details: label and value rows (When, Where, Bring...)' },
    items: { type: 'array', items: { type: 'object', properties: { lead: { type: 'string' }, text: { type: 'string' }, n: { type: 'string' }, label: { type: 'string' } } }, description: 'list: {lead (a bold start), text}; stats: {n (the number as written), label}' },
    label: { type: 'string', description: 'button: the words on it, 2 to 4 words' },
    url: { type: 'string', description: 'button and video: the full https link' },
    caption: { type: 'string', description: 'button: a short purple line under it; photo: a caption; video: the line under the title' },
    photo: { type: 'integer', description: 'photo: the index of one of the photos given' },
    photos: { type: 'array', items: { type: 'integer' }, description: 'photos: 2 or 3 indexes of the photos given' },
    alt: { type: 'string', description: 'photo: what the photo shows, for screen readers' },
    captions: { type: 'array', items: { type: 'string' }, description: 'photos: a caption per photo (or empty strings)' },
    links: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, url: { type: 'string' } }, required: ['label', 'url'] }, description: 'band: link buttons' },
    quote: { type: 'string' }, by: { type: 'string' },
    note: { type: 'string', description: 'stats: a small note under the numbers' },
    closing: { type: 'string', description: 'signoff: Warmly, / With gratitude, / Merci,' }, name: { type: 'string', description: 'signoff: who signs it' }, role: { type: 'string', description: 'signoff: their role or Welfare Avenue' },
    ps: { type: 'string', description: 'signoff: an optional P.S. line' }
  };
  var AI_TOOL = {
    name: 'build_email',
    description: 'Return the whole email: its subject, preview line, blocks in order, and questions for the writer about anything missing or doubtful.',
    input_schema: { type: 'object', properties: {
      name: { type: 'string', description: 'A short name for the team, e.g. "12 October call-out"' },
      subject: { type: 'string' }, preheader: { type: 'string', description: 'The preview line after the subject in the inbox' },
      blocks: { type: 'array', items: { type: 'object', properties: BLOCK_PROPS, required: ['type'] } },
      questions: { type: 'array', items: { type: 'object', properties: { ask: { type: 'string' }, why: { type: 'string' }, hint: { type: 'string', description: 'An example answer' } }, required: ['ask'] } },
      notes: { type: 'string', description: 'One or two lines for the writer about what you did' }
    }, required: ['subject', 'preheader', 'blocks', 'questions'] }
  };
  /* the voice part of the prompt (wave203): the house voice code, the writer's own guide, or (neither loaded) the built-in paragraph */
  var BUILTIN_VOICE = 'Write in Welfare Avenue\'s voice: warm, specific, credible, plain. Short paragraphs. Impact first. Solidarity, never charity from above. Say "people we serve", "our community", "support", "dignity", "youth-powered". Never say "the homeless", "beneficiaries", "people in need", "the less fortunate", "feed people", "hand out food", "student club", "just volunteers". No em dashes or en dashes as punctuation: use a comma, a colon or a full stop. No hashtags, at most one exclamation mark, no boilerplate like "in these challenging times" or "making a difference together".';
  function voiceBlock(v) {
    if (v && v.key === 'mine' && str(v.text).trim()) return 'VOICE: write as ' + str(v.name || 'the writer') + ', who signs this email, in their own voice. Their writing guide is between the two lines below. Use it for how the words sound: word choice, rhythm, openings and closings. The shape of the email, the facts rule, the links and Welfare Avenue\'s words after it still apply, and anything in the guide about replies, threads, attachments, plain text or tools does not.\n-----\n' + str(v.text).trim() + '\n-----';
    if (v && str(v.text).trim()) return 'VOICE: Welfare Avenue\'s house voice, the Voice Code between the two lines below. Use it for how the words sound. The shape of the email, the facts rule and the links after it still apply.\n-----\n' + str(v.text).trim() + '\n-----';
    return BUILTIN_VOICE;
  }
  function aiSystem(lang, voice) {
    var fr = lang === 'fr';
    return [
      'You put together emails for Welfare Avenue, a youth-powered registered charity in Montreal that fights food insecurity and poverty through direct community action: Sunday servings of meals cooked, driven and served by young volunteers, and the connections to support that follow. Food is the starting point.',
      voiceBlock(voice),
      'Whatever the voice: never "the homeless", "beneficiaries", "people in need", "the less fortunate", "feed people", "hand out food", "student club" or "just volunteers"; no em dashes or en dashes as punctuation (a comma, a colon or a full stop instead); no hashtags; at most one exclamation mark.',
      'Facts: never invent a date, a time, a place, an amount, a number, a name, a quote or a link. Use only what the writer gave, the template\'s own words, and these public figures: 14,000+ meals since April 2020, 250+ servings, 600+ volunteers (our best estimates from our records, rounded down); giving: $25 covers one recipe (a fruit salad for 8 to 10 people), $75 one volunteer cook\'s batch (a dish for 30 to 35 people), $250 the groceries for a whole Sunday serving (about 50 plates), $20 a month about 100 portions a year. Add no claims the writer did not make about how things go (no experience needed, training, who will be there, what happens after signing up, what to bring, food, parking, how long it takes): leave them out, or write a [placeholder] and ask when the email needs one. When something the email needs is missing, write a short [placeholder in square brackets] where it goes and ask about it in questions. When two things disagree (a weekday that is not that date, times that do not add up, a number that changed), ask. Today is ' + todayLine() + ' in Montreal; the next three weeks: ' + nextDays(21) + '. A date without a year is the next one to come. Work out "this Saturday" or "next Sunday" from that list, never from memory.',
      'Content: the writer\'s own content comes first. Build the email from what they gave, keeping their words, facts and order where they work. Never write what they did not give: no filler paragraphs, no invented stories, examples, feelings or reasons. When what they gave is thin, keep the email short and ask for more in your questions rather than padding it.',
      'Links you may use when they fit: https://welfareavenue.com (the website), https://welfareavenue.com/volunteer/ (volunteer sign-up), https://welfareavenue.com/donate/ (giving). Any other link only if the writer gave it.',
      'Shape: one hero first (a kicker, a headline in two short lines, the last line the coloured one, a lead sentence, a doodle), then "Hi {{first_name|there}}," and short paragraphs; details for when and where (and what to bring, when the writer said); a dot list for two to five parallel points; one gold button for the one thing to do (a caption under it only when the writer gave one or it is plainly true, like "On our website"); the writer\'s photos where they help; a sign-off with the sender\'s name when known, else "[Who signs it]". 120 to 300 words unless the material needs more. Keep every {{placeholder}} exactly as written, and use {{first_name|there}} for the greeting.',
      'Subject: under 60 characters, specific, honest, may use {{first_name|friend}}. Preview line: under 90 characters, adds to the subject.',
      'Questions: at most five, only what would block the email or embarrass us if wrong, each a short plain question with a one-line why and an example answer. No questions when nothing is missing.',
      fr ? 'Write the email in French as spoken in Quebec, with "vous", natural and warm (not a translation). Keep the placeholders as they are: {{first_name|there}} becomes {{first_name|}} after "Bonjour".' : 'Write in Canadian English.',
      'Answer only by calling build_email once.'
    ].join('\n\n');
  }
  function todayLine() {
    var t = todayParts(); var dt = new Date(Date.UTC(t.y, t.m, t.d));
    return DAYNAME[dt.getUTCDay()] + ' ' + t.d + ' ' + MONNAME[t.m] + ' ' + t.y;
  }
  /* the coming days written out, so the model never works out a weekday itself (wave202: the first real call called 11 October 2026 a Saturday) */
  function nextDays(n) {
    var t = todayParts(), out = [];
    for (var k = 1; k <= n; k++) { var dt = new Date(Date.UTC(t.y, t.m, t.d + k)); out.push(DAYNAME[dt.getUTCDay()] + ' ' + dt.getUTCDate() + ' ' + MONNAME[dt.getUTCMonth()]); }
    return out.join(', ');
  }
  /* the writer's dates checked by the Hub (d_checks' datesIn and checkDate): a weekday that is not that date, a date that does not exist */
  function dateNotes(texts) {
    var seen = {}, out = [];
    (texts || []).forEach(function (t) { datesIn(t).forEach(function (x) { var c = checkDate(x); if (c.bad && !seen[c.bad]) { seen[c.bad] = 1; out.push('- "' + x.text.trim() + '": ' + c.bad + '.'); } }); });
    return out;
  }
  function photoLines(photos) {
    return (photos || []).map(function (p, i) { return i + ': ' + (p.lib ? 'from our Photo library, "' + str(p.title || p.alt) + '"' + (p.alt ? ' (' + p.alt + ')' : '') : 'uploaded by the writer' + (p.data ? ' (image ' + (i + 1) + ' below)' : '')) + (p.caption ? ', caption: ' + p.caption : ''); }).join('\n');
  }
  /* the design as the model reads it: photos by index into the photo list (added to it when new), no ids */
  function designForAi(d, photos) {
    var idx = function (src, alt, lib, usage) {
      for (var k = 0; k < photos.length; k++) if (photos[k].src === src) return k;
      photos.push({ src: src, alt: alt || '', lib: lib || null, usage: usage || null, title: '' }); return photos.length - 1;
    };
    return JSON.stringify((d && d.blocks || []).map(function (b) {
      var o = {};
      Object.keys(b).forEach(function (k) { if (['id', 'lib', 'usage', 'src', 'items', 'gif', 'gw', 'gh', 'gkb'].indexOf(k) < 0 && b[k] !== '' && b[k] != null) o[k] = b[k]; });   /* wave204: a moving preview stays with the card (keepMoving), the model never sees it */
      if (b.type === 'photo' && str(b.src).trim()) o.photo = idx(b.src, b.alt, b.lib, b.usage);
      if (b.type === 'photos') { var its = (b.items || []).filter(function (x) { return x && str(x.src).trim(); }); o.photos = its.map(function (x) { return idx(x.src, x.alt, x.lib, x.usage); }); o.captions = its.map(function (x) { return str(x.caption); }); }
      else if (b.items) o.items = b.items;
      return o;
    }));
  }
  function aiMessages(o, photos) {
    var who = myName(), k = KIND[o.kind] || KIND.newsletter;
    var head = 'Audience: ' + (AUD[o.audience] || 'Everyone') + '. Kind: ' + k.l + ' (' + k.s + '). Language: ' + (o.lang === 'fr' ? 'French' : 'English') + '. The writer: ' + who + ' (' + myEmail() + ').';
    var parts = [head];
    if (o.mode === 'new') parts.push('Put this email together from what the writer wrote:\n"""\n' + str(o.brief).trim() + '\n"""');
    if (o.mode === 'template') {
      parts.push('Fill in this template for the writer. Keep its shape and its fixed words; replace every [bracket] with the writer\'s details, rewrite what their details change, and drop a block only when it cannot apply. The template, "' + str(o.tplName) + '":\n' + designForAi(o.design, photos) + '\nSubject: ' + str(o.subject) + '\nPreview line: ' + str(o.preheader));
      var asks = (o.asks || []).filter(function (a) { return str(a.answer).trim(); }).map(function (a) { return '- ' + a.label + ' ' + str(a.answer).trim(); }).join('\n');
      parts.push('The writer\'s details:\n' + (asks || '(none given)') + (str(o.brief).trim() ? '\nAnything else they want to say:\n"""\n' + str(o.brief).trim() + '\n"""' : ''));
    }
    if (o.mode === 'change' || o.mode === 'answers') {
      parts.push('The email as it stands:\n' + designForAi(o.design, photos) + '\nSubject: ' + str(o.subject) + '\nPreview line: ' + str(o.preheader));
      if (o.mode === 'change') parts.push('The writer asks: ' + str(o.instruction).trim() + '\nReturn the whole email with that change, and keep everything else as it is (photos by the same index).');
      else parts.push('The writer answered your questions:\n' + (o.qa || []).map(function (q) { return '- ' + q.ask + ' ' + (str(q.answer).trim() || '(no answer)'); }).join('\n') + '\nPut the answers in, remove the [brackets] they fill, and keep everything else as it is. Ask again only about what is still missing.');
    }
    var said = [str(o.brief), str(o.instruction)].concat((o.asks || []).map(function (a) { return str(a.answer); }), (o.qa || []).map(function (q) { return str(q.answer); }));
    if (o.mode === 'answers' && o.design) said = said.concat(MAIL202.texts(o.design).map(function (t) { return t.text; }));
    var dn = dateNotes(said);
    if (dn.length) parts.push('The Hub checked the dates (trust this over your own reckoning):\n' + dn.join('\n') + '\nUnless the writer\'s answers settle it, keep their words in the email and ask which is right.');
    if (photos.length) parts.push('Photos (use them by index in photo and photos blocks):\n' + photoLines(photos));
    var content = [{ type: 'text', text: parts.join('\n\n') }];
    photos.forEach(function (p) { if (p.data) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: p.data } }); });
    return [{ role: 'user', content: content }];
  }
  async function aiCall(o) {
    var photos = (o.photos || []).slice();
    try { await loadVoices(); } catch (e) { /* the built-in voice then */ }
    var body = { max_tokens: 6000, temperature: 0.4, system: aiSystem(o.lang, voiceFor(o.voice)), tools: [AI_TOOL], tool_choice: { type: 'tool', name: 'build_email' }, messages: aiMessages(o, photos) };
    var r;
    try { r = await db.functions.invoke('llm', { headers: { 'x-wa-task': 'email_studio', 'x-wa-caller': 'email-studio' }, body: body }); }
    catch (e) { return { error: msgOf(e) }; }
    if (!r || r.error) { var m = msgOf(r && r.error); if (/401|unauthor/i.test(m)) m = 'Writing with the Hub is not open to this account.'; return { error: m }; }
    var tu = ((r.data && r.data.content) || []).filter(function (c) { return c && c.type === 'tool_use' && c.input; })[0];
    var cost = r.data && r.data._wa && typeof r.data._wa.cost === 'number' ? r.data._wa.cost : null;   /* wave204: what this call cost (US dollars) */
    if (!tu) return { error: 'The Hub did not send an email back. Try again, or build it yourself.', cost: cost };
    return { input: tu.input, photos: photos, cost: cost };
  }
  /* the model's answer made into a studio design: blocks cleaned, photos put back by index */
  function fromAi(input, photos) {
    photos = photos || [];
    var raw = (input && Array.isArray(input.blocks) ? input.blocks : []).map(function (b) {
      b = Object.assign({}, b || {});
      if (b.type === 'photo') { var p = photos[Number(b.photo)]; if (p) { b.src = p.src; b.lib = p.lib || undefined; b.usage = p.usage || undefined; if (!str(b.alt).trim()) b.alt = p.alt || ''; } else b.src = ''; }
      if (b.type === 'photos') {
        var idx = Array.isArray(b.photos) ? b.photos : [], caps = Array.isArray(b.captions) ? b.captions : [];
        b.items = idx.map(function (n, k) { var p = photos[Number(n)]; return p ? { src: p.src, alt: p.alt || '', caption: str(caps[k] || ''), lib: p.lib || undefined, usage: p.usage || undefined } : null; }).filter(Boolean);
      }
      if (b.type === 'hero') { if (!Array.isArray(b.lines)) b.lines = str(b.lines).split(/\n/); b.moveE = true; }
      if (b.type === 'stats' && Array.isArray(b.items)) b.items = b.items.map(function (x) { return { n: str(x && (x.n || x.lead)), label: str(x && (x.label || x.text)) }; });
      return b;
    });
    var design = MAIL202.clean({ v: 1, blocks: raw });
    var qs = (input && Array.isArray(input.questions) ? input.questions : []).slice(0, 5).map(function (q, i) { return { id: 'q' + i + Math.random().toString(36).slice(2, 6), ask: str(q && q.ask).slice(0, 300), why: str(q && q.why).slice(0, 300), hint: str(q && q.hint).slice(0, 200), answer: '' }; }).filter(function (q) { return q.ask; });
    return { design: design, subject: str(input && input.subject).slice(0, 300), preheader: str(input && input.preheader).slice(0, 300), name: str(input && input.name).slice(0, 120), questions: qs, notes: str(input && input.notes).slice(0, 600) };
  }
