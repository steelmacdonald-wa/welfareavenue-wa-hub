  /* ---------- wave203 (04/10/26): the voices. Steel: "draft a WA voice code from the brand guide and keep mine too as options."
     Welfare Avenue: the house voice code (app_config mail_voice_wa; every staff member reads it, only admins change it, as
     wa_app_config_guard keeps mail_* keys for admins), the default for everyone. My voice: the writer's own writing guide from
     Your inbox (mybox_owners.voice through the mybox function's voice action), offered only to people who have one, sent to
     the llm router with their own emails and never stored with an email (the design keeps only the choice: voice 'wa' or
     'mine'). Whatever the voice, the facts rule, the links, the shape and Welfare Avenue's words stay in the prompt. ---------- */
  var VOICE_KEY = 'mail_voice_wa';
  SS.voices = { wa: null, mine: null, loaded: false, p: null, open: false, tab: 'wa', editing: false, draft: '', saving: false, err: '' };
  try { var lastVoice = localStorage.getItem('wa203voice'); if (lastVoice === 'mine') SS.start.voice = 'mine'; } catch (e) { /* fine */ }
  if (!SS.start.voice) SS.start.voice = 'wa';
  function rememberVoice(v) { try { localStorage.setItem('wa203voice', v === 'mine' ? 'mine' : 'wa'); } catch (e) { /* fine */ } }
  function loadVoices(force) {
    var V = SS.voices;
    if (V.p) return V.p;
    if (V.loaded && !force) return Promise.resolve(V);
    V.p = (async function () {
      try {
        var r = await db.from('app_config').select('key, value, updated_at').eq('key', VOICE_KEY).limit(1);
        var row = r && Array.isArray(r.data) ? r.data[0] : null, v = row && row.value;
        if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }   /* app_config.value is text holding JSON */
        V.wa = v && typeof v === 'object' && str(v.text).trim() ? { label: str(v.label || 'Welfare Avenue'), text: str(v.text), version: Number(v.version) || 1, source: str(v.source || ''),
          updated_by: str(v.updated_by || ''), updated_at: v.updated_at || row.updated_at || null } : null;
      } catch (e) { V.wa = null; }
      try {
        var o = await db.from('mybox_owners').select('email, enabled').limit(1);
        var own = o && Array.isArray(o.data) ? o.data[0] : null;
        if (own && own.enabled && lower(own.email) === myEmail()) {
          var g = await db.functions.invoke('mybox', { body: { action: 'voice' } });
          var d = g && !g.error && g.data && !g.data.error ? g.data : null;
          V.mine = d && str(d.voice).trim() ? { text: str(d.voice), framework: str(d.framework || '') } : null;
        } else V.mine = null;
      } catch (e) { V.mine = null; }
      V.loaded = true; V.p = null;
      if (SS.start.voice === 'mine' && !V.mine) SS.start.voice = 'wa';
      return V;
    })();
    return V.p;
  }
  /* the voice an email is written in for this person: their own only when they have a guide and it is their email */
  function effVoice(e) {
    var want = e && e.design && e.design.voice === 'mine' ? 'mine' : 'wa';
    if (want === 'mine' && SS.voices.mine && (!e.created_by || lower(e.created_by) === myEmail())) return 'mine';
    return 'wa';
  }
  /* what goes to the model: { key, text, name } (null when the house voice is not set: aiSystem keeps its built-in voice) */
  function voiceFor(key) {
    var V = SS.voices;
    if (key === 'mine' && V.mine) return { key: 'mine', text: V.mine.text, name: myName() };
    if (V.wa) return { key: 'wa', text: V.wa.text, name: 'Welfare Avenue' };
    return null;
  }
  function voiceCtl(cur) {
    var V = SS.voices;
    if (!V.loaded) loadVoices().then(function () { paint(); });
    var opts = [['wa', 'Welfare Avenue']]; if (V.mine) opts.push(['mine', 'My voice']);
    var note = cur === 'mine' && V.mine ? 'Your own writing guide, for emails you sign.' : 'Our house voice from the brand guide: the default for anything written as Welfare Avenue.';
    return '<div class="w155lb">Voice ' + segHtml('data-w202voice', opts, cur === 'mine' && V.mine ? 'mine' : 'wa') +
      '<span class="m">' + E(note) + ' <button class="w202link" data-w202voices>About the voices</button></span></div>';
  }
  function voicesHtml() {
    var V = SS.voices; if (!V.open) return '';
    var tab = V.tab === 'mine' ? 'mine' : 'wa', body;
    var tabs = '<div class="w202seg" role="tablist" aria-label="Voices">' + [['wa', 'Welfare Avenue'], ['mine', 'My voice']].map(function (o) {
      return '<button role="tab" class="' + (o[0] === tab ? 'on' : '') + '" data-w202vtab="' + o[0] + '" aria-selected="' + (o[0] === tab) + '">' + E(o[1]) + '</button>';
    }).join('') + '</div>';
    if (!V.loaded) body = busyHtml('Loading the voices…');
    else if (tab === 'wa') {
      if (V.editing) body = '<p class="m">The house voice the Hub uses for anything written as Welfare Avenue. A change applies to the next email the Hub puts together or changes.</p>' +
        '<textarea class="w152in w202vtext" data-w202vdraft rows="22" aria-label="The Welfare Avenue voice code">' + E(V.draft) + '</textarea>' +
        (V.err ? '<div class="w152err">' + E(V.err) + '</div>' : '') +
        '<div class="w154acts"><button class="w152btn" data-w202vsave' + (V.saving ? ' disabled' : '') + '>' + I('save') + ' ' + (V.saving ? 'Saving…' : 'Save the voice') + '</button><button class="w152btn ghost" data-w202vcancel>Cancel</button></div>';
      else body = (V.wa ? '<p class="m">The house voice for anything written as Welfare Avenue, and the default for everyone. Version ' + V.wa.version + (V.wa.updated_at ? ', ' + E(fmtDay(V.wa.updated_at)) : '') +
          (V.wa.updated_by ? ', ' + E(/@/.test(V.wa.updated_by) ? V.wa.updated_by.split('@')[0] : V.wa.updated_by) : '') + '.</p><div class="w202vread" data-w198skip tabindex="0">' + E(V.wa.text) + '</div>'
        : '<p class="m">The house voice is not set yet, so the Hub uses its short built-in Welfare Avenue voice.</p>') +
        (amAdmin() ? '<div class="w154acts"><button class="w152btn sm" data-w202vedit>' + I('edit') + ' ' + (V.wa ? 'Edit the voice' : 'Write the voice') + '</button></div>' : '<p class="m">Admins look after it. Tell one of them what you would change.</p>');
    } else {
      body = V.mine ? '<p class="m">Your own voice: your writing guide from Your inbox (Settings, Your writing guide). Only you see it, and only emails you write in the studio use it.</p>' +
          '<div class="w202vread" data-w198skip tabindex="0">' + E(V.mine.text) + '</div><div class="w154acts"><button class="w152btn sm ghost" data-w202vinbox>' + I('edit') + ' Edit it in Your inbox</button></div>'
        : '<p class="m">Your own voice comes from a writing guide. People with the inbox assistant write theirs in Your inbox, Settings, Your writing guide; “My voice” then appears beside Welfare Avenue when the Hub writes an email.</p>';
    }
    return '<div class="w202modal" role="dialog" aria-modal="true" aria-label="Voices"><div class="w202mbox wide w202voices">' +
      '<div class="w202mh"><h3>' + I('voice') + ' Voices</h3><button class="w202x" data-w202voicesx aria-label="Close">' + I('x') + '</button></div>' +
      '<p class="m">How the Hub sounds when it puts an email together. Whatever the voice, it never invents a fact, and the studio’s checks still run.</p>' + tabs + body + '</div></div>';
  }
  function openVoices(tab) {
    var V = SS.voices; V.open = true; V.editing = false; V.err = ''; V.tab = tab || (SS.start.voice === 'mine' && V.mine ? 'mine' : 'wa');
    loadVoices().then(function () { paint(); }); paint();
  }
  async function saveVoice() {
    var V = SS.voices, text = str(V.draft).replace(/\r\n/g, '\n').trim();
    if (!amAdmin()) { V.err = 'Only an admin can change the house voice.'; paint(); return; }
    if (text.length < 200) { V.err = 'That is very short for a voice code: keep at least a few lines on how we sound.'; paint(); return; }
    if (text.length > 20000) { V.err = 'Keep the voice under 20,000 characters: the Hub sends it with every email it writes.'; paint(); return; }
    if (/[—–]/.test(text)) { V.err = 'The voice code has an em dash or an en dash in it. Our own rules say no dashes as punctuation: use a comma, a colon or a full stop.'; paint(); return; }
    V.saving = true; V.err = ''; paint();
    var prev = V.wa, now = new Date().toISOString();
    var val = { label: 'Welfare Avenue', text: text, version: ((prev && prev.version) || 0) + 1, source: (prev && prev.source) || 'Welfare Avenue Brand Guides v1 2026', updated_by: myEmail(), updated_at: now };
    var r; try { r = await db.from('app_config').upsert({ key: VOICE_KEY, value: JSON.stringify(val), updated_at: now }, { onConflict: 'key' }); } catch (e) { r = { error: e }; }
    V.saving = false;
    if (!r || r.error) { var m = msgOf(r && r.error); V.err = /admin/i.test(m) ? 'Only an admin can change the house voice.' : 'The voice did not save: ' + m; paint(); return; }
    try { await db.from('change_log').insert({ entity_type: 'writing_voice', entity_id: VOICE_KEY, field: 'text', old_value: prev ? 'v' + prev.version + ', ' + prev.text.length + ' characters' : null, new_value: 'v' + val.version + ', ' + text.length + ' characters', changed_by: myEmail() }); } catch (e) { /* the audit line is best effort */ }
    V.wa = { label: val.label, text: text, version: val.version, source: val.source, updated_by: val.updated_by, updated_at: now };
    V.editing = false; V.draft = ''; T('The Welfare Avenue voice is saved');
    paint();
  }
