/* wave215 b_walks: the seven HR centre walkthroughs. Each step: t (title), p (what to do, HTML), s (what to ring),
   hash (open a page first), go (do something first), done (true when the learner has done it: the card moves on),
   skipIf, copy {label, text}, fill / act (a helper button). Selectors are the live ones (waves 46, 105, 116p, 169, 197, 199,
   209, 211, 212); test/w215drive.js walks every one of them. */
(function () {
  'use strict';
  if (!window.w215) return;
  var W = window.w215;
  var SAMPLE_CV = 'https://docs.google.com/document/d/1loqe66CRVkBYTTmsJ0TQbjzlZ6UEZSDSbCisQ2Ktd3k/edit';

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function P() { return Array.prototype.slice.call(arguments).map(function (x) { return x.charAt(0) === '<' ? x : '<p>' + x + '</p>'; }).join(''); }
  function L(items) { return '<ul>' + items.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>'; }
  function lower(s) { return String(s || '').trim().toLowerCase(); }
  function S() { try { return w197.state(); } catch (e) { return { cands: [], data: null }; } }
  function cands() { return S().cands || []; }
  function mine() { var em = W.me().email; return cands().filter(function (c) { return c.practice && lower(c.email) === em; }).sort(function (a, b) { return b.id - a.id; })[0] || null; }
  function cand() { var c = mine(); return c ? cands().filter(function (x) { return x.id === c.id; })[0] : null; }
  function open() { var s = document.getElementById('w197sheet'); return !!(s && s.classList.contains('open')); }
  function sheetFor(c) { return !!c && open() && String(S().open) === String(c.id); }
  function hr() { try { return typeof window.wa46IsHr === 'function' ? !!wa46IsHr() : false; } catch (e) { return false; } }
  function modalOpen() { var m = document.getElementById('modalBack'); return !!(m && getComputedStyle(m).display !== 'none'); }
  function setVal(id, v) { var x = document.getElementById(id); if (!x) return false; x.value = v; x.dispatchEvent(new Event('input', { bubbles: true })); x.dispatchEvent(new Event('change', { bubbles: true })); return true; }
  function iso(d) { var p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function local(d) { var p = function (n) { return (n < 10 ? '0' : '') + n; }; return iso(d) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function toastS(t) { try { toast(t); } catch (e) { /* fine */ } }
  function openMine() { var c = cand(); if (c && !sheetFor(c)) { try { w197.openSheet(c.id); } catch (e) { /* fine */ } } }
  async function clearPractice() {
    var r = await db.rpc('wa215_clear_practice', { p_all: false });
    if (r && r.error) throw new Error('Could not clear: ' + r.error.message);
    try { await w197.loadCands(true); w197.paintBoard(); } catch (e) { /* fine */ }
    try { if (window.w105TimeRender) w105TimeRender(); } catch (e) { /* fine */ }
    var d = (r && r.data) || {};
    toastS('Cleared ' + (d.applications || 0) + (d.applications === 1 ? ' practice application' : ' practice applications') + ' and ' + (d.timeoff || 0) + ' practice time off');
    W.state() && (W.state().ctx.cleared = true);
  }
  var CLEAR = function (what) {
    return { t: 'Clear your practice records', p: P('That is the whole flow. Your practice ' + what + ' is marked <b>Practice</b>: it never reached Slack, a text, an applicant or the calendar.',
      'Press <b>Clear my practice records</b> to remove it now. (If you stop part way, you can always clear it later with <b>Clear practice</b> on Applications.)'),
      act: clearPractice, actLabel: 'Clear my practice records', done: function (x) { return !!x.cleared; }, waitText: 'Press Clear my practice records' };
  };

  /* ================= 1. Getting around ================= */
  W.add('hrwalk-start', { title: 'HR centre: getting around', avail: hr, steps: [
    { t: 'Welcome to the HR centre', p: P('The HR centre is where Welfare Avenue looks after its people: who is on the team, the hours they give, time off, recognition, hiring, onboarding, training, policies and discipline.',
      'This walkthrough takes three minutes. A gold ring shows what to look at or click; the card moves on by itself when you have done it. Fold the card (▾) if it is in the way, and use <b>Skip this step</b> whenever you like.') },
    { hash: '#hrcentre/overview', s: '#w153rail .w153sec || #w153rail', t: 'The rail: every page of the HR centre', p: P('The pages are grouped the way the work flows:') + L(['<b>People</b>: Team, Hours, Time off, Recognition', '<b>Hiring</b>: Applications, Positions, Playbook', '<b>Growth</b>: Onboarding, Onboarding plan, Training', '<b>Records</b>: Policies, Discipline (the HR access list only)']) + P('Each page has its own walkthrough in the Avenue Academy, under the Learning Avenue <b>The HR centre</b>.') },
    { s: '#w197ov .w197tiles', t: 'Overview: the numbers that matter', p: P('Six tiles: people on the roster, people in The Loop this week, new applications, people onboarding now, people with a training overdue, and time off waiting for a decision.', 'A tile with something to act on is highlighted. <b>Click any tile</b> to go to its page.'),
      done: function (x) { return location.hash !== '#hrcentre/overview' && /^#hrcentre\//.test(location.hash); }, waitText: 'Click a tile' },
    { hash: '#hrcentre/overview', s: '#w197ov .w197todo', t: 'Needs HR', p: P('The list of what is waiting on HR right now, oldest first. Every line has <b>Open</b>, which takes you straight to it. When this list is empty, HR is up to date.') },
    { s: '#w212bell', t: 'The bell: what needs you', p: P('The bell counts what needs <b>you</b> since you last opened it: time off waiting, applicants you handle who need a call, interviews today and tomorrow, offer letters not sent yet, and new applications.', '<b>Click the bell.</b>'),
      done: function () { try { return !!w212.state().open; } catch (e) { return false; } }, waitText: 'Click the bell' },
    { s: '#w212box', t: 'Each line opens what it is about', p: P('Click a line to jump to the card or the page. Click anywhere else to close the list. The count resets when you open it.') },
    { s: '#hrcentre > .w118mast .w43help', t: 'How this page works', p: P('Every page of the HR centre has this button. It explains the page you are on in a few lines.') },
    { t: 'Where to go next', p: P('Carry on with the other walkthroughs in <b>The HR centre</b> Learning Avenue:') + L(['Recruitment, from posting to hired (you are the test applicant and get the offer letter)', 'Onboarding a new person (you are the test person)', 'Time off (you request it and approve it)', 'Team, hours and recognition', 'Training and the onboarding plan', 'Policies and discipline']) }
  ] });

  /* ================= 2. Recruitment ================= */
  W.add('hrwalk-recruit', { title: 'HR centre: recruitment, start to finish', avail: hr, practice: true, steps: [
    { t: 'You are the applicant', p: P('In this walkthrough you hire yourself. You add yourself as an applicant with <b>your own Welfare Avenue email</b>, then take your card through every stage: Reviewing, a call, an interview, an offer letter (which arrives in your inbox) and Hired.',
      'Everything you add is marked <b>Practice</b>: it never goes to Slack, is never texted, and is cleared at the end. About 12 minutes.') },
    { hash: '#hrcentre/positions', s: '#w199pos', t: 'Positions: where hiring starts', p: P('Every role at Welfare Avenue is a position, with its own folder in Google Drive: the job description, older versions and a <b>Resumes</b> folder.', 'A CV dropped into a position’s Resumes folder becomes a New application on its own within about ten minutes.') },
    { s: '.w199card', t: 'Open a position', p: P('<b>Click any position.</b>'), done: function () { try { return !!w199.state().open; } catch (e) { return false; } }, waitText: 'Click a position' },
    { s: '#w197sheet .pn', t: 'Inside a position', p: P('Here you see:') + L(['its stage (requested, defined, posted, interviewing, offer, filled)', 'the job description and older versions', 'the applications for it', 'the CVs in its Resumes folder, with <b>Add to Applications</b> for one that is not on the board yet', 'the people who hold the role']) + P('Close it when you are ready.'),
      done: function () { return !open(); }, waitText: 'Close the position (Close, or Esc)' },
    { hash: '#hrcentre/applications', s: '#w197board', t: 'Applications: the board', p: P('Every application is a card in its stage: <b>New, Reviewing, Interview, Offer, Hired</b>. Declined and withdrawn cards are kept below the board.', 'Drag a card to move it, or open it and use its stage buttons. Each stage asks for what it needs before the card can move, so nobody skips a step.') },
    { s: '[data-w209a="add"]', t: 'Add yourself as an applicant', p: P('Applications from job@, CABM and Je Bénévole arrive by themselves. Someone who applied another way (LinkedIn, a referral) is added by hand.', '<b>Click Add an applicant.</b>'),
      done: function () { var a = document.getElementById('w209add'); return !!(a && a.classList.contains('open')); }, waitText: 'Click Add an applicant' },
    { s: '#w209add .pn', t: 'Fill in the form, as you', p: P('Use <b>your own name and Welfare Avenue email</b>, so the offer letter comes to you.') + L(['<b>Position</b>: choose any real one (the interview step needs a position).', '<b>Their CV</b>: the link is required. Use the sample CV below (copy it), or one of your own in Google Drive (Share, then Copy link).', 'Then <b>Add the applicant</b>.']) + P('Normally the Hub copies the CV into the position’s Resumes folder; for practice it leaves the folders alone.'),
      copy: { label: 'Sample CV link', text: SAMPLE_CV },
      fill: function () { var m = W.me(); setVal('w209n', (m.name || 'Me') ); setVal('w209e', m.email); setVal('w209cv', SAMPLE_CV); setVal('w209m', 'Practice application from the HR centre walkthrough.'); toastS('Filled in. Choose a position, then Add the applicant.'); },
      fillLabel: 'Fill in my name, email and the sample CV',
      done: function () { return !!cand(); }, waitText: 'Choose a position, then Add the applicant' },
    { go: openMine, s: '#w197sheet .pn', t: 'Your card', p: P('A new card opens on its own. From top to bottom:') + L(['the <b>stage buttons</b> and what to do next', 'contact details, the CV and the original email', '<b>Handled by</b>: who looks after this applicant', 'calls, the grade, the interview time, the position', 'what the CV says (the Hub reads every CV, scanned ones too)', 'what they wrote, and your notes']) + P('Your card says <b>Practice</b> on the board.') },
    { go: openMine, s: '#w197own1', t: 'Choose who handles it', p: P('Every applicant needs someone handling them before they move to Reviewing. That person gets a Slack message when the card moves on (practice cards never do).', '<b>Choose yourself.</b>'),
      done: function () { var c = cand(); return !!(c && c.owner); }, waitText: 'Choose yourself in Handled by' },
    { go: openMine, s: '#w197sheet .stg button[data-w197st="reviewing"]', t: 'Move to Reviewing', p: P('Reviewing means: read the application and the CV, and call them.', '<b>Click Reviewing.</b> It moves straight away because Handled by is filled. Had it been empty, a form would have asked for it.'),
      done: function () { var c = cand(); return !!(c && c.status === 'reviewing'); }, waitText: 'Click Reviewing' },
    { go: openMine, s: '[data-w211int] || #w197sheet .w211box', t: 'Still interested? (a text)', p: P('For applicants who applied a while ago, <b>Text: still interested?</b> sends one text from the ops line with their own link. Yes moves the card to Reviewing, No to Withdrawn. You see the exact text before anything is sent.', 'Practice cards are never texted, so just read this and press <b>Next</b>.') },
    { go: openMine, s: '.w199calls', t: 'Log the call', p: P('After you call them, log it. With a real applicant you can also pick the call from Quo when you move them to Interview: its summary and transcript are saved on the card.', 'Pretend you just reached yourself: <b>click Reached</b>. (The note box above saves what was said.)'),
      done: function () { var c = cand(); try { return !!c && (w199.state().calls || []).some(function (k) { return String(k.candidate_id) === String(c.id); }); } catch (e) { return false; } }, waitText: 'Click Reached' },
    { go: openMine, s: '#w199iv', t: 'Book the interview', p: P('Set the day and time of the interview here (or in the form when you move the card).', 'For practice, <b>set it to earlier today</b>, as if the interview already happened: the Offer stage needs a past interview.'),
      fill: function () { var d = new Date(Date.now() - 2 * 3600000); setVal('w199iv', local(d)); toastS('Set to two hours ago'); }, fillLabel: 'Set it to two hours ago',
      done: function () { var c = cand(); return !!(c && c.interview_at); }, waitText: 'Set the interview day and time' },
    { go: openMine, s: '#w197sheet .stg button[data-w197st="interview"]', t: 'Move to Interview', p: P('<b>Click Interview.</b> Interview needs: who handles it, the position, a call logged and the interview time. If anything is missing, a form opens and asks for exactly that.'),
      done: function () { var c = cand(); return !!(c && c.status === 'interview'); }, waitText: 'Click Interview (and fill the form if one opens)' },
    { go: openMine, s: '.w199star || #w197sheet .w199grade', t: 'Grade the interview (optional)', p: P('After an interview, give your grade (one to five stars) with a note. Each interviewer grades on their own, and the board can sort by the best grade.', 'If the interview was recorded, its transcript links to the card from the Transcript archive and is reviewed against the job description and the MCC framework.') },
    { go: openMine, s: '#w197sheet .stg button[data-w197st="offer"]', t: 'Move to Offer', p: P('<b>Click Offer.</b> A form asks for what an offer needs:') + L(['their email (yours is already there)', 'that the interview happened', '<b>Interview impressions</b>: a few lines on how it went and why an offer']) + P('Then <b>Move to Offer</b>.'),
      done: function () { var c = cand(); return !!(c && c.status === 'offer'); }, waitText: 'Click Offer, fill the impressions, then Move to Offer' },
    { s: '#w211m .pn', go: function () { var c = cand(), m = document.getElementById('w211m'); if (c && !c.offer_sent_at && !(m && m.classList.contains('open'))) { try { w211.askOffer(c.id); } catch (e) { /* fine */ } } },
      t: 'Send the offer letter (to yourself)', p: P('The offer letter opens on its own at Offer. Fill it in:') + L(['who they report to, the hours a week, the start date', 'the <b>reply-by</b> date (required)', 'who signs it, and a personal note']) + P('Press <b>Preview the letter</b> to read it, then <b>Create the letter and email it</b>. It is saved as a Google Doc in Recruitment > Offer Letters (as PRACTICE) and emailed as a PDF to <b>' + E(W.me().email) + '</b>.'),
      done: function () { var c = cand(); return !!(c && c.offer_sent_at); }, waitText: 'Create the letter and email it' },
    { t: 'Check your inbox', p: P('Open your Welfare Avenue email: <b>[PRACTICE] Your offer from Welfare Avenue</b>, with the letter attached as a PDF. A real applicant gets the same email without the PRACTICE mark, and replies to you.', 'The card now says <b>Offer sent</b>, and its notes record when and to whom.') },
    { go: openMine, s: '#w197sheet .stg button[data-w197st="hired"]', t: 'They said yes: move to Hired', p: P('<b>Click Hired.</b> The form asks for the day they accepted and their start date (the offer letter is already there). Then <b>Move to Hired</b>.'),
      done: function () { var c = cand(); return !!(c && c.status === 'hired'); }, waitText: 'Click Hired and fill the two dates' },
    { go: openMine, s: '#w197sheet .next', t: 'Next: onboarding', p: P('At Hired, the card points to <b>Go to Onboarding</b>: the next walkthrough. HR assigns their onboarding plan and sends the Welcome kit there.') },
    { go: openMine, s: '#w197sheet .stg button.cl', t: 'When it is a no', p: P('<b>Declined</b> (we said no) and <b>Withdrawn</b> (they said no) close an application. Both ask for a reason, which stays on the card. A closed card can be moved back to a stage if things change.', 'Nothing to click here.') },
    CLEAR('application')
  ] });

  /* ================= 3. Onboarding ================= */
  function onbs() { try { return (window.WA37 && WA37.onbs) || []; } catch (e) { return []; } }
  function myOnb(x) { return onbs().filter(function (o) { return x.base && x.base.indexOf(o.id) < 0 && lower(o.person_name) === lower(W.me().name); })[0] || null; }
  W.add('hrwalk-onboard', { title: 'HR centre: onboarding a new person', avail: hr,
    init: function (x) { x.base = onbs().map(function (o) { return o.id; }); },
    steps: [
      { t: 'You are the new person', p: P('When someone is hired, HR gives them an onboarding plan: the master onboarding, week by week, with due dates. In this walkthrough you give <b>yourself</b> a practice plan, look around it as HR and as the new person, then remove it.', 'About 8 minutes.') },
      { hash: '#hrcentre/onboarding', s: '#hrcentre .w46sec[data-w197s~="onboarding"] || #hrcentre [data-w197s~="onboarding"]', t: 'Who is onboarding', p: P('Everyone in their onboarding, with a progress bar, how many steps are done and what is overdue. Leaders see the same on their Home page for their own people.') },
      { s: 'select[data-w46assign]', t: 'Assign an onboarding (to yourself)', p: P('<b>Open this list and choose yourself.</b> The plan starts today: every step of the master onboarding is copied in, with its due date, and what you already did in the Avenue Academy is ticked for you.', 'If your name is not in the list, you are already onboarding: press <b>Skip this step</b> and the rest is look-only.'),
        done: function (x) { return !!myOnb(x); }, waitText: 'Choose yourself in Assign an onboarding' },
      { s: '#modalBox', t: 'The Welcome kit', p: P('Assigning opens the Welcome kit: the welcome email (with the Hub’s address and their first steps) and the Slack message, ready to copy. Read it, then press <b>Done</b>.'),
        skipIf: function () { return !(document.getElementById('modalBack') && getComputedStyle(document.getElementById('modalBack')).display !== 'none'); },
        done: function () { return !modalOpen(); }, waitText: 'Press Done' },
      { s: function (x) { var o = myOnb(x); return o ? document.querySelector('[data-w37open="' + o.id + '"]') : null; }, t: 'Open the checklist', p: P('<b>Click checklist</b> on your row. This is the plan as HR sees it: every step, its week and its due date.'),
        skipIf: function (x) { return !myOnb(x); }, done: function () { return !!document.getElementById('w37modal'); }, waitText: 'Click checklist on your row' },
      { s: '#w37modal', t: 'Tick a step', p: P('HR (or the person) ticks steps here. Steps learned in the Avenue Academy tick themselves when the person finishes them there.', '<b>Tick any step</b>, then close the checklist.'),
        skipIf: function (x) { return !myOnb(x); }, done: function (x) { if (document.getElementById('w37modal')) { x.chk = 1; return false; } return !!x.chk; }, waitText: 'Tick a step, then close the checklist' },
      { s: function (x) { var o = myOnb(x); return o ? document.querySelector('[data-w39hr="' + o.id + '"]') : null; }, t: 'HR setup', p: P('Next to the checklist, <b>HR setup</b> is HR’s own list for this person: the Google account (first.last@welfareavenue.com), Slack, the Hub, the policies to sign. Open it to look, then close it.'),
        skipIf: function (x) { return !myOnb(x); } },
      { s: function (x) { var o = myOnb(x); return o ? document.querySelector('[data-w169preview="' + o.id + '"]') : null; }, t: 'See it as they do', p: P('<b>Journey</b> shows the onboarding exactly as the new person sees it in the Avenue Academy: each week’s photo, goals, why it matters and the lesson that opens it.', 'Click it, look around, then press <b>Back to the master onboarding</b> (or come back to the HR centre) and press Next.'),
        skipIf: function (x) { return !myOnb(x); } },
      { hash: '#hrcentre/onboarding', s: function (x) { var o = myOnb(x); return o ? document.querySelector('[data-w39del="' + o.id + '"]') : null; }, t: 'Remove your practice plan', p: P('<b>Click remove</b> on <b>your practice row</b> (the one you just made), then confirm. This removes the plan and its progress; use it only for a plan given by mistake.'),
        skipIf: function (x) { return !myOnb(x); }, done: function (x) { return !myOnb(x); }, waitText: 'Click remove on your practice row, then confirm' },
      { t: 'Onboarding, in short', p: L(['<b>Hired</b> on Applications, then <b>Assign an onboarding</b> here.', 'Send the <b>Welcome kit</b>.', 'Watch the progress bar; leaders see their people on Home.', 'The plan completes itself when the last step is ticked.', 'The <b>Onboarding plan</b> page (the next walkthrough, Training) is where the master onboarding is edited.']) }
    ] });

  /* ================= 4. Time off ================= */
  function rows() { return window.__w105rows || []; }
  function myReq() { var em = W.me().email; return rows().filter(function (t) { return t.practice && lower(t.email) === em; }).sort(function (a, b) { return b.id - a.id; })[0] || null; }
  W.add('hrwalk-timeoff', { title: 'HR centre: time off', avail: hr, practice: true, steps: [
    { t: 'Time off, both sides', p: P('You will ask for time off as a team member, then decide it as HR. Your request is marked <b>Practice</b>: Valex and Samson are not messaged, it never goes on the calendar, and it is cleared at the end. About 5 minutes.') },
    { hash: '#hrcentre/timeoff', s: '#w105to', t: 'The Time off page', p: P('From the top:') + L(['<b>Waiting on a decision</b>: requests with Approve and Decline', '<b>Log time off</b> and <b>Request time off for myself</b>', '<b>Days taken this fiscal year</b> (October to September): each type, a total, and the sick days left of 7', '<b>Recent decisions</b>, folded']) },
    { s: '#w212mine', t: 'Ask for time off', p: P('Team members ask from their My page (or the Requests page); you can ask from here too. <b>Click Request time off for myself.</b>'),
      done: function () { return !!document.getElementById('w105rc'); }, waitText: 'Click Request time off for myself' },
    { s: '#modalBox', t: 'Fill in the request', p: P('Choose the type (its policy shows under it), the dates and a note. Use dates in the future. Then <b>Send the request</b>.'),
      fill: function () { var d = new Date(Date.now() + 60 * 86400000); setVal('w105rs', iso(d)); var e = new Date(d.getTime() + 2 * 86400000); setVal('w105re', iso(e)); setVal('w105rn', 'Practice request from the HR walkthrough'); toastS('Dates filled. Press Send the request.'); }, fillLabel: 'Fill in practice dates',
      done: function () { return !!myReq(); }, waitText: 'Send the request' },
    { s: function () { var r = myReq(); return r ? document.querySelector('[data-w105ap="' + r.id + '"]') : null; }, t: 'Now decide it, as HR', p: P('Your request is waiting. In real life Valex and Samson get a Slack message the moment it arrives.', '<b>Click Approve</b> on your request. (Decline asks for a reason, which the person sees.)'),
      done: function () { var r = myReq(); return !!(r && r.status === 'approved'); }, waitText: 'Click Approve on your request' },
    { s: '#w105to .w212past || #w105to', t: 'What approving does', p: P('An approved request:') + L(['counts in the person’s days taken this year (practice ones do not)', 'goes on the <b>hub@welfareavenue.com calendar</b> as an all-day event, with the person as a guest so it shows on their calendar too', 'shows as approved on their My page']) + P('Declining or reopening it takes it off the calendar.') },
    { s: '#w212log', t: 'Log time off for someone', p: P('For time off agreed in a conversation or an email: <b>Log time off</b> opens a form with the person, the type, the dates and whether it is already approved or still to decide.', 'Open it to look, then press <b>Cancel</b>.') },
    CLEAR('time off')
  ] });

  /* ================= 5. Team, hours, recognition ================= */
  W.add('hrwalk-people', { title: 'HR centre: team, hours and recognition', avail: hr, steps: [
    { t: 'The people pages', p: P('Team, Hours and Recognition: who is on the team, the time they give, and saying thank you. About 4 minutes, nothing is changed.') },
    { hash: '#hrcentre/team', s: '#w116ppeople', t: 'Team', p: P('Everyone on the roster, by team. Search by name, filter by team, and <b>Open profile</b> for a person’s page (their role, their work, their hours).', 'HR can set a start date by hand here. <b>Add someone</b> (top right) goes to the Admin panel, where accounts are made.') },
    { s: '#w116pq', t: 'Find someone', p: P('<b>Type a name</b> to filter the roster.'), done: function () { var x = document.getElementById('w116pq'); return !!(x && x.value.trim().length >= 2); }, waitText: 'Type a name' },
    { hash: '#hrcentre/hours', s: '#w197hours .w197tiles || #w197hours', t: 'Hours', p: P('Hours come from two places:') + L(['<b>The Loop</b>: from I’m in to Close the loop (a session left open counts at most eight hours)', '<b>Slack</b>: the hours people log with their own “in” and “out” messages in the Slack check-in channels, read every morning']) + P('The tiles show this week at a glance.') },
    { s: '#w197hours .w197tbl', t: 'Hours by person', p: P('This week, last week and the average a week against each person’s minimum; people below their minimum come first. Hours from Slack say so under the number.') },
    { s: '#w197mmgr', t: 'The weekly minimums', p: P('Managers and up, and everyone else. The board is exempt; the operational executives give 8 hours. Only HR and admins can change them.') },
    { s: '#w197hours .w197feed || #w197hours .w197card + .w197card || #w197hours', t: 'What people shared in The Loop', p: P('When people close the loop they can share what moved. It lands in #check-in-out-wa and here. Never times or hours.') },
    { s: '#w144hr', t: 'Meeting attendance', p: P('Who came to which team meeting, from Google Meet. Refresh it with the button.') },
    { hash: '#hrcentre/recognition', s: '#w116psf', t: 'Recognition', p: P('Shout-outs for someone who did something worth noticing. They show here and on the Hub’s loading screen for everyone.', 'Post one now for someone who earned it, or press <b>Next</b>. Your own shout-outs can be taken down.') },
    { s: '#w116pshouts .ls || #w116pshouts', t: 'Recent shout-outs', p: P('Newest first. Admins can take any down, and authors their own.') }
  ] });

  /* ================= 6. Training and the onboarding plan ================= */
  function assignList() { try { return (w169.state().list || []); } catch (e) { return []; } }
  function myAssign(x) { return assignList().filter(function (a) { return x.abase && x.abase.indexOf(a.id) < 0; })[0] || null; }
  W.add('hrwalk-training', { title: 'HR centre: training and the onboarding plan', avail: hr,
    init: function (x) { x.abase = assignList().map(function (a) { return a.id; }); },
    steps: [
      { t: 'Training and the master onboarding', p: P('How HR assigns trainings from the Avenue Academy, follows who did them, and edits the onboarding every new person gets. You will assign a short training to yourself, then stop it. About 6 minutes.') },
      { hash: '#hrcentre/training', s: '#w169cardT', t: 'Trainings assigned to the organization', p: P('Each assignment: what, to whom (everyone, teams or people), the due date, and a bar of who finished. <b>See who</b> lists them by name.') },
      { s: '[data-w169assign]', t: 'Assign a training', p: P('<b>Click Assign a training.</b>'), done: function () { return !!document.getElementById('w169aq'); }, waitText: 'Click Assign a training' },
      { s: '#modalBox', t: 'Choose what and who', p: L(['Search and pick a short module (or a whole Learning Avenue).', 'Who: choose <b>People</b> and tick <b>yourself</b>.', 'A due date (one of the quick buttons) and a note if you like.', 'Then <b>Assign</b>.']) + P('People who join later can get it too, when it is for everyone or a team.'),
        done: function (x) { return !!myAssign(x); }, waitText: 'Assign it to yourself' },
      { s: function (x) { var a = myAssign(x); return a ? document.querySelector('[data-w169stopask="' + a.id + '"]') : null; }, t: 'Stop it', p: P('It now shows in your Avenue Academy under <b>Assigned to you</b>. To take it back, <b>click Stop</b>, then <b>Yes, stop it</b>. Rows nobody started go; progress already made stays with the person.'),
        skipIf: function (x) { return !myAssign(x); }, done: function (x) { var a = myAssign(x); return !!a && a.active === false; }, waitText: 'Click Stop, then Yes, stop it' },
      { s: '#hrcentre .w44tbl', t: 'Trainings across the team', p: P('Everyone’s training, person by person: done, in progress, assigned and overdue. <b>Assign</b> on a row picks trainings for that one person.') },
      { hash: '#hrcentre/plan', s: '#w46master', t: 'The onboarding plan', p: P('The <b>master onboarding</b>: every week and step a new person gets. What you change here reaches everyone still onboarding: a step moved to another week takes that week’s due date in every plan in progress.') },
      { s: '.w169see [data-w169week] || #w46master details.w46wk', t: 'Each week, as people see it', p: P('<b>Edit what people see</b> sets a week’s title, photo, goals, why it matters and the lesson that opens it, with a live preview. Each step can be edited, retired or linked to the Avenue Academy, so it ticks itself when done there.') },
      { s: '[data-w169preview="w169sample"]', t: 'Preview what a new person sees', p: P('The journey on day one, read only. Try it whenever you change the plan.') }
    ] });

  /* ================= 7. Policies and discipline ================= */
  W.add('hrwalk-policies', { title: 'HR centre: policies and discipline', avail: hr, steps: [
    { t: 'The records pages', p: P('Policies and the discipline tracker are for the HR access list only. You will look, not change: nothing is saved in this walkthrough. About 3 minutes.') },
    { hash: '#hrcentre/policies', s: '#w105pol', t: 'Policies and sign-offs', p: P('Each policy links to its document in Google Drive, with how many people signed it and who has not yet.') },
    { s: '#w105pt', t: 'Add a policy', p: P('A title and the Drive link, then <b>Add</b>. Required policies go to everyone to sign: on their My page and at the top of their Avenue Academy.') },
    { s: '.w104edit[data-w105pe] || #w105pol .w104edit', t: 'Edit or retire', p: P('Change a policy’s title or link, or retire it when it no longer applies. A retired policy stays in the record.') },
    { t: 'How people sign', p: P('On their My page (and in the Avenue Academy), each policy to sign has its document and <b>I have read and reviewed this</b>. The table here updates when they sign.') },
    { hash: '#hrcentre/discipline', s: '#w105disc', t: 'The discipline tracker', p: P('Each person’s record, step by step, with <b>clean slate</b> when nothing is open. It follows the handbook’s steps for each kind of issue.') },
    { s: '#w105dp', t: 'Recording an entry', p: L(['<b>Person</b>, <b>category</b> (acknowledging messages, time commitment, missed meetings, conduct, other)', 'the <b>step</b>, which depends on the category', 'the <b>date</b> and a note', '<b>Record</b>, or <b>Clean slate</b> to close it']) + P('Do not record anything now. Entries are permanent, and only HR sees them.') }
  ] });

  /* ---------- the Academy lists and opens them (wave122's TOURS) ---------- */
  function register() {
    if (!window.w122 || !w122.tours) return false;
    Object.keys(W.defs).forEach(function (k) {
      var d = W.defs[k];
      w122.tours[k] = { tab: 'hrcentre', icon: 'people', hash: '#hrcentre/overview', avail: d.avail, w215: true,
        steps: d.steps.map(function (s) { return { c: 1, t: s.t, p: String(s.p || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) }; }) };
    });
    return true;
  }
  if (!register()) { var n = 0, t = setInterval(function () { if (register() || ++n > 40) clearInterval(t); }, 500); }
})();
