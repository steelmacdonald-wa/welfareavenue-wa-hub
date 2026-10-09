
  /* ---------- the academy's page tours (wave122's engine; trainings row tour:contentstudio; tour:studio is the Email studio (wave202)) ---------- */
  function addTours() {
    try {
      var T = window.w122; if (!T || !T.tours) return false;
      var OPT = { opt: 1 };
      var St = function (sel, t, p, o) { var x = { s: sel, t: t, p: p }; if (o) Object.keys(o).forEach(function (k) { x[k] = o[k]; }); return x; };
      var Ct = function (t, p) { return { c: 1, t: t, p: p }; };
      if (!T.tours.contentstudio || !T.tours.contentstudio.__w225) T.tours.contentstudio = { __w225: true, tab: 'studio', icon: 'grid', hash: '#studio', steps: [
        St('#studio > .w118mast', 'Content Studio', 'Everything for our social media in one app: plan, approve, post, answer comments and see what worked, on Instagram, Facebook, Threads, LinkedIn, TikTok and YouTube.'),
        St('#w225host .kpis', 'At a glance', 'What is scheduled, what waits for approval, comments to answer, the weekly goal and the clicks on our links. Each number opens its page.', OPT),
        St('#w225host .grid2', 'The week ahead', 'The next seven days, anything that needs attention, the goals and how each platform posts.', OPT),
        Ct('The app menu', 'Calendar to plan and write posts; Queue and schedule for the posting times and goals; Approvals; Comments; Library for templates, hashtags and saved replies; Link pages for our link in bio and campaign pages, with who clicks what; Short links; Analytics; Report; Connections.'),
        Ct('Approvals', 'Marketing leads and admins publish. Everyone else presses Send for approval in the composer; a lead approves it or sends it back with a note, and you hear about it in the Hub and on Slack.'),
        Ct('Reminders', 'Where the Hub cannot post yet (LinkedIn, TikTok or YouTube until they are connected), the post’s owner gets a reminder at post time with the caption and the media. Post it in the app, then press Mark posted.')
      ] };
      var cc = T.tours.contentcal;
      if (cc && !cc.__w225) {
        cc.__w225 = true;
        cc.steps = (cc.steps || []).map(function (s) {
          if (s.s === '#contentcal .w116top') return St(s.s, 'Content calendar', 'Plan, approve and publish posts for Instagram, Facebook, Threads, LinkedIn, TikTok and YouTube. It lives in the Content Studio app.');
          if (s.s === '#contentcal .cap') return St(s.s, 'How we post', 'Which platforms the Hub posts to directly, and which ones send a reminder to post by hand. Connections in the Content Studio sets them up.', OPT);
          if (s.c && s.t === 'The composer') return Ct('The composer', 'Pick the platforms, write the caption (the Hub drafts it and tailors it for each platform), add images or a video with alt text, a first comment and tags. Preview it on each platform, then plan it, schedule it in the next free slot, or send it for approval.');
          if (s.s === '#contentcal .chips') return St(s.s, 'Filters', 'By platform, state, tag, and the posts waiting for approval.', OPT);
          return s;
        });
      }
      return true;
    } catch (e) { return false; }
  }
