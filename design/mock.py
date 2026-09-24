#!/usr/bin/env python3
"""Three brand directions for the WA Hub, mocked with real Home page content.
Writes design/dirA.html, dirB.html, dirC.html (desktop) and dirA_phone.html, dirB_phone.html."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
LOGO_CREAM = "https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/rally-2026/logo_header_t.png"  # cream wordmark, transparent
LOGO_GREEN = "https://zwnmulmnvopclzcvytce.supabase.co/storage/v1/object/public/content-images/rally-2026/email_logo_cream.png"  # green wordmark on cream

FONTS = '<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">'

BASE = """
:root{--cream:#FFFAF2;--green:#103F39;--ground:#1F201E;--purple:#6F64AB;--gold:#DCA527;
--canvas:#F4F2EA;--line:rgba(16,63,57,.14);--line2:rgba(16,63,57,.08);--muted:rgba(31,32,30,.62);--tint:rgba(16,63,57,.08);}
*{box-sizing:border-box}
body{margin:0;background:var(--canvas);color:var(--ground);font-family:'Space Grotesk','Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased}
h1,h2,.display{font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:.2px;margin:0;color:var(--green)}
.ov{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:11px;letter-spacing:2px;text-transform:uppercase}
.card{background:var(--cream);border:1px solid var(--line2);border-radius:16px;box-shadow:0 1px 2px rgba(16,63,57,.04),0 8px 24px rgba(16,63,57,.05);padding:18px 20px}
.card h3{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:13px;letter-spacing:1.2px;text-transform:uppercase;color:var(--green);margin:0 0 12px}
.card h3 .rule{display:block;width:32px;height:3px;background:var(--gold);border-radius:2px;margin-top:6px}
.btn{display:inline-flex;align-items:center;gap:8px;background:var(--gold);color:var(--green);border:none;border-radius:10px;padding:10px 18px;font-family:'Barlow Condensed',sans-serif;font-weight:600;font-size:16px;letter-spacing:1px;text-transform:uppercase;cursor:pointer}
.btn.ghost{background:var(--tint);color:var(--green)}
.btn.sm{padding:6px 12px;font-size:14px;border-radius:8px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}
.stat{background:var(--cream);border:1px solid var(--line2);border-radius:16px;padding:16px 18px;box-shadow:0 1px 2px rgba(16,63,57,.04)}
.stat b{display:block;font-family:'Barlow Condensed',sans-serif;font-weight:600;font-size:34px;line-height:1;color:var(--green)}
.stat span{font-size:13px;color:var(--muted)}
.stat.warn b{color:#B3402F}
.grid{display:grid;grid-template-columns:1.4fr 1fr;gap:16px}
.list{margin:0;padding:0;list-style:none}
.list li{display:flex;align-items:center;gap:12px;padding:12px 4px;border-top:1px solid var(--line2);min-height:46px}
.list li:first-child{border-top:none}
.list .cb{width:20px;height:20px;border:2px solid rgba(16,63,57,.35);border-radius:6px;flex:0 0 auto}
.list .cb.on{background:var(--green);border-color:var(--green)}
.list .t{flex:1}
.list .t small{display:block;color:var(--muted);font-size:12.5px}
.list .chev{color:rgba(16,63,57,.35);font-size:18px}
.pill{display:inline-block;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;background:rgba(111,100,171,.14);color:var(--purple)}
.pill.gold{background:rgba(220,165,39,.22);color:#7a5a10}
.pill.green{background:var(--tint);color:var(--green)}
.progress{height:6px;border-radius:999px;background:var(--tint);overflow:hidden;margin:10px 0 12px}
.progress i{display:block;width:60%;height:100%;background:var(--green);border-radius:999px}
.check{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--line2)}
.check:first-of-type{border-top:none}
.check .cb{width:20px;height:20px;border:2px solid rgba(16,63,57,.35);border-radius:6px;flex:0 0 auto;margin-top:2px}
.check .cb.on{background:var(--green);border-color:var(--green)}
.check .done{text-decoration:line-through;color:var(--muted)}
.check b{display:block;font-size:14px}
.check span{font-size:13px;color:var(--muted)}
.ask{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px}
.ask span{border:1px solid rgba(111,100,171,.35);color:var(--purple);border-radius:999px;padding:7px 14px;font-size:13px;font-weight:500}
.mention{padding:10px 0;border-top:1px solid var(--line2)}
.mention:first-child{border-top:none}
.mention b{font-size:14px}
.mention small{color:var(--muted);display:block;font-size:12.5px;margin-top:2px}
.fab{position:fixed;right:28px;bottom:28px;background:var(--gold);color:var(--green);border-radius:999px;padding:14px 22px;font-family:'Barlow Condensed',sans-serif;font-weight:600;font-size:17px;letter-spacing:1px;text-transform:uppercase;box-shadow:0 10px 30px rgba(16,63,57,.25)}
.search{display:flex;align-items:center;gap:10px;background:rgba(16,63,57,.06);border-radius:12px;padding:10px 14px;color:var(--muted);font-size:14px;width:100%;max-width:520px}
.avatar{width:34px;height:34px;border-radius:50%;background:var(--purple);color:var(--cream);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px}
.doodle{position:absolute;right:-6px;top:-10px;width:70px;height:70px;opacity:.9}
"""

CONTENT = """
<div class="pagehead">
  <div>
    <div class="ov" style="color:var(--purple)">Thursday, August 6</div>
    <h1 style="font-size:40px;line-height:1.05;margin-top:4px">Good afternoon, Steel</h1>
  </div>
  <div class="headtools"><div class="search">&#9906;&nbsp; Search tasks, people, goals, meetings</div><div class="avatar">SM</div></div>
</div>
<div class="stats">
  <div class="stat"><b>2</b><span>my open tasks</span></div>
  <div class="stat"><b>5</b><span>team tasks</span></div>
  <div class="stat"><b>5</b><span>open decisions</span></div>
  <div class="stat warn"><b>2</b><span>new mentions</span></div>
</div>
<div class="grid">
  <div>
    <div class="card" style="position:relative">
      <svg class="doodle" viewBox="0 0 70 70" fill="none" stroke="#DCA527" stroke-width="3" stroke-linecap="round"><path d="M35 10 l5 16 17 1 -13 10 5 17 -14 -10 -14 10 5 -17 -13 -10 17 -1z"/></svg>
      <h3>Get started with the Hub <span style="font-weight:400;letter-spacing:0;text-transform:none;color:var(--muted)">&nbsp;3 of 5 done</span><span class="rule"></span></h3>
      <div class="progress"><i></i></div>
      <div class="check"><div class="cb"></div><div><b>Check your profile</b><span>Open your page and make sure your name, role and team look right.</span></div><button class="btn ghost sm" style="margin-left:auto">Open</button></div>
      <div class="check"><div class="cb on"></div><div class="done"><b>Visit your department</b></div></div>
      <div class="check"><div class="cb"></div><div><b>Tick off a task</b><span>Finish something with your name on it and tick it.</span></div><button class="btn ghost sm" style="margin-left:auto">My tasks</button></div>
      <div class="check"><div class="cb on"></div><div class="done"><b>Ask the Hub a question</b></div></div>
      <div class="check"><div class="cb on"></div><div class="done"><b>Read Important info</b></div></div>
    </div>
    <div class="card" style="margin-top:16px">
      <h3>My tasks <span class="rule"></span></h3>
      <ul class="list">
        <li><div class="cb"></div><div class="t">Revisit organizational goals and meeting cadence with Suhaib<small>Board &middot; no date</small></div><span class="pill">Later</span><span class="chev">&#8250;</span></li>
        <li><div class="cb"></div><div class="t">Decide McGill tabling vs. $200 fee, reach out to James for McGill GSP<small>Fundraising and Grants &middot; with Amanda</small></div><span class="pill gold">Due this week</span><span class="chev">&#8250;</span></li>
        <li><div class="cb on"></div><div class="t" style="text-decoration:line-through;color:var(--muted)">Confirm additional detail needed beyond budget document<small>Fundraising and Grants</small></div><span class="pill green">Done</span><span class="chev">&#8250;</span></li>
      </ul>
    </div>
    <div class="card" style="margin-top:16px">
      <h3>Ask the Hub anything <span class="rule"></span></h3>
      <div style="font-size:14px;color:var(--muted)">The assistant answers from live Hub data and can file requests and tasks for you. Try one:</div>
      <div class="ask"><span>What is happening across Welfare Avenue this week?</span><span>What is blocking my department right now?</span><span>Put in a request to marketing</span></div>
    </div>
  </div>
  <div>
    <div class="card" style="border-left:4px solid #B3402F">
      <h3 style="color:#B3402F">Needs your attention <span class="rule" style="background:#B3402F"></span></h3>
      <div style="font-size:14px">You were mentioned in <b>2 meetings</b> you were not in.</div>
      <button class="btn sm" style="margin-top:10px">Read them</button>
    </div>
    <div class="card" style="margin-top:16px">
      <h3>Mentions <span class="pill" style="margin-left:6px">2 new</span><span class="rule"></span></h3>
      <div class="mention"><b>Leadership Strategy and Discussion</b><small>Aug 3 &middot; the Hub dashboard was introduced to the leadership team</small></div>
      <div class="mention"><b>Weekly Fundraising Meeting</b><small>Aug 4 &middot; Rally Paper flyers for the Flag Football event</small></div>
    </div>
    <div class="card" style="margin-top:16px">
      <h3>My team <span class="rule"></span></h3>
      <ul class="list">
        <li><div class="avatar" style="background:var(--green);width:30px;height:30px;font-size:12px">SA</div><div class="t">Suhaib<small>3 open &middot; 1 overdue</small></div><span class="chev">&#8250;</span></li>
        <li><div class="avatar" style="width:30px;height:30px;font-size:12px">AZ</div><div class="t">Amanda<small>2 open</small></div><span class="chev">&#8250;</span></li>
        <li><div class="avatar" style="background:var(--gold);color:var(--green);width:30px;height:30px;font-size:12px">RA</div><div class="t">Rami<small>1 open</small></div><span class="chev">&#8250;</span></li>
      </ul>
    </div>
  </div>
</div>
<div class="fab">&#10024;&nbsp; Ask the Hub</div>
"""

NAV = [("Home", True), ("Dashboard", False), ("Departments", False), ("Meetings", False), ("Strategy", False), ("Requests", False), ("People", False), ("Important info", False), ("Admin", False)]

# ---------- Direction A: cream sidebar, Apple-style ----------
A_CSS = BASE + """
.shell{display:grid;grid-template-columns:236px 1fr;min-height:100vh}
.side{background:var(--cream);border-right:1px solid var(--line2);padding:22px 14px;position:sticky;top:0;height:100vh}
.side img{width:132px;display:block;margin:4px 8px 26px}
.side .ov{color:var(--muted);margin:14px 12px 6px}
.nav a{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;color:var(--ground);text-decoration:none;font-weight:500;font-size:14.5px}
.nav a.on{background:var(--tint);color:var(--green);font-weight:700}
.nav a i{width:18px;height:18px;border-radius:5px;background:rgba(16,63,57,.18);display:inline-block}
.nav a.on i{background:var(--green)}
.main{padding:28px 36px 90px;max-width:1180px}
.pagehead{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap}
.headtools{display:flex;align-items:center;gap:12px;flex:1;justify-content:flex-end;min-width:320px}
"""
def sidebar(dark=False):
    items = "".join(f'<a class="{"on" if on else ""}"><i></i>{n}</a>' for n, on in NAV)
    return f'<aside class="side"><img src="{LOGO_CREAM if dark else LOGO_GREEN}" alt="Welfare Avenue"><div class="ov">Workspace</div><nav class="nav">{items}</nav><div class="ov" style="margin-top:22px">You</div><nav class="nav"><a><i></i>My page</a><a><i></i>Sign out</a></nav></aside>'

A_HTML = f"""<!doctype html><html><head><meta charset="utf-8">{FONTS}<style>{A_CSS}</style></head><body>
<div class="shell">{sidebar(False)}<main class="main">{CONTENT}</main></div></body></html>"""

# ---------- Direction B: green header band + pill tabs ----------
B_CSS = BASE + """
.top{background:var(--green);padding:18px 36px 0}
.top .row{display:flex;align-items:center;justify-content:space-between;max-width:1180px;margin:0 auto}
.top img{width:130px;display:block}
.top .search{background:rgba(255,250,242,.12);color:rgba(255,250,242,.8);max-width:460px}
.top .avatar{background:var(--gold);color:var(--green)}
.tabs{display:flex;gap:4px;max-width:1180px;margin:18px auto 0;padding:6px;background:rgba(255,250,242,.10);border-radius:14px 14px 0 0;overflow:auto}
.tabs a{padding:9px 16px;border-radius:10px;color:rgba(255,250,242,.85);font-weight:500;font-size:14px;white-space:nowrap}
.tabs a.on{background:var(--cream);color:var(--green);font-weight:700}
.main{padding:28px 36px 90px;max-width:1180px;margin:0 auto}
.pagehead{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap}
.headtools{display:none}
"""
B_HTML = f"""<!doctype html><html><head><meta charset="utf-8">{FONTS}<style>{B_CSS}</style></head><body>
<header class="top"><div class="row"><img src="{LOGO_CREAM}" alt="Welfare Avenue"><div class="search">&#9906;&nbsp; Search tasks, people, goals, meetings</div><div class="avatar">SM</div></div>
<nav class="tabs">{"".join(f'<a class="{"on" if on else ""}">{n}</a>' for n, on in NAV)}</nav></header>
<main class="main">{CONTENT}</main></body></html>"""

# ---------- Direction C: dark green sidebar, editorial ----------
C_CSS = BASE + """
.shell{display:grid;grid-template-columns:250px 1fr;min-height:100vh}
.side{background:var(--green);padding:24px 16px;position:sticky;top:0;height:100vh;color:var(--cream)}
.side img{width:140px;display:block;margin:4px 8px 28px}
.side .ov{color:rgba(255,250,242,.55);margin:14px 12px 6px}
.nav a{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;color:rgba(255,250,242,.85);text-decoration:none;font-weight:500;font-size:14.5px;border-left:3px solid transparent}
.nav a.on{background:rgba(255,250,242,.10);color:var(--cream);font-weight:700;border-left-color:var(--gold)}
.nav a i{width:18px;height:18px;border-radius:5px;background:rgba(255,250,242,.25);display:inline-block}
.nav a.on i{background:var(--gold)}
.main{padding:28px 40px 90px;max-width:1180px}
.pagehead{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap}
.headtools{display:flex;align-items:center;gap:12px;flex:1;justify-content:flex-end;min-width:320px}
h1{font-size:54px!important;letter-spacing:.5px}
.card{border-radius:10px}
.card h3{font-family:'Barlow Condensed',sans-serif;font-size:20px;letter-spacing:.5px;font-weight:500}
"""
C_HTML = f"""<!doctype html><html><head><meta charset="utf-8">{FONTS}<style>{C_CSS}</style></head><body>
<div class="shell">{sidebar(True)}<main class="main">{CONTENT}</main></div></body></html>"""

# ---------- phones ----------
PHONE_BASE = """
.stats{grid-template-columns:repeat(2,1fr)}.grid{grid-template-columns:1fr}.pagehead{display:block}.headtools{display:none}h1{font-size:34px!important}
.fab{display:none}
.tabbar{position:fixed;left:0;right:0;bottom:0;background:var(--cream);border-top:1px solid var(--line2);display:flex;justify-content:space-around;padding:8px 6px 14px;box-shadow:0 -6px 20px rgba(16,63,57,.06)}
.tabbar a{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:11px;font-weight:600;color:var(--muted)}
.tabbar a i{width:24px;height:24px;border-radius:7px;background:rgba(16,63,57,.18);display:block}
.tabbar a.on{color:var(--green)}.tabbar a.on i{background:var(--green)}
.tabbar a.ask i{background:var(--gold);width:44px;height:44px;border-radius:50%;margin-top:-22px;box-shadow:0 8px 20px rgba(16,63,57,.25)}
"""
TABBAR = '<nav class="tabbar"><a class="on"><i></i>Home</a><a><i></i>Dashboard</a><a class="ask"><i></i>Ask</a><a><i></i>Teams</a><a><i></i>More</a></nav>'
A_PHONE = f"""<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">{FONTS}<style>{BASE}{PHONE_BASE}
.top{{display:flex;align-items:center;justify-content:space-between;padding:14px 18px 4px}}.top img{{width:104px}}
.main{{padding:6px 18px 110px}}</style></head><body>
<div class="top"><img src="{LOGO_GREEN}" alt="Welfare Avenue"><div class="avatar">SM</div></div><main class="main">{CONTENT}</main>{TABBAR}</body></html>"""
B_PHONE = f"""<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">{FONTS}<style>{BASE}{PHONE_BASE}
.top{{background:var(--green);display:flex;align-items:center;justify-content:space-between;padding:16px 18px 18px;border-radius:0 0 22px 22px}}.top img{{width:104px}}.top .avatar{{background:var(--gold);color:var(--green)}}
.main{{padding:14px 18px 110px}}</style></head><body>
<div class="top"><img src="{LOGO_CREAM}" alt="Welfare Avenue"><div class="avatar">SM</div></div><main class="main">{CONTENT}</main>{TABBAR}</body></html>"""

for name, html in [("dirA", A_HTML), ("dirB", B_HTML), ("dirC", C_HTML), ("dirA_phone", A_PHONE), ("dirB_phone", B_PHONE)]:
    open(os.path.join(HERE, name + ".html"), "w").write(html)
print("written")
