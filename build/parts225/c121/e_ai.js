  async function ai(mode) {
    readForm(); var e = C.edit; if (!e) return;
    var lang = (document.getElementById('w121lang') || {}).value || e.lang || 'en'; e.lang = lang;
    var brief = { mode: mode, language: lang === 'fr' ? 'French' : lang === 'both' ? 'English then French' : 'English', title: e.title, notes: e.notes, current_caption: e.caption, platforms: e.platforms, campaign: e.campaign, link: e.link_url, when: e.date ? niceDate(e.date) + ' ' + e.time : null, media: imgs(e).length ? imgs(e).length + ' photo(s)' : vids(e).length ? 'a video (reel)' : 'none' };
    if (mode === 'tailor') {
      /* wave225e: one caption per platform, in each platform's way */
      if (!e.caption.trim() && !e.notes.trim() && !e.title.trim()) { toastS('Write a caption or a brief first'); return; }
      var pls = e.platforms.slice(); if (!pls.length) { toastS('Pick the platforms first'); return; }
      e.aiBusy = true; e.ai = null; paintDrawer();
      try {
        var props = {}; pls.forEach(function (k) { props[k] = { type: 'string' }; });
        var ask2 = 'Rewrite the post for each platform listed, keeping every fact and the ask. Instagram: hook in the first 125 characters, at most ' + hashCap() + ' hashtags at the end, say link in bio. Facebook: conversational, the link can sit in the text. Threads: under 450 characters, one idea, no hashtags or one. LinkedIn: a short professional story about community impact, line breaks, 3 hashtags at most. TikTok: one or two punchy lines, 3 to 5 hashtags. YouTube: the Short’s description, two sentences and the link. Return only the platforms asked for.';
        var r0 = await db.functions.invoke('llm', { body: { task: 'draft', caller: 'content-calendar', max_tokens: 2200, temperature: 0.6, system: CAPTION_SYSTEM, messages: [{ role: 'user', content: ask2 + '\n\nPLATFORMS: ' + pls.join(', ') + '\n\nBRIEF:\n' + JSON.stringify(brief, null, 1) }], tools: [{ name: 'captions_by_platform', description: 'One caption per platform.', input_schema: { type: 'object', properties: props, required: pls } }], tool_choice: { type: 'tool', name: 'captions_by_platform' } } });
        if (r0.error) throw r0.error;
        var tu0 = ((r0.data && r0.data.content) || []).filter(function (c) { return c.type === 'tool_use'; })[0]; var got = (tu0 && tu0.input) || {};
        var done = [];
        pls.forEach(function (k) { var t2 = String(got[k] || '').replace(/—/g, ',').trim(); if (t2) { vOf(e, k).caption = t2; done.push(PL[k].label); } });
        if (!done.length) throw new Error('nothing came back');
        e.dirty = true; e.ai = { tailored: done };
      } catch (x) { toastS('The Hub could not help this time: ' + (x.message || x)); }
      e.aiBusy = false; if (C.edit === e) paintDrawer(); return;
    }
    var ask = mode === 'write' ? 'Write three different caption options from the brief (and the current caption if there is one). Vary the opening line.' : mode === 'shorten' ? 'Shorten the current caption into three tighter options (under 300 characters each), keeping the facts and the ask.' : 'Suggest 8 to 12 relevant hashtags for Montreal or Toronto community, food and volunteering, and one option of the current caption with the best 3 to ' + hashCap() + ' of them at the end.';
    if (mode !== 'write' && !e.caption.trim()) { toastS('Write or generate a caption first'); return; }
    e.aiBusy = true; e.ai = null; paintDrawer();
    try {
      var r = await db.functions.invoke('llm', { body: { task: 'draft', caller: 'content-calendar', max_tokens: 1400, temperature: 0.7, system: CAPTION_SYSTEM, messages: [{ role: 'user', content: ask + '\n\nBRIEF:\n' + JSON.stringify(brief, null, 1) }], tools: [{ name: 'captions', description: 'Caption options and hashtags.', input_schema: { type: 'object', properties: { options: { type: 'array', items: { type: 'object', properties: { caption: { type: 'string' }, note: { type: 'string', description: 'what this option does differently, a few words' } }, required: ['caption'] } }, hashtags: { type: 'array', items: { type: 'string' } } }, required: ['options'] } }], tool_choice: { type: 'tool', name: 'captions' } } });
      if (r.error) throw r.error;
      var tu = ((r.data && r.data.content) || []).filter(function (c) { return c.type === 'tool_use'; })[0];
      var inp = (tu && tu.input) || {};
      var opts = (inp.options || []).map(function (o) { return { caption: String(o.caption || '').replace(/—/g, ',').trim(), note: String(o.note || '').trim() }; }).filter(function (o) { return o.caption; }).slice(0, 3);
      var tags = (inp.hashtags || []).map(function (h) { h = String(h || '').trim().replace(/\s+/g, ''); return h ? (h.charAt(0) === '#' ? h : '#' + h) : ''; }).filter(Boolean).slice(0, 14);
      if (!opts.length && !tags.length) throw new Error('nothing came back');
      if (C.edit === e) { e.ai = { options: opts, hashtags: tags }; }
    } catch (x) { toastS('The Hub could not help this time: ' + (x.message || x)); }
    e.aiBusy = false; if (C.edit === e) paintDrawer();
  }
  /* wave225e: alt text from the photo itself (the model sees the image through the router) */
  async function aiAlt(i) {
    readForm(); var e = C.edit; if (!e) return; var m = e.media[i]; if (!m || !m.url) { toastS('Wait for the upload to finish'); return; }
    e.altBusy = true; paintDrawer();
    try {
      var r = await db.functions.invoke('llm', { body: { task: 'draft', caller: 'content-calendar', max_tokens: 300, temperature: 0.3, system: 'You write alt text for Welfare Avenue’s social media photos: one or two plain sentences, under 250 characters, saying who and what is shown and where if obvious. Never guess names, ages, races or conditions. Do not start with "Image of" or "Photo of". No em dashes.', messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'url', url: m.url } }, { type: 'text', text: 'Write the alt text for this photo.' + (e.caption ? ' The post says: ' + e.caption.slice(0, 400) : '') }] }] } });
      if (r.error) throw r.error;
      var txt = ((r.data && r.data.content) || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join(' ').replace(/—/g, ',').trim();
      if (!txt) throw new Error('nothing came back');
      if (C.edit === e) { m.alt = txt.slice(0, 1000); e.dirty = true; }
    } catch (x) { toastS('The Hub could not write the alt text: ' + (x.message || x)); }
    e.altBusy = false; if (C.edit === e) paintDrawer();
  }
