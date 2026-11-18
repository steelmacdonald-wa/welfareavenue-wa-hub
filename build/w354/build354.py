import hashlib, sys
src = open('/home/claude/live/index.html', encoding='utf-8').read()
assert hashlib.md5(src.encode()).hexdigest() == '6413f287ae714cce37ece84115a93820'
s = src
PAIRS=[]
def rep(a, b, n=1):
    global s
    PAIRS.append([a,b])
    c = s.count(a)
    assert c == n, (a[:90], c)
    s = s.replace(a, b)
# ---- wave275 card ----
rep("""    var ask = x.ask_availability !== false, lines = [];
""", """    var ask = x.ask_availability !== false, lines = [];
    if (x.simple && !x.call_at && window.w354) return window.w354.lines(x);   /* wave354: simple onboarding */
""")
rep("""    if (x.manager_hours === false) {   /* wave275b""", """    if (x.simple) return 'Manager: ' + E(name);   /* wave354: no times, so no week */
    if (x.manager_hours === false) {   /* wave275b""")
rep("""    var hr = R.hrTools(), booked = !!x.call_at, live = !!(x.proposed_at && !x.hire_answer), mfirst = firstOf(x.manager_name || O.nameOf(x.manager_member_id)), b = [];
""", """    var hr = R.hrTools(), booked = !!x.call_at, live = !!(x.proposed_at && !x.hire_answer), mfirst = firstOf(x.manager_name || O.nameOf(x.manager_member_id)), b = [];
    if (x.simple && !booked && window.w354) return window.w354.buttons(x, hr, S);   /* wave354: Send their onboarding */
""")
rep("""tag = booked ? ['Booked', 'ok'] : x.accepted_on ? ['Accepted', ''] : ['Offer sent', ''];""",
    """tag = booked ? ['Booked', 'ok'] : x.accepted_on ? (x.simple ? ['Ready to send', 'ok'] : ['Accepted', '']) : ['Offer sent', ''];""")
rep("""      + (x.accepted_on && !booked ? '<div class="o271ln" data-o275hire>New hire""", """      + (x.accepted_on && !booked && !x.simple ? '<div class="o271ln" data-o275hire>New hire""")
rep("""      + (booked ? '' : switchHtml(x))""", """      + (booked || x.simple ? '' : switchHtml(x))""")
rep("""      + (booked ? '' : canvaHtml(x))""", """      + (booked || x.simple ? '' : canvaHtml(x))""")
rep("""      + '<div class="o271ln">The other steps run when the times are booked.</div>';""",
    """      + '<div class="o271ln">The other steps run when ' + (x.simple ? 'the onboarding is sent' : 'the times are booked') + '.</div>';""")
rep("""        note = { ok: w.edited === false ? 'The welcome email is the Hub\\'s own again.' : 'The welcome email is saved. The Hub sends it when the times are booked.' };""",
    """        note = { ok: w.edited === false ? 'The welcome email is the Hub\\'s own again.' : 'The welcome email is saved. The Hub sends it when ' + ((rowOf(id) || {}).simple ? 'you send their onboarding.' : 'the times are booked.') };""")
rep("""        try { var a = await run('ask_manager', { flow_id: Number(id) }); if (a.sent) note.ok += ' They were asked for times.'; (a.warnings""",
    """        try { var a = await run('ask_manager', { flow_id: Number(id) }); if (a.sent) note.ok += ' They were asked for times.'; else if (a.told) note.ok += ' They were told on Slack, with the link to send the onboarding.'; (a.warnings""")
# ---- wave285: whose turn ----
rep("""      else if (!f.proposed_at) { txt = (mine ? 'You' : mgrF) + ' to propose times'; who = 'mgr'; }""",
    """      else if (f.simple) { txt = 'Waiting on ' + hireF + ' to accept'; who = 'hire'; }   /* wave354 */
      else if (!f.proposed_at) { txt = (mine ? 'You' : mgrF) + ' to propose times'; who = 'mgr'; }""")
rep("""      var M = mine ? 'You' : mgrF;
      if (!P.mgr) { txt = 'HR to choose a manager'; who = 'hr'; }""",
    """      var M = mine ? 'You' : mgrF;
      if (f.simple && !f.call_at) {   /* wave354: simple onboarding, the manager or HR sends it */
        if (f.ready_told_at || f.accounts_at) { txt = (mine ? 'You' : !P.mgr ? 'HR' : hr ? 'You or ' + mgrF : mgrF + ' or HR') + ' to send their onboarding'; who = 'send'; }
        else { txt = 'The Hub is setting up their accounts'; who = 'hub'; }
      }
      else if (!P.mgr) { txt = 'HR to choose a manager'; who = 'hr'; }""")
rep("""((who === 'hr' && hr) || (who === 'mgr' && (mine || (hr && !P.mgr)))) ? 'your' : ''""",
    """((who === 'hr' && hr) || (who === 'mgr' && (mine || (hr && !P.mgr))) || (who === 'send' && (mine || hr))) ? 'your' : ''""")
rep("""      J.push({ t: f && f.call_at ? 'Times booked' : (f && f.proposed_at ? 'Times proposed' : 'Times booked'), d: f && f.call_at ? 'call ' + fmtDay(f.call_at) : (f && f.proposed_at ? fmtDay(f.proposed_at) : ''), on: !!(f && f.call_at) });""",
    """      if (f && !f.call_at && !f.proposed_at && (f.simple || f.status === 'running' || f.status === 'started')) J.push({ t: 'Onboarding sent', d: f.welcome_sent_at ? fmtDay(f.welcome_sent_at) : (f.started_at ? fmtDay(f.started_at) : ''), on: !!(f.welcome_sent_at || f.status === 'running' || f.status === 'started') });   /* wave354 */
      else J.push({ t: f && f.call_at ? 'Times booked' : (f && f.proposed_at ? 'Times proposed' : 'Times booked'), d: f && f.call_at ? 'call ' + fmtDay(f.call_at) : (f && f.proposed_at ? fmtDay(f.proposed_at) : ''), on: !!(f && f.call_at) });""")
# Needs you
rep("""      if (P.turn && P.turn.who === 'hr' && P.stage !== 'weeks' && P.stage !== 'later' && P.stage !== 'starting') {""",
    """      if (P.turn && P.turn.who === 'send' && hrTools && f) {   /* wave354 */
        out.push({ red: false, html: '<p>' + nm + ': ready for their onboarding email.<span class="w285sub">Accepted ' + E(fmtDay(f.accepted_on)) + (P.mgr ? ', manager ' + E(first(P.mgr.name)) : '') + '</span></p>',
          acts: '<button type="button" class="w285b pri" data-w354pre="' + E(P.fid) + '" data-w285open="' + E(P.key) + '" data-tab="ov" data-ctx="hr">Send their onboarding</button>' });
      } else if (P.turn && P.turn.who === 'hr' && P.stage !== 'weeks' && P.stage !== 'later' && P.stage !== 'starting') {""")
# Home card
rep("""    if (P.turn.who === 'mgr' && (mine || h.isHr()) && P.flow) act = '<button type="button" class="w285b pri" data-w285open="' + E(P.key) + '" data-ctx="home" data-tab="ov">' + (/book/i.test(P.turn.t) ? 'Book the times' : 'Propose times') + '</button>';""",
    """    if (P.turn.who === 'send' && (mine || h.isHr()) && P.flow) act = '<button type="button" class="w285b pri" data-w354pre="' + E(P.fid) + '" data-w285open="' + E(P.key) + '" data-ctx="home" data-tab="ov">Send their onboarding</button>';   /* wave354 */
    else if (P.turn.who === 'mgr' && (mine || h.isHr()) && P.flow) act = '<button type="button" class="w285b pri" data-w285open="' + E(P.key) + '" data-ctx="home" data-tab="ov">' + (/book/i.test(P.turn.t) ? 'Book the times' : 'Propose times') + '</button>';""")
# Applications page description
rep("""d: 'Every application from hub@ and the job boards, by stage. Drag a card to move it, or open it to read, decide and take notes.' },""",
    """d: 'Every application from hub@ and the job boards, one stage at a time. Open someone to read, decide and take notes.' },""")
# append the segment
seg = open('/home/claude/live/w354.js', encoding='utf-8').read()
i = s.rfind('</body>')
assert i > 0
s = s[:i] + '<script>\n' + seg + '</script>\n' + s[i:]
import json; json.dump({'pairs': PAIRS, 'seg': '<script>\n' + seg + '</script>\n'}, open('/home/claude/live/patch354.json','w')); open('/home/claude/live/candidate.html', 'w', encoding='utf-8', newline='').write(s)
print(hashlib.md5(s.encode()).hexdigest(), len(s.encode()))
