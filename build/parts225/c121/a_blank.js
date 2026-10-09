  function blank(day) {
    var slot = bestSlot(); var ns = day && day !== '1' && day !== 'idea' ? { date: day, time: slot && slot.h != null ? String(slot.h).padStart(2, '0') + ':00' : '18:00' } : (day === 'idea' ? { date: '', time: '' } : nextSlotDate(slot));
    return { id: null, title: '', platforms: ['instagram', 'facebook'], caption: '', link_url: '', media: [], date: ns.date, time: ns.time, owner: me(), campaign: '', notes: '', status: 'draft', results: {}, live: {}, error: null, dirty: false, tab: 'instagram', ai: null, aiBusy: false, lang: 'en', manual: false,
      /* wave225d: the Content Studio */
      variants: {}, first_comment: '', tags: [], repeat: '', repeat_times: 4, track_links: true, utm_campaign: '', approval_status: 'none', approval_note: '', submitted_by: null, manualMap: {}, vtab: 'instagram', altIdx: null, apNote: '' };
  }
  function fromPost(p) {
    var rr = p.repeat_rule || {};
    return { id: p.id, title: p.title || '', platforms: (p.platforms || []).slice(), caption: p.caption || '', link_url: p.link_url || '', media: (p.media || []).map(function (m) { var c = Object.assign({}, m); if (m.tags) c.tags = m.tags.map(function (t) { return Object.assign({}, t); }); return c; }), date: p.scheduled_at ? dayOf(p.scheduled_at) : '', time: p.scheduled_at ? hm(p.scheduled_at) : '', owner: p.owner || '', campaign: p.campaign || '', notes: p.notes || '', status: p.status || 'draft', results: p.results || {}, live: p.live || {}, error: p.error || null, published_at: p.published_at || null, dirty: false, tab: (p.platforms || [])[0] || 'instagram', ai: null, aiBusy: false, lang: 'en', manual: false,
      variants: JSON.parse(JSON.stringify(p.variants || {})), first_comment: p.first_comment || '', tags: (p.tags || []).slice(), repeat: rr.every || '', repeat_times: rr.times || 4, track_links: p.track_links !== false, utm_campaign: (p.utm && p.utm.campaign) || '', approval_status: p.approval_status || 'none', approval_note: p.approval_note || '', submitted_by: p.submitted_by || null, manualMap: p.manual || {}, vtab: (p.platforms || [])[0] || 'instagram', altIdx: null, apNote: '' };
  }
